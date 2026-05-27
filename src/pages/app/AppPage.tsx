/**
 * AppPage (/app) — APP STORE + 즐겨찾기 + 상세 + 멀티탭 webview.
 *
 * 화면 모드 (우선순위):
 *  1. tabs.length > 0 (webview)  — 하나 이상의 탭 열림 (Linear/Chrome 스타일)
 *  2. viewing (detail)            — 카드 클릭 후 상세 페이지
 *  3. empty (full STORE)          — 즐겨찾기 0 + 탭 없음
 *  4. home ("내 앱" + STORE)       — 즐겨찾기 있고 탭 없음
 *
 * 멀티 탭:
 *  - TabBar 가 상단에 (AddressBar 위)
 *  - 활성 탭만 visible, 비활성 탭은 display:none (state 유지)
 *  - + 버튼 = 모든 탭 닫고 home (새 앱 선택)
 *  - 같은 URL 의 두 번째 "지금 열기" = 기존 탭 활성화 (중복 탭 안 만듦)
 *
 * 카드 클릭 흐름:
 *  카탈로그/내 앱 카드 → viewing(detail) → "지금 열기" = 새 탭 (or 기존 활성)
 *
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R5, R6).
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Plus, MessageSquare, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AIChatPanelView } from "@/features/monitoring/components/ai-chat";
import { cn } from "@/lib/utils";
import {
  useAppUrls,
  useSelectedAppUrl,
  UrlCard,
  AppCatalog,
  AppDetailView,
  AddAppUrlDialog,
  capturePageSnapshot,
  useOpenTabs,
  TabBar,
  WebViewTabs,
  type DetailViewSource,
  type PageSnapshot,
} from "@desktop/features/app";
import type { AddAppUrlSubmit } from "@desktop/features/app/AddAppUrlDialog";
import type { CatalogApp } from "@desktop/features/app/useAppCatalog";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";
import { electron } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

export default function AppPage() {
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
  /** 상세 페이지 진입 상태. null 이면 home/empty 화면 */
  const [viewing, setViewing] = useState<DetailViewSource | null>(null);
  /** webview 모드의 우측 AI 챗팅 패널 표시 여부 (기본 열림) */
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  /** 활성 탭의 webview element ref — WebViewTabs 가 갱신 */
  const webviewRef = useRef<HTMLElement | null>(null);

  // 활성 탭의 entry — selected (기존 변수명) 와 동일 의미
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );
  const selected = useMemo(
    () => (activeTab ? urls.find((u) => u.id === activeTab.urlEntryId) ?? null : null),
    [activeTab, urls],
  );

  // AppSidebar (DesktopShell customRecents) 가 selectedId 로 활성 표시 — sync 유지
  useEffect(() => {
    setSelectedId(selected?.id ?? null);
  }, [selected, setSelectedId]);

  // 즐겨찾기 entry 삭제 시 관련 탭 자동 정리
  const urlsIdSet = useMemo(() => new Set(urls.map((u) => u.id)), [urls]);
  useEffect(() => {
    for (const t of tabs) {
      if (!urlsIdSet.has(t.urlEntryId)) {
        dropTabsByUrl(t.urlEntryId);
      }
    }
  }, [tabs, urlsIdSet, dropTabsByUrl]);

  const resolveEntry = useCallback(
    (urlEntryId: string) => urls.find((u) => u.id === urlEntryId) ?? null,
    [urls],
  );

  const isInWebview = tabs.length > 0;

  // 상단 셸 ← 버튼 처리 (멀티 탭 기준):
  //   webview 모드 (tabs > 0)
  //     - 탭 2개 이상 + 활성 탭 있으면 → 활성 탭만 닫기 (다른 탭으로 자동 전환)
  //     - 탭 1개 → 모든 탭 닫고 home
  //   detail(viewing) → home (viewing 해제)
  //   home → backHandler 미등록 → 일반 router navigate(-1)
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
  }, [isInWebview, tabs.length, activeTabId, viewing, closeTab, closeAllTabs, setBackHandler]);

  // webview 모드 진입/나갈 때 좌측 셸 사이드바 자동 접기/펼치기.
  // 사용자가 그 사이 ≡ 버튼으로 토글한 경우는 존중 — 진입/나옴 transition 에서만 1회 처리.
  const wasInWebviewRef = useRef(false);
  useEffect(() => {
    if (isInWebview && !wasInWebviewRef.current) {
      setSidebarCollapsed(true);
    } else if (!isInWebview && wasInWebviewRef.current) {
      setSidebarCollapsed(false);
    }
    wasInWebviewRef.current = isInWebview;
  }, [isInWebview, setSidebarCollapsed]);

  // webview 의 rich snapshot (50KB JSON) 추출 — AI 챗 컨텍스트로 자동 첨부.
  // Tier 0 (Section 01): 기존 5000자 단일 string 한계 해결 — title + meta +
  // visibleText 50000자 + data-* dump + 보이는 table 직렬화. byte size 80KB cap.
  const captureSnapshot = useCallback(async (): Promise<PageSnapshot | null> => {
    return capturePageSnapshot(webviewRef.current);
  }, []);

  // chat.sendMessage 를 wrap — webview 모드일 때 자동으로 page snapshot 첨부.
  // marker `\n\n[참고 컨텍스트` 사용 → useAIChat 의 stripAugmentation 가 display 에서
  // 잘라내므로 사용자 버블에는 원본만 표시됨. AI 에게는 augment 된 message 가 전달.
  const enhancedChat = useMemo(() => {
    if (!selected) return chat;
    return {
      ...chat,
      sendMessage: async (content: string, context?: Parameters<typeof chat.sendMessage>[1]) => {
        const snapshot = await captureSnapshot();
        if (!snapshot) {
          return chat.sendMessage(content, context);
        }
        // JSON 으로 직렬화 — 백엔드 NLU 가 구조화된 정보 활용 가능
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

  // webview 컨트롤
  const reload = useCallback(() => {
    const wv = webviewRef.current as unknown as { reload?: () => void } | null;
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

  // URL 직접 추가 다이얼로그 제출
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
            ? {
                kind: "installed",
                entry: { ...v.entry, ...data },
              }
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

  // 카드 클릭 핸들러들
  const normalizedInstalledUrls = urls.map((u) => u.url);
  const installedByUrl = useCallback(
    (url: string) => {
      const norm = (u: string) => u.toLowerCase().replace(/\/$/, "");
      return urls.find((u) => norm(u.url) === norm(url));
    },
    [urls],
  );

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

  // 상세 페이지 액션 핸들러 — "지금 열기" = 새 탭 (같은 URL 있으면 활성화)
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
    // 상세 페이지를 installed 모드로 전환 (이제 즐겨찾기에 있으므로)
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

  // ──────────── 1. webview (멀티 탭) ────────────
  if (isInWebview) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 통합 탭 헤더 (Chrome 스타일):
            ← → ⟳ | [Tab][Tab][Tab] [+] | ⋮ + AI toggle
            border 없음, bg-muted/30 으로 webview 와 자연스럽게 구분.
            AddressBar 별도 행 없음 — URL 편집은 ⋮ → "URL 편집" 다이얼로그 */}
        <div className="flex items-end bg-muted/30">
          <div className="flex-1 min-w-0">
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              resolveEntry={resolveEntry}
              onActivate={setActiveTab}
              onClose={closeTab}
              onNewTab={closeAllTabs}
              onBack={goBack}
              onForward={goForward}
              onReload={reload}
              activeEntry={selected}
              onEditActive={() => {
                if (!selected) return;
                setEditTarget(selected);
                setAddOpen(true);
              }}
              onRemoveActive={() => {
                if (!selected) return;
                const id = selected.id;
                void remove(id);
                dropTabsByUrl(id);
              }}
              onOpenExternalActive={() => {
                if (!selected) return;
                void electron.openExternal(selected.url);
              }}
            />
          </div>
          {!aiPanelOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiPanelOpen(true)}
              className="gap-1.5 flex-shrink-0 mx-1 mb-1 h-7 text-muted-foreground hover:text-foreground"
              title="AI 챗 열기"
            >
              <MessageSquare className="w-4 h-4" />
              AI
            </Button>
          )}
        </div>

        {/* 본문: 모든 탭 webview 동시 mount (활성만 visible) + 우측 AI 사이드 패널 */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0">
            <WebViewTabs
              tabs={tabs}
              activeTabId={activeTabId}
              resolveEntry={resolveEntry}
              activeWebviewRef={webviewRef}
            />
          </div>
          {aiPanelOpen && (
            <aside
              className={cn(
                "flex-shrink-0 w-[380px] border-l border-border/60 bg-card/30 flex flex-col min-h-0",
                "ml-2",
              )}
            >
              {/* 패널 헤더 — 페이지 인식 표시 + 닫기 */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span>AI 어시스턴트</span>
                  <span
                    className="text-[10px] text-primary px-1.5 py-px rounded bg-primary/10 border border-primary/20"
                    title="질문 시 현재 보고 있는 페이지의 본문 텍스트를 자동으로 컨텍스트로 첨부합니다."
                  >
                    페이지 인식 중
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAiPanelOpen(false)}
                  title="패널 닫기"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              {/* 챗 본문 — enhancedChat (sendMessage 가 page snapshot 자동 첨부) */}
              <div className="flex-1 min-h-0">
                <AIChatPanelView {...enhancedChat} showHistoryButton={false} headerless />
              </div>
            </aside>
          )}
        </div>

        <AddAppUrlDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          editTarget={editTarget}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  // ──────────── 2. viewing (detail page) ────────────
  if (viewing) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppDetailView
          source={viewing}
          onBack={() => setViewing(null)}
          onOpen={handleDetailOpen}
          onAddToFavorites={handleDetailAddToFavorites}
          onEdit={handleDetailEdit}
          onRemove={handleDetailRemove}
        />
        <AddAppUrlDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          editTarget={editTarget}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  // ──────────── 3. 빈 상태 — 풀스크린 STORE ────────────
  if (!loading && urls.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="px-8 py-8 max-w-5xl mx-auto">
            <AppCatalog
              onPick={handleCatalogPick}
              onCustomAdd={openCustomAdd}
              installedUrls={[]}
            />
          </div>
        </ScrollArea>
        <AddAppUrlDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          editTarget={editTarget}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  // ──────────── 4. "내 앱" + STORE ────────────
  // "URL 직접 추가" 버튼은 "내 앱" 섹션에만. AppCatalog 의 onCustomAdd 는 안 넘김.
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="px-8 py-8 max-w-5xl mx-auto">
          {/* 내 앱 섹션 */}
          <section className="mb-10">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">내 앱</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {urls.length}개의 즐겨찾기
                </p>
              </div>
              <Button onClick={openCustomAdd} size="sm" variant="outline" className="gap-2 h-9 px-3">
                <Plus className="w-4 h-4" />
                URL 직접 추가
              </Button>
            </header>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {urls.map((u) => (
                <UrlCard
                  key={u.id}
                  entry={u}
                  onClick={() => handleInstalledPick(u)}
                  onEdit={() => {
                    setEditTarget(u);
                    setAddOpen(true);
                  }}
                  onRemove={() => void remove(u.id)}
                />
              ))}
            </div>
          </section>

          {/* 구분선 */}
          <div className="border-t border-border/40 my-8" />

          {/* STORE 카탈로그 — onCustomAdd 안 넘김 (중복 버튼 회피) */}
          <AppCatalog
            onPick={handleCatalogPick}
            installedUrls={normalizedInstalledUrls}
          />
        </div>
      </ScrollArea>
      <AddAppUrlDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editTarget={editTarget}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
