/**
 * SettingsNavList — Claude 데스크탑 설정 좌측 nav 모티브.
 *
 * 디자인 결정:
 *   - 아이콘 / 설명 텍스트 / 아바타 / 버전 푸터 전부 제거 (Claude 와 일치)
 *   - active = `bg-accent text-foreground` 회색 블록, 보더/체브론 없음
 *   - 섹션 헤더 = `text-[10.5px] uppercase tracking-wider text-muted-foreground/60`
 *   - 좌측은 단일 컬럼, 좌측 padding 6 / 우측 padding 2 (Claude 와 비슷한 비대칭)
 *
 * FE 의 `SettingsSidebar` 와 완전히 다른 컴포넌트 — 데스크탑 전용 (R6).
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
    <aside className="w-52 flex-shrink-0 flex flex-col py-5 pl-6 pr-2 border-r border-border/40">
      {desktopMenuGroups.map((group, gi) => (
        <div key={group.label ?? `g${gi}`} className={cn(gi > 0 && "mt-5")}>
          {group.label && (
            <p className="px-3 mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              {group.label}
            </p>
          )}
          <nav className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full text-left text-[13px] px-3 py-1.5 rounded-md transition-colors",
                    active
                      ? "bg-accent text-foreground"
                      : "text-foreground/75 hover:bg-foreground/[0.04] hover:text-foreground",
                  )}
                >
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
