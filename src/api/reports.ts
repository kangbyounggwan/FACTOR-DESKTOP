/**
 * factor-desktop 자체 API client — report-plugin 의 /api/reports/v1.
 *
 * 컨벤션: BASE_URL env → ROOT, 타입 = 백엔드 1:1, request<T> 헬퍼.
 * 모든 요청에 supabase 세션 access_token 을 `Authorization: Bearer` 로
 * 첨부 — 백엔드는 Principal 필수 (legacy 불허).
 *
 * 응답 shape 은 report-plugin/backend_router.py · service.py · core/models.py
 * (RunRecord/record_run/ScheduleCreate/SchedulePatch) 를 미러.
 */

import { supabase } from "@/lib/supabase";

const BASE_URL =
  (import.meta.env.VITE_REPORT_SERVICE_URL as string | undefined) ??
  "http://127.0.0.1:8010";

const ROOT = `${BASE_URL.replace(/\/$/, "")}/api/reports/v1`;

// ── Types — backend Pydantic 모델 / report_runs row 와 1:1 ────────────────

export type Persona = "executive" | "manager" | "operator";
export type ReportFormat = "pdf" | "html" | "pptx";
/** report_runs.status — 상태 머신: queued → running → succeeded | partial | failed */
export type RunStatus = "queued" | "running" | "succeeded" | "partial" | "failed";
export type SectionStatus = "ok" | "partial" | "failed" | "skipped";

interface SectionSpec {
  key: string;
  heading: string;
  goal: string;
  metric_hints: string[];
  api_hints: string[];
  chart: "line" | "bar" | "none";
  required: boolean;
  source: "api" | "screens" | "synth";
}

export interface PersonaTemplate {
  persona: Persona;
  title_format: string;
  tone: string;
  default_formats: string[];
  sections: SectionSpec[];
}

/** GET /templates — 페르소나 정의 (정적 코드 데이터) */
type TemplatesResponse = Record<Persona, PersonaTemplate>;

interface PlannedSection {
  spec: SectionSpec;
  calls: unknown[];
  skipped_reason: string | null;
}

interface ReportPlan {
  persona: Persona;
  title: string;
  period: [string, string];
  focus_entities: string[];
  sections: PlannedSection[];
}

interface SectionResult {
  key: string;
  status: SectionStatus;
  data: Record<string, unknown>;
  sources: { kind: string; ref: string; detail?: string | null }[];
  error: string | null;
}

/** report_runs row — storage.record_run() 기록 필드 (plan=None → '{}') */
export interface ReportRun {
  id: string;
  user_id: string | null; // NULL = MCP company-mode 실행
  company_id: string;
  persona: Persona;
  request_text: string | null;
  status: RunStatus;
  plan: Partial<ReportPlan>;
  section_results: SectionResult[];
  /** {fmt: "<company>/<run>/report.<fmt>"} — "local:" 접두 = 다운로드 불가 */
  artifacts: Partial<Record<ReportFormat, string>>;
  error: string | null;
  notes: string[];
  duration_ms: number;
  created_at: string;
}

/** 합성 산출 (GET /runs/{id} 의 report — 메모리 캐시라 null 일 수 있음) */
export interface ReportSection {
  heading: string;
  type: "text" | "table" | "list" | "chart" | "stats" | "image";
  content: string | null;
  data: unknown;
}

interface ReportData {
  title: string;
  subtitle: string | null;
  generated_at: string;
  sections: ReportSection[];
  summary: string | null;
}

interface RunDetail {
  run: ReportRun;
  /** fmt → 1시간 서명 URL ("local:" 산출물은 제외됨) */
  download: Partial<Record<ReportFormat, string>>;
  report: ReportData | null;
}

export interface GenerateRequest {
  request_text?: string | null;
  persona?: Persona;
  target?: string | null;
  formats?: ReportFormat[];
}

interface GenerateResponse {
  run_id: string;
  status: "queued";
}

/** report_schedules row */
export interface ReportSchedule {
  id: string;
  user_id: string;
  company_id: string;
  cron: string; // Asia/Seoul 해석
  persona: Persona;
  request_template: string | null;
  formats: ReportFormat[];
  allowed_custom_hosts: string[];
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** POST /schedules body — backend_router.ScheduleCreate 그대로 */
export interface ScheduleCreate {
  cron: string;
  persona: Persona;
  request_template?: string | null;
  formats?: ReportFormat[];
}

/** PATCH /schedules/{sid} body — backend_router.SchedulePatch 그대로 */
export interface SchedulePatch {
  cron?: string;
  enabled?: boolean;
  persona?: Persona;
  request_template?: string | null;
  formats?: ReportFormat[];
}

// ── HTTP helpers ────────────────────────────────────────────────────────

/** supabase 세션 access_token → Bearer 헤더. 세션 없으면 throw (백엔드 401 선제). */
async function authHeader(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error("로그인이 필요합니다. (Supabase 세션 없음)");
  }
  return { Authorization: `Bearer ${token}` };
}

class ReportApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ReportApiError";
    this.status = status;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const auth = await authHeader();
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // body stream 은 한 번만 소비 가능 — text() 로 받고 JSON 시도.
    let detail = "";
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const j = JSON.parse(raw);
          detail =
            typeof j.detail === "string"
              ? j.detail
              : typeof j.message === "string"
                ? j.message
                : JSON.stringify(j.detail ?? j);
        } catch {
          detail = raw;
        }
      }
    } catch {
      // body 읽기 실패 — statusText 만
    }
    throw new ReportApiError(
      res.status,
      `HTTP ${res.status}: ${detail || res.statusText}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── API surface ─────────────────────────────────────────────────────────

export function listRuns(limit = 100): Promise<{ runs: ReportRun[] }> {
  return request(`${ROOT}/runs?limit=${limit}`);
}

export function getRun(runId: string): Promise<RunDetail> {
  return request(`${ROOT}/runs/${runId}`);
}

/** 202 {run_id} — 백그라운드 실행. 재발송 버튼 = 동일 조건 재생성. 429 = in-flight 존재. */
export function generateReport(body: GenerateRequest): Promise<GenerateResponse> {
  return request(`${ROOT}/generate`, { method: "POST", body: JSON.stringify(body) });
}

export function getTemplates(): Promise<TemplatesResponse> {
  return request(`${ROOT}/templates`);
}

export function listSchedules(): Promise<{ schedules: ReportSchedule[] }> {
  return request(`${ROOT}/schedules`);
}

/** 201 — 서버가 next_run_at 계산(Asia/Seoul). 응답은 insert row (last_* 없음). */
export function createSchedule(
  body: ScheduleCreate,
): Promise<Partial<ReportSchedule> & { id: string }> {
  return request(`${ROOT}/schedules`, { method: "POST", body: JSON.stringify(body) });
}

export function patchSchedule(
  sid: string,
  body: SchedulePatch,
): Promise<ReportSchedule> {
  return request(`${ROOT}/schedules/${sid}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteSchedule(sid: string): Promise<{ deleted: string }> {
  return request(`${ROOT}/schedules/${sid}`, { method: "DELETE" });
}

// ── 회사 리포트 표현 설정 (데스크톱이 소유·관리 → 백엔드가 수신·소비) ──────────
// tz/locale/industry 등 고객사색은 여기서 관리하고, 백엔드(report-service)는 이 값을
// 스케줄 tz·합성 언어·온톨로지 업종에 소비한다. 코드/DB 기본값은 중립(UTC/en).

/** report_tenant_settings row — 백엔드 GET/PUT /settings 와 1:1 */
export interface TenantSettings {
  /** IANA tz — cron 해석·'어제' 기준일 (예: "Asia/Seoul"). 중립 기본 "UTC" */
  timezone: string;
  /** 리포트/프롬프트 언어 (예: "ko"). 중립 기본 "en" */
  locale: string;
  default_persona: Persona | null;
  default_formats: ReportFormat[];
  /** 페르소나 문구 얕은 병합 (제목/섹션) */
  persona_overrides: Record<string, unknown> | null;
  /** 리포트 헤더 표시명/로고 등 */
  branding: Record<string, unknown> | null;
}

/** PUT /settings body — 부분 갱신(제공한 필드만 upsert) */
export type TenantSettingsPatch = Partial<TenantSettings>;

/** GET /settings — 회사 표현 설정 (행 없으면 백엔드가 중립 기본값 반환) */
export function getTenantSettings(): Promise<TenantSettings> {
  return request(`${ROOT}/settings`);
}

/** PUT /settings — 부분 upsert. 반환 = 갱신 후 전체 설정 */
export function putTenantSettings(
  body: TenantSettingsPatch,
): Promise<TenantSettings> {
  return request(`${ROOT}/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
