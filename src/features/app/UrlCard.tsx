/**
 * UrlCard — APP 즐겨찾기 단일 카드.
 * favicon + 이름 + 호스트. hover 시 우상단 편집/삭제 액션.
 */

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm",
        "hover:border-primary/40 hover:bg-card/60 hover:shadow-md hover:shadow-primary/5",
        "transition-all",
      )}
    >
      <button type="button" onClick={onClick} className="w-full text-left p-4">
        <div className="flex items-start gap-2.5">
          <img
            src={favicon}
            alt=""
            className="w-7 h-7 rounded-md flex-shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {entry.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
              {host}
            </p>
          </div>
        </div>
      </button>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} title="편집">
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:text-destructive"
          onClick={onRemove}
          title="삭제"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
