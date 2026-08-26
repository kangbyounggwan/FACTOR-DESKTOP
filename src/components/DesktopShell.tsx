/**
 * DesktopShell — EXE 페이지들의 공통 outer 레이아웃.
 *
 * 책임:
 * - DesktopTopBar + ConversationSidebar + main outlet
 * - useAIChat 단일 인스턴스 (페이지 전환에도 유지)
 * - sidebar width / collapsed 상태 (페이지 전환에도 유지)
 * - DASHBOARD 게스트 차단 모달 (RequireAuthDialog)
 * - location.state로 다른 페이지에서 conversation 로드/새대화 트리거 처리
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
import { useAuth } from "@/features/auth";
import { useAIChat } from "@/features/monitoring/hooks/useAIChat";
import { LineMonitoringSidebarBare } from "@/features/monitoring/components/LineMonitoringSidebar";
import { LineMonitoringProvider } from "@/features/monitoring/context/LineMonitoringContext";
import {
  ConversationSidebar,
  SIDEBAR_DEFAULT_WIDTH,
} from "@desktop/features/sidebar";
import { AppSidebar } from "@desktop/features/app";
import { DesktopAuthWidget } from "./DesktopAuthWidget";
import { DesktopTopBar } from "./DesktopTopBar";
import { RequireAuthDialog } from "./RequireAuthDialog";
import { DesktopShellContext, type DesktopShellContextValue } from "./DesktopShellContext";

export function DesktopShell({ children }: { children: ReactNode }) {
  const chat = useAIChat();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 웹 연결 패널 (챗 옆 웹 렌더러) — 상단바 🌐 토글, ChatPage 가 렌더 (Tier 2 Phase A)
  const [webPanelOpen, setWebPanelOpen] = useState(false);
  const webviewRef = useRef<HTMLElement | null>(null);

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
  const [authDialogTitle, setAuthDialogTitle] = useState<string>(
    "DASHBOARD 접근에는 로그인이 필요합니다",
  );
  const [authDialogDescription, setAuthDialogDescription] = useState<string>(
    "이메일로 로그인하면 대시보드 위젯과 대화 이력을 사용할 수 있습니다.",
  );

  // 다른 페이지에서 navigate("/chat", { state: { loadConversationId / startNew } }) 처리
  useEffect(() => {
    const state = location.state as
      | { loadConversationId?: string; startNew?: boolean }
      | null;
    if (!state) return;
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
      setAuthDialogTitle(
        options?.title ?? "DASHBOARD 접근에는 로그인이 필요합니다",
      );
      setAuthDialogDescription(
        options?.description ??
          "이메일로 로그인하면 대시보드 위젯과 대화 이력을 사용할 수 있습니다.",
      );
      setAuthDialogOpen(true);
    },
    [isAuthenticated],
  );

  const handleAuthSuccess = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

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
    }),
    [chat, sidebarCollapsed, sidebarWidth, requireAuth, setBackHandler, webPanelOpen],
  );

  return (
    <DesktopShellContext.Provider value={contextValue}>
      <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
        <DesktopTopBar
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onNewChat={handleStartNew}
          onBack={handleShellBack}
          // 웹 연결은 챗 화면에서만 — 다른 페이지(APP 은 자체 탭 webview 보유)엔 숨김
          onToggleWeb={isOnChat ? () => setWebPanelOpen((o) => !o) : undefined}
          webPanelOpen={webPanelOpen}
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
        />
      </div>
    </DesktopShellContext.Provider>
  );
}
