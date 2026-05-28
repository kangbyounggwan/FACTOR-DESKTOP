/**
 * factor-desktop Settings → 데이터 연결 → [Method] 탭.
 *
 * api_catalog_cache 의 비즈니스 메서드 목록. LLM 컨텍스트 (label / description /
 * when_to_use / returns / example) + 분류 (domain / cost_tier) + 폴링 권장 + 감사.
 *
 * Design — "refined technical instrument":
 *   · method_name 과 path 는 mono first-class
 *   · 도메인 / tier / 상태는 dot+label (Linear 패턴)
 *   · 활성 row 는 left rail (1px primary)
 *   · 헤더는 stats strip — 카운트 = curated / working / manual / spec
 *   · 필터는 chip 기반, 우측 result counter
 *
 * 룰: R1/R2 — anomaly-eye-monitor 페이지 import 금지. shadcn leaf 만 공유.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { ApiCatalogRowDetail } from "./ApiCatalogRowDetail";
import { useApiCatalogList, type ApiCatalogEntry } from "./useApiCatalog";

const DOMAIN_ALL = "__all__";

// ── Formatters ───────────────────────────────────────────────────────────

function formatParams(entry: ApiCatalogEntry): string {
  const p = entry.parameters;
  if (!p) return "—";
  if (Array.isArray(p)) {
    return p.map((x) => x.name).join(", ") || "—";
  }
  if (typeof p === "object") {
    return Object.keys(p).join(", ") || "—";
  }
  return "—";
}

function formatRecommended(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

// ── Color tokens (semantic) ──────────────────────────────────────────────

const TIER_COLORS: Record<string, { dot: string; text: string }> = {
  tier_a: { dot: "bg-amber-400", text: "text-amber-300" },
  tier_b: { dot: "bg-sky-400", text: "text-sky-300" },
  tier_c: { dot: "bg-violet-400", text: "text-violet-300" },
  high: { dot: "bg-rose-400", text: "text-rose-300" },
  low: { dot: "bg-foreground/30", text: "text-foreground/55" },
};

function tierTokens(tier: string) {
  return TIER_COLORS[tier] ?? TIER_COLORS.low;
}

// ── Sort priority ────────────────────────────────────────────────────────

const TIER_ORDER: Record<string, number> = {
  tier_a: 0,
  tier_b: 1,
  tier_c: 2,
};

function tierRank(entry: ApiCatalogEntry): number {
  const t = entry.cost_tier;
  if (t in TIER_ORDER) return TIER_ORDER[t];
  if (t === "low") return entry.is_curated ? 10 : 11;
  if (t === "high") return 20;
  return 99;
}

// ────────────────────────────────────────────────────────────────────────

export function ApiCatalogTableSection() {
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>(DOMAIN_ALL);
  const [onlyCurated, setOnlyCurated] = useState(false);
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useApiCatalogList({
    search: search || undefined,
    domain: domainFilter === DOMAIN_ALL ? undefined : domainFilter,
    onlyCurated,
  });

  const items = useMemo(() => {
    const arr = [...(data?.items ?? [])];
    arr.sort((a, b) => {
      const r = tierRank(a) - tierRank(b);
      if (r !== 0) return r;
      return a.method_name.localeCompare(b.method_name);
    });
    return arr;
  }, [data?.items]);
  const domains = useMemo(() => data?.domains ?? [], [data?.domains]);

  // ── Stats — 사용자가 한 눈에 카탈로그 상태 파악 ──
  const stats = useMemo(() => {
    const src = data?.items ?? [];
    return {
      total: src.length,
      curated: src.filter((x) => x.is_curated).length,
      working: src.filter((x) => x.is_working).length,
      manual: src.filter((x) => x.last_modified_kind === "manual").length,
      withSpec: src.filter((x) => !!x.path_template).length,
    };
  }, [data?.items]);

  return (
    <div className="space-y-6">
      {/* ── 헤더 — 큰 제목 + stats strip ── */}
      <header className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
              메서드 카탈로그
            </h2>
            <p className="text-[14.5px] text-muted-foreground mt-1 leading-relaxed">
              비즈니스 메서드 + LLM 컨텍스트.{" "}
              <span className="text-foreground/65">행 클릭</span>해서 편집.{" "}
              <span className="text-amber-400/85">수동 편집</span>은 다음
              자동 갱신에서 보존됩니다.
            </p>
          </div>
        </div>

        {/* Stats strip — 4-up 메트릭 */}
        <div className="grid grid-cols-4 gap-px bg-border/30 rounded-lg overflow-hidden border border-border/40">
          <Stat label="전체" value={stats.total} />
          <Stat
            label="핵심"
            value={stats.curated}
            tint="text-amber-300"
            hint={`${pct(stats.curated, stats.total)}%`}
          />
          <Stat
            label="정상 동작"
            value={stats.working}
            tint="text-emerald-300"
            hint={`${pct(stats.working, stats.total)}%`}
          />
          <Stat
            label="HTTP 경로"
            value={stats.withSpec}
            tint="text-sky-300"
            hint={`${pct(stats.withSpec, stats.total)}%`}
          />
        </div>
      </header>

      {/* ── 필터 바 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[280px] max-w-[480px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <Input
            placeholder="method_name 또는 설명 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-9 text-[15px] bg-foreground/[0.03] border-border/50 focus-visible:bg-foreground/[0.05]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              aria-label="검색 초기화"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Domain chips — segmented */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-foreground/[0.03] border border-border/40 overflow-x-auto max-w-[55%]">
          <DomainChip
            label="모두"
            active={domainFilter === DOMAIN_ALL}
            onClick={() => setDomainFilter(DOMAIN_ALL)}
          />
          {domains.slice(0, 6).map((d) => (
            <DomainChip
              key={d}
              label={d}
              active={domainFilter === d}
              onClick={() => setDomainFilter(d)}
            />
          ))}
          {domains.length > 6 && (
            <span className="text-[12px] text-foreground/40 px-1.5">
              +{domains.length - 6}
            </span>
          )}
        </div>

        {/* Curated toggle as inline chip */}
        <button
          type="button"
          onClick={() => setOnlyCurated((v) => !v)}
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md border text-[14px] font-medium transition-colors",
            onlyCurated
              ? "bg-amber-500/[0.12] border-amber-500/30 text-amber-300"
              : "bg-foreground/[0.03] border-border/40 text-foreground/65 hover:bg-foreground/[0.05]",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              onlyCurated ? "bg-amber-400" : "bg-foreground/30",
            )}
          />
          핵심만
        </button>

        {/* Result counter — 우측 align */}
        <div className="ml-auto text-[13px] text-foreground/45 font-mono tabular-nums whitespace-nowrap">
          {items.length}
          <span className="text-foreground/30 mx-1">/</span>
          {stats.total}
        </div>
      </div>

      {/* ── 표 ── */}
      {isLoading && <SkeletonTable />}
      {isError && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-[14.5px] text-rose-300">
          로드 실패 — {error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState />
      )}

      {items.length > 0 && (
        <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-7" />
              <col className="w-[260px]" />
              <col />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[70px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <th aria-hidden />
                <ColHeader>식별</ColHeader>
                <ColHeader>설명</ColHeader>
                <ColHeader>도메인</ColHeader>
                <ColHeader>우선순위</ColHeader>
                <ColHeader>상태</ColHeader>
                <ColHeader>출처</ColHeader>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => {
                const isOpen = expandedMethod === entry.method_name;
                return (
                  <RowGroup
                    key={entry.method_name}
                    entry={entry}
                    isOpen={isOpen}
                    onToggle={() =>
                      setExpandedMethod(isOpen ? null : entry.method_name)
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tint,
  hint,
}: {
  label: string;
  value: number;
  tint?: string;
  hint?: string;
}) {
  return (
    <div className="bg-foreground/[0.025] px-4 py-3">
      <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground/65 font-medium">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "text-[26px] font-semibold tabular-nums leading-none tracking-tight",
            tint ?? "text-foreground",
          )}
        >
          {value}
        </span>
        {hint && (
          <span className="text-[12.5px] text-foreground/40 font-mono tabular-nums">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium">
      {children}
    </th>
  );
}

function DomainChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded text-[13px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-foreground/65 hover:text-foreground hover:bg-foreground/[0.04]",
      )}
    >
      {label}
    </button>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border/40 bg-foreground/[0.025]">
        <div className="h-3 w-32 bg-foreground/[0.06] rounded" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="px-3 py-4 border-b border-border/20 flex items-center gap-4"
        >
          <div className="h-3 w-3 bg-foreground/[0.05] rounded" />
          <div className="flex-shrink-0 space-y-1.5">
            <div className="h-3 w-32 bg-foreground/[0.06] rounded" />
            <div className="h-2 w-44 bg-foreground/[0.04] rounded" />
          </div>
          <div className="flex-1 h-3 bg-foreground/[0.04] rounded max-w-md" />
          <div className="h-5 w-16 bg-foreground/[0.05] rounded" />
          <div className="h-5 w-14 bg-foreground/[0.05] rounded" />
          <div className="h-5 w-12 bg-foreground/[0.05] rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border/40 bg-foreground/[0.02] px-6 py-12 text-center">
      <div className="text-[15px] text-foreground/70 font-medium">
        조건에 맞는 카탈로그 항목이 없습니다
      </div>
      <div className="text-[13.5px] text-muted-foreground mt-1.5">
        검색어를 다시 입력하거나 필터를 초기화해보세요.
      </div>
    </div>
  );
}

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

// ── Row ──────────────────────────────────────────────────────────────────

interface RowGroupProps {
  entry: ApiCatalogEntry;
  isOpen: boolean;
  onToggle: () => void;
}

function RowGroup({ entry, isOpen, onToggle }: RowGroupProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isOpen && rowRef.current) {
      const el = rowRef.current;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [isOpen]);

  const tier = tierTokens(entry.cost_tier);
  const isManual = entry.last_modified_kind === "manual";

  return (
    <>
      <tr
        ref={rowRef}
        className={cn(
          "group cursor-pointer transition-colors scroll-mt-6",
          "border-b border-border/20",
          "hover:bg-foreground/[0.035]",
          isOpen && "bg-foreground/[0.045]",
        )}
        onClick={onToggle}
      >
        {/* Active rail + chevron */}
        <td className="relative align-top">
          <span
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[2px] transition-colors",
              isOpen ? "bg-primary" : "bg-transparent group-hover:bg-foreground/15",
            )}
            aria-hidden
          />
          <div className="flex items-center justify-center h-12">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-all duration-150",
                isOpen
                  ? "rotate-90 text-foreground/85"
                  : "text-muted-foreground/55 group-hover:text-foreground/65",
              )}
            />
          </div>
        </td>

        {/* 식별 — method_name + path + params */}
        <td className="px-3 py-3 align-top">
          <code className="block text-[14.5px] font-mono font-medium text-foreground break-all leading-tight">
            {entry.method_name}
          </code>
          {entry.path_template ? (
            <div
              className="text-[13px] font-mono text-emerald-400/85 mt-1 truncate leading-tight"
              title={`${entry.http_method ?? "GET"} ${entry.path_template}`}
            >
              <span className="text-emerald-400/55 mr-1">
                {entry.http_method ?? "GET"}
              </span>
              {entry.path_template}
            </div>
          ) : (
            <div className="text-[13px] text-foreground/35 mt-1 leading-tight">
              <span className="inline-block h-1 w-1 rounded-full bg-foreground/25 mr-1.5 align-middle" />
              path 미시드 · 코드 fallback
            </div>
          )}
          <div className="text-[12.5px] text-foreground/45 mt-1.5 font-mono tabular-nums truncate">
            {formatParams(entry)} · 권장{" "}
            <span className="text-foreground/60">
              {formatRecommended(entry.recommended_interval_sec)}
            </span>
          </div>
        </td>

        {/* 설명 — korean_label 만 */}
        <td className="px-3 py-3 align-top">
          <div className="text-[15.5px] font-medium text-foreground leading-snug">
            {entry.korean_label || (
              <span className="text-foreground/35 font-normal italic">
                라벨 미설정
              </span>
            )}
          </div>
        </td>

        {/* 도메인 — flat chip */}
        <td className="px-3 py-3 align-top">
          <span className="inline-flex items-center text-[12.5px] font-medium tracking-tight text-foreground/75 bg-foreground/[0.05] px-2 py-0.5 rounded">
            {entry.domain}
          </span>
        </td>

        {/* 우선순위 — dot + label */}
        <td className="px-3 py-3 align-top">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", tier.dot)} />
            <span className={cn("text-[13px] font-mono", tier.text)}>
              {entry.cost_tier}
            </span>
          </span>
        </td>

        {/* 상태 — dot + label (Linear 패턴) */}
        <td className="px-3 py-3 align-top">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                entry.is_working
                  ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                  : "bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]",
              )}
            />
            <span
              className={cn(
                "text-[13px]",
                entry.is_working ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {entry.is_working ? "정상" : "실패"}
            </span>
          </span>
        </td>

        {/* 출처 */}
        <td className="px-3 py-3 align-top">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px]",
              isManual ? "text-amber-300" : "text-foreground/45",
            )}
          >
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                isManual ? "bg-amber-400" : "bg-foreground/30",
              )}
            />
            {isManual ? "수동" : "자동"}
          </span>
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-border/40">
          <td colSpan={7} className="p-0 bg-foreground/[0.015] relative">
            <span
              className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
              aria-hidden
            />
            <ApiCatalogRowDetail entry={entry} onClose={onToggle} />
          </td>
        </tr>
      )}
    </>
  );
}
