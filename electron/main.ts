import { app, BrowserWindow, ipcMain, shell } from 'electron';
import log from 'electron-log';
import { createMainWindow } from './windows/mainWindow';
import { registerDeepLink, installDeepLinkHandlers } from './protocol';
import { registerSettingsIpc } from './ipc/settings';
import { registerLinkIpc } from './ipc/link';

log.initialize();
log.transports.file.level = 'info';
log.info('[main] starting, version', app.getVersion());
log.info('[main] electron', process.versions.electron, 'node', process.versions.node, 'chrome', process.versions.chrome);
log.info('[main] cwd=', process.cwd(), 'execPath=', process.execPath);
log.info('[main] isPackaged=', app.isPackaged, 'resourcesPath=', process.resourcesPath);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

// IPC handlers
ipcMain.handle('app:version', () => app.getVersion());
registerSettingsIpc();
registerLinkIpc();
ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  // 안전 검사: http/https/mailto 만 허용
  if (!/^(https?:|mailto:)/.test(url)) {
    log.warn('[shell:openExternal] blocked non-http(s) url:', url);
    return;
  }
  await shell.openExternal(url);
});

// Deep link (factor-mes://) — single instance 처리 포함
registerDeepLink();
installDeepLinkHandlers(() => mainWindow);

app.whenReady().then(() => {
  mainWindow = createMainWindow({ isDev });

  // 모든 <a target="_blank"> / window.open() → 시스템 브라우저 위임
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 내부 네비게이션 중 외부 URL은 차단 (방어)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devOrigin = 'http://localhost:5180';
    const isInternal =
      url.startsWith(devOrigin) ||
      url.startsWith('file://') ||
      url.startsWith('factor-mes://');
    if (!isInternal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow({ isDev });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => log.error('[main] uncaught', err));
process.on('unhandledRejection', (reason) => log.error('[main] unhandledRejection', reason));
