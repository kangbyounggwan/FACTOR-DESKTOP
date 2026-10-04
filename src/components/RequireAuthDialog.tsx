/**
 * RequireAuthDialog — 게스트가 보호된 영역(메뉴·DASHBOARD 탭)에 들어가려 하거나 채팅이 401 일 때 띄우는 중앙 로그인 모달.
 *
 * 데스크탑 소유 래퍼(R1) — 모달 표면·대기 동작·바깥 클릭 규칙은 여기서, 폼은 공유 leaf
 * (`@/features/auth` 의 `AuthHeader` + `LoginFormContent`)를 조립한다(R6). 설계: output/login_modal/design.md §1·§3·§6.2.
 * 웹 `features/shell/RequireAuthDialog` 와 같은 구성이지만 앱별 소유 — 분기 prop 으로 합치지 않는다(R5).
 * 데스크탑 차이: 표면에 `-webkit-app-region: no-drag` — 채팅 팝업 창 최소 크기(320×360)에서 모달 상단이
 * 타이틀바(드래그 영역)와 겹쳐도 클릭이 창 이동으로 처리되지 않게 한다(CSS 속성이라 R4 무관).
 * 사용처: DesktopShell(셸 차단·채팅 401) · DesktopAuthWidget · ChatPopupPage(팝업 창 채팅 401).
 *
 * - 표면: 400px(640 미만은 뷰포트 − 32) · 모서리 16 · `--card` · shadow-2xl · 패딩 32(640 미만 24).
 *   내용이 뷰포트보다 길면 max-h 안에서 SimpleBar 스크롤 — 닫기 버튼 자리(우상단 52×52)는 스크롤 영역에서 잘라 내
 *   스크롤된 입력칸이 닫기 버튼 아래로 지나가며 클릭을 빼앗기지 않게 한다. 오버레이·닫기 버튼은 공용 dialog.tsx(Q5).
 * - 모션(§5.4): 열림 180ms 페이드 + 0.98→1 + 위로 4px, 닫힘 120ms 페이드. 동작 줄이기 설정이면 페이드만.
 * - 헤더: 보이는 제목·설명이 곧 DialogTitle/DialogDescription(sr-only 사본 없음).
 * - 성공(S13): 성공 표시 없이 즉시 닫고 `onSuccess`(대기 동작 — 이동 / 채팅 401 재전송) 실행.
 *   열려 있는 동안 세션이 새로 생겨도(닫았다 다시 연 사이 이전 요청 성공 · 다른 창 로그인) 같은 성공으로 처리한다.
 * - 제출 중 닫기(S4): 닫기·Esc 는 막지 않는다. 닫힌 뒤(퇴장 애니메이션 중 포함) 도착한 성공은 대기 동작을 실행하지 않는다.
 * - 닫힌 뒤 포커스: 호출부 `onCloseAutoFocus` 가 처리하지 않으면 모달을 연 요소로 돌려놓는다(트리거 없는 제어형이라
 *   Radix 기본은 <body>). 연 요소가 사라졌으면(계정 위젯 → 프로필 버튼) 호출부가 새 대상으로 옮긴다.
 * - 바깥 클릭(S14): 입력값이 있으면 닫지 않는다(Esc·닫기 버튼은 항상 닫힘).
 * - 회원가입(S12): 모달을 닫고 /signup 으로 이동(경로는 LoginOptions). 대기 동작은 실행하지 않는다.
 *
 * 사용:
 *   const [open, setOpen] = useState(false);
 *   const pending = useRef<() => void>(() => {});
 *
 *   const requireAuth = (action: () => void) => {
 *     if (isAuthenticated) action();
 *     else { pending.current = action; setOpen(true); }
 *   };
 *
 *   <RequireAuthDialog open={open} onOpenChange={setOpen} onSuccess={() => pending.current()} />
 */

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AUTH_GATE_DESCRIPTION,
  AUTH_REQUIRED_TITLE,
  AuthHeader,
  LoginFormContent,
  useAuth,
  useLoginOptions,
} from "@/features/auth";

/**
 * 모달 모션(design.md §5.4) — 공용 DialogContent 기본값(200ms · zoom 95% · slide 48%)을 이 모달만 덮어쓴다.
 * 열림 180ms 페이드 + 0.98→1 + 위로 4px(cubic-bezier(.2,.8,.2,1)), 닫힘 120ms 페이드만, `prefers-reduced-motion` 이면 열림도 페이드만.
 * arbitrary property 로 쓰는 이유: tailwindcss-animate 유틸(zoom-in-*)끼리는 CSS 순서가 보장되지 않아 덮어쓰기가
 * 불확실하고, duration·ease 의 임의값 유틸은 core 와 플러그인이 같은 이름이라 모호해져 생성되지 않는다.
 */
const LOGIN_DIALOG_MOTION =
  "data-[state=open]:[animation-duration:180ms] data-[state=open]:[animation-timing-function:cubic-bezier(.2,.8,.2,1)] " +
  "data-[state=open]:[--tw-enter-scale:0.98] data-[state=open]:[--tw-enter-translate-y:calc(-50%_+_4px)] " +
  "data-[state=closed]:[animation-duration:120ms] data-[state=closed]:[--tw-exit-scale:1] data-[state=closed]:[--tw-exit-translate-y:-50%] " +
  "motion-reduce:data-[state=open]:[--tw-enter-scale:1] motion-reduce:data-[state=open]:[--tw-enter-translate-y:-50%]";

/** 공용 닫기 버튼 자리 = 우상단 여백 12 + 버튼 40 */
const CLOSE_BUTTON_CLEARANCE_PX = 52;
/**
 * 스크롤 영역(SimpleBar 스크롤 노드)에서 닫기 버튼 자리를 잘라 낸다. 잘린 모서리에 들어온 내용은 그려지지도 클릭되지도
 * 않아, 투명한 닫기 버튼이 스크롤된 입력칸을 덮고 클릭을 가로채지 않는다. 스크롤하지 않은 기본 상태엔 그 자리에 내용이 없다.
 */
const SCROLL_VIEWPORT_STYLE: CSSProperties = {
  clipPath: `polygon(0 0, calc(100% - ${CLOSE_BUTTON_CLEARANCE_PX}px) 0, calc(100% - ${CLOSE_BUTTON_CLEARANCE_PX}px) ${CLOSE_BUTTON_CLEARANCE_PX}px, 100% ${CLOSE_BUTTON_CLEARANCE_PX}px, 100% 100%, 0 100%)`,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 로그인 성공 후 실행할 콜백 (보통 navigate) */
  onSuccess?: () => void;
  /** 모달 제목 (12자 이내 권장) */
  title?: string;
  /** 모달 설명 1줄 (24자 이내 권장) */
  description?: string;
  /**
   * 모달이 닫힌 뒤의 포커스 처리(Radix DialogContent onCloseAutoFocus). 셸이 채팅 401 로그인 뒤 입력창으로
   * 포커스를 옮길 때 넘긴다(useChatInputFocusAfterLogin). 미지정이거나 기본 처리를 막지 않으면 모달을 연 요소로 돌아간다.
   */
  onCloseAutoFocus?: (event: Event) => void;
  /** 이메일 칸 초기값 — 세션 만료 재로그인 때 마지막 이메일(S1 변형, 비밀번호 칸에서 시작) */
  defaultEmail?: string;
}

export function RequireAuthDialog({
  open,
  onOpenChange,
  onSuccess,
  title = AUTH_REQUIRED_TITLE,
  description = AUTH_GATE_DESCRIPTION.fallback,
  onCloseAutoFocus,
  defaultEmail,
}: Props) {
  const navigate = useNavigate();
  const { signup } = useLoginOptions();
  const { isAuthenticated } = useAuth();

  // S4 — open 최신값과 "몇 번째 열림인지"를 ref 로 든다. leaf 의 onSuccess 는 제출한 순간의 콜백이라,
  // 그사이 닫혔거나(퇴장 애니메이션 중에도 내용은 마운트돼 있다) 닫혔다 다시 열렸으면 대기 동작을 실행하지 않는다.
  // 처음부터 열린 채 마운트돼도 "열림 1회"로 센다(false 에서 시작)
  const openRef = useRef(false);
  const openCountRef = useRef(0);
  // S14 — leaf 가 알려 주는 입력값 유무. 새로 열릴 때마다 비운다(내용은 닫히면 언마운트되어 새로 시작).
  const dirtyRef = useRef(false);
  // 모달을 연 요소 — DialogTrigger 없이 open 을 제어하므로 Radix 는 닫힌 뒤 돌아갈 곳을 모른다(<body> 로 떨어짐)
  const returnFocusRef = useRef<HTMLElement | null>(null);
  if (open && !openRef.current) {
    openCountRef.current += 1;
    dirtyRef.current = false;
    // 렌더 단계라 포커스는 아직 연 요소(메뉴·계정 위젯·안내 카드 버튼)에 있다
    const active = typeof document === "undefined" ? null : document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }
  openRef.current = open;
  const openCount = openCountRef.current;

  // 성공 처리는 열림마다 한 번 — 경로가 둘(leaf onSuccess · 열려 있는 동안 세션 생성)이라 이미 처리한 열림 번호를 든다.
  const handledOpenRef = useRef(0);
  const callbacksRef = useRef({ onOpenChange, onSuccess });
  callbacksRef.current = { onOpenChange, onSuccess };
  const completeLogin = useCallback(() => {
    if (handledOpenRef.current === openCountRef.current) return;
    handledOpenRef.current = openCountRef.current;
    callbacksRef.current.onOpenChange(false);
    callbacksRef.current.onSuccess?.();
  }, []);

  const handleSuccess = () => {
    if (!openRef.current || openCountRef.current !== openCount) return;
    completeLogin();
  };

  // 열려 있는 동안 세션이 새로 생기면(제출 중 닫았다 다시 연 사이 이전 요청 성공 · 다른 창 로그인) 이미 로그인된 사용자에게
  // 폼을 계속 보이지 않는다 — 닫고 이번 열림의 대기 동작 실행.
  const wasAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    const signedIn = isAuthenticated && !wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;
    if (signedIn && openRef.current) completeLogin();
  }, [isAuthenticated, completeLogin]);

  const handleCloseAutoFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return; // 호출부가 대상을 정함(채팅 401 → 입력창)
    // Radix 기본(트리거로 복귀)은 트리거가 없어 <body> 로 떨어진다 → 연 요소로 돌려놓는다(WCAG 2.4.3)
    event.preventDefault();
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus();
  };

  const handleSignup =
    signup.kind === "link"
      ? () => {
          onOpenChange(false);
          navigate(signup.to);
        }
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[400px] flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 shadow-2xl sm:rounded-2xl [-webkit-app-region:no-drag]",
          LOGIN_DIALOG_MOTION,
        )}
        onCloseAutoFocus={handleCloseAutoFocus}
        onInteractOutside={(event) => {
          if (dirtyRef.current) event.preventDefault();
        }}
      >
        {/* 테두리 2px 를 뺀 높이까지 스크롤(프로젝트 규칙: 새 스크롤 영역은 SimpleBar). 닫기 버튼 자리는 잘라 냄. */}
        <SimpleBar
          style={{ maxHeight: "calc(100dvh - 34px)" }}
          scrollableNodeProps={{ style: SCROLL_VIEWPORT_STYLE }}
        >
          <div className="p-6 sm:p-8">
            <AuthHeader
              title={title}
              description={description}
              titleAs={DialogTitle}
              descriptionAs={DialogDescription}
            />
            <LoginFormContent
              className="mt-6"
              defaultEmail={defaultEmail}
              onSuccess={handleSuccess}
              onSignup={handleSignup}
              onDirtyChange={(dirty) => {
                dirtyRef.current = dirty;
              }}
            />
          </div>
        </SimpleBar>
      </DialogContent>
    </Dialog>
  );
}
