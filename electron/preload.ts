import { contextBridge, ipcRenderer } from 'electron';

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
