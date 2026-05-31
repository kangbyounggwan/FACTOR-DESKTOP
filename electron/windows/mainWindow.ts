import { BrowserWindow, session } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

interface Opts {
  isDev: boolean;
}

const WEBVIEW_PARTITION = 'persist:factor-apps';

function isAllowedWebviewUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return /^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function installSessionPermissionGuards(): void {
  // 외부 사이트 (서한 MES 등) 가 로그인 / 일반 기능에 필요로 하는 안전 권한 화이트리스트.
  // 그 외 (geolocation, camera, microphone 등) 는 거부 — boundary 명확히.
  const WEBVIEW_ALLOWED = new Set<string>([
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
    'notifications',
    'pointerLock',
    'background-sync',
    'persistent-storage',
    'storage-access',
    'idle-detection',
  ]);

  // 데스크탑 본체 (factor-desktop 자체 renderer) 는 권한 일체 거부.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      log.warn('[permission:default] denied', {
        permission,
        url: details.requestingUrl,
        ownerUrl: webContents.getURL(),
      });
      callback(false);
    },
  );

  // 웹뷰 partition (APP 탭 외부 사이트) — 위험 권한만 거부, 그 외 허용.
  // v0.0.75: 화이트리스트 → 블랙리스트 전환. webview 가 v0.0.32 시점에는
  // 권한 핸들러 자체가 없어 Electron default(all-allow) 였고 일반 Chrome 같이
  // 작동했음. 현재 화이트리스트가 너무 좁아 MES 의 정상 흐름 차단 가능성.
  const WEBVIEW_DENIED = new Set<string>([
    'geolocation',
    'media', // 카메라/마이크 (mediaKeySystem 은 별개)
    'midi',
    'midiSysex',
    'openExternal',
    'serial',
    'usb',
    'hid',
  ]);
  session.fromPartition(WEBVIEW_PARTITION).setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const denied = WEBVIEW_DENIED.has(permission);
      log[denied ? 'warn' : 'info'](
        `[permission:webview] ${denied ? 'denied' : 'granted'}`,
        {
          permission,
          url: details.requestingUrl,
          ownerUrl: webContents.getURL(),
        },
      );
      callback(!denied);
    },
  );
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
  installSessionPermissionGuards();

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

  wc.on('will-attach-webview', (event, webPreferences, params) => {
    const src = params.src;
    if (!isAllowedWebviewUrl(src)) {
      log.warn('[webview] blocked attach for unsafe src:', src);
      event.preventDefault();
      return;
    }

    params.partition = WEBVIEW_PARTITION;
    delete params.preload;
    delete params.nodeintegration;
    // allowpopups 유지 — MES 로그인 / 메뉴 popup 사용.

    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    // ⚠ sandbox=true 제거 (v0.0.75) — Electron sandbox 모드가 webview 안의
    // localStorage / fetch credentials 흐름을 일반 Chrome 과 다르게 처리해
    // 외부 SPA (서한 MES) 의 jwt-decode 가 throw. v0.0.32 (sandbox 미설정 =
    // default false) 에서는 정상 작동 → sandbox 만 제거하면 일반 Chrome 환경에
    // 가까워짐. contextIsolation/nodeIntegration 보안은 유지.
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    delete webPreferences.preload;
  });

  wc.on('did-attach-webview', (_event, guestWebContents) => {
    const guestId = guestWebContents.id;
    log.info(`[webview ${guestId}] attached — url=`, guestWebContents.getURL());

    // ── User-Agent 위장 (v0.0.74) ────────────────────────────────────
    // default UA 에는 "FACTOR DESKTOP/x.y.z" + "Electron/30.x" 가 포함되어
    // 외부 사이트 (서한 MES 등) 가 임베드 클라이언트로 인식하고 차단 가능.
    // 일반 Chrome UA 로 위장 — 우리 Chromium 버전(process.versions.chrome)을
    // 그대로 사용해 호환성 유지.
    const chromeVer = process.versions.chrome;
    const standardChromeUA =
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
      `(KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
    guestWebContents.setUserAgent(standardChromeUA);
    log.info(`[webview ${guestId}] UA overridden →`, standardChromeUA);

    guestWebContents.setWindowOpenHandler(({ url, frameName, disposition }) => {
      // http/https URL 만 허용 — 같은 partition 새 webview 로. 차단 시 로그인 후
      // popup-driven 메뉴/SSO 흐름이 끊겨 button 이 "안 눌리는" 듯 보임.
      if (isAllowedWebviewUrl(url)) {
        log.info(`[webview ${guestId}] window.open allowed →`, {
          url,
          frameName,
          disposition,
        });
        // partition + safe 한 webPreferences 로 새 BrowserWindow 생성 (popup).
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            webPreferences: {
              partition: WEBVIEW_PARTITION,
              nodeIntegration: false,
              contextIsolation: true,
              // ⚠ sandbox=false — 이 popup 도 외부 SPA(서한 MES) 를 로드한다.
              // will-attach-webview(메인 webview) 와 동일 이유: Electron sandbox 가
              // localStorage / fetch credentials 흐름을 일반 Chrome 과 다르게 처리해
              // SPA 의 jwt-decode 가 throw (InvalidTokenError). v0.0.75 에서 메인
              // webview 만 고치고 popup 경로를 누락 → 로그인 팝업에서 재발하던 것을 정합.
              // contextIsolation/nodeIntegration 보안은 유지.
              sandbox: false,
              webSecurity: true,
              allowRunningInsecureContent: false,
            },
          },
        };
      }
      log.warn(`[webview ${guestId}] blocked unsafe window.open:`, url);
      return { action: 'deny' };
    });
    guestWebContents.on('will-navigate', (event, url) => {
      if (!isAllowedWebviewUrl(url)) {
        log.warn(`[webview ${guestId}] blocked unsafe navigation:`, url);
        event.preventDefault();
        return;
      }
      log.info(`[webview ${guestId}] will-navigate →`, url);
    });

    // ── 로그인 디버깅: navigation / fail / console / response 헤더 ──
    guestWebContents.on('did-navigate', (_e, url, code, status) => {
      log.info(`[webview ${guestId}] did-navigate`, { url, code, status });
    });
    guestWebContents.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      log.info(`[webview ${guestId}] did-navigate-in-page`, { url, isMainFrame });
    });
    guestWebContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      log.error(`[webview ${guestId}] did-fail-load`, {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    });
    guestWebContents.on('console-message', (_e, level, message, line, sourceId) => {
      const lv = (['debug', 'info', 'warning', 'error'] as const)[level] ?? 'info';
      log[lv === 'warning' ? 'warn' : lv](
        `[webview ${guestId} console:${lv}] ${message} (${sourceId}:${line})`,
      );
    });
    guestWebContents.on('render-process-gone', (_e, details) => {
      log.error(`[webview ${guestId}] render-process-gone`, details);
    });

    // FACTOR_DEBUG=1 시 webview devtools 자동 오픈 (별도 창) — login 디버깅용
    if (debugFlag) {
      log.info(`[webview ${guestId}] FACTOR_DEBUG=1 → openDevTools`);
      guestWebContents.openDevTools({ mode: 'detach' });
    }
  });

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
