/**
 * 수신자 추가/편집 모달 (F10).
 *
 * 이름 / 이메일 / 역할(select) / 구독 템플릿 칩 다중선택 / [취소][추가|저장].
 * 편집 모드에선 좌측에 [삭제]. subscribed_templates 는 persona 키 배열로 저장.
 */
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type { Persona } from "@desktop/api/reports";

import { PERSONA_LABEL, PERSONAS_ORDER } from "./meta";
import {
  useCreateRecipient,
  useDeleteRecipient,
  useUpdateRecipient,
  type ReportRecipient,
} from "./useReports";

/** 역할 프리셋 — F8 시안 행 + 기본값 '담당자' (자유 텍스트 아님, select). */
const ROLE_OPTIONS = ["임원", "공장장", "품질담당", "생산관리", "설비보전", "담당자"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = 추가 모드 */
  recipient: ReportRecipient | null;
}

export function RecipientDialog({ open, onOpenChange, recipient }: Props) {
  const { toast } = useToast();
  const createMutation = useCreateRecipient();
  const updateMutation = useUpdateRecipient();
  const deleteMutation = useDeleteRecipient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("담당자");
  const [templates, setTemplates] = useState<Persona[]>(["executive"]);

  const isEdit = recipient !== null;
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // 열릴 때 초기화 (편집 모드면 기존 값)
  useEffect(() => {
    if (!open) return;
    setName(recipient?.name ?? "");
    setEmail(recipient?.email ?? "");
    setRole(recipient?.role ?? "담당자");
    setTemplates(recipient?.subscribed_templates ?? ["executive"]);
  }, [open, recipient]);

  const toggleTemplate = (p: Persona) => {
    setTemplates((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      toast({ title: "이름을 입력하세요.", variant: "destructive" });
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast({ title: "올바른 이메일을 입력하세요.", variant: "destructive" });
      return;
    }
    const input = {
      name: trimmedName,
      email: trimmedEmail,
      role,
      subscribed_templates: templates,
    };
    const opts = {
      onSuccess: () => {
        toast({
          title: isEdit ? "저장 완료" : "추가 완료",
          description: `${trimmedName} (${trimmedEmail})`,
        });
        onOpenChange(false);
      },
      onError: (error: Error) =>
        toast({
          title: isEdit ? "저장 실패" : "추가 실패",
          description: error.message,
          variant: "destructive",
        }),
    };
    if (isEdit && recipient) {
      updateMutation.mutate({ id: recipient.id, patch: input }, opts);
    } else {
      createMutation.mutate(input, opts);
    }
  };

  const handleDelete = () => {
    if (!recipient) return;
    deleteMutation.mutate(recipient.id, {
      onSuccess: () => {
        toast({ title: "삭제 완료", description: recipient.email });
        onOpenChange(false);
      },
      onError: (error) =>
        toast({
          title: "삭제 실패",
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "수신자 편집" : "수신자 추가"}</DialogTitle>
          <DialogDescription>
            리포트 발송 이메일 수신자를 {isEdit ? "수정" : "등록"}합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              이름
            </Label>
            <Input
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 ui-fs-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              이메일
            </Label>
            <Input
              type="email"
              placeholder="name@seohan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 ui-fs-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              역할
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 ui-fs-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
              구독 템플릿
            </Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PERSONAS_ORDER.map((p) => {
                const selected = templates.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleTemplate(p)}
                    aria-pressed={selected}
                    className={cn(
                      "px-2.5 py-1 rounded-full ui-fs-xs font-medium border transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-foreground/[0.04] text-foreground/70 border-border/50 hover:bg-foreground/[0.07]",
                    )}
                  >
                    {PERSONA_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className={cn(isEdit && "sm:justify-between")}>
          {isEdit && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mr-auto"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              삭제
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {isEdit ? "저장" : "추가"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
