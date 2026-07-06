/**
 * React Query hooks — 보고서 관리 (runs/templates/schedules + 수신자).
 *
 * runs/templates/schedules 는 report-plugin 백엔드(@desktop/api/reports),
 * 수신자는 supabase 직접 CRUD (테이블 report_recipients, 마이그 070 —
 * RLS same-company). company_id 는 profiles 조회로 채운다 (JWT 에
 * company_id claim 없음 — 마이그 061/063 과 동일 전제).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

import {
  createSchedule,
  deleteSchedule,
  generateReport,
  getRun,
  getTemplates,
  getTenantSettings,
  listRuns,
  listSchedules,
  patchSchedule,
  putTenantSettings,
  type GenerateRequest,
  type Persona,
  type ReportSchedule,
  type ScheduleCreate,
  type SchedulePatch,
  type TenantSettingsPatch,
} from "@desktop/api/reports";

// report_recipients 는 생성 타입(Database)에 아직 없다(마이그 070 신규) —
// 타입드 클라이언트의 테이블명 유니온을 우회하기 위해 untyped 로 좁혀 사용.
const sb = supabase as unknown as SupabaseClient;

export const REPORT_KEYS = {
  all: ["reports"] as const,
  runs: ["reports", "runs"] as const,
  run: (id: string) => ["reports", "run", id] as const,
  templates: ["reports", "templates"] as const,
  schedules: ["reports", "schedules"] as const,
  recipients: ["reports", "recipients"] as const,
  settings: ["reports", "settings"] as const,
};

// ── runs ────────────────────────────────────────────────────────────────

export function useReportRuns() {
  return useQuery({
    queryKey: REPORT_KEYS.runs,
    queryFn: () => listRuns(100),
    refetchInterval: 30_000, // 진행 중(queued/running) run 상태 모니터링
    staleTime: 10_000,
  });
}

export function useReportRun(runId: string | null) {
  return useQuery({
    queryKey: REPORT_KEYS.run(runId ?? ""),
    queryFn: () => getRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const s = query.state.data?.run?.status;
      return s === "queued" || s === "running" ? 5_000 : false;
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateRequest) => generateReport(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.runs }),
  });
}

// ── 회사 표현 설정 (데스크톱 소유 → 백엔드 수신) ──────────────────────────

/** GET /settings — 회사 리포트 표현 설정 (tz/locale/persona/formats/branding) */
export function useTenantSettings() {
  return useQuery({
    queryKey: REPORT_KEYS.settings,
    queryFn: getTenantSettings,
    staleTime: 30_000,
  });
}

/** PUT /settings — 부분 upsert */
export function usePutTenantSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TenantSettingsPatch) => putTenantSettings(body),
    onSuccess: (data) => qc.setQueryData(REPORT_KEYS.settings, data),
  });
}

// ── templates / schedules ───────────────────────────────────────────────

export function useReportTemplates() {
  return useQuery({
    queryKey: REPORT_KEYS.templates,
    queryFn: getTemplates,
    staleTime: Infinity, // 정적 코드 데이터
  });
}

export function useReportSchedules() {
  return useQuery({
    queryKey: REPORT_KEYS.schedules,
    queryFn: listSchedules,
    staleTime: 10_000,
  });
}

export function useCreateReportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleCreate) => createSchedule(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.schedules }),
  });
}

export function usePatchReportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SchedulePatch }) =>
      patchSchedule(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.schedules }),
  });
}

export function useDeleteReportSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.schedules }),
  });
}

/** persona → 해당 스케줄 (백엔드는 다건 허용하나 UI 는 페르소나당 1건 관리). */
export function scheduleForPersona(
  schedules: ReportSchedule[] | undefined,
  persona: Persona,
): ReportSchedule | undefined {
  return schedules?.find((s) => s.persona === persona);
}

// ── 수신자 (report_recipients — supabase 직접 CRUD) ─────────────────────

export interface ReportRecipient {
  id: string;
  company_id: string;
  name: string;
  email: string;
  role: string;
  subscribed_templates: Persona[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipientInput {
  name: string;
  email: string;
  role: string;
  subscribed_templates: Persona[];
}

/** 현재 로그인 사용자의 company_id — profiles 조회 (RLS WITH CHECK 대비 필수). */
async function fetchMyCompanyId(): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("로그인이 필요합니다.");
  const { data, error } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const companyId = (data as { company_id: string | null } | null)?.company_id;
  if (!companyId) throw new Error("소속 회사 정보가 없습니다. 관리자에게 문의하세요.");
  return companyId;
}

export function useReportRecipients() {
  return useQuery({
    queryKey: REPORT_KEYS.recipients,
    queryFn: async (): Promise<ReportRecipient[]> => {
      const { data, error } = await sb
        .from("report_recipients")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReportRecipient[];
    },
  });
}

export function useCreateRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipientInput): Promise<void> => {
      const company_id = await fetchMyCompanyId();
      const { error } = await sb
        .from("report_recipients")
        .insert({ ...input, company_id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.recipients }),
  });
}

export function useUpdateRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<RecipientInput> & { enabled?: boolean };
    }): Promise<void> => {
      const { error } = await sb
        .from("report_recipients")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.recipients }),
  });
}

export function useDeleteRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await sb.from("report_recipients").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REPORT_KEYS.recipients }),
  });
}

/** persona 를 구독하는 수신자들의 역할 목록 (중복 제거) — 수신 그룹 칩용. */
export function rolesForPersona(
  recipients: ReportRecipient[] | undefined,
  persona: Persona,
): string[] {
  const roles: string[] = [];
  for (const r of recipients ?? []) {
    if (!r.enabled) continue;
    if (!(r.subscribed_templates ?? []).includes(persona)) continue;
    if (!roles.includes(r.role)) roles.push(r.role);
  }
  return roles;
}
