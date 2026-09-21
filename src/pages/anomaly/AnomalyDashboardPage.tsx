/**
 * factor-desktop AnomalyDashboardPage — 이상탐지 모니터링 대시보드 (/anomaly).
 *
 * FE 페이지를 import 하지 않고 (R1, R6) leaf(MonitorDashboardContent)만 가져와
 * 데스크탑 셸 안에 composition. 통계 메인: 시간대별 수신·알람 · 판정 분포 · 설비×시간 히트맵 ·
 * 설비별 요약 (GridStack, 레이아웃 편집). 데이터: anomaly-plugin model-server (VITE_ANOMALY_API_URL).
 */

import { useNavigate } from "react-router-dom";
import { MonitorDashboardContent } from "@/features/anomaly";
import { MONITOR_ROUTES, machineMonitorRoute } from "./monitorNav";

export default function AnomalyDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MonitorDashboardContent
        onOpenMachine={(id) => navigate(machineMonitorRoute(id))}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
      />
    </div>
  );
}
