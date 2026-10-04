/**
 * ChatPage — DesktopShell 내부의 챗봇 본문 + (옵션) 우측 aside split.
 *
 * outer 구조(드래그 영역, 사이드바, auth modal, 페이지 state)는 모두 DesktopShell이 관리.
 * 이 페이지는 shell이 제공하는 chat 인스턴스를 그대로 AIChatPanelView에 전달.
 *
 * 우측 aside 는 둘 중 하나(셸이 상호 배타 보장):
 *  - 웹 연결(Tier 2 Phase A): 상단바 🌐 토글 → `ChatWebView`. webview ref 는 shell context 에 실려
 *    AI 웹제어(ref 스냅샷 → click/type)의 대상이 된다. 폭 380~1200 기본 720, 뷰포트 클램프 없음(기존 동작).
 *  - 보고서 패널(chat_panel_design E8, Figma C1~C6): 상단바 📊 토글 또는 SSE `report_sheet` 자동 →
 *    `ChatReportPanel`. 폭 420~960 기본 520, **뷰포트 클램프** max = innerWidth − 사이드바 − CHAT_MIN(360)
 *    로 채팅 컬럼 최소 폭을 지킨다(1280 창·사이드바 300 → 채팅 404 / 패널 520 = Figma C2).
 *  드래그 리사이즈는 `useResizablePanel` 공용(localStorage 영속). 드래그 중 투명 오버레이로
 *  webview/iframe 이 마우스 이벤트를 삼키지 않게 한다.
 *
 * ⚠ DesktopShell 의 `<main className="flex flex-1">` 은 default row flex.
 * AIChatPanelView 는 ChatMessageList / ChatQuickActions / ChatInput 세 자식
 * 을 세로 스택으로 기대하므로(FE 의 AIChatPanel 도 flex-col 로 wrap), desktop
 * 에서도 명시적으로 flex-col wrapper 가 필요. (없으면 input 이 우측 컬럼에
 * 박혀 나오는 v0.0.53 까지의 layout 버그 발생.)
 */

import { useCallback } from "react";
import { useAuth } from "@/features/auth";
import { AIChatPanelView } from "@/features/monitoring/components/ai-chat";
import type { BlockSpec } from "@/features/reports/designer";
import { useDesktopShell } from "@desktop/components/DesktopShellContext";
import { ChatReportPanel } from "@desktop/features/reportpanel/ChatReportPanel";
import { ChatWebView } from "@desktop/features/webagent/ChatWebView";
import { useResizablePanel } from "@desktop/hooks/useResizablePanel";

// 웹 패널 폭 — 드래그로 조절, localStorage 영속 (기존 값 그대로)
const WEB_MIN = 380;
const WEB_MAX = 1200;
const WEB_DEFAULT = 720;
const WEB_WIDTH_KEY = "factor.chat.webPanelWidth";

// 보고서 패널 폭 — E8: 420~960 기본 520 + 뷰포트 클램프
const REPORT_MIN = 420;
const REPORT_MAX = 960;
const REPORT_DEFAULT = 520;
const REPORT_WIDTH_KEY = "factor.chat.reportPanelWidth";
/** 패널이 열려 있을 때 채팅 컬럼이 지켜야 하는 최소 폭 */
const CHAT_MIN = 360;
/** 사이드바 접힘 시 좌측 expand 레일(w-7) 폭 — 클램프 계산에 사이드바 대신 들어간다 */
const SIDEBAR_RAIL = 28;

/** 블록 클릭 시 입력창 prefix — 사용자가 뒤에 지시를 이어 쓴다 ("…블록을 막대로 바꿔") */
const blockPrefix = (b: BlockSpec) => `『${b.title}』 블록을 `;
/** 입력창이 prefix 만 남은 상태(아직 지시를 안 씀) 인지 — 해제 시 이것만 지운다 */
const BLOCK_PREFIX_ONLY_RE = /^『[^』]*』 블록을 ?$/;

export default function ChatPage() {
  const { user, profile } = useAuth();
  const {
    chat,
    webPanelOpen,
    setWebPanelOpen,
    webviewRef,
    reportPanelOpen,
    setReportPanelOpen,
    sidebarWidth,
    sidebarCollapsed,
  } = useDesktopShell();

  // 웹 패널 — clamp 없음 = 기존 동작 불변
  const web = useResizablePanel(WEB_WIDTH_KEY, WEB_MIN, WEB_MAX, WEB_DEFAULT);

  // 보고서 패널 — 뷰포트 클램프 (사이드바 폭·접힘 변화에 재적용)
  const clampReport = useCallback(
    (next: number) =>
      Math.min(next, window.innerWidth - (sidebarCollapsed ? SIDEBAR_RAIL : sidebarWidth) - CHAT_MIN),
    [sidebarWidth, sidebarCollapsed],
  );
  const report = useResizablePanel(REPORT_WIDTH_KEY, REPORT_MIN, REPORT_MAX, REPORT_DEFAULT, clampReport);

  // 블록 선택 → 입력창 prefix. 해제 시엔 prefix 만 남아 있을 때만 지운다(쓰던 문장 보호)
  const handleBlockSelect = useCallback(
    (block: BlockSpec | null) => {
      if (block) {
        chat.setInput(blockPrefix(block));
      } else if (BLOCK_PREFIX_ONLY_RE.test(chat.input)) {
        chat.setInput("");
      }
    },
    [chat],
  );

  const handleSuggest = useCallback((text: string) => chat.setInput(text), [chat]);

  // 셸이 상호 배타를 보장하지만 렌더 측에서도 한 번에 aside 1개만
  const showWeb = webPanelOpen;
  const showReport = reportPanelOpen && !webPanelOpen;
  const dragging = web.dragging || report.dragging;

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      {/* 챗 본문 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AIChatPanelView {...chat} />
      </div>

      {showWeb && (
        <>
          {/* 드래그 핸들 */}
          <div
            onMouseDown={web.onDragStart}
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/40 transition-colors"
            title="드래그해서 폭 조절"
          />
          <aside
            style={{ width: web.width }}
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

      {showReport && (
        <>
          {/* 드래그 핸들 */}
          <div
            onMouseDown={report.onDragStart}
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/40 transition-colors"
            title="드래그해서 폭 조절"
          />
          <aside
            style={{ width: report.width }}
            className="flex-shrink-0 flex min-h-0 border-l border-border/60 rounded-l-lg overflow-hidden"
            aria-label="보고서 시트 패널"
          >
            <div className="flex-1 min-w-0 flex flex-col">
              <ChatReportPanel
                accountScope={user && profile?.company_id ? `${profile.company_id}:${user.id}` : undefined}
                conversationId={chat.conversationId}
                conversationRevision={chat.messages.length}
                onClose={() => setReportPanelOpen(false)}
                onBlockSelect={handleBlockSelect}
                onSuggest={handleSuggest}
              />
            </div>
          </aside>
        </>
      )}

      {/* 드래그 중 — webview/iframe 위를 지나도 mousemove/mouseup 이 우리 창에 오도록 투명 오버레이 */}
      {dragging && <div className="fixed inset-0 z-[60] cursor-col-resize" aria-hidden />}
    </div>
  );
}
