/**
 * OntologyPackCatalog — S4: 온톨로지 플러그인 install UI (데스크탑 전용).
 *
 * 흐름: 설치 가능 목록(레지스트리 S3) → "설치" → 이관 동의서 → install(다운로드+검증+저장)
 *   → "열기" → OntologyWebView(app:// 뷰어).
 *
 * 데스크탑 자체 컴포넌트(R1/R6). FE leaf(ui)만 재사용. 웹 빌드는 "데스크탑 전용" 안내.
 */
import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { OntologyAdapter } from "@desktop/types/electron";
import { useOntologyPacks } from "./useOntologyPacks";
import { OntologyTransferConsentDialog } from "./OntologyTransferConsentDialog";
import { OntologyWebView } from "./OntologyWebView";

export function OntologyPackCatalog() {
  const { available, installedSet, loading, error, supported, userId, install } =
    useOntologyPacks();

  const [viewing, setViewing] = useState<string | null>(null);
  const [consentFor, setConsentFor] = useState<OntologyAdapter | null>(null);
  const [busy, setBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // ── 데스크탑 전용 ──
  if (!supported) {
    return (
      <Empty
        icon={<Network className="w-8 h-8 text-muted-foreground/40" />}
        title="데스크탑 전용 기능"
        desc="온톨로지 플러그인 설치는 데스크탑 클라이언트에서만 사용할 수 있습니다."
      />
    );
  }

  // ── 뷰어 모드 ──
  if (viewing) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
          <Button variant="ghost" size="sm" onClick={() => setViewing(null)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            목록
          </Button>
          <span className="text-sm font-medium">{viewing} 온톨로지</span>
        </div>
        <div className="flex-1 min-h-0">
          <OntologyWebView adapterType={viewing} userId={userId} />
        </div>
      </div>
    );
  }

  const friendlyError = (msg: string): string => {
    if (msg === "NO_ACCESS") return "해당 온톨로지 팩에 접근 권한이 없거나 존재하지 않습니다.";
    if (msg.startsWith("PACK_MISSING_KEY") || msg === "BAD_JSON" || msg === "ADAPTER_MISMATCH")
      return "팩 형식이 올바르지 않아 설치를 취소했습니다.";
    if (msg === "CHECKSUM_MISMATCH") return "무결성 검증에 실패해 설치를 취소했습니다.";
    if (msg === "PACK_TOO_LARGE") return "팩 크기가 허용 범위를 초과했습니다.";
    if (msg === "BAD_CONTENT_TYPE") return "백엔드 응답 형식이 올바르지 않습니다.";
    return "백엔드에 연결할 수 없습니다.";
  };

  const doInstall = async () => {
    if (!consentFor) return;
    setBusy(true);
    setInstallError(null);
    try {
      await install(consentFor.adapter_type);
      setConsentFor(null);
    } catch (e) {
      setInstallError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">온톨로지 플러그인</h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            회사 온톨로지 팩을 다운로드해 그래프 뷰어로 탐색합니다. 설치 시 이관 동의가 필요합니다.
          </p>
        </header>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {installError && (
          <div className="mb-4 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4" />
            {installError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            불러오는 중
          </div>
        ) : available.length === 0 ? (
          <Empty
            icon={<Network className="w-8 h-8 text-muted-foreground/40" />}
            title="설치 가능한 플러그인이 없습니다"
            desc="소속 회사에 배포된 온톨로지 팩이 없거나 권한이 없습니다."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {available.map((a) => {
              const installed = installedSet.has(a.adapter_type);
              return (
                <div
                  key={a.adapter_type}
                  className={cn(
                    "flex flex-col gap-3 p-4 rounded-xl border bg-card/40 h-[170px]",
                    "border-border/60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Network className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{a.name ?? a.adapter_type}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.adapter_type}{a.version ? ` · v${a.version}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    {installed ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          설치됨
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto h-7"
                          onClick={() => setViewing(a.adapter_type)}
                        >
                          열기
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full h-8 gap-1.5"
                        onClick={() => {
                          setInstallError(null);
                          setConsentFor(a);
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        설치
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <OntologyTransferConsentDialog
        open={!!consentFor}
        onOpenChange={(o) => !o && setConsentFor(null)}
        adapter={consentFor}
        onAgree={doInstall}
        busy={busy}
      />
    </ScrollArea>
  );
}

function Empty({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
      {icon}
      <p className="text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-md">{desc}</p>
    </div>
  );
}
