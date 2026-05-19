import { app, BrowserWindow } from 'electron';
import path from 'path';
import log from 'electron-log';

const SCHEME = 'factor-mes';

/**
 * Deep link 등록: factor-mes://... URL을 OS가 이 앱으로 라우팅하도록 등록.
 * 개발 중에는 process.defaultApp (electron .) 환경 대응.
 */
export function registerDeepLink(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [
        path.resolve(process.argv[1]!),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(SCHEME);
  }
  log.info(`[protocol] registered scheme: ${SCHEME}://`);
}

/**
 * Windows에서 두 번째 인스턴스가 deep link로 실행될 때 처리.
 * macOS는 'open-url' 이벤트 사용 (별도).
 */
export function installDeepLinkHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Single instance lock — 중복 실행 차단 + 두 번째 인스턴스의 argv 처리
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${SCHEME}://`));
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (url) {
        log.info(`[protocol] second-instance url: ${url}`);
        win.webContents.send('deep-link', url);
      }
    }
  });

  // macOS deep link
  app.on('open-url', (event, url) => {
    event.preventDefault();
    log.info(`[protocol] open-url: ${url}`);
    const win = getMainWindow();
    if (win) {
      win.focus();
      win.webContents.send('deep-link', url);
    }
  });
}
