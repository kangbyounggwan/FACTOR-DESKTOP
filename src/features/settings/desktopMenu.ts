/**
 * Desktop-only 설정 메뉴 — Claude 설정 좌측 nav 모티브.
 *
 * Claude 좌측 nav 의 핵심: 아이콘 없음, 설명 없음, 섹션 헤더로만 그룹핑.
 * 본 모듈은 (group label) → [items...] 구조를 export 해 SettingsNavList 가
 * 그대로 렌더하도록 한다.
 *
 * shared FE menuItems 는 그대로 두고 (FE 영향 X), desktop 만 그룹 구조 + "api"
 * 섹션 추가. (R6 — 페이지/메뉴 라우팅은 각 앱 자체 결정.)
 */

import type { MenuSection } from "@/features/settings";

export type DesktopMenuSection =
  | MenuSection
  | "api"
  | "data-schedules"
  | "api-catalog";

export interface DesktopMenuGroup {
  /** 섹션 헤더 (uppercase tiny). null 이면 헤더 없이 그냥 리스트. */
  label: string | null;
  items: { id: DesktopMenuSection; label: string }[];
}

export const desktopMenuGroups: DesktopMenuGroup[] = [
  {
    label: null,
    items: [
      { id: "profile", label: "내 정보" },
      { id: "team", label: "팀 관리" },
    ],
  },
  {
    label: "운영",
    items: [
      { id: "equipment", label: "담당 설비" },
      { id: "notifications", label: "알림 설정" },
    ],
  },
  {
    label: "통합",
    items: [
      { id: "api", label: "API 연결" },
      { id: "api-catalog", label: "API 카탈로그" },
      { id: "data-schedules", label: "ETL 스케쥴" },
    ],
  },
];

/** 평탄화 — 다른 곳에서 lookup 용 */
export const desktopMenuItems = desktopMenuGroups.flatMap((g) => g.items);
