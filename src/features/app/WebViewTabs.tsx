/**
 * WebViewTabs — 모든 열린 탭의 webview 를 동시에 mount.
 *
 * 활성 탭은 visible, 비활성 탭은 `display: none` 으로 숨김 (state 유지).
 * 각 탭의 webview ref 를 외부 ref map 으로 노출 — AddressBar 의
 * goBack/reload, AI 패널의 capturePageSnapshot 이 활성 탭의 ref 를 가져다 쓸 수 있음.
 *
 * Linear / Chrome 같은 탭 UX 의 핵심 — webview 를 unmount 하면 state (로그인,
 * scroll, navigation history) 가 사라지므로 항상 mount 유지.
 *
 * 메모리 부담: 한 webview ≈ 30-100MB. 10 탭 = 0.3-1GB. 추후 lazy unload (예: 10분
 * 비활성 시 unmount) 옵션 가능. 현재는 unlimited.
 */

import { useEffect, useRef, type RefObject } from "react";
import { isDesktop } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";
import { useOpenTabs, type OpenTab } from "./useOpenTabs";

interface Props {
  tabs: OpenTab[];
  activeTabId: string | null;
  /** tab → AppUrlEntry. 없으면 그 탭은 placeholder 렌더 */
  resolveEntry: (urlEntryId: string) => AppUrlEntry | null;
  /**
   * 활성 탭의 webview element ref. AppPage 가 reload/goBack/capture 에 사용.
   * activeTabId 변화에 따라 자동 갱신.
   */
  activeWebviewRef: RefObject<HTMLElement | null>;
}

const WebviewTag = "webview" as unknown as React.FC<
  React.HTMLAttributes<HTMLElement> & {
    src?: string;
    partition?: string;
    webpreferences?: string;
    ref?: React.Ref<HTMLElement>;
    style?: React.CSSProperties;
  }
>;

export function WebViewTabs({
  tabs,
  activeTabId,
  resolveEntry,
  activeWebviewRef,
}: Props) {
  const setLoading = useOpenTabs((s) => s.setLoading);
  // 각 탭의 webview element 보존 — Map<tabId, HTMLElement>
  const refs = useRef<Map<string, HTMLElement | null>>(new Map());

  // 활성 탭 바뀔 때 activeWebviewRef 갱신
  useEffect(() => {
    if (!activeTabId) {
      (activeWebviewRef as React.MutableRefObject<HTMLElement | null>).current = null;
      return;
    }
    const el = refs.current.get(activeTabId) ?? null;
    (activeWebviewRef as React.MutableRefObject<HTMLElement | null>).current = el;
  }, [activeTabId, activeWebviewRef, tabs]);

  // 탭마다 webview 의 did-start-loading / did-stop-loading 이벤트 → store 의 isLoading 동기화.
  // useOpenTabs.setLoading 으로 TabBar 가 spinner 전환.
  useEffect(() => {
    const listeners: Array<() => void> = [];
    for (const tab of tabs) {
      const el = refs.current.get(tab.id);
      if (!el) continue;
      const onStart = () => setLoading(tab.id, true);
      const onStop = () => setLoading(tab.id, false);
      el.addEventListener("did-start-loading", onStart);
      el.addEventListener("did-stop-loading", onStop);
      el.addEventListener("did-fail-load", onStop);
      listeners.push(() => {
        el.removeEventListener("did-start-loading", onStart);
        el.removeEventListener("did-stop-loading", onStop);
        el.removeEventListener("did-fail-load", onStop);
      });
    }
    return () => {
      for (const off of listeners) off();
    };
  }, [tabs, setLoading]);

  // 비활성 / 빈 상태
  if (tabs.length === 0) {
    return null;
  }

  if (!isDesktop) {
    // 웹 빌드 — 단순 iframe fallback (활성 탭만)
    const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
    const entry = resolveEntry(active.urlEntryId);
    if (!entry) return null;
    return (
      <iframe
        src={entry.url}
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        title={entry.name}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      {tabs.map((tab) => {
        const entry = resolveEntry(tab.urlEntryId);
        const isActive = tab.id === activeTabId;
        if (!entry) {
          // 즐겨찾기에서 삭제된 entry — placeholder
          return isActive ? (
            <div key={tab.id} className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              이 탭의 즐겨찾기가 삭제되었습니다.
            </div>
          ) : null;
        }
        return (
          <WebviewTag
            key={tab.id}
            ref={(el) => {
              refs.current.set(tab.id, el);
              if (tab.id === activeTabId) {
                (activeWebviewRef as React.MutableRefObject<HTMLElement | null>).current = el;
              }
            }}
            src={entry.url}
            partition="persist:factor-apps"
            webpreferences="contextIsolation=yes,nodeIntegration=no,allowRunningInsecureContent=no"
            allowpopups="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              display: isActive ? "flex" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
