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
import { useAuth } from "@/features/auth";
import { useAIChat } from "@/features/monitoring/hooks/useAIChat";
import {
  ConversationSidebar,
  SIDEBAR_DEFAULT_WIDTH,
} from "@desktop/features/sidebar";
import { LineMonitoringSidebar } from "@/features/monitoring/components/LineMonitoringSidebar";
import { LineMonitoringProvider } from "@/features/monitoring/context/LineMonitoringContext";
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

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

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

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
      } else {
        pendingActionRef.current = action;
        setAuthDialogOpen(true);
      }
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
    }),
    [chat, sidebarCollapsed, sidebarWidth, requireAuth],
  );

  return (
    <DesktopShellContext.Provider value={contextValue}>
      <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
        <DesktopTopBar
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onNewChat={handleStartNew}
        />

        <div className="flex-1 flex min-h-0 gap-2 px-2 pb-2">
          {!sidebarCollapsed && (
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
              customRecents={
                isOnMonitoring ? (
                  // /monitoring(DASHBOARD)에서는 Recents 영역에 라인 목록 패널 표시.
                  // 자체 Provider로 감싸 데이터 fetch (Zustand 선택 상태는 본문 패널과 공유됨).
                  <LineMonitoringProvider>
                    <LineMonitoringSidebar embedded />
                  </LineMonitoringProvider>
                ) : isOnApp ? (
                  // /app(APP)에서는 어플리케이션 런처 — 등록된 URL을 favicon + name 행으로.
                  // 선택 상태는 useSelectedAppUrl(Zustand)로 본문 webview와 공유.
                  <AppSidebar />
                ) : undefined
              }
              recentsLabel={
                isOnMonitoring ? "Zone" : isOnApp ? "Apps" : undefined
              }
            />
          )}

          <main className="flex-1 flex min-w-0 overflow-hidden">{children}</main>
        </div>

        <RequireAuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          onSuccess={handleAuthSuccess}
          title="DASHBOARD 접근에는 로그인이 필요합니다"
          description="이메일로 로그인하면 대시보드 위젯과 대화 이력을 사용할 수 있습니다."
        />
      </div>
    </DesktopShellContext.Provider>
  );
}
