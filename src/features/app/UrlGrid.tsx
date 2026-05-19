/**
 * UrlGrid — APP 홈 화면 (선택된 URL이 없을 때 표시).
 * URL 카드 그리드 + 빈 상태 + "URL 추가" CTA.
 */

import { Globe, Plus, Loader2 } from "lucide-react";
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
}

export function UrlGrid({
  urls,
  loading,
  onAddClick,
  onSelect,
  onEdit,
  onRemove,
}: Props) {
  return (
    <ScrollArea className="h-full">
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              앱 즐겨찾기
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              자주 쓰는 웹 페이지를 등록해 앱에서 바로 열 수 있습니다.
            </p>
          </div>
          <Button onClick={onAddClick} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            URL 추가
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            불러오는 중
          </div>
        ) : urls.length === 0 ? (
          <EmptyAddCard onClick={onAddClick} />
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

function EmptyAddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex flex-col items-center justify-center gap-3 py-16",
        "rounded-2xl border-2 border-dashed border-border/60",
        "hover:border-primary/40 hover:bg-primary/[0.03] transition-colors",
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10">
        <Plus className="w-6 h-6 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">첫 URL 추가하기</p>
        <p className="text-xs text-muted-foreground mt-1">
          예: Supabase, GitHub, 사내 위키 등
        </p>
      </div>
    </button>
  );
}

function AddNewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-5 min-h-[120px]",
        "rounded-xl border-2 border-dashed border-border/60",
        "hover:border-primary/40 hover:bg-primary/[0.03] transition-colors",
        "text-muted-foreground hover:text-foreground",
      )}
    >
      <Plus className="w-5 h-5" />
      <span className="text-xs">새 URL</span>
    </button>
  );
}
