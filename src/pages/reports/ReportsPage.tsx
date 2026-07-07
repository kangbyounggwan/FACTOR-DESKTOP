/**
 * ReportsPage (/reports) — 리포트 앱 (보고서 관리).
 *
 * Figma "리포트 앱" 기획 반영 — 설정(Settings)에서 떼어낸 독립 데스크탑 페이지.
 * ReportsSectionDesktop(이력/수신자/포맷/기본 설정 탭 + 마스터-디테일 뷰어)을 호스팅한다.
 * DesktopShell 이 감싸므로 페이지는 조립만 (R6). 컴포넌트 자체는
 * features/settings/sections/reports 에 유지(내부 위치 — 후속 정리 대상).
 */
import { ReportsSectionDesktop } from "@desktop/features/settings";

export default function ReportsPage() {
  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <ReportsSectionDesktop />
    </div>
  );
}
