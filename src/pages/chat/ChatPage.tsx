/**
 * ChatPage — DesktopShell 내부의 챗봇 본문 + (옵션) 웹 렌더러 split.
 *
 * outer 구조(드래그 영역, 사이드바, auth modal, 페이지 state)는 모두 DesktopShell이 관리.
 * 이 페이지는 shell이 제공하는 chat 인스턴스를 그대로 AIChatPanelView에 전달.
 *
 * 웹 연결(Tier 2 Phase A): 상단바 🌐 토글 시 우측에 `ChatWebView` 를 띄워
 * "채팅 + 웹" 을 한 화면에서 다룬다. 그 webview ref 는 shell context 에 실려
 * AI 웹제어(ref 스냅샷 → click/type)의 대상이 된다.
 *
 * ⚠ DesktopShell 의 `<main className="flex flex-1">` 은 default row flex.
 * AIChatPanelView 는 ChatMessageList / ChatQuickActions / ChatInput 세 자식
 * 을 세로 스택으로 기대하므로(FE 의 AIChatPanel 도 flex-col 로 wrap), desktop
 * 에서도 명시적으로 flex-col wrapper 가 필요. (없으면 input 이 우측 컬럼에
 * 박혀 나오는 v0.0.53 까지의 layout 버그 발생.)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AIChatPanelView } from "@/features/monitoring/components/ai-chat";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";
import { ChatWebView } from "@desktop/features/webagent/ChatWebView";

// 웹 패널 폭 — 드래그로 조절, localStorage 영속
const WEB_MIN = 380;
const WEB_MAX = 1200;
const WEB_DEFAULT = 720;
const WEB_WIDTH_KEY = "factor.chat.webPanelWidth";

export default function ChatPage() {
  const { chat, webPanelOpen, setWebPanelOpen, webviewRef } = useDesktopShell();

  const [webWidth, setWebWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WEB_WIDTH_KEY));
    return saved >= WEB_MIN && saved <= WEB_MAX ? saved : WEB_DEFAULT;
  });
  useEffect(() => {
    localStorage.setItem(WEB_WIDTH_KEY, String(webWidth));
  }, [webWidth]);

  // 드래그 리사이즈 (좌측 경계를 잡고 좌우로)
  const dragging = useRef(false);
  const onDragStart = useCallback(() => {
    dragging.current = true;
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = window.innerWidth - e.clientX;
      setWebWidth(Math.min(WEB_MAX, Math.max(WEB_MIN, next)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      {/* 챗 본문 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AIChatPanelView {...chat} />
      </div>

      {webPanelOpen && (
        <>
          {/* 드래그 핸들 */}
          <div
            onMouseDown={onDragStart}
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/40 transition-colors"
            title="드래그해서 폭 조절"
          />
          <aside
            style={{ width: webWidth }}
            className="flex-shrink-0 flex min-h-0 border-l border-border/60 rounded-l-lg overflow-hidden"
          >
            <div className="flex-1 min-w-0 flex flex-col">
              <ChatWebView
                webviewRef={webviewRef}
                onClose={() => setWebPanelOpen(false)}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
