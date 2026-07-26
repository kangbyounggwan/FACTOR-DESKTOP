/**
 * factor-desktop ZoneDetailPage — 멀티존 라인에서 선택한 단일 존(라인) 상세.
 *
 * MULTI-ZONE 화면(MultiZoneLayout)의 zone 카드 클릭 → 이 페이지로 라우팅
 * (`/monitoring/zone/:lineId/:zoneId`). 해당 zone(=자체 mes_line_id)을
 * **단일 라인 뷰(LineViewLayout)와 동일한 구성**으로 표시:
 *   상단 KPI + PROCESS FLOW + (라인 현황 · 병목 분석 · FACTOR AGENT 진단).
 *
 * 차이는 단 하나 — snapshot/flow 를 zone 의 mes_line_id 로 스코프 (ProcessFlow.mesLineId).
 * lineRuntime/baseline 는 zone 단위 소스가 없어 null → KPI 는 snapshot 도출,
 * FACTOR AGENT 패널은 "데이터 수집 중" (단일 라인 뷰와 동일 동작).
 *
 * R1/R6: 페이지는 데스크탑 자체 소유. FE 의 leaf 컴포넌트/hook 만 `@/...` 로 import.
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R5, R6).
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

import { useAuth } from "@/features/auth";
import { useLineMonitoringContext } from "@/features/monitoring/context/LineMonitoringContext";
import { useLineZoneStructure } from "@/features/monitoring/hooks/useLineZoneStructure";
import { useBottleneckAnalysis } from "@/features/monitoring/hooks/useBottleneckAnalysis";
import { LineKpiStrip } from "@/features/monitoring/components/line-view/line-view/LineKpiStrip";
import { ProcessFlow } from "@/features/monitoring/components/line-view/line-view/ProcessFlow";
import { ZoneStatusPanel } from "@/features/monitoring/components/line-view/line-view/ZoneStatusPanel";
import { BottleneckPanel } from "@/features/monitoring/components/line-view/line-view/BottleneckPanel";
import { FactorAgentPanel } from "@/features/monitoring/components/line-view/line-view/FactorAgentPanel";
import { fetchLineSnapshot } from "@/api/monitoring";
import { queryKeys } from "@/lib/queryKeys";

export default function ZoneDetailPage() {
  const { lineId = null, zoneId = null } = useParams<{ lineId: string; zoneId: string }>();
  const navigate = useNavigate();

  const { profile } = useAuth();
  const companyCode = profile?.company?.code ?? null;

  const { lines, selectedLineId, selectLine } = useLineMonitoringContext();
  const line = lines.find((l) => l.id === lineId) ?? null;

  // 사이드바 선택과 상세 라인 동기화 + 다른 라인 선택 시 메인으로 이탈.
  //  - 상세는 URL(:lineId/:zoneId)로 렌더되므로, 사이드바에서 다른 라인을 눌러
  //    selectedLineId 만 바뀌면 화면이 안 바뀐다. 이를 감지해 /monitoring 로 이동.
  //  - 진입(또는 새로고침) 시 selectLine(lineId) 로 store 를 상세 라인에 고정해
  //    Context 의 "첫 라인 자동선택"이 덮어쓰지 않게 한다(child effect 가 먼저 실행).
  const anchorLineRef = useRef<string | null>(null);
  useEffect(() => {
    if (anchorLineRef.current === null) {
      anchorLineRef.current = lineId;
      if (lineId && selectedLineId !== lineId) selectLine(lineId);
      return;
    }
    if (selectedLineId && selectedLineId !== anchorLineRef.current) {
      navigate("/monitoring");
    }
  }, [selectedLineId, lineId, selectLine, navigate]);

  // zone 구조 — zoneId 로 mes_line_id / zone_code 해석
  const zoneStructQ = useLineZoneStructure(lineId);
  const zone = zoneStructQ.data?.find((z) => z.zone_id === zoneId) ?? null;
  const mesLineId = zone?.mes_line_id ?? null;
  const zoneCode = zone?.zone_code ?? null;
  const zoneName = zone?.zone_name ?? line?.name ?? "라인 상세";

  // zone snapshot — 멀티존 뷰와 동일 queryKey → 캐시 공유 (즉시 표시).
  const snapQ = useQuery({
    queryKey: queryKeys.lineSnapshot(lineId, mesLineId, companyCode),
    queryFn: ({ signal }) =>
      fetchLineSnapshot({ companyCode: companyCode!, mesLineId: mesLineId!, signal }),
    enabled: !!companyCode && mesLineId != null,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
  const snapshot = snapQ.data ?? null;
  const hints = useBottleneckAnalysis(snapshot);

  // WIP 합계 / 정체 구간 — ProcessFlow 가 propagate
  const [wipTotal, setWipTotal] = useState<number>(0);
  const [bottleneckCount, setBottleneckCount] = useState<number>(0);

  const zoneMissing = zoneStructQ.isSuccess && !zone;

  return (
    <div className="h-full w-full min-h-0 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 flex flex-col overflow-hidden p-4">
        {/* 헤더 — 뒤로 + zone 이름/코드 (단일 라인 뷰 LineHeader 톤) */}
        <header className="flex items-center gap-3 px-1 pb-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-md border border-border/50 bg-foreground/[0.04] px-2.5 py-1.5 ui-fs-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            aria-label="이전 화면으로"
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로
          </button>
          <div className="min-w-0 flex-1">
            <div className="ui-fs-xs font-mono uppercase tracking-[0.14em] text-muted-foreground/65">
              FACTOR_AGENT / ZONE-VIEW / LINE-DETAIL
            </div>
            <div className="mt-1 flex items-center gap-2.5 flex-wrap">
              <h1 className="truncate ui-fs-xl font-semibold tracking-tight text-foreground">
                {zoneName}
              </h1>
              {zoneCode && (
                <span className="inline-flex items-center rounded-md border border-border/50 bg-foreground/[0.04] px-1.5 py-0.5 font-mono ui-fs-xs tabular-nums text-foreground/65">
                  LINE {zoneCode}
                </span>
              )}
              {line?.name && zone && (
                <span className="text-xs text-muted-foreground/65 truncate">
                  · {line.name}
                </span>
              )}
            </div>
          </div>
        </header>

        {zoneMissing ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            존을 찾을 수 없습니다 (zoneId: {zoneId ?? "—"}).
          </div>
        ) : !zone ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            존 정보 로딩...
          </div>
        ) : mesLineId == null ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            이 존은 MES 라인 매핑이 없어 실시간 상세를 표시할 수 없습니다.
          </div>
        ) : (
          <SimpleBar
            className="flex-1 min-w-0 min-h-0 pr-3"
            autoHide={false}
            style={{ maxHeight: "100%" }}
          >
            <div className="flex flex-col gap-3 p-1 pr-2">
              <LineKpiStrip
                lineRuntime={null}
                baseline={null}
                uph={null}
                snapshot={snapshot}
                wipTotal={wipTotal}
                bottleneckCount={bottleneckCount}
              />

              <ProcessFlow
                lineId={lineId}
                companyCode={companyCode}
                zoneCode={zoneCode}
                mesLineId={mesLineId}
                onWipTotal={(t, b) => {
                  setWipTotal(t);
                  setBottleneckCount(b);
                }}
              />

              <div className="grid grid-cols-3 gap-3 min-h-[260px]">
                <ZoneStatusPanel snapshot={snapshot} />
                <BottleneckPanel hints={hints} />
                <FactorAgentPanel
                  lineId={lineId}
                  lineRuntime={null}
                  baseline={null}
                  snapshot={snapshot}
                  bottleneckHints={hints}
                />
              </div>
            </div>
          </SimpleBar>
        )}
      </div>
    </div>
  );
}
