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
