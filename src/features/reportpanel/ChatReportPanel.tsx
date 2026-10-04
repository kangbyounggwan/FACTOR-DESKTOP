/**
 * ChatReportPanel — 채팅 옆 보고서 시트 패널 (데스크탑 소유 조립품, Figma C1~C6).
 *
 * 좌 채팅 / 우 패널. 대화가 보고서 의도를 감지하면 SSE `report_sheet` 가 공유 store
 * (`useSheetPanelStore.setFromEvent`) 에 들어오고, 셸이 그 `open` 을 미러해 이 패널을 연다.
 * 이 컴포넌트는 store 를 **읽고**, 미리보기 HTML 을 report-service 에서 받아 그린다.
 *
 * 구성(위→아래):
 *   헤더   시트명 · `v3 · 초안|저장됨` 배지 · 변경 요약 칩("이동 1 · 변경 1") · ✕
 *   툴바   [샘플 | 실데이터] 세그먼트 · 콜 예산 칩(live) · PDF · 저장(dirty 강조) · 디자이너
 *   본문   SheetPreviewFrame(iframe srcDoc sandbox="") + BlockHighlightOverlay(diff 1.5s 강조·고스트·선택)
 *          블록 클릭 → store.select + onBlockSelect(호스트가 입력창 prefix "『제목』 블록을 ")
 *   각주   표시 모드 · 적용 ops · 자동 재배치 안내 · 서버 warnings · 선택 블록 안내
 *   빈 상태 "대화에서 '보고서 만들어줘' 라고 말해 보세요" + 예시 문장(클릭 → 입력창)
 *
 * 미리보기 소스 우선순위: SSE 인라인 `preview.html`(sample·소형) → `preview.url` Bearer GET(모드 일치 시)
 * → `POST /sheets/{id}/preview?mode=`. 모두 React Query (id, version, mode) 키로 캐시.
 * 템플릿이 없고 포인터만 있을 때(대화 복원) 는 `GET /sheets/{id}` 로 채운다.
 *
 * PDF = 기존 `/generate` + `useReportRun` 폴링 재사용(`sheet_template_id`). 완료되면 서명 URL 을 연다.
 * 저장 = `POST /sheets/{id}/apply`(draft → saved, 버전 고정). 409(디자이너가 먼저 저장) 는 최신 템플릿으로
 * 교체 + 안내(E9). 디자이너에서 열기 = `/reports?tab=designer&sheet=<id>`.
 *
 * 스크롤은 SimpleBar(본문). 좌표 전제는 leaf(BlockHighlightOverlay) 의 "종이 = 컨테이너 폭, A4 비율" —
 * 그래서 프레임 박스를 A4 비율(aspect-ratio) 로 잡아 iframe 내부 스크롤 없이 오버레이가 맞게 한다.
 *
 * 룰: 공유 leaf 는 `@/features/reports/designer` 아래만 import(R6/R7). FE 컴포넌트에 분기 prop 없음(R5).
 * barrel(index.ts) 이 아니라 `designer/core` + 개별 leaf 모듈 — ChatPage 가 eager 라 이 파일은 셸 초기 번들에
 * 들어간다. barrel 은 디자이너 UI(SheetGridCanvas 의 gridstack JS + gridstack.min.css 등 side-effect import) 까지
 * 끌고 와 디자이너를 한 번도 열지 않는 사용자에게도 실린다.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import {
  AlertTriangle,
  Database,
  FileBarChart,
  FileDown,
  FlaskConical,
  Loader2,
  PenTool,
  Save,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BlockHighlightOverlay } from "@/features/reports/designer/BlockHighlightOverlay";
import { SheetPreviewFrame } from "@/features/reports/designer/SheetPreviewFrame";
import {
  findBlock,
  hasSheet,
  isSheetConflict,
  pageAspect,
  summarizeDiff,
  useSheetPanelStore,
  type BlockSpec,
  type PreviewMode,
  type SheetBudget,
} from "@/features/reports/designer/core";

import { REPORT_KEYS, saveReportSheet, sheetApi } from "@desktop/api/reports";
import {
  useGenerateReport,
  useReportRun,
} from "@desktop/features/settings/sections/reports/useReports";
import { electron } from "@desktop/lib/electron";
import { AccountReportTools } from "./AccountReportTools";

/** 빈 상태 예시 문장 — D4(매출 → 공장별 출하금액 대체) 톤 */
const SUGGEST_EXAMPLE = "지난주 출하금액을 공장별 도넛으로 왼쪽 아래에 넣어서 보고서 만들어줘";
/** 각주에 바로 보여줄 경고 수 — 나머지는 "+N" */
const MAX_WARNINGS_SHOWN = 3;

const MODES: { id: PreviewMode; label: string; icon: typeof Database; hint: string }[] = [
  { id: "sample", label: "샘플", icon: FlaskConical, hint: "샘플 데이터 — LLM·MES 호출 없음(디자인 중 비용 0)" },
  { id: "live", label: "실데이터", icon: Database, hint: "실데이터 조회 — 콜 예산(20) 을 대화와 공유" },
];

interface PreviewResult {
  html: string;
  budget: SheetBudget | null;
}

/** `preview.url` 의 `?mode=` — 없으면 null(모드 무관으로 취급) */
function previewModeOf(url: string | null): PreviewMode | null {
  if (!url) return null;
  const m = /[?&]mode=(sample|live)(?:&|$)/.exec(url);
  return m ? (m[1] as PreviewMode) : null;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export interface ChatReportPanelProps {
  /** ✕ — 패널만 닫는다(시트는 store 에 유지 → 토글/다음 report_sheet 로 재오픈). 셸의 setReportPanelOpen(false) */
  onClose: () => void;
  /** 블록 클릭(선택/해제). 호스트가 입력창 prefix 를 넣는다. null = 해제 */
  onBlockSelect?: (block: BlockSpec | null) => void;
  /** 빈 상태 예시 문장 클릭 → 입력창에 넣기 */
  onSuggest?: (text: string) => void;
  className?: string;
  accountScope?: string;
  conversationId?: string | null;
  conversationRevision?: number;
}

export function ChatReportPanel({ onClose, onBlockSelect, onSuggest, className,
  accountScope, conversationId = null, conversationRevision = 0 }: ChatReportPanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  // 패널은 store 의 거의 모든 필드를 그리므로 전체 구독(셀렉터 분할 이득 없음)
  const store = useSheetPanelStore();
  const {
    sheetId,
    version,
    status,
    title,
    template,
    mode,
    selectedBlockId,
    lastDiff,
    lastDiffAt,
    budget,
    warnings,
    opsApplied,
    dirty,
    previewUrl,
    previewHtml: inlineHtml,
    setTemplate,
    setMode,
    select,
    setPreviewHtml,
    setBudget,
    markSaved,
    pendingEditRequestId,
  } = store;
  const has = hasSheet(store);
  const [undoing, setUndoing] = useState(false);
  const editing = pendingEditRequestId !== null || undoing;

  // ── 템플릿 — 포인터만 있을 때(대화 복원) GET /sheets/{id} 로 채운다 ───────────────
  const templateQuery = useQuery({
    queryKey: [...REPORT_KEYS.sheet(sheetId ?? "", version), accountScope ?? null],
    queryFn: () => sheetApi.getSheet(sheetId as string),
    enabled: has && template === null,
    refetchOnMount: "always",
    retry: false,
  });
  useEffect(() => {
    const t = templateQuery.data;
    if (t && !templateQuery.isFetching && template === null && t.id === sheetId) setTemplate(t);
  }, [templateQuery.data, templateQuery.isFetching, template, sheetId, setTemplate]);

  // ── 미리보기 HTML — 인라인 → url(모드 일치) → POST preview ─────────────────────
  const urlMode = useMemo(() => previewModeOf(previewUrl), [previewUrl]);
  const viaUrl = previewUrl !== null && (urlMode === null || urlMode === mode);
  const previewQuery = useQuery({
    queryKey: [...REPORT_KEYS.sheetPreview(sheetId ?? "", version, mode), viaUrl ? previewUrl : "post", accountScope ?? null],
    queryFn: async ({ signal }): Promise<PreviewResult> => {
      if (viaUrl && previewUrl) {
        return { html: await sheetApi.fetchPreviewUrl(previewUrl, signal), budget: null };
      }
      const r = await sheetApi.previewSheet(sheetId as string, { mode, signal });
      return { html: r.html, budget: r.budget ?? null };
    },
    enabled: has && template !== null && inlineHtml === null,
    refetchOnMount: "always",
    // live 미리보기는 콜 예산을 쓴다 — 자동 재시도 금지(재시도 버튼으로만)
    retry: false,
  });
  useEffect(() => {
    const b = previewQuery.data?.budget;
    if (b) setBudget(b);
  }, [previewQuery.data, setBudget]);

  const html = template === null ? null : inlineHtml ?? (previewQuery.isFetching ? null : previewQuery.data?.html ?? null);
  const previewLoading = has && ((template === null && templateQuery.isFetching) || (inlineHtml === null && previewQuery.isFetching));
  const previewError = has
    ? previewQuery.error
      ? errMsg(previewQuery.error)
      : templateQuery.error && template === null
        ? errMsg(templateQuery.error)
        : null
    : null;

  const retry = useCallback(() => {
    if (template === null) {
      void templateQuery.refetch();
    } else {
      void previewQuery.refetch();
    }
  }, [template, templateQuery, previewQuery]);

  // ── 모드 전환 — 인라인(sample) HTML 은 모드가 달라지면 stale ───────────────────
  const handleMode = useCallback(
    (m: PreviewMode) => {
      if (m === mode) return;
      setMode(m);
      setPreviewHtml(null);
    },
    [mode, setMode, setPreviewHtml],
  );

  // ── 블록 선택 — store 토글 + 호스트(입력창 prefix) ─────────────────────────────
  const handleSelect = useCallback(
    (id: string | null, block: BlockSpec | null) => {
      select(id);
      onBlockSelect?.(block);
    },
    [select, onBlockSelect],
  );

  // ── 저장(apply) — draft → saved, 버전 고정. 409 는 최신 템플릿으로 교체 + 안내(E9) ──
  const [saving, setSaving] = useState(false);
  const handleSave = useCallback(async () => {
    if (!sheetId || version === null || saving || editing) return;
    const saveTarget = useSheetPanelStore.getState();
    const isCurrentSheet = () => {
      const current = useSheetPanelStore.getState();
      return current.sheetId === saveTarget.sheetId && current.version === saveTarget.version &&
        current.template === saveTarget.template;
    };
    setSaving(true);
    try {
      const saved = await saveReportSheet(sheetId, version);
      // 계약은 SheetTemplate 전문 — 백엔드 동시 구현 중이라 shape 가 얇게 올 때도 깨지지 않게 방어
      const savedVersion = typeof saved?.version === "number" ? saved.version : (version ?? undefined);
      if (isCurrentSheet()) {
        if (saved && Array.isArray(saved.blocks) && saved.id === sheetId) setTemplate(saved);
        markSaved(savedVersion);
      }
      void qc.invalidateQueries({ queryKey: REPORT_KEYS.sheets });
      toast({
        title: savedVersion !== undefined ? `시트 v${savedVersion} 저장됨` : "시트 저장됨",
        description: "스케줄·디자이너가 이 버전을 읽습니다.",
      });
    } catch (e) {
      if (isSheetConflict(e)) {
        if (isCurrentSheet() && e.template?.id === sheetId) setTemplate(e.template);
        toast({ title: "다른 곳에서 먼저 바뀐 버전", description: e.message, variant: "destructive" });
      } else {
        toast({ title: "저장 실패", description: errMsg(e), variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }, [sheetId, version, saving, editing, setTemplate, markSaved, qc, toast]);

  const handleUndo = useCallback(async () => {
    if (!sheetId || version === null || version <= 1 || editing || saving) return;
    const target = useSheetPanelStore.getState();
    const isCurrent = () => {
      const current = useSheetPanelStore.getState();
      return current.sheetId === target.sheetId && current.version === target.version &&
        current.template === target.template && current.pendingEditRequestId === null;
    };
    setUndoing(true);
    try {
      const result = await sheetApi.applyOps(sheetId, [{ op: "undo", steps: 1 }], version);
      if (!isCurrent()) return;
      useSheetPanelStore.getState().setFromEvent({
        sheet_id: sheetId, version: result.version, status: result.status ?? "draft",
        title: result.template.name, template: result.template, diff: result.diff,
        preview: { mode: target.mode, url: null, html: null }, budget: target.budget,
        warnings: result.warnings, ops_applied: result.applied ?? result.ops_applied ?? ["undo"],
      });
      void qc.invalidateQueries({ queryKey: REPORT_KEYS.sheets });
    } catch (e) {
      if (!isCurrent()) return;
      if (isSheetConflict(e) && e.template?.id === sheetId) setTemplate(e.template);
      toast({ title: "되돌리기 실패", description: errMsg(e), variant: "destructive" });
    } finally {
      setUndoing(false);
    }
  }, [sheetId, version, editing, saving, qc, setTemplate, toast]);

  // ── PDF — 기존 /generate + run 폴링 재사용(sheet_template_id). 완료 시 서명 URL 열기 ──
  const generate = useGenerateReport();
  const [pdfRunId, setPdfRunId] = useState<string | null>(null);
  const pdfRun = useReportRun(pdfRunId);
  const handlePdf = useCallback(() => {
    if (!sheetId) return;
    generate.mutate(
      { sheet_template_id: sheetId, formats: ["pdf"] },
      {
        onSuccess: (r) => {
          setPdfRunId(r.run_id);
          toast({ title: "PDF 생성 시작", description: "완료되면 자동으로 열립니다." });
        },
        onError: (e) => toast({ title: "PDF 생성 실패", description: errMsg(e), variant: "destructive" }),
      },
    );
  }, [sheetId, generate, toast]);
  useEffect(() => {
    const d = pdfRun.data;
    if (!pdfRunId || !d) return;
    const st = d.run.status;
    if (st === "succeeded" || st === "partial") {
      const url = d.download.pdf;
      if (url) {
        void electron.openExternal(url);
        toast({
          title: st === "partial" ? "PDF 생성됨 (일부 블록 실패)" : "PDF 준비됨",
          description: "브라우저에서 열었습니다. 리포트 앱 이력에서도 받을 수 있습니다.",
        });
      } else {
        toast({
          title: "PDF 산출물 없음",
          description: "실행은 끝났지만 다운로드 URL 이 없습니다. 리포트 앱 이력을 확인하세요.",
          variant: "destructive",
        });
      }
      setPdfRunId(null);
    } else if (st === "failed") {
      toast({ title: "PDF 생성 실패", description: d.run.error ?? "원인 미상", variant: "destructive" });
      setPdfRunId(null);
    }
  }, [pdfRun.data, pdfRunId, toast]);
  const pdfBusy =
    generate.isPending ||
    (pdfRunId !== null &&
      (!pdfRun.data || pdfRun.data.run.status === "queued" || pdfRun.data.run.status === "running"));

  const openDesigner = useCallback(() => {
    if (!sheetId) return;
    navigate(`/reports?tab=designer&sheet=${encodeURIComponent(sheetId)}`);
  }, [sheetId, navigate]);

  // ── 파생 표시값 ─────────────────────────────────────────────────────────────
  const displayTitle = title ?? template?.name ?? "보고서 시트";
  const diffSummary = lastDiff ? summarizeDiff(lastDiff) : null;
  const rearrangedCount = lastDiff?.rearranged?.length ?? 0;
  const aspect = pageAspect(template?.page);
  const budgetText = budget ? `${budget.calls_used}/${budget.calls_max}` : null;
  const selectedBlock = findBlock(template, selectedBlockId);
  const hasStoredContent = template?.blocks.some((b) => b.source.kind === "synth" && !!b.content) ?? false;
  const storedContentOnly = hasStoredContent && !!template?.blocks.every((b) => b.source.kind === "synth" && !!b.content);

  return (
    <div
      className={cn("flex flex-col h-full min-h-0 bg-background", className)}
      data-testid="chat-report-panel"
    >
      {/* ── 헤더: 시트명 · 버전/상태 배지 · 변경 요약 칩 · ✕ ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0 min-w-0">
        <FileBarChart className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="ui-h3 truncate min-w-0" title={displayTitle}>
          {displayTitle}
        </span>
        {has && version !== null && (
          status === "saved" ? (
            <Badge
              variant="outline"
              className="flex-shrink-0 px-1.5 py-0 ui-micro font-medium border-success/40 bg-success/10 text-success"
              title="저장된 버전 — 스케줄·디자이너가 이 버전을 읽습니다"
            >
              v{version} · 저장됨
            </Badge>
          ) : (
            <Badge
              variant="warning"
              className="flex-shrink-0 px-1.5 py-0 ui-micro font-medium"
              title="초안 — 저장(apply) 전까지 스케줄에 반영되지 않습니다"
            >
              v{version} · 초안
            </Badge>
          )
        )}
        {diffSummary && !editing && (
          <span
            className="max-w-32 truncate rounded px-1.5 py-0.5 ui-micro border border-border/60 ui-surface-2 text-foreground/80"
            title={
              rearrangedCount > 0
                ? `자동 재배치 ${rearrangedCount} — 지시하지 않은 블록이 겹침 해소로 이동했습니다`
                : "이번 턴의 변경 요약"
            }
          >
            {diffSummary}
          </span>
        )}
        <div className="ml-auto" />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 flex-shrink-0"
          title="보고서 패널 닫기 (시트는 유지)"
          aria-label="보고서 패널 닫기"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── 툴바: 샘플|실데이터 · 예산 · PDF · 저장 · 디자이너 ── */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
        <div
          role="radiogroup"
          aria-label="미리보기 모드"
          className="inline-flex items-center rounded-md border border-border/60 p-0.5 ui-surface-1"
        >
          {MODES.map((m) => {
            const active = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!has || editing || saving}
                title={m.id === "sample" && storedContentOnly ? "저장된 조회 내용 — 최신 데이터 재조회 없음" : m.hint}
                onClick={() => handleMode(m.id)}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-2 rounded ui-fs-xs transition-colors whitespace-nowrap",
                  active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground",
                  !has && "opacity-50 cursor-not-allowed",
                )}
              >
                <Icon className="w-3 h-3" />
                {m.id === "sample" && storedContentOnly ? "저장 내용" : m.label}
              </button>
            );
          })}
        </div>
        {mode === "live" && budgetText && (
          <span
            className="inline-flex items-center rounded px-1.5 h-6 ui-micro ui-num border border-border/60 text-foreground/80"
            title="실데이터 조회 콜 예산 (사용/상한) — 대화와 공유"
          >
            {budgetText}
          </span>
        )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0"
          disabled={!has || version === null || version <= 1 || editing || saving}
          onClick={() => void handleUndo()} title="직전 보고서 수정 되돌리기" aria-label="보고서 수정 되돌리기">
          {undoing ? <Loader2 className="animate-spin w-4 h-4" /> : <Undo2 className="w-4 h-4" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 ui-fs-xs"
          disabled={!has || pdfBusy || editing || saving}
          onClick={handlePdf}
          title="시트를 PDF 로 생성 — 완료되면 자동으로 열립니다"
        >
          {pdfBusy ? <Loader2 className="animate-spin" /> : <FileDown />}
          PDF
        </Button>
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          className="h-7 px-2 ui-fs-xs"
          disabled={!has || !dirty || saving || editing}
          onClick={() => void handleSave()}
          title={dirty ? "초안을 저장 — 버전이 고정되고 스케줄·디자이너가 읽습니다" : "저장된 버전입니다"}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {dirty ? "저장" : "저장됨"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 ui-fs-xs"
          disabled={!has || editing || saving}
          onClick={openDesigner}
          title="리포트 앱 디자이너에서 이 시트(같은 버전) 열기"
        >
          <PenTool />
          디자이너
        </Button>
        </div>
      </div>

      {has && (editing || (lastDiff && html !== null && !previewLoading && !previewError)) && (
        <div role="status" aria-live="polite"
          className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-primary ui-fs-xs">
          {editing && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
          <span className="min-w-0 break-words">{editing ? "보고서 수정 중" : `${diffSummary} · 미리보기 반영`}</span>
        </div>
      )}

      {/* ── 본문: A4 비율 프레임 + 오버레이, 아래 각주. 스크롤은 SimpleBar ── */}
      {accountScope && <AccountReportTools key={`${accountScope}:${conversationId ?? "new"}`}
        accountScope={accountScope} conversationId={conversationId} revision={conversationRevision} />}
      <SimpleBar className="flex-1 min-h-0">
        <div className="p-3 space-y-2.5">
          {!has ? (
            <EmptyInset onSuggest={onSuggest} />
          ) : (
            <div
              className="relative w-full rounded-md border border-border/50 bg-white shadow-sm overflow-hidden"
              style={{ aspectRatio: String(aspect) }}
            >
              <SheetPreviewFrame
                className="absolute inset-0"
                html={html}
                loading={previewLoading}
                error={previewError}
                onRetry={retry}
                title={`${displayTitle} 미리보기`}
                emptyMessage="미리보기를 준비하고 있습니다."
              >
                {template?.defaults.layout !== "eis_executive" && <BlockHighlightOverlay
                  template={template}
                  diff={lastDiff}
                  diffAt={lastDiffAt}
                  selectedBlockId={selectedBlockId}
                  onSelect={handleSelect}
                  showGrid
                />}
              </SheetPreviewFrame>
            </div>
          )}

          {has && (
            <Footnotes
              mode={mode}
              budgetText={budgetText}
              opsApplied={opsApplied}
              rearrangedCount={rearrangedCount}
              warnings={warnings}
              selectedBlock={selectedBlock}
              hasStoredContent={hasStoredContent}
              storedContentOnly={storedContentOnly}
            />
          )}
        </div>
      </SimpleBar>
    </div>
  );
}

// ── 하위 조각 (패널 전용, 비공유) ────────────────────────────────────────────

/** C1 빈 패널 인셋 — 대화 유도 + 예시 문장 */
function EmptyInset({ onSuggest }: { onSuggest?: (text: string) => void }) {
  return (
    <div className="rounded-md border border-dashed border-border/60 ui-surface-1 px-5 py-8 flex flex-col items-center text-center gap-2">
      <FileBarChart className="w-6 h-6 text-muted-foreground/70" />
      <p className="ui-body font-medium">대화에서 &lsquo;보고서 만들어줘&rsquo; 라고 말해 보세요</p>
      <p className="ui-caption max-w-[340px]">
        지표·기간·차트·위치를 말하면 시트가 여기에 그려지고, 이어서 블록 이동·차트 변경·기간 변경·
        내용 확인·저장을 대화로 할 수 있습니다.
      </p>
      {onSuggest && (
        <button
          type="button"
          onClick={() => onSuggest(SUGGEST_EXAMPLE)}
          className="mt-1 inline-flex items-start gap-1.5 text-left rounded-md border border-border/60 px-2.5 py-1.5 ui-fs-xs text-foreground/85 hover:bg-foreground/5 hover:border-primary/40 transition-colors max-w-full"
          title="클릭하면 입력창에 넣습니다"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-px" />
          <span className="break-keep">예시: {SUGGEST_EXAMPLE}</span>
        </button>
      )}
    </div>
  );
}

/** 하단 각주 — 표시 모드 · 적용 ops · 자동 재배치 · 서버 warnings · 선택 블록 */
function Footnotes({
  mode,
  budgetText,
  opsApplied,
  rearrangedCount,
  warnings,
  selectedBlock,
  hasStoredContent,
  storedContentOnly,
}: {
  mode: PreviewMode;
  budgetText: string | null;
  opsApplied: string[];
  rearrangedCount: number;
  warnings: string[];
  selectedBlock: BlockSpec | null;
  hasStoredContent: boolean;
  storedContentOnly: boolean;
}) {
  const rows: ReactNode[] = [];

  rows.push(
    <div key="mode" className="flex items-start gap-1.5">
      <span className="flex-shrink-0 text-foreground/70">{mode === "live" ? "조회 기준" : "표시"}</span>
      <span>
        {storedContentOnly
          ? "저장된 조회 내용 · 최신 데이터 재조회 없음 · 조회 시점과 출처는 본문을 따릅니다"
          : mode === "sample" && hasStoredContent
          ? "본문은 저장된 조회 내용이며, 차트·표의 샘플 표시 수치는 예시입니다."
          : mode === "live"
          ? `실데이터 · 콜 ${budgetText ?? "–"} · 블록별 조회 기준·출처는 시트 안 각주를 따릅니다`
          : "샘플 데이터 — 수치는 예시입니다. 실데이터 확인은 '실데이터' 전환 또는 대화에서 \"실데이터로 내용 확인해줘\""}
      </span>
    </div>,
  );

  if (opsApplied.length > 0) {
    rows.push(
      <div key="ops" className="flex items-start gap-1.5">
        <span className="flex-shrink-0 text-foreground/70">적용</span>
        <span className="ui-num break-all">{opsApplied.join(" · ")}</span>
      </div>,
    );
  }

  if (rearrangedCount > 0) {
    rows.push(
      <div key="rearranged" className="flex items-start gap-1.5 text-warning">
        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>
          자동 재배치 {rearrangedCount} — 지시하지 않은 블록이 겹침 해소로 이동했습니다 (점선 = 이전 위치).
          되돌리려면 &ldquo;되돌려&rdquo; 라고 말하세요.
        </span>
      </div>,
    );
  }

  warnings.slice(0, MAX_WARNINGS_SHOWN).forEach((w, i) => {
    rows.push(
      <div key={`warn-${i}`} className="flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-warning" />
        <span className="break-keep">{w}</span>
      </div>,
    );
  });
  if (warnings.length > MAX_WARNINGS_SHOWN) {
    rows.push(
      <div key="warn-more" className="text-foreground/60">
        +{warnings.length - MAX_WARNINGS_SHOWN} 경고 더 있음
      </div>,
    );
  }

  if (selectedBlock) {
    rows.push(
      <div key="selected" className="flex items-start gap-1.5 text-primary">
        <span className="flex-shrink-0">선택</span>
        <span className="break-keep">
          『{selectedBlock.title}』 — 입력창에 지시를 이어서 쓰세요 (예: &ldquo;막대로 바꿔&rdquo;, &ldquo;오른쪽 위로&rdquo;)
        </span>
      </div>,
    );
  }

  return (
    <div className="ui-caption space-y-1 px-0.5" data-testid="chat-report-footnotes">
      {rows}
    </div>
  );
}
