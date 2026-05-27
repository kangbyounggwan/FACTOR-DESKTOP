/**
 * ApiConnectionsSection — Claude 설정 row 모티브.
 *
 * v1 에서 큰 카드 wrap + 자체 h2 헤더를 넣었으나, SettingsPage 가 이미
 * SectionHeader 로 타이틀을 그리므로 중복. 이 컴포넌트는 헤더 없이
 * 필터바 + divide-y row list 만 렌더.
 *
 * 모든 데이터는 로그인한 계정에 묶여 저장/로드 (라우터에서 user_id 강제).
 */

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  ShieldAlert,
  AlertCircle,
  User2,
  Building2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AddApiConnectionDialog } from "./AddApiConnectionDialog";
import { InvokeResultDialog } from "./InvokeResultDialog";
import {
  useApiCatalogList,
  useDeleteCustomApi,
  usePatchPreference,
} from "./useApiCatalog";
import type { ApiCatalogEntry } from "./apiCatalogClient";

const DOMAIN_ALL = "__all__";

export function ApiConnectionsSection() {
  const [domain, setDomain] = useState<string>(DOMAIN_ALL);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ApiCatalogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiCatalogEntry | null>(null);
  const [invokeTarget, setInvokeTarget] = useState<ApiCatalogEntry | null>(null);
  const { toast } = useToast();

  const { data, isLoading, error } = useApiCatalogList({
    domain: domain === DOMAIN_ALL ? undefined : domain,
    search: search || undefined,
  });

  const patchMutation = usePatchPreference();
  const deleteMutation = useDeleteCustomApi();

  const entries = data?.entries ?? [];
  const domains = useMemo(() => data?.domains ?? [], [data]);

  const handleToggle = (entry: ApiCatalogEntry, enabled: boolean) => {
    if (entry.source === "custom") {
      toast({
        title: "커스텀 엔트리 토글은 편집창에서 변경해주세요",
        variant: "destructive",
      });
      return;
    }
    patchMutation.mutate(
      { methodName: entry.method_name, patch: { enabled } },
      {
        onError: (e) =>
          toast({
            title: "토글 실패",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          }),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget?.id) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({
          title: "삭제됨",
          description: `${deleteTarget.method_name} 가 제거되었습니다`,
        });
        setDeleteTarget(null);
      },
      onError: (e) =>
        toast({
          title: "삭제 실패",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 제거 — 좌측 nav 가 컨텍스트 책임 */}

      {/* 메타 라인 + Add 버튼 */}
      <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
        <span>
          시스템 카탈로그 {data?.catalog_count ?? 0}개 · 내 추가{" "}
          {data?.custom_count ?? 0}개 · <span className="text-foreground/70">계정에 저장됨</span>
        </span>
        <Button
          onClick={() => setAddOpen(true)}
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />새 API 추가
        </Button>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="method_name 또는 라벨로 검색"
            className="pl-8 h-9"
          />
        </div>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DOMAIN_ALL}>모든 도메인</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 본문 — Claude 설정 row 톤 (카드 없음, divide-y) */}
      {error ? (
        <ErrorState message={error instanceof Error ? error.message : String(error)} />
      ) : isLoading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border border-border/40 divide-y divide-border/30 overflow-hidden">
          {entries.map((entry) => (
            <Row
              key={`${entry.source}:${entry.method_name}`}
              entry={entry}
              onToggle={(v) => handleToggle(entry, v)}
              onEdit={() => setEditEntry(entry)}
              onDelete={() => setDeleteTarget(entry)}
              onInvoke={() => setInvokeTarget(entry)}
              togglePending={patchMutation.isPending}
            />
          ))}
        </div>
      )}

      <AddApiConnectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        entry={null}
      />
      <AddApiConnectionDialog
        open={!!editEntry && editEntry.source === "custom"}
        onOpenChange={(o) => !o && setEditEntry(null)}
        entry={editEntry}
      />

      <InvokeResultDialog
        open={!!invokeTarget}
        onOpenChange={(o) => !o && setInvokeTarget(null)}
        entry={invokeTarget}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API 연결 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">
                {deleteTarget?.method_name}
              </span>{" "}
              를 삭제합니다. secret_value 도 함께 영구 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

// ─── Row ────────────────────────────────────────────────────────────────────

function Row({
  entry,
  onToggle,
  onEdit,
  onDelete,
  onInvoke,
  togglePending,
}: {
  entry: ApiCatalogEntry;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onInvoke: () => void;
  togglePending: boolean;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const isCustom = entry.source === "custom";

  const valueLine = (() => {
    if (entry.endpoint_url) return entry.endpoint_url;
    const params = entry.parameters;
    if (Array.isArray(params) && params.length > 0) {
      return params
        .slice(0, 4)
        .map((p) => String((p as { name?: string }).name ?? ""))
        .filter(Boolean)
        .join(", ");
    }
    if (params && !Array.isArray(params) && Object.keys(params).length > 0) {
      return Object.keys(params).slice(0, 4).join(", ");
    }
    return entry.description || "—";
  })();

  return (
    <div className="flex items-start gap-4 px-4 py-3.5 group hover:bg-foreground/[0.02] transition-colors">
      {/* 좌측: key · meta · 라벨 · 부가정보 */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[12.5px] font-mono font-medium text-foreground">
            {entry.method_name}
          </code>
          <span className="text-[10.5px] text-muted-foreground/70">
            {entry.domain}
          </span>
          <span
            className={cn(
              "text-[10.5px]",
              entry.cost_tier === "low"
                ? "text-emerald-500/80"
                : "text-amber-500/80",
            )}
          >
            · {entry.cost_tier}
          </span>
          {isCustom && entry.scope === "company" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal border-blue-500/40 text-blue-400 inline-flex items-center gap-0.5"
              title="같은 회사 사용자 모두 공유 (공장 단위)"
            >
              <Building2 className="w-2.5 h-2.5" />
              공장
            </Badge>
          )}
          {isCustom && entry.scope === "account" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal border-primary/40 text-primary inline-flex items-center gap-0.5"
              title="등록한 본인만 사용 (계정 단위)"
            >
              <User2 className="w-2.5 h-2.5" />
              계정
            </Badge>
          )}
          {!entry.is_working && (
            <span
              title="이 메서드는 현재 동작하지 않습니다"
              className="inline-flex items-center gap-0.5 text-[10px] text-amber-500"
            >
              <AlertCircle className="w-3 h-3" />
              not working
            </span>
          )}
          {!entry.is_read_only && (
            <span
              title="mutation 메서드 — agent 가 호출 불가"
              className="inline-flex items-center gap-0.5 text-[10px] text-destructive"
            >
              <ShieldAlert className="w-3 h-3" />
              mutation
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-foreground/85">{entry.label}</div>
        <div className="text-[11px] text-muted-foreground/70 font-mono truncate">
          {valueLine}
        </div>
        {entry.has_secret && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>secret:</span>
            <code
              className={cn(
                "font-mono px-1.5 py-0.5 rounded bg-foreground/5",
                showSecret ? "text-foreground" : "tracking-wider",
              )}
            >
              {showSecret ? "(서버 보관 — 응답 미반환)" : "••••••••"}
            </code>
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="text-muted-foreground/60 hover:text-foreground"
              title={showSecret ? "숨기기" : "보기"}
            >
              {showSecret ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
        {entry.notes && (
          <p className="text-[10.5px] text-muted-foreground/70 italic mt-1">
            {entry.notes}
          </p>
        )}
      </div>

      {/* 우측: 토글 + ⋮ */}
      <div className="flex items-center gap-1 pt-1">
        <Switch
          checked={entry.enabled}
          onCheckedChange={onToggle}
          disabled={togglePending || isCustom}
          title={
            isCustom
              ? "커스텀 엔트리는 편집창에서 토글하세요"
              : entry.enabled
                ? "활성"
                : "비활성"
          }
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-60 group-hover:opacity-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isCustom && entry.endpoint_url && (
              <>
                <DropdownMenuItem onClick={onInvoke}>
                  <Play className="w-3.5 h-3.5 mr-2" />
                  테스트 호출
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onEdit} disabled={!isCustom}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              {isCustom ? "편집" : "편집 (커스텀만 가능)"}
            </DropdownMenuItem>
            {isCustom && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  삭제
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      불러오는 중
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border/40 rounded-lg py-14 text-center text-sm text-muted-foreground">
      조건에 맞는 API 가 없습니다
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive flex items-start gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium">불러오기 실패</p>
        <p className="text-xs text-destructive/70 mt-1">{message}</p>
      </div>
    </div>
  );
}
