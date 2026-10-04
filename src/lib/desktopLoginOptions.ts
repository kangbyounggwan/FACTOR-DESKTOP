/**
 * 데스크탑 앱의 로그인 수단 데이터 — App.tsx 의 `LoginOptionsProvider` 로 주입한다(웹 값은 `@/lib/webLoginOptions`).
 * 현재 값: 비밀번호 재설정 = 관리자 요청 안내, 가입 = 데스크탑 /signup(초대 발급 안내 페이지).
 * 소셜·SSO 는 콜백 수신부(`electron/` + preload + exchangeCodeForSession)가 생기기 전까지 넣지 않는다(design.md §6.4).
 */

import type { LoginOptions } from "@/features/auth";

export const DESKTOP_LOGIN_OPTIONS: LoginOptions = {
  passwordReset: "contact_admin",
  signup: { kind: "link", to: "/signup" },
};

/**
 * 채팅 팝업 창 — 작은 독립 창이라 가입 페이지로 이동하지 않고 발급 안내 1줄만 둔다
 * (팝업에서 /signup 으로 가면 채팅으로 돌아올 경로가 없다). 차이는 분기 prop 이 아니라 이 데이터로만(R5).
 */
export const DESKTOP_POPUP_LOGIN_OPTIONS: LoginOptions = {
  ...DESKTOP_LOGIN_OPTIONS,
  signup: { kind: "notice" },
};
