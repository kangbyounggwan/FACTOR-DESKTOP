/**
 * factor-desktop AnomalyMachinePage — 이상탐지 설비 상세 (/anomaly/:machineId).
 *
 * FE 페이지를 import 하지 않고 (R1, R6) leaf(MachineDetailContent)만 가져와
 * 데스크탑 셸 안에 composition. 디자인: Figma factor "DATUM v2" B2.
 */

import { useNavigate, useParams } from "react-router-dom";
import { MachineDetailContent } from "@/features/anomaly";

export default function AnomalyMachinePage() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <MachineDetailContent
        machineId={machineId ?? ""}
        onBack={() => navigate("/anomaly")}
      />
    </div>
  );
}
