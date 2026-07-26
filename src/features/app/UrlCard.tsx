/**
 * UrlCard — APP 즐겨찾기 단일 카드.
 *
 * 카탈로그 카드(AppCard) 와 같은 크기로 통일 (h-[180px]).
 * iconUrl/description 이 있으면 사용, 없으면 favicon API 로 fallback.
 */

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppFavicon } from "./AppFavicon";
import type { AppUrlEntry } from "@desktop/types/electron";

interface Props {
  entry: AppUrlEntry;
  onClick: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function UrlCard({ entry, onClick, onEdit, onRemove }: Props) {
  const host = (() => {
    try {
      return new URL(entry.url).hostname;
    } catch {
      return entry.url;
    }
  })();

  return (
    <div
      className={cn(
        "group relative h-[180px] rounded-xl overflow-hidden flex flex-col",
        "border border-border/40 bg-card/40",
        "hover:border-primary/40 hover:bg-card/70 hover:shadow-lg hover:shadow-primary/5",
        "transition-all duration-200",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-left p-4 flex flex-col gap-3 min-h-0"
      >
        {/* 헤더 (최소 44px — 카탈로그 카드와 정렬, 좁으면 제목 2줄 wrap) */}
        <div className="flex items-start gap-3 min-h-[44px]">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center overflow-hidden">
            <AppFavicon primarySrc={entry.iconUrl} host={host} size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground line-clamp-2 leading-tight break-words group-hover:text-primary transition-colors">
              {entry.name}
            </p>
            <p className="ui-fs-xs text-muted-foreground truncate">{host}</p>
          </div>
        </div>

        {/* 설명 (2줄 고정 영역, 비어 있어도 같은 높이) */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {entry.description ?? ""}
        </p>
      </button>

      {/* 액션 (hover 시 등장) */}
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/60 backdrop-blur-sm hover:bg-background"
          onClick={onEdit}
          title="편집"
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/60 backdrop-blur-sm hover:bg-destructive/15 hover:text-destructive"
          onClick={onRemove}
          title="삭제"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
