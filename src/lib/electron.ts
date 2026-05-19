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
};
