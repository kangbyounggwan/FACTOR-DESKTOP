/**
 * 보고서 관리 — 라벨/상태/시간 포맷 공용 헬퍼.
 *
 * 백엔드 실측 값 기준 매핑 (디자인 F7~F12 의 가상 값과 다름):
 *   persona(유형)  executive/manager/operator → 임원/관리자/실무자
 *   status(상태)   succeeded=성공(초록) failed=실패(빨강)
 *                  running·queued=진행 중(노랑) partial=부분(주황)
 */

import type {
  Persona,
  PersonaTemplate,
  ReportRun,
  RunStatus,
  SectionStatus,
} from "@desktop/api/reports";

export const PERSONA_LABEL: Record<Persona, string> = {
  executive: "임원",
  manager: "관리자",
  operator: "실무자",
};

export const PERSONAS_ORDER: Persona[] = ["executive", "manager", "operator"];

/** 템플릿 표시명 — title_format 의 " ({period})" 골격 제거. */
export function templateDisplayName(
  persona: Persona,
  tpl?: PersonaTemplate,
): string {
  const raw = tpl?.title_format?.replace(/\s*\(\{period\}\)\s*/g, "").trim();
  return raw || `${PERSONA_LABEL[persona]} 리포트`;
}

/** run 표시명 — plan.title 우선, 없으면 페르소나 기반. */
export function runDisplayName(run: ReportRun): string {
  return run.plan?.title || `${PERSONA_LABEL[run.persona]} 리포트`;
}

export interface StatusMeta {
  label: string;
  dot: string; // dot 색
  text: string; // 라벨 텍스트 색
}

export const RUN_STATUS_META: Record<RunStatus, StatusMeta> = {
  succeeded: { label: "성공", dot: "bg-emerald-400", text: "text-emerald-300" },
  failed: { label: "실패", dot: "bg-red-400", text: "text-red-300" },
  running: { label: "진행 중", dot: "bg-amber-400", text: "text-amber-300" },
  queued: { label: "진행 중", dot: "bg-amber-400", text: "text-amber-300" },
  partial: { label: "부분", dot: "bg-orange-400", text: "text-orange-300" },
};

export const SECTION_STATUS_META: Record<SectionStatus, StatusMeta> = {
  ok: { label: "정상", dot: "bg-emerald-400", text: "text-emerald-300" },
  partial: { label: "부분", dot: "bg-orange-400", text: "text-orange-300" },
  failed: { label: "실패", dot: "bg-red-400", text: "text-red-300" },
  skipped: { label: "생략", dot: "bg-foreground/30", text: "text-foreground/50" },
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "MM-DD HH:mm" — 목록/요약용. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** "YYYY-MM-DD (요일) HH:mm" — 뷰어 헤더용. */
export function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} (${WEEKDAY_KO[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 이번 주(월요일 00:00, 로컬) 시작 시각. */
export function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0=일
  const diff = day === 0 ? 6 : day - 1; // 월요일 기준
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── cron 헬퍼 — "분 시 * * *" 형태의 단순 케이스만 사람 친화 라벨 ──────────

export type CronMode = "daily" | "weekly" | "custom";

export interface ParsedCron {
  mode: CronMode;
  /** "HH:MM" — daily/weekly 에서만 의미 */
  time: string;
  /** 0(일)~6(토) — weekly 에서만 의미 */
  weekday: number;
  raw: string;
}

export function parseCron(cron: string): ParsedCron {
  const fallback: ParsedCron = { mode: "custom", time: "08:00", weekday: 1, raw: cron };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return fallback;
  const [min, hour, dom, mon, dow] = parts;
  if (!/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour)) return fallback;
  if (dom !== "*" || mon !== "*") return fallback;
  const time = `${pad2(Number(hour))}:${pad2(Number(min))}`;
  if (dow === "*") return { mode: "daily", time, weekday: 1, raw: cron };
  if (/^[0-6]$/.test(dow)) {
    return { mode: "weekly", time, weekday: Number(dow), raw: cron };
  }
  return fallback;
}

export function buildCron(mode: CronMode, time: string, weekday: number): string {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(time.trim());
  const hh = m ? Number(m[1]) : 8;
  const mm = m ? Number(m[2]) : 0;
  if (mode === "weekly") return `${mm} ${hh} * * ${weekday}`;
  return `${mm} ${hh} * * *`;
}

/** cron → "매일 08:10" / "매주 월 08:00" / raw cron. */
export function cronToLabel(cron: string | null | undefined): string {
  if (!cron) return "미설정";
  const p = parseCron(cron);
  if (p.mode === "daily") return `매일 ${p.time}`;
  if (p.mode === "weekly") return `매주 ${WEEKDAY_KO[p.weekday]} ${p.time}`;
  return cron;
}

/** 주기 칩 — "일일" / "주간" / "커스텀". */
export function cronCycleLabel(cron: string | null | undefined): string | null {
  if (!cron) return null;
  const p = parseCron(cron);
  if (p.mode === "daily") return "일일";
  if (p.mode === "weekly") return "주간";
  return "커스텀";
}
