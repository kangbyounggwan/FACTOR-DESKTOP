/**
 * SidebarMenu — + 새 대화 / 검색 / 설정 / 더보기 인라인 메뉴.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Settings,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onStartNew: () => void;
  onSearch?: () => void;
}

export function SidebarMenu({ onStartNew, onSearch }: Props) {
  const navigate = useNavigate();
  const handleSettings = useCallback(() => navigate("/settings"), [navigate]);

  return (
    <nav className="px-2 pt-1 pb-1 flex flex-col gap-0.5">
      <MenuItem icon={Plus} label="새 대화" onClick={onStartNew} />
      <MenuItem
        icon={Search}
        label="검색"
        onClick={onSearch}
        disabled={!onSearch}
      />
      <MenuItem icon={Settings} label="설정" onClick={handleSettings} />
      <MenuItem icon={MoreHorizontal} label="더보기" disabled />
    </nav>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-left",
        "transition-colors",
        disabled
          ? "text-muted-foreground/40 cursor-not-allowed"
          : "text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}
