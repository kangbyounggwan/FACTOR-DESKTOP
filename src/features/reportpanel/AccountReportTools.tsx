import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSheetPanelStore } from "@/features/reports/designer/core";
import { accountReportApi, sheetApi } from "@desktop/api/reports";
import { ReportContentMissions } from "./ReportContentMissions";

interface Props {
  accountScope: string;
  conversationId: string | null;
  revision: number;
}

export function AccountReportTools({ accountScope, conversationId, revision }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const sheet = useSheetPanelStore();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const formatKey = ["reports", "accountFormat", accountScope];
  const format = useQuery({ queryKey: formatKey, queryFn: accountReportApi.getFormat, retry: false });
  const list = useQuery({ queryKey: ["reports", "accountFormatChoices", accountScope, sheet.version],
    queryFn: () => sheetApi.listSheets({ status: "saved" }), retry: false });
  const fail = (error: unknown) => {
    if (active.current) toast({ title: "보고서 요청 실패",
      description: error instanceof Error ? error.message : String(error), variant: "destructive" });
  };
  const bind = useMutation({ mutationFn: accountReportApi.setFormat,
    onSuccess: (result) => {
      if (!active.current) return;
      qc.setQueryData(formatKey, result);
      toast({ title: result.configured ? "계정 보고서 양식 지정됨" : "EIS 임원용 기본 양식 적용됨" });
    }, onError: fail });

  return (
    <div className="border-b border-border/40 px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <BookmarkCheck className="w-4 h-4 shrink-0 text-muted-foreground" />
        <select aria-label="계정 보고서 양식" disabled={bind.isPending || format.isPending || format.isError}
          value={format.data?.sheet_id ?? ""}
          onChange={(event) => bind.mutate(event.target.value || null)}
          className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs">
          <option value="">{format.data?.default_format?.name ?? "EIS 임원용"} (기본)</option>
          {format.data?.configured && !list.data?.sheets.some((s) => s.id === format.data.sheet_id) && (
            <option value={format.data.sheet_id}>{format.data.name} · v{format.data.version}</option>
          )}
          {list.data?.sheets.filter((s) => s.status === "saved").map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
          title="저장된 현재 시트를 계정 양식으로 지정" aria-label="현재 시트를 계정 양식으로 지정"
          disabled={!sheet.sheetId || sheet.status !== "saved" || bind.isPending}
          onClick={() => bind.mutate(sheet.sheetId)}>
          {bind.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkCheck className="w-4 h-4" />}
        </Button>
      </div>
      {format.data && !format.data.configured && (
        <p className="text-xs text-muted-foreground break-words">
          {format.data.reason === "unavailable" ? "지정된 양식을 사용할 수 없어 EIS 임원용 기본 양식을 적용합니다."
            : "EIS 임원용 기본 양식에 조사 내용을 반영합니다."}
        </p>
      )}
      {format.isError && <p className="text-xs text-destructive">계정 양식을 확인하지 못했습니다.</p>}
      <ReportContentMissions accountScope={accountScope} conversationId={conversationId} revision={revision} />
    </div>
  );
}
