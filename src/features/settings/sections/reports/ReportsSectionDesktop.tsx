/**
 * 보고서 관리 섹션 (F7~F12) — settings "reports".
 *
 * SettingsPage 에서 full-width 분기로 렌더된다 (api 섹션과 동일 취급) —
 * 이력 탭에서 run 을 선택하면 마스터-디테일 뷰어(F12)가 좁은 max-w 제약
 * 없이 전체 폭을 쓰기 위함. 탭 뷰 자체는 다른 섹션과 같은 톤으로
 * SimpleBar + max-w-[860px] 래핑.
 *
 * 탭: [이력 | 수신자 | 포맷] + 우측 슬롯(수신자 탭 = ＋ 수신자 추가).
 */
import { memo, useState } from "react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ReportsFormatsTab } from "./ReportsFormatsTab";
import { ReportsHistoryTab } from "./ReportsHistoryTab";
import { ReportsRecipientsTab } from "./ReportsRecipientsTab";
import { ReportViewerPanel } from "./ReportViewerPanel";

type ReportsTab = "history" | "recipients" | "formats";

const TABS: { id: ReportsTab; label: string }[] = [
  { id: "history", label: "이력" },
  { id: "recipients", label: "수신자" },
  { id: "formats", label: "포맷" },
];

export const ReportsSectionDesktop = memo(function ReportsSectionDesktop() {
  const [tab, setTab] = useState<ReportsTab>("history");
  const [viewerRunId, setViewerRunId] = useState<string | null>(null);
  const [addRecipientOpen, setAddRecipientOpen] = useState(false);

  // ── F12: 마스터-디테일 뷰어 — full-width ──
  if (viewerRunId) {
    return (
      <ReportViewerPanel
        runId={viewerRunId}
        onSelectRun={setViewerRunId}
        onClose={() => setViewerRunId(null)}
      />
    );
  }

  return (
    <SimpleBar className="h-full">
      <div className="px-10 py-8 mx-auto max-w-[860px] space-y-6">
        {/* ── 헤더 ── */}
        <header>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            보고서 관리
          </h2>
          <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
            임원 리포트 자동 생성·발송 — 이력 · 수신자 · 포맷 관리
          </p>
        </header>

        {/* ── 탭 바 + 우측 액션 슬롯 ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-1 rounded-lg border border-border/40 bg-foreground/[0.025] px-1.5 py-1">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative px-3 py-1.5 rounded-md text-[12px] font-medium tracking-tight transition-colors",
                    active
                      ? "text-foreground bg-foreground/[0.05]"
                      : "text-foreground/55 hover:text-foreground/80",
                  )}
                >
                  {t.label}
                  {/* 활성 하단 rail — 디자인의 cyan underline */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-2.5 right-2.5 -bottom-[3px] h-[2px] rounded-full transition-opacity",
                      active ? "bg-primary opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
          </div>

          {tab === "recipients" && (
            <Button
              size="sm"
              className="h-9 px-3 text-[11.5px] flex-shrink-0"
              onClick={() => setAddRecipientOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              수신자 추가
            </Button>
          )}
        </div>

        {/* ── 탭 콘텐츠 ── */}
        {tab === "history" && <ReportsHistoryTab onOpenRun={setViewerRunId} />}
        {tab === "recipients" && (
          <ReportsRecipientsTab
            addOpen={addRecipientOpen}
            onAddOpenChange={setAddRecipientOpen}
          />
        )}
        {tab === "formats" && <ReportsFormatsTab />}
      </div>
    </SimpleBar>
  );
});
