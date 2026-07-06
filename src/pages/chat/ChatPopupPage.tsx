/**
 * ChatPopupPage (#/chat-popup) — 별도 떠 있는 작은 창의 AI 챗.
 *
 * Electron 의 frameless + alwaysOnTop 팝업 윈도우(chatPopupWindow.ts)에서 로드된다.
 * DesktopShell 밖의 독립 라우트라 자체 titlebar 를 그린다:
 *   - 상단 바: 드래그 영역(-webkit-app-region: drag) + 투명도 슬라이더 + 닫기
 *   - 본문: useAIChat (독립 대화) + ChatMessageList + ChatInput
 *
 * 투명도 슬라이더 → electron.chatPopup.setOpacity (메인 프로세스 win.setOpacity).
 */

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { useAIChat } from "@/features/monitoring/hooks/useAIChat";
import { ChatMessageList } from "@/features/monitoring/components/ai-chat/ChatMessageList";
import { ChatInput } from "@/features/monitoring/components/ai-chat/ChatInput";
import { electron } from "@desktop/lib/electron";

// -webkit-app-region 은 Electron 전용 CSS 속성 — CSSProperties 에 없어 computed key 로 우회.
const DRAG_REGION: React.CSSProperties = { ["WebkitAppRegion" as never]: "drag" };
const NO_DRAG: React.CSSProperties = { ["WebkitAppRegion" as never]: "no-drag" };

export default function ChatPopupPage() {
  const chat = useAIChat();
  const [opacity, setOpacity] = useState(100);

  const applyOpacity = (v: number) => {
    setOpacity(v);
    void electron.chatPopup.setOpacity(v / 100);
  };

  // 팝업은 독립 창이라 webview 에 직접 접근할 수 없다 → 제출 시 main 을 경유해
  // 본 창의 활성 webview 화면 스냅샷을 받아 pageSnapshot 으로 첨부한다.
  // 이게 있으면 백엔드 PipelineV3 가 화면분석 모드로 분기(clarification 우회).
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = chat.input;
    if (!content.trim() || chat.isLoading) return;
    const pageSnapshot = await electron.chatPopup.captureSnapshot();
    void chat.sendMessage(content, undefined, { pageSnapshot });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-card text-foreground">
      {/* 타이틀바 (드래그 영역) */}
      <div
        className="flex flex-shrink-0 items-center gap-2 border-b border-border/50 bg-background/40 px-3 py-2"
        style={DRAG_REGION}
      >
        <Bot className="h-4 w-4 flex-shrink-0 text-primary" />
        <span className="text-xs font-semibold text-foreground/90">FACTOR AI</span>
        <span
          className="rounded border border-primary/20 bg-primary/10 px-1.5 py-px text-[10px] text-primary"
          title="질문 시 본 창에서 보고 있는 화면을 자동으로 컨텍스트로 첨부합니다."
        >
          화면 인식
        </span>

        <div className="ml-auto flex items-center gap-2" style={NO_DRAG}>
          <label className="flex items-center gap-1.5" title="창 투명도">
            <span className="text-[10px] text-muted-foreground">투명도</span>
            <input
              type="range"
              min={20}
              max={100}
              value={opacity}
              onChange={(e) => applyOpacity(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer accent-primary"
            />
            <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
              {opacity}%
            </span>
          </label>
          <button
            type="button"
            onClick={() => void electron.chatPopup.close()}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            title="팝업 닫기"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 챗 본문 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatMessageList messages={chat.messages} />
        <ChatInput
          value={chat.input}
          onChange={chat.setInput}
          onSubmit={handleSubmit}
          isLoading={chat.isLoading}
        />
      </div>
    </div>
  );
}
