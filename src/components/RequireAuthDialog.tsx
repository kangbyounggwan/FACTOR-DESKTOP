/**
 * RequireAuthDialog — 게스트가 보호된 영역(예: DASHBOARD)에 접근하려 할 때
 * 페이지 이동 대신 띄우는 중앙 모달 로그인 폼.
 *
 * UI는 LoginFormContent를 그대로 사용 — DesktopAuthWidget Popover와 동일 UX 유지.
 *
 * 사용:
 *   const [open, setOpen] = useState(false);
 *   const pending = useRef<() => void>(() => {});
 *
 *   const requireAuth = (action: () => void) => {
 *     if (isAuthenticated) action();
 *     else { pending.current = action; setOpen(true); }
 *   };
 *
 *   <RequireAuthDialog open={open} onOpenChange={setOpen} onSuccess={() => pending.current()} />
 */

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { LoginFormContent } from "./LoginFormContent";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 로그인 성공 후 실행할 콜백 (보통 navigate) */
  onSuccess?: () => void;
  /** 모달 제목 */
  title?: string;
  description?: string;
}

export function RequireAuthDialog({
  open,
  onOpenChange,
  onSuccess,
  title = "로그인 필요",
  description = "이 기능을 사용하려면 로그인이 필요합니다.",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6">
        <LoginFormContent
          title={title}
          description={description}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
