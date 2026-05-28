/**
 * Assigned equipment section — desktop own. v0.0.52 design language.
 *
 * 디자인:
 *   · 헤더 + 4-up stats strip (전체 / 담당 / 가동 / 경고+위험)
 *   · 라인 chip segmented (전체 + 각 라인)
 *   · 카드 그리드 2-col: id mono + name + status dot + 라인 / 타입 meta + check
 *   · 활성 카드는 left rail (1px primary) + 살짝 채워진 background
 */
import { memo, useMemo } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Equipment } from "@/data/mockData";

interface Props {
  equipmentList: Equipment[];
  assignedEquipmentIds: string[];
  selectedLine: string;
  lineOptions: string[];
  onLineChange: (line: string) => void;
  onToggleEquipment: (equipmentId: string) => void;
}

const STATUS_TOKENS: Record<
  Equipment["status"],
  { dot: string; label: string; text: string }
> = {
  normal: { dot: "bg-emerald-400", label: "가동", text: "text-emerald-300" },
  warning: { dot: "bg-amber-400", label: "경고", text: "text-amber-300" },
  critical: { dot: "bg-rose-400", label: "위험", text: "text-rose-300" },
  offline: { dot: "bg-foreground/30", label: "정지", text: "text-foreground/55" },
};

const LINE_ALL = "all";

export const AssignedEquipmentSectionDesktop = memo(
  function AssignedEquipmentSectionDesktop({
    equipmentList,
    assignedEquipmentIds,
    selectedLine,
    lineOptions,
    onLineChange,
    onToggleEquipment,
  }: Props) {
    const filtered = useMemo(
      () =>
        selectedLine === LINE_ALL
          ? equipmentList
          : equipmentList.filter((eq) => eq.location === selectedLine),
      [equipmentList, selectedLine],
    );

    const stats = useMemo(() => {
      return {
        total: equipmentList.length,
        assigned: assignedEquipmentIds.length,
        normal: equipmentList.filter((eq) => eq.status === "normal").length,
        alert: equipmentList.filter(
          (eq) => eq.status === "warning" || eq.status === "critical",
        ).length,
      };
    }, [equipmentList, assignedEquipmentIds]);

    return (
      <div className="space-y-6">
        {/* ── 헤더 ── */}
        <header className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                담당 설비
              </h2>
              <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                모니터링 대상 설비 지정. 라인별로 좁혀 보고{" "}
                <span className="text-foreground/65">카드 클릭</span>으로 토글.
              </p>
            </div>
          </div>

          {/* stats strip */}
          <div className="grid grid-cols-4 gap-px bg-border/30 rounded-lg overflow-hidden border border-border/40">
            <Stat label="전체 설비" value={stats.total} />
            <Stat label="담당" value={stats.assigned} tint="text-sky-300" />
            <Stat label="가동" value={stats.normal} tint="text-emerald-300" />
            <Stat
              label="경고+위험"
              value={stats.alert}
              tint={stats.alert > 0 ? "text-rose-300" : undefined}
            />
          </div>
        </header>

        {/* ── 라인 chip ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-md bg-foreground/[0.03] border border-border/40 overflow-x-auto">
            <LineChip
              label="전체"
              active={selectedLine === LINE_ALL}
              onClick={() => onLineChange(LINE_ALL)}
            />
            {lineOptions.map((line) => (
              <LineChip
                key={line}
                label={line}
                active={selectedLine === line}
                onClick={() => onLineChange(line)}
              />
            ))}
          </div>

          <div className="ml-auto text-[12px] text-foreground/45 font-mono tabular-nums">
            {filtered.length}
            <span className="text-foreground/30 mx-1">/</span>
            {stats.total}
          </div>
        </div>

        {/* ── 카드 그리드 ── */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 bg-foreground/[0.015] px-6 py-12 text-center">
            <p className="text-[12px] text-foreground/65">
              이 라인에 설비가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((eq) => {
              const isAssigned = assignedEquipmentIds.includes(eq.id);
              const status = STATUS_TOKENS[eq.status];
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => onToggleEquipment(eq.id)}
                  className={cn(
                    "relative w-full text-left rounded-lg border transition-all duration-150",
                    "px-4 py-3.5 group",
                    isAssigned
                      ? "bg-primary/[0.06] border-primary/40"
                      : "bg-foreground/[0.025] border-border/40 hover:bg-foreground/[0.04] hover:border-border/60",
                  )}
                >
                  {/* left rail on active */}
                  {isAssigned && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-primary"
                    />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-[11.5px] font-medium tracking-tight text-foreground truncate">
                          {eq.name}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", status.dot)}
                          />
                          <span className={cn("text-[11.5px]", status.text)}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11.5px]">
                        <span className="font-mono text-foreground/55">
                          {eq.id}
                        </span>
                        <span className="text-foreground/25">·</span>
                        <span className="text-foreground/55">
                          {eq.location}
                        </span>
                        <span className="text-foreground/25">·</span>
                        <span className="text-foreground/55 truncate">
                          {eq.type}
                        </span>
                      </div>
                    </div>

                    {/* checkbox affordance */}
                    <div
                      className={cn(
                        "h-5 w-5 rounded-md flex items-center justify-center transition-all flex-shrink-0",
                        isAssigned
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/60 group-hover:border-foreground/40",
                      )}
                    >
                      {isAssigned && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

// ── Sub-components ───────────────────────────────────────────────────────

function LineChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded text-[11.5px] font-medium tracking-tight whitespace-nowrap transition-colors",
        active
          ? "bg-foreground/[0.08] text-foreground"
          : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]",
      )}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="bg-foreground/[0.025] px-4 py-3">
      <div className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground/65 font-medium">
        {label}
      </div>
      <div className="mt-1.5">
        <span
          className={cn(
            "text-[22px] font-semibold tabular-nums leading-none tracking-tight",
            tint ?? "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
