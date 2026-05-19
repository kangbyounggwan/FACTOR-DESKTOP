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
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { PageLoader } from "@/components/ui/page-loader";

// Auth (FE)
import { AuthProvider, ProtectedRoute } from "@/features/auth";

// FE 페이지
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import Index from "@/pages/Index"; // MES 대시보드 (DASHBOARD 탭)
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));

// 데스크탑 전용
import { DesktopShell } from "@desktop/components/DesktopShell";
import ChatPage from "@desktop/pages/chat/ChatPage";
const AppPage = lazy(() => import("@desktop/pages/app/AppPage"));

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
        <BrowserRouter>
          <Routes>
            {/* Auth (public) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

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
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <SettingsPage />
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
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
