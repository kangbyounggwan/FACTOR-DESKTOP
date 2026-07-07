/**
 * factor-desktop App.tsx
 *
 * 데스크탑 EXE 전용 라우팅. 모든 페이지를 DesktopShell로 wrap.
 * - FE(anomaly-eye-monitor)의 페이지를 alias `@/...`로 import.
 * - 데스크탑 전용 페이지(Chat, App)는 `@desktop/...`로 import.
 *
 * Note: FE의 라우트(/equipment/:id, /digital-twin, /history, /carbon 등)는
 * 현재 데스크탑 셰에서 노출하지 않음 (Phase 0 범위 외). 필요 시 추가.
 */

import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { PageLoader } from "@/components/ui/page-loader";

// Auth (FE)
import { AuthProvider, ProtectedRoute } from "@/features/auth";

// 데스크탑 전용 페이지 — FE 페이지를 직접 쓰지 않고 데스크탑 셸에 맞게 자체 구현 (R1).
// FE의 리프 컴포넌트(MonitoringContent, AIChatPanelView, LoginFormContent 등)는
// 자유롭게 import 하되, **페이지 레이아웃은 데스크탑 책임**.
import { DesktopShell } from "@desktop/components/DesktopShell";
import { UpdateBanner } from "@desktop/components/UpdateBanner";
import ChatPage from "@desktop/pages/chat/ChatPage";
const ChatPopupPage = lazy(() => import("@desktop/pages/chat/ChatPopupPage"));
import LoginPage from "@desktop/pages/auth/LoginPage";
import SignupPage from "@desktop/pages/auth/SignupPage";
const AppPage = lazy(() => import("@desktop/pages/app/AppPage"));
const MonitoringPage = lazy(() => import("@desktop/pages/monitoring/MonitoringPage"));
const OntologyPage = lazy(() => import("@desktop/pages/ontology/OntologyPage"));
const ZoneDetailPage = lazy(() => import("@desktop/pages/monitoring/ZoneDetailPage"));
// SettingsPage: 데스크탑 자체 페이지 (R1, R6). FE 의 SettingsPage 는 import 안 함.
// FE 의 leaf 컴포넌트/hook 은 `@/features/settings` 에서 자유롭게 import.
const SettingsPage = lazy(() => import("@desktop/pages/settings/SettingsPage"));
// 리포트 앱 — 보고서 관리(설정에서 분리한 독립 페이지, Figma 기획 반영).
const ReportsPage = lazy(() => import("@desktop/pages/reports/ReportsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: { retry: 0 },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        {/* Section 02 — autoUpdater 가 새 버전 다운로드 완료 시 우하단 배너 */}
        <UpdateBanner />
        {/* HashRouter: Electron file:// 프로토콜에서 BrowserRouter는
            history.replaceState 시 URL이 file:///C:/chat 으로 변형되어
            Route 매칭이 깨짐 → 화면이 비어 보임. HashRouter는 #/chat
            형태라 경로가 변하지 않아 안전. */}
        <HashRouter>
          <Routes>
            {/* Auth (public) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* 별도 떠 있는 팝업 창 — DesktopShell 밖 (자체 titlebar). */}
            <Route
              path="/chat-popup"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ChatPopupPage />
                </Suspense>
              }
            />

            {/* 데스크탑 셀: 모든 페이지가 동일 outer (드래그 / 사이드바 / auth modal) 공유 */}
            <Route
              element={
                <DesktopShell>
                  <Outlet />
                </DesktopShell>
              }
            >
              {/* 진입점 — / → /chat */}
              <Route path="/" element={<Navigate to="/chat" replace />} />

              <Route path="/chat" element={<ChatPage />} />
              <Route
                path="/app"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AppPage />
                  </Suspense>
                }
              />
              <Route
                path="/monitoring"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <MonitoringPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              {/* S4 — 온톨로지 플러그인 (다운로드/설치/뷰어). 로그인 필요(user_id 스코프). */}
              <Route
                path="/ontology"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <OntologyPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              {/* 멀티존 라인에서 선택한 단일 존(라인) 상세 — startsWith("/monitoring")
                  덕분에 DesktopShell 의 LineMonitoringProvider 가 그대로 활성. */}
              <Route
                path="/monitoring/zone/:lineId/:zoneId"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ZoneDetailPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      {/* 데스크탑 자체 SettingsPage — DashboardHeader 없음, h-full w-full */}
                      <SettingsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              {/* 리포트 앱 — 보고서 관리(설정에서 분리). 로그인 필요(회사 스코프). */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ReportsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              {/* 호환성 — 이전 데스크탑 탭이 /dashboard로 가리켰음 → /monitoring로 redirect */}
              <Route
                path="/dashboard"
                element={<Navigate to="/monitoring" replace />}
              />
            </Route>

            {/* fallback */}
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
