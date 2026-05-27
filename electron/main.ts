import { app, BrowserWindow, ipcMain, shell } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import fs from 'node:fs';
import { createMainWindow } from './windows/mainWindow';
import { registerDeepLink, installDeepLinkHandlers } from './protocol';
import { registerSettingsIpc } from './ipc/settings';
import { registerLinkIpc } from './ipc/link';

log.initialize();
log.transports.file.level = 'info';

// ── Section 05 (2026-05-27) — log rotation ──────────────────────────
// maxSize 5MB × depth 5 (총 상한 ~30MB).
// 회전 시 main.log.5 삭제 → .4→.5 → ... → .1→.2 → 현재→.1.
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.file.archiveLogFn = (oldLog) => {
  const oldPath = typeof oldLog === 'string' ? oldLog : (oldLog as { path: string }).path;
  const dir = path.dirname(oldPath);
  const base = path.basename(oldPath); // 예: main.log
  const stem = base.replace(/\.log$/, '');
  const maxDepth = 5;
  const candidate = (n: number) => path.join(dir, `${stem}.log.${n}`);

  // .5 가 있으면 삭제 (oldest first)
  const oldest = candidate(maxDepth);
  if (fs.existsSync(oldest)) {
    try { fs.unlinkSync(oldest); } catch { /* ignore */ }
  }
  // .4 → .5, .3 → .4, ..., .1 → .2
  for (let n = maxDepth - 1; n >= 1; n--) {
    const src = candidate(n);
    const dst = candidate(n + 1);
    if (fs.existsSync(src)) {
      try { fs.renameSync(src, dst); } catch { /* ignore */ }
    }
  }
  // 현재 oldLog → .1
  try { fs.renameSync(oldPath, candidate(1)); } catch { /* electron-log 가 새 파일 생성 */ }
};

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
