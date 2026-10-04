import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSheetPanelStore } from "@/features/reports/designer/core";
import { accountReportApi, sheetApi } from "@desktop/api/reports";

interface Props { accountScope: string; conversationId: string | null; revision: number }
interface Addition { accountScope: string; sheetId: string; conversationId: string; missionId: string; version: number; label: string }

export function ReportContentMissions({ accountScope, conversationId, revision }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const sheet = useSheetPanelStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const active = useRef(true);
  const context = useRef({ accountScope, conversationId });
  context.current = { accountScope, conversationId };
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setDismissed([]); }, [accountScope, conversationId, sheet.sheetId]);
  const current = (request: Addition) => active.current && context.current.accountScope === request.accountScope
    && context.current.conversationId === request.conversationId
    && useSheetPanelStore.getState().sheetId === request.sheetId
    && useSheetPanelStore.getState().version === request.version;
  const missions = useQuery({
    queryKey: ["reports", "contentMissions", accountScope, conversationId, sheet.sheetId, sheet.version, revision],
    queryFn: () => accountReportApi.contentMissions(sheet.sheetId as string, conversationId as string),
    enabled: !!conversationId && !!sheet.sheetId && !!sheet.version, retry: false,
  });
  const add = useMutation({
    mutationFn: (request: Addition) => accountReportApi.addContentMission(
      request.sheetId, request.conversationId, request.missionId, request.version),
    onSuccess: (result, request) => {
      if (!current(request)) return;
      const template = { ...result.template, ...result.sheet };
      useSheetPanelStore.getState().setFromEvent({
        sheet_id: request.sheetId, version: template.version, status: template.status,
        title: template.name, template, warnings: result.warnings, diff: result.diff, budget: null,
        preview: { mode: useSheetPanelStore.getState().mode, url: null, html: null },
        ops_applied: ["add_history_content"],
      });
      void qc.invalidateQueries({ queryKey: ["reports", "sheets"] });
      toast({ title: `${request.label} 내용을 보고서에 추가했습니다.`, description: result.warnings.join(" ") });
    },
    onError: async (error, request) => {
      if (!current(request)) return;
      if ((error as { status?: number }).status === 409) {
        try {
          const template = await sheetApi.getSheet(request.sheetId);
          if (current(request)) useSheetPanelStore.getState().setTemplate(template);
        } catch { /* Keep the current report intact if reloading also fails. */ }
      }
      if (active.current && context.current.accountScope === request.accountScope
          && context.current.conversationId === request.conversationId) {
        toast({ title: "콘텐츠를 추가하지 못했습니다.",
          description: error instanceof Error ? error.message : String(error), variant: "destructive" });
        void missions.refetch();
      }
    },
  });
  if (!conversationId || !sheet.sheetId || !sheet.version) return null;
  const items = (missions.data?.items ?? []).filter((item) => !dismissed.includes(item.id));
  if (!items.length && !missions.isError) return null;

  return <section aria-label="보고서 콘텐츠 미션" className="space-y-2 pt-1">
    <div className="flex items-center gap-1.5">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-medium">콘텐츠 미션</span>
      <Button size="icon" variant="ghost" className="ml-auto h-6 w-6"
        aria-label="콘텐츠 미션 새로고침" title="콘텐츠 미션 새로고침" disabled={missions.isFetching || add.isPending}
        onClick={() => void missions.refetch()}><RotateCw className="h-3.5 w-3.5" /></Button>
    </div>
    <div className="max-h-56 overflow-y-auto space-y-2">
      {items.map((item) => <div key={item.id} className="border-l-2 border-primary/50 pl-2 min-w-0">
        <div className="flex items-start gap-1.5">
          <p className="flex-1 min-w-0 break-words text-xs font-medium leading-5">{item.question}</p>
          <Button size="sm" variant="outline" className="h-6 shrink-0 px-2 text-xs" disabled={add.isPending}
            aria-label={`${item.label} 추가`} onClick={() => add.mutate({ accountScope, sheetId: sheet.sheetId as string,
              conversationId, missionId: item.id, version: sheet.version as number, label: item.label })}>
            {add.isPending && add.variables.missionId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}추가
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" disabled={add.isPending}
            aria-label={`${item.label} 미션 닫기`} title="이번 미션 닫기"
            onClick={() => setDismissed((old) => [...old, item.id])}><X className="h-3.5 w-3.5" /></Button>
        </div>
        <p className="break-words text-xs text-muted-foreground leading-5">{item.excerpt}</p>
        <p className="break-words text-[10px] text-muted-foreground leading-4">{item.scope} · {item.source_label}</p>
        {item.as_of && <time className="block text-[10px] text-muted-foreground" dateTime={item.as_of}>
          이전 조회 · {new Date(item.as_of).toLocaleString("ko-KR")}
        </time>}
      </div>)}
    </div>
    {missions.isError && <p className="text-xs text-destructive">추가할 콘텐츠를 확인하지 못했습니다.</p>}
  </section>;
}
