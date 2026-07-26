/**
 * factor-desktop MonitoringPage — 데스크탑 셸 전용 모니터링 본문.
 *
 * FE `Index.tsx` / `LineMonitoringView` 를 직접 import 하지 않고 (R1, R6),
 * leaf 컴포넌트만 가져와 셸 안에 알맞게 composition.
 *
 * 사이드바(라인 목록) 는 DesktopShell 의 ConversationSidebar.customRecents 슬롯에
 * `LineMonitoringSidebarBare` 로 표시. 본문은 sidebar 없이 라인 상세만 렌더.
 *
 * `LineMonitoringProvider` 는 DesktopShell 에서 wrap → 사이드바와 본문이 같은
 * selectedLineId/factory state 공유.
 *
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R5, R6).
 */

import { useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLineMonitoringContext } from "@/features/monitoring/context/LineMonitoringContext";
import { LineViewLayout } from "@/features/monitoring/components/line-view/line-view/LineViewLayout";
import { MultiZoneLayout } from "@/features/monitoring/components/line-view/multi-zone/MultiZoneLayout";
import {
  EmptyLineState,
  NoZoneState,
} from "@/features/monitoring/components/line-view/states";

export default function MonitoringPage() {
  const { selectedLineId, lines, selectLine, linesLoading, linesError } =
    useLineMonitoringContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL ?line={uuid} → state 복원 (mount 시 1회)
  useEffect(() => {
    const urlLine = searchParams.get("line");
    if (urlLine && urlLine !== selectedLineId) {
      selectLine(urlLine);
    }
    // intentionally empty — mount only restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // state → URL sync
  useEffect(() => {
    if (!selectedLineId) return;
    if (searchParams.get("line") !== selectedLineId) {
      const next = new URLSearchParams(searchParams);
      next.set("line", selectedLineId);
      setSearchParams(next, { replace: true });
    }
  }, [selectedLineId, searchParams, setSearchParams]);

  const line = lines.find((l) => l.id === selectedLineId) ?? null;

  return (
    <div className="h-full w-full min-h-0 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 flex overflow-hidden p-4">
        {/* 로딩·에러·빈 상태 분리 — 이전엔 셋 다 "존을 선택하세요"로 보여
            데이터가 없는 건지 안 온 건지 구분할 수 없었다 (UX 감사). */}
        {linesLoading && !line ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 ui-caption">
              <Loader2 className="h-4 w-4 animate-spin" />
              라인 정보를 불러오는 중…
            </div>
          </div>
        ) : linesError ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="ui-panel p-6 text-center max-w-sm">
              <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-2" />
              <p className="ui-h3 mb-1">라인 정보를 불러오지 못했습니다</p>
              <p className="ui-caption">
                네트워크 상태를 확인한 뒤 새로고침해 주세요.
              </p>
            </div>
          </div>
        ) : !line ? (
          <EmptyLineState />
        ) : !line.zones || line.zones.length === 0 ? (
          <NoZoneState lineName={line.name} />
        ) : line.zones.length === 1 ? (
          <LineViewLayout line={line} />
        ) : (
          <MultiZoneLayout
            line={line}
            onSelectZone={(z) =>
              navigate(`/monitoring/zone/${line.id}/${z.zone_id}`)
            }
          />
        )}
      </div>
    </div>
  );
}
