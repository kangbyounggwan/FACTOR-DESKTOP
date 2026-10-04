/**
 * DesktopShell — 채팅 401 "로그인" 버튼 → 로그인 모달 연결 (jsdom, vitest.chat.config.ts).
 *
 *  - useAIChat 에 onOpenReportPanel 과 함께 onAuthRequired 를 넘긴다
 *  - 모달은 채팅 문구로 열리고, isAuthenticated 가 true 여도(토큰 만료·거부) 바로 실행하지 않고 **항상** 연다
 *    (이때는 세션 만료 문구 + 마지막 이메일)
 *  - 로그인 성공 → retry(같은 질문 재전송) 1회
 *  - 모달 onCloseAutoFocus: 채팅 401 로그인 성공 뒤에만 Radix 기본 처리를 막고 채팅 입력창으로 포커스
 * 무거운 자식(상단바·사이드바·위젯·모달 본문)과 라우터는 스텁 — 셸의 배선만 본다.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseAIChatOptions, UseAIChatReturn } from "@/features/monitoring/hooks/useAIChat";
import {
  CHAT_AUTH_REQUIRED_DESCRIPTION,
  CHAT_AUTH_REQUIRED_TITLE,
  CHAT_SESSION_EXPIRED_DESCRIPTION,
  CHAT_SESSION_EXPIRED_TITLE,
} from "@/features/monitoring/constants/aiChatConstants";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, user: null as { email?: string } | null },
  chatOptions: undefined as UseAIChatOptions | undefined,
  dialogCloseAutoFocus: undefined as ((event: Event) => void) | undefined,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/chat", state: null }),
}));
// 셸은 진입 문구 상수도 @/features/auth 에서 가져온다 — 실제 문구 모듈(authCopy)을 그대로 쓰고 useAuth 만 대역
vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<typeof import("@/features/auth/login/authCopy")>("@/features/auth/login/authCopy")),
  useAuth: () => mocks.auth,
}));
vi.mock("@/features/monitoring/hooks/useAIChat", () => {
  const chat: Partial<UseAIChatReturn> = {
    conversationId: null,
    loadConversation: vi.fn(async () => {}),
    startNewConversation: vi.fn(),
  };
  return {
    useAIChat: (options?: UseAIChatOptions) => {
      mocks.chatOptions = options;
      return chat;
    },
  };
});
vi.mock("@/features/monitoring/components/LineMonitoringSidebar", () => ({
  LineMonitoringSidebarBare: () => null,
}));
vi.mock("@/features/monitoring/context/LineMonitoringContext", () => ({
  LineMonitoringProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@desktop/features/sidebar", () => ({
  ConversationSidebar: () => null,
  SIDEBAR_DEFAULT_WIDTH: 320,
}));
vi.mock("@desktop/features/app", () => ({ AppSidebar: () => null }));
vi.mock("@desktop/components/DesktopAuthWidget", () => ({ DesktopAuthWidget: () => null }));
vi.mock("@desktop/components/DesktopTopBar", () => ({ DesktopTopBar: () => null }));
vi.mock("@desktop/components/RequireAuthDialog", () => ({
  RequireAuthDialog: (props: {
    open: boolean;
    onSuccess?: () => void;
    title?: string;
    description?: string;
    defaultEmail?: string;
    onCloseAutoFocus?: (event: Event) => void;
  }) => {
    mocks.dialogCloseAutoFocus = props.onCloseAutoFocus;
    return props.open ? (
      <div role="dialog" data-default-email={props.defaultEmail ?? ""}>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
        <button type="button" onClick={props.onSuccess}>
          로그인 성공
        </button>
      </div>
    ) : null;
  },
}));

import { DesktopShell } from "@desktop/components/DesktopShell";

beforeEach(() => {
  mocks.chatOptions = undefined;
  mocks.dialogCloseAutoFocus = undefined;
  mocks.auth.isAuthenticated = true;
  mocks.auth.user = null;
});

function closeEvent() {
  return new Event("focusScope.autoFocusOnUnmount", { cancelable: true });
}

describe("DesktopShell — 채팅 401 로그인 모달", () => {
  it.each([
    // 로그인 상태였는데 401 = 세션 만료·거부 → 세션 만료 문구 + 마지막 이메일
    [true, CHAT_SESSION_EXPIRED_TITLE, CHAT_SESSION_EXPIRED_DESCRIPTION, "kim@example.com"],
    // 게스트 → 로그인 필요 문구, 이메일 비움
    [false, CHAT_AUTH_REQUIRED_TITLE, CHAT_AUTH_REQUIRED_DESCRIPTION, ""],
  ])(
    "isAuthenticated=%s 여도 채팅 문구로 모달을 열고, 로그인 성공 시에만 retry",
    (isAuthenticated, title, description, defaultEmail) => {
      mocks.auth.isAuthenticated = isAuthenticated;
      mocks.auth.user = isAuthenticated ? { email: "kim@example.com" } : null;
      render(
        <DesktopShell>
          <div />
        </DesktopShell>,
      );
      // 보고서 패널 옵션은 그대로 유지
      expect(mocks.chatOptions?.onOpenReportPanel).toBeTypeOf("function");
      expect(mocks.chatOptions?.onAuthRequired).toBeTypeOf("function");
      expect(screen.queryByRole("dialog")).toBeNull();

      const retry = vi.fn();
      act(() => mocks.chatOptions?.onAuthRequired?.(retry));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent(title);
      expect(dialog).toHaveTextContent(description);
      expect(dialog).toHaveAttribute("data-default-email", defaultEmail);
      expect(retry).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
      expect(retry).toHaveBeenCalledTimes(1);
    },
  );

  it("로그인 성공 뒤 모달이 닫히면 채팅 입력창으로 포커스, 로그인 없이 닫히면 기본 처리", () => {
    render(
      <DesktopShell>
        <textarea data-chat-input="" aria-label="채팅 입력" />
      </DesktopShell>,
    );
    const input = screen.getByLabelText("채팅 입력");
    expect(mocks.dialogCloseAutoFocus).toBeTypeOf("function");

    act(() => mocks.chatOptions?.onAuthRequired?.(vi.fn()));
    const cancelled = closeEvent();
    mocks.dialogCloseAutoFocus?.(cancelled);
    expect(cancelled.defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(input);

    act(() => mocks.chatOptions?.onAuthRequired?.(vi.fn()));
    fireEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
    const closed = closeEvent();
    mocks.dialogCloseAutoFocus?.(closed);
    expect(closed.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});
