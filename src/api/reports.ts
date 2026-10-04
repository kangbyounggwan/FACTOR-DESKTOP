/**
 * factor-desktop 자체 API client — report-plugin 의 /api/reports/v1.
 *
 * 컨벤션: BASE_URL env → ROOT, 타입 = 백엔드 1:1, request<T> 헬퍼.
 * 모든 요청에 supabase 세션 access_token 을 `Authorization: Bearer` 로
 * 첨부 — 백엔드는 Principal 필수 (legacy 불허).
 *
 * 응답 shape 은 report-plugin/backend_router.py · service.py · core/models.py
 * (RunRecord/record_run/ScheduleCreate/SchedulePatch) 를 미러.
 *
 * 시트(`/sheets`, 채팅 보고서 패널 · 디자이너) 는 공유 leaf `@/features/reports/designer/core` 의
 * `createSheetApi` 에 데스크탑 env·세션을 꽂은 `sheetApi` 인스턴스를 쓴다 — leaf 는 env/supabase
 * 를 직접 읽지 않는다(R7). 타입은 여기서 re-export 해 데스크탑 코드가 한 모듈만 보게 한다.
 * 이 모듈은 셸(DesktopShell → ChatPage) 초기 번들에 들어가므로 barrel(index.ts) 이 아니라 core 만 import —
 * 디자이너 UI(gridstack JS/CSS 등 side-effect import) 가 초기 번들에 실리지 않게 한다.
 * 디자이너 탭(ReportsDesignerTab) 도 여기 `sheetApi`·`REPORT_KEYS` 를 쓴다 — 인스턴스·env 폴백·캐시 키 단일.
 */

import { supabase } from "@/lib/supabase";
import {
  createSheetApi,
  DEFAULT_REPORT_SERVICE_URL,
  type PreviewMode,
  type SheetApi,
  type SheetTemplate,
} from "@/features/reports/designer/core";

/**
 * report-service origin. env 미설정/빈 문자열이면 공유 leaf 의 기본값(127.0.0.1:8010) —
 * 두 곳(여기·leaf) 의 기본값이 어긋나지 않게 상수를 공유한다.
 */
export const REPORT_SERVICE_BASE_URL: string =
  (import.meta.env.VITE_REPORT_SERVICE_URL as string | undefined) ||
  DEFAULT_REPORT_SERVICE_URL;

const BASE_URL = REPORT_SERVICE_BASE_URL;

const ROOT = `${BASE_URL.replace(/\/$/, "")}/api/reports/v1`;

// ── 시트(보고서 시트 디자이너 · 채팅 보고서 패널) — 공유 leaf 타입 re-export ───────────

export type {
  SheetTemplate,
  BlockSpec,
  BlockPos,
  SheetDiff,
  SheetStatus,
  SheetVisibility,
  PreviewMode,
  SheetBudget,
  SheetPointer,
  ReportSheetEvent,
  ReportContext,
  SheetOp,
  VizType,
  SheetApi,
  SheetSummary,
  SheetListParams,
  SheetListResponse,
  SheetCreate,
  SheetUpdate,
  CatalogSource,
  SheetCatalog,
  SheetOpsResult,
  SheetPreview,
  PreviewOptions,
  SheetVersion,
  SheetVersionsResponse,
} from "@/features/reports/designer/core";
export { SheetApiError, SheetConflictError, isSheetConflict } from "@/features/reports/designer/core";

/** supabase 세션 access_token — 없으면 null(헤더 생략, 서버가 401 결정). throw 하지 않는다 */
async function sheetAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** report-service `/api/reports/v1/sheets` 클라이언트 — 데스크탑 단일 인스턴스 */
export const sheetApi: SheetApi = createSheetApi({
  baseUrl: BASE_URL,
  getToken: sheetAccessToken,
});

/** Save only the version currently displayed, using the shared sheet transport. */
export function saveReportSheet(id: string, version: number): Promise<SheetTemplate> {
  if (!Number.isInteger(version) || version < 0) return Promise.reject(new Error("Invalid sheet version"));
  return createSheetApi({
    baseUrl: BASE_URL,
    getToken: sheetAccessToken,
    fetchImpl: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("If-Match", String(version));
      return fetch(input, { ...init, headers });
    },
  }).applySheet(id);
}

/**
 * React Query 키 — 시트 관련. (runs/templates/schedules 키는
 * features/settings/sections/reports/useReports.ts 의 로컬 REPORT_KEYS 가 관리 — 접두 "reports" 공유.)
 */
export const REPORT_KEYS = {
  all: ["reports"] as const,
  /** GET /sheets 목록 */
  sheets: ["reports", "sheets"] as const,
  /** GET /sheets/{id} — version 을 키에 넣어 버전이 바뀐 뒤 stale 템플릿이 재사용되지 않게 */
  sheet: (id: string, version?: number | null) =>
    ["reports", "sheet", id, version ?? "latest"] as const,
  /** POST /sheets/{id}/preview — (id, version, mode) 별 캐시 */
  sheetPreview: (id: string, version: number | null, mode: PreviewMode) =>
    ["reports", "sheetPreview", id, version, mode] as const,
  /** GET /sheets/catalog */
  sheetCatalog: ["reports", "sheetCatalog"] as const,
};

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
  /** [startDate, endDate] ISO — 생성 탭이 항상 전송(미전송 시 백엔드가 '어제' 고정) */
  period?: [string, string] | null;
  /**
   * 보고서 시트 템플릿 id(마이그 097 `report_runs.sheet_template_id`). 지정 시 persona 플래너 대신
   * 시트 렌더러(같은 renderer = 미리보기) 로 PDF/PPTX 생성 — 채팅 보고서 패널 PDF 버튼이 사용.
   */
  sheet_template_id?: string | null;
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

export interface AccountReportFormat {
  configured: boolean;
  reason?: "unassigned" | "unavailable";
  sheet_id?: string;
  version?: number;
  name?: string;
  default_format?: { key: "eis_executive"; name: string; version: number };
}

export interface ReportRecommendation {
  id: string;
  title: string;
  excerpt: string;
  as_of: string | null;
  cards_count: number;
}

export interface ReportContentMission {
  id: string;
  topic: string;
  label: string;
  question: string;
  excerpt: string;
  scope: string;
  source_label: string;
  as_of: string | null;
}

export const accountReportApi = {
  getFormat: () => request<AccountReportFormat>(`${ROOT}/sheets/account-format`),
  setFormat: (sheetId: string | null) => request<AccountReportFormat>(`${ROOT}/sheets/account-format`, {
    method: "PUT", body: JSON.stringify({ sheet_id: sheetId }),
  }),
  contentMissions: (sheetId: string, conversationId: string) => request<{ items: ReportContentMission[] }>(
    `${ROOT}/sheets/${encodeURIComponent(sheetId)}/content-missions?conversation_id=${encodeURIComponent(conversationId)}`),
  addContentMission: (sheetId: string, conversationId: string, missionId: string, version: number) => request<{
    sheet: Partial<SheetTemplate>; template: SheetTemplate; warnings: string[]; diff: import("@/features/reports/designer/core").SheetDiff;
  }>(`${ROOT}/sheets/${encodeURIComponent(sheetId)}/content-missions`, {
    method: "POST", headers: { "If-Match": String(version) },
    body: JSON.stringify({ conversation_id: conversationId, mission_id: missionId }),
  }),
  recommendations: (conversationId: string) => request<{ items: ReportRecommendation[] }>(
    `${ROOT}/sheets/recommendations?conversation_id=${encodeURIComponent(conversationId)}`),
  applyRecommendations: (conversationId: string, selectedIds: string[]) => request<{
    sheet: Partial<SheetTemplate>; template: SheetTemplate; warnings: string[];
  }>(`${ROOT}/sheets/from-recommendations`, {
    method: "POST", body: JSON.stringify({ conversation_id: conversationId, selected_ids: selectedIds }),
  }),
};

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
