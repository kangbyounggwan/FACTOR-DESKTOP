/**
 * 보고서 관리 — [이력] 탭 (F7).
 *
 * 요약 strip 4개 + 이력 테이블. 백엔드 매핑:
 *   · 총 생성 = 전체 runs / 이번 주 = 월요일 이후 / 실패 = status=failed
 *   · 다음 예약 = enabled 스케줄의 최소 next_run_at
 *   · "수신자" 컬럼은 백엔드 미구현 → formats 뱃지로 대체
 *   · PDF 액션 = GET /runs/{id} 후 download.pdf window.open
 *   · 재발송 = POST /generate (동일 persona·request_text 재생성)
 */
import { memo, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { getRun, type ReportRun } from "@desktop/api/reports";

import {
  PERSONA_LABEL,
  RUN_STATUS_META,
  formatDateTime,
  runDisplayName,
  startOfWeek,
} from "./meta";
import {
  useGenerateReport,
  useReportRuns,
  useReportSchedules,
} from "./useReports";

interface Props {
  onOpenRun: (runId: string) => void;
}

export const ReportsHistoryTab = memo(function ReportsHistoryTab({
  onOpenRun,
}: Props) {
  const { toast } = useToast();
  const runsQuery = useReportRuns();
  const schedulesQuery = useReportSchedules();
  const generateMutation = useGenerateReport();
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const runs = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data]);

  const summary = useMemo(() => {
    const weekStart = startOfWeek().getTime();
    const thisWeek = runs.filter(
      (r) => new Date(r.created_at).getTime() >= weekStart,
    ).length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const nextRunAt = (schedulesQuery.data?.schedules ?? [])
      .filter((s) => s.enabled && s.next_run_at)
      .map((s) => s.next_run_at as string)
      .sort()[0];
    return { total: runs.length, thisWeek, failed, nextRunAt };
  }, [runs, schedulesQuery.data]);

  const handleOpenPdf = async (run: ReportRun) => {
    setPdfLoadingId(run.id);
    try {
      const detail = await getRun(run.id);
      const url = detail.download.pdf;
      if (!url) {
        toast({
          title: "PDF 없음",
          description: "이 리포트에는 다운로드 가능한 PDF 산출물이 없습니다.",
          variant: "destructive",
        });
        return;
      }
      window.open(url, "_blank");
    } catch (e) {
      toast({
        title: "PDF 다운로드 실패",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleResend = (run: ReportRun) => {
    const formats = Object.keys(run.artifacts ?? {});
    generateMutation.mutate(
      {
        persona: run.persona,
        request_text: run.request_text,
        ...(formats.length > 0
          ? { formats: formats as ("pdf" | "html" | "pptx")[] }
          : {}),
      },
      {
        onSuccess: () => {
          toast({
            title: "재발송 시작",
            description: "리포트 재생성을 시작했습니다. 완료까지 수 분 걸릴 수 있습니다.",
          });
        },
        onError: (error) => {
          const msg = error instanceof Error ? error.message : String(error);
          toast({
            title: "재발송 실패",
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
    <div className="space-y-5">
      {/* ── 요약 strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="총 생성" value={`${summary.total}건`} />
        <SummaryCard label="이번 주" value={`${summary.thisWeek}건`} />
        <SummaryCard
          label="생성 실패"
          value={`${summary.failed}건`}
          tint={summary.failed > 0 ? "text-red-400" : undefined}
        />
        <SummaryCard
          label="다음 예약"
          value={summary.nextRunAt ? formatDateTime(summary.nextRunAt) : "—"}
        />
      </div>

      {/* ── 이력 테이블 ── */}
      {runsQuery.isLoading ? (
        <SkeletonRows />
      ) : runsQuery.isError ? (
        <ErrorBox
          message={
            runsQuery.error instanceof Error
              ? runsQuery.error.message
              : String(runsQuery.error)
          }
        />
      ) : runs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col />
              <col className="w-[72px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[84px]" />
              <col className="w-[118px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <ColHeader>보고서명</ColHeader>
                <ColHeader>유형</ColHeader>
                <ColHeader>생성일시</ColHeader>
                <ColHeader>포맷</ColHeader>
                <ColHeader>상태</ColHeader>
                <ColHeader>액션</ColHeader>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const status = RUN_STATUS_META[run.status];
                const formats = Object.keys(run.artifacts ?? {});
                const inProgress =
                  run.status === "queued" || run.status === "running";
                return (
                  <tr
                    key={run.id}
                    onClick={() => onOpenRun(run.id)}
                    className="border-b border-border/30 last:border-b-0 hover:bg-foreground/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5 min-w-0">
                      <div className="ui-fs-xs text-foreground font-medium tracking-tight truncate">
                        {runDisplayName(run)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 ui-fs-xs text-foreground/70">
                      {PERSONA_LABEL[run.persona]}
                    </td>
                    <td className="px-4 py-2.5 ui-fs-xs font-mono tabular-nums text-foreground/60">
                      {formatDateTime(run.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      {formats.length === 0 ? (
                        <span className="ui-fs-xs text-foreground/35">—</span>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          {formats.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded ui-fs-2xs uppercase tracking-wide font-medium bg-foreground/[0.06] text-foreground/70 border border-border/40"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0",
                            status.dot,
                            inProgress && "animate-pulse",
                          )}
                        />
                        <span className={cn("ui-fs-xs", status.text)}>
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div
                        className="flex items-center gap-1 ui-fs-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => void handleOpenPdf(run)}
                          disabled={!run.artifacts?.pdf || pdfLoadingId === run.id}
                          className={cn(
                            "text-primary hover:underline underline-offset-2 disabled:text-foreground/30 disabled:no-underline disabled:cursor-not-allowed",
                          )}
                        >
                          {pdfLoadingId === run.id ? (
                            <Loader2 className="h-3 w-3 animate-spin inline" />
                          ) : (
                            "PDF"
                          )}
                        </button>
                        <span className="text-foreground/25">·</span>
                        <button
                          type="button"
                          onClick={() => handleResend(run)}
                          disabled={generateMutation.isPending || inProgress}
                          className="text-primary hover:underline underline-offset-2 disabled:text-foreground/30 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          재발송
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

// ── Sub-components ───────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-foreground/[0.025] px-4 py-3">
      <div className="ui-fs-xs text-muted-foreground/70 font-medium tracking-tight">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 ui-fs-lg font-semibold tabular-nums leading-none tracking-tight",
          tint ?? "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 ui-fs-xs uppercase tracking-[0.12em] text-muted-foreground/65 font-medium text-left">
      {children}
    </th>
  );
}

function SkeletonRows() {
  return (
    <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
      <div className="divide-y divide-border/30">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
            <div className="h-3 flex-1 bg-foreground/[0.06] rounded" />
            <div className="h-3 w-12 bg-foreground/[0.05] rounded" />
            <div className="h-3 w-20 bg-foreground/[0.05] rounded" />
            <div className="h-3 w-14 bg-foreground/[0.04] rounded" />
            <div className="h-3 w-16 bg-foreground/[0.04] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-foreground/[0.015] px-6 py-12 text-center">
      <p className="text-xs text-foreground/65">생성된 리포트가 없습니다.</p>
      <p className="ui-fs-xs text-muted-foreground/60 mt-1">
        [포맷] 탭에서 발송 예약을 설정하면 자동으로 생성됩니다.
      </p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
      <p className="ui-caption ui-tone-bad">
        이력을 불러오지 못했습니다: {message}
      </p>
      <p className="ui-fs-xs text-muted-foreground/60 mt-1">
        리포트 서비스(VITE_REPORT_SERVICE_URL) 연결과 로그인 상태를 확인하세요.
      </p>
    </div>
  );
}
