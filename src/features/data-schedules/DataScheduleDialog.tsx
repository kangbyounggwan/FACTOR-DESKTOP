/**
 * 신규 스케쥴 생성 + 기존 스케쥴 수정 통합 다이얼로그.
 */
import { useEffect, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { useMyAdapterType } from "@desktop/features/api-catalog";

import {
  useCreateDataSchedule,
  useUpdateDataSchedule,
  type DataSchedule,
} from "./useDataSchedules";

interface DataScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  target: DataSchedule | null;
}

interface FormState {
  name: string;
  adapter_type: string;
  method_name: string;
  params_template: string; // JSON 문자열 (다이얼로그 내부)
  schedule_type: "interval" | "cron";
  interval_seconds: number;
  cron_expression: string;
  max_concurrent_calls: number;
  rate_limit_per_min: number;
  priority: "premium" | "standard" | "low";
  target_table: string;
  write_strategy: "upsert" | "append" | "replace" | "none" | "";
  notes: string;
  enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  name: "",
  adapter_type: "",                 // 회사에서 해석(useMyAdapterType) — 벤더 리터럴 기본값 없음
  method_name: "",
  params_template: "{}",
  schedule_type: "interval",
  interval_seconds: 60,
  cron_expression: "",
  max_concurrent_calls: 5,
  rate_limit_per_min: 60,
  priority: "standard",
  target_table: "",
  write_strategy: "",
  notes: "",
  enabled: true,
};

function targetToForm(t: DataSchedule): FormState {
  return {
    name: t.name,
    adapter_type: t.adapter_type,
    method_name: t.method_name,
    params_template: JSON.stringify(t.params_template ?? {}, null, 2),
    schedule_type: t.schedule_type,
    interval_seconds: t.interval_seconds ?? 60,
    cron_expression: t.cron_expression ?? "",
    max_concurrent_calls: t.max_concurrent_calls,
    rate_limit_per_min: t.rate_limit_per_min ?? 60,
    priority: t.priority,
    target_table: t.target_table ?? "",
    write_strategy: (t.write_strategy as FormState["write_strategy"]) ?? "",
    notes: t.notes ?? "",
    enabled: t.enabled,
  };
}

export function DataScheduleDialog({
  open,
  onOpenChange,
  companyId,
  target,
}: DataScheduleDialogProps) {
  const { toast } = useToast();
  const create = useCreateDataSchedule();
  const update = useUpdateDataSchedule();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [paramsError, setParamsError] = useState<string | null>(null);
  const { data: myAdapterType } = useMyAdapterType();   // 회사 벤더 해석(하드코딩 제거)

  useEffect(() => {
    if (open) {
      // 신규 = 회사 adapter_type 프리필(해석 전이면 빈값), 편집 = 기존 행 값
      setForm(
        target
          ? targetToForm(target)
          : { ...DEFAULT_FORM, adapter_type: myAdapterType ?? "" },
      );
      setParamsError(null);
    }
  }, [open, target, myAdapterType]);

  const isEdit = target !== null;
  const pending = create.isPending || update.isPending;

  const handleSubmit = () => {
    let params: Record<string, unknown> = {};
    try {
      params = form.params_template.trim() ? JSON.parse(form.params_template) : {};
      if (typeof params !== "object" || Array.isArray(params)) {
        throw new Error("params_template 은 JSON 객체여야 합니다");
      }
      setParamsError(null);
    } catch (e) {
      setParamsError(e instanceof Error ? e.message : String(e));
      return;
    }

    const body = {
      name: form.name.trim(),
      adapter_type: form.adapter_type.trim(),
      method_name: form.method_name.trim(),
      params_template: params,
      schedule_type: form.schedule_type,
      interval_seconds:
        form.schedule_type === "interval" ? form.interval_seconds : null,
      cron_expression:
        form.schedule_type === "cron" ? form.cron_expression.trim() : null,
      max_concurrent_calls: form.max_concurrent_calls,
      rate_limit_per_min: form.rate_limit_per_min || null,
      priority: form.priority,
      target_table: form.target_table.trim() || null,
      write_strategy: form.write_strategy || null,
      notes: form.notes.trim() || null,
      enabled: form.enabled,
    };

    if (isEdit && target) {
      update.mutate(
        { id: target.id, body },
        {
          onSuccess: () => {
            toast({ title: "수정됨", description: body.name });
            onOpenChange(false);
          },
          onError: (e) =>
            toast({
              title: "수정 실패",
              description: e instanceof Error ? e.message : String(e),
              variant: "destructive",
            }),
        },
      );
    } else {
      if (!companyId) {
        toast({ title: "company_id 누락", variant: "destructive" });
        return;
      }
      create.mutate(
        { company_id: companyId, ...body } as Parameters<typeof create.mutate>[0],
        {
          onSuccess: () => {
            toast({ title: "생성됨", description: body.name });
            onOpenChange(false);
          },
          onError: (e) =>
            toast({
              title: "생성 실패",
              description: e instanceof Error ? e.message : String(e),
              variant: "destructive",
            }),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `스케쥴 수정 — ${target.name}` : "새 ETL 스케쥴"}
          </DialogTitle>
          <DialogDescription>
            data_schedules row 를 생성/수정합니다. minute_offset 은 생성 시 자동
            분산 (hash 기반).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-1">
            <Label>이름 *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="realtime_sync"
              disabled={isEdit}
            />
          </div>

          <div className="space-y-1">
            <Label>Adapter type *</Label>
            <Input
              value={form.adapter_type}
              onChange={(e) => setForm({ ...form, adapter_type: e.target.value })}
              placeholder={myAdapterType ?? "회사 MES 벤더"}
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1">
            <Label>Method name *</Label>
            <Input
              value={form.method_name}
              onChange={(e) => setForm({ ...form, method_name: e.target.value })}
              placeholder="get_station_status"
              disabled={isEdit}
            />
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Params (JSON)</Label>
            <Textarea
              rows={3}
              value={form.params_template}
              onChange={(e) =>
                setForm({ ...form, params_template: e.target.value })
              }
              placeholder='{"plant_uid":"SEOHAN-PL001"}'
              className="font-mono text-xs"
            />
            {paramsError && (
              <p className="text-xs text-destructive">{paramsError}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Schedule type</Label>
            <Select
              value={form.schedule_type}
              onValueChange={(v) =>
                setForm({ ...form, schedule_type: v as FormState["schedule_type"] })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interval">interval</SelectItem>
                <SelectItem value="cron">cron</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.schedule_type === "interval" ? (
            <div className="space-y-1">
              <Label>Interval (초)</Label>
              <Input
                type="number"
                value={form.interval_seconds}
                onChange={(e) =>
                  setForm({ ...form, interval_seconds: Number(e.target.value) })
                }
                min={1}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Cron expression</Label>
              <Input
                value={form.cron_expression}
                onChange={(e) =>
                  setForm({ ...form, cron_expression: e.target.value })
                }
                placeholder="0,15,30,45 * * * *"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Max concurrent</Label>
            <Input
              type="number"
              value={form.max_concurrent_calls}
              onChange={(e) =>
                setForm({ ...form, max_concurrent_calls: Number(e.target.value) })
              }
              min={1}
              max={50}
            />
          </div>
          <div className="space-y-1">
            <Label>Rate / min (0=무제한)</Label>
            <Input
              type="number"
              value={form.rate_limit_per_min}
              onChange={(e) =>
                setForm({ ...form, rate_limit_per_min: Number(e.target.value) })
              }
              min={0}
            />
          </div>

          <div className="space-y-1">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm({ ...form, priority: v as FormState["priority"] })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">premium</SelectItem>
                <SelectItem value="standard">standard</SelectItem>
                <SelectItem value="low">low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Write strategy</Label>
            <Select
              value={form.write_strategy || "none"}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  write_strategy:
                    v === "none" ? "" : (v as FormState["write_strategy"]),
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none (적재 안 함)</SelectItem>
                <SelectItem value="upsert">upsert</SelectItem>
                <SelectItem value="append">append</SelectItem>
                <SelectItem value="replace">replace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Target table (옵션)</Label>
            <Input
              value={form.target_table}
              onChange={(e) =>
                setForm({ ...form, target_table: e.target.value })
              }
              placeholder="equipment_runtime"
            />
          </div>

          <div className="col-span-2 space-y-1">
            <Label>메모 (옵션)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="col-span-2 flex items-center justify-between border-t pt-3">
            <div>
              <Label className="text-sm">활성화</Label>
              <p className="text-xs text-muted-foreground">
                꺼두면 scheduler 가 이 row 를 skip 합니다.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "저장 중…" : isEdit ? "수정" : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
