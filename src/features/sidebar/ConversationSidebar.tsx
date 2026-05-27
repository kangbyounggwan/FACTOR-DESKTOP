/**
 * ConversationSidebar — Claude Desktop 스타일 좌측 사이드바 (rounded card).
 *
 * 구조:
 *   ┌──────────────────────────────┐
 *   │  CHAT / DASHBOARD / APP      │  ← SidebarTabs
 *   │  + 새 대화 / 검색 / 설정 / .. │  ← SidebarMenu
 *   │  Recents (헤더 + 새로고침)    │  ← RecentsHeader
 *   │  날짜 그룹 + ConversationRow │
 *   │  ...                         │
 *   │  [bottomSlot - auth widget]  │
 *   └──────────────────────────────┘
 *   우측 가장자리 1.5px = ResizeHandle
 *
 * 외부 협력자(부모):
 *   - onSelect/onStartNew/currentConversationId: useAIChat 흐름
 *   - bottomSlot: DesktopAuthWidget inline
 *   - onDashboardClick: 게스트 차단 모달 등 가드 처리
 *   - width/onWidthChange: DesktopShell이 관리하는 사이드바 폭
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { listConversationsV2, type ConversationListItem } from "@/api/chat";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { groupByDate } from "@/features/monitoring/components/ai-chat/conversation-helpers";
import { SidebarTabs } from "./SidebarTabs";
import { SidebarMenu } from "./SidebarMenu";
import { ConversationRow } from "./ConversationRow";
import { GuestEmpty } from "./GuestEmpty";

// 3개 탭(CHAT / DASHBOARD / APP) 중 DASHBOARD가 가장 길어 폭의 하한을 결정.
// 실측: 296px 미만에서는 text-[10px] semibold라도 "DASHBOA…"로 잘림.
// 기본은 여유 있게 320px로 둠.
export const SIDEBAR_MIN_WIDTH = 296;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 320;
/**
 * 드래그 중 raw mouseX 가 이 값 이하로 내려가면 사이드바를 자동 접음.
 * (SIDEBAR_MIN_WIDTH 보다 더 좁히려는 시도 = "닫고 싶다" 의 신호로 해석)
 */
export const SIDEBAR_COLLAPSE_THRESHOLD = 220;

interface Props {
  onSelect: (conversationId: string) => void;
  onStartNew: () => void;
  currentConversationId?: string | null;
  bottomSlot?: ReactNode;
  onDashboardClick?: () => void;
  onChatClick?: () => void;
  onAppClick?: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  /**
   * 사용자가 사이드바를 SIDEBAR_COLLAPSE_THRESHOLD 미만으로 좁히려고 드래그할 때 호출.
   * 부모(DesktopShell)가 setSidebarCollapsed(true) 처리.
   */
  onCollapseRequest?: () => void;
  /** 제공되면 Recents 섹션을 이걸로 대체 (예: DASHBOARD 페이지에서 라인 목록 표시) */
  customRecents?: ReactNode;
  /** Recents 헤더 라벨 (default: "Recents"). customRecents 사용 시 도메인 라벨로 교체 가능 (예: "Zone"). */
  recentsLabel?: string;
  className?: string;
}

export function ConversationSidebar({
  onSelect,
  onStartNew,
  currentConversationId,
  bottomSlot,
  onDashboardClick,
  onChatClick,
  onAppClick,
  width = SIDEBAR_DEFAULT_WIDTH,
  onWidthChange,
  onCollapseRequest,
  customRecents,
  recentsLabel = "Recents",
  className,
}: Props) {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resizing, setResizing] = useState(false);
  const { user, profile, isAuthenticated } = useAuth();

  // 대화 목록 fetch
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listConversationsV2({
      userId: user?.id ?? null,
      companyId: profile?.company_id ?? null,
      limit: 50,
    })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.company_id, isAuthenticated, refreshKey, currentConversationId]);

  // 우측 핸들 드래그 → 부모에 width 전파.
  // raw mouseX 가 SIDEBAR_COLLAPSE_THRESHOLD 미만이면 collapse 트리거 + drag 종료.
  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const raw = e.clientX - 8;
      // 사용자가 한참 좁히려는 시도 — collapse 신호
      if (raw < SIDEBAR_COLLAPSE_THRESHOLD && onCollapseRequest) {
        onCollapseRequest();
        setResizing(false);
        return;
      }
      const next = Math.max(
        SIDEBAR_MIN_WIDTH,
        Math.min(SIDEBAR_MAX_WIDTH, raw),
      );
      onWidthChange?.(next);
    };
    const handleUp = () => setResizing(false);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, onWidthChange, onCollapseRequest]);

  const grouped = useMemo(() => groupByDate(items), [items]);

  return (
    <div className="relative flex-shrink-0 h-full" style={{ width }}>
      <aside
        className={cn(
          "flex flex-col h-full w-full rounded-2xl bg-card/60 backdrop-blur-sm overflow-hidden border border-border/50",
          className,
        )}
      >
        <SidebarTabs
          onChatClick={onChatClick}
          onDashboardClick={onDashboardClick}
          onAppClick={onAppClick}
        />
        <SidebarMenu onStartNew={onStartNew} />

        {/* Recents 영역 — customRecents가 제공되면 그걸로 대체 (예: DASHBOARD = 라인 목록).
            헤더는 양쪽 동일 형식 (RecentsHeader). 라벨만 recentsLabel prop으로 교체. */}
        {customRecents ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-3 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
              <h3 className="text-[11px] font-medium text-muted-foreground">
                {recentsLabel}
              </h3>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {customRecents}
            </div>
          </div>
        ) : (
          <>
            <RecentsHeader
              hasItems={items.length > 0}
              authenticated={isAuthenticated}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              label={recentsLabel}
            />
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2">
                {!isAuthenticated ? (
                  <GuestEmpty />
                ) : loading ? (
                  <LoadingState />
                ) : error ? (
                  <ErrorState
                    message={error}
                    onRetry={() => setRefreshKey((k) => k + 1)}
                  />
                ) : items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3">
                    {grouped.map(({ group, items: gItems }) => (
                      <section key={group}>
                        <h4 className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                          {group}
                        </h4>
                        <ul className="space-y-px">
                          {gItems.map((it) => (
                            <ConversationRow
                              key={it.id}
                              item={it}
                              active={it.id === currentConversationId}
                              onClick={() => onSelect(it.id)}
                            />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        {bottomSlot && (
          <div className="border-t border-border/40 px-2 py-1.5 flex-shrink-0">
            {bottomSlot}
          </div>
        )}
      </aside>

      {onWidthChange && (
        <ResizeHandle resizing={resizing} onStart={() => setResizing(true)} />
      )}
    </div>
  );
}

// ─── 작은 sub-helpers (inline 유지 — 단순 표시 요소들) ─────────────────

function RecentsHeader({
  hasItems,
  authenticated,
  onRefresh,
  label = "Recents",
}: {
  hasItems: boolean;
  authenticated: boolean;
  onRefresh: () => void;
  label?: string;
}) {
  return (
    <div className="px-3 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
      <h3 className="text-[11px] font-medium text-muted-foreground">{label}</h3>
      {authenticated && hasItems && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRefresh}
                className="p-1 rounded hover:bg-accent/60 transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-muted-foreground/70" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">
              새로고침
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
      불러오는 중
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-[11px] text-destructive py-3 px-2">
      불러오기 실패 ({message})
      <button
        type="button"
        onClick={onRetry}
        className="ml-2 underline hover:no-underline"
      >
        재시도
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-[11px] text-muted-foreground py-8 text-center px-3">
      저장된 대화 없음
    </div>
  );
}

function ResizeHandle({
  resizing,
  onStart,
}: {
  resizing: boolean;
  onStart: () => void;
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      className={cn(
        "absolute top-0 right-0 h-full w-1.5 cursor-col-resize",
        "after:absolute after:top-0 after:right-0 after:h-full after:w-px after:transition-colors",
        resizing ? "after:bg-primary/60" : "hover:after:bg-primary/40",
      )}
      style={{
        // @ts-expect-error -webkit-app-region은 Electron 전용 CSS 속성
        WebkitAppRegion: "no-drag",
      }}
    />
  );
}
