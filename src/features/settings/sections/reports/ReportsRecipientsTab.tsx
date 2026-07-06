/**
 * 보고서 관리 — [수신자] 탭 (F8).
 *
 * report_recipients (supabase 직접 CRUD, 마이그 070). 테이블:
 * 이름 / 이메일 / 역할 / 구독 템플릿 / 활성 ON·OFF / 편집.
 * [＋ 수신자 추가] 버튼은 부모(탭 바 우측)에서 열고, 다이얼로그 상태는
 * 본 컴포넌트가 관리 (addOpen prop).
 */
import { memo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { PERSONA_LABEL } from "./meta";
import { RecipientDialog } from "./RecipientDialog";
import {
  useReportRecipients,
  useUpdateRecipient,
  type ReportRecipient,
} from "./useReports";

interface Props {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

export const ReportsRecipientsTab = memo(function ReportsRecipientsTab({
  addOpen,
  onAddOpenChange,
}: Props) {
  const { toast } = useToast();
  const recipientsQuery = useReportRecipients();
  const updateMutation = useUpdateRecipient();
  const [editing, setEditing] = useState<ReportRecipient | null>(null);

  const recipients = recipientsQuery.data ?? [];

  const handleToggle = (r: ReportRecipient, enabled: boolean) => {
    updateMutation.mutate(
      { id: r.id, patch: { enabled } },
      {
        onError: (error) =>
          toast({
            title: "변경 실패",
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-4">
      {recipientsQuery.isLoading ? (
        <SkeletonRows />
      ) : recipientsQuery.isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
          <p className="text-[11.5px] text-red-300">
            수신자 목록을 불러오지 못했습니다:{" "}
            {recipientsQuery.error instanceof Error
              ? recipientsQuery.error.message
              : String(recipientsQuery.error)}
          </p>
        </div>
      ) : recipients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-foreground/[0.015] px-6 py-12 text-center">
          <p className="text-[12px] text-foreground/65">수신자가 없습니다.</p>
          <p className="text-[11.5px] text-muted-foreground/60 mt-1">
            우측 상단 [＋ 수신자 추가]로 리포트 수신자를 등록하세요.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-[110px]" />
              <col />
              <col className="w-[100px]" />
              <col className="w-[150px]" />
              <col className="w-[90px]" />
              <col className="w-[64px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <ColHeader>이름</ColHeader>
                <ColHeader>이메일</ColHeader>
                <ColHeader>역할</ColHeader>
                <ColHeader>구독 템플릿</ColHeader>
                <ColHeader>활성</ColHeader>
                <ColHeader>편집</ColHeader>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/30 last:border-b-0 hover:bg-foreground/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-[11.5px] text-foreground font-medium tracking-tight truncate block">
                      {r.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11.5px] font-mono text-foreground/60 truncate block">
                      {r.email}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "text-[11.5px]",
                        r.role === "임원" ? "text-primary" : "text-foreground/75",
                      )}
                    >
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11.5px] text-foreground/65 truncate block">
                      {(r.subscribed_templates ?? []).length > 0
                        ? (r.subscribed_templates ?? [])
                            .map((p) => PERSONA_LABEL[p] ?? p)
                            .join("+")
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(v) => handleToggle(r, v)}
                        aria-label={`${r.name} 활성 여부`}
                        className="scale-90 origin-left"
                      />
                      <span
                        className={cn(
                          "text-[11px]",
                          r.enabled ? "text-emerald-300" : "text-foreground/40",
                        )}
                      >
                        {r.enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="text-[11.5px] text-primary hover:underline underline-offset-2"
                    >
                      편집
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 추가 모달 (F10) */}
      <RecipientDialog
        open={addOpen}
        onOpenChange={onAddOpenChange}
        recipient={null}
      />
      {/* 편집 모달 */}
      <RecipientDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        recipient={editing}
      />
    </div>
  );
});

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/65 font-medium text-left">
      {children}
    </th>
  );
}

function SkeletonRows() {
  return (
    <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
      <div className="divide-y divide-border/30">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
            <div className="h-3 w-20 bg-foreground/[0.06] rounded" />
            <div className="h-3 flex-1 bg-foreground/[0.04] rounded" />
            <div className="h-3 w-16 bg-foreground/[0.05] rounded" />
            <div className="h-3 w-24 bg-foreground/[0.04] rounded" />
            <div className="h-4 w-9 bg-foreground/[0.05] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
