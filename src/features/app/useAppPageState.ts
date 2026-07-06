/**
 * Section 08 (2026-05-27) — useAppPageState.
 *
 * AppPage.tsx 의 상태 / 사이드 이펙트 / 핸들러를 한 곳에 캡슐화.
 *
 * 책임:
 *  - urls / loading / add / remove / update (useAppUrls)
 *  - tabs / activeTab / openTab / closeTab / setActiveTab / closeAllTabs /
 *    dropTabsByUrl (useOpenTabs)
 *  - dialog state (addOpen, editTarget)
 *  - viewing state (4-mode 분기 입력)
 *  - aiPanelOpen
 *  - webviewRef + webview 컨트롤 (reload / goBack / goForward)
 *  - sidebar / back-handler 자동 등록 (useDesktopShell)
 *  - selected entry sync (useSelectedAppUrl)
 *  - URL entry 삭제 시 연관 탭 자동 정리
 *  - URL 직접 추가/편집 form submit
 *  - 카드 클릭 / 상세 액션 핸들러 (handleCatalogPick, handleDetailOpen, etc.)
 *  - chat snapshot augmentation (enhancedChat — webview 안 페이지의 rich
 *    snapshot 을 AI 메시지에 자동 첨부)
 *
 * AppPage.tsx 는 본 훅을 1회 호출하고 JSX 만 분배.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  useAppUrls,
  useSelectedAppUrl,
  useOpenTabs,
  capturePageSnapshot,
  type DetailViewSource,
  type PageSnapshot,
  type OpenTab,
} from "@desktop/features/app";
import type { CatalogApp } from "@desktop/features/app/useAppCatalog";
import type { AddAppUrlSubmit } from "@desktop/features/app/AddAppUrlDialog";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";
import { electron } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

export type AppPageMode = "tabs" | "detail" | "empty" | "home";

// ── webview 확대/축소 ──────────────────────────────────────────────────
// Chrome 과 같은 프리셋 단계. Ctrl+휠/Ctrl+± (main process 처리) 는 ±10% 씩.
const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3,
];
const ZOOM_MIN = ZOOM_STEPS[0];
const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Electron <webview> 의 zoom 메서드 (attach 전 호출은 throw — try/catch 필수) */
interface WebviewZoomEl {
  getZoomFactor?: () => number;
  setZoomFactor?: (factor: number) => void;
  getWebContentsId?: () => number;
}

// 기본 정책: "도메인 모두 허용". 데스크탑은 내부 MES 클라이언트라 사용자가 지금
// 보고 있는 화면(서한 MES / 경영정보 / 그룹포탈 등 도메인 제각각)을 읽어 답하는 게
// 설계 의도다. 과거엔 seohan.com 만 허용해 .co.kr / 그룹포탈 등 다른 서한 도메인
// 스냅샷이 isSnapshotAllowed=false 로 조용히 버려져 "화면 인식 실패"가 났다.
//
// 특정 호스트로 좁히려면 VITE_DESKTOP_SNAPSHOT_ALLOWED_HOSTS (콤마 구분) 를 설정 —
// 설정되면 그 목록으로만 제한, 미설정이면 모든 http(s) 페이지 허용.
function getSnapshotAllowedHosts(): string[] {
  const configured = import.meta.env.VITE_DESKTOP_SNAPSHOT_ALLOWED_HOSTS;
  if (typeof configured !== "string" || !configured.trim()) {
    return []; // 미설정 → 전체 허용 (아래 isSnapshotAllowed 에서 length===0 처리)
  }
  return configured
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isSnapshotAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false; // file:/about: 등 비-웹 스킴은 제외
    }
    const hosts = getSnapshotAllowedHosts();
    if (hosts.length === 0) return true; // allowlist 미설정 → 모든 http(s) 허용
    const host = parsed.hostname.toLowerCase();
    return hosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

// AI 화면분석 패널 대상 판정 — "URL 을 통한 접근"(외부 웹 화면)일 때만 활성.
// FACTOR 자체 도구 페이지(factor.io.kr 의 리포트 등)와 런처는 분석 대상이 아니므로
// 우측 AI 패널을 숨긴다(리포트는 자체 기능만 사용). factor.io.kr 외 host 를 더 제외하려면
// VITE_DESKTOP_AI_EXCLUDED_HOSTS (콤마 구분) 설정.
const AI_OWN_HOSTS_DEFAULT = [
  "factor.io.kr",
  "localhost",
  "127.0.0.1",
];

function getAiExcludedHosts(): string[] {
  const configured = import.meta.env.VITE_DESKTOP_AI_EXCLUDED_HOSTS;
  const extra =
    typeof configured === "string" && configured.trim()
      ? configured
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean)
      : [];
  return [...AI_OWN_HOSTS_DEFAULT, ...extra];
}

/** 활성 탭이 화면분석 AI 대상인가 — 외부 http(s) 화면만(FACTOR 자체 도구·비웹 스킴 제외). */
function isAiScreenEligible(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return !getAiExcludedHosts().some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

export interface UseAppPageStateReturn {
  // urls
  urls: AppUrlEntry[];
  loading: boolean;
  normalizedInstalledUrls: string[];

  // mode (derive — 우선순위 tabs > detail > empty > home)
  mode: AppPageMode;
  isInWebview: boolean;

  // tabs
  tabs: OpenTab[];
  activeTabId: string | null;
  activeTab: OpenTab | null;
  selected: AppUrlEntry | null;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  dropTabsByUrl: (urlEntryId: string) => void;
  resolveEntry: (urlEntryId: string | null) => AppUrlEntry | null;

  // 런처 "새 탭" (Chrome 새 탭 페이지 — 앱 선택 화면)
  isActiveTabLauncher: boolean;
  openLauncherTab: () => void;
  handleLauncherPickInstalled: (entry: AppUrlEntry) => void;
  handleLauncherPickCatalog: (app: CatalogApp) => Promise<void>;

  // viewing (detail)
  viewing: DetailViewSource | null;
  setViewing: (v: DetailViewSource | null) => void;

  // AI panel + webview
  /** 활성 탭이 화면분석 AI 대상인가(외부 URL 화면만). false면 우측 AI 패널 자체를 숨긴다. */
  aiEligible: boolean;
  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  webviewRef: MutableRefObject<HTMLElement | null>;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;

  // webview 확대/축소 (활성 탭 대상 — Chromium per-origin 이라 같은 사이트 탭에 공유)
  zoomPercent: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;

  // dialogs
  addOpen: boolean;
  setAddOpen: (o: boolean) => void;
  editTarget: AppUrlEntry | null;
  setEditTarget: (t: AppUrlEntry | null) => void;

  // chat (enhancedChat — sendMessage 가 page snapshot 자동 첨부)
  enhancedChat: ReturnType<typeof useDesktopShell>["chat"];

  // handlers
  handleSubmit: (data: AddAppUrlSubmit) => Promise<void>;
  openCustomAdd: () => void;
  handleCatalogPick: (app: CatalogApp) => void;
  handleInstalledPick: (entry: AppUrlEntry) => void;
  handleDetailOpen: () => Promise<void>;
  handleDetailAddToFavorites: () => Promise<void>;
  handleDetailEdit: () => void;
  handleDetailRemove: () => Promise<void>;
  // UrlCard onRemove (home 모드) — entry 삭제 + 연관 탭 정리
  handleRemoveEntry: (entryId: string) => void;
  handleEditEntry: (entry: AppUrlEntry) => void;
  // webview tab 헤더 액션 (편집 / 제거 / 외부 열기 — 현재 활성 탭 대상)
  handleEditActive: () => void;
  handleRemoveActive: () => void;
  handleOpenExternalActive: () => void;
}

export function useAppPageState(): UseAppPageStateReturn {
  const { urls, loading, add, remove, update } = useAppUrls();
  const { setSelectedId } = useSelectedAppUrl();
  const { setBackHandler, chat, setSidebarCollapsed } = useDesktopShell();

  // 멀티 탭 store
  const tabs = useOpenTabs((s) => s.tabs);
  const activeTabId = useOpenTabs((s) => s.activeTabId);
  const openTab = useOpenTabs((s) => s.openTab);
  const openLauncherTab = useOpenTabs((s) => s.openLauncherTab);
  const convertTab = useOpenTabs((s) => s.convertTab);
  const closeTab = useOpenTabs((s) => s.closeTab);
  const setActiveTab = useOpenTabs((s) => s.setActive);
  const closeAllTabs = useOpenTabs((s) => s.closeAll);
  const dropTabsByUrl = useOpenTabs((s) => s.dropByUrlEntryId);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUrlEntry | null>(null);
  const [viewing, setViewing] = useState<DetailViewSource | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const webviewRef = useRef<HTMLElement | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );
  const selected = useMemo(
    () =>
      activeTab
        ? (urls.find((u) => u.id === activeTab.urlEntryId) ?? null)
        : null,
    [activeTab, urls],
  );

  const isInWebview = tabs.length > 0;
  const isActiveTabLauncher = !!activeTab && activeTab.urlEntryId === null;
  // 화면분석 AI 대상 = 외부 URL 화면 탭만 (런처·FACTOR 자체 도구 페이지 제외).
  const aiEligible = !isActiveTabLauncher && isAiScreenEligible(selected?.url);

  const mode: AppPageMode = useMemo(() => {
    if (isInWebview) return "tabs";
    if (viewing) return "detail";
    if (!loading && urls.length === 0) return "empty";
    return "home";
  }, [isInWebview, viewing, loading, urls.length]);

  // ── effects ──

  // 1) AppSidebar sync — selected ↔ shell sidebar 활성 표시
  useEffect(() => {
    setSelectedId(selected?.id ?? null);
  }, [selected, setSelectedId]);

  // 2) URL entry 삭제 시 연관 탭 자동 정리 (런처 "새 탭"(urlEntryId=null)은 제외)
  const urlsIdSet = useMemo(() => new Set(urls.map((u) => u.id)), [urls]);
  useEffect(() => {
    for (const t of tabs) {
      if (t.urlEntryId !== null && !urlsIdSet.has(t.urlEntryId)) {
        dropTabsByUrl(t.urlEntryId);
      }
    }
  }, [tabs, urlsIdSet, dropTabsByUrl]);

  // 3) back handler — 모드별 다른 동작
  useEffect(() => {
    setBackHandler(() => {
      if (isInWebview) {
        if (tabs.length > 1 && activeTabId) {
          closeTab(activeTabId);
        } else {
          closeAllTabs();
        }
        return true;
      }
      if (viewing) {
        setViewing(null);
        return true;
      }
      return false;
    });
    return () => setBackHandler(null);
  }, [
    isInWebview,
    tabs.length,
    activeTabId,
    viewing,
    closeTab,
    closeAllTabs,
    setBackHandler,
  ]);

  // 4) webview 진입/이탈 transition 에서만 sidebar 자동 토글
  //    (사용자가 그 사이 수동 토글한 건 존중)
  const wasInWebviewRef = useRef(false);
  useEffect(() => {
    if (isInWebview && !wasInWebviewRef.current) {
      setSidebarCollapsed(true);
    } else if (!isInWebview && wasInWebviewRef.current) {
      setSidebarCollapsed(false);
    }
    wasInWebviewRef.current = isInWebview;
  }, [isInWebview, setSidebarCollapsed]);

  // ── derived ──
  const normalizedInstalledUrls = useMemo(
    () => urls.map((u) => u.url),
    [urls],
  );

  const resolveEntry = useCallback(
    (urlEntryId: string | null) =>
      urlEntryId === null
        ? null
        : (urls.find((u) => u.id === urlEntryId) ?? null),
    [urls],
  );

  const installedByUrl = useCallback(
    (url: string) => {
      const norm = (u: string) => u.toLowerCase().replace(/\/$/, "");
      return urls.find((u) => norm(u.url) === norm(url));
    },
    [urls],
  );

  // ── webview 컨트롤 ──
  const reload = useCallback(() => {
    const wv = webviewRef.current as unknown as {
      reload?: () => void;
    } | null;
    wv?.reload?.();
  }, []);
  const goBack = useCallback(() => {
    const wv = webviewRef.current as unknown as {
      goBack?: () => void;
      canGoBack?: () => boolean;
    } | null;
    if (wv?.canGoBack?.()) wv.goBack?.();
  }, []);
  const goForward = useCallback(() => {
    const wv = webviewRef.current as unknown as {
      goForward?: () => void;
      canGoForward?: () => boolean;
    } | null;
    if (wv?.canGoForward?.()) wv.goForward?.();
  }, []);

  // ── webview 확대/축소 ──
  const [zoomPercent, setZoomPercent] = useState(100);

  const readZoom = useCallback(() => {
    const wv = webviewRef.current as unknown as WebviewZoomEl | null;
    try {
      const f = wv?.getZoomFactor?.() ?? 1;
      setZoomPercent(Math.round(f * 100));
    } catch {
      // webview 미 attach — 기본 100%
      setZoomPercent(100);
    }
  }, []);

  const applyZoom = useCallback((factor: number) => {
    const wv = webviewRef.current as unknown as WebviewZoomEl | null;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, factor));
    try {
      wv?.setZoomFactor?.(clamped);
      setZoomPercent(Math.round(clamped * 100));
    } catch {
      /* webview 미 attach — 무시 */
    }
  }, []);

  const currentZoomFactor = useCallback((): number => {
    const wv = webviewRef.current as unknown as WebviewZoomEl | null;
    try {
      return wv?.getZoomFactor?.() ?? 1;
    } catch {
      return 1;
    }
  }, []);

  const zoomIn = useCallback(() => {
    const cur = currentZoomFactor();
    applyZoom(ZOOM_STEPS.find((s) => s > cur + 0.001) ?? ZOOM_MAX);
  }, [currentZoomFactor, applyZoom]);

  const zoomOut = useCallback(() => {
    const cur = currentZoomFactor();
    const lower = ZOOM_STEPS.filter((s) => s < cur - 0.001);
    applyZoom(lower.length > 0 ? lower[lower.length - 1] : ZOOM_MIN);
  }, [currentZoomFactor, applyZoom]);

  const zoomReset = useCallback(() => applyZoom(1), [applyZoom]);

  // 활성 탭 전환/네비게이션 시 줌 % 표시 동기화 (per-origin 줌이 자동 적용되므로 읽기만)
  useEffect(() => {
    readZoom();
    const el = webviewRef.current;
    if (!el) return;
    const onReady = () => readZoom();
    el.addEventListener("dom-ready", onReady);
    el.addEventListener("did-navigate", onReady);
    return () => {
      el.removeEventListener("dom-ready", onReady);
      el.removeEventListener("did-navigate", onReady);
    };
  }, [activeTabId, readZoom]);

  // main process 의 Ctrl+휠/Ctrl+± 줌 broadcast → 활성 webview 면 % 표시 갱신
  useEffect(() => {
    const off = window.electron?.webviewZoom?.onChanged((info) => {
      const wv = webviewRef.current as unknown as WebviewZoomEl | null;
      try {
        if (wv?.getWebContentsId?.() === info.webContentsId) {
          setZoomPercent(Math.round(info.zoomFactor * 100));
        }
      } catch {
        /* webview 미 attach — 무시 */
      }
    });
    return off;
  }, []);

  // ── chat snapshot augmentation ──
  const captureSnapshot = useCallback(
    async (): Promise<PageSnapshot | null> =>
      // capturePageSnapshot 의 WebViewLike 시그니처 — webviewRef 는
      // HTMLElement 로 선언되지만 실제 인스턴스는 Electron <webview> 이라
      // WebViewLike 메서드 (executeJavaScript 등) 보유. cast 안전.
      capturePageSnapshot(
        webviewRef.current as unknown as Parameters<typeof capturePageSnapshot>[0],
      ),
    [],
  );

  // webview 모드일 때만 sendMessage wrap — 사용자 버블에는 원본만 표시
  // (useAIChat 의 stripAugmentation 가 "\n\n[참고 컨텍스트" marker 로 잘라냄).
  const enhancedChat = useMemo(() => {
    if (!selected) return chat;
    const wrappedSendMessage = async (
      content: string,
      context?: Parameters<typeof chat.sendMessage>[1],
    ) => {
      const snapshot = await captureSnapshot();
      if (!snapshot || !isSnapshotAllowed(snapshot.url)) {
        return chat.sendMessage(content, context);
      }
      // 구조화 page_snapshot 으로 전송 → 백엔드 PipelineV3 가 화면분석 모드로
      // 분기 (NLU/clarification/plant-scope 우회, 현재 화면 내용으로 답변).
      // 이전 "메시지 텍스트에 JSON append" 방식은 백엔드 page_snapshot 분기를
      // 못 타 화면연동이 안 됐었음 — 구조화 필드 전송으로 교체.
      return chat.sendMessage(content, context, {
        pageSnapshot: snapshot as unknown as Record<string, unknown>,
      });
    };
    return {
      ...chat,
      sendMessage: wrappedSendMessage,
      // ⚠ 입력창 제출(handleSubmit)도 wrap 필수 — base handleSubmit 은 base
      // sendMessage 를 closure 로 호출해 page_snapshot 이 빠진다. 타이핑한
      // 질문도 화면분석 경로를 타도록 같은 wrappedSendMessage 로 보냄.
      handleSubmit: (e: Parameters<typeof chat.handleSubmit>[0]) => {
        e.preventDefault();
        void wrappedSendMessage(chat.input);
      },
    };
  }, [chat, selected, captureSnapshot]);

  // 팝업(독립 창)의 화면분석 요청 처리 — 팝업은 webview 접근이 불가라 main 이 본 창
  // renderer 에 캡쳐를 위임한다. 여기서 자기 webviewRef 로 스냅샷을 떠서 되돌려준다
  // (스냅샷 구현/allowlist 단일 소스 유지 — 팝업은 결과만 백엔드로 전송).
  useEffect(() => {
    const off = electron.appWebview.onCaptureRequest(async ({ reqId }) => {
      let snapshot: Record<string, unknown> | null = null;
      try {
        const snap = await captureSnapshot();
        if (snap && isSnapshotAllowed(snap.url)) {
          snapshot = snap as unknown as Record<string, unknown>;
        }
      } catch {
        snapshot = null;
      }
      electron.appWebview.sendCaptureResult({ reqId, snapshot });
    });
    return off;
  }, [captureSnapshot]);

  // 팝업이 닫히면 오른쪽 AI 패널 자동 복원 (팝업 열 때 패널을 닫으므로 — 팝업↔패널 스왑).
  useEffect(() => {
    const off = electron.chatPopup.onClosed(() => setAiPanelOpen(true));
    return off;
  }, []);

  // ── handlers ──

  // URL 직접 추가 / 편집 form submit
  const handleSubmit = useCallback(
    async (data: AddAppUrlSubmit) => {
      if (editTarget) {
        await update(editTarget.id, {
          name: data.name,
          url: data.url,
          iconUrl: data.iconUrl,
          description: data.description,
        });
        // 편집 후 상세 페이지 갱신
        setViewing((v) =>
          v && v.kind === "installed" && v.entry.id === editTarget.id
            ? { kind: "installed", entry: { ...v.entry, ...data } }
            : v,
        );
      } else {
        const entry = await add(data.name, data.url, {
          iconUrl: data.iconUrl,
          description: data.description,
        });
        if (isActiveTabLauncher && activeTabId) {
          // 런처 "새 탭"에서 직접 추가 → 그 탭에서 바로 열기
          convertTab(activeTabId, entry.id);
        } else {
          // 직접 추가 시 상세 페이지로 이동
          setViewing({ kind: "installed", entry });
        }
      }
    },
    [editTarget, update, add, isActiveTabLauncher, activeTabId, convertTab],
  );

  const openCustomAdd = useCallback(() => {
    setEditTarget(null);
    setAddOpen(true);
  }, []);

  const handleCatalogPick = useCallback(
    (app: CatalogApp) => {
      const existing = installedByUrl(app.url);
      setViewing({ kind: "catalog", app, alreadyInstalled: !!existing });
    },
    [installedByUrl],
  );

  const handleInstalledPick = useCallback((entry: AppUrlEntry) => {
    setViewing({ kind: "installed", entry });
  }, []);

  // ── 런처 "새 탭"에서 앱 선택 — Chrome 새 탭처럼 그 자리에서 바로 열기 ──
  const handleLauncherPickInstalled = useCallback(
    (entry: AppUrlEntry) => {
      if (activeTabId) convertTab(activeTabId, entry.id);
    },
    [activeTabId, convertTab],
  );

  const handleLauncherPickCatalog = useCallback(
    async (app: CatalogApp) => {
      // 미설치 카탈로그 앱은 즐겨찾기 자동 추가 후 열기 (상세의 "지금 열기"와 동일)
      const existing = installedByUrl(app.url);
      const entry =
        existing ??
        (await add(app.name, app.url, {
          iconUrl:
            app.icon_url ??
            `https://www.google.com/s2/favicons?domain=${new URL(app.url).hostname}&sz=128`,
          description: app.description ?? undefined,
        }));
      if (activeTabId) convertTab(activeTabId, entry.id);
    },
    [activeTabId, convertTab, installedByUrl, add],
  );

  // 상세 페이지 "지금 열기" = 새 탭 (같은 URL 있으면 활성화)
  const handleDetailOpen = useCallback(async () => {
    if (!viewing) return;
    let targetEntryId: string;
    if (viewing.kind === "catalog") {
      const existing = installedByUrl(viewing.app.url);
      if (existing) {
        targetEntryId = existing.id;
      } else {
        const entry = await add(viewing.app.name, viewing.app.url, {
          iconUrl:
            viewing.app.icon_url ??
            `https://www.google.com/s2/favicons?domain=${new URL(viewing.app.url).hostname}&sz=128`,
          description: viewing.app.description ?? undefined,
        });
        targetEntryId = entry.id;
      }
    } else {
      targetEntryId = viewing.entry.id;
    }
    openTab(targetEntryId);
    setViewing(null);
  }, [viewing, installedByUrl, add, openTab]);

  const handleDetailAddToFavorites = useCallback(async () => {
    if (!viewing || viewing.kind !== "catalog") return;
    const entry = await add(viewing.app.name, viewing.app.url, {
      iconUrl:
        viewing.app.icon_url ??
        `https://www.google.com/s2/favicons?domain=${new URL(viewing.app.url).hostname}&sz=128`,
      description: viewing.app.description ?? undefined,
    });
    // installed 모드로 전환 (이제 즐겨찾기에 있음)
    setViewing({ kind: "installed", entry });
  }, [viewing, add]);

  const handleDetailEdit = useCallback(() => {
    if (!viewing || viewing.kind !== "installed") return;
    setEditTarget(viewing.entry);
    setAddOpen(true);
  }, [viewing]);

  const handleDetailRemove = useCallback(async () => {
    if (!viewing || viewing.kind !== "installed") return;
    await remove(viewing.entry.id);
    setViewing(null);
  }, [viewing, remove]);

  // home 모드 UrlCard 액션 — entry 삭제 + 연관 탭 정리
  const handleRemoveEntry = useCallback(
    (entryId: string) => {
      void remove(entryId);
      dropTabsByUrl(entryId);
    },
    [remove, dropTabsByUrl],
  );

  const handleEditEntry = useCallback((entry: AppUrlEntry) => {
    setEditTarget(entry);
    setAddOpen(true);
  }, []);

  // webview 탭 헤더 액션 (현재 활성 탭 대상)
  const handleEditActive = useCallback(() => {
    if (!selected) return;
    setEditTarget(selected);
    setAddOpen(true);
  }, [selected]);

  const handleRemoveActive = useCallback(() => {
    if (!selected) return;
    const id = selected.id;
    void remove(id);
    dropTabsByUrl(id);
  }, [selected, remove, dropTabsByUrl]);

  const handleOpenExternalActive = useCallback(() => {
    if (!selected) return;
    void electron.openExternal(selected.url);
  }, [selected]);

  return {
    urls,
    loading,
    normalizedInstalledUrls,
    mode,
    isInWebview,
    tabs,
    activeTabId,
    activeTab,
    selected,
    setActiveTab,
    closeTab,
    closeAllTabs,
    dropTabsByUrl,
    resolveEntry,
    isActiveTabLauncher,
    aiEligible,
    openLauncherTab,
    handleLauncherPickInstalled,
    handleLauncherPickCatalog,
    viewing,
    setViewing,
    aiPanelOpen,
    setAiPanelOpen,
    webviewRef,
    reload,
    goBack,
    goForward,
    zoomPercent,
    zoomIn,
    zoomOut,
    zoomReset,
    addOpen,
    setAddOpen,
    editTarget,
    setEditTarget,
    enhancedChat,
    handleSubmit,
    openCustomAdd,
    handleCatalogPick,
    handleInstalledPick,
    handleDetailOpen,
    handleDetailAddToFavorites,
    handleDetailEdit,
    handleDetailRemove,
    handleRemoveEntry,
    handleEditEntry,
    handleEditActive,
    handleRemoveActive,
    handleOpenExternalActive,
  };
}
