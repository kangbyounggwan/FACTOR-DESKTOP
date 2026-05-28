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

const DEFAULT_SNAPSHOT_ALLOWED_HOSTS = [
  "factor.io.kr",
  "api.factor.io.kr",
  "pnpjbadjfxczezmkqyhh.supabase.co",
];

function getSnapshotAllowedHosts(): string[] {
  const configured = import.meta.env.VITE_DESKTOP_SNAPSHOT_ALLOWED_HOSTS;
  if (typeof configured !== "string" || !configured.trim()) {
    return DEFAULT_SNAPSHOT_ALLOWED_HOSTS;
  }
  return configured
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isSnapshotAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return getSnapshotAllowedHosts().some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
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
  resolveEntry: (urlEntryId: string) => AppUrlEntry | null;

  // viewing (detail)
  viewing: DetailViewSource | null;
  setViewing: (v: DetailViewSource | null) => void;

  // AI panel + webview
  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  webviewRef: MutableRefObject<HTMLElement | null>;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;

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

  // 2) URL entry 삭제 시 연관 탭 자동 정리
  const urlsIdSet = useMemo(() => new Set(urls.map((u) => u.id)), [urls]);
  useEffect(() => {
    for (const t of tabs) {
      if (!urlsIdSet.has(t.urlEntryId)) {
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
    (urlEntryId: string) => urls.find((u) => u.id === urlEntryId) ?? null,
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
    return {
      ...chat,
      sendMessage: async (
        content: string,
        context?: Parameters<typeof chat.sendMessage>[1],
      ) => {
        const snapshot = await captureSnapshot();
        if (!snapshot) {
          return chat.sendMessage(content, context);
        }
        if (!isSnapshotAllowed(snapshot.url)) {
          return chat.sendMessage(content, context);
        }
        const snapshotJson = JSON.stringify({
          url: snapshot.url,
          title: snapshot.title,
          meta: snapshot.meta,
          visibleText: snapshot.visibleText,
          dataElements: snapshot.dataElements,
          tables: snapshot.tables,
        });
        const augmented =
          content +
          `\n\n[참고 컨텍스트 — 사용자가 데스크탑 앱에서 열어둔 외부 웹페이지의 rich snapshot (JSON). ` +
          `사용자 질문에 답할 때 이 페이지 내용을 우선 참고하세요. ` +
          `dataElements 의 data-* attrs (라인/장비/알람 식별자) 와 tables (헤더+샘플 10행) 을 활용.]\n` +
          `${snapshotJson}`;
        return chat.sendMessage(augmented, context);
      },
    };
  }, [chat, selected, captureSnapshot]);

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
        // 직접 추가 시 상세 페이지로 이동
        setViewing({ kind: "installed", entry });
      }
    },
    [editTarget, update, add],
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
    viewing,
    setViewing,
    aiPanelOpen,
    setAiPanelOpen,
    webviewRef,
    reload,
    goBack,
    goForward,
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
