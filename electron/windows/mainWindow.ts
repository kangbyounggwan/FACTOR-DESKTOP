import { BrowserWindow } from 'electron';
import path from 'path';

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

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:5180');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return win;
}
