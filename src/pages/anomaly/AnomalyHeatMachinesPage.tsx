/**
 * factor-desktop AnomalyHeatMachinesPage — 열처리 설비별 현황 (#/anomaly/heat/machines, 열처리 두 번째 탭).
 *
 * 범위 열처리기(서버 범위 설정 — 기본 P12G 로 220) × 공정 칸 · 수질 · 판정 + 이력 상태, 행 클릭 → 설비 상세 창.
 * 범위 설비가 1기면 탭이 숨는다(MonitorNav · monitorTabs 공유 leaf — 데스크탑 쪽 분기 없음). 주소로 들어오면 그대로 그린다.
 * leaf(HeatTreatMachinesContent)만 composition (R1 페이지는 앱별, R6 leaf 만 공유). 데스크탑 래퍼 + HashRouter 라우팅.
 */

import { useNavigate } from "react-router-dom";
import { HeatTreatMachinesContent } from "@/features/anomaly";
import { MONITOR_ROUTES } from "./monitorNav";

export default function AnomalyHeatMachinesPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full min-h-0 bg-background flex flex-col overflow-hidden">
      <HeatTreatMachinesContent onNavigate={(v) => navigate(MONITOR_ROUTES[v])} />
    </div>
  );
}
