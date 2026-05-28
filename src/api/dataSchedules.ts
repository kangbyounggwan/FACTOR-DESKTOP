/**
 * factor-desktop 자체 API client — data-connector 의 /api/data-schedules CRUD.
 *
 * v1 (마이그 044, 2026-05-28): list / get / create / update / delete / toggle /
 * reset-circuit. anomaly-eye-monitor 와는 별도 namespace (R6 — 데스크탑 자체).
 */

const BASE_URL =
  (import.meta.env.VITE_DATA_CONNECTOR_URL as string | undefined) ??
  "http://127.0.0.1:8001";

const ROOT = `${BASE_URL.replace(/\/$/, "")}/api/data-schedules`;

// ── Types — backend Pydantic 모델과 1:1 ──────────────────────────────────

export type ScheduleType = "interval" | "cron";
export type Priority = "premium" | "standard" | "low";
export type WriteStrategy = "upsert" | "append" | "replace" | "none";
export type RunStatus = "ok" | "error" | "timeout" | "circuit_open" | "reset" | null;

export interface DataSchedule {
  id: string;
  company_id: string;
  name: string;
  adapter_type: string;
  method_name: string;
  params_template: Record<string, unknown>;

  schedule_type: ScheduleType;
  interval_seconds: number | null;
  cron_expression: string | null;
  minute_offset: number;

  max_concurrent_calls: number;
  rate_limit_per_min: number | null;
  priority: Priority;

  target_table: string | null;
  write_strategy: WriteStrategy | null;
  transform_function: string | null;

  enabled: boolean;
  last_run_at: string | null;
  last_run_duration_ms: number | null;
  last_status: RunStatus;
  last_error: string | null;
  consecutive_failures: number;
  circuit_open_until: string | null;

  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataScheduleListResponse {
  items: DataSchedule[];
  total: number;
}

export type DataScheduleCreate = Omit<
  DataSchedule,
  | "id"
  | "minute_offset"
  | "last_run_at"
  | "last_run_duration_ms"
  | "last_status"
  | "last_error"
  | "consecutive_failures"
  | "circuit_open_until"
  | "created_at"
  | "updated_at"
> & { minute_offset?: number };

export type DataScheduleUpdate = Partial<
  Omit<DataScheduleCreate, "company_id" | "adapter_type" | "method_name">
>;

// ── HTTP helpers ────────────────────────────────────────────────────────

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(`HTTP ${res.status}: ${detail || res.statusText}`);
  }
  // 204 — DELETE
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── API surface ─────────────────────────────────────────────────────────

export function listDataSchedules(params: {
  companyId?: string;
  enabledOnly?: boolean;
  adapterType?: string;
} = {}): Promise<DataScheduleListResponse> {
  const q = new URLSearchParams();
  if (params.companyId) q.set("company_id", params.companyId);
  if (params.enabledOnly) q.set("enabled_only", "true");
  if (params.adapterType) q.set("adapter_type", params.adapterType);
  const qs = q.toString();
  return request(`${ROOT}${qs ? `?${qs}` : ""}`);
}

export function getDataSchedule(id: string): Promise<DataSchedule> {
  return request(`${ROOT}/${id}`);
}

export function createDataSchedule(body: DataScheduleCreate): Promise<DataSchedule> {
  return request(ROOT, { method: "POST", body: JSON.stringify(body) });
}

export function updateDataSchedule(
  id: string,
  body: DataScheduleUpdate,
): Promise<DataSchedule> {
  return request(`${ROOT}/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteDataSchedule(id: string): Promise<void> {
  return request(`${ROOT}/${id}`, { method: "DELETE" });
}

export function toggleDataSchedule(id: string): Promise<DataSchedule> {
  return request(`${ROOT}/${id}/toggle`, { method: "POST" });
}

export function resetCircuit(id: string): Promise<DataSchedule> {
  return request(`${ROOT}/${id}/reset-circuit`, { method: "POST" });
}
