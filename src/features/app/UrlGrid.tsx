/**
 * UrlGrid — APP 홈 화면 (선택된 URL이 없을 때 표시).
 *
 * 모던/클린 디자인:
 * - 빈 상태: 화면 중앙 컴팩트 카드, 그라데이션 글로우 + 추천 quick-add 칩
 * - 헤더: 간결한 타이틀 + 우측 CTA
 * - 카드 그리드: 통일된 spacing, hover에 subtle elevation
 */

import { Globe, Plus, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { UrlCard } from "./UrlCard";
import type { AppUrlEntry } from "@desktop/types/electron";

interface Props {
  urls: AppUrlEntry[];
  loading: boolean;
  onAddClick: () => void;
  onSelect: (id: string) => void;
  onEdit: (u: AppUrlEntry) => void;
  onRemove: (id: string) => void;
  /** 추천 URL quick-add (이름 + URL) — 빈 상태에서 chip으로 표시 */
  onQuickAdd?: (name: string, url: string) => void | Promise<void>;
}

/** 비어있을 때 보여줄 추천 URL들 (한 번 클릭에 추가) */
const SUGGESTIONS: Array<{ name: string; url: string; icon?: LucideIcon }> = [
  { name: "Supabase", url: "https://supabase.com/dashboard" },
  { name: "GitHub", url: "https://github.com" },
  { name: "Linear", url: "https://linear.app" },
  { name: "Notion", url: "https://notion.so" },
];

export function UrlGrid({
  urls,
  loading,
  onAddClick,
  onSelect,
  onEdit,
  onRemove,
  onQuickAdd,
}: Props) {
  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-10 max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">앱 즐겨찾기</h1>
            <p className="text-xs text-muted-foreground mt-1.5">
              자주 쓰는 웹 페이지를 등록해 앱에서 바로 열 수 있어요
            </p>
          </div>
          <Button onClick={onAddClick} size="sm" className="gap-2 h-9 px-4">
            <Plus className="w-4 h-4" />
            URL 추가
          </Button>
        </header>

        {/* Body */}
        {loading ? (
          <LoadingState />
        ) : urls.length === 0 ? (
          <EmptyHero onAddClick={onAddClick} onQuickAdd={onQuickAdd} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {urls.map((u) => (
              <UrlCard
                key={u.id}
                entry={u}
                onClick={() => onSelect(u.id)}
                onEdit={() => onEdit(u)}
                onRemove={() => onRemove(u.id)}
              />
            ))}
            <AddNewCard onClick={onAddClick} />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Empty Hero (modern centered card with gradient glow + suggestions) ──

function EmptyHero({
  onAddClick,
  onQuickAdd,
}: {
  onAddClick: () => void;
  onQuickAdd?: (name: string, url: string) => void | Promise<void>;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center py-20">
      {/* 부드러운 글로우 배경 — primary 톤 radial gradient */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-[420px] h-[420px] rounded-full bg-primary/10 blur-3xl opacity-60" />
      </div>

      {/* 메인 카드 */}
      <div className="relative z-10 max-w-md w-full text-center space-y-6">
        {/* 아이콘 */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg shadow-primary/10">
          <Globe className="w-7 h-7 text-primary" />
        </div>

        {/* 카피 */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            첫 즐겨찾기를 추가하세요
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            URL을 등록하면 데스크탑 안에서 바로 열 수 있어요. 외부 브라우저 전환 없이.
          </p>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center">
          <Button onClick={onAddClick} size="default" className="gap-2 h-10 px-5 shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" />
            URL 추가하기
          </Button>
        </div>

        {/* Suggestions (one-click presets) */}
        {onQuickAdd && (
          <div className="pt-6 space-y-3 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              빠르게 시작하기
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <SuggestionChip
                  key={s.url}
                  name={s.name}
                  url={s.url}
                  onClick={() => void onQuickAdd(s.name, s.url)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionChip({
  name,
  url,
  onClick,
}: {
  name: string;
  url: string;
  onClick: () => void;
}) {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
        "bg-card/60 border border-border/60 backdrop-blur-sm",
        "text-xs font-medium text-foreground/80",
        "hover:bg-card hover:border-primary/40 hover:text-foreground hover:shadow-sm",
        "transition-all",
      )}
    >
      <img
        src={favicon}
        alt=""
        className="w-3.5 h-3.5 rounded-sm"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      {name}
      <Plus className="w-3 h-3 text-muted-foreground" />
    </button>
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      불러오는 중
    </div>
  );
}

// ─── + 카드 (그리드 안 추가 액션) ──────────────────────────────────────

function AddNewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center gap-2 p-5 min-h-[120px]",
        "rounded-xl border border-dashed border-border/60 bg-card/20",
        "hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-sm",
        "transition-all text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="w-9 h-9 rounded-full bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
        <Plus className="w-4 h-4 group-hover:text-primary transition-colors" />
      </div>
      <span className="text-xs font-medium">새 URL</span>
    </button>
  );
}
