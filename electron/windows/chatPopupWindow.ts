import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

interface Opts {
  isDev: boolean;
}

/**
 * Chat 팝업 — AI 어시스턴트를 본 창과 별개의 떠 있는 작은 창에서 사용.
 *
 * - frameless + alwaysOnTop + resizable → 다른 앱(예: MES) 위에 띄워 질문.
 * - setOpacity 로 투명도 조절 (renderer 의 슬라이더가 IPC 로 호출).
 * - renderer 는 HashRoute `#/chat-popup` 로 진입 (DesktopShell 밖, 자체 titlebar).
 *
 * 단일 인스턴스 — 이미 열려 있으면 focus 만.
 */
export function createChatPopupWindow({ isDev }: Opts): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 360,
    backgroundColor: '#0a0d12',
    title: 'FACTOR AI',
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:5180/#/chat-popup');
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    if (!fs.existsSync(indexPath)) {
      log.error('[chat-popup] dist/index.html NOT FOUND');
    }
    win
      .loadFile(indexPath, { hash: 'chat-popup' })
      .catch((err) => log.error('[chat-popup] loadFile failed', err));
  }

  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const levels = ['debug', 'info', 'warning', 'error'] as const;
    const lv = levels[level] ?? 'info';
    log[lv === 'warning' ? 'warn' : lv](
      `[chat-popup:${lv}] ${message} (${sourceId}:${line})`,
    );
  });

  return win;
}
