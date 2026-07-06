/**
 * 템플릿 편집 모달 (F11) — 실체는 해당 persona 스케줄 생성/수정.
 *
 * 백엔드 계약 (backend_router.ScheduleCreate/SchedulePatch): cron / persona /
 * request_template / formats 만 수정 가능. 그래서:
 *   · 템플릿명 = 코드 고정(PERSONAS) — read-only
 *   · 발송 시각 = "매일 HH:MM" 프리셋 select + 커스텀 cron 텍스트
 *   · 포맷 = pdf/html/pptx 다중선택 칩
 *   · 섹션 구성 토글 6개 = 백엔드 미지원 — 디자인대로 렌더하되 disabled +
 *     "연동 예정" 툴팁 (매출 포함)
 *   · 수신 그룹 칩 = report_recipients 역할 목록 (read-only)
 */
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type {
  Persona,
  PersonaTemplate,
  ReportFormat,
  ReportSchedule,
} from "@desktop/api/reports";

import {
  buildCron,
  parseCron,
  templateDisplayName,
  type CronMode,
} from "./meta";
import {
  useCreateReportSchedule,
  useDeleteReportSchedule,
  usePatchReportSchedule,
} from "./useReports";

/** 섹션 구성 토글 — 디자인(F11) 고정 6종. 전부 백엔드 미지원 → disabled. */
const SECTION_TOGGLES: { label: string; defaultOn: boolean }[] = [
  { label: "KPI 요약", defaultOn: true },
  { label: "품질", defaultOn: true },
  { label: "생산 실적", defaultOn: true },
  { label: "예측", defaultOn: true },
  { label: "비가동 / 원인", defaultOn: true },
  { label: "매출 (연동 예정)", defaultOn: false },
];

const FORMAT_OPTIONS: ReportFormat[] = ["pdf", "html", "pptx"];

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

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
  const createMutation = useCreateReportSchedule();
  const patchMutation = usePatchReportSchedule();
  const deleteMutation = useDeleteReportSchedule();

  const [mode, setMode] = useState<CronMode>("daily");
  const [time, setTime] = useState("08:10");
  const [weekday, setWeekday] = useState(1);
  const [customCron, setCustomCron] = useState("");
  const [formats, setFormats] = useState<ReportFormat[]>(["pdf"]);

  const isPending =
    createMutation.isPending || patchMutation.isPending || deleteMutation.isPending;

  // 열릴 때 기존 스케줄로 초기화
  useEffect(() => {
    if (!open) return;
    if (schedule) {
      const p = parseCron(schedule.cron);
      setMode(p.mode);
      setTime(p.time);
      setWeekday(p.weekday);
      setCustomCron(schedule.cron);
      setFormats(
        schedule.formats.length > 0 ? [...schedule.formats] : ["pdf"],
      );
    } else {
      setMode("daily");
      setTime("08:10");
      setWeekday(1);
      setCustomCron("10 8 * * *");
      setFormats(
        (template?.default_formats?.filter((f): f is ReportFormat =>
          (FORMAT_OPTIONS as string[]).includes(f),
        ) as ReportFormat[] | undefined) ?? ["pdf"],
      );
    }
  }, [open, schedule, template]);

  const toggleFormat = (f: ReportFormat) => {
    setFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  };

  const resolveCron = (): string | null => {
    if (mode === "custom") {
      const c = customCron.trim();
      if (c.split(/\s+/).length !== 5) return null;
      return c;
    }
    if (!/^\d{1,2}:\d{1,2}$/.test(time.trim())) return null;
    return buildCron(mode, time, weekday);
  };

  const handleSave = () => {
    const cron = resolveCron();
    if (!cron) {
      toast({
        title: "발송 시각 오류",
        description:
          mode === "custom"
            ? "cron 은 5개 필드여야 합니다. (예: 10 8 * * *)"
            : "시각은 HH:MM 형식으로 입력하세요. (예: 08:10)",
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
      patchMutation.mutate({ id: schedule.id, body: { cron, formats } }, opts);
    } else {
      createMutation.mutate({ cron, persona, formats }, opts);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2.5">
            템플릿 편집
            <span className="text-[11.5px] font-normal text-muted-foreground">
              {templateDisplayName(persona, template)}
            </span>
          </DialogTitle>
          <DialogDescription>
            발송 주기·포맷을 설정합니다. 섹션 구성은 템플릿 코드에 고정되어 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 템플릿명 — 코드 고정 (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-[11.5px] text-foreground/85 font-medium tracking-tight">
              템플릿명
            </Label>
            <Input
              value={templateDisplayName(persona, template)}
              disabled
              className="h-9 text-[11.5px]"
            />
          </div>

          {/* 유형(주기) + 발송 시각 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-foreground/85 font-medium tracking-tight">
                유형
              </Label>
              <Select value={mode} onValueChange={(v) => setMode(v as CronMode)}>
                <SelectTrigger className="h-9 text-[11.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">일일</SelectItem>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="custom">커스텀 (cron)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-foreground/85 font-medium tracking-tight">
                발송 시각
              </Label>
              {mode === "custom" ? (
                <Input
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="10 8 * * *"
                  className="h-9 text-[11.5px] font-mono"
                />
              ) : (
                <div className="flex items-center gap-2">
                  {mode === "weekly" && (
                    <Select
                      value={String(weekday)}
                      onValueChange={(v) => setWeekday(Number(v))}
                    >
                      <SelectTrigger className="h-9 text-[11.5px] w-[76px] flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAY_KO.map((d, i) => (
                          <SelectItem key={d} value={String(i)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="08:10"
                    className="h-9 text-[11.5px] font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 포맷 */}
          <div className="space-y-1.5">
            <Label className="text-[11.5px] text-foreground/85 font-medium tracking-tight">
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
                      "px-2.5 py-1 rounded-full text-[11px] font-medium uppercase border transition-colors",
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

          {/* 섹션 구성 — 백엔드 미지원, disabled + 연동 예정 툴팁 */}
          <div className="space-y-2">
            <p className="text-[11.5px] text-primary font-medium tracking-tight">
              섹션 구성
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {SECTION_TOGGLES.map((s) => (
                <Tooltip key={s.label}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between gap-2 cursor-not-allowed">
                      <span className="text-[11.5px] text-foreground/60">
                        {s.label}
                      </span>
                      <Switch
                        checked={s.defaultOn}
                        disabled
                        aria-label={s.label}
                        className="scale-90 origin-right opacity-60"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    연동 예정
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* 수신 그룹 — report_recipients 역할 목록 (read-only) */}
          <div className="space-y-2">
            <p className="text-[11.5px] text-primary font-medium tracking-tight">
              수신 그룹
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {recipientRoles.length > 0 ? (
                recipientRoles.map((r) => (
                  <span
                    key={r}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/15 text-primary border border-primary/30"
                  >
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-muted-foreground/70">
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
