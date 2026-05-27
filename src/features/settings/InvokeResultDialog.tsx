/**
 * InvokeResultDialog — custom API 테스트 호출 결과 표시.
 *
 * 사용자가 row 의 ⋮ > "테스트 호출" 클릭 → 백엔드가 endpoint_url 을 GET 으로
 * 호출 → 응답을 그대로 표시 (status / latency / data / error).
 *
 * GET only, secret 은 서버에서 Bearer 헤더로 자동 부착 (FE 는 secret 안 봄).
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvokeCustomApi } from "./useApiCatalog";
import type { ApiCatalogEntry, CustomInvokeResult } from "./apiCatalogClient";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ApiCatalogEntry | null;
}

export function InvokeResultDialog({ open, onOpenChange, entry }: Props) {
  const invoke = useInvokeCustomApi();
  const [result, setResult] = useState<CustomInvokeResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!entry?.id) return;
    setErr(null);
    setResult(null);
    try {
      const r = await invoke.mutateAsync({ customId: entry.id });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // dialog open 시 자동 실행
  if (open && entry?.id && !result && !err && !invoke.isPending) {
    void run();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setResult(null);
          setErr(null);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            테스트 호출
          </DialogTitle>
          <DialogDescription className="text-xs">
            <code className="font-mono text-foreground/80">
              {entry?.method_name}
            </code>{" "}
            · GET · 8초 타임아웃 · secret 은 Bearer 헤더로 서버에서 자동 부착
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground font-mono break-all bg-foreground/[0.03] rounded-md px-2.5 py-2">
            {entry?.endpoint_url ?? "(endpoint_url 없음)"}
          </div>

          {invoke.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              호출 중…
            </div>
          )}

          {err && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-2">
              {err}
            </div>
          )}

          {result && (
            <>
              {/* 헤더 — status + 시간 */}
              <div className="flex items-center gap-2 text-xs">
                {result.ok ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {result.status || "OK"}
                  </Badge>
                ) : (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15 inline-flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {result.status || "ERR"}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {result.latency_ms} ms
                </span>
                {result.content_type && (
                  <span className="text-muted-foreground/70 font-mono">
                    {result.content_type}
                  </span>
                )}
                {result.truncated && (
                  <span className="text-amber-500">truncated</span>
                )}
              </div>

              {result.error && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-2">
                  {result.error}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  응답
                </p>
                <pre
                  className={cn(
                    "text-[11.5px] font-mono leading-relaxed",
                    "bg-foreground/[0.04] rounded-md p-3 overflow-auto max-h-[360px]",
                  )}
                >
                  {prettyBody(result)}
                </pre>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={invoke.isPending}
          >
            닫기
          </Button>
          <Button
            onClick={() => {
              setResult(null);
              setErr(null);
              void run();
            }}
            disabled={invoke.isPending || !entry?.id}
          >
            {invoke.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            다시 호출
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function prettyBody(r: CustomInvokeResult): string {
  if (r.body_preview) return r.body_preview;
  if (r.data == null) return "(no body)";
  if (typeof r.data === "string") return r.data;
  try {
    return JSON.stringify(r.data, null, 2);
  } catch {
    return String(r.data);
  }
}
