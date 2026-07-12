/**
 * DesktopShellContext — DesktopShell이 제공하는 공유 상태/액션.
 *
 * 자식 페이지(ChatPage, AppPage 등)에서 `useDesktopShell()`로 접근.
 * - chat: 단일 useAIChat 인스턴스 (페이지 전환에도 유지)
 * - sidebarWidth / sidebarCollapsed: 사이드바 레이아웃 상태 (페이지 전환에도 유지)
 * - requireAuth: 보호된 액션을 게스트 차단 모달로 게이팅
 */

import { createContext, useContext } from "react";
import type { UseAIChatReturn } from "@/features/monitoring/hooks/useAIChat";

interface RequireAuthOptions {
  /** 모달 제목 */
  title?: string;
  /** 모달 설명 */
  description?: string;
}

export interface DesktopShellContextValue {
  chat: UseAIChatReturn;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  /** 보호된 액션 — 로그인이 안 됐으면 모달 표시 + 로그인 후 액션 실행 */
  requireAuth: (action: () => void, options?: RequireAuthOptions) => void;
  /**
   * 페이지가 자체 back 로직을 등록 — 상단 ← 버튼 클릭 시 우선 호출.
   * handler 가 true 반환하면 처리됨 (router history navigate(-1) 안 함), false 면 일반 router back.
   * useEffect 로 mount 시 등록 + unmount 시 null 로 해제.
   */
  setBackHandler: (handler: (() => boolean) | null) => void;
}

export const DesktopShellContext = createContext<DesktopShellContextValue | null>(null);

export function useDesktopShell(): DesktopShellContextValue {
  const ctx = useContext(DesktopShellContext);
  if (!ctx) {
    throw new Error("useDesktopShell must be used within DesktopShell");
  }
  return ctx;
}
