/**
 * DesktopShell — EXE 페이지들의 공통 outer 레이아웃.
 *
 * 책임:
 * - DesktopTopBar + ConversationSidebar + main outlet
 * - useAIChat 단일 인스턴스 (페이지 전환에도 유지)
 * - sidebar width / collapsed 상태 (페이지 전환에도 유지)
 * - DASHBOARD 게스트 차단 모달 (RequireAuthDialog) — 채팅 401 의 "로그인" 버튼도 같은 모달(채팅 문구)로 연다
 * - location.state로 다른 페이지에서 conversation 로드/새대화 트리거 처리
 * - 챗 옆 aside 2종의 열림 플래그 (웹 연결 / 보고서 패널 — 상호 배타). 보고서 패널은
 *   공유 store `useSheetPanelStore.open`(SSE report_sheet · 대화 복원 포인터) 을 구독해 자동 열림
 *
 * 사용:
 *   <Route element={isDesktop ? <DesktopShell><Outlet/></DesktopShell> : <Outlet/>}>
 *     <Route path="/chat" element={<ChatPage/>} />
 *     <Route path="/app"  element={<AppPage/>} />
 *   </Route>
 *
 * 자식 페이지는 `useDesktopShell()`로 chat/sidebar 상태/requireAuth 접근.
 */

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { AUTH_GATE_DESCRIPTION, AUTH_REQUIRED_TITLE, useAuth } from "@/features/auth";
import { useAIChat } from "@/features/monitoring/hooks/useAIChat";
import {
  CHAT_AUTH_REQUIRED_DESCRIPTION,
  CHAT_AUTH_REQUIRED_TITLE,
  CHAT_SESSION_EXPIRED_DESCRIPTION,
  CHAT_SESSION_EXPIRED_TITLE,
} from "@/features/monitoring/constants/aiChatConstants";
import { useChatInputFocusAfterLogin } from "@/features/monitoring/hooks/useChatInputFocusAfterLogin";
import { LineMonitoringSidebarBare } from "@/features/monitoring/components/LineMonitoringSidebar";
import { LineMonitoringProvider } from "@/features/monitoring/context/LineMonitoringContext";
// barrel 이 아니라 core — 디자이너 UI(gridstack CSS 등) 를 셸 초기 번들에 끌어오지 않는다.
import { useSheetPanelStore } from "@/features/reports/designer/core";
import {
  ConversationSidebar,
  SIDEBAR_DEFAULT_WIDTH,
} from "@desktop/features/sidebar";
import { AppSidebar } from "@desktop/features/app";
import { DesktopAuthWidget } from "./DesktopAuthWidget";
import { DesktopTopBar } from "./DesktopTopBar";
import { RequireAuthDialog } from "./RequireAuthDialog";
import { DesktopShellContext, type DesktopShellContextValue } from "./DesktopShellContext";

/** 대화 전환 직전/직후 이 시간 안에 store 가 열린 채 바뀌었으면 "복원 포인터" 로 보고 패널을 유지 */
const SHEET_RESTORE_GRACE_MS = 2000;

export function DesktopShell({ children }: { children: ReactNode }) {
  // 보고서 패널을 가진 호스트임을 훅에 알린다 — 이 옵션이 없는 호스트(웹 셸 1차·팝업) 에서는 훅이
  // report_sheet/복원 직후 store.open 을 닫아, 보이지 않는 패널이 "열림" 으로 남아 매 턴
  // report_context.panel_open:true 가 가는 일을 막는다. 레이아웃 반영은 아래 store.open 미러 효과.
  const openReportPanelFromChat = useCallback(() => {
    useSheetPanelStore.getState().setOpen(true);
  }, []);
  // 채팅 401 안내 카드의 "로그인" → 로그인 모달. useAIChat 이 모달 상태보다 먼저 호출되므로 ref 로 잇는다
  // (실제 핸들러는 아래 모달 상태 선언 뒤에서 채운다). 훅은 옵션을 ref 로 최신 참조 — memo 불필요.
  const chatAuthRequiredRef = useRef<((retry: () => void) => void) | null>(null);
  const chat = useAIChat({
    onOpenReportPanel: openReportPanelFromChat,
    onAuthRequired: (retry) => chatAuthRequiredRef.current?.(retry),
  });
  // 채팅 401 로그인 성공 뒤 포커스를 채팅 입력창으로(모달이 닫히면 <body> 로 떨어지지 않게).
  const chatInputFocus = useChatInputFocusAfterLogin(chat.isLoading);
  const armChatInputFocus = chatInputFocus.armAfterLogin;
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const userEmail = user?.email ?? undefined;

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 웹 연결 패널 (챗 옆 웹 렌더러) — 상단바 🌐 토글, ChatPage 가 렌더 (Tier 2 Phase A)
  const [webPanelOpen, setWebPanelOpenState] = useState(false);
  const webviewRef = useRef<HTMLElement | null>(null);

  // 보고서 패널 (챗 옆 시트 미리보기) — 상단바 📊 토글 + 공유 store 미러, ChatPage 가 렌더 (E8).
  // 웹 패널과 상호 배타: 한 번에 aside 1개.
  const [reportPanelOpen, setReportPanelOpenState] = useState(false);
  const sheetPanelOpen = useSheetPanelStore((s) => s.open);

  // 공유 store `open`(SSE report_sheet → setFromEvent / 대화 복원 포인터 → setFromPointer / 패널 ✕)
  // 을 셸 레이아웃 플래그로 미러. 열릴 때 웹 패널을 닫는다.
  useEffect(() => {
    setReportPanelOpenState(sheetPanelOpen);
    if (sheetPanelOpen) setWebPanelOpenState(false);
  }, [sheetPanelOpen]);

  const setReportPanelOpen = useCallback((open: boolean) => {
    // store 가 열림의 SoT 미러 — 여기서 같이 갱신해 두 값이 어긋나지 않게 한다
    useSheetPanelStore.getState().setOpen(open);
    setReportPanelOpenState(open);
    if (open) setWebPanelOpenState(false);
  }, []);

  const setWebPanelOpen = useCallback((open: boolean) => {
    setWebPanelOpenState(open);
    if (open) {
      setReportPanelOpenState(false);
      useSheetPanelStore.getState().setOpen(false);
    }
  }, []);

  // store 가 "열린 채로" 마지막으로 바뀐 시각 — 대화 전환 시 복원 포인터와 구분하는 데 쓴다
  const sheetTouchedAtRef = useRef(0);
  useEffect(
    () =>
      useSheetPanelStore.subscribe((s) => {
        if (s.open) sheetTouchedAtRef.current = Date.now();
      }),
    [],
  );

  // 대화 전환과 시트 패널 (시트는 대화에 붙는 상태 — final_answer 포인터로 복원됨):
  //  - 새 대화(+ / startNewConversation, id → null): store 를 비우고 패널을 닫는다.
  //  - 첫 턴 commit(null → id): 이 턴에서 만들어진 시트를 닫으면 안 되므로 손대지 않는다.
  //  - 기존 대화 A → B 로드: 복원 포인터(setFromPointer) 가 같은 틱에 store 를 건드리면 유지,
  //    아니면(시트 없는 대화) 패널만 닫는다(시트 유지 — 토글로 재오픈 가능). 포인터가 늦게 오면
  //    위 미러 효과가 다시 연다(최악 깜빡임 1회).
  const prevConversationIdRef = useRef<string | null>(chat.conversationId);
  useEffect(() => {
    const prev = prevConversationIdRef.current;
    const next = chat.conversationId;
    prevConversationIdRef.current = next;
    if (prev === next) return;
    const store = useSheetPanelStore.getState();
    if (next === null) {
      store.reset();
      return;
    }
    if (prev === null) return;
    const restoredJustNow = Date.now() - sheetTouchedAtRef.current < SHEET_RESTORE_GRACE_MS;
    if (!restoredJustNow && store.open) store.close();
  }, [chat.conversationId]);

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  // 페이지별 back handler — 상단 ← 버튼 클릭 시 우선 호출
  const backHandlerRef = useRef<(() => boolean) | null>(null);
  const setBackHandler = useCallback((h: (() => boolean) | null) => {
    backHandlerRef.current = h;
  }, []);
  const handleShellBack = useCallback(() => {
    if (backHandlerRef.current) {
      const handled = backHandlerRef.current();
      if (handled) return;
    }
    navigate(-1);
  }, [navigate]);
  // 기본값 = DASHBOARD 탭(라인 모니터링) 진입 문구. 진입별 문구는 design.md §4.1(@/features/auth authCopy).
  const [authDialogTitle, setAuthDialogTitle] = useState<string>(AUTH_REQUIRED_TITLE);
  const [authDialogDescription, setAuthDialogDescription] = useState<string>(
    AUTH_GATE_DESCRIPTION.monitoring,
  );
  // 세션 만료 재로그인 때만 마지막 이메일을 채운다(모달은 비밀번호 칸에서 시작)
  const [authDialogDefaultEmail, setAuthDialogDefaultEmail] = useState<string | undefined>(undefined);

  // 다른 페이지에서 navigate("/chat", { state: { loadConversationId / startNew } }) 처리
  useEffect(() => {
    const state = location.state as
      | { loadConversationId?: string; startNew?: boolean }
      | null;
    // 채팅 진입 신호만 처리하고 지운다 — 다른 화면이 넘긴 router state(가공 설비 세부 {from, focus} — 뒤로 = history back 표시 ·
    // 첫 선택)는 그 화면이 읽도록 그대로 둔다(2026-10-04 가공 스택 S6, output/mach_dashboard/design.md §1.3)
    if (!state || (!state.loadConversationId && !state.startNew)) return;
    if (state.loadConversationId) {
      void chat.loadConversation(state.loadConversationId);
    } else if (state.startNew) {
      chat.startNewConversation();
    }
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const requireAuth = useCallback<DesktopShellContextValue["requireAuth"]>(
    (action, options) => {
      if (isAuthenticated) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setAuthDialogTitle(options?.title ?? AUTH_REQUIRED_TITLE);
      setAuthDialogDescription(options?.description ?? AUTH_GATE_DESCRIPTION.monitoring);
      setAuthDialogDefaultEmail(undefined);
      setAuthDialogOpen(true);
    },
    [isAuthenticated],
  );

  const handleAuthSuccess = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  // 채팅 401 — requireAuth 와 달리 isAuthenticated 여도 **항상** 모달을 연다. 로그인돼 있는데 401 이 났다면
  // 토큰 만료·거부라서, 바로 action 을 실행하면 같은 401 이 되풀이된다. 로그인 성공 시 retry(같은 질문 재전송)
  // + 모달이 닫히면 채팅 입력창으로 포커스.
  // "로그인" 을 누른 시점에 로그인 상태면 세션 만료 문구 + 마지막 이메일(비밀번호 칸에서 시작, design.md §4.1·S1 변형).
  useEffect(() => {
    chatAuthRequiredRef.current = (retry) => {
      pendingActionRef.current = () => {
        armChatInputFocus();
        retry();
      };
      const sessionExpired = isAuthenticated;
      setAuthDialogTitle(sessionExpired ? CHAT_SESSION_EXPIRED_TITLE : CHAT_AUTH_REQUIRED_TITLE);
      setAuthDialogDescription(
        sessionExpired ? CHAT_SESSION_EXPIRED_DESCRIPTION : CHAT_AUTH_REQUIRED_DESCRIPTION,
      );
      setAuthDialogDefaultEmail(sessionExpired ? userEmail : undefined);
      setAuthDialogOpen(true);
    };
    return () => {
      chatAuthRequiredRef.current = null;
    };
  }, [armChatInputFocus, isAuthenticated, userEmail]);

  // 사이드바 Recents 클릭 — /chat에 있으면 단순 로드, 다른 페이지면 /chat로 navigate
  const isOnChat = location.pathname.startsWith("/chat");
  const isOnMonitoring = location.pathname.startsWith("/monitoring");
  const isOnApp = location.pathname.startsWith("/app");
  // /settings 는 Claude 데스크탑 톤으로 conversation sidebar 숨김 — 설정 자체가
  // 본인의 좌측 nav(SettingsNavList) 를 가지므로 두 nav 가 동시에 보이면 잡스럽다.
  // 사이드바 expand 트리거(왼쪽 가장자리 ▶ 버튼)도 같이 숨김.
  const isOnSettings = location.pathname.startsWith("/settings");
  const handleSelectRecent = useCallback(
    (id: string) => {
      if (isOnChat) {
        void chat.loadConversation(id);
      } else {
        navigate("/chat", { state: { loadConversationId: id } });
      }
    },
    [isOnChat, chat, navigate],
  );

  const handleStartNew = useCallback(() => {
    if (isOnChat) {
      chat.startNewConversation();
    } else {
      navigate("/chat", { state: { startNew: true } });
    }
  }, [isOnChat, chat, navigate]);

  const contextValue = useMemo<DesktopShellContextValue>(
    () => ({
      chat,
      sidebarCollapsed,
      setSidebarCollapsed,
      sidebarWidth,
      setSidebarWidth,
      requireAuth,
      setBackHandler,
      webPanelOpen,
      setWebPanelOpen,
      webviewRef,
      reportPanelOpen,
      setReportPanelOpen,
    }),
    [
      chat,
      sidebarCollapsed,
      sidebarWidth,
      requireAuth,
      setBackHandler,
      webPanelOpen,
      setWebPanelOpen,
      reportPanelOpen,
      setReportPanelOpen,
    ],
  );

  return (
    <DesktopShellContext.Provider value={contextValue}>
      <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
        <DesktopTopBar
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onNewChat={handleStartNew}
          onBack={handleShellBack}
          // 웹 연결은 챗 화면에서만 — 다른 페이지(APP 은 자체 탭 webview 보유)엔 숨김
          onToggleWeb={isOnChat ? () => setWebPanelOpen(!webPanelOpen) : undefined}
          webPanelOpen={webPanelOpen}
          // 보고서 패널도 챗 화면에서만(ChatPage 가 aside 를 그린다). 웹 패널과 상호 배타
          onToggleReport={isOnChat ? () => setReportPanelOpen(!reportPanelOpen) : undefined}
          reportPanelOpen={reportPanelOpen}
        />

        {(() => {
          const inner = (
            <div className="flex-1 flex min-h-0 gap-2 px-2 pt-3 pb-2">
              {!sidebarCollapsed && !isOnSettings && (
                <ConversationSidebar
                  onSelect={handleSelectRecent}
                  onStartNew={handleStartNew}
                  currentConversationId={chat.conversationId}
                  bottomSlot={<DesktopAuthWidget inline />}
                  onDashboardClick={() =>
                    requireAuth(() => navigate("/monitoring"))
                  }
                  width={sidebarWidth}
                  onWidthChange={setSidebarWidth}
                  onCollapseRequest={() => setSidebarCollapsed(true)}
                  customRecents={
                    isOnMonitoring ? (
                      // /monitoring: 좌측 라인 목록 (chrome 없는 변형 — ConversationSidebar 가 chrome 제공)
                      <LineMonitoringSidebarBare />
                    ) : isOnApp ? (
                      <AppSidebar />
                    ) : undefined
                  }
                  recentsLabel={
                    isOnMonitoring ? "Zone" : isOnApp ? "Apps" : undefined
                  }
                />
              )}

              {/* 사이드바 접힘 시 좌측 가장자리에 expand 버튼 노출 — 사용자가
                  사이드바를 다시 열 수 있는 명시적 트리거. webview 모드에서
                  특히 중요 (TopBar 의 ≡ 가시성 떨어짐).
                  /settings 에서는 사이드바 자체를 숨기므로 expand 트리거도 숨김. */}
              {sidebarCollapsed && !isOnSettings && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  title="사이드바 열기"
                  className="flex-shrink-0 w-7 h-full flex items-center justify-center rounded-md bg-card/30 hover:bg-card border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              <main className="flex-1 flex min-w-0 overflow-hidden">{children}</main>
            </div>
          );

          // /monitoring 에서만 LineMonitoringProvider 활성 — 좌측 사이드바와 본문이
          // 같은 selectedLineId/factory state 공유.
          return isOnMonitoring ? (
            <LineMonitoringProvider>{inner}</LineMonitoringProvider>
          ) : (
            inner
          );
        })()}

        <RequireAuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          onSuccess={handleAuthSuccess}
          title={authDialogTitle}
          description={authDialogDescription}
          defaultEmail={authDialogDefaultEmail}
          onCloseAutoFocus={chatInputFocus.onCloseAutoFocus}
        />
      </div>
    </DesktopShellContext.Provider>
  );
}
