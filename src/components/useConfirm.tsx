/**
 * useConfirm — 파괴적 액션 확인 다이얼로그.
 *
 * 배경(UX 감사 2026-07-22): 앱 전체에 `AlertDialog` 사용이 **0곳**이었다.
 * 즐겨찾기 삭제·수신자 삭제·로그아웃이 확인 없이 즉시 실행됐고, 사이드바의
 * hover 휴지통은 오클릭 위험이 가장 큰데도 되돌릴 방법이 없었다.
 *
 * 사용:
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   const ok = await confirm({ title: "즐겨찾기를 삭제할까요?", danger: true });
 *   if (ok) remove(id);
 *   ...
 *   return (<>{dialog}...</>);   // dialog 를 트리에 렌더해야 뜬다
 *
 * native `window.confirm()` 대신 이걸 쓴다 (OS 다이얼로그는 디자인 시스템 밖).
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** 확인 버튼 문구 (기본: 삭제 시 "삭제", 그 외 "확인") */
  confirmText?: string;
  cancelText?: string;
  /** 파괴적 동작 — 확인 버튼을 destructive 톤으로 */
  danger?: boolean;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const dialog: ReactNode = (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        // Esc / 바깥 클릭으로 닫히면 취소로 간주 (미해결 Promise 방지)
        if (!o) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          {opts?.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {opts?.cancelText ?? "취소"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={cn(
              opts?.danger &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {opts?.confirmText ?? (opts?.danger ? "삭제" : "확인")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
