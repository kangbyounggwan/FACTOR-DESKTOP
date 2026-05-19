/**
 * ChatPage — DesktopShell 내부의 챗봇 본문만 책임.
 *
 * outer 구조(드래그 영역, 사이드바, auth modal, 페이지 state)는 모두 DesktopShell이 관리.
 * 이 페이지는 shell이 제공하는 chat 인스턴스를 그대로 AIChatPanelView에 전달.
 */

import { AIChatPanelView } from "@/features/monitoring/components/ai-chat";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";

export default function ChatPage() {
  const { chat } = useDesktopShell();
  return (
    <AIChatPanelView {...chat} showHistoryButton={false} headerless />
  );
}
