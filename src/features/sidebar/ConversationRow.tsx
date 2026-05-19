/**
 * ConversationRow — Recents 목록의 단일 행 (단순 title + leading dot, active 강조).
 */

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
      <button
        type="button"
        onClick={onClick}
        title={`${title}\n${formatLocalDateTime(item.updated_at)} · ${item.message_count}건 · ${formatRelativeTime(item.updated_at)}`}
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
        <span className="flex-1 text-[12.5px] truncate leading-tight">{title}</span>
      </button>
    </li>
  );
}
