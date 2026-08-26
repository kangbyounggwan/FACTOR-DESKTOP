/**
 * factor-desktop AnomalyFleetPage — 이상탐지 플릿 현황 (/anomaly).
 *
 * FE 페이지를 import 하지 않고 (R1, R6) leaf(FleetOverviewContent)만 가져와
 * 데스크탑 셸 안에 composition. 디자인: Figma factor "DATUM v2" B1.
 * 데이터: 현재 mock — 본문 상단 "데모 데이터" 배지로 명시.
 */

import { useNavigate } from "react-router-dom";
import { FleetOverviewContent } from "@/features/anomaly";

export default function AnomalyFleetPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <FleetOverviewContent
        onOpenMachine={(machineId) => navigate(`/anomaly/${machineId}`)}
      />
    </div>
  );
}
