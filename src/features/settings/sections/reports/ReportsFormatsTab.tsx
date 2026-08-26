/**
 * 보고서 관리 — [포맷] 탭 (F9).
 *
 * 카드 = GET /templates 페르소나 3종 (executive/manager/operator) + 해당
 * persona 의 스케줄(있으면 발송 cron 표시). 우측 미리보기 = 선택 템플릿의
 * 섹션 구성을 문서 썸네일 형태로 (실데이터 mock 없음 — 섹션 헤딩만).
 * [편집] = TemplateDialog (스케줄 생성/수정).
 */
import { memo, useState } from "react";

import { cn } from "@/lib/utils";

import type { Persona } from "@desktop/api/reports";

import {
  PERSONAS_ORDER,
  cronCycleLabel,
  cronToLabel,
  templateDisplayName,
} from "./meta";
import { TemplateDialog } from "./TemplateDialog";
import {
  rolesForPersona,
  scheduleForPersona,
  useReportRecipients,
  useReportSchedules,
  useReportTemplates,
} from "./useReports";

export const ReportsFormatsTab = memo(function ReportsFormatsTab() {
  const templatesQuery = useReportTemplates();
  const schedulesQuery = useReportSchedules();
  const recipientsQuery = useReportRecipients();

  const [selected, setSelected] = useState<Persona>("executive");
  const [editPersona, setEditPersona] = useState<Persona | null>(null);

  const templates = templatesQuery.data;
  const schedules = schedulesQuery.data?.schedules;
  const recipients = recipientsQuery.data;

  if (templatesQuery.isLoading) {
    return <FormatsSkeleton />;
  }

  if (templatesQuery.isError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
        <p className="ui-caption ui-tone-bad">
          템플릿을 불러오지 못했습니다:{" "}
          {templatesQuery.error instanceof Error
            ? templatesQuery.error.message
            : String(templatesQuery.error)}
        </p>
        <p className="ui-micro text-muted-foreground/60 mt-1">
          리포트 서비스(VITE_REPORT_SERVICE_URL) 연결과 로그인 상태를 확인하세요.
        </p>
      </div>
    );
  }

  const previewTemplate = templates?.[selected];

  return (
    <div className="flex gap-6 items-start">
      {/* ── 템플릿 카드 리스트 ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {PERSONAS_ORDER.map((persona) => {
          const tpl = templates?.[persona];
          const schedule = scheduleForPersona(schedules, persona);
          const roles = rolesForPersona(recipients, persona);
          const cycle = schedule ? cronCycleLabel(schedule.cron) : null;
          const active = selected === persona;
          return (
            <button
              key={persona}
              type="button"
              onClick={() => setSelected(persona)}
              className={cn(
                "w-full text-left rounded-xl border px-5 py-4 transition-colors",
                active
                  ? "border-primary/40 bg-foreground/[0.03]"
                  : "border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.03]",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="ui-fs-sm font-semibold tracking-tight text-foreground">
                  {templateDisplayName(persona, tpl)}
                </span>
                {persona === "executive" && (
                  <span className="px-1.5 py-0.5 rounded-full ui-fs-2xs font-semibold bg-primary text-primary-foreground">
                    기본
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditPersona(persona);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      setEditPersona(persona);
                    }
                  }}
                  className="ml-auto ui-fs-xs text-primary hover:underline underline-offset-2 cursor-pointer"
                >
                  편집
                </span>
              </div>

              {/* 주기 칩 + 섹션 칩 */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full ui-fs-2xs font-medium border",
                    cycle
                      ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                      : "bg-foreground/[0.04] text-foreground/45 border-border/40",
                  )}
                >
                  {cycle ?? "미예약"}
                </span>
                {(tpl?.sections ?? []).slice(0, 5).map((s) => (
                  <span
                    key={s.key}
                    className="px-2 py-0.5 rounded-full ui-fs-2xs bg-foreground/[0.045] text-foreground/65 border border-border/40"
                  >
                    {s.heading.split("—")[0].split("(")[0].trim()}
                  </span>
                ))}
                {(tpl?.sections ?? []).length > 5 && (
                  <span className="ui-fs-2xs text-foreground/45">
                    +{(tpl?.sections ?? []).length - 5}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-0.5">
                <p className="ui-caption">
                  수신 그룹 ·{" "}
                  <span className="text-foreground/70">
                    {roles.length > 0 ? roles.join(", ") : "미지정"}
                  </span>
                </p>
                <p className="ui-caption">
                  발송 ·{" "}
                  <span className="text-foreground/70">
                    {schedule ? cronToLabel(schedule.cron) : "미설정"}
                  </span>
                  {schedule && !schedule.enabled && (
                    <span className="ml-1.5 text-foreground/45">(비활성)</span>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 우측 미리보기 썸네일 — 섹션 구성 (실데이터 mock 없음) ── */}
      <aside className="w-[260px] flex-shrink-0">
        <p className="ui-caption mb-2">
          미리보기 — {templateDisplayName(selected, previewTemplate)}
        </p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-foreground/[0.02]">
          <div className="bg-slate-950/80 px-4 py-3 border-b border-border/40">
            <div className="ui-fs-xs font-semibold text-white truncate">
              {templateDisplayName(selected, previewTemplate)}
            </div>
            <div className="ui-fs-2xs text-white/50 mt-0.5">
              {previewTemplate?.default_formats
                ?.map((f) => f.toUpperCase())
                .join(" · ") ?? "PDF"}
            </div>
          </div>
          <div className="p-3 space-y-2">
            {(previewTemplate?.sections ?? []).map((s) => (
              <div
                key={s.key}
                className="rounded-md border border-border/30 bg-foreground/[0.03] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="ui-fs-2xs text-foreground/75 truncate">
                    {s.heading}
                  </span>
                  {s.required && (
                    <span className="ui-fs-2xs text-primary/80 flex-shrink-0">
                      필수
                    </span>
                  )}
                </div>
                {s.chart !== "none" && (
                  <div className="mt-1.5 flex items-end gap-0.5 h-4 opacity-30">
                    {[3, 6, 4, 8, 5, 9, 7].map((h, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-sm bg-foreground/60"
                        style={{ height: `${h * 2}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(previewTemplate?.sections ?? []).length === 0 && (
              <p className="ui-fs-2xs text-foreground/45 text-center py-4">
                섹션 정보 없음
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* 템플릿 편집 모달 (F11) */}
      <TemplateDialog
        open={editPersona !== null}
        onOpenChange={(open) => {
          if (!open) setEditPersona(null);
        }}
        persona={editPersona ?? "executive"}
        template={editPersona ? templates?.[editPersona] : undefined}
        schedule={editPersona ? scheduleForPersona(schedules, editPersona) : undefined}
        recipientRoles={editPersona ? rolesForPersona(recipients, editPersona) : []}
      />
    </div>
  );
});

function FormatsSkeleton() {
  return (
    <div className="flex gap-6 animate-pulse">
      <div className="flex-1 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-foreground/[0.04]" />
        ))}
      </div>
      <div className="w-[260px] h-72 rounded-xl bg-foreground/[0.04]" />
    </div>
  );
}
