/**
 * 보고서 뷰어 — 마스터-디테일 (F12).
 *
 * 좌측: 발송 이력 리스트 (선택 강조) / 우측: 보고서 문서 카드.
 * 우측 본문은 run row 의 실측 필드(status·section_results·notes·report 캐시)로만
 * 구성 — KPI 차트 mock 금지. 본문 데이터가 없으면 "PDF에서 확인" 안내 + PDF 버튼.
 */
import { memo, useMemo } from "react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { ArrowLeft, Download, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type { ReportSection } from "@desktop/api/reports";

import {
  PERSONA_LABEL,
  RUN_STATUS_META,
  SECTION_STATUS_META,
  formatDateTime,
  formatFullDateTime,
  runDisplayName,
} from "./meta";
import { useGenerateReport, useReportRun, useReportRuns } from "./useReports";

interface Props {
  runId: string;
  onSelectRun: (runId: string) => void;
  onClose: () => void;
}

const SECTION_TYPE_LABEL: Record<ReportSection["type"], string> = {
  text: "텍스트",
  table: "표",
  list: "목록",
  chart: "차트",
  stats: "통계",
  image: "화면 캡처",
};

export const ReportViewerPanel = memo(function ReportViewerPanel({
  runId,
  onSelectRun,
  onClose,
}: Props) {
  const { toast } = useToast();
  const runsQuery = useReportRuns();
  const detailQuery = useReportRun(runId);
  const generateMutation = useGenerateReport();

  const runs = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data]);
  const detail = detailQuery.data;
  const run = detail?.run ?? runs.find((r) => r.id === runId);

  const handlePdf = () => {
    const url = detail?.download.pdf;
    if (!url) {
      toast({
        title: "PDF 없음",
        description: "이 리포트에는 다운로드 가능한 PDF 산출물이 없습니다.",
        variant: "destructive",
      });
      return;
    }
    window.open(url, "_blank");
  };

  const handleResend = () => {
    if (!run) return;
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
        onSuccess: () =>
          toast({
            title: "재발송 시작",
            description: "리포트 재생성을 시작했습니다.",
          }),
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
    <div className="h-full min-h-0 flex">
      {/* ── 좌측: 발송 이력 리스트 ── */}
      <aside className="w-[300px] flex-shrink-0 border-r border-border/40 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <button
            type="button"
            onClick={onClose}
            title="이력 탭으로"
            aria-label="뒤로"
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="ui-fs-sm font-semibold tracking-tight text-foreground">
            발송 이력
          </span>
          <span className="ml-auto ui-fs-xs text-foreground/45 font-mono tabular-nums">
            전체 {runs.length}건
          </span>
        </div>
        <SimpleBar className="flex-1 min-h-0">
          <div className="p-2 flex flex-col gap-1">
            {runs.map((r) => {
              const active = r.id === runId;
              const status = RUN_STATUS_META[r.status];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRun(r.id)}
                  className={cn(
                    "relative w-full text-left rounded-md px-3 py-2.5 transition-colors",
                    active
                      ? "bg-primary/[0.08]"
                      : "hover:bg-foreground/[0.03]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full",
                      active ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-xs font-medium tracking-tight truncate",
                          active ? "text-primary" : "text-foreground/85",
                        )}
                      >
                        {runDisplayName(r)}
                      </div>
                      <div className="ui-fs-xs font-mono tabular-nums text-foreground/50 mt-0.5">
                        {formatDateTime(r.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      <span className={cn("ui-fs-xs", status.text)}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {runs.length === 0 && !runsQuery.isLoading && (
              <p className="px-3 py-6 ui-fs-xs text-foreground/50 text-center">
                생성된 리포트가 없습니다.
              </p>
            )}
          </div>
        </SimpleBar>
      </aside>

      {/* ── 우측: 보고서 문서 ── */}
      <SimpleBar className="flex-1 min-w-0">
        <div className="px-8 py-6 max-w-[920px] mx-auto">
          {detailQuery.isLoading && !run ? (
            <ViewerSkeleton />
          ) : !run ? (
            <div className="rounded-lg border border-dashed border-border/50 px-6 py-12 text-center">
              <p className="text-xs text-foreground/65">
                리포트를 찾을 수 없습니다.
              </p>
            </div>
          ) : (
            <>
              {/* 헤더: 제목 + 메타 + 액션 */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="ui-fs-xs text-muted-foreground/70 tracking-tight mb-1">
                    설정 / 보고서 관리 <span className="mx-0.5">›</span>{" "}
                    <span className="text-foreground/60">{runDisplayName(run)}</span>
                  </div>
                  <h2 className="ui-h2 truncate">
                    {runDisplayName(run)}
                  </h2>
                  <p className="ui-caption mt-1">
                    {formatFullDateTime(run.created_at)} ·{" "}
                    {PERSONA_LABEL[run.persona]} 보고용 ·{" "}
                    <span className={RUN_STATUS_META[run.status].text}>
                      {RUN_STATUS_META[run.status].label}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 ui-fs-xs"
                    onClick={handlePdf}
                    disabled={!detail?.download.pdf}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    PDF 다운로드
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-3 ui-fs-xs"
                    onClick={handleResend}
                    disabled={
                      generateMutation.isPending ||
                      run.status === "queued" ||
                      run.status === "running"
                    }
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    재발송
                  </Button>
                </div>
              </div>

              {/* 문서 카드 */}
              <div className="rounded-xl border border-border/40 overflow-hidden bg-foreground/[0.015]">
                {/* 다크 헤더 */}
                <div className="bg-slate-950/80 border-b border-border/40 px-6 py-4">
                  <div className="text-sm font-semibold tracking-tight text-white">
                    {runDisplayName(run)}
                  </div>
                  <div className="ui-fs-xs text-white/55 mt-0.5">
                    {formatFullDateTime(run.created_at)} ·{" "}
                    {PERSONA_LABEL[run.persona]} 보고용
                  </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* run 메타 strip — 실측 필드 (mock 아님) */}
                  <div className="grid grid-cols-4 gap-3">
                    <MetaCell label="상태">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          RUN_STATUS_META[run.status].text,
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            RUN_STATUS_META[run.status].dot,
                          )}
                        />
                        {RUN_STATUS_META[run.status].label}
                      </span>
                    </MetaCell>
                    <MetaCell label="생성 시각">
                      {formatDateTime(run.created_at)}
                    </MetaCell>
                    <MetaCell label="소요 시간">
                      {run.duration_ms > 0
                        ? `${(run.duration_ms / 1000).toFixed(1)}s`
                        : "—"}
                    </MetaCell>
                    <MetaCell label="산출 포맷">
                      {Object.keys(run.artifacts ?? {}).length > 0
                        ? Object.keys(run.artifacts ?? {})
                            .map((f) => f.toUpperCase())
                            .join(" · ")
                        : "—"}
                    </MetaCell>
                  </div>

                  {/* 오류 */}
                  {run.error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
                      <p className="ui-eyebrow ui-tone-bad mb-1">
                        실패 사유
                      </p>
                      <p className="ui-caption ui-tone-bad font-mono break-all">
                        {run.error}
                      </p>
                    </div>
                  )}

                  {/* 본문 — report 캐시 있으면 요약·텍스트 섹션, 없으면 섹션 결과 요약 */}
                  {detail?.report ? (
                    <div className="space-y-4">
                      {detail.report.summary && (
                        <p className="text-xs leading-relaxed text-foreground/85 whitespace-pre-wrap">
                          {detail.report.summary}
                        </p>
                      )}
                      {detail.report.sections.map((s, i) => (
                        <div
                          key={`${s.heading}-${i}`}
                          className="rounded-lg border border-border/30 bg-foreground/[0.02] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <h4 className="text-xs font-semibold tracking-tight text-foreground">
                              {s.heading}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded ui-fs-2xs font-medium bg-foreground/[0.06] text-foreground/55 border border-border/40 flex-shrink-0">
                              {SECTION_TYPE_LABEL[s.type] ?? s.type}
                            </span>
                          </div>
                          {s.type === "text" && s.content ? (
                            <p className="ui-fs-xs leading-relaxed text-foreground/75 whitespace-pre-wrap">
                              {s.content}
                            </p>
                          ) : (
                            <p className="ui-fs-xs text-muted-foreground/70">
                              {SECTION_TYPE_LABEL[s.type] ?? s.type} 데이터 —
                              전체 내용은 PDF에서 확인하세요.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : run.section_results.length > 0 ? (
                    <div>
                      <p className="ui-fs-xs uppercase tracking-[0.12em] text-muted-foreground/65 font-medium mb-2">
                        섹션별 수집 결과
                      </p>
                      <div className="rounded-lg border border-border/30 divide-y divide-border/30 overflow-hidden">
                        {run.section_results.map((sr) => {
                          const spec = run.plan?.sections?.find(
                            (ps) => ps.spec.key === sr.key,
                          )?.spec;
                          const meta = SECTION_STATUS_META[sr.status];
                          return (
                            <div
                              key={sr.key}
                              className="flex items-center gap-3 px-4 py-2.5 bg-foreground/[0.015]"
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full flex-shrink-0",
                                  meta.dot,
                                )}
                              />
                              <span className="ui-fs-xs text-foreground/85 truncate">
                                {spec?.heading ?? sr.key}
                              </span>
                              <span
                                className={cn(
                                  "ml-auto ui-fs-xs flex-shrink-0",
                                  meta.text,
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* 본문 데이터 없음 → PDF 안내 중심 */}
                  {!detail?.report && (
                    <div className="rounded-lg border border-dashed border-border/50 bg-foreground/[0.015] px-6 py-8 text-center">
                      <p className="text-xs text-foreground/70">
                        차트·표를 포함한 전체 리포트 본문은 PDF에서 확인하세요.
                      </p>
                      <Button
                        size="sm"
                        className="mt-3 h-8 px-3 ui-fs-xs"
                        onClick={handlePdf}
                        disabled={!detail?.download.pdf}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        PDF 다운로드
                      </Button>
                      {!detail?.download.pdf && (
                        <p className="ui-fs-xs text-muted-foreground/60 mt-2">
                          {run.status === "queued" || run.status === "running"
                            ? "리포트 생성 중 — 완료되면 다운로드할 수 있습니다."
                            : "다운로드 가능한 PDF 산출물이 없습니다."}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 관측 노트 (partial 사유 등) */}
                  {run.notes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {run.notes.map((n, i) => (
                        <span
                          key={`${n}-${i}`}
                          className="px-1.5 py-0.5 rounded ui-fs-2xs font-mono bg-foreground/[0.04] text-foreground/50 border border-border/30"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="ui-fs-2xs text-muted-foreground/55">
                    ※ 본 분석은 AI 기반 데이터 해석 결과로 참고용입니다.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </SimpleBar>
    </div>
  );
});

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-foreground/[0.025] px-3.5 py-2.5">
      <div className="ui-fs-2xs text-muted-foreground/70 font-medium tracking-tight">
        {label}
      </div>
      <div className="mt-1 ui-fs-sm font-medium tabular-nums text-foreground">
        {children}
      </div>
    </div>
  );
}

function ViewerSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 w-64 bg-foreground/[0.06] rounded" />
      <div className="h-3 w-40 bg-foreground/[0.04] rounded" />
      <div className="h-16 w-full bg-foreground/[0.04] rounded-xl" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-foreground/[0.04] rounded-lg" />
        ))}
      </div>
      <div className="h-40 w-full bg-foreground/[0.03] rounded-lg" />
    </div>
  );
}
