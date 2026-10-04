/**
 * factor-desktop AnomalyHeatTrendPage — 열처리 공정별 추이 (#/anomaly/heat · 열처리 첫 탭, 2026-10-05 — output/heat_trend/design.md B).
 *
 * leaf(HeatTreatTrendContent)만 composition (R1 페이지는 앱별, R6 leaf 만 공유). 데스크탑 래퍼 + HashRouter 라우팅.
 */

import { useNavigate } from "react-router-dom";
import { HeatTreatTrendContent } from "@/features/anomaly";
import { MONITOR_ROUTES } from "./monitorNav";

export default function AnomalyHeatTrendPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <HeatTreatTrendContent onNavigate={(v) => navigate(MONITOR_ROUTES[v])} />
    </div>
  );
}
