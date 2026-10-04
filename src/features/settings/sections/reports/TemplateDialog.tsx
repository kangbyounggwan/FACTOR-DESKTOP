/**
 * 템플릿 편집 모달 (F11 → F24 스케줄 연결) — 실체는 해당 persona 스케줄 생성/수정.
 *
 * 백엔드 계약 (backend_router.ScheduleCreate/SchedulePatch + 마이그 097 `report_schedules.sheet_template_id`):
 *   · 템플릿명 = 코드 고정(PERSONAS) — read-only
 *   · 발송 주기 = CronScheduleBuilder(매일/매주/매월/직접)
 *   · 포맷 = pdf/html/pptx 다중선택 칩
 *   · 시트 템플릿 = select(페르소나 기본 vs 사용자 저장 시트) → `sheet_template_id` (F24)
 *   · 섹션 구성 토글 6종(F11) 은 제거 — 디자이너 시트 템플릿으로 대체되었음을 안내 + "디자이너 열기"
 *   · 수신 그룹 칩 = report_recipients 역할 목록 (read-only)
 */
import { useSubmitOnEnter } from "@/hooks/useSubmitOnEnter";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CronScheduleBuilder } from "@/features/reports";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type {
  Persona,
  PersonaTemplate,
  ReportFormat,
  ReportSchedule,
  ScheduleCreate,
  SchedulePatch,
} from "@desktop/api/reports";

import { templateDisplayName } from "./meta";
import { SheetTemplateSelect } from "./ReportsDesignerTab";
import {
  useCreateReportSchedule,
  useDeleteReportSchedule,
  usePatchReportSchedule,
} from "./useReports";

/**
 * 마이그 097 `report_schedules.sheet_template_id` — `api/reports.ts` 의 Schedule* 타입에
 * 필드가 들어오기 전까지의 로컬 확장(백엔드 계약: null = 페르소나 기본 템플릿).
 */
type SheetLink = { sheet_template_id?: string | null };

const FORMAT_OPTIONS: ReportFormat[] = ["pdf", "html", "pptx"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: Persona;
  template?: PersonaTemplate;
  schedule?: ReportSchedule;
  recipientRoles: string[];
}

export function TemplateDialog({
  open,
  onOpenChange,
  persona,
  template,
  schedule,
  recipientRoles,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createMutation = useCreateReportSchedule();
  const patchMutation = usePatchReportSchedule();
  const deleteMutation = useDeleteReportSchedule();

  const [cron, setCron] = useState("10 8 * * *");
  const [formats, setFormats] = useState<ReportFormat[]>(["pdf"]);
  /** null = 페르소나 기본 템플릿 */
  const [sheetTemplateId, setSheetTemplateId] = useState<string | null>(null);

  const isPending =
    createMutation.isPending || patchMutation.isPending || deleteMutation.isPending;

  // 열릴 때 기존 스케줄로 초기화
  useEffect(() => {
    if (!open) return;
    if (schedule) {
      setCron(schedule.cron);
      setFormats(
        schedule.formats.length > 0 ? [...schedule.formats] : ["pdf"],
      );
      setSheetTemplateId((schedule as ReportSchedule & SheetLink).sheet_template_id ?? null);
    } else {
      setCron("10 8 * * *");
      setFormats(
        (template?.default_formats?.filter((f): f is ReportFormat =>
          (FORMAT_OPTIONS as string[]).includes(f),
        ) as ReportFormat[] | undefined) ?? ["pdf"],
      );
      setSheetTemplateId(null);
    }
  }, [open, schedule, template]);

  const toggleFormat = (f: ReportFormat) => {
    setFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  };

  const handleSave = () => {
    const c = cron.trim();
    if (c.split(/\s+/).length !== 5) {
      toast({
        title: "발송 주기 오류",
        description: "cron 은 5개 필드여야 합니다. (예: 10 8 * * *)",
        variant: "destructive",
      });
      return;
    }
    if (formats.length === 0) {
      toast({
        title: "포맷을 1개 이상 선택하세요.",
        variant: "destructive",
      });
      return;
    }
    const opts = {
      onSuccess: () => {
        toast({
          title: "저장 완료",
          description: "발송 예약이 저장되었습니다. (Asia/Seoul 기준)",
        });
        onOpenChange(false);
      },
      onError: (error: Error) =>
        toast({
          title: "저장 실패",
          description: error.message,
          variant: "destructive",
        }),
    };
    if (schedule) {
      const body: SchedulePatch & SheetLink = { cron: c, formats, sheet_template_id: sheetTemplateId };
      patchMutation.mutate({ id: schedule.id, body }, opts);
    } else {
      const body: ScheduleCreate & SheetLink = { cron: c, persona, formats, sheet_template_id: sheetTemplateId };
      createMutation.mutate(body, opts);
    }
  };

  /** 디자이너로 — 선택된 시트가 있으면 그 시트를 바로 연다(E9 같은 sheet_id) */
  const openDesigner = () => {
    onOpenChange(false);
    const q = sheetTemplateId ? "&sheet=" + encodeURIComponent(sheetTemplateId) : "";
    navigate("/reports?tab=designer" + q);
  };

  const handleDeleteSchedule = () => {
    if (!schedule) return;
    deleteMutation.mutate(schedule.id, {
      onSuccess: () => {
        toast({ title: "예약 삭제 완료" });
        onOpenChange(false);
      },
      onError: (error) =>
        toast({
          title: "예약 삭제 실패",
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        }),
    });
  };

  const handleEnterKey = useSubmitOnEnter(handleSave, { enabled: !isPending });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={handleEnterKey} className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2.5">
            템플릿 편집
            <span className="ui-micro font-normal">
              {templateDisplayName(persona, template)}
            </span>
          </DialogTitle>
          <DialogDescription>
            발송 주기·포맷·시트 템플릿을 설정합니다. 레이아웃은 디자이너 시트가 결정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 템플릿명 — 코드 고정 (read-only) */}
          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              템플릿명
            </Label>
            <Input
              value={templateDisplayName(persona, template)}
              disabled
              className="h-9 ui-fs-xs"
            />
          </div>

          {/* 발송 주기 — 캘린더 연동 빌더 (매일/매주/매월/직접) */}
          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              발송 주기
            </Label>
            <CronScheduleBuilder value={cron} onChange={setCron} />
          </div>

          {/* 포맷 */}
          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              포맷
            </Label>
            <div className="flex items-center gap-1.5">
              {FORMAT_OPTIONS.map((f) => {
                const selected = formats.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormat(f)}
                    aria-pressed={selected}
                    className={cn(
                      "px-2.5 py-1 rounded-full ui-fs-xs font-medium uppercase border transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-foreground/[0.04] text-foreground/70 border-border/50 hover:bg-foreground/[0.07]",
                    )}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 시트 템플릿 (F24) — 페르소나 기본 vs 사용자 저장 시트 → sheet_template_id */}
          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              시트 템플릿
            </Label>
            <SheetTemplateSelect
              value={sheetTemplateId}
              onChange={setSheetTemplateId}
              personaLabel={templateDisplayName(persona, template)}
              disabled={isPending}
            />
          </div>

          {/* 섹션 구성 토글(F11 6종) 제거 — 디자이너 시트 템플릿으로 대체 안내 */}
          <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-foreground/[0.02] px-3 py-2.5">
            <LayoutGrid className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="ui-fs-xs text-foreground/85">
                섹션 구성(KPI 요약 · 품질 · 생산 실적 · 예측 · 비가동 · 매출 토글) 은{" "}
                <span className="font-semibold">디자이너의 시트 템플릿</span>으로 대체되었습니다.
              </p>
              <p className="ui-micro text-muted-foreground/70 mt-0.5 leading-relaxed">
                블록(데이터 소스 × 기간 × 집계 × 차트) 과 위치를 디자이너에서 구성해 저장한 뒤 위에서 선택하세요.
                옛 "매출" 자리는 공장별 출하금액(EIS) 블록이 대신합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={openDesigner}
              className="ui-fs-xs text-primary hover:underline underline-offset-2 flex-shrink-0"
            >
              디자이너 열기
            </button>
          </div>

          {/* 수신 그룹 — report_recipients 역할 목록 (read-only) */}
          <div className="space-y-2">
            <p className="ui-fs-xs text-primary font-medium tracking-tight">
              수신 그룹
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {recipientRoles.length > 0 ? (
                recipientRoles.map((r) => (
                  <span
                    key={r}
                    className="px-2.5 py-1 rounded-full ui-fs-xs font-medium bg-primary/15 text-primary border border-primary/30"
                  >
                    {r}
                  </span>
                ))
              ) : (
                <span className="ui-micro text-muted-foreground/70">
                  구독 수신자 없음 — [수신자] 탭에서 구독 템플릿을 지정하세요.
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className={cn(schedule && "sm:justify-between")}>
          {schedule && (
            <Button
              variant="ghost"
              onClick={handleDeleteSchedule}
              disabled={isPending}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mr-auto"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              예약 삭제
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
