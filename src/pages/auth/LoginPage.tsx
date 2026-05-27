/**
 * factor-desktop LoginPage — 데스크탑 자체 로그인 화면.
 *
 * FE 의 `anomaly-eye-monitor/src/pages/auth/LoginPage.tsx` 와 분리된 별도 구현 (R1).
 * 데스크탑은 hero/스플릿 레이아웃 대신 중앙 카드 형태 — 작은 윈도우에 최적화.
 *
 * 폼 본체는 `@desktop/components/LoginFormContent` 사용 (이미 모달/팝오버 와 공유).
 * 로그인 성공 시 location.state.from 으로 복귀 (또는 /chat).
 *
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R6).
 */

import { useLocation, useNavigate } from "react-router-dom";
import { LoginFormContent } from "@desktop/components/LoginFormContent";

interface FromState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // ProtectedRoute 가 /login 으로 보낼 때 state.from 으로 원래 경로를 실어줌
  const from =
    ((location.state as FromState | null)?.from?.pathname as string | undefined) ?? "/chat";

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center p-6 overflow-hidden">
      {/* 드래그 가능한 상단 — Electron frameless 윈도우에서 윈도우 이동용 */}
      <div
        className="absolute top-0 left-0 right-0 h-9"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="w-full max-w-[400px] bg-card border border-border rounded-xl p-6 shadow-xl">
        <LoginFormContent
          title="로그인"
          description="FACTOR 데스크탑에 로그인하세요."
          onSuccess={() => navigate(from, { replace: true })}
          onSignup={() => navigate("/signup")}
        />
      </div>
    </div>
  );
}
