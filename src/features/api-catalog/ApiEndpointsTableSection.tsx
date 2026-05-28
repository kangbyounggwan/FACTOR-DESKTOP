/**
 * factor-desktop Settings → 데이터 연결 → [API] 탭.
 *
 * adapter_endpoint_specs 의 실 HTTP 명세 — path / query / body / response / cache.
 * Method 탭 (api_catalog_cache) 과 같은 method_name 을 공유.
 *
 * Design: refined technical instrument. HTTP method 색 위계, path mono first-class,
 * row 클릭 → 명세 카드 + JSON viewer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search, X, Copy, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  useEndpointSpecsList,
  useToggleEndpointSpec,
  type EndpointSpec,
} from "./useEndpointSpecs";

// ── HTTP method 색 위계 ────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { fill: string; text: string; dot: string }> = {
  GET: {
    fill: "bg-emerald-500/[0.12]",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  POST: {
    fill: "bg-sky-500/[0.12]",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  PUT: {
    fill: "bg-amber-500/[0.12]",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  PATCH: {
    fill: "bg-violet-500/[0.12]",
    text: "text-violet-300",
    dot: "bg-violet-400",
  },
  DELETE: {
    fill: "bg-rose-500/[0.12]",
    text: "text-rose-300",
    dot: "bg-rose-400",
  },
};

function methodTokens(m: string) {
  return (
    METHOD_COLORS[m] ?? {
      fill: "bg-foreground/[0.05]",
      text: "text-foreground/70",
      dot: "bg-foreground/40",
    }
  );
}

function MethodTag({ method }: { method: string }) {
  const t = methodTokens(method);
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-mono font-semibold tracking-wide",
        t.fill,
        t.text,
      )}
    >
      {method}
    </span>
  );
}

function formatQueryParams(qp: Record<string, string> | null | undefined): string {
  if (!qp) return "—";
  const keys = Object.keys(qp);
  return keys.length === 0 ? "—" : keys.join(", ");
}

function formatRequiredParams(
  schema: Record<string, unknown> | null | undefined,
): string[] {
  if (!schema || typeof schema !== "object") return [];
  const out: string[] = [];
  for (const [name, meta] of Object.entries(schema)) {
    if (meta && typeof meta === "object" && (meta as { required?: boolean }).required) {
      out.push(name);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────

export function ApiEndpointsTableSection() {
  const [search, setSearch] = useState("");
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useEndpointSpecsList({
    search: search || undefined,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const stats = useMemo(() => {
    const src = data?.items ?? [];
    return {
      total: src.length,
      enabled: src.filter((s) => s.enabled).length,
      readOnly: src.filter((s) => s.is_read_only).length,
      methods: new Set(src.map((s) => s.http_method)).size,
    };
  }, [data?.items]);

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <header className="space-y-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            API 명세
          </h2>
          <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
            HTTP endpoint 의 path / query / body / response envelope. DB-driven
            adapter 가 이 명세를 그대로 실행합니다.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-px bg-border/30 rounded-lg overflow-hidden border border-border/40">
          <Stat label="전체 명세" value={stats.total} />
          <Stat
            label="활성"
            value={stats.enabled}
            tint="text-emerald-300"
          />
          <Stat
            label="read-only"
            value={stats.readOnly}
            tint="text-sky-300"
          />
          <Stat label="HTTP 종류" value={stats.methods} />
        </div>
      </header>

      {/* ── 필터 ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-[280px] max-w-[480px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <Input
            placeholder="method_name 또는 path 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-9 text-[12px] bg-foreground/[0.03] border-border/50 focus-visible:bg-foreground/[0.05]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto text-[12px] text-foreground/45 font-mono tabular-nums">
          {items.length}
          <span className="text-foreground/30 mx-1">/</span>
          {stats.total}
        </div>
      </div>

      {/* ── 표 ── */}
      {isLoading && <SkeletonTable />}
      {isError && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-[11.5px] text-rose-300">
          로드 실패 — {error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-lg border border-border/40 bg-foreground/[0.02] px-6 py-12 text-center">
          <div className="text-[12px] text-foreground/70 font-medium">
            등록된 endpoint 명세가 없습니다
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-1.5">
            adapter_endpoint_specs 테이블에 spec 을 시드하세요.
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-7" />
              <col className="w-[200px]" />
              <col className="w-[60px]" />
              <col />
              <col className="w-[80px]" />
              <col className="w-[72px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <th aria-hidden />
                <ColHeader>식별</ColHeader>
                <ColHeader>HTTP</ColHeader>
                <ColHeader>path</ColHeader>
                <ColHeader>read-only</ColHeader>
                <ColHeader>활성</ColHeader>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const isOpen = expandedMethod === s.method_name;
                return (
                  <SpecRow
                    key={s.id}
                    spec={s}
                    isOpen={isOpen}
                    onToggle={() => setExpandedMethod(isOpen ? null : s.method_name)}
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
}: {
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="bg-foreground/[0.025] px-4 py-3">
      <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground/65 font-medium">
        {label}
      </div>
      <div className="mt-1.5">
        <span
          className={cn(
            "text-[22px] font-semibold tabular-nums leading-none tracking-tight",
            tint ?? "text-foreground",
          )}
        >
          {value}
        </span>
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

function SkeletonTable() {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="px-3 py-4 border-b border-border/20 flex items-center gap-4"
        >
          <div className="h-3 w-3 bg-foreground/[0.05] rounded" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-foreground/[0.06] rounded" />
            <div className="h-2 w-20 bg-foreground/[0.04] rounded" />
          </div>
          <div className="h-5 w-12 bg-foreground/[0.05] rounded ml-4" />
          <div className="flex-1 h-3 bg-foreground/[0.04] rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────

interface SpecRowProps {
  spec: EndpointSpec;
  isOpen: boolean;
  onToggle: () => void;
}

function SpecRow({ spec, isOpen, onToggle }: SpecRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isOpen && rowRef.current) {
      const el = rowRef.current;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [isOpen]);

  const queryStr = formatQueryParams(spec.query_params);

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

        <td className="px-3 py-3 align-top">
          <code className="block text-[11.5px] font-mono font-medium text-foreground break-all leading-tight">
            {spec.method_name}
          </code>
          <div className="text-[11.5px] text-foreground/45 mt-1 font-mono">
            {spec.adapter_type}
          </div>
        </td>

        <td className="px-3 py-3 align-top">
          <MethodTag method={spec.http_method} />
        </td>

        <td className="px-3 py-3 align-top">
          <code className="block text-[11.5px] font-mono text-emerald-400/90 break-all leading-tight">
            {spec.path_template}
          </code>
          <div className="text-[11.5px] text-foreground/45 mt-1 font-mono tabular-nums truncate">
            query: <span className="text-foreground/60">{queryStr}</span>
          </div>
        </td>

        <td className="px-3 py-3 align-top">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                spec.is_read_only ? "bg-emerald-400" : "bg-rose-400",
              )}
            />
            <span
              className={cn(
                "text-[12px]",
                spec.is_read_only ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {spec.is_read_only ? "yes" : "no"}
            </span>
          </span>
        </td>

        <td
          className="px-3 py-3 align-top"
          onClick={(e) => e.stopPropagation()}
        >
          <SpecEnabledSwitch spec={spec} />
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-border/40">
          <td colSpan={7} className="p-0 bg-foreground/[0.015] relative">
            <span
              className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
              aria-hidden
            />
            <SpecDetail spec={spec} onClose={onToggle} />
          </td>
        </tr>
      )}
    </>
  );
}

function SpecEnabledSwitch({ spec }: { spec: EndpointSpec }) {
  const toggle = useToggleEndpointSpec();
  return (
    <Switch
      checked={spec.enabled}
      onCheckedChange={() => toggle.mutate(spec.method_name)}
      disabled={toggle.isPending}
    />
  );
}

// ── Detail ──────────────────────────────────────────────────────────────

function SpecDetail({ spec, onClose }: { spec: EndpointSpec; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(`${spec.http_method} ${spec.path_template}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 무시
    }
  };

  return (
    <div className="px-7 py-6 space-y-7">
      {/* ── Header — method + adapter + actions ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <code className="block text-[17px] font-mono font-semibold text-foreground tracking-tight">
            {spec.method_name}
          </code>
          <div className="text-[12px] text-muted-foreground font-mono">
            adapter:{" "}
            <span className="text-foreground/75">{spec.adapter_type}</span>
            <span className="mx-2 text-foreground/30">·</span>
            updated{" "}
            <span className="text-foreground/75">
              {spec.updated_at.slice(0, 10)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-foreground/55 hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-foreground/[0.04]"
        >
          접기
        </button>
      </div>

      {/* ── HTTP 요청 — 큰 형태로 ── */}
      <section>
        <SectionLabel>HTTP 요청</SectionLabel>
        <div className="mt-2 rounded-lg bg-foreground/[0.045] border border-border/30 px-4 py-3 flex items-center gap-3">
          <MethodTag method={spec.http_method} />
          <code className="flex-1 text-[12px] font-mono text-emerald-400/90 break-all">
            {spec.path_template}
          </code>
          <button
            type="button"
            onClick={copyPath}
            className="flex-shrink-0 text-foreground/55 hover:text-foreground transition-colors p-1.5 rounded hover:bg-foreground/[0.05]"
            aria-label="복사"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-foreground/55 font-mono">
          <span>
            timeout:{" "}
            <span className="text-foreground/75 tabular-nums">
              {spec.timeout_ms}ms
            </span>
          </span>
          <span>
            read-only:{" "}
            <span
              className={
                spec.is_read_only ? "text-emerald-300" : "text-rose-300"
              }
            >
              {spec.is_read_only ? "true" : "false"}
            </span>
          </span>
          <span>
            enabled:{" "}
            <span
              className={spec.enabled ? "text-emerald-300" : "text-foreground/55"}
            >
              {String(spec.enabled)}
            </span>
          </span>
        </div>
      </section>

      {/* ── 2-column: parameter_schema + query_params/body ── */}
      <div className="grid grid-cols-2 gap-6">
        <section>
          <SectionLabel>parameter_schema</SectionLabel>
          <JsonView value={spec.parameter_schema} />
        </section>
        <section>
          {Object.keys(spec.query_params || {}).length > 0 ? (
            <>
              <SectionLabel>query_params 매핑</SectionLabel>
              <JsonView value={spec.query_params} />
            </>
          ) : spec.body_template ? (
            <>
              <SectionLabel>body 템플릿</SectionLabel>
              <JsonView value={spec.body_template} />
            </>
          ) : (
            <>
              <SectionLabel>응답 path</SectionLabel>
              <div className="mt-2 rounded-md bg-foreground/[0.04] border border-border/30 px-3 py-2.5">
                <code className="text-[12px] font-mono text-foreground/85">
                  {spec.response_path || "(envelope unwrap default)"}
                </code>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── body_template 가 query 와 동시에 있을 때 두 번째 row ── */}
      {Object.keys(spec.query_params || {}).length > 0 && spec.body_template && (
        <section>
          <SectionLabel>body 템플릿</SectionLabel>
          <JsonView value={spec.body_template} />
        </section>
      )}

      {/* ── 응답 path + cache 두 컬럼 (위에서 안 보였을 때만) ── */}
      {(Object.keys(spec.query_params || {}).length > 0 || spec.body_template) && (
        <div className="grid grid-cols-2 gap-6">
          <section>
            <SectionLabel>응답 path</SectionLabel>
            <div className="mt-2 rounded-md bg-foreground/[0.04] border border-border/30 px-3 py-2.5">
              <code className="text-[12px] font-mono text-foreground/85">
                {spec.response_path || "(envelope unwrap default)"}
              </code>
            </div>
          </section>
          {Object.keys(spec.cache_policy || {}).length > 0 ? (
            <section>
              <SectionLabel>캐시 정책</SectionLabel>
              <JsonView value={spec.cache_policy} />
            </section>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* ── notes ── */}
      {spec.notes && (
        <section>
          <SectionLabel>메모</SectionLabel>
          <p className="mt-2 text-[11.5px] text-foreground/80 leading-relaxed">
            {spec.notes}
          </p>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground/75 font-medium">
      {children}
    </div>
  );
}

function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 text-[12px] font-mono bg-foreground/[0.04] border border-border/30 px-3 py-2.5 rounded-md text-foreground/85 overflow-x-auto leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
