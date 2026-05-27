/**
 * ConversationRow — Recents 목록의 단일 행 (단순 title + leading dot, active 강조).
 *
 * Hover 시 native `title` attr 대신 shadcn Tooltip 사용 — 우리 디자인 시스템과 동일한
 * 둥근 모서리 + 테두리 + 그림자 (rounded-md border bg-popover shadow-md).
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatLocalDateTime, formatRelativeTime } from "@/lib/datetime";
import { getConversationTitle } from "@/features/monitoring/components/ai-chat/conversation-helpers";
import type { ConversationListItem } from "@/api/chat";

interface Props {
  item: ConversationListItem;
  active?: boolean;
  onClick: () => void;
}

export function ConversationRow({ item, active, onClick }: Props) {
  const title = getConversationTitle(item);

  return (
    <li>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left",
              "transition-colors",
              active
                ? "bg-primary/10 text-foreground"
                : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                active ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
            <span className="flex-1 text-[12.5px] truncate leading-tight">
              {title}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="max-w-[260px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-medium leading-snug">{title}</span>
            <span className="text-[10.5px] text-muted-foreground">
              {formatLocalDateTime(item.updated_at)} · {item.message_count}건 ·{" "}
              {formatRelativeTime(item.updated_at)}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
