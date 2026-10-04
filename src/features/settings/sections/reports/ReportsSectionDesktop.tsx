/**
 * 보고서 관리 섹션 (F7~F12 + F19~F25 디자이너) — /reports 리포트 앱 본문.
 *
 * SettingsPage 에서 full-width 분기로 렌더된다 (api 섹션과 동일 취급) —
 * 이력 탭에서 run 을 선택하면 마스터-디테일 뷰어(F12)가 좁은 max-w 제약
 * 없이 전체 폭을 쓰기 위함. 탭 뷰 자체는 다른 섹션과 같은 톤으로
 * SimpleBar + max-w-[860px] 래핑(디자이너 탭만 캔버스 3열을 위해 1360px).
 *
 * 탭: [생성 | 디자이너 | 이력 | 수신자 | 포맷 | 기본 설정] + 우측 슬롯(수신자 탭 = ＋ 수신자 추가).
 * 활성 탭은 URL 쿼리 `?tab=` 가 SoT — 채팅 패널 "디자이너에서 열기" 와 TemplateDialog "디자이너 열기" 가
 * `/reports?tab=designer(&sheet=<id>)` 로 진입한다(E9). HashRouter 라 `#/reports?tab=…` 형태.
 */
import { memo, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ReportsDesignerTab } from "./ReportsDesignerTab";
import { ReportsFormatsTab } from "./ReportsFormatsTab";
import { ReportsGenerateTab } from "./ReportsGenerateTab";
import { ReportsHistoryTab } from "./ReportsHistoryTab";
import { ReportsGeneralTab } from "./ReportsGeneralTab";
import { ReportsRecipientsTab } from "./ReportsRecipientsTab";
import { ReportViewerPanel } from "./ReportViewerPanel";

type ReportsTab = "generate" | "designer" | "history" | "recipients" | "formats" | "general";

const TABS: { id: ReportsTab; label: string }[] = [
  { id: "generate", label: "생성" },
  { id: "designer", label: "디자이너" },
  { id: "history", label: "이력" },
  { id: "recipients", label: "수신자" },
  { id: "formats", label: "포맷" },
  { id: "general", label: "기본 설정" },
];

const DEFAULT_TAB: ReportsTab = "generate";
const isReportsTab = (v: string | null): v is ReportsTab => TABS.some((t) => t.id === v);

export const ReportsSectionDesktop = memo(function ReportsSectionDesktop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: ReportsTab = isReportsTab(tabParam) ? tabParam : DEFAULT_TAB;
  const setTab = useCallback(
    (next: ReportsTab) => {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", next);
      // 디자이너 밖으로 나가면 시트 컨텍스트도 비운다
      if (next !== "designer") sp.delete("sheet");
      setSearchParams(sp);
    },
    [searchParams, setSearchParams],
  );
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
      <div className={cn("px-10 py-8 mx-auto space-y-6", tab === "designer" ? "max-w-[1360px]" : "max-w-[860px]")}>
        {/* ── 헤더 ── */}
        <header>
          <h2 className="ui-h2">
            보고서 관리
          </h2>
          <p className="ui-caption mt-1 leading-relaxed">
            AI 리포트 생성 · 발송 — 생성 · 시트 디자이너 · 이력 · 수신자 · 포맷 관리
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
                    "relative px-3 py-1.5 rounded-md text-xs font-medium tracking-tight transition-colors",
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
              className="h-9 px-3 ui-fs-xs flex-shrink-0"
              onClick={() => setAddRecipientOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              수신자 추가
            </Button>
          )}
        </div>

        {/* ── 탭 콘텐츠 ── */}
        {tab === "generate" && <ReportsGenerateTab onOpenRun={setViewerRunId} />}
        {tab === "designer" && <ReportsDesignerTab onOpenRun={setViewerRunId} />}
        {tab === "history" && <ReportsHistoryTab onOpenRun={setViewerRunId} />}
        {tab === "recipients" && (
          <ReportsRecipientsTab
            addOpen={addRecipientOpen}
            onAddOpenChange={setAddRecipientOpen}
          />
        )}
        {tab === "formats" && <ReportsFormatsTab />}
        {tab === "general" && <ReportsGeneralTab />}
      </div>
    </SimpleBar>
  );
});
