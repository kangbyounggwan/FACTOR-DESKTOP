/**
 * factor-desktop AnomalyFleetPage — 이상탐지 실시간 플릿 현황 (/anomaly/live).
 *
 * FE 페이지를 import 하지 않고 (R1, R6) leaf(FleetOverviewContent)만 가져와
 * 데스크탑 셸 안에 composition. 디자인: Figma factor "DATUM v2" B1.
 * 화면 탭(MonitorNav) 라우팅은 다른 모니터링 화면과 같은 MONITOR_ROUTES.
 * 데이터: VITE_ANOMALY_API_URL 미설정 시 mock — 상단 "데모 데이터" 배지로 명시.
 */

import { useNavigate } from "react-router-dom";
import { FleetOverviewContent } from "@/features/anomaly";
import { MONITOR_ROUTES, liveMachineRoute } from "./monitorNav";

export default function AnomalyFleetPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <FleetOverviewContent
        onOpenMachine={(machineId) => navigate(liveMachineRoute(machineId))}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
      />
    </div>
  );
}
