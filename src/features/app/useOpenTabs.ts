/**
 * useOpenTabs — APP 모드의 열린 탭 관리 (Zustand, 영속화 X).
 *
 * Linear / Chrome 같은 멀티 탭 UX:
 *  - 여러 URL 을 동시에 webview 로 열어둠
 *  - 탭 클릭으로 전환 (각 탭 webview state 유지)
 *  - + 버튼 = 새 탭 (APP STORE 홈으로 이동)
 *  - X 버튼 = 탭 닫기, 모든 탭 닫으면 home
 *
 * 영속화 X — 앱 재실행 시 빈 상태로 시작. 추후 옵션.
 *
 * 각 OpenTab 은 useAppUrls 의 AppUrlEntry 를 참조 (urlEntryId).
 * 즐겨찾기 entry 가 삭제되면 해당 탭은 별도 처리 (활성 탭 → 닫기, 비활성 → drop).
 */

import { create } from "zustand";

export interface OpenTab {
  /** uuid (탭 식별자, urlEntryId 와 다름 — 같은 URL 의 두 탭도 허용) */
  id: string;
  /**
   * AppUrlEntry.id 참조.
   * null = 런처 "새 탭" (Chrome 새 탭 페이지처럼 앱 선택 화면 — webview 없음).
   * 앱을 고르면 convertTab 으로 webview 탭으로 전환된다.
   */
  urlEntryId: string | null;
  /** 탭 열린 시각 (정렬용) */
  openedAt: number;
  /** webview 가 로딩 중인가 — TabBar 에서 favicon → spinner 전환 */
  isLoading?: boolean;
}

interface OpenTabsState {
  tabs: OpenTab[];
  activeTabId: string | null;

  /**
   * 새 탭 열기. 같은 urlEntryId 가 이미 있으면 그것을 활성화 (재사용).
   * 반환: 열리거나 활성화된 탭의 id.
   */
  openTab: (urlEntryId: string) => string;
  /** 런처 "새 탭" 열기 (Chrome 새 탭 페이지) — 항상 새로 만들고 활성화. */
  openLauncherTab: () => string;
  /**
   * 런처 탭 → webview 탭 전환 (앱 선택 시).
   * 같은 urlEntryId 탭이 이미 있으면 그 탭을 활성화하고 런처 탭은 닫는다 (dedupe).
   */
  convertTab: (tabId: string, urlEntryId: string) => void;
  /** 탭 닫기. 활성 탭 닫으면 다음 탭 (오른쪽 → 왼쪽) 활성. 모두 닫히면 null. */
  closeTab: (tabId: string) => void;
  /** 지정 탭 외 다른 모든 탭 닫기 (context menu) */
  closeOthers: (keepTabId: string) => void;
  /** 지정 탭 오른쪽의 모든 탭 닫기 (context menu) */
  closeToRight: (fromTabId: string) => void;
  /** 탭 활성화 */
  setActive: (tabId: string) => void;
  /** urlEntryId 의 entry 가 삭제됨 — 관련 탭 모두 정리 */
  dropByUrlEntryId: (urlEntryId: string) => void;
  /** 모든 탭 닫기 */
  closeAll: () => void;
  /** webview 로딩 상태 변경 — TabBar 에서 spinner 표시 */
  setLoading: (tabId: string, isLoading: boolean) => void;
}

export const useOpenTabs = create<OpenTabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (urlEntryId) => {
    const state = get();
    // 같은 URL 의 첫 번째 탭 재사용
    const existing = state.tabs.find((t) => t.urlEntryId === urlEntryId);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = crypto.randomUUID();
    const tab: OpenTab = { id, urlEntryId, openedAt: Date.now() };
    set({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    });
    return id;
  },

  openLauncherTab: () => {
    const state = get();
    const id = crypto.randomUUID();
    const tab: OpenTab = { id, urlEntryId: null, openedAt: Date.now() };
    set({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    });
    return id;
  },

  convertTab: (tabId, urlEntryId) => {
    const state = get();
    const target = state.tabs.find((t) => t.id === tabId);
    if (!target) return;
    // 같은 URL 의 기존 탭 재사용 — 런처 탭은 닫고 그 탭 활성화
    const existing = state.tabs.find(
      (t) => t.id !== tabId && t.urlEntryId === urlEntryId,
    );
    if (existing) {
      set({
        tabs: state.tabs.filter((t) => t.id !== tabId),
        activeTabId: existing.id,
      });
      return;
    }
    set({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, urlEntryId } : t,
      ),
      activeTabId: tabId,
    });
  },

  closeTab: (tabId) => {
    const state = get();
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const next = state.tabs.filter((t) => t.id !== tabId);
    let nextActive = state.activeTabId;
    if (state.activeTabId === tabId) {
      // 닫힌 탭이 활성이었으면 — 오른쪽 우선, 없으면 왼쪽
      if (next.length === 0) {
        nextActive = null;
      } else if (idx < next.length) {
        nextActive = next[idx].id;
      } else {
        nextActive = next[next.length - 1].id;
      }
    }
    set({ tabs: next, activeTabId: nextActive });
  },

  setActive: (tabId) => {
    const exists = get().tabs.some((t) => t.id === tabId);
    if (exists) set({ activeTabId: tabId });
  },

  dropByUrlEntryId: (urlEntryId) => {
    const state = get();
    const remaining = state.tabs.filter((t) => t.urlEntryId !== urlEntryId);
    let nextActive = state.activeTabId;
    if (
      state.activeTabId &&
      !remaining.find((t) => t.id === state.activeTabId)
    ) {
      nextActive = remaining[remaining.length - 1]?.id ?? null;
    }
    set({ tabs: remaining, activeTabId: nextActive });
  },

  closeAll: () => set({ tabs: [], activeTabId: null }),

  closeOthers: (keepTabId) => {
    const state = get();
    const kept = state.tabs.find((t) => t.id === keepTabId);
    if (!kept) return;
    set({ tabs: [kept], activeTabId: keepTabId });
  },

  closeToRight: (fromTabId) => {
    const state = get();
    const idx = state.tabs.findIndex((t) => t.id === fromTabId);
    if (idx === -1) return;
    const kept = state.tabs.slice(0, idx + 1);
    let nextActive = state.activeTabId;
    if (state.activeTabId && !kept.find((t) => t.id === state.activeTabId)) {
      nextActive = fromTabId;
    }
    set({ tabs: kept, activeTabId: nextActive });
  },

  setLoading: (tabId, isLoading) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isLoading } : t,
      ),
    }));
  },
}));
