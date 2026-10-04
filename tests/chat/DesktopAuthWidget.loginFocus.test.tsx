/**
 * DesktopAuthWidget — 위젯 모달로 로그인한 뒤 포커스가 <body> 로 떨어지지 않고 새 프로필 버튼으로 간다 (jsdom, design.md S13 "위젯").
 *
 * 게스트 트리거(모달을 연 요소)는 로그인과 함께 프로필 버튼으로 바뀌어 사라진다 → 래퍼(RequireAuthDialog)는 돌아갈 곳이
 * 없으므로 위젯이 새 버튼으로 옮긴다. 로그인 없이 닫으면 래퍼가 게스트 트리거로 돌려놓는다.
 * signIn·세션 상태는 대역 — 실제 계정·Supabase 호출 없음.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as { id: string; email: string } | null,
    profile: null,
    isAuthenticated: false,
    isLoading: false,
    signIn: undefined as unknown as (email: string, password: string) => Promise<{ error: Error | null }>,
    signOut: async () => {},
  },
}));

// react-router 는 데스크탑 node_modules 의 React 를 따로 불러온다(별도 사본) — 위젯·래퍼가 쓰는 useNavigate 만 대역
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));
// @/features/auth 배럴이 가입 단계 컴포넌트까지 불러온다 — 실제 클라이언트를 만들지 않게 대역
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
// SimpleBar 는 jsdom 에서 ResizeObserver·pseudo getComputedStyle 미구현 — 같은 자리의 div 로 대체
vi.mock("simplebar-react", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="simplebar">{children}</div>,
}));

import { LOGIN_FORM_TEXT } from "@/features/auth";
import { DesktopAuthWidget } from "@desktop/components/DesktopAuthWidget";

/** Radix FocusScope 는 언마운트 다음 틱에 닫힘 포커스 이벤트를 보낸다 */
async function flushCloseAutoFocus() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function openLoginFromWidget(): HTMLElement {
  const guestTrigger = screen.getByRole("button", { name: /로그인/ });
  guestTrigger.focus();
  fireEvent.click(guestTrigger);
  return guestTrigger;
}

beforeEach(() => {
  mocks.auth.user = null;
  mocks.auth.isAuthenticated = false;
  mocks.auth.signIn = vi.fn(async () => {
    // onAuthStateChange(SIGNED_IN) 대역 — 응답과 함께 세션이 생긴다
    mocks.auth.user = { id: "u1", email: "kim@example.com" };
    mocks.auth.isAuthenticated = true;
    return { error: null };
  });
});

describe("DesktopAuthWidget — 로그인 뒤 포커스", () => {
  it("위젯 모달로 로그인하면 포커스가 새 프로필 버튼으로 간다", async () => {
    render(<DesktopAuthWidget inline />);
    openLoginFromWidget();
    fireEvent.change(screen.getByLabelText(LOGIN_FORM_TEXT.emailLabel), { target: { value: "kim@example.com" } });
    fireEvent.change(screen.getByLabelText(LOGIN_FORM_TEXT.passwordLabel), { target: { value: "secret-pw" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LOGIN_FORM_TEXT.submit }));
    });
    await flushCloseAutoFocus();

    expect(screen.queryByRole("dialog")).toBeNull();
    const profileTrigger = screen.getByRole("button", { name: /kim@example\.com/ });
    expect(document.activeElement).toBe(profileTrigger);
  });

  it("로그인 없이 닫으면 게스트 트리거로 돌아간다", async () => {
    render(<DesktopAuthWidget inline />);
    const guestTrigger = openLoginFromWidget();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await flushCloseAutoFocus();
    expect(document.activeElement).toBe(guestTrigger);
  });
});
