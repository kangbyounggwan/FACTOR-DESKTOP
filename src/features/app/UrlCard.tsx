/**
 * UrlCard — APP 즐겨찾기 단일 카드.
 *
 * 모던 디자인:
 * - 부드러운 카드 (rounded-xl + subtle border + backdrop-blur)
 * - favicon이 작은 컨테이너 안에 (시각적 정돈)
 * - hover: 살짝 elevate (translate-y) + primary glow + 액션 아이콘 등장
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
        "group relative rounded-xl overflow-hidden",
        "border border-border/40 bg-card/40 backdrop-blur-sm",
        "hover:border-primary/40 hover:bg-card/70",
        "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        "transition-all duration-200",
      )}
    >
      <button type="button" onClick={onClick} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-background/60 border border-border/40 flex items-center justify-center overflow-hidden">
            <img
              src={favicon}
              alt=""
              className="w-5 h-5"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
              {entry.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
              {host}
            </p>
          </div>
        </div>
      </button>
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
