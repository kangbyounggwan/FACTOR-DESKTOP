/**
 * factor-desktop AnomalyDashboardPage — 가공 대시보드 = 설비별 현황 (/anomaly, L1).
 *
 * FE 페이지를 import 하지 않고 (R1, R6) leaf(MonitorDashboardContent)만 가져와 데스크탑 셸 안에 composition.
 * 설비별 현황 표(라인 묶음 · ①②③ 판정 · 경보 · 라인 운영 칸) + 보조 카드(시간대별 사이클 · 경보 · 자주검사 2개).
 * 행 · 띠 칸 선택 → 설비 세부(L2 /anomaly/machines/:id)로 push, router state {from: "dashboard", focus}
 * (설계 output/mach_dashboard/design.md §1.3). 데이터: anomaly-plugin model-server (VITE_ANOMALY_API_URL).
 */

import { useNavigate } from "react-router-dom";
import { MonitorDashboardContent } from "@/features/anomaly";
import { MONITOR_ROUTES, machineMonitorRoute, type MachineRouteState } from "./monitorNav";

export default function AnomalyDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MonitorDashboardContent
        onOpenMachine={(id, focus) => {
          const state: MachineRouteState = focus ? { from: "dashboard", focus } : { from: "dashboard" };
          navigate(machineMonitorRoute(id), { state });
        }}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
      />
    </div>
  );
}
