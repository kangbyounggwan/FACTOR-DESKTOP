/**
 * AppChatConversationBar — APP 탭 AI 패널 하단의 대화 전환기.
 *
 * APP 탭은 CHAT 탭과 달리 ConversationSidebar(새 대화/Recents)가 없다
 * (webview 진입 시 사이드바 자동 collapse). 그래서 패널 하단에 컴팩트한
 * 대화 전환 바를 둔다:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ [+ 새 대화] [이전대화1] [이전대화2] [이전대화3] │ ← 펼침(꺽쇠 ▼), 가로 슬라이드
 *   ├───────────────────────────────────────────────┤
 *   │ 💬  현재 대화 이름                          ▲ │ ← 항상 보이는 바 (꺽쇠 토글)
 *   └───────────────────────────────────────────────┘
 *
 * 데이터/액션은 모두 기존 인프라 재사용 (R6 — leaf 조합):
 *   - listConversationsV2 (@/api/chat) — 최근 대화 목록
 *   - getConversationTitle / stripAugmentation — 제목 파생
 *   - chat.{conversationId, loadConversation, startNewConversation} (useAIChat)
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, MessageSquare, Plus } from "lucide-react";
import { listConversationsV2, type ConversationListItem } from "@/api/chat";
import { useAuth } from "@/features/auth";
import { getConversationTitle } from "@/features/monitoring/components/ai-chat/conversation-helpers";
import { stripAugmentation } from "@/features/monitoring/hooks/transformCard";
import { cn } from "@/lib/utils";
import type { UseAIChatReturn } from "@/features/monitoring/hooks/useAIChat";

type ChatBits = Pick<
  UseAIChatReturn,
  "conversationId" | "loadConversation" | "startNewConversation" | "messages"
>;

interface Props {
  chat: ChatBits;
}

export function AppChatConversationBar({ chat }: Props) {
  const { conversationId, loadConversation, startNewConversation, messages } = chat;
  const { user, profile, isAuthenticated } = useAuth();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [open, setOpen] = useState(false);

  // 최근 대화 목록 — conversationId 가 바뀌면(새 대화 / 불러오기 / 첫 응답 저장 후)
  // 자동 재조회해 목록을 최신으로 유지.
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    let cancelled = false;
    listConversationsV2({
      userId: user?.id ?? null,
      companyId: profile?.company_id ?? null,
      limit: 10,
    })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        /* 목록 실패는 무음 — 전환 바는 보조 UI */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.company_id, isAuthenticated, conversationId]);

  // 현재 대화 이름: 목록에 있으면 그 제목, 없으면(아직 미저장 새 대화) 첫 사용자
  // 메시지에서 augment 제거 후 파생, 그것도 없으면 "새 대화".
  const currentItem = items.find((it) => it.id === conversationId);
  const firstUserRaw = messages.find((m) => m.role === "user")?.content ?? "";
  const currentTitle = currentItem
    ? getConversationTitle(currentItem)
    : stripAugmentation(firstUserRaw).trim() || "새 대화";

  // 이전 대화 최근 3개 (현재 대화 제외)
  const recent = items.filter((it) => it.id !== conversationId).slice(0, 3);

  const handleNew = () => {
    startNewConversation();
    setOpen(false);
  };
  const handleSelect = (id: string) => {
    void loadConversation(id);
    setOpen(false);
  };

  return (
    <div className="flex-shrink-0 bg-background/40">
      {/* 항상 보이는 바 — 현재 대화 이름 + 꺽쇠 토글 (상단 헤더 바로 아래) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/[0.04] transition-colors"
      >
        <History className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-foreground/85">
          {currentTitle}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
        )}
      </button>

      {/* 펼침 패널 — 아래로 펼쳐짐: +새 대화 + 최근 3개 (가로 슬라이드) */}
      {open && (
        <div className="px-3 pt-1 pb-2.5 border-t border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 pb-1 [scrollbar-width:thin]">
            <button
              type="button"
              onClick={handleNew}
              className={cn(
                "inline-flex flex-shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-md",
                "ui-fs-xs font-medium tracking-tight",
                "bg-primary/10 border border-primary/30 text-primary",
                "hover:bg-primary/15 transition-colors",
              )}
            >
              <Plus className="h-3 w-3" />
              새 대화
            </button>

            {recent.length === 0 ? (
              <span className="px-1.5 ui-micro text-muted-foreground/70">
                {isAuthenticated ? "이전 대화 없음" : "로그인 후 표시"}
              </span>
            ) : (
              recent.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => handleSelect(it.id)}
                  title={getConversationTitle(it)}
                  className={cn(
                    "group inline-flex max-w-[160px] flex-shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-md",
                    "ui-fs-xs tracking-tight",
                    "bg-foreground/[0.04] border border-border/40 text-foreground/75",
                    "hover:bg-foreground/[0.07] hover:border-border/60 hover:text-foreground",
                    "transition-colors",
                  )}
                >
                  <MessageSquare className="h-3 w-3 flex-shrink-0 text-foreground/45 group-hover:text-foreground/70" />
                  <span className="truncate">{getConversationTitle(it)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
