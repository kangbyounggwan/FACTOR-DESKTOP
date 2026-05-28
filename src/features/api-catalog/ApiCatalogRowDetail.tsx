/**
 * Expand 패널 — 표 행 클릭 시 그 행 아래에 펼쳐진다.
 * 편집 → PATCH /api/api-catalog/{method_name} → DB 저장.
 */
import { useEffect, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import {
  useResetApiCatalog,
  useUpdateApiCatalog,
  type ApiCatalogEntry,
} from "./useApiCatalog";

interface Props {
  entry: ApiCatalogEntry;
  onClose: () => void;
}

interface Form {
  korean_label: string;
  description_ko: string;
  when_to_use: string;
  returns_summary: string;
  example_question: string;
  domain: string;
  cost_tier: string;
  is_curated: boolean;
  note: string;
}

function entryToForm(e: ApiCatalogEntry): Form {
  return {
    korean_label: e.korean_label ?? "",
    description_ko: e.description_ko ?? "",
    when_to_use: e.when_to_use ?? "",
    returns_summary: e.returns_summary ?? "",
    example_question: e.example_question ?? "",
    domain: e.domain ?? "",
    cost_tier: e.cost_tier ?? "low",
    is_curated: e.is_curated ?? false,
    note: "",
  };
}

export function ApiCatalogRowDetail({ entry, onClose }: Props) {
  const { toast } = useToast();
  const update = useUpdateApiCatalog("desktop-ui");
  const reset = useResetApiCatalog();

  const [form, setForm] = useState<Form>(() => entryToForm(entry));

  // entry 가 외부 invalidate 로 갱신되면 form 도 동기화 (이미 열려 있는 상태)
  useEffect(() => {
    setForm(entryToForm(entry));
  }, [entry.method_name, entry.last_modified_kind]);

  const handleSave = () => {
    const patch = {
      korean_label: form.korean_label,
      description_ko: form.description_ko,
      when_to_use: form.when_to_use,
      returns_summary: form.returns_summary,
      example_question: form.example_question || undefined,
      domain: form.domain,
      cost_tier: form.cost_tier as Parameters<typeof update.mutate>[0]["patch"]["cost_tier"],
      is_curated: form.is_curated,
      note: form.note || undefined,
    };
    update.mutate(
      { methodName: entry.method_name, patch },
      {
        onSuccess: () => {
          toast({
            title: "저장됨",
            description: `${entry.method_name} (manual)`,
          });
        },
        onError: (e) =>
          toast({
            title: "저장 실패",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          }),
      },
    );
  };

  const handleReset = () => {
    reset.mutate(entry.method_name, {
      onSuccess: () => {
        toast({
          title: "자동 갱신 복귀",
          description: `${entry.method_name} 은 다음 build_catalog 실행에서 다시 자동 덮어쓰기됩니다`,
        });
      },
      onError: (e) =>
        toast({
          title: "초기화 실패",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        }),
    });
  };

  const pending = update.isPending || reset.isPending;
  const isManual = entry.last_modified_kind === "manual";

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">
            <code className="font-mono">{entry.method_name}</code>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isManual ? (
              <>
                <span className="text-amber-500">수동 편집됨</span>
                {entry.last_modified_by && ` · ${entry.last_modified_by}`}
                {entry.last_modified_note && ` · ${entry.last_modified_note}`}
              </>
            ) : (
              <>자동 (build_catalog) — 마지막 검증 {entry.last_verified?.slice(0, 10) ?? "—"}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isManual && (
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={pending}>
              자동 복귀
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            접기
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">한국어 라벨 (제목)</Label>
          <Input
            value={form.korean_label}
            onChange={(e) => setForm({ ...form, korean_label: e.target.value })}
          />
        </div>

        <div className="space-y-1 col-span-2">
          <Label className="text-xs">설명 (description_ko) — 가장 중요</Label>
          <Textarea
            rows={3}
            value={form.description_ko}
            onChange={(e) => setForm({ ...form, description_ko: e.target.value })}
            placeholder="이 API 가 무엇을 하는지 한 줄로."
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">언제 사용 (when_to_use)</Label>
          <Textarea
            rows={3}
            value={form.when_to_use}
            onChange={(e) => setForm({ ...form, when_to_use: e.target.value })}
            placeholder="어떤 질문/시나리오에서 호출되어야 하나"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">반환값 요약 (returns_summary)</Label>
          <Textarea
            rows={3}
            value={form.returns_summary}
            onChange={(e) => setForm({ ...form, returns_summary: e.target.value })}
            placeholder="응답 핵심 필드"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <Label className="text-xs">예시 질문 (example_question)</Label>
          <Input
            value={form.example_question}
            onChange={(e) =>
              setForm({ ...form, example_question: e.target.value })
            }
            placeholder='예: "P13G 가동률 얼마야?"'
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">도메인</Label>
          <Input
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">우선순위 (cost_tier)</Label>
          <Select
            value={form.cost_tier}
            onValueChange={(v) => setForm({ ...form, cost_tier: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">low</SelectItem>
              <SelectItem value="tier_a">tier_a</SelectItem>
              <SelectItem value="tier_b">tier_b</SelectItem>
              <SelectItem value="tier_c">tier_c</SelectItem>
              <SelectItem value="high">high</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 col-span-2">
          <Label className="text-xs">변경 사유 (감사 로그용 메모)</Label>
          <Input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="예: '응답 필드 변경 반영', '도메인 재분류'"
          />
        </div>

        <div className="col-span-2 flex items-center justify-between border-t pt-3">
          <div>
            <Label className="text-sm">핵심 카탈로그 (is_curated)</Label>
            <p className="text-xs text-muted-foreground">
              켜두면 LLM 카드/NLU 우선 노출.
            </p>
          </div>
          <Switch
            checked={form.is_curated}
            onCheckedChange={(v) => setForm({ ...form, is_curated: v })}
          />
        </div>
      </div>

      {/* 읽기 전용 — 자동 영역 */}
      <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground border-t pt-3">
        <div>
          <span className="text-foreground/70">is_working</span>:{" "}
          {entry.is_working ? "✓" : "✗"}
        </div>
        <div>
          <span className="text-foreground/70">is_read_only</span>:{" "}
          {entry.is_read_only ? "✓" : "✗"}
        </div>
        <div>
          <span className="text-foreground/70">last_verified</span>:{" "}
          {entry.last_verified?.slice(0, 10) ?? "—"}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "저장 중…" : "저장 (수동 편집 마킹)"}
        </Button>
      </div>
    </div>
  );
}
