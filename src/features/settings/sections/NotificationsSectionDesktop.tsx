/**
 * Notifications section — desktop own. v0.0.52 design language.
 *
 * 디자인:
 *   · 두 그룹으로 분리: 01 채널 / 02 알림 종류
 *   · 각 row: dot+icon + title + description + Switch (right)
 *   · 카드 wrap 제거 — eyebrow + divider 패턴
 */
import { memo } from "react";
import { Bell, Factory, Mail, Wrench, BarChart3, CalendarClock } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { NotificationSettings } from "@/features/settings";

interface Props {
  notifications: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
}

type Item = {
  key: keyof NotificationSettings;
  icon: typeof Mail;
  dot: string;
  iconTint: string;
  title: string;
  description: string;
};

const CHANNEL_ITEMS: Item[] = [
  {
    key: "email",
    icon: Mail,
    dot: "bg-sky-400",
    iconTint: "text-sky-300",
    title: "이메일 알림",
    description: "중요 알림을 이메일로 받습니다.",
  },
  {
    key: "push",
    icon: Bell,
    dot: "bg-emerald-400",
    iconTint: "text-emerald-300",
    title: "브라우저 푸시",
    description: "실시간 알림을 브라우저에서 받습니다.",
  },
];

const EVENT_ITEMS: Item[] = [
  {
    key: "anomalyAlert",
    icon: Factory,
    dot: "bg-rose-400",
    iconTint: "text-rose-300",
    title: "이상탐지",
    description: "담당 설비에 이상 발생 시 즉시 알림.",
  },
  {
    key: "dailyReport",
    icon: BarChart3,
    dot: "bg-amber-400",
    iconTint: "text-amber-300",
    title: "일일 리포트",
    description: "매일 아침 8시 운영 요약 리포트.",
  },
  {
    key: "weeklyReport",
    icon: CalendarClock,
    dot: "bg-violet-400",
    iconTint: "text-violet-300",
    title: "주간 리포트",
    description: "매주 월요일 주간 분석 리포트.",
  },
  {
    key: "maintenanceReminder",
    icon: Wrench,
    dot: "bg-cyan-400",
    iconTint: "text-cyan-300",
    title: "정비 리마인더",
    description: "예정된 정비 일정 사전 알림.",
  },
];

export const NotificationsSectionDesktop = memo(
  function NotificationsSectionDesktop({ notifications, onToggle }: Props) {
    const enabledCount =
      Object.values(notifications).filter(Boolean).length;
    const total =
      Object.keys(notifications).length || CHANNEL_ITEMS.length + EVENT_ITEMS.length;

    return (
      <div className="space-y-8">
        {/* ── 헤더 ── */}
        <header className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="ui-h2">
                알림 설정
              </h2>
              <p className="ui-caption mt-1 leading-relaxed">
                채널과 알림 종류 별 수신 여부.{" "}
                <span className="text-foreground/65">토글</span>은 즉시 적용됩니다.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/65 font-medium">
                활성 알림
              </div>
              <div className="ui-fs-xl font-semibold tabular-nums leading-none tracking-tight text-foreground mt-1.5">
                {enabledCount}
                <span className="text-foreground/35 ml-1 text-xs font-medium">
                  / {total}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── 01 채널 ── */}
        <Section
          index="01"
          eyebrow="CHANNELS"
          title="채널"
          hint="알림을 받는 방법"
        >
          <ItemList items={CHANNEL_ITEMS} notifications={notifications} onToggle={onToggle} />
        </Section>

        {/* ── 02 알림 종류 ── */}
        <Section
          index="02"
          eyebrow="EVENTS"
          title="알림 종류"
          hint="어떤 이벤트를 받을지"
        >
          <ItemList items={EVENT_ITEMS} notifications={notifications} onToggle={onToggle} />
        </Section>
      </div>
    );
  },
);

// ── Sub-components ───────────────────────────────────────────────────────

function Section({
  index,
  eyebrow,
  title,
  hint,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 pb-2 border-b border-border/30">
        <span className="text-xs font-mono tabular-nums text-foreground/35">
          {index}
        </span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground/65 font-medium">
            {eyebrow}
          </div>
          <h3 className="text-xs font-medium text-foreground mt-0.5 tracking-tight">
            {title}
          </h3>
        </div>
        {hint && (
          <span className="ui-caption text-muted-foreground/60">{hint}</span>
        )}
      </div>
      <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function ItemList({
  items,
  notifications,
  onToggle,
}: {
  items: Item[];
  notifications: NotificationSettings;
  onToggle: (key: keyof NotificationSettings, value: boolean) => void;
}) {
  return (
    <div className="divide-y divide-border/30">
      {items.map((item) => {
        const checked = notifications[item.key];
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className={cn(
              "flex items-center gap-4 px-4 py-3.5 transition-colors",
              checked && "bg-foreground/[0.015]",
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative h-8 w-8 rounded-md bg-foreground/[0.05] flex items-center justify-center flex-shrink-0">
                <Icon className={cn("h-4 w-4", item.iconTint)} />
                {checked && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full",
                      item.dot,
                    )}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="ui-fs-xs text-foreground font-medium tracking-tight">
                  {item.title}
                </div>
                <div className="ui-caption text-muted-foreground/75 mt-0.5">
                  {item.description}
                </div>
              </div>
            </div>
            <Switch
              checked={checked}
              onCheckedChange={(v) => onToggle(item.key, v)}
            />
          </div>
        );
      })}
    </div>
  );
}
