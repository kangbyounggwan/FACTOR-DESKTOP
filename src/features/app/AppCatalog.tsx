/**
 * AppCatalog — APP STORE UI.
 *
 * Slack/Teams 스타일 카탈로그:
 *  - 상단: 검색바 + "URL 직접 추가" 버튼
 *  - 추천 (is_featured) 가로 스크롤 섹션
 *  - 카테고리별 그리드 (생산성 / 협업 / 개발 / MES / 일반)
 *  - 각 카드: 아이콘(icon_url 또는 favicon) + 이름 + 한 줄 설명 + "추가" 버튼
 *
 * 카탈로그 데이터는 supabase `app_catalog` 테이블 (033 마이그레이션).
 * 운영자가 콘솔에서 갱신 — 배포 없이 카탈로그 변경 가능.
 *
 * "추가" 버튼 클릭 → useAppUrls.add(name, url) → useSelectedAppUrl.setSelectedId →
 *   AppPage 가 자동으로 webview 모드로 전환.
 */

import { useMemo, useState } from "react";
import { Search, Plus, Loader2, AlertCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppCatalog, type CatalogApp } from "./useAppCatalog";
import { AppFavicon } from "./AppFavicon";

interface Props {
  /** 카탈로그 앱 카드를 클릭했을 때 호출 — 상세 페이지로 이동하거나 즉시 추가 */
  onPick: (app: CatalogApp) => void | Promise<void>;
  /**
   * 우상단 "URL 직접 추가" 버튼 핸들러. 생략 시 헤더 버튼 자체가 안 보임 — Mode 3
   * ("내 앱" 섹션이 자체 URL 직접 추가 버튼을 갖고 있을 때) 의 중복 제거용.
   */
  onCustomAdd?: () => void;
  /** 이미 즐겨찾기 추가된 URL 목록 (중복 추가 방지 + 시각 표시) */
  installedUrls: string[];
}

export function AppCatalog({ onPick, onCustomAdd, installedUrls }: Props) {
  const { byCategory, featured, loading, error } = useAppCatalog();
  const [query, setQuery] = useState("");

  const installedSet = useMemo(
    () => new Set(installedUrls.map((u) => u.toLowerCase().replace(/\/$/, ""))),
    [installedUrls],
  );

  // 검색 필터 — 이름, 설명, 태그 매칭
  const filterApp = (app: CatalogApp) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      app.name.toLowerCase().includes(q) ||
      (app.description ?? "").toLowerCase().includes(q) ||
      app.tags.some((t) => t.toLowerCase().includes(q))
    );
  };

  const filteredFeatured = featured.filter(filterApp);
  const filteredByCategory = byCategory
    .map((cat) => ({ ...cat, apps: cat.apps.filter(filterApp) }))
    .filter((cat) => cat.apps.length > 0);

  // 스크롤은 부모가 책임 (mode 2: 풀스크린 = AppPage 가 ScrollArea wrap, mode 3: 내장 = AppPage 의 ScrollArea 안)
  return (
    <div className="w-full">
      <div className="px-0">
        {/* Header */}
        <header className="space-y-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">APP STORE</h1>
              <p className="ui-caption mt-1.5">
                추천 앱을 한 번 클릭으로 즐겨찾기에 추가하세요. 외부 브라우저 전환 없이 데스크탑 안에서 바로 열립니다.
              </p>
            </div>
            {onCustomAdd && (
              <Button onClick={onCustomAdd} size="sm" variant="outline" className="gap-2 h-9 px-4 flex-shrink-0">
                <Plus className="w-4 h-4" />
                URL 직접 추가
              </Button>
            )}
          </div>

          {/* 검색바 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="앱 이름, 설명, 태그로 검색"
              className="pl-9 h-10"
            />
          </div>
        </header>

        {/* Body */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : filteredByCategory.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <div className="space-y-8">
            {/* Featured (검색 안 했을 때만 가로 추천 슬롯) */}
            {!query && filteredFeatured.length > 0 && (
              <FeaturedRow apps={filteredFeatured} installedSet={installedSet} onPick={onPick} />
            )}

            {/* Categories */}
            {filteredByCategory.map((cat) => (
              <section key={cat.key}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground/90">{cat.label}</h2>
                  <span className="ui-micro">{cat.apps.length}개</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                  {cat.apps.map((app) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      installed={installedSet.has(app.url.toLowerCase().replace(/\/$/, ""))}
                      onPick={onPick}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Featured row (가로 스크롤) ──────────────────────────────────────────

function FeaturedRow({
  apps,
  installedSet,
  onPick,
}: {
  apps: CatalogApp[];
  installedSet: Set<string>;
  onPick: (app: CatalogApp) => void | Promise<void>;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground/90">추천</h2>
        <span className="ui-micro">{apps.length}개</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            installed={installedSet.has(app.url.toLowerCase().replace(/\/$/, ""))}
            onPick={onPick}
            highlighted
          />
        ))}
      </div>
    </section>
  );
}

// ─── App card ────────────────────────────────────────────────────────────

function AppCard({
  app,
  installed,
  onPick,
  highlighted = false,
}: {
  app: CatalogApp;
  installed: boolean;
  onPick: (app: CatalogApp) => void | Promise<void>;
  highlighted?: boolean;
}) {
  const host = useMemo(() => {
    try {
      return new URL(app.url).hostname;
    } catch {
      return app.url;
    }
  }, [app.url]);

  return (
    <button
      type="button"
      onClick={() => void onPick(app)}
      className={cn(
        // 고정 높이로 통일 — description 짧고/길고 무관하게 같은 카드 크기
        "group relative flex flex-col gap-3 p-4 rounded-xl border bg-card/40 h-[180px] text-left w-full",
        "transition-all hover:bg-card hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5",
        highlighted
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent"
          : "border-border/60",
      )}
    >
      {/* 헤더: 아이콘 + 이름/호스트 (최소 44px, 좁으면 이름 2줄 wrap) */}
      <div className="flex items-start gap-3 min-h-[44px]">
        <div className="w-10 h-10 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <AppFavicon primarySrc={app.icon_url} host={host} size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground line-clamp-2 leading-tight break-words">{app.name}</div>
          <div className="ui-micro truncate">{host}</div>
        </div>
      </div>

      {/* 설명 (2 줄 고정 영역 — 비어있어도 같은 공간) */}
      <p className="ui-caption leading-relaxed line-clamp-2 min-h-[2.5rem]">
        {app.description ?? ""}
      </p>

      {/* 액션 (하단 고정) */}
      <div className="flex items-center justify-end mt-auto">
        {installed ? (
          <span className="ui-micro px-2.5 py-1 rounded-md bg-muted/40">
            추가됨
          </span>
        ) : (
          <span className="ui-fs-xs text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
            자세히 보기
          </span>
        )}
      </div>
    </button>
  );
}

// ─── States ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      카탈로그 불러오는 중
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
      <AlertCircle className="w-8 h-8 text-destructive/70" />
      <p className="text-sm text-foreground">카탈로그를 불러올 수 없습니다</p>
      <p className="ui-caption max-w-md">{message}</p>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
      <Globe className="w-8 h-8 text-muted-foreground/40" />
      {query ? (
        <>
          <p className="text-sm text-foreground">검색 결과 없음</p>
          <p className="ui-caption">
            <span className="text-foreground">"{query}"</span> 와 일치하는 앱이 없습니다.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground">카탈로그가 비어있습니다</p>
          <p className="ui-caption">관리자에게 문의하세요.</p>
        </>
      )}
    </div>
  );
}
