/**
 * factor-desktop AnomalyQueryPage — 시각별 조회 (/anomaly/query).
 *
 * leaf(MonitorQueryContent)만 composition (R1, R6). 기간·설비·상태·score 필터, 서버 페이지, CSV,
 * 행 클릭 파형 드로어.
 */

import { useNavigate } from "react-router-dom";
import { MonitorQueryContent } from "@/features/anomaly";
import { MONITOR_ROUTES, machineMonitorRoute } from "./monitorNav";

export default function AnomalyQueryPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MonitorQueryContent
        onOpenMachine={(id) => navigate(machineMonitorRoute(id))}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
      />
    </div>
  );
}
