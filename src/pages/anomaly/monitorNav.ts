/** 모니터링 화면 탭 → 데스크탑(HashRouter) 라우트. 페이지 전용 — leaf 는 라우트를 모른다 (R6). */
import type { MachineMonitorFocus, MonitorView } from "@/features/anomaly";

export const MONITOR_ROUTES: Record<MonitorView, string> = {
  dashboard: "/anomaly",
  query: "/anomaly/query",
  live: "/anomaly/live",
  "heat-trend": "/anomaly/heat",
  "heat-machines": "/anomaly/heat/machines",
  "heat-grid": "/anomaly/heat/grid",
};

export const machineMonitorRoute = (machineId: string) =>
  `/anomaly/machines/${encodeURIComponent(machineId)}`;

/** 실시간 설비 상세 — 설비별(이력) 화면과 같은 model-server machine_id 를 쓴다 */
export const liveMachineRoute = (machineId: string) =>
  `/anomaly/live/${encodeURIComponent(machineId)}`;

/**
 * 설비 세부(L2) router state (2026-10-04 가공 스택 — output/mach_dashboard/design.md §1.3). 웹과 같은 약속을 데스크탑이 따로 둔다(R1).
 *   from: "dashboard" = 대시보드 표(L1)에서 push → 뒤로(← · 캡션 · 탭 · Esc)는 history back.
 *         없으면 /anomaly 로 navigate. (2026-10-05 설비 전환 칩 삭제)
 *   focus: L2 첫 선택 — current(열린/마지막 에피소드) · hour(그 1시간, 점수 축).
 */
export interface MachineRouteState {
  from?: "dashboard";
  focus?: MachineMonitorFocus;
}

/** location.state → MachineRouteState (모르는 모양이면 빈 값) */
export function readMachineRouteState(state: unknown): MachineRouteState {
  if (!state || typeof state !== "object") return {};
  const s = state as Record<string, unknown>;
  const out: MachineRouteState = {};
  if (s.from === "dashboard") out.from = "dashboard";
  const f = s.focus as Record<string, unknown> | undefined;
  if (f && f.kind === "current") out.focus = { kind: "current" };
  else if (f && f.kind === "hour" && typeof f.from_axis === "string" && typeof f.to_axis === "string") {
    out.focus = { kind: "hour", from_axis: f.from_axis, to_axis: f.to_axis };
  }
  return out;
}
