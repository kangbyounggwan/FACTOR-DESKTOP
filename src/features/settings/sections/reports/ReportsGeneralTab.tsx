/**
 * 보고서 관리 — [기본 설정] 탭.
 *
 * 회사 리포트 표현 설정(시간대/언어/기본 유형/포맷/브랜딩)을 관리한다.
 * 이 값들은 백엔드(report-service)가 **소비**하는 고객사색 — 스케줄 cron 해석 tz,
 * 합성 언어(locale), 리포트 브랜딩 등. 데스크톱이 소유·관리하고 백엔드는 GET/PUT
 * /settings 로 수신한다. 저장 안 하면 백엔드 중립 기본값(UTC/en/pdf)이 쓰인다.
 */
import { memo, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

import type { Persona, ReportFormat, TenantSettings } from "@desktop/api/reports";

import { PERSONA_LABEL, PERSONAS_ORDER } from "./meta";
import { useTenantSettings, usePutTenantSettings } from "./useReports";

// 흔한 IANA 시간대 — cron 해석·'어제' 기준일에 쓰인다. (자유 입력은 백엔드가 422 검증)
const TIMEZONES = [
  "UTC",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
];
const LOCALES: { value: string; label: string }[] = [
  { value: "en", label: "English (en)" },
  { value: "ko", label: "한국어 (ko)" },
  { value: "ja", label: "日本語 (ja)" },
  { value: "zh", label: "中文 (zh)" },
];
const FORMATS: ReportFormat[] = ["pdf", "html", "pptx"];

type FormState = {
  timezone: string;
  locale: string;
  default_persona: Persona | "none";
  default_formats: ReportFormat[];
  brandingName: string;
};

function toForm(s: TenantSettings): FormState {
  return {
    timezone: s.timezone || "UTC",
    locale: s.locale || "en",
    default_persona: s.default_persona ?? "none",
    default_formats: s.default_formats?.length ? s.default_formats : ["pdf"],
    brandingName:
      typeof s.branding?.name === "string" ? (s.branding.name as string) : "",
  };
}

export const ReportsGeneralTab = memo(function ReportsGeneralTab() {
  const settingsQuery = useTenantSettings();
  const putSettings = usePutTenantSettings();
  const { toast } = useToast();

  const initial = useMemo(
    () => (settingsQuery.data ? toForm(settingsQuery.data) : null),
    [settingsQuery.data],
  );
  const [form, setForm] = useState<FormState | null>(null);
  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  if (settingsQuery.isLoading || !form) {
    return <div className="h-64 rounded-xl bg-foreground/[0.04] animate-pulse" />;
  }
  if (settingsQuery.isError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
        <p className="text-[11.5px] text-red-300">
          설정을 불러오지 못했습니다:{" "}
          {settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : String(settingsQuery.error)}
        </p>
      </div>
    );
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const toggleFormat = (fmt: ReportFormat) =>
    setForm((f) => {
      if (!f) return f;
      const has = f.default_formats.includes(fmt);
      const next = has
        ? f.default_formats.filter((x) => x !== fmt)
        : [...f.default_formats, fmt];
      return { ...f, default_formats: next.length ? next : f.default_formats };
    });

  const onSave = async () => {
    try {
      await putSettings.mutateAsync({
        timezone: form.timezone,
        locale: form.locale,
        default_persona:
          form.default_persona === "none" ? null : form.default_persona,
        default_formats: form.default_formats,
        branding: form.brandingName.trim()
          ? { name: form.brandingName.trim() }
          : null,
      });
      toast({ title: "기본 설정을 저장했습니다." });
    } catch (e) {
      toast({
        title: "저장 실패",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-[520px] space-y-6">
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        회사 리포트 표현 설정입니다. 이 값은 리포트 생성·발송 시 백엔드가 사용합니다
        (시간대 = 스케줄 해석·기준일, 언어 = 리포트 문구). 저장하지 않으면 기본값(UTC ·
        English · PDF)이 적용됩니다.
      </p>

      {/* 시간대 */}
      <Field label="시간대 (Timezone)" hint="스케줄 cron 과 '어제' 기준일 해석에 사용">
        <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
          <SelectTrigger className="h-9 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(TIMEZONES.includes(form.timezone)
              ? TIMEZONES
              : [form.timezone, ...TIMEZONES]
            ).map((tz) => (
              <SelectItem key={tz} value={tz} className="text-[12.5px]">
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* 언어 */}
      <Field label="언어 (Locale)" hint="리포트 본문·프롬프트 언어">
        <Select value={form.locale} onValueChange={(v) => set("locale", v)}>
          <SelectTrigger className="h-9 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALES.map((l) => (
              <SelectItem key={l.value} value={l.value} className="text-[12.5px]">
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* 기본 유형 */}
      <Field label="기본 리포트 유형" hint="새 리포트/스케줄의 기본 페르소나">
        <Select
          value={form.default_persona}
          onValueChange={(v) => set("default_persona", v as Persona | "none")}
        >
          <SelectTrigger className="h-9 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-[12.5px]">
              지정 안 함
            </SelectItem>
            {PERSONAS_ORDER.map((p) => (
              <SelectItem key={p} value={p} className="text-[12.5px]">
                {PERSONA_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* 기본 포맷 */}
      <Field label="기본 출력 포맷" hint="최소 1개">
        <div className="flex items-center gap-4">
          {FORMATS.map((fmt) => (
            <label
              key={fmt}
              className="flex items-center gap-2 text-[12.5px] text-foreground/80"
            >
              <Switch
                checked={form.default_formats.includes(fmt)}
                onCheckedChange={() => toggleFormat(fmt)}
              />
              {fmt.toUpperCase()}
            </label>
          ))}
        </div>
      </Field>

      {/* 브랜딩 */}
      <Field label="브랜딩 표시명" hint="리포트 헤더/푸터에 표시 (비우면 미표시)">
        <Input
          value={form.brandingName}
          onChange={(e) => set("brandingName", e.target.value)}
          placeholder="예: 우리회사"
          className="h-9 text-[12.5px]"
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <Button
          size="sm"
          className="h-9 px-4 text-[12px]"
          disabled={!dirty || putSettings.isPending}
          onClick={onSave}
        >
          {putSettings.isPending ? "저장 중…" : "저장"}
        </Button>
        {dirty && (
          <button
            type="button"
            className="text-[11.5px] text-foreground/50 hover:text-foreground/75"
            onClick={() => initial && setForm(initial)}
          >
            되돌리기
          </button>
        )}
      </div>
    </div>
  );
});

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium text-foreground/85">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
      {children}
    </div>
  );
}
