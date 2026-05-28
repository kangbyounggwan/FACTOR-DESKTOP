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

import { Plus, MessageSquare, X } from "lucide-react";
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
  DesktopAppChatPanel,
} from "@desktop/features/app";

export default function AppPage() {
  const s = useAppPageState();

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
              onNewTab={s.closeAllTabs}
              onBack={s.goBack}
              onForward={s.goForward}
              onReload={s.reload}
              activeEntry={s.selected}
              onEditActive={s.handleEditActive}
              onRemoveActive={s.handleRemoveActive}
              onOpenExternalActive={s.handleOpenExternalActive}
            />
          </div>
          {!s.aiPanelOpen && (
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
          <div className="flex-1 min-w-0">
            <WebViewTabs
              tabs={s.tabs}
              activeTabId={s.activeTabId}
              resolveEntry={s.resolveEntry}
              activeWebviewRef={s.webviewRef}
            />
          </div>
          {s.aiPanelOpen && (
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
                  onClick={() => s.setAiPanelOpen(false)}
                  title="패널 닫기"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
