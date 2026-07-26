/**
 * SidebarMenu — + 새 대화 / 검색 / 설정 / 더보기 인라인 메뉴.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Settings,
  Network,
  FileText,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";

interface Props {
  onStartNew: () => void;
  onSearch?: () => void;
}

export function SidebarMenu({ onStartNew, onSearch }: Props) {
  const navigate = useNavigate();
  const { requireAuth } = useDesktopShell();

  // 설정 진입: 로그인 안 됐으면 DesktopShell의 RequireAuthDialog(중앙 모달)를
  // 띄우고, 로그인 성공 시 /settings로 이동. DASHBOARD 버튼과 동일 UX.
  const handleSettings = useCallback(() => {
    requireAuth(() => navigate("/settings"), {
      title: "설정 접근에는 로그인이 필요합니다",
      description: "이메일로 로그인하면 개인/시스템 설정을 사용할 수 있습니다.",
    });
  }, [navigate, requireAuth]);

  // 온톨로지 플러그인: user_id 스코프라 로그인 필요 (설정과 동일 UX).
  const handleOntology = useCallback(() => {
    requireAuth(() => navigate("/ontology"), {
      title: "플러그인 설치에는 로그인이 필요합니다",
      description: "로그인하면 소속 회사의 온톨로지 플러그인을 다운로드할 수 있습니다.",
    });
  }, [navigate, requireAuth]);

  // 리포트: 회사 스코프(수신자/이력)라 로그인 필요 (설정과 동일 UX).
  const handleReports = useCallback(() => {
    requireAuth(() => navigate("/reports"), {
      title: "리포트 사용에는 로그인이 필요합니다",
      description: "로그인하면 소속 회사의 리포트 생성·이력·수신자를 관리할 수 있습니다.",
    });
  }, [navigate, requireAuth]);

  return (
    <nav className="px-2 pt-1 pb-1 flex flex-col gap-0.5">
      <MenuItem icon={Plus} label="새 대화" onClick={onStartNew} />
      <MenuItem
        icon={Search}
        label="검색"
        onClick={onSearch}
        disabled={!onSearch}
      />
      <MenuItem icon={FileText} label="리포트" onClick={handleReports} />
      <MenuItem icon={Network} label="온톨로지 플러그인" onClick={handleOntology} />
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
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-left",
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
