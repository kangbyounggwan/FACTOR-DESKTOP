import { contextBridge, ipcRenderer } from 'electron';

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
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    appUrls: {
      add: (entry: { id: string; name: string; url: string; addedAt: number }) =>
        ipcRenderer.invoke('settings:appUrls:add', entry),
      remove: (id: string) => ipcRenderer.invoke('settings:appUrls:remove', id),
      update: (
        id: string,
        patch: Partial<{ id: string; name: string; url: string; addedAt: number }>,
      ) => ipcRenderer.invoke('settings:appUrls:update', id, patch),
    },
  },
});
