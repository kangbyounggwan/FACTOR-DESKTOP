/**
 * GuestEmpty — 비로그인 게스트에게 보여주는 Recents 빈 상태.
 */

import { History } from "lucide-react";

export function GuestEmpty() {
  return (
    <div className="text-[11px] text-muted-foreground py-8 text-center px-4 space-y-2">
      <History className="h-5 w-5 mx-auto opacity-30" />
      <p className="leading-relaxed">
        대화 이력은
        <br />
        로그인 후 표시됩니다.
      </p>
    </div>
  );
}
