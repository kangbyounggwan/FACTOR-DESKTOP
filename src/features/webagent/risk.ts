/**
 * risk — 웹 액션 위험도 판정 (승인 게이트).
 *
 * 사용자 결정(2026-07-22): **위험 액션만 확인**.
 *  - safe    : 즉시 실행 (일반 클릭·입력·선택·스크롤·읽기)
 *  - confirm : 사용자 모달 승인 후 실행 (제출·저장·삭제·결제·외부전송·cross-domain)
 *  - block   : 실행 거부 (계정 삭제/권한 변경 등 되돌릴 수 없는 파괴적 동작)
 *
 * 판정은 **요소의 의미(role/name/type) + 액션 종류 + 도메인**으로 한다.
 * 오탐(과승인)은 UX 저하일 뿐이지만, 미탐(위험 자동실행)은 사고다 → **애매하면 confirm**.
 *
 * Plan: planning-ai-web-agent/tier2-web-action-agent-plan.md §7
 */

import type { RefElement } from "./refSnapshot";

export type RiskLevel = "safe" | "confirm" | "block";

export interface RiskVerdict {
  level: RiskLevel;
  /** 사용자에게 보여줄 사유 */
  reason: string;
}

/** 사내 시스템 — 1차 대상 (사용자 결정: 사내 MES/EIS 전용) */
const INTERNAL_HOSTS = [
  "smartops.seohan.com",
  "ep.iseohan.com",
  "iseohan.com",
  "seohan.com",
];

/** 되돌릴 수 없는 파괴적 동작 — 무조건 차단 */
const BLOCK_PATTERNS: Array<[RegExp, string]> = [
  [/회원\s*탈퇴|탈퇴하기|계정\s*삭제|delete\s+account|close\s+account/i, "계정 삭제"],
  [/전체\s*삭제|일괄\s*삭제|delete\s+all|drop\s+table|초기화/i, "일괄 삭제/초기화"],
  [/권한\s*(변경|부여|회수)|change\s+permission|grant\s+role/i, "권한 변경"],
];

/** 사용자 확인이 필요한 동작 */
const CONFIRM_PATTERNS: Array<[RegExp, string]> = [
  [/저장|등록|제출|확인|승인|전송|발송|보내기|submit|save|apply|send|post|confirm|approve/i, "데이터 제출/저장"],
  [/삭제|제거|취소|반려|delete|remove|cancel|reject/i, "삭제/취소"],
  [/결제|구매|주문|송금|이체|pay|purchase|order|checkout|payment/i, "결제/금전"],
  [/다운로드|업로드|첨부|download|upload|export|import/i, "파일 입출력"],
  [/로그아웃|logout|sign\s*out/i, "로그아웃"],
  [/메일|email|sms|알림\s*발송/i, "외부 발송"],
];

/** 비밀번호/보안 입력은 자동 입력 금지 */
const SENSITIVE_INPUT = /password|passwd|pwd|비밀번호|카드번호|card.?number|cvc|cvv|주민|ssn|계좌/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isInternalHost(url: string): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return INTERNAL_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

export interface RiskInput {
  /** 액션 종류 */
  action: "click" | "type" | "select" | "key" | "scroll" | "read" | "navigate" | "snapshot" | "screenshot";
  /** 대상 요소 (click/type/select 일 때) */
  element?: Pick<RefElement, "role" | "name" | "tag" | "type"> | null;
  /** 입력 텍스트 (type) */
  text?: string;
  /** 현재 페이지 URL */
  currentUrl?: string;
  /** 이동 대상 URL (navigate) */
  targetUrl?: string;
}

/**
 * 액션 위험도 판정. 애매하면 confirm 쪽으로 기운다(fail-safe).
 */
export function assessRisk(input: RiskInput): RiskVerdict {
  const { action, element, text, currentUrl, targetUrl } = input;

  // 읽기 계열은 항상 안전
  if (action === "read" || action === "snapshot" || action === "screenshot" || action === "scroll") {
    return { level: "safe", reason: "읽기/이동 없는 동작" };
  }

  // 네비게이션 — 사내 도메인 밖으로 나가면 확인
  if (action === "navigate") {
    if (!targetUrl) return { level: "confirm", reason: "이동 대상 불명" };
    if (!isInternalHost(targetUrl)) {
      return { level: "confirm", reason: `사내 시스템 외부로 이동 (${hostOf(targetUrl) || targetUrl})` };
    }
    return { level: "safe", reason: "사내 시스템 내 이동" };
  }

  // 1차 대상은 사내 시스템 — 외부 사이트에서의 쓰기 액션은 확인
  if (currentUrl && !isInternalHost(currentUrl)) {
    return { level: "confirm", reason: `사내 시스템이 아닌 페이지에서의 조작 (${hostOf(currentUrl)})` };
  }

  const label = `${element?.name ?? ""} ${element?.type ?? ""} ${element?.tag ?? ""}`.trim();

  // 민감 입력 자동화 금지
  if (action === "type") {
    if (element?.type === "password" || SENSITIVE_INPUT.test(label)) {
      return { level: "block", reason: "비밀번호/민감정보 자동 입력 금지 — 사용자가 직접 입력" };
    }
    if (text && SENSITIVE_INPUT.test(text)) {
      return { level: "confirm", reason: "민감해 보이는 값 입력" };
    }
  }

  // 파괴적 동작 차단
  for (const [pat, why] of BLOCK_PATTERNS) {
    if (pat.test(label)) return { level: "block", reason: `${why} — 자동 실행 불가` };
  }

  // 확인 필요 동작
  if (action === "click" || action === "key") {
    // submit 성격의 요소
    if (element?.type === "submit" || (element?.tag === "button" && element?.type !== "button")) {
      // 이름으로 한 번 더 구분 — 조회/검색은 안전
      if (!/조회|검색|search|query|find|보기|view/i.test(label)) {
        return { level: "confirm", reason: "폼 제출(submit) 버튼" };
      }
    }
    for (const [pat, why] of CONFIRM_PATTERNS) {
      if (pat.test(label)) {
        // "조회/검색"이 함께 있으면 조회로 간주(오탐 완화)
        if (/조회|검색|search|query/i.test(label) && !/삭제|결제|전송|발송/i.test(label)) break;
        return { level: "confirm", reason: `${why} 가능성 ("${element?.name ?? ""}")` };
      }
    }
    if (action === "key" && /Enter/i.test(String(input.text ?? ""))) {
      // Enter 는 폼 제출을 유발할 수 있으나, 조회 화면에서 흔함 → safe 로 두되 상위에서 element 판정 우선
      return { level: "safe", reason: "키 입력" };
    }
  }

  return { level: "safe", reason: "일반 조작" };
}

/** 승인 모달에 띄울 사람이 읽는 요약 */
export function describeAction(input: RiskInput): string {
  const name = input.element?.name ? `"${input.element.name}"` : "요소";
  switch (input.action) {
    case "click": return `${name} 클릭`;
    case "type": return `${name} 에 "${(input.text ?? "").slice(0, 40)}" 입력`;
    case "select": return `${name} 에서 "${(input.text ?? "").slice(0, 40)}" 선택`;
    case "key": return `${input.text ?? "키"} 입력`;
    case "navigate": return `${input.targetUrl} 로 이동`;
    default: return input.action;
  }
}
