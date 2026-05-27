/**
 * Section 09 (2026-05-27) — 긴 에러 detail 전체 보기 모달.
 *
 * AddApiConnectionDialog 등 catch 블록에서 100자 초과 detail 이 토스트에
 * truncate 되면 "더 보기" 액션이 본 모달을 띄움. pre 태그로 JSON / stack
 * trace pretty-print.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  detail: string;
}

export function ErrorDetailModal({
  open,
  onOpenChange,
  title = "오류 상세",
  detail,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <pre className="bg-muted/40 rounded-md p-3 text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap">
          {detail}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
