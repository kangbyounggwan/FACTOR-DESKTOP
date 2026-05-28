/**
 * Profile section — desktop own. v0.0.52 "refined technical instrument" tone.
 *
 * 디자인:
 *   · 카드 wrap 제거 — flat surface, section eyebrow + dividers
 *   · 신원 row: avatar + name (15px medium) + role dot+label + meta strip
 *   · 폼: label-on-top, mono email (read-only), tabular phone
 *   · 우측 정렬 primary 버튼
 *
 * 룰: R6 — FE ProfileSection 의 props/types/role config 는 그대로 재사용,
 *      레이아웃 / surface 만 데스크탑 톤으로 재구성.
 */
import { memo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Camera, Loader2, Save } from "lucide-react";
import {
  type DisplayProfile,
  type EditedProfile,
  type UserRole,
  roleConfig,
} from "@/features/settings";

// 직급 / role 색은 FE roleConfig 의 className 을 재해석 — desktop 은 dot 으로만 표현.
const ROLE_DOT: Record<UserRole, string> = {
  admin: "bg-purple-400",
  manager: "bg-sky-400",
  operator: "bg-emerald-400",
  viewer: "bg-foreground/40",
};

interface Props {
  displayProfile: DisplayProfile;
  editedProfile: EditedProfile;
  onEditedProfileChange: (profile: EditedProfile) => void;
  onSave: () => void;
  isSaving: boolean;
  isLoading: boolean;
}

export const ProfileSectionDesktop = memo(function ProfileSectionDesktop({
  displayProfile,
  editedProfile,
  onEditedProfileChange,
  onSave,
  isSaving,
  isLoading,
}: Props) {
  const role = (displayProfile.role as UserRole) || "viewer";
  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString("ko-KR");
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 페이지 헤더 ── typography 는 SettingsPage top header 와 일치 (17px). */}
      <header>
        <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
          내 정보
        </h2>
        <p className="text-[14.5px] text-muted-foreground mt-1 leading-relaxed">
          프로필과 연락처 정보. 회사 · 공장 · 권한은{" "}
          <span className="text-foreground/70">관리자가 부여</span>합니다.
        </p>
      </header>

      {/* ── 01 신원 ── */}
      <Section index="01" eyebrow="IDENTITY" title="신원" hint="조직 내 표시 정보">
        <div className="flex items-start gap-6 pt-2">
          {/* avatar */}
          <div className="relative group flex-shrink-0">
            <Avatar className="h-20 w-20 ring-1 ring-border/50">
              <AvatarImage src={displayProfile.avatar_url || ""} />
              <AvatarFallback className="text-xl bg-foreground/[0.06] text-foreground/80 font-medium">
                {displayProfile.name.slice(0, 2) || "—"}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="아바타 변경"
            >
              <Camera className="h-4 w-4 text-foreground" />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="text-[18px] font-medium text-foreground tracking-tight">
                {displayProfile.name || "—"}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", ROLE_DOT[role])} />
                <span className="text-[13.5px] text-foreground/75">
                  {displayProfile.roleLabel || roleConfig[role]?.label || "열람자"}
                </span>
              </div>
            </div>

            {/* meta strip */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
              <Meta label="부서" value={displayProfile.department || "미설정"} />
              <Meta
                label="가입일"
                value={formatDate(displayProfile.created_at)}
                mono
              />
              {displayProfile.company_name && (
                <Meta label="회사" value={displayProfile.company_name} />
              )}
              {displayProfile.factory_name && (
                <Meta label="공장" value={displayProfile.factory_name} />
              )}
            </dl>
          </div>
        </div>
      </Section>

      {/* ── 02 연락처 ── */}
      <Section
        index="02"
        eyebrow="CONTACT"
        title="연락처"
        hint="이메일은 변경 불가"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-2">
          <Field
            label="이름"
            value={editedProfile.full_name}
            onChange={(v) =>
              onEditedProfileChange({ ...editedProfile, full_name: v })
            }
          />
          <Field
            label="직책"
            value={editedProfile.job_title}
            placeholder="예: 설비관리 담당자"
            onChange={(v) =>
              onEditedProfileChange({ ...editedProfile, job_title: v })
            }
          />
          <Field
            label="이메일"
            value={editedProfile.email}
            disabled
            mono
            hint="이메일은 가입 시 고정"
          />
          <Field
            label="연락처"
            value={editedProfile.phone}
            placeholder="010-0000-0000"
            mono
            onChange={(v) =>
              onEditedProfileChange({ ...editedProfile, phone: v })
            }
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button
            onClick={onSave}
            disabled={isSaving || isLoading}
            size="sm"
            className="h-9 px-4 text-[14.5px]"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            변경사항 저장
          </Button>
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
        <span className="text-[12px] font-mono tabular-nums text-foreground/35">
          {index}
        </span>
        <div className="flex-1">
          <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground/65 font-medium">
            {eyebrow}
          </div>
          <h3 className="text-[16px] font-medium text-foreground mt-0.5 tracking-tight">
            {title}
          </h3>
        </div>
        {hint && (
          <span className="text-[13px] text-muted-foreground/60">{hint}</span>
        )}
      </div>
      <div className="space-y-4 pt-1">{children}</div>
    </section>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <dt className="text-[12.5px] uppercase tracking-[0.12em] text-muted-foreground/55 font-medium w-12 flex-shrink-0">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[14.5px] text-foreground/85 truncate",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  disabled,
  mono,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  hint?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13.5px] text-foreground/85 font-medium tracking-tight block">
        {label}
      </label>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "h-9 text-[14.5px] bg-foreground/[0.03] border-border/50 focus-visible:bg-foreground/[0.05]",
          mono && "font-mono tabular-nums",
          disabled && "bg-foreground/[0.02] text-foreground/55",
        )}
      />
      {hint && (
        <p className="text-[12.5px] text-muted-foreground/55">{hint}</p>
      )}
    </div>
  );
}
