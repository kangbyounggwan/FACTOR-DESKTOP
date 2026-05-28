import { contextBridge, ipcRenderer } from 'electron';
// ── Sentry preload bridge — packaged 환경에서 module not found 발생 (electron-builder
// 가 @sentry/electron 의 sub-path "/preload" 를 asar 에 포함 못 함) → main 윈도우
// preload 전체 실패. main process 에 setupSentryMain() 으로 메인 에러는 이미 캡쳐
// 하므로 preload bridge 없어도 OK. require 가 throw 해도 무시되도록 try-catch.
try {
  require('@sentry/electron/preload');
} catch {
  // optional — sentry preload 없이도 preload 자체는 정상 작동
}

// ────────────────────────────────────────────────────────────
// 진단용: 렌더러 측 uncaught error / unhandledrejection을
// 메인 프로세스 로그(electron-log)로 전달.
// 메인 프로세스의 wc.on('console-message', ...)가 이 console.error를 캐치함.
// ────────────────────────────────────────────────────────────
(window as unknown as { __lastErrors?: string[] }).__lastErrors = [];
window.addEventListener('error', (e) => {
  const msg = `[renderer-onerror] ${e.message} @ ${e.filename}:${e.lineno}:${e.colno} stack=${e.error?.stack ?? 'n/a'}`;
  ((window as unknown as { __lastErrors?: string[] }).__lastErrors ??= []).push(msg);
  // 메인이 캡쳐할 수 있도록 console.error로 흘림 (wc.on('console-message'))
  console.error(msg);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack}` : String(e.reason);
  const msg = `[renderer-unhandledrejection] ${reason}`;
  ((window as unknown as { __lastErrors?: string[] }).__lastErrors ??= []).push(msg);
  console.error(msg);
});

contextBridge.exposeInMainWorld('electron', {
  app: {
    version: () => ipcRenderer.invoke('app:version'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  net: {
    isOnline: () => navigator.onLine,
    onChange: (cb: (online: boolean) => void) => {
      const handler = () => cb(navigator.onLine);
      window.addEventListener('online', handler);
      window.addEventListener('offline', handler);
      return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      };
    },
  },
  link: {
    fetchMetadata: (url: string) => ipcRenderer.invoke('link:fetchMetadata', url),
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    appUrls: {
      add: (entry: {
        id: string;
        name: string;
        url: string;
        addedAt: number;
        iconUrl?: string;
        description?: string;
      }) =>
        ipcRenderer.invoke('settings:appUrls:add', entry),
      remove: (id: string) => ipcRenderer.invoke('settings:appUrls:remove', id),
      update: (
        id: string,
        patch: Partial<{ id: string; name: string; url: string; addedAt: number }>,
      ) => ipcRenderer.invoke('settings:appUrls:update', id, patch),
    },
  },
  // 테마 — renderer 가 light/dark 전환 시 native chrome (titleBarOverlay) 도
  // 동적 변경. Electron 30+ 의 BrowserWindow.setTitleBarOverlay() 사용.
  theme: {
    setTitleBarOverlay: (opts: { color: string; symbolColor: string }) =>
      ipcRenderer.invoke('theme:setTitleBarOverlay', opts),
  },
  // Section 02 (2026-05-27) — autoUpdater bridge.
  // UpdateBanner 가 onUpdateDownloaded 로 구독 → "재시작" 클릭 시 quitAndInstall.
  autoUpdater: {
    onUpdateDownloaded: (
      cb: (info: { version: string; releaseNotes: string | null }) => void,
    ) => {
      const handler = (
        _e: unknown,
        info: { version: string; releaseNotes: string | null },
      ) => cb(info);
      ipcRenderer.on('autoUpdater:update-downloaded', handler);
      return () => {
        ipcRenderer.off('autoUpdater:update-downloaded', handler);
      };
    },
    quitAndInstall: () => ipcRenderer.invoke('autoUpdater:quitAndInstall'),
  },
});
