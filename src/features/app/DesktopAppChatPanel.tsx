import { Bot, Cable, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessageList } from "@/features/monitoring/components/ai-chat/ChatMessageList";
import { ChatInput } from "@/features/monitoring/components/ai-chat/ChatInput";
import type { UseAIChatReturn } from "@/features/monitoring/hooks/useAIChat";

type DesktopAppChatPanelProps = UseAIChatReturn;

export function DesktopAppChatPanel(chat: DesktopAppChatPanelProps) {
  const { messages, input, isLoading, setInput, handleSubmit } = chat;
  const isSplash = messages.length === 1 && messages[0].id === "welcome";

  if (isSplash) {
    return (
      <DesktopAppChatSplash
        input={input}
        isLoading={isLoading}
        onChange={setInput}
        onSubmit={handleSubmit}
      />
    );
  }

  // 대화 시작 후엔 welcome(인사) 메시지를 목록에서 제거 — splash 에서만 노출.
  const visibleMessages = messages.filter((m) => m.id !== "welcome");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatMessageList messages={visibleMessages} />
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}

function DesktopAppChatSplash({
  input,
  isLoading,
  onChange,
  onSubmit,
}: {
  input: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        <div className="rounded-lg border border-border/50 bg-background/35 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="text-sm font-semibold text-foreground">
                한국어로 자유롭게 물어보세요
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                현재 열려 있는 페이지를 참고해 설비 상태, 알람, 생산 지표를 답변합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex-shrink-0 border-t border-border/50 p-4">
        <div className="rounded-xl border border-border bg-card shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary/30">
          <Textarea
            value={input}
            onChange={(e) => onChange(e.target.value)}
            placeholder="어떤 도움을 드릴까요?"
            disabled={isLoading}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
            className="min-h-[88px] resize-none border-0 bg-transparent px-4 pb-2 pt-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 rounded-lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Cable className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-500" />
          <span>현재 페이지 인식은 허용된 FACTOR 도메인에서만 자동 첨부됩니다.</span>
        </div>
      </form>
    </div>
  );
}
