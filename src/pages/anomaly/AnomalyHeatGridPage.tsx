/**
 * factor-desktop AnomalyHeatGridPage — 열처리 공정별 이상률 (#/anomaly/heat/grid).
 *
 * 열처리 첫 탭 '공정별 추이'(#/anomaly/heat)는 AnomalyHeatTrendPage(2026-10-05).
 * leaf(HeatTreatGridContent)만 composition (R1 페이지는 앱별, R6 leaf 만 공유). 데스크탑 래퍼 + HashRouter 라우팅.
 */

import { useNavigate } from "react-router-dom";
import { HeatTreatGridContent } from "@/features/anomaly";
import { MONITOR_ROUTES } from "./monitorNav";

export default function AnomalyHeatGridPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <HeatTreatGridContent onNavigate={(v) => navigate(MONITOR_ROUTES[v])} />
    </div>
  );
}
