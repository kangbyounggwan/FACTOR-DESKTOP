/**
 * factor-desktop AnomalyMachinePage — 이상탐지 실시간 설비 상세 (/anomaly/live/:machineId).
 *
 * FE 페이지를 import 하지 않고 (R1, R6) leaf(MachineDetailContent)만 가져와
 * 데스크탑 셸 안에 composition. 디자인: Figma factor "DATUM v2" B2.
 * 화면 탭(MonitorNav — '실시간 플릿' 탭이 플릿 복귀) + 같은 설비의 설비별 이력 화면 링크.
 */

import { useNavigate, useParams } from "react-router-dom";
import { MachineDetailContent } from "@/features/anomaly";
import { MONITOR_ROUTES, machineMonitorRoute } from "./monitorNav";

export default function AnomalyMachinePage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MachineDetailContent
        machineId={machineId ?? ""}
        onNavigate={(v) => navigate(MONITOR_ROUTES[v])}
        onOpenHistory={(id) => navigate(machineMonitorRoute(id))}
      />
    </div>
  );
}
