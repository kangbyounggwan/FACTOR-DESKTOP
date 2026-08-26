/**
 * SidebarTabs — 사이드바 상단의 CHAT / DASHBOARD / APP segmented control.
 */

import { useNavigate, useLocation } from "react-router-dom";
import {
  MessagesSquare,
  LayoutDashboard,
  AppWindow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onChatClick?: () => void;
  onDashboardClick?: () => void;
  onAppClick?: () => void;
}

export function SidebarTabs({ onChatClick, onDashboardClick, onAppClick }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const isChatActive = location.pathname.startsWith("/chat");
  const isAppActive = location.pathname.startsWith("/app");
  const isDashboardActive =
    location.pathname.startsWith("/dashboard") ||
    location.pathname === "/" ||
    location.pathname.startsWith("/monitoring");

  return (
    <div className="px-2 pt-2 pb-1 flex-shrink-0">
      <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg">
        <Tab
          icon={MessagesSquare}
          label="CHAT"
          active={isChatActive}
          onClick={onChatClick ?? (() => navigate("/chat"))}
        />
        <Tab
          icon={LayoutDashboard}
          label="DASHBOARD"
          active={isDashboardActive && !isChatActive && !isAppActive}
          onClick={onDashboardClick ?? (() => navigate("/monitoring"))}
        />
        <Tab
          icon={AppWindow}
          label="APP"
          active={isAppActive}
          onClick={onAppClick ?? (() => navigate("/app"))}
        />
      </div>
    </div>
  );
}

function Tab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex-1 min-w-0 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md",
        "ui-fs-xs font-semibold transition-all overflow-hidden",
        active
          ? "bg-background text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-background/40",
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
