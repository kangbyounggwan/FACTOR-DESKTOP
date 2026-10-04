/**
 * 보고서 관리 — [디자이너] 탭 (F19~F25 조립, 데스크탑 소유).
 *
 * 두 상태를 `?tab=designer&sheet=<id>` 쿼리로 구분한다(E9: 채팅 패널 "디자이너에서 열기" 가 이 URL 로 진입).
 *   · 목록 상태(F23)  — `SheetTemplateList` + `SaveSheetDialog`(새 시트 · 이름/공유 변경) + 삭제 확인
 *   · 디자이너 상태   — 툴바(← 목록 · 이름 · v·상태 · 되돌리기/다시 실행 · [캔버스 | 미리보기] · 저장)
 *                       + 본문 = 워크벤치(팔레트 260 · 12열 캔버스 · 속성 360, F19~F21·F25)
 *                              또는 미리보기(`SheetPreviewPanel`, F22)
 *
 * 공유 leaf(`@/features/reports/designer`) 는 모델·API 클라이언트·store·캔버스·팔레트·속성·목록·저장·미리보기만 준다(R6).
 * sheetApi 인스턴스·React Query 키는 `@desktop/api/reports`(`sheetApi` · `REPORT_KEYS`) — 채팅 패널과 **같은
 * 인스턴스·같은 키 체계**(env 빈 문자열 폴백 `||`·템플릿 캐시가 두 갈래로 갈라지지 않게). React Query 훅은
 * 이 파일 — `TemplateDialog`(F24) 와 `ReportsGenerateTab` 이 `useSheetList` 를 가져다 쓴다(같은 디렉터리 내부 의존).
 *
 * 편집 상태는 leaf 의 `useSheetDesignerStore`(base = 서버 템플릿(If-Match 버전) ↔ template = 초안, undo/redo 50):
 *   · 서버 템플릿이 오면 `load`, 편집 중(dirty)이면 덮어쓰지 않는다(충돌은 저장 시 409 로 감지).
 *   · 저장 1클릭 = `buildSavePlan` → `updateSheet(meta)` → `applyOps(ops, If-Match)` → (초안이면) `applySheet` 로
 *     저장 버전 고정. 409 → `setConflict` + sonner 토스트 + 인라인 `SaveConflictNotice`("최신 불러오기").
 *   · 자동 재배치 허용(사용자 확정): 드롭 위치가 겹치면 store 가 가까운 빈 자리로 옮기고 토스트로 알린다.
 *
 * 저장 성공 시 채팅 패널 store 가 같은 sheet_id 를 보고 있으면 템플릿을 밀어 넣어(E9) 패널이
 * stale 버전으로 다음 턴을 보내지 않게 한다. 미리보기는 서버 상태만 그린다 — 미저장 변경은 각주로 안내.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, LayoutGrid, Loader2, MessageSquareText, Pencil, Redo2, Save, Undo2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BlockPalette,
  BlockPropsPanel,
  BudgetExceededBanner,
  DesignerEmptyCanvas,
  MAX_BLOCKS,
  PlacementErrorList,
  SaveConflictNotice,
  SaveSheetDialog,
  SheetGridCanvas,
  SheetPreviewPanel,
  SheetTemplateList,
  SourceCatalogDialog,
  VISIBILITY_LABEL_KO,
  buildSavePlan,
  canRedo,
  canUndo,
  isSheetConflict,
  showSaveConflictToast,
  useSheetDesignerStore,
  useSheetPanelStore,
  type BlockDragPayload,
  type BlockPos,
  type CatalogSource,
  type PreviewMode,
  type SaveSheetValues,
  type SheetBudget,
  type SheetExportFormat,
  type SheetSummary,
  type SheetTemplate,
  type SheetThumbnailSource,
  type VizType,
} from "@/features/reports/designer";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { REPORT_KEYS, sheetApi, type GenerateRequest } from "@desktop/api/reports";

import { useGenerateReport } from "./useReports";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── React Query 훅 (데스크탑 소유) — 인스턴스(`sheetApi`)·키(`REPORT_KEYS`) 는 @desktop/api/reports 와 공유 ──

/** GET /sheets — 목록(F23) · 스케줄 연결 select(F24) · 생성 탭 select 공용 */
export function useSheetList() {
  return useQuery({
    queryKey: REPORT_KEYS.sheets,
    queryFn: () => sheetApi.listSheets(),
    staleTime: 10_000,
  });
}

/** GET /sheets/{id} 최신판(`REPORT_KEYS.sheet(id)` = "latest"). 채팅 패널은 같은 팩토리의 (id, version) 키로 버전 고정 캐시 */
export function useSheetTemplate(sheetId: string | null) {
  return useQuery({
    queryKey: REPORT_KEYS.sheet(sheetId ?? ""),
    queryFn: () => sheetApi.getSheet(sheetId!),
    enabled: !!sheetId,
    staleTime: 5_000,
  });
}

export function useSheetCatalog() {
  return useQuery({
    queryKey: REPORT_KEYS.sheetCatalog,
    queryFn: () => sheetApi.getCatalog(),
    staleTime: 5 * 60_000, // 정적 카탈로그(§2(c) in-process 5분 캐시와 같은 결)
  });
}

// ── 시트 템플릿 select (F24 스케줄 연결 · 생성 탭 공용) ──────────────────────

/** "페르소나 기본" 항목 값 — Radix Select 는 빈 문자열 value 를 허용하지 않아 sentinel 사용 */
export const PERSONA_DEFAULT_SHEET = "__persona__";

/**
 * 저장된 시트(saved) 만 선택 가능, 초안은 disabled 로 노출(저장 안내). 목록이 안 오면 사유를 아래 줄에.
 * value=null 이 "페르소나 기본". 목록에 없는 id(삭제·타 회사) 는 "알 수 없는 시트" 항목으로 보존한다.
 */
export function SheetTemplateSelect({
  value,
  onChange,
  personaLabel,
  disabled = false,
  className,
}: {
  value: string | null;
  onChange: (sheetId: string | null) => void;
  /** "페르소나 기본 — {personaLabel}" */
  personaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const listQuery = useSheetList();
  const sheets = listQuery.data?.sheets ?? [];
  const saved = sheets.filter((s) => s.status === "saved");
  const drafts = sheets.filter((s) => s.status !== "saved");
  const unknown = value !== null && !sheets.some((s) => s.id === value);

  const hint = listQuery.isError
    ? "시트 목록을 불러오지 못했습니다 — 리포트 서비스(VITE_REPORT_SERVICE_URL) 연결과 로그인 상태를 확인하세요."
    : listQuery.isLoading
      ? "시트 목록 불러오는 중…"
      : saved.length === 0
        ? "저장된 시트가 없습니다 — [디자이너] 탭에서 시트를 만들고 저장하면 여기서 선택할 수 있습니다."
        : "시트를 고르면 페르소나 섹션 대신 시트 레이아웃(블록 · 차트 · 위치) 으로 생성됩니다.";

  return (
    <div className={cn("space-y-1", className)}>
      <Select
        value={value ?? PERSONA_DEFAULT_SHEET}
        onValueChange={(v) => onChange(v === PERSONA_DEFAULT_SHEET ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 ui-fs-xs" data-testid="sheet-template-select">
          <SelectValue placeholder="시트 템플릿" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PERSONA_DEFAULT_SHEET} className="ui-fs-xs">
            페르소나 기본 — {personaLabel}
          </SelectItem>
          {saved.map((s) => (
            <SelectItem key={s.id} value={s.id} className="ui-fs-xs">
              {s.name} · 블록 {s.block_count ?? 0}
              {s.is_seed ? " · 기본" : ""}
              {s.visibility === "private" ? " · 개인" : ""}
            </SelectItem>
          ))}
          {drafts.map((s) => (
            <SelectItem key={s.id} value={s.id} disabled className="ui-fs-xs">
              {s.name} (초안 — 저장 후 선택 가능)
            </SelectItem>
          ))}
          {unknown && value && (
            <SelectItem value={value} className="ui-fs-xs">
              알 수 없는 시트 ({value.slice(0, 8)}…)
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <p className={cn("ui-micro leading-relaxed", listQuery.isError ? "text-destructive/80" : "text-muted-foreground/60")}>{hint}</p>
    </div>
  );
}

// ── 탭 루트: URL ↔ 상태 ───────────────────────────────────────────────────

interface Props {
  /** PDF/PPTX 생성 → run 뷰어(폴링) 로 */
  onOpenRun: (runId: string) => void;
}

export const ReportsDesignerTab = memo(function ReportsDesignerTab({ onOpenRun }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetId = searchParams.get("sheet");

  const openDesigner = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "designer");
      if (id) next.set("sheet", id);
      else next.delete("sheet");
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  if (sheetId) {
    return <DesignerView sheetId={sheetId} onBack={() => openDesigner(null)} onOpenRun={onOpenRun} />;
  }
  return <ListView onOpen={(s) => openDesigner(s.id)} />;
});

// ── 목록 상태 (F23) ──────────────────────────────────────────────────────

function ListView({ onOpen }: { onOpen: (sheet: SheetSummary) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const api = sheetApi;
  const listQuery = useSheetList();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SheetSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SheetSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sheets = useMemo(() => listQuery.data?.sheets ?? [], [listQuery.data]);

  // 썸네일 — 디자이너에서 열어 본(캐시된) 템플릿만 그린다
  const templates = useMemo(() => {
    const out: Record<string, SheetThumbnailSource | undefined> = {};
    for (const s of sheets) out[s.id] = qc.getQueryData<SheetTemplate>(REPORT_KEYS.sheet(s.id));
    return out;
  }, [sheets, qc]);

  const invalidate = () => qc.invalidateQueries({ queryKey: REPORT_KEYS.sheets });

  const createMutation = useMutation({
    mutationFn: (v: SaveSheetValues) => api.createSheet({ name: v.name, visibility: v.visibility }),
    onSuccess: (tpl) => {
      qc.setQueryData(REPORT_KEYS.sheet(tpl.id), tpl);
      void invalidate();
      setCreateOpen(false);
      onOpen({ ...tpl, block_count: tpl.blocks.length });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, v }: { id: string; v: SaveSheetValues }) =>
      api.updateSheet(id, { name: v.name, visibility: v.visibility }),
    onSuccess: (tpl) => {
      qc.setQueryData(REPORT_KEYS.sheet(tpl.id), tpl);
      void invalidate();
      setRenameTarget(null);
      toast({ title: "변경 완료", description: `『${tpl.name}』 · ${VISIBILITY_LABEL_KO[tpl.visibility]}` });
    },
  });

  const duplicate = async (sheet: SheetSummary) => {
    setBusyId(sheet.id);
    try {
      const src = await api.getSheet(sheet.id);
      const copy = await api.createSheet({
        name: `${src.name} 복제`,
        visibility: src.visibility,
        page: src.page,
        grid: src.grid,
        defaults: src.defaults,
        blocks: src.blocks,
      });
      qc.setQueryData(REPORT_KEYS.sheet(copy.id), copy);
      await invalidate();
      toast({ title: "복제 완료", description: `『${copy.name}』 (초안)` });
    } catch (e) {
      toast({ title: "복제 실패", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const t = deleteTarget;
    if (!t) return;
    setDeleteTarget(null);
    setBusyId(t.id);
    try {
      await api.deleteSheet(t.id);
      qc.removeQueries({ queryKey: REPORT_KEYS.sheet(t.id) });
      await invalidate();
      toast({ title: "삭제 완료", description: `『${t.name}』` });
    } catch (e) {
      toast({ title: "삭제 실패", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-foreground/[0.02] px-3.5 py-2.5">
        <MessageSquareText className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
        <p className="ui-caption leading-relaxed">
          시트 = 블록(데이터 소스 × 기간 × 집계 × 차트) 을 A4 12열 그리드에 배치한 보고서 레이아웃.
          저장한 시트는 [생성] 탭과 [포맷] 탭의 스케줄에서 선택할 수 있고, 채팅에서{" "}
          <span className="text-foreground/80">"보고서 만들어줘"</span> 라고 말해도 같은 시트를 편집합니다.
        </p>
      </div>

      <SheetTemplateList
        sheets={sheets}
        templates={templates}
        loading={listQuery.isLoading}
        error={listQuery.isError ? errMsg(listQuery.error) : null}
        onRetry={() => void listQuery.refetch()}
        onOpen={onOpen}
        onCreate={() => setCreateOpen(true)}
        onDuplicate={(s) => void duplicate(s)}
        onRename={setRenameTarget}
        onDelete={setDeleteTarget}
        busyId={busyId}
      />

      {/* 새 시트 */}
      <SaveSheetDialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) createMutation.reset();
          setCreateOpen(o);
        }}
        title="새 시트"
        description="빈 A4 가로 시트를 만듭니다. 블록은 디자이너 캔버스 또는 채팅으로 추가합니다."
        submitLabel="만들기"
        pending={createMutation.isPending}
        error={createMutation.isError ? errMsg(createMutation.error) : null}
        onSubmit={(v) => createMutation.mutate(v)}
      />

      {/* 이름 · 공유 범위 */}
      <SaveSheetDialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            renameMutation.reset();
            setRenameTarget(null);
          }
        }}
        title="이름 · 공유 범위 변경"
        description="블록 구성은 바뀌지 않습니다."
        initial={renameTarget ? { name: renameTarget.name, visibility: renameTarget.visibility } : undefined}
        submitLabel="변경"
        pending={renameMutation.isPending}
        error={renameMutation.isError ? errMsg(renameMutation.error) : null}
        onSubmit={(v) => {
          if (renameTarget) renameMutation.mutate({ id: renameTarget.id, v });
        }}
      />

      {/* 삭제 확인 */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>시트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              『{deleteTarget?.name}』 을 삭제합니다.
              {(deleteTarget?.schedule_count ?? 0) > 0 &&
                ` 연결된 스케줄 ${deleteTarget?.schedule_count}개는 페르소나 기본 템플릿으로 되돌아갑니다.`}{" "}
              되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 디자이너 상태 (F19 툴바 + 워크벤치 | F22 미리보기) ─────────────────────

type DesignerViewMode = "canvas" | "preview";

interface PreviewState {
  html: string | null;
  loading: boolean;
  error: string | null;
  mode: PreviewMode;
  budget: SheetBudget | null;
  elapsedMs: number | null;
  blockData: Record<string, unknown> | null;
  /** 어느 version 의 미리보기인가 — 템플릿이 바뀌면 stale */
  version: number | null;
}

const PREVIEW_INITIAL: PreviewState = {
  html: null,
  loading: false,
  error: null,
  mode: "sample",
  budget: null,
  elapsedMs: null,
  blockData: null,
  version: null,
};

/** 저장 1클릭 결과 — ops 반영 + (초안이면) 저장 버전 고정 */
interface SaveOutcome {
  template: SheetTemplate;
  /** 서버가 ops 적용 시 돌려준 경고 */
  warnings: string[];
  /** 현 계약(ops 12종·PUT meta) 으로 보낼 수 없어 버려진 변경의 점 경로 */
  unsupported: string[];
}

const BLOCK_LIMIT_REASON = `블록은 최대 ${MAX_BLOCKS}개까지 둘 수 있습니다.`;
const UNSAVED_PREVIEW_WARNING = "저장하지 않은 변경은 미리보기에 반영되지 않습니다 — 먼저 저장하세요.";

function DesignerView({
  sheetId,
  onBack,
  onOpenRun,
}: {
  sheetId: string;
  onBack: () => void;
  onOpenRun: (runId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const api = sheetApi;
  const templateQuery = useSheetTemplate(sheetId);
  const catalogQuery = useSheetCatalog();
  const generateMutation = useGenerateReport();
  const designer = useSheetDesignerStore();

  const serverTemplate = templateQuery.data ?? null;
  /** 편집본(초안) 우선 — 아직 적재 전이면 서버 템플릿 */
  const work = designer.template && designer.template.id === sheetId ? designer.template : serverTemplate;

  const [view, setView] = useState<DesignerViewMode>("canvas");
  const [renameOpen, setRenameOpen] = useState(false);
  const [infoSource, setInfoSource] = useState<CatalogSource | null>(null);
  const [preview, setPreview] = useState<PreviewState>(PREVIEW_INITIAL);
  const [exporting, setExporting] = useState<SheetExportFormat | null>(null);
  const previewAbort = useRef<AbortController | null>(null);

  // 시트 전환 — 초안·선택·미리보기 정리 (이전 시트의 블록이 캔버스에 잠깐 보이지 않게 먼저 reset)
  useEffect(() => {
    useSheetDesignerStore.getState().reset();
    setInfoSource(null);
    setPreview(PREVIEW_INITIAL);
    setView("canvas");
  }, [sheetId]);
  // 탭을 떠나면 초안 폐기
  useEffect(() => () => useSheetDesignerStore.getState().reset(), []);

  // 서버 템플릿 → 디자이너 적재. 편집 중(dirty) 이면 덮어쓰지 않는다 — 충돌은 저장 시 409 로 감지
  useEffect(() => {
    if (!serverTemplate) return;
    const s = useSheetDesignerStore.getState();
    if (!s.template || s.template.id !== serverTemplate.id) {
      s.load(serverTemplate);
      return;
    }
    if (!s.dirty && s.base && s.base.version !== serverTemplate.version) s.load(serverTemplate);
  }, [serverTemplate]);

  useEffect(() => {
    useSheetDesignerStore.getState().setCatalog(catalogQuery.data?.sources ?? null);
  }, [catalogQuery.data]);

  useEffect(() => () => previewAbort.current?.abort(), []);

  /** 캔버스/오버레이 선택 — store.select 는 토글(재선택=해제) 이라 GridStack dragstart 와 어긋나므로 직접 set */
  const selectBlock = useCallback((id: string | null) => useSheetDesignerStore.setState({ selectedBlockId: id }), []);

  const runPreview = useCallback(
    async (mode: PreviewMode) => {
      if (!serverTemplate) return;
      previewAbort.current?.abort();
      const ac = new AbortController();
      previewAbort.current = ac;
      setPreview((p) => ({ ...p, mode, loading: true, error: null }));
      const t0 = performance.now();
      try {
        const res = await api.previewSheet(serverTemplate.id, { mode, includeData: mode === "live", signal: ac.signal });
        if (ac.signal.aborted) return;
        setPreview({
          html: res.html,
          loading: false,
          error: null,
          mode,
          budget: res.budget ?? null,
          elapsedMs: performance.now() - t0,
          blockData: res.block_data ?? null,
          version: serverTemplate.version,
        });
      } catch (e) {
        if (ac.signal.aborted) return;
        setPreview((p) => ({ ...p, loading: false, error: errMsg(e), elapsedMs: performance.now() - t0 }));
      }
    },
    [api, serverTemplate],
  );

  // 미리보기 진입 시 샘플 1회 자동 실행 (LLM 0 · MES 0 콜). 서버 템플릿 버전이 바뀌면 다시
  useEffect(() => {
    if (view !== "preview" || !serverTemplate) return;
    if (preview.loading) return;
    if (preview.html !== null && preview.version === serverTemplate.version && !preview.error) return;
    void runPreview(preview.html === null ? "sample" : preview.mode);
    // preview.* 는 runPreview 내부 setState 결과 — 의존에 넣으면 루프
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, serverTemplate?.id, serverTemplate?.version]);

  /** 409 뒤 "최신 불러오기" — 충돌 응답에 템플릿이 있으면 그걸로, 없으면 GET 재조회 */
  const reloadLatest = useCallback(async () => {
    const s = useSheetDesignerStore.getState();
    if (s.conflict?.template) {
      qc.setQueryData(REPORT_KEYS.sheet(sheetId), s.conflict.template);
      s.reloadFromConflict();
      return;
    }
    s.setConflict(null);
    const res = await templateQuery.refetch();
    if (res.data) s.load(res.data);
  }, [qc, sheetId, templateQuery]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<SaveOutcome> => {
      const s = useSheetDesignerStore.getState();
      let latest: SheetTemplate | null = s.base ?? serverTemplate;
      const warnings: string[] = [];
      let unsupported: string[] = [];

      // 1) 로컬 초안 → 서버 (meta PUT → ops POST, If-Match)
      if (s.dirty && s.base && s.template) {
        const plan = buildSavePlan(s.base, s.template);
        unsupported = plan.unsupported;
        let ifMatch = plan.ifMatch;
        if (plan.meta) {
          const updated = await api.updateSheet(sheetId, plan.meta);
          latest = updated;
          if (typeof updated.version === "number") ifMatch = updated.version;
        }
        if (plan.ops.length) {
          const r = await api.applyOps(sheetId, plan.ops, ifMatch);
          latest = r.template;
          warnings.push(...(r.warnings ?? []));
        }
        if (latest) {
          // ops 까지 성공했으면 apply 가 실패해도 초안은 서버 버전에 맞춘다(재시도 시 apply 만)
          useSheetDesignerStore.getState().markSaved(latest);
          qc.setQueryData(REPORT_KEYS.sheet(latest.id), latest);
        }
      }
      if (!latest) throw new Error("저장할 시트가 없습니다.");

      // 2) 초안 → 저장 버전 고정 (생성·스케줄에서 선택 가능)
      if (latest.status === "draft") latest = await api.applySheet(sheetId);
      return { template: latest, warnings, unsupported };
    },
    onSuccess: ({ template: saved, warnings, unsupported }) => {
      qc.setQueryData(REPORT_KEYS.sheet(saved.id), saved);
      void qc.invalidateQueries({ queryKey: REPORT_KEYS.sheets });
      useSheetDesignerStore.getState().markSaved(saved);
      // 채팅 패널이 같은 시트를 보고 있으면 버전을 맞춘다(E9)
      const panel = useSheetPanelStore.getState();
      if (panel.sheetId === saved.id) {
        panel.setTemplate(saved);
        panel.markSaved(saved.version);
      }
      toast({ title: "저장 완료", description: `『${saved.name}』 v${saved.version} — 생성·스케줄에서 선택할 수 있습니다.` });
      if (unsupported.length) {
        toast({ title: "저장되지 않은 변경", description: `현 계약으로 보낼 수 없어 제외: ${unsupported.join(", ")}` });
      }
      if (warnings.length) toast({ title: "서버 경고", description: warnings.join(" · ") });
    },
    onError: (e) => {
      if (isSheetConflict(e)) {
        const s = useSheetDesignerStore.getState();
        s.setConflict({ currentVersion: e.currentVersion, template: e.template });
        if (e.template) qc.setQueryData(REPORT_KEYS.sheet(sheetId), e.template);
        showSaveConflictToast({ currentVersion: e.currentVersion, onReload: () => void reloadLatest() });
        return;
      }
      useSheetDesignerStore.getState().setSaving(false);
      toast({ title: "저장 실패", description: errMsg(e), variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (v: SaveSheetValues) => api.updateSheet(sheetId, { name: v.name, visibility: v.visibility }),
    onSuccess: (tpl) => {
      qc.setQueryData(REPORT_KEYS.sheet(tpl.id), tpl);
      void qc.invalidateQueries({ queryKey: REPORT_KEYS.sheets });
      setRenameOpen(false);
      // 디자이너 초안 동기화 — 편집 중이면 메타·버전만 갱신(If-Match 유지), 아니면 전체 재적재
      const s = useSheetDesignerStore.getState();
      if (!s.dirty) {
        s.load(tpl);
      } else {
        useSheetDesignerStore.setState((st) => ({
          base: st.base ? { ...st.base, name: tpl.name, visibility: tpl.visibility, version: tpl.version } : st.base,
          template: st.template ? { ...st.template, name: tpl.name, visibility: tpl.visibility } : st.template,
        }));
      }
    },
  });

  const handleExport = (format: SheetExportFormat) => {
    if (!work) return;
    setExporting(format);
    const body: GenerateRequest = { formats: [format], sheet_template_id: work.id };
    generateMutation.mutate(body, {
      onSuccess: (res) => {
        toast({ title: `${format.toUpperCase()} 생성 시작`, description: "완료되면 이력에 남고 뷰어에서 다운로드할 수 있습니다." });
        onOpenRun(res.run_id);
      },
      onError: (e) => {
        const msg = errMsg(e);
        toast({
          title: "생성 실패",
          description: msg.includes("429") ? "이미 생성 중인 리포트가 있습니다. 완료 후 다시 시도하세요." : msg,
          variant: "destructive",
        });
      },
      onSettled: () => setExporting(null),
    });
  };

  // ── 워크벤치 액션 ──
  const blockCount = work?.blocks.length ?? 0;
  const blockLimitReached = blockCount >= MAX_BLOCKS;

  const addFromSource = useCallback(
    (source: CatalogSource, viz: VizType) => {
      useSheetDesignerStore
        .getState()
        .addBlock({ title: source.name, source: { kind: source.kind, ref: source.ref }, viz, anchor: "auto" });
    },
    [],
  );

  const handleDropBlock = useCallback(
    (payload: BlockDragPayload, pos: BlockPos) => {
      const r = useSheetDesignerStore.getState().addBlock({ ...payload, pos });
      if (r.ok && r.placedAt === "free_slot") {
        toast({ title: "자동 재배치", description: "놓은 자리가 다른 블록과 겹쳐 가까운 빈 자리에 배치했습니다." });
      }
    },
    [toast],
  );

  const isDraft = work?.status === "draft";
  const canSave = !!work && (designer.dirty || isDraft) && !saveMutation.isPending && !designer.conflict;

  /** Ctrl+Z / Ctrl+Shift+Z·Ctrl+Y / Ctrl+S — 입력 중(속성 패널 폼) 에는 개입하지 않는다 */
  const handleWorkbenchKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      designer.undo();
    } else if (key === "y" || (key === "z" && e.shiftKey)) {
      e.preventDefault();
      designer.redo();
    } else if (key === "s") {
      e.preventDefault();
      if (canSave) saveMutation.mutate();
    }
  };

  // ── 로딩 / 오류 ──
  if (!work && templateQuery.isError) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2 ui-fs-xs">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 목록
        </Button>
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
          <p className="ui-caption ui-tone-bad">시트를 불러오지 못했습니다: {errMsg(templateQuery.error)}</p>
          <p className="ui-micro text-muted-foreground/60 mt-1">삭제됐거나 다른 회사의 시트일 수 있습니다. 리포트 서비스 연결과 로그인 상태도 확인하세요.</p>
        </div>
      </div>
    );
  }
  if (!work) {
    return (
      <div className="flex items-center gap-2 ui-caption py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> 시트 불러오는 중…
      </div>
    );
  }

  const selectedBlock = work.blocks.find((b) => b.id === designer.selectedBlockId) ?? null;
  const previewTemplate = serverTemplate ?? work;
  const saveTitle = designer.dirty
    ? "편집 내용을 서버에 반영하고 저장 버전으로 고정 (Ctrl+S)"
    : isDraft
      ? "초안을 저장 버전으로 고정 (생성·스케줄에서 선택 가능)"
      : "저장된 버전입니다";

  return (
    <div className="space-y-3">
      {/* ── 툴바 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2 ui-fs-xs">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 목록
        </Button>
        <div className="min-w-0 flex items-center gap-2">
          <span className="ui-fs-sm font-semibold tracking-tight truncate" title={work.name}>
            {work.name}
          </span>
          <span className="px-1.5 py-0.5 rounded-full ui-fs-2xs bg-foreground/[0.05] text-foreground/60 border border-border/40 tabular-nums">
            v{work.version}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full ui-fs-2xs font-medium border",
              isDraft ? "bg-warning/15 text-warning border-warning/30" : "bg-success/10 text-success border-success/30",
            )}
          >
            {isDraft ? "초안" : "저장됨"}
          </span>
          {designer.dirty && (
            <span
              className="px-1.5 py-0.5 rounded-full ui-fs-2xs font-medium border bg-primary/10 text-primary border-primary/30"
              data-testid="designer-dirty-chip"
            >
              변경 미저장
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded-full ui-fs-2xs bg-foreground/[0.05] text-foreground/60 border border-border/40">
            {VISIBILITY_LABEL_KO[work.visibility]}
          </span>
          <button
            type="button"
            onClick={() => setRenameOpen(true)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            aria-label="이름 · 공유 범위 변경"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* 되돌리기 / 다시 실행 */}
          <div className="inline-flex items-center rounded-lg border border-border/50 bg-foreground/[0.025] p-0.5">
            <button
              type="button"
              onClick={designer.undo}
              disabled={!canUndo(designer)}
              aria-label="되돌리기 (Ctrl+Z)"
              title="되돌리기 (Ctrl+Z)"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={designer.redo}
              disabled={!canRedo(designer)}
              aria-label="다시 실행 (Ctrl+Y)"
              title="다시 실행 (Ctrl+Y)"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div role="radiogroup" aria-label="보기" className="inline-flex items-center rounded-lg border border-border/50 bg-foreground/[0.025] p-0.5">
            {(
              [
                { id: "canvas", label: "캔버스", icon: LayoutGrid },
                { id: "preview", label: "미리보기", icon: Eye },
              ] as { id: DesignerViewMode; label: string; icon: typeof Eye }[]
            ).map((v) => {
              const on = view === v.id;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setView(v.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md ui-fs-xs font-medium transition-colors",
                    on ? "bg-foreground/[0.08] text-foreground" : "text-foreground/55 hover:text-foreground/85",
                  )}
                >
                  <Icon className="w-3 h-3" /> {v.label}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!canSave}
            className={cn("h-8 px-3 ui-fs-xs", canSave && "shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]")}
            title={saveTitle}
            data-testid="designer-save"
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            {designer.dirty || isDraft ? "저장" : "저장됨"}
          </Button>
        </div>
      </div>

      {/* ── 본문 ── */}
      {view === "canvas" ? (
        <div className="space-y-2" onKeyDown={handleWorkbenchKeyDown} data-testid="designer-workbench">
          <SaveConflictNotice conflict={designer.conflict} onReload={() => void reloadLatest()} />
          <BudgetExceededBanner budget={preview.budget} />

          <div
            className={cn(
              "grid gap-3 min-h-[480px]",
              selectedBlock
                ? "[grid-template-columns:260px_minmax(0,1fr)_360px]"
                : "[grid-template-columns:260px_minmax(0,1fr)]",
            )}
          >
            {/* 팔레트 (F19 좌측 260) — 셀 높이는 캔버스(A4 비율) 가 정하고 팔레트는 그 안에서 SimpleBar 스크롤 */}
            <div className="relative min-h-0 rounded-xl border border-border/40 bg-foreground/[0.02] overflow-hidden">
              <BlockPalette
                className="absolute inset-0 border-r-0 bg-transparent"
                sources={designer.catalog}
                loading={catalogQuery.isLoading}
                error={catalogQuery.isError ? errMsg(catalogQuery.error) : null}
                onRetry={() => void catalogQuery.refetch()}
                onAdd={addFromSource}
                onInfo={setInfoSource}
                addDisabled={blockLimitReached}
                addDisabledReason={blockLimitReached ? BLOCK_LIMIT_REASON : undefined}
              />
            </div>

            {/* 12열 × 14행 A4 캔버스 (F19 중앙) */}
            <div className="min-w-0 space-y-2">
              <SheetGridCanvas
                blocks={work.blocks}
                grid={work.grid}
                page={work.page}
                selectedId={designer.selectedBlockId}
                onSelect={selectBlock}
                onChange={designer.applyLayout}
                onDropBlock={handleDropBlock}
                onRemove={designer.removeBlock}
                errors={designer.lastErrors}
                emptyState={
                  <DesignerEmptyCanvas
                    onBrowseCatalog={designer.catalog?.length ? () => setInfoSource(designer.catalog?.[0] ?? null) : undefined}
                  />
                }
              />
              <PlacementErrorList errors={designer.lastErrors} onDismiss={designer.clearErrors} />
            </div>

            {/* 속성 드로어 (F20 우측 360) — 선택 시에만 (F19 는 접힘 상태) */}
            {selectedBlock && (
              <div className="relative min-h-0 rounded-xl border border-border/40 bg-foreground/[0.02] overflow-hidden">
                <BlockPropsPanel
                  className="absolute inset-0 border-l-0 bg-transparent"
                  block={selectedBlock}
                  sources={designer.catalog}
                  grid={work.grid}
                  others={work.blocks}
                  onChange={designer.updateBlock}
                  onDelete={designer.removeBlock}
                  onDuplicate={designer.duplicateBlock}
                  onClose={() => selectBlock(null)}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <SheetPreviewPanel
          template={previewTemplate}
          html={preview.version === previewTemplate.version ? preview.html : null}
          loading={preview.loading}
          error={preview.error}
          onRetry={() => void runPreview(preview.mode)}
          mode={preview.mode}
          onModeChange={(m) => void runPreview(m)}
          budget={preview.budget}
          elapsedMs={preview.elapsedMs}
          blockData={preview.blockData}
          warnings={designer.dirty ? [UNSAVED_PREVIEW_WARNING] : []}
          onExport={handleExport}
          exporting={exporting}
          exportDisabledReason={isDraft || designer.dirty ? "저장 후 PDF/PPTX 생성이 가능합니다" : null}
          selectedBlockId={designer.selectedBlockId}
          onSelectBlock={selectBlock}
          showGrid
        />
      )}

      {/* 하단 상태바 */}
      <div className="flex items-center gap-3 ui-micro text-muted-foreground/70 px-0.5">
        <span>
          블록 {blockCount}/{MAX_BLOCKS}
        </span>
        <span>·</span>
        <span>{work.page.orientation === "portrait" ? "A4 세로" : "A4 가로"} · {work.grid.cols}열 × {work.grid.rows}행</span>
        {serverTemplate?.updated_at && (
          <>
            <span>·</span>
            <span>마지막 저장 {new Date(serverTemplate.updated_at).toLocaleString("ko-KR", { hour12: false })}</span>
          </>
        )}
        {designer.dirty && (
          <>
            <span>·</span>
            <span className="text-primary/80">되돌리기 {designer.past.length}단계</span>
          </>
        )}
        {selectedBlock && (
          <>
            <span>·</span>
            <span className="text-foreground/80">선택: {selectedBlock.title}</span>
          </>
        )}
      </div>

      {/* 소스 카탈로그 상세 (F21) */}
      <SourceCatalogDialog
        source={infoSource}
        open={infoSource !== null}
        onOpenChange={(o) => !o && setInfoSource(null)}
        onAdd={(s, viz) => {
          addFromSource(s, viz);
          setInfoSource(null);
        }}
        addDisabled={blockLimitReached}
        addDisabledReason={blockLimitReached ? BLOCK_LIMIT_REASON : undefined}
      />

      <SaveSheetDialog
        open={renameOpen}
        onOpenChange={(o) => {
          if (!o) renameMutation.reset();
          setRenameOpen(o);
        }}
        title="이름 · 공유 범위 변경"
        description="블록 구성은 바뀌지 않습니다."
        initial={{ name: work.name, visibility: work.visibility }}
        submitLabel="변경"
        pending={renameMutation.isPending}
        error={renameMutation.isError ? errMsg(renameMutation.error) : null}
        onSubmit={(v) => renameMutation.mutate(v)}
      />
    </div>
  );
}
