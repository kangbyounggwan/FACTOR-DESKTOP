/**
 * TabBar — APP webview 의 통합 헤더 (Linear/Arc/Chrome 스타일).
 *
 * 한 줄에 모든 컨트롤:
 *   [← → ⟳]   [Tab1 ✕] [Tab2 ✕] [Tab3 ✕] [+]    [⋮]
 *
 * 탭 고도화 (v0.0.27):
 *  - 활성 탭: bg-card + bottom primary accent line + 약한 shadow
 *  - 로딩 중: favicon 자리에 spinner (webview did-start/stop-loading 으로 동기화)
 *  - hover: shadcn Tooltip 으로 URL 노출 (native title 제거 — 우리 디자인 시스템)
 *  - 우클릭: context menu (탭 닫기 / 다른 탭 닫기 / 오른쪽 탭 닫기 / 외부 열기 / 새로고침)
 *  - 부드러운 entrance animation
 *  - 활성 탭의 X 는 destructive 색 hover
 */

import { useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Plus,
  X,
  MoreVertical,
  ExternalLink,
  Pencil,
  Trash2,
  Loader2,
  XCircle,
  ArrowRightCircle,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  AppWindow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AppFavicon } from "./AppFavicon";
import type { AppUrlEntry } from "@desktop/types/electron";
import { useOpenTabs, type OpenTab } from "./useOpenTabs";
import { electron } from "@desktop/lib/electron";

interface Props {
  tabs: OpenTab[];
  activeTabId: string | null;
  /** tab id 로 AppUrlEntry resolve — 없으면 null (drop 된 entry / 런처 새 탭) */
  resolveEntry: (urlEntryId: string | null) => AppUrlEntry | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNewTab: () => void;
  /** webview navigation — 활성 탭 기준 */
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  /** 활성 탭 entry 의 액션 (entry 없는 placeholder 탭에서는 비활성) */
  activeEntry: AppUrlEntry | null;
  onEditActive: () => void;
  onRemoveActive: () => void;
  onOpenExternalActive: () => void;
  /** 활성 탭 webview 확대/축소 — Ctrl+휠/Ctrl+± 도 동일 동작 (main process 처리) */
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  resolveEntry,
  onActivate,
  onClose,
  onNewTab,
  onBack,
  onForward,
  onReload,
  activeEntry,
  onEditActive,
  onRemoveActive,
  onOpenExternalActive,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: Props) {
  const closeOthers = useOpenTabs((s) => s.closeOthers);
  const closeToRight = useOpenTabs((s) => s.closeToRight);

  return (
    <header className="flex-shrink-0 flex items-center gap-0.5 px-1.5 pt-1.5 bg-muted/30">
      {/* 좌측 — navigation. Chrome 처럼 borderless, hover 만 살짝 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onBack}
        title="뒤로"
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onForward}
        title="앞으로"
      >
        <ArrowRight className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onReload}
        title="새로고침"
      >
        <RefreshCw className="w-4 h-4" />
      </Button>

      {/* 가운데 — 탭 strip (scrollable). 좌측 nav 와 1px gap 만 */}
      <div className="flex-1 min-w-0 flex items-end gap-0.5 overflow-x-auto ml-1">
        {tabs.map((tab, idx) => {
          const entry = resolveEntry(tab.urlEntryId);
          const isActive = tab.id === activeTabId;
          return (
            <Tab
              key={tab.id}
              tab={tab}
              entry={entry}
              isActive={isActive}
              canCloseOthers={tabs.length > 1}
              hasTabsToRight={idx < tabs.length - 1}
              onActivate={() => onActivate(tab.id)}
              onClose={() => onClose(tab.id)}
              onCloseOthers={() => closeOthers(tab.id)}
              onCloseToRight={() => closeToRight(tab.id)}
              onReload={() => {
                onActivate(tab.id);
                // 다음 tick 에 reload (활성 탭 swap 후)
                setTimeout(onReload, 0);
              }}
              onOpenExternal={() => {
                if (entry) void electron.openExternal(entry.url);
              }}
            />
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0 ml-0.5 self-center text-muted-foreground hover:text-foreground"
          onClick={onNewTab}
          title="새 탭"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 우측 — 확대/축소 (Ctrl+휠 / Ctrl+± / Ctrl+0 동일 동작) */}
      <div className="flex items-center flex-shrink-0 ml-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onZoomOut}
          title="축소 (Ctrl+-)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <button
          type="button"
          onClick={onZoomReset}
          title="원래 크기로 (Ctrl+0)"
          className={cn(
            "h-7 min-w-[44px] px-1 rounded-md text-[11px] font-medium tabular-nums",
            "transition-colors hover:bg-foreground/[0.04]",
            zoomPercent === 100
              ? "text-muted-foreground"
              : "text-primary",
          )}
        >
          {zoomPercent}%
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onZoomIn}
          title="확대 (Ctrl++)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* 우측 — 활성 탭 액션 메뉴 (separator 제거, Chrome 처럼 borderless) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 ml-0.5 text-muted-foreground hover:text-foreground"
            title="활성 탭 메뉴"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => void electron.openNewWindow()}>
            <AppWindow className="w-3.5 h-3.5 mr-2" />새 창 열기
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onOpenExternalActive}
            disabled={!activeEntry}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            시스템 브라우저로 열기
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEditActive} disabled={!activeEntry}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            URL · 이름 편집
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onRemoveActive}
            disabled={!activeEntry}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            즐겨찾기에서 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────

interface TabProps {
  tab: OpenTab;
  entry: AppUrlEntry | null;
  isActive: boolean;
  canCloseOthers: boolean;
  hasTabsToRight: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  onReload: () => void;
  onOpenExternal: () => void;
}

function Tab({
  tab,
  entry,
  isActive,
  canCloseOthers,
  hasTabsToRight,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onReload,
  onOpenExternal,
}: TabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 런처 "새 탭" (urlEntryId=null) — 앱 선택 화면, webview 없음
  const isLauncher = tab.urlEntryId === null;
  const host = (() => {
    if (!entry) return "?";
    try {
      return new URL(entry.url).hostname;
    } catch {
      return entry.url;
    }
  })();
  const label = isLauncher ? "새 탭" : (entry?.name ?? "(닫힘)");

  // 미들 클릭 (가운데 마우스 버튼) = 탭 닫기 — 브라우저 표준 UX
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <div
              ref={containerRef}
              role="button"
              tabIndex={0}
              onClick={onActivate}
              onMouseDown={handleMouseDown}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onActivate();
              }}
              className={cn(
                // 기본 컨테이너 — Chrome 스타일: border / shadow / accent 모두 제거,
                // bg 차이로만 활성 구분. 상단 모서리만 둥글게, 하단은 webview 영역과
                // 자연스럽게 이어지도록 평평.
                "group relative flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5",
                "rounded-t-md cursor-pointer select-none transition-colors duration-150",
                "min-w-[100px] max-w-[200px] flex-shrink-0",
                "animate-in fade-in-0 duration-200",
                // 비활성 / 활성 분기 — bg 색상만
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.04]",
              )}
            >
              {/* favicon / spinner / 런처 아이콘 */}
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {tab.isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : isLauncher ? (
                  <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <AppFavicon
                    primarySrc={entry?.iconUrl}
                    host={host}
                    size={14}
                  />
                )}
              </div>

              {/* name — 컨테이너의 text-color 상속 (활성은 foreground, 비활성은 muted) */}
              <span
                className={cn(
                  "flex-1 text-[11.5px] truncate leading-tight",
                  isActive && "font-medium",
                )}
              >
                {label}
              </span>

              {/* close X — 활성: 항상 50% 노출 / 비활성: hover 시 노출 / 모두: hover 시 destructive */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className={cn(
                  "ml-0.5 w-4 h-4 rounded-sm flex items-center justify-center flex-shrink-0",
                  "transition-all duration-150",
                  "hover:bg-destructive/15 hover:text-destructive",
                  isActive
                    ? "opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                )}
                tabIndex={-1}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </TooltipTrigger>
          {/* hover tooltip — URL */}
          <TooltipContent side="bottom" align="start" className="max-w-[320px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-medium leading-snug">
                {label}
              </span>
              <span className="text-[10.5px] text-muted-foreground font-mono break-all">
                {isLauncher ? "앱 선택 화면" : (entry?.url ?? "(닫힌 즐겨찾기)")}
              </span>
              <span className="text-[10px] text-muted-foreground/70 mt-1">
                가운데 클릭 = 닫기 · 우클릭 = 메뉴
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </ContextMenuTrigger>

      {/* 우클릭 context menu */}
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onReload} disabled={!entry}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          새로고침
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpenExternal} disabled={!entry}>
          <ExternalLink className="w-3.5 h-3.5 mr-2" />
          시스템 브라우저로 열기
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onClose}>
          <X className="w-3.5 h-3.5 mr-2" />
          탭 닫기
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers} disabled={!canCloseOthers}>
          <XCircle className="w-3.5 h-3.5 mr-2" />
          다른 탭 모두 닫기
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseToRight} disabled={!hasTabsToRight}>
          <ArrowRightCircle className="w-3.5 h-3.5 mr-2" />
          오른쪽 탭 모두 닫기
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
