import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

interface Opts {
  isDev: boolean;
}

/**
 * Claude Desktop 스타일의 헤더리스 윈도우.
 *
 * - macOS: hiddenInset → 타이틀바 숨김, 네이티브 traffic lights는 유지(좌상단)
 * - Windows/Linux: hidden + titleBarOverlay → 네이티브 close/min/max는 우상단,
 *   배경/심볼 색을 콘텐츠와 통일
 *
 * 드래그 영역은 renderer 측 CSS `-webkit-app-region: drag`로 지정.
 */
export function createMainWindow({ isDev }: Opts): BrowserWindow {
  const isMac = process.platform === 'darwin';
  const debugFlag = process.env.FACTOR_DEBUG === '1';

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0a0d12',
    title: 'FACTOR DESKTOP',
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    titleBarOverlay: !isMac
      ? {
          color: '#0a0d12',
          symbolColor: '#e5e7eb',
          height: 36,
        }
      : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: true, // APP 탭에서 임의의 URL을 <webview>로 임베드 (별도 프로세스)
    },
  });

  // ────────────────────────────────────────────────────────────
  // 진단용 webContents 이벤트 로깅 — 빈 화면/렌더러 크래시 디버깅용
  // ────────────────────────────────────────────────────────────
  const wc = win.webContents;

  wc.on('did-start-loading', () => log.info('[win] did-start-loading'));
  wc.on('did-finish-load', () => {
    log.info('[win] did-finish-load — url=', wc.getURL());

    // DOM 상태 진단 (FACTOR_DEBUG=1 에서만) — React 마운트/콘텐츠 확인용
    if (!debugFlag) return;
    setTimeout(() => {
      wc.executeJavaScript(
        `(() => {
           const root = document.getElementById('root');
           return JSON.stringify({
             href: location.href,
             pathname: location.pathname,
             title: document.title,
             rootHtmlLen: root ? root.innerHTML.length : -1,
             bodyHtmlLen: document.body ? document.body.innerHTML.length : -1,
             bodyChildren: document.body ? document.body.children.length : -1,
             rootFirstChildTag: root && root.firstElementChild ? root.firstElementChild.tagName : null,
             errs: (window).__lastErrors || [],
           });
         })()`,
        true,
      ).then((dump) => log.info('[win] dom-dump:', dump))
       .catch((err) => log.error('[win] dom-dump failed', err));
    }, 1500);
  });
  wc.on('dom-ready', () => log.info('[win] dom-ready — url=', wc.getURL()));
  wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    log.error('[win] did-fail-load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  });
  wc.on(
    'did-fail-provisional-load',
    (_e, errorCode, errorDescription, validatedURL) => {
      log.error('[win] did-fail-provisional-load', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );
  wc.on('preload-error', (_e, preloadPath, error) => {
    log.error('[win] preload-error', preloadPath, error);
  });
  wc.on('render-process-gone', (_e, details) => {
    log.error('[win] render-process-gone', details);
  });
  wc.on('unresponsive', () => log.warn('[win] unresponsive'));
  wc.on('responsive', () => log.info('[win] responsive'));
  wc.on('console-message', (_e, level, message, line, sourceId) => {
    const levels = ['debug', 'info', 'warning', 'error'] as const;
    const lv = levels[level] ?? 'info';
    log[lv === 'warning' ? 'warn' : lv](
      `[renderer:${lv}] ${message} (${sourceId}:${line})`,
    );
  });

  // ────────────────────────────────────────────────────────────
  // ready-to-show 가 안 떠도 일정 시간 후 강제로 show — 디버깅 가시화
  // (ready-to-show 이벤트는 첫 paint가 일어나야 발생; 렌더러가 죽으면 영영 안 옴)
  // ────────────────────────────────────────────────────────────
  let shown = false;
  win.once('ready-to-show', () => {
    shown = true;
    log.info('[win] ready-to-show → show()');
    win.show();
  });
  setTimeout(() => {
    if (!shown && !win.isDestroyed()) {
      log.warn('[win] ready-to-show timeout (5s) — forcing show() for diagnostics');
      win.show();
      if (!isDev) wc.openDevTools({ mode: 'detach' });
    }
  }, 5000);

  if (isDev) {
    log.info('[win] loadURL http://localhost:5180');
    win.loadURL('http://localhost:5180');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    const exists = fs.existsSync(indexPath);
    log.info('[win] loadFile', indexPath, 'exists=', exists);
    if (!exists) {
      log.error(
        '[win] dist/index.html NOT FOUND — vite build 후 electron-builder 재빌드 필요',
      );
    }
    // 시작 hash 오버라이드 (예: FACTOR_START_HASH=#/app 으로 STORE 화면 직접 진입)
    const startHash = process.env.FACTOR_START_HASH;
    const loadOptions = startHash
      ? { hash: startHash.replace(/^#/, '') }
      : undefined;
    if (startHash) log.info('[win] FACTOR_START_HASH=', startHash);
    win.loadFile(indexPath, loadOptions).catch((err) => log.error('[win] loadFile failed', err));

    if (debugFlag) {
      log.info('[win] FACTOR_DEBUG=1 → openDevTools');
      wc.openDevTools({ mode: 'detach' });
    }
  }

  return win;
}
