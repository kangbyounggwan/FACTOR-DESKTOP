/**
 * Electron preload API 타입 정의.
 *
 * renderer는 window.electron을 통해서만 main process와 통신.
 * 웹 빌드에서는 window.electron === undefined → /lib/electron.ts wrapper가 no-op으로 처리.
 */

export {};

export interface AppUrlEntry {
  id: string;
  name: string;
  url: string;
  addedAt: number;
}

export interface DesktopSettings {
  appUrls: AppUrlEntry[];
}

export interface DesktopElectronAPI {
  app: {
    version: () => Promise<string>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  net: {
    isOnline: () => boolean;
    onChange: (cb: (online: boolean) => void) => () => void;
  };
  settings: {
    getAll: () => Promise<DesktopSettings>;
    get: <K extends keyof DesktopSettings>(key: K) => Promise<DesktopSettings[K]>;
    set: <K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]) => Promise<void>;
    appUrls: {
      add: (entry: AppUrlEntry) => Promise<AppUrlEntry[]>;
      remove: (id: string) => Promise<AppUrlEntry[]>;
      update: (id: string, patch: Partial<AppUrlEntry>) => Promise<AppUrlEntry[]>;
    };
  };
}

declare global {
  interface Window {
    electron?: DesktopElectronAPI;
  }
}
