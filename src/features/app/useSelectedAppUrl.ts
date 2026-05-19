/**
 * useSelectedAppUrl — APP 페이지에서 현재 선택된 URL ID의 글로벌 스토어.
 *
 * AppPage(메인 본문)와 AppSidebar(사이드바)가 같은 상태를 공유:
 * - 사이드바에서 URL 클릭 → 즉시 AppPage의 webview 갱신
 * - URL 삭제 → 사이드바·본문 동시 반영
 */

import { create } from "zustand";

interface SelectedAppUrlStore {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const useSelectedAppUrl = create<SelectedAppUrlStore>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
}));
