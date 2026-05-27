/**
 * AddApiConnectionDialog — Vercel "Add new" ENV 폼과 동일 패턴.
 *
 * 사용 시나리오 2 가지:
 *   1) 신규 커스텀 엔트리 추가 (entry=undefined) — POST /custom
 *   2) 기존 커스텀 엔트리 편집 (entry=custom row) — PATCH /custom/{name}
 *
 * 시스템 카탈로그 row 는 본 dialog 대신 인라인 토글 + ⋮ 메뉴의 "메타 수정"
 * 시트로 처리 (분리: 시스템 row 는 method_name 변경 불가, 사용자 row 는 가능).
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Eye, EyeOff, User2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { ApiCatalogEntry, ApiCatalogScope } from "./apiCatalogClient";
import { formatErrorForToast } from "./apiCatalogClient";
import { useCreateCustomApi, useUpdateCustomApi } from "./useApiCatalog";
import { ErrorDetailModal } from "@desktop/components/ErrorDetailModal";

const COST_TIERS = ["low", "tier_a", "tier_b", "tier_c", "high"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: ApiCatalogEntry | null; // null/undefined = 신규
  trigger?: ReactNode;
  onSaved?: () => void;
}

interface FormState {
  method_name: string;
  domain: string;
  korean_label: string;
  description_ko: string;
  endpoint_url: string;
  secret_value: string;
  cost_tier: string;
  enabled: boolean;
  notes: string;
  scope: ApiCatalogScope;             // 신규 등록 시만 사용 (편집은 scope 변경 불가)
}

const EMPTY: FormState = {
  method_name: "",
  domain: "Custom",
  korean_label: "",
  description_ko: "",
  endpoint_url: "",
  secret_value: "",
  cost_tier: "low",
  enabled: true,
  notes: "",
  scope: "account",
};

export function AddApiConnectionDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: Props) {
  const isEdit = !!entry;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Section 09 — 100자 초과 detail 의 "더 보기" 모달 토글
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const { toast } = useToast();

  const createMutation = useCreateCustomApi();
  const updateMutation = useUpdateCustomApi();

  // entry 변경 시 form 초기화
  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        method_name: entry.method_name,
        domain: entry.domain,
        korean_label: entry.label,
        description_ko: entry.description,
        endpoint_url: entry.endpoint_url ?? "",
        secret_value: "", // 보안: 기존 secret 은 받아오지 않음 — 빈칸이면 미변경
        cost_tier: entry.cost_tier,
        enabled: entry.enabled,
        notes: entry.notes ?? "",
        scope: entry.scope ?? "account",
      });
    } else {
      setForm(EMPTY);
    }
    setShowSecret(false);
    setError(null);
  }, [open, entry]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.method_name.trim()) {
      setError("method_name 은 필수입니다");
      return;
    }
    if (!form.korean_label.trim()) {
      setError("표시 라벨은 필수입니다");
      return;
    }
    try {
      if (isEdit && entry) {
        if (!entry.id) {
          throw new Error("편집할 항목 id 가 없습니다.");
        }
        const patch: Record<string, unknown> = {
          domain: form.domain,
          korean_label: form.korean_label,
          description_ko: form.description_ko,
          endpoint_url: form.endpoint_url || null,
          cost_tier: form.cost_tier,
          enabled: form.enabled,
          notes: form.notes || null,
        };
        // secret_value: 빈 문자열이면 변경하지 않음 (기존 값 유지)
        if (form.secret_value) patch.secret_value = form.secret_value;
        await updateMutation.mutateAsync({
          customId: entry.id,
          patch,
        });
      } else {
        await createMutation.mutateAsync({
          method_name: form.method_name.trim(),
          domain: form.domain,
          korean_label: form.korean_label,
          description_ko: form.description_ko,
          endpoint_url: form.endpoint_url || null,
          secret_value: form.secret_value || null,
          cost_tier: form.cost_tier,
          enabled: form.enabled,
          notes: form.notes || null,
          scope: form.scope,
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      // ── Section 09 — detail 추출 + 토스트 + (truncated 시) 모달 ──
      const info = formatErrorForToast(e);
      setError(info.short);
      toast({
        title: "저장 실패",
        description: info.short,
        variant: "destructive",
        action: info.truncated ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setErrorDetail(info.full)}
          >
            더 보기
          </Button>
        ) : undefined,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "API 연결 편집" : "새 API 연결 추가"}</DialogTitle>
          <DialogDescription className="text-xs">
            계정에 저장됩니다. method_name 은 LLM agent 가 도구 선택에 사용하는 식별자입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {!isEdit && (
            <Field label="등록 범위" required>
              <div className="grid grid-cols-2 gap-2">
                <ScopeOption
                  selected={form.scope === "account"}
                  onSelect={() => set("scope", "account")}
                  icon={User2}
                  label="계정 단위"
                  desc="등록한 본인만 사용"
                />
                <ScopeOption
                  selected={form.scope === "company"}
                  onSelect={() => set("scope", "company")}
                  icon={Building2}
                  label="공장 단위"
                  desc="같은 회사 사용자 공유"
                />
              </div>
            </Field>
          )}
          {isEdit && entry?.scope && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-foreground/[0.03] rounded-md px-2.5 py-1.5">
              {entry.scope === "company" ? (
                <Building2 className="w-3.5 h-3.5" />
              ) : (
                <User2 className="w-3.5 h-3.5" />
              )}
              <span>
                {entry.scope === "company" ? "공장 단위" : "계정 단위"} · 등록 후 변경 불가
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="method_name" required>
              <Input
                value={form.method_name}
                onChange={(e) => set("method_name", e.target.value)}
                disabled={isEdit}
                placeholder="예: get_custom_oee"
                className="font-mono text-[12.5px]"
              />
            </Field>
            <Field label="domain">
              <Input
                value={form.domain}
                onChange={(e) => set("domain", e.target.value)}
                placeholder="Custom"
              />
            </Field>
          </div>

          <Field label="표시 라벨" required>
            <Input
              value={form.korean_label}
              onChange={(e) => set("korean_label", e.target.value)}
              placeholder="예: 커스텀 OEE 조회"
            />
          </Field>

          <Field label="설명">
            <Textarea
              value={form.description_ko}
              onChange={(e) => set("description_ko", e.target.value)}
              rows={2}
              placeholder="언제/왜 쓰는지 (선택)"
            />
          </Field>

          <Field label="endpoint URL">
            <Input
              value={form.endpoint_url}
              onChange={(e) => set("endpoint_url", e.target.value)}
              placeholder="https://... (선택)"
              className="font-mono text-[12.5px]"
            />
          </Field>

          <Field
            label={
              isEdit
                ? "secret value (비워두면 기존 값 유지)"
                : "secret value (선택)"
            }
          >
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={form.secret_value}
                onChange={(e) => set("secret_value", e.target.value)}
                placeholder={isEdit && entry?.has_secret ? "••••••••" : "API key 등"}
                className="pr-9 font-mono text-[12.5px]"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showSecret ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="cost_tier">
              <Select
                value={form.cost_tier}
                onValueChange={(v) => set("cost_tier", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="enabled">
              <div className="h-9 flex items-center">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => set("enabled", v)}
                />
                <span className="ml-2 text-xs text-muted-foreground">
                  {form.enabled ? "활성" : "비활성"}
                </span>
              </div>
            </Field>
          </div>

          <Field label="메모">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="자유 메모 (선택)"
            />
          </Field>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "저장" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* Section 09 — 100자 초과 detail 의 "더 보기" 모달. Dialog 안에 두면
          z-index 상충 → outside 마운트. */}
      <ErrorDetailModal
        open={!!errorDetail}
        onOpenChange={(o) => !o && setErrorDetail(null)}
        detail={errorDetail ?? ""}
      />
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ScopeOption({
  selected,
  onSelect,
  icon: Icon,
  label,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof User2;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-start gap-2 px-3 py-2.5 rounded-md text-left transition-colors",
        "border",
        selected
          ? "border-primary/60 bg-primary/5 text-foreground"
          : "border-border/40 hover:border-border hover:bg-foreground/[0.03] text-foreground/80",
      )}
    >
      <Icon
        className={cn(
          "w-4 h-4 mt-0.5 flex-shrink-0",
          selected ? "text-primary" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium leading-tight">{label}</p>
        <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
      </div>
    </button>
  );
}
