/**
 * General section — desktop own. 일반 설정 (테마 + 향후 언어 / 단축키 등).
 *
 * v0.0.84 — 첫 항목: 라이트/다크/시스템 3-way 테마 토글.
 */
import { memo } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@desktop/lib/theme-provider";

interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "라이트",
    description: "밝은 배경 + 진한 텍스트",
    icon: Sun,
  },
  {
    value: "dark",
    label: "다크",
    description: "어두운 배경 + 시안 액센트 (기본)",
    icon: Moon,
  },
  {
    value: "system",
    label: "시스템",
    description: "OS 설정 자동 따름",
    icon: Monitor,
  },
];

export const GeneralSectionDesktop = memo(function GeneralSectionDesktop() {
  const { theme, resolved, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      {/* ── 페이지 헤더 ── */}
      <header>
        <h2 className="ui-h2">
          일반
        </h2>
        <p className="ui-fs-sm text-muted-foreground mt-1 leading-relaxed">
          앱 전체에 적용되는 환경 설정. 현재 적용된 모드:{" "}
          <span className="text-foreground/80 font-medium">
            {resolved === "dark" ? "다크" : "라이트"}
          </span>
          {theme === "system" && (
            <span className="text-foreground/55"> (시스템 따름)</span>
          )}
          .
        </p>
      </header>

      {/* ── 01 외관 (테마) ── */}
      <Section
        index="01"
        eyebrow="APPEARANCE"
        title="외관"
        hint="라이트 / 다크 / 시스템"
      >
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "relative text-left rounded-lg border px-4 py-3.5 transition-all duration-150",
                  active
                    ? "bg-primary/[0.06] border-primary/40"
                    : "bg-foreground/[0.025] border-border/40 hover:bg-foreground/[0.04] hover:border-border/60",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-primary"
                  />
                )}
                <div className="flex items-center gap-2.5 mb-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-primary" : "text-foreground/55",
                    )}
                  />
                  <span
                    className={cn(
                      "ui-fs-sm font-medium tracking-tight",
                      active ? "text-foreground" : "text-foreground/85",
                    )}
                  >
                    {opt.label}
                  </span>
                </div>
                <p className="ui-caption text-muted-foreground/75 leading-snug">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
});

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
        <span className="ui-fs-xs font-mono tabular-nums text-foreground/35">
          {index}
        </span>
        <div className="flex-1">
          <div className="ui-fs-xs uppercase tracking-[0.16em] text-muted-foreground/65 font-medium">
            {eyebrow}
          </div>
          <h3 className="text-sm font-medium text-foreground mt-0.5 tracking-tight">
            {title}
          </h3>
        </div>
        {hint && (
          <span className="ui-caption text-muted-foreground/60">{hint}</span>
        )}
      </div>
      <div className="pt-1">{children}</div>
    </section>
  );
}
