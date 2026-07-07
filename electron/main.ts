import { app, BrowserWindow, ipcMain, shell, type WebContents } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import fs from 'node:fs';
import { autoUpdater } from 'electron-updater';
import { createMainWindow } from './windows/mainWindow';
import { createChatPopupWindow } from './windows/chatPopupWindow';
import { registerDeepLink, installDeepLinkHandlers } from './protocol';
import {
  registerOntologySchemePrivileged,
  registerOntologyProtocolHandlers,
} from './ontology_protocol';
import { registerSettingsIpc } from './ipc/settings';
import { registerLinkIpc } from './ipc/link';
import { registerOntologyPacksIpc } from './ipc/ontology_packs';
import { registerAppProbeIpc } from './ipc/app_probe';
import { setupSentryMain } from './sentry';

// ── Section 03 — Sentry main init (가장 먼저, 다른 import 들의 throw 도 캐치) ──
setupSentryMain();

// ── webview 3rd-party cookie 정책 완화 (v0.0.71) ─────────────────────────
// Chromium 124+ 의 Tracking Protection 3PCD (third-party cookie phase-out)
// 가 webview 내부 외부 사이트 (서한 MES 등) 의 SSO/CSRF/session cookie 를
// 차단해 로그인이 깨지는 문제. APP 탭의 임베드 브라우저 용도에 한해 차단 해제.
//   - TrackingProtection3pcd: 핵심 3PCD 차단 feature
//   - PrivacySandboxAdsAPIs: 광고 sandbox (3PCD 와 같이 동작)
// 이 커맨드라인 플래그는 app.whenReady() 이전에 호출해야 적용된다.
app.commandLine.appendSwitch(
  'disable-features',
  'TrackingProtection3pcd,PrivacySandboxAdsAPIs',
);

// ── 온톨로지 뷰어 app:// custom scheme — privileged 등록은 app.whenReady 이전 필수.
//    (standard/secure/supportFetchAPI 없으면 fetch/CSP/secure-context 깨짐.)
registerOntologySchemePrivileged();

log.initialize();
log.transports.file.level = 'info';
// ── EPIPE 무한루프 방지 (v0.0.73) ─────────────────────────────────────
// packaged Electron GUI 앱은 stdout/stderr 가 detached console 에 연결됨.
// console.log/error 호출 시 random 하게 EPIPE (broken pipe) 발생 가능 — 그
// 에러가 process.on('uncaughtException') 으로 잡혀 log.error 가 다시 console
// transport 로 write → EPIPE → uncaughtException → 무한 루프.
// 해결: packaged 환경에선 console transport 끄기. 파일 transport 만 유지.
if (app.isPackaged) {
  log.transports.console.level = false;
}

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
let chatPopupWindow: BrowserWindow | null = null;

// IPC handlers
ipcMain.handle('app:version', () => app.getVersion());

// ── 멀티 윈도우 — 동일 앱의 독립 BrowserWindow 추가. ──────────────────
// 각 창은 자체 renderer(독립 zustand 탭 상태) + 공유 default/webview 세션이라 로그인
// 유지. 새 창은 APP(STORE/브라우저) 화면으로 진입. 네비게이션 정책은 createMainWindow
// 안에서 모든 창에 공통 적용된다.
ipcMain.handle('window:openNew', () => {
  createMainWindow({ isDev, startHash: '#/app' });
  log.info(
    '[main] new window opened, total=',
    BrowserWindow.getAllWindows().length,
  );
  return true;
});

// ── Chat 팝업 — 별도 떠 있는 창에서 질문 + 투명도(setOpacity) ──
ipcMain.handle('chatPopup:open', () => {
  if (chatPopupWindow && !chatPopupWindow.isDestroyed()) {
    chatPopupWindow.show();
    chatPopupWindow.focus();
    return;
  }
  chatPopupWindow = createChatPopupWindow({ isDev });
  chatPopupWindow.on('closed', () => {
    chatPopupWindow = null;
    // 팝업이 닫히면 본 창 renderer 가 오른쪽 AI 패널을 복원하도록 알림.
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('chatPopup:closed');
    }
  });
});

// ── 화면분석 스냅샷 브릿지 — 팝업(독립 창)은 webview 접근 불가라 main 경유. ──
// 팝업 요청 → 본 창 renderer(AppPage)에 캡쳐 위임 → 결과를 팝업 invoke 로 반환.
// reqId 로 요청/응답 상관. 6s 안에 응답 없으면 null(스냅샷 없이 진행).
const pendingSnapshotRequests = new Map<string, (snap: unknown) => void>();
let snapshotReqSeq = 0;

ipcMain.handle('chatPopup:captureSnapshot', async () => {
  // 본 창(primary) 우선. 닫혀 있으면 팝업이 아닌 첫 창으로 fallback.
  const host =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : (BrowserWindow.getAllWindows().find(
          (w) => !w.isDestroyed() && w !== chatPopupWindow,
        ) ?? null);
  if (!host) return null;
  const reqId = `snap-${++snapshotReqSeq}`;
  return await new Promise<unknown>((resolve) => {
    const timer = setTimeout(() => {
      pendingSnapshotRequests.delete(reqId);
      resolve(null);
    }, 6000);
    pendingSnapshotRequests.set(reqId, (snap) => {
      clearTimeout(timer);
      pendingSnapshotRequests.delete(reqId);
      resolve(snap ?? null);
    });
    host.webContents.send('appWebview:captureRequest', { reqId });
  });
});

ipcMain.on(
  'appWebview:captureResult',
  (_e, payload: { reqId: string; snapshot: unknown }) => {
    const resolver = pendingSnapshotRequests.get(payload?.reqId);
    if (resolver) resolver(payload?.snapshot ?? null);
  },
);
ipcMain.handle('chatPopup:setOpacity', (_e, value: number) => {
  if (!chatPopupWindow || chatPopupWindow.isDestroyed()) return;
  const v = Math.max(0.2, Math.min(1, Number(value) || 1));
  try {
    chatPopupWindow.setOpacity(v);
  } catch (err) {
    log.warn('[chat-popup] setOpacity failed', err);
  }
});
ipcMain.handle('chatPopup:close', () => {
  if (chatPopupWindow && !chatPopupWindow.isDestroyed()) chatPopupWindow.close();
});
registerSettingsIpc();
registerLinkIpc();
registerOntologyPacksIpc();
registerAppProbeIpc();

// ── APP 탭 webview 확대/축소 ─────────────────────────────────────────
// Ctrl+휠 / Ctrl+(+/-/0) 은 webview 게스트 프로세스로 들어가는 입력이라
// 호스트 renderer 에서는 못 잡는다 → main 에서 webview webContents 에 직접
// 바인딩. 변경 결과는 호스트 renderer 로 broadcast (TabBar 줌 % 표시 동기화).
// 줌은 Chromium per-origin 정책 — 같은 사이트의 모든 탭에 함께 적용된다.
const WEBVIEW_ZOOM_MIN = 0.25;
const WEBVIEW_ZOOM_MAX = 3;

function clampZoom(factor: number): number {
  return Math.min(WEBVIEW_ZOOM_MAX, Math.max(WEBVIEW_ZOOM_MIN, factor));
}

function broadcastWebviewZoom(contents: WebContents, zoomFactor: number): void {
  const host = contents.hostWebContents;
  if (host && !host.isDestroyed()) {
    host.send('appWebview:zoomChanged', {
      webContentsId: contents.id,
      zoomFactor,
    });
  }
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return;

  // Ctrl+마우스휠 줌
  contents.on('zoom-changed', (_e, zoomDirection) => {
    const delta = zoomDirection === 'in' ? 0.1 : -0.1;
    const next = clampZoom(contents.getZoomFactor() + delta);
    contents.setZoomFactor(next);
    broadcastWebviewZoom(contents, next);
  });

  // Ctrl+(+/-/0) 키보드 줌 — 게스트 페이지가 받기 전에 가로챔
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) {
      return;
    }
    let next: number | null = null;
    if (input.key === '+' || input.key === '=') {
      next = clampZoom(contents.getZoomFactor() + 0.1);
    } else if (input.key === '-') {
      next = clampZoom(contents.getZoomFactor() - 0.1);
    } else if (input.key === '0') {
      next = 1;
    }
    if (next !== null) {
      event.preventDefault();
      contents.setZoomFactor(next);
      broadcastWebviewZoom(contents, next);
    }
  });
});

// 테마 — renderer 의 ThemeProvider 가 light/dark 전환 시 호출.
// Windows / Linux 의 titleBarOverlay 색을 동적 변경 (macOS 는 hiddenInset 라 무관).
ipcMain.handle(
  'theme:setTitleBarOverlay',
  (_e, opts: { color: string; symbolColor: string }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (process.platform === 'darwin') return; // macOS hiddenInset — overlay 없음
    try {
      mainWindow.setTitleBarOverlay({
        color: opts.color,
        symbolColor: opts.symbolColor,
        height: 40,
      });
    } catch (err) {
      log.warn('[theme] setTitleBarOverlay failed', err);
    }
  },
);

// ── Section 02 (2026-05-27) — autoUpdater IPC ───────────────────────
// 렌더러의 UpdateBanner 가 "재시작" 클릭 시 호출.
ipcMain.handle('autoUpdater:quitAndInstall', () => {
  log.info('[autoUpdater] quitAndInstall requested by renderer');
  autoUpdater.quitAndInstall();
});

// ── Section 02 — setupAutoUpdater ───────────────────────────────────
// 미서명 EXE 도 OK — electron-updater 는 sha512 hash (latest.yml) 로 무결성
// 검증. Section 01 (code signing) 은 B2B 외부 고객 확대 시점에 도입 예정.
// dev 모드 skip + 4시간 polling + electron-log 통합.
function setupAutoUpdater(window: BrowserWindow | null) {
  if (process.env.NODE_ENV === 'development') {
    log.info('[autoUpdater] skipped in dev');
    return;
  }
  autoUpdater.logger = log as unknown as typeof autoUpdater.logger;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () =>
    log.info('[autoUpdater] checking'),
  );
  autoUpdater.on('update-available', (info) =>
    log.info('[autoUpdater] available', info.version),
  );
  autoUpdater.on('update-not-available', () =>
    log.info('[autoUpdater] up-to-date'),
  );
  autoUpdater.on('download-progress', (p) =>
    log.info('[autoUpdater] download', `${p.percent.toFixed(1)}%`),
  );
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[autoUpdater] downloaded', info.version);
    // 렌더러 UpdateBanner 에 전달 — 사용자 "재시작" 클릭 시 quitAndInstall
    window?.webContents.send('autoUpdater:update-downloaded', {
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    });
  });
  autoUpdater.on('error', (err) => log.error('[autoUpdater] error', err));

  // 시작 1회 + 4시간 polling
  autoUpdater
    .checkForUpdates()
    .catch((e) => log.error('[autoUpdater] check fail', e));
  setInterval(
    () => {
      autoUpdater
        .checkForUpdates()
        .catch((e) => log.error('[autoUpdater] periodic check fail', e));
    },
    4 * 60 * 60 * 1000,
  );
}
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
  // app:// handler 는 윈도우가 webview 를 붙이기 전에 살아 있어야 한다.
  registerOntologyProtocolHandlers();

  mainWindow = createMainWindow({ isDev });

  // Section 02 — 시작 직후 백그라운드 update 확인 + 4h polling
  setupAutoUpdater(mainWindow);

  // 네비게이션 정책(window.open deny + 외부 URL 시스템 브라우저)은 이제
  // createMainWindow 안에서 모든 창(main/멀티윈도우/activate 재생성)에 공통 적용된다.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow({ isDev });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// EPIPE 등 stdout/stderr 관련 에러는 swallow (electron-log 가 broken pipe 에 write
// → uncaughtException → log.error → 또 broken pipe 무한 루프 방지). 그 외 에러는
// 정상 로깅. try-catch 로 log 자체 실패 가능성도 차단.
function safeLogError(prefix: string, err: unknown): void {
  try {
    const code = (err as { code?: string } | null | undefined)?.code;
    if (code === 'EPIPE' || code === 'EAGAIN') return; // stdout/stderr 깨짐 — 무시
    log.error(prefix, err);
  } catch {
    // log 자체가 실패해도 무한 루프 차단
  }
}
process.on('uncaughtException', (err) => safeLogError('[main] uncaught', err));
process.on('unhandledRejection', (reason) =>
  safeLogError('[main] unhandledRejection', reason),
);
