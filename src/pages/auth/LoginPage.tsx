/**
 * factor-desktop LoginPage — 데스크탑 자체 로그인 화면.
 *
 * FE 의 `anomaly-eye-monitor/src/pages/auth/LoginPage.tsx` 와 분리된 별도 구현 (R1).
 * 모달(RequireAuthDialog)과 같은 카드 — 400 · 패딩 32(640 미만 24) · 모서리 16 · `--card` · shadow-2xl — 에
 * 공유 leaf `AuthHeader`(h1) + `LoginFormContent`(`@/features/auth`) 를 넣는다(design.md §1.4).
 * 상단 36px 는 Electron frameless 창 이동용 드래그 영역.
 * 로그인 성공 시 location.state.from 으로 복귀 (또는 /chat). 이미 로그인돼 있으면 바로 이동.
 *
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R6).
 */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AuthHeader,
  LOGIN_PAGE_DESCRIPTION,
  LOGIN_PAGE_TITLE,
  LoginFormContent,
  useAuth,
  useLoginOptions,
} from "@/features/auth";

interface FromState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { signup } = useLoginOptions();

  // ProtectedRoute 가 /login 으로 보낼 때 state.from 으로 원래 경로를 실어줌
  const from =
    ((location.state as FromState | null)?.from?.pathname as string | undefined) ?? "/chat";

  // 이미 로그인되어 있으면 리다이렉트 (웹 LoginPage 와 같은 동작)
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* 드래그 가능한 상단 — Electron frameless 윈도우에서 윈도우 이동용 */}
      <div
        className="absolute top-0 left-0 right-0 h-9"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <main className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <AuthHeader title={LOGIN_PAGE_TITLE} description={LOGIN_PAGE_DESCRIPTION} />
        <LoginFormContent
          className="mt-6"
          onSuccess={() => navigate(from, { replace: true })}
          onSignup={signup.kind === "link" ? () => navigate(signup.to) : undefined}
        />
      </main>
    </div>
  );
}
