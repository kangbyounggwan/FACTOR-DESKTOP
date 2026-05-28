import { ipcMain } from 'electron';
import Store from 'electron-store';

export interface AppUrlEntry {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  iconUrl?: string;
  description?: string;
}

export interface DesktopSettings {
  appUrls: AppUrlEntry[];
  // 이후 확장: autostart, kioskMode, updateChannel, backend URLs 등
}

const DEFAULTS: DesktopSettings = {
  appUrls: [],
};

const store = new Store<DesktopSettings>({
  name: 'config',
  defaults: DEFAULTS,
});

const MAX_APP_URLS = 100;
const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 200;

function normalizeHttpUrl(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('URL must be a string');
  }
  const trimmed = raw.trim();
  const parsed = new URL(trimmed);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Only http(s) URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }
  return parsed.toString();
}

function clampString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function sanitizeAppUrlEntry(entry: AppUrlEntry): AppUrlEntry {
  const id = clampString(entry.id, 80);
  const name = clampString(entry.name, MAX_NAME_LENGTH);
  if (!id) throw new Error('Missing URL id');
  if (!name) throw new Error('Missing URL name');

  const clean: AppUrlEntry = {
    id,
    name,
    url: normalizeHttpUrl(entry.url),
    addedAt:
      typeof entry.addedAt === 'number' && Number.isFinite(entry.addedAt)
        ? entry.addedAt
        : Date.now(),
  };

  const description = clampString(entry.description, MAX_DESCRIPTION_LENGTH);
  if (description) clean.description = description;

  if (entry.iconUrl) {
    clean.iconUrl = normalizeHttpUrl(entry.iconUrl);
  }

  return clean;
}

function sanitizeAppUrlPatch(patch: Partial<AppUrlEntry>): Partial<AppUrlEntry> {
  const clean: Partial<AppUrlEntry> = {};

  if ('name' in patch) {
    const name = clampString(patch.name, MAX_NAME_LENGTH);
    if (!name) throw new Error('Missing URL name');
    clean.name = name;
  }
  if ('url' in patch) {
    clean.url = normalizeHttpUrl(patch.url);
  }
  if ('description' in patch) {
    clean.description = clampString(patch.description, MAX_DESCRIPTION_LENGTH);
  }
  if ('iconUrl' in patch) {
    clean.iconUrl = patch.iconUrl ? normalizeHttpUrl(patch.iconUrl) : undefined;
  }

  return clean;
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', () => store.store);

  ipcMain.handle('settings:get', (_e, key: keyof DesktopSettings) => store.get(key));

  // appUrls 전용 헬퍼 (atomic add/remove)
  ipcMain.handle('settings:appUrls:add', (_e, entry: AppUrlEntry) => {
    const cleanEntry = sanitizeAppUrlEntry(entry);
    const list = (store.get('appUrls') as AppUrlEntry[]) ?? [];
    if (list.length >= MAX_APP_URLS) {
      throw new Error(`Only ${MAX_APP_URLS} URLs can be saved`);
    }
    if (list.some((u) => u.id === cleanEntry.id)) {
      throw new Error('Duplicate URL id');
    }
    store.set('appUrls', [...list, cleanEntry]);
    return store.get('appUrls');
  });

  ipcMain.handle('settings:appUrls:remove', (_e, id: string) => {
    const list = (store.get('appUrls') as AppUrlEntry[]) ?? [];
    store.set('appUrls', list.filter((u) => u.id !== id));
    return store.get('appUrls');
  });

  ipcMain.handle('settings:appUrls:update', (_e, id: string, patch: Partial<AppUrlEntry>) => {
    const list = (store.get('appUrls') as AppUrlEntry[]) ?? [];
    const cleanPatch = sanitizeAppUrlPatch(patch);
    store.set(
      'appUrls',
      list.map((u) => (u.id === id ? { ...u, ...cleanPatch } : u)),
    );
    return store.get('appUrls');
  });
}

export { store as settingsStore };
