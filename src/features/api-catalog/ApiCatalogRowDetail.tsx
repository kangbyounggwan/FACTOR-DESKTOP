/**
 * Method 탭의 행 expand 패널 — 사용자 편집 폼.
 * 저장 → PATCH /api/api-catalog/{method_name} → last_modified_kind='manual' 마킹.
 *
 * Design: 2-column 레이아웃 — 좌측은 "spec" (메타·식별 정보, 읽기 전용 강조), 우측은
 * "editable copy" (라벨/설명/사용/반환/예시). 섹션 사이는 라벨 + 가는 라인. JSON 비교
 * 없이 typography-led.
 */
import { useEffect, useState } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import {
  useResetApiCatalog,
  useUpdateApiCatalog,
  type ApiCatalogEntry,
} from "./useApiCatalog";

interface Props {
  entry: ApiCatalogEntry;
  onClose: () => void;
}

interface Form {
  description_ko: string;
  domain: string;
  cost_tier: string;
  recommended_interval_sec: string;
  is_curated: boolean;
}

function entryToForm(e: ApiCatalogEntry): Form {
  return {
    description_ko: e.description_ko ?? "",
    domain: e.domain ?? "",
    cost_tier: e.cost_tier ?? "low",
    recommended_interval_sec:
      e.recommended_interval_sec != null ? String(e.recommended_interval_sec) : "",
    is_curated: e.is_curated ?? false,
  };
}

function parseIntervalInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function intervalHint(sec: number | null): string {
  if (sec == null) return "폴링 부적절";
  if (sec < 60) return `${sec}초`;
  if (sec < 3600) return `${Math.round(sec / 60)}분`;
  if (sec < 86400) return `${Math.round(sec / 3600)}시간`;
  return `${Math.round(sec / 86400)}일`;
}

const TIER_OPTIONS = [
  { value: "tier_a", label: "tier_a", dot: "bg-amber-400" },
  { value: "tier_b", label: "tier_b", dot: "bg-sky-400" },
  { value: "tier_c", label: "tier_c", dot: "bg-violet-400" },
  { value: "low", label: "low", dot: "bg-foreground/30" },
  { value: "high", label: "high", dot: "bg-rose-400" },
];

// ────────────────────────────────────────────────────────────────────────

export function ApiCatalogRowDetail({ entry, onClose }: Props) {
  const { toast } = useToast();
  const update = useUpdateApiCatalog("desktop-ui");
  const reset = useResetApiCatalog();

  const [form, setForm] = useState<Form>(() => entryToForm(entry));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setForm(entryToForm(entry));
  }, [entry.method_name, entry.last_modified_kind]);

  const copyMethod = async () => {
    try {
      await navigator.clipboard.writeText(entry.method_name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleSave = () => {
    const patch = {
      description_ko: form.description_ko,
      domain: form.domain,
      cost_tier: form.cost_tier as Parameters<
        typeof update.mutate
      >[0]["patch"]["cost_tier"],
      recommended_interval_sec: parseIntervalInput(form.recommended_interval_sec),
      is_curated: form.is_curated,
    };
    update.mutate(
      { methodName: entry.method_name, patch },
      {
        onSuccess: () => {
          toast({ title: "저장됨", description: `${entry.method_name} · 수동 편집 마킹` });
        },
        onError: (e) =>
          toast({
            title: "저장 실패",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          }),
      },
    );
  };

  const handleReset = () => {
    reset.mutate(entry.method_name, {
      onSuccess: () => {
        toast({
          title: "자동 갱신 복귀",
          description: `${entry.method_name} 은 다음 build_catalog 에서 자동 덮어쓰기`,
        });
      },
      onError: (e) =>
        toast({
          title: "초기화 실패",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        }),
    });
  };

  const pending = update.isPending || reset.isPending;
  const isManual = entry.last_modified_kind === "manual";
  const intervalSec = parseIntervalInput(form.recommended_interval_sec);

  return (
    <div className="px-7 py-6 space-y-7">
      {/* ════ HEADER STRIP ═════════════════════════════════════════
          method_name 큰 mono + status chips. Linear/Vercel 톤. */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <code className="ui-h2 font-mono break-all">
              {entry.method_name}
            </code>
            <button
              type="button"
              onClick={copyMethod}
              className="flex-shrink-0 text-foreground/45 hover:text-foreground transition-colors p-1 rounded hover:bg-foreground/[0.06]"
              aria-label="method_name 복사"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* meta line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-foreground/55">
            {isManual ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-400" />
                <span className="text-amber-300">수동 편집</span>
                {entry.last_modified_by && (
                  <span className="text-foreground/45">
                    · {entry.last_modified_by}
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-foreground/30" />
                <span>자동 (build_catalog)</span>
              </span>
            )}
            <span className="text-foreground/30">·</span>
            <span>
              verified{" "}
              <span className="text-foreground/75">
                {entry.last_verified?.slice(0, 10) ?? "—"}
              </span>
            </span>
            {entry.last_modified_note && (
              <>
                <span className="text-foreground/30">·</span>
                <span className="italic text-foreground/65">
                  "{entry.last_modified_note}"
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isManual && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={pending}
              className="ui-fs-xs h-8 px-2.5 text-foreground/65 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              자동 복귀
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ui-fs-xs text-foreground/55 hover:text-foreground transition-colors px-2.5 py-1.5 rounded hover:bg-foreground/[0.04]"
          >
            접기
          </button>
        </div>
      </div>

      {/* ════ HTTP 경로 — 강조 카드 ═════════════════════════════════ */}
      <div className="rounded-lg bg-foreground/[0.04] border border-border/30 px-4 py-3">
        <div className="ui-fs-xs uppercase tracking-[0.16em] text-muted-foreground/65 font-medium mb-1.5">
          HTTP 경로
        </div>
        {entry.path_template ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold tracking-wide",
                entry.http_method === "GET"
                  ? "bg-emerald-500/[0.12] text-emerald-300"
                  : entry.http_method === "POST"
                  ? "bg-sky-500/[0.12] text-sky-300"
                  : "bg-foreground/[0.05] text-foreground/70",
              )}
            >
              {entry.http_method ?? "GET"}
            </span>
            <code className="text-xs font-mono text-emerald-400/90 break-all">
              {entry.path_template}
            </code>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-foreground/55">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
            <span>path 미시드</span>
            <span className="text-foreground/35 font-mono">
              · adapter_endpoint_specs 미등록 (legacy fallback 경로)
            </span>
          </div>
        )}
      </div>

      {/* ════ 1. 설명 ═════════════════════════════════════════════
          상세 설명만 — LLM 이 이 텍스트로 메서드 선택. korean_label /
          LLM 컨텍스트(when_to_use / returns_summary / example_question)
          는 자동 카탈로그 빌드가 채우므로 사용자 편집에서 제외. */}
      <Section
        eyebrow="01"
        title="설명"
        hint="LLM 이 이 텍스트로 메서드를 선택"
      >
        <FieldRow
          label="상세 설명"
          hint="가장 중요 — 사용자 표현으로"
          accent
        >
          <Textarea
            rows={3}
            value={form.description_ko}
            onChange={(e) =>
              setForm({ ...form, description_ko: e.target.value })
            }
            placeholder="이 API 가 무엇을 하는지 한 줄로."
            className="bg-foreground/[0.03] border-border/40 focus-visible:bg-foreground/[0.05] resize-none"
          />
        </FieldRow>
      </Section>

      {/* ════ 2. 분류 · 폴링 ═══════════════════════════════════════ */}
      <Section
        eyebrow="02"
        title="분류 · 폴링"
        hint="검색·라우팅 + 권장 폴링 default"
      >
        <div className="grid grid-cols-3 gap-4">
          <FieldRow label="도메인">
            <Input
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              className="bg-foreground/[0.03] border-border/40 focus-visible:bg-foreground/[0.05] font-mono ui-fs-xs"
            />
          </FieldRow>
          <FieldRow label="우선순위 (cost_tier)">
            <Select
              value={form.cost_tier}
              onValueChange={(v) => setForm({ ...form, cost_tier: v })}
            >
              <SelectTrigger className="bg-foreground/[0.03] border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", o.dot)} />
                      <span className="font-mono text-xs">{o.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label="권장 폴링"
            hint={
              <span className="font-mono tabular-nums">
                {intervalHint(intervalSec)}
              </span>
            }
          >
            <Input
              type="number"
              min={1}
              value={form.recommended_interval_sec}
              onChange={(e) =>
                setForm({ ...form, recommended_interval_sec: e.target.value })
              }
              placeholder="60, 300, 3600 …"
              className="bg-foreground/[0.03] border-border/40 focus-visible:bg-foreground/[0.05] font-mono tabular-nums"
            />
          </FieldRow>
        </div>
        <p className="ui-fs-xs text-foreground/45 mt-3 leading-relaxed">
          새 스케쥴 다이얼로그가 이 권장값을 default 로 채움 (회사 override
          가능). 빈 값 = 폴링 부적절.
        </p>
      </Section>

      {/* ════ 3. 플래그 ═══════════════════════════════════════════
          핵심 카탈로그 토글만. 변경 사유 note / 읽기 전용 메타 삭제. */}
      <Section eyebrow="03" title="플래그">
        <div className="flex items-center justify-between gap-4 rounded-md bg-foreground/[0.035] border border-border/30 px-4 py-3">
          <div className="space-y-0.5 min-w-0">
            <Label className="ui-fs-xs text-foreground font-medium">
              핵심 카탈로그
            </Label>
            <p className="ui-caption leading-relaxed">
              켜두면 LLM 카드 / NLU 가 우선 노출. 정렬 시 위쪽으로.
            </p>
          </div>
          <Switch
            checked={form.is_curated}
            onCheckedChange={(v) => setForm({ ...form, is_curated: v })}
          />
        </div>
      </Section>

      {/* ════ FOOTER — 저장 / 취소 ═════════════════════════════════ */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
        <div className="ui-fs-xs text-foreground/40 font-mono">
          저장하면{" "}
          <span className="text-amber-300/85">last_modified_kind=manual</span>{" "}
          로 마킹됩니다
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={pending}
            className="h-8 px-3 ui-fs-xs"
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending}
            className="h-8 px-4 ui-fs-xs font-medium"
          >
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 pb-2 border-b border-border/30">
        <span className="text-xs font-mono tabular-nums text-foreground/35 tracking-wider">
          {eyebrow}
        </span>
        <h3 className="text-xs font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        {hint && (
          <span className="ui-micro text-muted-foreground/75 ml-auto">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  hint,
  accent,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label
          className={cn(
            "ui-fs-xs font-medium tracking-tight",
            accent ? "text-amber-300" : "text-foreground/85",
          )}
        >
          {label}
        </Label>
        {hint && (
          <span className="ui-fs-xs text-foreground/45 font-normal">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
