import { ipcMain } from 'electron';
import Store from 'electron-store';

export interface AppUrlEntry {
  id: string;
  name: string;
  url: string;
  addedAt: number;
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

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', () => store.store);

  ipcMain.handle('settings:get', (_e, key: keyof DesktopSettings) => store.get(key));

  ipcMain.handle('settings:set', (_e, key: keyof DesktopSettings, value: unknown) => {
    store.set(key, value as never);
  });

  // appUrls 전용 헬퍼 (atomic add/remove)
  ipcMain.handle('settings:appUrls:add', (_e, entry: AppUrlEntry) => {
    const list = (store.get('appUrls') as AppUrlEntry[]) ?? [];
    store.set('appUrls', [...list, entry]);
    return store.get('appUrls');
  });

  ipcMain.handle('settings:appUrls:remove', (_e, id: string) => {
    const list = (store.get('appUrls') as AppUrlEntry[]) ?? [];
    store.set('appUrls', list.filter((u) => u.id !== id));
    return store.get('appUrls');
  });

  ipcMain.handle('settings:appUrls:update', (_e, id: string, patch: Partial<AppUrlEntry>) => {
    const list = (store.get('appUrls') as AppUrlEntry[]) ?? [];
    store.set(
      'appUrls',
      list.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
    return store.get('appUrls');
  });
}

export { store as settingsStore };
