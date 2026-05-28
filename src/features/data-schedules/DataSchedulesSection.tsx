/**
 * factor-desktop Settings — ETL 스케쥴 (data_schedules) CRUD 패널.
 *
 * 동작:
 *   - 회사별 data_schedules row 목록 (table)
 *   - status badge: ok / error / circuit_open / paused
 *   - + Add — DataScheduleDialog (생성)
 *   - row click — DataScheduleDialog (수정)
 *   - toggle / delete / reset-circuit 1-click 액션
 *
 * 의존:
 *   - @desktop/api/dataSchedules (data-connector /api/data-schedules)
 *   - @desktop/features/data-schedules/useDataSchedules (React Query)
 *   - @/components/ui/* (FE leaf, shadcn — 공유 OK)
 *   - @/features/auth (로그인 user 의 company_id)
 *
 * 룰: R1 (FE page 미import) / R6 (페이지는 자체) 준수.
 */
import { useMemo, useState } from "react";
import { Plus, Power, RefreshCw, Trash2, AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth";
import { useToast } from "@/hooks/use-toast";

import { DataScheduleDialog } from "./DataScheduleDialog";
import {
  useDataSchedulesList,
  useDeleteDataSchedule,
  useResetCircuit,
  useToggleDataSchedule,
  type DataSchedule,
} from "./useDataSchedules";

function formatInterval(s: DataSchedule): string {
  if (s.schedule_type === "cron") return s.cron_expression ?? "cron";
  const sec = s.interval_seconds ?? 0;
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}시간 전`;
  return `${Math.round(diff / 86_400_000)}일 전`;
}

function StatusBadge({ schedule }: { schedule: DataSchedule }) {
  const now = Date.now();
  const circuitOpen =
    schedule.circuit_open_until && new Date(schedule.circuit_open_until).getTime() > now;

  if (!schedule.enabled) {
    return <Badge variant="secondary">일시정지</Badge>;
  }
  if (circuitOpen) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Circuit Open
      </Badge>
    );
  }
  if (schedule.last_status === "error") {
    return <Badge variant="destructive">에러</Badge>;
  }
  if (schedule.last_status === "ok") {
    return <Badge variant="default">정상</Badge>;
  }
  return <Badge variant="outline">대기</Badge>;
}

export function DataSchedulesSection() {
  const { profile } = useAuth();
  const companyId = profile?.company_id ?? undefined;
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DataSchedule | null>(null);

  const { data, isLoading, isError, error } = useDataSchedulesList(companyId);
  const toggle = useToggleDataSchedule();
  const del = useDeleteDataSchedule();
  const reset = useResetCircuit();

  const schedules = useMemo(() => data?.items ?? [], [data?.items]);

  const handleNew = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };
  const handleEdit = (s: DataSchedule) => {
    setEditTarget(s);
    setDialogOpen(true);
  };

  const handleToggle = (s: DataSchedule) => {
    toggle.mutate(s.id, {
      onSuccess: (next) =>
        toast({
          title: next.enabled ? "재개됨" : "일시정지됨",
          description: `${s.name}`,
        }),
      onError: (e) =>
        toast({
          title: "토글 실패",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        }),
    });
  };

  const handleDelete = (s: DataSchedule) => {
    if (!confirm(`'${s.name}' 스케쥴을 삭제할까요?`)) return;
    del.mutate(s.id, {
      onSuccess: () => toast({ title: "삭제됨", description: s.name }),
      onError: (e) =>
        toast({
          title: "삭제 실패",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        }),
    });
  };

  const handleReset = (s: DataSchedule) => {
    reset.mutate(s.id, {
      onSuccess: () =>
        toast({ title: "Circuit 초기화됨", description: s.name }),
      onError: (e) =>
        toast({
          title: "초기화 실패",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">ETL 스케쥴</h2>
          <p className="text-sm text-muted-foreground mt-1">
            회사별 MES → Supabase 동기화 작업 (data_schedules v2). 회사 ID hash 로
            자동 분산되며, 운영 중 변경은 즉시 반영됩니다.
          </p>
        </div>
        <Button onClick={handleNew} disabled={!companyId}>
          <Plus className="h-4 w-4 mr-1" /> 새 스케쥴
        </Button>
      </div>

      {!companyId && (
        <div className="text-sm text-muted-foreground">
          로그인된 회사 정보가 없어 스케쥴을 불러올 수 없습니다.
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      )}
      {isError && (
        <div className="text-sm text-destructive">
          로드 실패: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {!isLoading && !isError && schedules.length === 0 && (
        <div className="text-sm text-muted-foreground">
          등록된 스케쥴이 없습니다. 우측 상단의 '+ 새 스케쥴' 로 추가하세요.
        </div>
      )}

      {schedules.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>Vendor / Method</TableHead>
              <TableHead>주기</TableHead>
              <TableHead>Offset</TableHead>
              <TableHead>우선순위</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>최근 실행</TableHead>
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => handleEdit(s)}
              >
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.adapter_type} / {s.method_name}
                </TableCell>
                <TableCell>{formatInterval(s)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.minute_offset}m
                </TableCell>
                <TableCell className="text-xs">{s.priority}</TableCell>
                <TableCell><StatusBadge schedule={s} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelative(s.last_run_at)}
                </TableCell>
                <TableCell
                  className="text-right space-x-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    title={s.enabled ? "일시정지" : "재개"}
                    onClick={() => handleToggle(s)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  {s.circuit_open_until && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Circuit 초기화"
                      onClick={() => handleReset(s)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="삭제"
                    onClick={() => handleDelete(s)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DataScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={companyId}
        target={editTarget}
      />
    </div>
  );
}
