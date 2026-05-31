/**
 * Electron API wrapper — 웹/데스크탑 양쪽에서 안전하게 호출 가능 (no-op fallback).
 *
 * 사용 예:
 *   import { electron, isDesktop } from '@/lib/electron';
 *   if (isDesktop) {
 *     const v = await electron.appVersion();
 *   }
 *   await electron.openExternal('https://supabase.com'); // 웹이면 window.open, 데스크탑이면 시스템 브라우저
 */

import type { LinkMetadata } from "@desktop/types/electron";

export const isDesktop =
  typeof window !== "undefined" && !!window.electron;

export const electron = {
  appVersion: async (): Promise<string | null> => {
    if (window.electron) return window.electron.app.version();
    return null;
  },

  openExternal: async (url: string): Promise<void> => {
    if (window.electron) return window.electron.shell.openExternal(url);
    window.open(url, "_blank", "noopener,noreferrer");
  },

  isOnline: (): boolean => {
    if (window.electron) return window.electron.net.isOnline();
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  },

  onNetworkChange: (cb: (online: boolean) => void): (() => void) => {
    if (window.electron) return window.electron.net.onChange(cb);
    const handler = () => cb(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  },

  /** Chat 팝업 — 별도 떠 있는 창 (투명도 조절). 웹/미지원 환경은 no-op. */
  chatPopup: {
    open: async (): Promise<void> => {
      await window.electron?.chatPopup?.open();
    },
    setOpacity: async (value: number): Promise<void> => {
      await window.electron?.chatPopup?.setOpacity(value);
    },
    close: async (): Promise<void> => {
      await window.electron?.chatPopup?.close();
    },
  },

  /**
   * URL 메타 정보 fetch (Electron 메인 프로세스, CORS 우회).
   * 웹 환경(데스크탑 아님)에서는 favicon fallback 만 제공.
   */
  fetchLinkMetadata: async (url: string): Promise<LinkMetadata> => {
    if (window.electron) return window.electron.link.fetchMetadata(url);
    // 웹 fallback — favicon 만
    try {
      const host = new URL(url).hostname;
      return {
        url,
        iconUrl: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
      };
    } catch {
      return { url, error: "잘못된 URL" };
    }
  },
};
