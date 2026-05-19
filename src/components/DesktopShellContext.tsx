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

export interface DesktopShellContextValue {
  chat: UseAIChatReturn;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  /** 보호된 액션 — 로그인이 안 됐으면 모달 표시 + 로그인 후 액션 실행 */
  requireAuth: (action: () => void) => void;
}

export const DesktopShellContext = createContext<DesktopShellContextValue | null>(null);

export function useDesktopShell(): DesktopShellContextValue {
  const ctx = useContext(DesktopShellContext);
  if (!ctx) {
    throw new Error("useDesktopShell must be used within DesktopShell");
  }
  return ctx;
}
