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
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTH_GATE_DESCRIPTION, AUTH_REQUIRED_TITLE } from "@/features/auth";
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
  // 문구: 제목은 상황 공통, 설명은 메뉴별 고정 문장 — 웹과 같은 상수(design.md §4.1).
  const handleSettings = useCallback(() => {
    requireAuth(() => navigate("/settings"), {
      title: AUTH_REQUIRED_TITLE,
      description: AUTH_GATE_DESCRIPTION.settings,
    });
  }, [navigate, requireAuth]);

  // 온톨로지 플러그인: user_id 스코프라 로그인 필요 (설정과 동일 UX).
  const handleOntology = useCallback(() => {
    requireAuth(() => navigate("/ontology"), {
      title: AUTH_REQUIRED_TITLE,
      description: AUTH_GATE_DESCRIPTION.ontologyPlugin,
    });
  }, [navigate, requireAuth]);

  // 리포트: 회사 스코프(수신자/이력)라 로그인 필요 (설정과 동일 UX).
  const handleReports = useCallback(() => {
    requireAuth(() => navigate("/reports"), {
      title: AUTH_REQUIRED_TITLE,
      description: AUTH_GATE_DESCRIPTION.reports,
    });
  }, [navigate, requireAuth]);

  // 이상탐지: 설비 데이터 스코프라 로그인 필요 (설정과 동일 UX).
  const handleAnomaly = useCallback(() => {
    requireAuth(() => navigate("/anomaly"), {
      title: AUTH_REQUIRED_TITLE,
      description: AUTH_GATE_DESCRIPTION.anomaly,
    });
  }, [navigate, requireAuth]);

  return (
    <nav className="px-2 pt-1 pb-1 flex flex-col gap-0.5">
      <MenuItem icon={Plus} label="새 대화" onClick={onStartNew} />
      {/* 검색은 핸들러가 주입될 때만 노출. 상시 회색 버튼은 처음 쓰는 사람에게
          "앱이 고장났나?" 로 읽힌다 — 못 쓰는 기능은 비활성이 아니라 부재. */}
      {onSearch && <MenuItem icon={Search} label="검색" onClick={onSearch} />}
      <MenuItem icon={Activity} label="이상탐지" onClick={handleAnomaly} />
      <MenuItem icon={FileText} label="리포트" onClick={handleReports} />
      <MenuItem icon={Network} label="온톨로지 플러그인" onClick={handleOntology} />
      <MenuItem icon={Settings} label="설정" onClick={handleSettings} />
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
