/**
 * factor-desktop AnomalyMachineMonitorPage — 설비별 모니터링 (/anomaly/machines/:machineId).
 *
 * leaf(MonitorMachineContent)만 composition (R1, R6). score 추이(가동 상태 띠·시간 스코프) ·
 * 사이클 파형(이상 구간·확대) · 사이클 목록. 설비 미지정 시 첫 설비로 replace.
 */

import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MonitorMachineContent } from "@/features/anomaly";
import { MONITOR_ROUTES, machineMonitorRoute } from "./monitorNav";

export default function AnomalyMachineMonitorPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const decoded = machineId ? decodeURIComponent(machineId) : null;
  const select = useCallback(
    (id: string) => navigate(machineMonitorRoute(id), { replace: !decoded }),
    [navigate, decoded],
  );

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MonitorMachineContent
        machineId={decoded}
        onSelectMachine={select}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
      />
    </div>
  );
}
