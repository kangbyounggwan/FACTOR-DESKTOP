/**
 * factor-desktop Settings → API 카탈로그 (data-connector api_catalog_cache).
 *
 * 핵심 UX:
 *   - 카드 list 가 아니라 **표** (Table)
 *   - **description 컬럼이 가장 큰 비중** (설명이 가장 중요 — 사용자 요청)
 *   - 행 클릭 → 그 행 바로 아래 expand 패널에서 편집 가능
 *   - 편집 → PATCH /api/api-catalog/{method_name} → DB 저장
 *   - last_modified_kind='manual' 마킹된 row 는 다음 build_catalog 실행 시 보존
 *
 * 룰 준수:
 *   - R1/R2: anomaly-eye-monitor 페이지 import 0
 *   - shadcn UI leaf 만 공유 (@/components/ui/*)
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { ApiCatalogRowDetail } from "./ApiCatalogRowDetail";
import { useApiCatalogList, type ApiCatalogEntry } from "./useApiCatalog";

const DOMAIN_ALL = "__all__";

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

function tierBadgeVariant(tier: string) {
  if (tier === "low") return "outline";
  if (tier === "tier_a") return "default";
  if (tier === "tier_b") return "secondary";
  return "outline";
}

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

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const domains = useMemo(() => data?.domains ?? [], [data?.domains]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">API 카탈로그</h2>
        <p className="text-sm text-muted-foreground mt-1">
          시스템 카탈로그 {data?.total ?? 0}개. 행을 클릭하면 아래에 펼쳐져
          설명/도메인/우선순위를 편집할 수 있습니다. 수동 편집은 다음 자동
          갱신에서 보존됩니다.
        </p>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="method_name 또는 한국어 설명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="모든 도메인" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DOMAIN_ALL}>모든 도메인</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground px-2">
          <Switch checked={onlyCurated} onCheckedChange={setOnlyCurated} />
          핵심만
        </label>
      </div>

      {/* 표 */}
      {isLoading && (
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      )}
      {isError && (
        <div className="text-sm text-destructive">
          로드 실패: {error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <div className="text-sm text-muted-foreground py-6 text-center">
          조건에 맞는 카탈로그 항목이 없습니다.
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          {/* 사용자 요청: 표 + 설명이 가장 중요 — description 컬럼이 가장 넓고 강조 */}
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-8" />
                <th className="text-left px-3 py-2 font-medium w-[220px]">method_name</th>
                <th className="text-left px-3 py-2 font-medium">설명 (한국어)</th>
                <th className="text-left px-3 py-2 font-medium w-[110px]">도메인</th>
                <th className="text-left px-3 py-2 font-medium w-[80px]">우선순위</th>
                <th className="text-left px-3 py-2 font-medium w-[90px]">상태</th>
                <th className="text-left px-3 py-2 font-medium w-[110px]">편집 출처</th>
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

interface RowGroupProps {
  entry: ApiCatalogEntry;
  isOpen: boolean;
  onToggle: () => void;
}

function RowGroup({ entry, isOpen, onToggle }: RowGroupProps) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-muted/30 border-t"
        onClick={onToggle}
      >
        <td className="px-2 align-middle">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-3 py-2 align-top">
          <code className="text-xs font-mono">{entry.method_name}</code>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            params: {formatParams(entry)}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          {/* 가장 큰 비중 — 본문 텍스트 사이즈 */}
          <div className="font-medium">{entry.korean_label || "—"}</div>
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {entry.description_ko || "—"}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          <Badge variant="outline" className="text-xs">{entry.domain}</Badge>
        </td>
        <td className="px-3 py-2 align-top">
          <Badge variant={tierBadgeVariant(entry.cost_tier)} className="text-xs">
            {entry.cost_tier}
          </Badge>
        </td>
        <td className="px-3 py-2 align-top">
          {entry.is_working ? (
            <Badge variant="default" className="text-xs">정상</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">not working</Badge>
          )}
        </td>
        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
          {entry.last_modified_kind === "manual" ? (
            <span className="text-amber-500">수동</span>
          ) : (
            <span>자동</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-muted/10 border-t">
          <td colSpan={7} className="p-0">
            <ApiCatalogRowDetail entry={entry} onClose={onToggle} />
          </td>
        </tr>
      )}
    </>
  );
}
