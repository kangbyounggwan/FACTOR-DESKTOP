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
  /** og:image / link[rel=icon] 또는 favicon 자동 추출 결과. 없으면 google favicon API fallback */
  iconUrl?: string;
  /** og:description 자동 추출 결과 */
  description?: string;
}

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  /** fetch 가 실패한 경우 사유 (UX 에서 사용자에게 알림) */
  error?: string;
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
  link: {
    /** URL 의 메타 정보(title, description, icon) 를 메인 프로세스에서 fetch (CORS 우회) */
    fetchMetadata: (url: string) => Promise<LinkMetadata>;
  };
  settings: {
    getAll: () => Promise<DesktopSettings>;
    get: <K extends keyof DesktopSettings>(key: K) => Promise<DesktopSettings[K]>;
    appUrls: {
      add: (entry: AppUrlEntry) => Promise<AppUrlEntry[]>;
      remove: (id: string) => Promise<AppUrlEntry[]>;
      update: (id: string, patch: Partial<AppUrlEntry>) => Promise<AppUrlEntry[]>;
    };
  };
  /** Section 02 — autoUpdater bridge (electron-updater + GitHub Releases). */
  autoUpdater?: {
    onUpdateDownloaded: (
      cb: (info: { version: string; releaseNotes: string | null }) => void,
    ) => () => void;
    quitAndInstall: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electron?: DesktopElectronAPI;
  }
}
