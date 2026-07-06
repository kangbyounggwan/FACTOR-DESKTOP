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
  /** 로그인 user_id 별 즐겨찾기 버킷. 다른 아이디로 로그인 시 공유 안 됨(계정 격리). */
  appUrlsByUser: Record<string, AppUrlEntry[]>;
  // 이후 확장: autostart, kioskMode, updateChannel, backend URLs 등
}

const DEFAULTS: DesktopSettings = {
  appUrlsByUser: {},
};

/** user_id → 저장 버킷 키. 비로그인/빈값은 '_anon'(로컬 디바이스 버킷). 안전 문자만. */
function userKey(userId: unknown): string {
  const k = String(userId ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);
  return k || '_anon';
}

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

// ── user_id 버킷 헬퍼 ─────────────────────────────────────────────────
function getList(userId: unknown): AppUrlEntry[] {
  const all = (store.get('appUrlsByUser') as Record<string, AppUrlEntry[]>) ?? {};
  return all[userKey(userId)] ?? [];
}

function setList(userId: unknown, list: AppUrlEntry[]): AppUrlEntry[] {
  const all = (store.get('appUrlsByUser') as Record<string, AppUrlEntry[]>) ?? {};
  all[userKey(userId)] = list;
  store.set('appUrlsByUser', all);
  return list;
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', () => store.store);

  ipcMain.handle('settings:get', (_e, key: keyof DesktopSettings) => store.get(key));

  // appUrls — 모두 user_id 스코프. 다른 아이디로 로그인하면 서로 안 보임(계정 격리).
  ipcMain.handle('settings:appUrls:list', (_e, userId: string) => getList(userId));

  ipcMain.handle('settings:appUrls:add', (_e, userId: string, entry: AppUrlEntry) => {
    const cleanEntry = sanitizeAppUrlEntry(entry);
    const list = getList(userId);
    if (list.length >= MAX_APP_URLS) {
      throw new Error(`Only ${MAX_APP_URLS} URLs can be saved`);
    }
    if (list.some((u) => u.id === cleanEntry.id)) {
      throw new Error('Duplicate URL id');
    }
    return setList(userId, [...list, cleanEntry]);
  });

  ipcMain.handle('settings:appUrls:remove', (_e, userId: string, id: string) => {
    const list = getList(userId);
    return setList(userId, list.filter((u) => u.id !== id));
  });

  ipcMain.handle(
    'settings:appUrls:update',
    (_e, userId: string, id: string, patch: Partial<AppUrlEntry>) => {
      const list = getList(userId);
      const cleanPatch = sanitizeAppUrlPatch(patch);
      return setList(
        userId,
        list.map((u) => (u.id === id ? { ...u, ...cleanPatch } : u)),
      );
    },
  );
}

export { store as settingsStore };
