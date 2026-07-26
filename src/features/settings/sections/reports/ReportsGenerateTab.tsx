/**
 * 보고서 관리 — [생성] 탭.
 *
 * AI 리포트 생성(정형 폼): 페르소나 + 기간 + 포맷 → POST /generate. 성공 시 run_id 로
 * 뷰어(폴링)를 열어 진행 상황을 보여준다. (백엔드 계약: 202+run_id → GET /runs/{id} 폴링.)
 * PoC 는 정형 컨트롤만 — 자유 텍스트/대상 라인 지정은 후속(사용자 의견 반영). 기간을 반드시
 * 전송한다(미전송 시 백엔드가 '어제'로 고정되던 문제 해소).
 */
import { memo, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type { Persona, ReportFormat } from "@desktop/api/reports";

import { PERSONA_LABEL, PERSONAS_ORDER, templateDisplayName } from "./meta";
import { useGenerateReport, useReportTemplates } from "./useReports";

interface Props {
  onOpenRun: (runId: string) => void;
}

const PERSONA_DESC: Record<Persona, string> = {
  executive: "생산 실적 요약 — 계획·실적·준수율·가동률 + 설비·품질·예측·개선방안",
  manager: "공정 이상·불량 원인 분석 — 라인/공정 비교 + 조치 항목",
  operator: "품질 이상 알람 브리핑 — 알람 현황 + 우선순위별 조치 권고",
};

const ALL_FORMATS: ReportFormat[] = ["pdf", "html", "pptx"];

type PeriodKey = "yesterday" | "today" | "this_week" | "last_week";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "yesterday", label: "어제" },
  { key: "today", label: "오늘" },
  { key: "this_week", label: "이번 주" },
  { key: "last_week", label: "지난 주" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 선택 기간 → [startDate, endDate] ISO. 로컬(≈KST) 기준 계산 — 백엔드가 tenant tz 로 재해석. */
function periodRange(key: PeriodKey): [string, string] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const mondayOffset = (base.getDay() + 6) % 7; // 월요일=0
  if (key === "today") return [iso(base), iso(base)];
  if (key === "yesterday") {
    const y = new Date(base);
    y.setDate(base.getDate() - 1);
    return [iso(y), iso(y)];
  }
  if (key === "this_week") {
    const mon = new Date(base);
    mon.setDate(base.getDate() - mondayOffset);
    return [iso(mon), iso(base)];
  }
  // last_week
  const mon = new Date(base);
  mon.setDate(base.getDate() - mondayOffset - 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [iso(mon), iso(sun)];
}

export const ReportsGenerateTab = memo(function ReportsGenerateTab({
  onOpenRun,
}: Props) {
  const { toast } = useToast();
  const templatesQuery = useReportTemplates();
  const generateMutation = useGenerateReport();

  const [persona, setPersona] = useState<Persona>("executive");
  const [period, setPeriod] = useState<PeriodKey>("yesterday");
  const [formats, setFormats] = useState<ReportFormat[]>(["pdf"]);

  const tpl = templatesQuery.data?.[persona];
  const sections = useMemo(
    () => (tpl?.sections ?? []).filter((s) => s.source !== "synth" || s.required),
    [tpl],
  );

  const toggleFormat = (f: ReportFormat) =>
    setFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );

  const handleGenerate = () => {
    if (formats.length === 0) {
      toast({ title: "출력 포맷을 하나 이상 선택하세요.", variant: "destructive" });
      return;
    }
    generateMutation.mutate(
      { persona, period: periodRange(period), formats },
      {
        onSuccess: (res) => {
          toast({
            title: "리포트 생성 시작",
            description: "AI가 MES 데이터를 분석 중입니다. 완료까지 수 분 걸릴 수 있습니다.",
          });
          onOpenRun(res.run_id); // 뷰어(폴링)로 진입
        },
        onError: (error) => {
          const msg = error instanceof Error ? error.message : String(error);
          toast({
            title: "생성 실패",
            description: msg.includes("429")
              ? "이미 생성 중인 리포트가 있습니다. 완료 후 다시 시도하세요."
              : msg,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* ── 페르소나 선택 ── */}
      <section className="space-y-2.5">
        <SectionLabel>리포트 유형</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {PERSONAS_ORDER.map((p) => {
            const active = persona === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPersona(p)}
                className={cn(
                  "text-left rounded-lg border px-4 py-3 transition-colors",
                  active
                    ? "border-primary/60 bg-primary/[0.06]"
                    : "border-border/40 bg-foreground/[0.02] hover:border-border/70",
                )}
              >
                <div className="ui-fs-sm font-semibold tracking-tight text-foreground">
                  {PERSONA_LABEL[p]}
                </div>
                <div className="mt-1 ui-fs-2xs leading-relaxed text-muted-foreground/70">
                  {PERSONA_DESC[p]}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 섹션 구성 미리보기 ── */}
      <section className="space-y-2.5">
        <SectionLabel>
          포함 섹션
          <span className="ml-1.5 text-muted-foreground/50 normal-case tracking-normal font-normal">
            · {templateDisplayName(persona, tpl)}
          </span>
        </SectionLabel>
        {templatesQuery.isLoading ? (
          <div className="ui-fs-xs text-muted-foreground/60">불러오는 중…</div>
        ) : sections.length === 0 ? (
          <div className="ui-fs-xs text-muted-foreground/60">섹션 정보 없음</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sections.map((s) => (
              <span
                key={s.key}
                className="px-2.5 py-1 rounded-md ui-fs-xs bg-foreground/[0.04] border border-border/40 text-foreground/75"
              >
                {s.heading}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── 기간 ── */}
      <section className="space-y-2.5">
        <SectionLabel>
          기간
          <span className="ml-1.5 text-muted-foreground/50 normal-case tracking-normal font-normal">
            · {periodRange(period)[0]} ~ {periodRange(period)[1]}
          </span>
        </SectionLabel>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => {
            const on = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-md ui-fs-xs font-medium border transition-colors",
                  on
                    ? "border-primary/60 bg-primary/[0.08] text-foreground"
                    : "border-border/40 bg-foreground/[0.02] text-foreground/55 hover:text-foreground/85",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 출력 포맷 ── */}
      <section className="space-y-2.5">
        <SectionLabel>출력 포맷</SectionLabel>
        <div className="flex items-center gap-2">
          {ALL_FORMATS.map((f) => {
            const on = formats.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md ui-fs-xs uppercase tracking-wide font-medium border transition-colors",
                  on
                    ? "border-primary/60 bg-primary/[0.08] text-foreground"
                    : "border-border/40 bg-foreground/[0.02] text-foreground/50 hover:text-foreground/80",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 생성 ── */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="h-10 px-5 ui-fs-sm"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          리포트 생성
        </Button>
        <p className="ui-fs-xs text-muted-foreground/55 leading-relaxed">
          AI가 MES 데이터를 수집·분석해 리포트를 생성합니다.
        </p>
      </div>
    </div>
  );
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-fs-xs uppercase tracking-[0.12em] text-muted-foreground/65 font-medium">
      {children}
    </div>
  );
}
