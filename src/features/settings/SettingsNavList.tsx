/**
 * SettingsNavList — 1차 nav. v0.0.69 sub-sidebar 스타일 통일.
 *
 * 디자인 (v0.0.69 — sub-sidebar 톤 적용):
 *   · active = 옅은 배경 (`bg-foreground/[0.045]`) + 좌측 primary rail (2px)
 *   · hover = 더 옅은 배경 (`bg-foreground/[0.025]`)
 *   · 섹션 헤더 (eyebrow) = `text-[12.5px] uppercase tracking-wider`
 *
 * Sub-sidebar(ApiConnectionsContainer 의 Method/API) 와 동일 패턴 — 1차/2차
 * nav 가 시각적으로 일관된 활성 스타일을 가지지만, 1차는 width 가 커서
 * "큰 항목" 으로, 2차는 좁아서 "세부 항목" 으로 보이는 위계 자연스러움.
 */

import { memo } from "react";

import { cn } from "@/lib/utils";

import { desktopMenuGroups, type DesktopMenuSection } from "./desktopMenu";

interface Props {
  activeSection: DesktopMenuSection;
  onSectionChange: (section: DesktopMenuSection) => void;
}

export const SettingsNavList = memo(function SettingsNavList({
  activeSection,
  onSectionChange,
}: Props) {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col py-5 pl-10 pr-3">
      {desktopMenuGroups.map((group, gi) => (
        <div key={group.label ?? `g${gi}`} className={cn(gi > 0 && "mt-5")}>
          {group.label && (
            <p className="px-3 mb-1 text-[12.5px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              {group.label}
            </p>
          )}
          <nav className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "group relative w-full text-left transition-all duration-150",
                    "text-[15px] rounded-md pl-3 pr-2.5 py-1.5",
                    active
                      ? "bg-foreground/[0.045] text-foreground"
                      : "text-foreground/75 hover:bg-foreground/[0.025] hover:text-foreground",
                  )}
                >
                  {/* 활성 좌측 rail — sub-sidebar 와 동일 패턴 */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full transition-all duration-200",
                      active
                        ? "bg-primary opacity-100"
                        : "bg-foreground/20 opacity-0 group-hover:opacity-30",
                    )}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
});
