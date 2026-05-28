/**
 * DesktopTopBar — Claude/Arc 톤의 브라우저식 상단 툴바.
 *
 * 레이아웃:
 *   [mac traffic light 공간] [≡] [+] [🔍]   [← →]   ░░ drag region ░░   [Windows controls 공간]
 *
 * - `-webkit-app-region: drag` 영역과 `no-drag` 버튼 영역 혼합
 * - mac: 좌측 80px traffic lights 공간 확보, Windows: 우측 140px 컨트롤 공간 확보
 * - 모든 버튼은 optional callback — 미지정 시 기본 동작 (navigate/disabled)
 */

import { useNavigate } from "react-router-dom";
import {
  Menu,
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DRAG_REGION_HEIGHT = 40;
const MAC_TRAFFIC_LIGHTS_WIDTH = 80;
const WIN_CONTROLS_WIDTH = 140;

const isMacPlatform =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
  /** ≡ 사이드바 토글 (collapse/expand) */
  onToggleSidebar?: () => void;
  /** + 새 대화 (보통 chat.startNewConversation 또는 navigate('/chat', state)) */
  onNewChat?: () => void;
  /** 🔍 검색 (Phase 2 placeholder) */
  onSearch?: () => void;
  /**
   * ← 뒤로. 미지정 시 router history navigate(-1). DesktopShell 이 페이지별
   * backHandler 등록되어 있으면 그것 우선 호출하도록 wrap 한 핸들러를 넘김.
   */
  onBack?: () => void;
  /** 중앙 타이틀 (없으면 "FACTOR DESKTOP") */
  title?: string;
}

export function DesktopTopBar({
  onToggleSidebar,
  onNewChat,
  onSearch,
  onBack,
  title = "FACTOR DESKTOP",
}: Props) {
  const navigate = useNavigate();

  return (
    <div
      className="flex-shrink-0 flex items-center select-none"
      style={{
        height: DRAG_REGION_HEIGHT,
        // @ts-expect-error -webkit-app-region은 Electron 전용 CSS 속성
        WebkitAppRegion: "drag",
      }}
    >
      {/* macOS: traffic lights 자리 비워두기 */}
      {isMacPlatform && (
        <div style={{ width: MAC_TRAFFIC_LIGHTS_WIDTH, flexShrink: 0 }} />
      )}

      {/* 좌측 액션 버튼 그룹 */}
      <div className="flex items-center gap-0.5 px-2">
        <ToolbarButton
          icon={Menu}
          label="사이드바 토글"
          onClick={onToggleSidebar}
        />
        <ToolbarButton
          icon={Plus}
          label="새 대화"
          onClick={onNewChat}
        />
        <ToolbarButton
          icon={Search}
          label="검색"
          onClick={onSearch}
          disabled={!onSearch}
        />

        {/* 분리자 */}
        <div className="w-px h-5 bg-border/60 mx-1" />

        <ToolbarButton
          icon={ArrowLeft}
          label="뒤로"
          onClick={onBack ?? (() => navigate(-1))}
        />
        <ToolbarButton
          icon={ArrowRight}
          label="앞으로"
          onClick={() => navigate(1)}
        />
      </div>

      {/* 중앙 — drag region, 타이틀 표시 */}
      <div className="flex-1 text-center text-[12px] text-muted-foreground/60 font-medium tracking-wider">
        {title}
      </div>

      {/* Windows: 우측 native controls 자리 */}
      {!isMacPlatform && (
        <div style={{ width: WIN_CONTROLS_WIDTH, flexShrink: 0 }} />
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Menu;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      title={label}
      aria-label={label}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
        disabled || !onClick
          ? "text-muted-foreground/40 cursor-not-allowed"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
      )}
      style={{
        // @ts-expect-error -webkit-app-region
        WebkitAppRegion: "no-drag",
      }}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}
