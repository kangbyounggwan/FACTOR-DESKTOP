/**
 * Electron preload API 타입 정의.
 *
 * renderer는 window.electron을 통해서만 main process와 통신.
 * 웹 빌드에서는 window.electron === undefined → /lib/electron.ts wrapper가 no-op으로 처리.
 */

export {};

export interface AppUrlEntry {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  /** og:image / link[rel=icon] 또는 favicon 자동 추출 결과. 없으면 google favicon API fallback */
  iconUrl?: string;
  /** og:description 자동 추출 결과 */
  description?: string;
}

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  /** fetch 가 실패한 경우 사유 (UX 에서 사용자에게 알림) */
  error?: string;
}

export interface DesktopSettings {
  /** 로그인 user_id 별 즐겨찾기 버킷 (계정 격리). */
  appUrlsByUser: Record<string, AppUrlEntry[]>;
}

/** S4 — 설치 가능한 온톨로지 어댑터(레지스트리가 테넌트 필터한 목록). */
export interface OntologyAdapter {
  adapter_type: string;
  plugin_id: string;
  name: string | null;
  version: string | null;
}

/** S4 — 로컬에 설치된 팩. */
export interface InstalledOntologyPack {
  adapter_type: string;
  bytes: number;
  installedAt: number;
}

export interface DesktopElectronAPI {
  app: {
    version: () => Promise<string>;
    /** 멀티 윈도우 — 동일 앱의 새 OS 창(독립 탭 상태, 세션 공유) 열기. */
    openNewWindow: () => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  net: {
    isOnline: () => boolean;
    onChange: (cb: (online: boolean) => void) => () => void;
  };
  link: {
    /** URL 의 메타 정보(title, description, icon) 를 메인 프로세스에서 fetch (CORS 우회) */
    fetchMetadata: (url: string) => Promise<LinkMetadata>;
  };
  settings: {
    getAll: () => Promise<DesktopSettings>;
    get: <K extends keyof DesktopSettings>(key: K) => Promise<DesktopSettings[K]>;
    /** appUrls — 모두 user_id 스코프(계정 격리). 비로그인은 호출 측에서 빈 문자열 전달. */
    appUrls: {
      list: (userId: string) => Promise<AppUrlEntry[]>;
      add: (userId: string, entry: AppUrlEntry) => Promise<AppUrlEntry[]>;
      remove: (userId: string, id: string) => Promise<AppUrlEntry[]>;
      update: (
        userId: string,
        id: string,
        patch: Partial<AppUrlEntry>,
      ) => Promise<AppUrlEntry[]>;
    };
  };
  /** 테마 — renderer 의 ThemeProvider 가 light/dark 전환 시 native chrome
   * (titleBarOverlay) 색도 함께 변경. macOS 는 hiddenInset 라 main 에서 no-op. */
  theme?: {
    setTitleBarOverlay: (opts: {
      color: string;
      symbolColor: string;
    }) => Promise<void>;
  };
  /** Chat 팝업 — 별도 떠 있는 창에서 질문 + 투명도 조절 + 호스트 화면 스냅샷. */
  chatPopup?: {
    open: () => Promise<void>;
    setOpacity: (value: number) => Promise<void>;
    close: () => Promise<void>;
    /** 팝업 renderer → main → 본 창 활성 webview 스냅샷. 미지원/실패 시 null. */
    captureSnapshot?: () => Promise<Record<string, unknown> | null>;
    /** 본 창 renderer 구독 — 팝업 닫힘 시 AI 패널 복원. unsubscribe 반환. */
    onClosed?: (cb: () => void) => () => void;
  };
  /** APP 탭 화면분석 브릿지 — 팝업 캡쳐 요청을 본 창 renderer 가 처리. */
  appWebview?: {
    onCaptureRequest: (cb: (payload: { reqId: string }) => void) => () => void;
    sendCaptureResult: (payload: { reqId: string; snapshot: unknown }) => void;
  };
  /** APP 탭 webview 확대/축소 — main 의 Ctrl+휠/키보드 줌 broadcast 구독. */
  webviewZoom?: {
    onChanged: (
      cb: (info: { webContentsId: number; zoomFactor: number }) => void,
    ) => () => void;
  };
  /** Section 02 — autoUpdater bridge (electron-updater + GitHub Releases). */
  autoUpdater?: {
    onUpdateDownloaded: (
      cb: (info: { version: string; releaseNotes: string | null }) => void,
    ) => () => void;
    quitAndInstall: () => Promise<void>;
  };
  /** S4 — 온톨로지 플러그인 다운로드/설치 (데스크탑 전용). */
  ontology?: {
    available: (userId: string) => Promise<OntologyAdapter[]>;
    install: (
      adapterType: string,
      userId: string,
    ) => Promise<InstalledOntologyPack>;
    listInstalled: (userId: string) => Promise<InstalledOntologyPack[]>;
  };
}

declare global {
  interface Window {
    electron?: DesktopElectronAPI;
  }
}
