/**
 * factor-desktop AnomalyMachineMonitorPage — 가공 설비 세부 모니터링 (/anomaly/machines/:machineId, L2 스택 페이지).
 *
 * leaf(MonitorMachineContent)만 composition (R1, R6) — 설비 머리 · 이상 점수 추이 · 사이클 파형 · 점수 위치 · 자주검사 · 목록
 * (설계 output/mach_dashboard/design.md §3, 2026-10-05 재배치 output/mach_l2_rev/design.md §2). 페이지는 라우팅만:
 *   - router state {from, focus} → focus(첫 선택)
 *   - 뒤로(← · 캡션 · 탭 '대시보드' · Esc): 직전이 L1(from = "dashboard")이면 history back, 아니면 navigate('/anomaly')
 *   - (2026-10-05 설비 전환 칩 삭제 — 다른 설비는 뒤로 L1 에 돌아가 고른다)
 * 설비 없는 /anomaly/machines 는 App.tsx 가 /anomaly 로 replace. 같은 설비의 실시간 설비 상세(/anomaly/live/:machineId) 링크.
 */

import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { MonitorMachineContent } from "@/features/anomaly";
import { MONITOR_ROUTES, liveMachineRoute, readMachineRouteState } from "./monitorNav";

export default function AnomalyMachineMonitorPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const route = readMachineRouteState(location.state);
  const fromDashboard = route.from === "dashboard";
  const decoded = machineId ? decodeURIComponent(machineId) : "";

  const back = useCallback(() => {
    if (fromDashboard) navigate(-1);
    else navigate(MONITOR_ROUTES.dashboard);
  }, [navigate, fromDashboard]);

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MonitorMachineContent
        machineId={decoded}
        focus={route.focus}
        onBack={back}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
        onOpenLive={(id) => navigate(liveMachineRoute(id))}
      />
    </div>
  );
}
