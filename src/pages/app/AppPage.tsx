/**
 * AppPage (/app) — APP STORE + 즐겨찾기 + 상세 + 멀티탭 webview.
 *
 * 화면 모드 (우선순위 — `useAppPageState.mode` 가 derive):
 *  1. tabs   — webview 멀티 탭 (TabBar + WebViewTabs + AI 패널)
 *  2. detail — 카드 클릭 후 상세 페이지 (AppDetailView)
 *  3. empty  — 즐겨찾기 0 + 탭 없음 (풀스크린 STORE)
 *  4. home   — 즐겨찾기 있고 탭 없음 ("내 앱" + STORE)
 *
 * Section 08 (2026-05-27): 상태 / 사이드 이펙트 / 핸들러 모두 `useAppPageState`
 * 훅으로 추출. 본 파일은 JSX 조립만 책임 (R6 — 페이지 = 조립품).
 *
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R5, R6).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, MessageSquare, X, PictureInPicture2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAppPageState,
  UrlCard,
  AppCatalog,
  AppDetailView,
  AddAppUrlDialog,
  TabBar,
  WebViewTabs,
  LauncherTabView,
  DesktopAppChatPanel,
  AppChatConversationBar,
  OntologyPackCatalog,
  useAppRunnable,
} from "@desktop/features/app";
import { electron } from "@desktop/lib/electron";

// AI 패널 폭 — 기본을 키우고(480) 드래그로 320~760 사이 조절, localStorage 영속.
const AI_PANEL_MIN = 320;
const AI_PANEL_MAX = 760;
const AI_PANEL_DEFAULT = 480;
const AI_PANEL_LS_KEY = "factor-desktop:aiPanelWidth";

function useAiPanelWidth() {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(AI_PANEL_LS_KEY));
      if (Number.isFinite(saved) && saved >= AI_PANEL_MIN && saved <= AI_PANEL_MAX) {
        return saved;
      }
    } catch {
      /* ignore */
    }
    return AI_PANEL_DEFAULT;
  });
  const setClamped = useCallback((w: number) => {
    const c = Math.max(AI_PANEL_MIN, Math.min(AI_PANEL_MAX, Math.round(w)));
    setWidth(c);
    try {
      localStorage.setItem(AI_PANEL_LS_KEY, String(c));
    } catch {
      /* ignore */
    }
  }, []);
  return [width, setClamped] as const;
}

/** AI 패널 좌측 모서리 리사이즈 핸들 (패널은 우측 도킹 → 왼쪽으로 끌면 넓어짐). */
function AiPanelResizeHandle({
  width,
  onWidth,
}: {
  width: number;
  onWidth: (w: number) => void;
}) {
  const [resizing, setResizing] = useState(false);
  const start = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    if (!resizing) return;
    const move = (e: MouseEvent) => {
      if (!start.current) return;
      // 우측 도킹 패널 — 핸들을 왼쪽으로 끌수록(clientX↓) 폭 증가.
      const delta = start.current.x - e.clientX;
      onWidth(start.current.w + delta);
    };
    const up = () => setResizing(false);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, onWidth]);

  return (
    <>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          start.current = { x: e.clientX, w: width };
          setResizing(true);
        }}
        className={cn(
          "absolute top-0 left-0 z-10 h-full w-1.5 -ml-1 cursor-col-resize",
          "after:absolute after:top-0 after:left-0 after:h-full after:w-px after:transition-colors",
          resizing ? "after:bg-primary/60" : "hover:after:bg-primary/40",
        )}
        // @ts-expect-error -webkit-app-region 은 Electron 전용 CSS 속성
        style={{ WebkitAppRegion: "no-drag" }}
      />
      {/* 드래그 중에만 전체 화면 투명 오버레이 — 옆 <webview>(별도 프로세스)가
          mousemove/mouseup 을 가로채 "손 떼도 계속 따라오는" 문제 방지.
          오버레이가 webview 를 덮어 이벤트가 호스트 renderer 로 들어온다. */}
      {resizing && (
        <div
          className="fixed inset-0 z-[60] cursor-col-resize"
          // @ts-expect-error -webkit-app-region 은 Electron 전용 CSS 속성
          style={{ WebkitAppRegion: "no-drag" }}
        />
      )}
    </>
  );
}

export default function AppPage() {
  const s = useAppPageState();
  const [aiPanelWidth, setAiPanelWidth] = useAiPanelWidth();

  // 상세 뷰 앱의 "실행 가능(백단 이관/준비)" 여부 — 지금열기 vs 다운로드 게이트.
  // hook 은 조건부 호출 금지라 최상위에서(비-detail 모드면 url=null → 게이트 없음).
  const viewingUrl = s.viewing
    ? s.viewing.kind === "catalog"
      ? s.viewing.app.url
      : s.viewing.entry.url
    : null;
  const { runnable, checking, recheck } = useAppRunnable(viewingUrl);

  // ──────────── 1. webview (멀티 탭) ────────────
  if (s.mode === "tabs") {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 통합 탭 헤더 (Chrome 스타일):
            ← → ⟳ | [Tab][Tab][Tab] [+] | ⋮ + AI toggle
            border 없음, bg-muted/30 으로 webview 와 자연스럽게 구분. */}
        <div className="flex items-end bg-muted/30">
          <div className="flex-1 min-w-0">
            <TabBar
              tabs={s.tabs}
              activeTabId={s.activeTabId}
              resolveEntry={s.resolveEntry}
              onActivate={s.setActiveTab}
              onClose={s.closeTab}
              onNewTab={s.openLauncherTab}
              onBack={s.goBack}
              onForward={s.goForward}
              onReload={s.reload}
              activeEntry={s.selected}
              onEditActive={s.handleEditActive}
              onRemoveActive={s.handleRemoveActive}
              onOpenExternalActive={s.handleOpenExternalActive}
              zoomPercent={s.zoomPercent}
              onZoomIn={s.zoomIn}
              onZoomOut={s.zoomOut}
              onZoomReset={s.zoomReset}
            />
          </div>
          {/* AI 토글은 화면분석 대상 탭(외부 URL)에서만 — 리포트 등 FACTOR 자체 도구엔 숨김 */}
          {s.aiEligible && !s.aiPanelOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => s.setAiPanelOpen(true)}
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
          <div className="flex-1 min-w-0 relative">
            <WebViewTabs
              tabs={s.tabs}
              activeTabId={s.activeTabId}
              resolveEntry={s.resolveEntry}
              activeWebviewRef={s.webviewRef}
            />
            {/* 런처 "새 탭" 활성 — webview 대신 앱 선택 화면 (Chrome 새 탭) */}
            {s.isActiveTabLauncher && (
              <LauncherTabView
                urls={s.urls}
                installedUrls={s.normalizedInstalledUrls}
                onPickInstalled={s.handleLauncherPickInstalled}
                onPickCatalog={s.handleLauncherPickCatalog}
                onCustomAdd={s.openCustomAdd}
                onEditEntry={s.handleEditEntry}
                onRemoveEntry={s.handleRemoveEntry}
              />
            )}
          </div>
          {s.aiEligible && s.aiPanelOpen && (
            <aside
              style={{ width: aiPanelWidth }}
              className={cn(
                "relative flex-shrink-0 border-l border-border/60 bg-card/30 flex flex-col min-h-0",
                "ml-2",
              )}
            >
              {/* 좌측 모서리 드래그 → 폭 조절 (320~760, 기본 480) */}
              <AiPanelResizeHandle width={aiPanelWidth} onWidth={setAiPanelWidth} />

              {/* 패널 헤더 — 페이지 인식 표시 + 팝업 + 닫기 */}
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
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      // 팝업으로 띄우면서 오른쪽 패널은 닫아 webview 를 전체화면으로.
                      // (팝업 닫히면 useAppPageState 가 패널을 자동 복원 — 팝업↔패널 스왑)
                      void electron.chatPopup.open();
                      s.setAiPanelOpen(false);
                    }}
                    title="팝업 창으로 열기 (별도 화면 + 투명도) — 오른쪽 패널은 닫힘"
                  >
                    <PictureInPicture2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => s.setAiPanelOpen(false)}
                    title="패널 닫기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* 대화 전환기 — 헤더 바로 아래 (현재 대화명 + 꺽쇠 → 새 대화 / 최근 3개) */}
              <AppChatConversationBar chat={s.enhancedChat} />

              {/* 챗 본문 — enhancedChat (sendMessage 가 page snapshot 자동 첨부) */}
              <div className="flex-1 min-h-0">
                <DesktopAppChatPanel {...s.enhancedChat} />
              </div>
            </aside>
          )}
        </div>

        <AddAppUrlDialog
          open={s.addOpen}
          onOpenChange={s.setAddOpen}
          editTarget={s.editTarget}
          onSubmit={s.handleSubmit}
        />
      </div>
    );
  }

  // ──────────── 2. detail ────────────
  if (s.mode === "detail" && s.viewing) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppDetailView
          source={s.viewing}
          onBack={() => s.setViewing(null)}
          onOpen={s.handleDetailOpen}
          onAddToFavorites={s.handleDetailAddToFavorites}
          onEdit={s.handleDetailEdit}
          onRemove={s.handleDetailRemove}
          runnable={runnable}
          checkingRunnable={checking}
          // 미준비(백단 미이관) 앱의 "다운로드" — 백엔드가 준비됐는지 재확인(이관되면 지금열기로 전환).
          onDownload={runnable === false ? recheck : undefined}
        />
        <AddAppUrlDialog
          open={s.addOpen}
          onOpenChange={s.setAddOpen}
          editTarget={s.editTarget}
          onSubmit={s.handleSubmit}
        />
      </div>
    );
  }

  // ──────────── 3. empty — 풀스크린 STORE ────────────
  if (s.mode === "empty") {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="px-8 py-8 max-w-5xl mx-auto">
            <AppCatalog
              onPick={s.handleCatalogPick}
              onCustomAdd={s.openCustomAdd}
              installedUrls={[]}
            />
          </div>
        </ScrollArea>
        <AddAppUrlDialog
          open={s.addOpen}
          onOpenChange={s.setAddOpen}
          editTarget={s.editTarget}
          onSubmit={s.handleSubmit}
        />
      </div>
    );
  }

  // ──────────── 4. home — "내 앱" + STORE ────────────
  // "URL 직접 추가" 버튼은 "내 앱" 섹션에만. AppCatalog.onCustomAdd 는 안 넘김.
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="px-8 py-8 max-w-5xl mx-auto">
          {/* 내 앱 섹션 */}
          <section className="mb-10">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  내 앱
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.urls.length}개의 즐겨찾기
                </p>
              </div>
              <Button
                onClick={s.openCustomAdd}
                size="sm"
                variant="outline"
                className="gap-2 h-9 px-3"
              >
                <Plus className="w-4 h-4" />
                URL 직접 추가
              </Button>
            </header>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {s.urls.map((u) => (
                <UrlCard
                  key={u.id}
                  entry={u}
                  onClick={() => s.handleInstalledPick(u)}
                  onEdit={() => s.handleEditEntry(u)}
                  onRemove={() => s.handleRemoveEntry(u.id)}
                />
              ))}
            </div>
          </section>

          {/* 설치형 플러그인 — "설치" 시 회사 워크스페이스에 활성화(plugin_installs 테넌트 스코프).
              단일 공유 백엔드라 "백단 이관"이 아니라 회사별 활성화 개념. 설치 가능 팩 0 = 자동 숨김. */}
          <OntologyPackCatalog embedded />

          {/* 구분선 */}
          <div className="border-t border-border/40 my-8" />

          {/* STORE 카탈로그 — onCustomAdd 안 넘김 (중복 버튼 회피) */}
          <AppCatalog
            onPick={s.handleCatalogPick}
            installedUrls={s.normalizedInstalledUrls}
          />
        </div>
      </ScrollArea>
      <AddAppUrlDialog
        open={s.addOpen}
        onOpenChange={s.setAddOpen}
        editTarget={s.editTarget}
        onSubmit={s.handleSubmit}
      />
    </div>
  );
}
