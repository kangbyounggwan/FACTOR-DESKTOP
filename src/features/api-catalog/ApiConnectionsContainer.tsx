/**
 * Settings → 데이터 연결 의 컨테이너. 좌측 sub-sidebar 로 두 view 전환.
 *
 *   [Method]  — api_catalog_cache (비즈니스 메서드 메타 + LLM 컨텍스트)
 *   [API]     — adapter_endpoint_specs (실 HTTP 명세)
 *
 * 두 view 모두 같은 method_name 을 공유. 같은 메서드를 두 관점으로 보는 인터페이스.
 *
 * Design: sub-sidebar 는 1차 nav 와 시각적으로 명확히 구분 — 약한 inset surface +
 * 활성 항목 left rail. 각 탭은 라이브 카운트 배지 노출.
 */
import { useState } from "react";
import { LayoutGrid, Network } from "lucide-react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

import { cn } from "@/lib/utils";

import { ApiCatalogTableSection } from "./ApiCatalogTableSection";
import { ApiEndpointsTableSection } from "./ApiEndpointsTableSection";
import { useApiCatalogList } from "./useApiCatalog";
import { useEndpointSpecsList } from "./useEndpointSpecs";

type Tab = "method" | "api";

interface TabConfig {
  id: Tab;
  label: string;
  sublabel: string;
  hint: string;
  icon: typeof LayoutGrid;
}

const TABS: TabConfig[] = [
  {
    id: "method",
    label: "Method",
    sublabel: "비즈니스 메서드",
    hint: "LLM 이 참조하는 카탈로그 — 라벨, 설명, 예시 질문",
    icon: LayoutGrid,
  },
  {
    id: "api",
    label: "API",
    sublabel: "실 HTTP 명세",
    hint: "endpoint 의 path, query, body, response envelope",
    icon: Network,
  },
];

export function ApiConnectionsContainer() {
  const [tab, setTab] = useState<Tab>("method");

  // 라이브 카운트 — 사용자가 view 전환 전에도 양쪽 size 를 짐작 가능.
  const catalog = useApiCatalogList();
  const specs = useEndpointSpecsList();

  const counts: Record<Tab, number | null> = {
    method: catalog.data?.total ?? null,
    api: specs.data?.total ?? null,
  };

  return (
    <div className="flex gap-8 h-full min-h-0">
      {/* ── Sub-sidebar ────────────────────────────────────────────
          1차 nav 와 시각 구분: 살짝 inset 된 회색 컬럼 + 작은 캡션.
          활성 탭은 좌측 1px 채도 있는 rail + 약한 배경.
          ⚠ SimpleBar 외부에 위치 → 스크롤 시 고정 (사용자 요청 v0.0.68). */}
      <aside className="w-[176px] flex-shrink-0 flex flex-col">
        <div className="px-1 mb-3 flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground/60 font-medium">
            데이터 연결
          </span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            const count = counts[t.id];
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={cn(
                  "group relative w-full text-left transition-all duration-150",
                  "rounded-md pl-3 pr-2.5 py-2",
                  active
                    ? "bg-foreground/[0.045]"
                    : "hover:bg-foreground/[0.025]",
                )}
              >
                {/* 활성 left rail */}
                <span
                  className={cn(
                    "absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full transition-all duration-200",
                    active
                      ? "bg-primary opacity-100"
                      : "bg-foreground/20 opacity-0 group-hover:opacity-30",
                  )}
                  aria-hidden
                />

                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      active ? "text-primary" : "text-foreground/50",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[12px] font-medium tracking-tight",
                      active ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {t.label}
                  </span>
                  {count !== null && (
                    <span
                      className={cn(
                        "ml-auto text-[12px] font-mono tabular-nums px-1.5 py-0.5 rounded",
                        active
                          ? "text-foreground/85 bg-foreground/[0.06]"
                          : "text-foreground/40 bg-foreground/[0.03]",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "text-[11.5px] mt-0.5 transition-colors leading-tight",
                    active ? "text-muted-foreground" : "text-muted-foreground/65",
                  )}
                >
                  {t.sublabel}
                </div>
              </button>
            );
          })}
        </nav>

        {/* footer hint */}
        <div className="mt-auto pt-6 px-1">
          <div className="text-[12px] text-foreground/35 leading-relaxed">
            Method 메타와 API 명세는 같은{" "}
            <code className="font-mono text-[12px] text-foreground/60">
              method_name
            </code>
            을 키로 join 됩니다.
          </div>
        </div>
      </aside>

      {/* ── 본문 ────────────────────────────────────────────────
          SimpleBar 가 main 만 감싸 → table 만 스크롤, sub-sidebar 는 고정. */}
      <main className="flex-1 min-w-0 h-full min-h-0">
        <SimpleBar className="h-full">
          {tab === "method" && <ApiCatalogTableSection />}
          {tab === "api" && <ApiEndpointsTableSection />}
        </SimpleBar>
      </main>
    </div>
  );
}
