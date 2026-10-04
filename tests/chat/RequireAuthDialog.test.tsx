/**
 * 데스크탑 RequireAuthDialog(래퍼) — 셸·채팅 팝업(채팅 401)·계정 위젯이 쓰는 로그인 모달 규칙 (jsdom, Radix Dialog 실물).
 * 웹 래퍼와 같은 규칙을 데스크탑 소유 사본(R1)에서 확인한다. design.md §3 S4·S13·§5.4.
 *
 *  - 닫힌 뒤 포커스: 호출부가 막지 않으면 모달을 연 요소로 복귀(트리거 없는 제어형 → Radix 기본은 <body>)
 *  - 제출 중 닫았다 다시 연 모달이 열려 있는 동안 세션이 생기면 닫고 지금 열림의 대기 동작 1회
 *  - 채팅 팝업 최소 창(320×360) 스크롤: 닫기 버튼 자리(우상단 52px)를 스크롤 영역에서 잘라 냄
 *  - 표면 no-drag 유지(타이틀바 위 클릭이 창 이동으로 처리되지 않게)
 * signIn·세션 상태는 대역 — 실제 계정·Supabase 호출 없음.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn<(email: string, password: string) => Promise<{ error: Error | null }>>(),
  isAuthenticated: false,
  navigate: vi.fn(),
}));

// react-router 는 데스크탑 node_modules 의 React 를 따로 불러온다(별도 사본) — 래퍼가 쓰는 useNavigate 만 대역
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ signIn: mocks.signIn, isAuthenticated: mocks.isAuthenticated }),
}));
// @/features/auth 배럴이 가입 단계 컴포넌트까지 불러온다 — 실제 클라이언트를 만들지 않게 대역
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
// SimpleBar 는 jsdom 미지원 — 같은 자리의 div 로 대체, 스크롤 노드 clip-path 는 data 속성으로 노출
vi.mock("simplebar-react", () => ({
  default: ({
    children,
    scrollableNodeProps,
  }: {
    children?: ReactNode;
    scrollableNodeProps?: { style?: { clipPath?: string } };
  }) => (
    <div data-testid="simplebar" data-scroll-clip={scrollableNodeProps?.style?.clipPath ?? ""}>
      {children}
    </div>
  ),
}));

import { LOGIN_FORM_TEXT } from "@/features/auth";
import { RequireAuthDialog } from "@desktop/components/RequireAuthDialog";

const TITLE = "로그인이 필요합니다";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function Host({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        모달 열기
      </button>
      <RequireAuthDialog open={open} onOpenChange={setOpen} onSuccess={onSuccess} title={TITLE} />
    </>
  );
}

function renderHost(onSuccess: () => void) {
  const tree = () => <Host onSuccess={onSuccess} />;
  const result = render(tree());
  return {
    ...result,
    /** onAuthStateChange(SIGNED_IN) 대역 */
    signInElsewhere: async () => {
      mocks.isAuthenticated = true;
      await act(async () => {
        result.rerender(tree());
      });
    },
  };
}

function openFromButton(): HTMLElement {
  const opener = screen.getByRole("button", { name: "모달 열기" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

/** Radix FocusScope 는 언마운트 다음 틱에 닫힘 포커스 이벤트를 보낸다 */
async function flushCloseAutoFocus() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  mocks.signIn.mockReset();
  mocks.isAuthenticated = false;
});

describe("RequireAuthDialog (데스크탑)", () => {
  it("Esc 로 취소하면 포커스가 <body> 가 아니라 모달을 연 요소로 돌아간다", async () => {
    renderHost(vi.fn());
    const opener = openFromButton();
    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await flushCloseAutoFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("제출 중 닫았다 다시 연 뒤 이전 요청으로 세션이 생기면 다시 연 모달을 닫고 대기 동작 1회", async () => {
    const pending = deferred<{ error: Error | null }>();
    mocks.signIn.mockReturnValue(pending.promise);
    const onSuccess = vi.fn();
    const { signInElsewhere } = renderHost(onSuccess);
    openFromButton();
    fireEvent.change(screen.getByLabelText(LOGIN_FORM_TEXT.emailLabel), { target: { value: "kim@example.com" } });
    fireEvent.change(screen.getByLabelText(LOGIN_FORM_TEXT.passwordLabel), { target: { value: "secret-pw" } });
    fireEvent.click(screen.getByRole("button", { name: LOGIN_FORM_TEXT.submit }));

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "모달 열기" }));
    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument();

    await act(async () => {
      pending.resolve({ error: null });
      await pending.promise;
    });
    expect(onSuccess).not.toHaveBeenCalled();

    await signInElsewhere();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("닫기 버튼 자리(우상단 52px)를 스크롤 영역에서 잘라 내고, 표면은 no-drag", () => {
    renderHost(vi.fn());
    openFromButton();
    const clip = screen.getByTestId("simplebar").getAttribute("data-scroll-clip") ?? "";
    expect(clip).toContain("calc(100% - 52px) 0");
    expect(clip).toContain("100% 52px");
    expect(screen.getByRole("dialog")).toHaveClass("[-webkit-app-region:no-drag]");
  });
});
