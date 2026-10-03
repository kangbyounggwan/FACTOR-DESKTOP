/** 모니터링 화면 탭 → 데스크탑(HashRouter) 라우트. 페이지 전용 — leaf 는 라우트를 모른다 (R6). */
import type { MonitorView } from "@/features/anomaly";

export const MONITOR_ROUTES: Record<MonitorView, string> = {
  dashboard: "/anomaly",
  machines: "/anomaly/machines",
  query: "/anomaly/query",
  live: "/anomaly/live",
};

export const machineMonitorRoute = (machineId: string) =>
  `/anomaly/machines/${encodeURIComponent(machineId)}`;

/** 실시간 설비 상세 — 설비별(이력) 화면과 같은 model-server machine_id 를 쓴다 */
export const liveMachineRoute = (machineId: string) =>
  `/anomaly/live/${encodeURIComponent(machineId)}`;
