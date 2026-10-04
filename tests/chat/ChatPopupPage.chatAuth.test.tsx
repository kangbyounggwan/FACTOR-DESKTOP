/**
 * ChatPopupPage — 채팅 401 "로그인" 버튼 → 팝업 창 안의 로그인 모달 (jsdom, vitest.chat.config.ts).
 *
 * 팝업은 DesktopShell 밖이라 셸 모달이 없다 → 자체 RequireAuthDialog 를 연다.
 *  - useAIChat 에 onAuthRequired 를 넘긴다(넘기지 않으면 카드에 버튼 없이 안내 문장만 남는다)
 *  - 모달은 채팅 문구로 열리고, 로그인 성공 시에만 retry(같은 질문 재전송) 1회
 *    (로그인 상태였으면 세션 만료 문구 + 마지막 이메일)
 *  - 로그인 성공 뒤 모달이 닫히면 채팅 입력창(ChatInput, data-chat-input)으로 포커스
 *  - 팝업 창의 로그인 모달은 가입 페이지 이동 대신 발급 안내(LoginOptions signup=notice — 데이터로 표현, R5)
 * 메시지 목록·Electron 브리지·모달 본문은 스텁.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseAIChatOptions, UseAIChatReturn } from "@/features/monitoring/hooks/useAIChat";
import {
  CHAT_AUTH_REQUIRED_DESCRIPTION,
  CHAT_AUTH_REQUIRED_TITLE,
  CHAT_SESSION_EXPIRED_DESCRIPTION,
  CHAT_SESSION_EXPIRED_TITLE,
} from "@/features/monitoring/constants/aiChatConstants";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, user: null as { email?: string } | null },
  chatOptions: undefined as UseAIChatOptions | undefined,
  dialogCloseAutoFocus: undefined as ((event: Event) => void) | undefined,
}));

vi.mock("@/features/monitoring/hooks/useAIChat", () => {
  const chat: Partial<UseAIChatReturn> = {
    messages: [],
    input: "",
    isLoading: false,
    setInput: vi.fn(),
    sendMessage: vi.fn(async () => {}),
  };
  return {
    useAIChat: (options?: UseAIChatOptions) => {
      mocks.chatOptions = options;
      return chat;
    },
  };
});
vi.mock("@/features/monitoring/components/ai-chat/ChatMessageList", () => ({
  ChatMessageList: () => null,
}));
vi.mock("@desktop/lib/electron", () => ({
  electron: {
    chatPopup: {
      setOpacity: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      captureSnapshot: vi.fn(async () => null),
    },
  },
}));
// 팝업은 useAuth(세션 만료 판정)와 LoginOptionsProvider 만 쓴다 — Provider 는 실제 모듈, useAuth 만 대역
vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<typeof import("@/features/auth/login/LoginOptionsProvider")>(
    "@/features/auth/login/LoginOptionsProvider",
  )),
  useAuth: () => mocks.auth,
}));
vi.mock("@desktop/components/RequireAuthDialog", async () => {
  const { useLoginOptions } = await vi.importActual<typeof import("@/features/auth/login/loginOptions")>(
    "@/features/auth/login/loginOptions",
  );
  return {
    RequireAuthDialog: function RequireAuthDialogStub(props: {
      open: boolean;
      onSuccess?: () => void;
      title?: string;
      description?: string;
      defaultEmail?: string;
      onCloseAutoFocus?: (event: Event) => void;
    }) {
      const { signup } = useLoginOptions();
      mocks.dialogCloseAutoFocus = props.onCloseAutoFocus;
      return props.open ? (
        <div role="dialog" data-default-email={props.defaultEmail ?? ""} data-signup-kind={signup.kind}>
          <h2>{props.title}</h2>
          <p>{props.description}</p>
          <button type="button" onClick={props.onSuccess}>
            로그인 성공
          </button>
        </div>
      ) : null;
    },
  };
});
import ChatPopupPage from "@desktop/pages/chat/ChatPopupPage";

beforeEach(() => {
  mocks.chatOptions = undefined;
  mocks.dialogCloseAutoFocus = undefined;
  mocks.auth.isAuthenticated = false;
  mocks.auth.user = null;
});

describe("ChatPopupPage — 채팅 401 로그인 모달", () => {
  it("로그인 버튼 → 이 창의 로그인 모달(채팅 문구), 성공 시에만 retry + 입력창 포커스", () => {
    render(<ChatPopupPage />);
    expect(mocks.chatOptions?.onAuthRequired).toBeTypeOf("function");
    expect(screen.queryByRole("dialog")).toBeNull();

    const retry = vi.fn();
    act(() => mocks.chatOptions?.onAuthRequired?.(retry));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(CHAT_AUTH_REQUIRED_TITLE);
    expect(dialog).toHaveTextContent(CHAT_AUTH_REQUIRED_DESCRIPTION);
    expect(dialog).toHaveAttribute("data-default-email", "");
    // 작은 팝업 창 — 가입 페이지로 이동하지 않고 발급 안내만
    expect(dialog).toHaveAttribute("data-signup-kind", "notice");
    expect(retry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
    expect(retry).toHaveBeenCalledTimes(1);

    const closed = new Event("focusScope.autoFocusOnUnmount", { cancelable: true });
    mocks.dialogCloseAutoFocus?.(closed);
    expect(closed.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/질문을 입력하세요/));
  });

  it("로그인 상태에서 401(토큰 만료·거부) → 세션 만료 문구 + 마지막 이메일", () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: "kim@example.com" };
    render(<ChatPopupPage />);

    const retry = vi.fn();
    act(() => mocks.chatOptions?.onAuthRequired?.(retry));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(CHAT_SESSION_EXPIRED_TITLE);
    expect(dialog).toHaveTextContent(CHAT_SESSION_EXPIRED_DESCRIPTION);
    expect(dialog).toHaveAttribute("data-default-email", "kim@example.com");

    fireEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
