/**
 * ChatPage — DesktopShell 내부의 챗봇 본문만 책임.
 *
 * outer 구조(드래그 영역, 사이드바, auth modal, 페이지 state)는 모두 DesktopShell이 관리.
 * 이 페이지는 shell이 제공하는 chat 인스턴스를 그대로 AIChatPanelView에 전달.
 *
 * ⚠ DesktopShell 의 `<main className="flex flex-1">` 은 default row flex.
 * AIChatPanelView 는 ChatMessageList / ChatQuickActions / ChatInput 세 자식
 * 을 세로 스택으로 기대하므로(FE 의 AIChatPanel 도 flex-col 로 wrap), desktop
 * 에서도 명시적으로 flex-col wrapper 가 필요. (없으면 input 이 우측 컬럼에
 * 박혀 나오는 v0.0.53 까지의 layout 버그 발생.)
 */

import { AIChatPanelView } from "@/features/monitoring/components/ai-chat";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";

export default function ChatPage() {
  const { chat } = useDesktopShell();
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <AIChatPanelView {...chat} />
    </div>
  );
}
