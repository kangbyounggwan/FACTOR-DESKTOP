/**
 * GuestEmpty — 비로그인 게스트에게 보여주는 Recents 빈 상태.
 *
 * 처음 쓰는 사람이 가장 먼저 만나는 화면 중 하나다. 이전엔 "로그인 후 표시됩니다"
 * 라는 **설명만** 있고 로그인 수단이 없어서, 사용자가 사이드바 맨 아래 auth 위젯을
 * 스스로 찾아내야 했다. 다음 행동(로그인)을 이 자리에서 바로 할 수 있게 하고,
 * 로그인 없이도 채팅은 된다는 점을 알려 첫 진입 장벽을 없앤다.
 */

import { History, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function GuestEmpty() {
  const navigate = useNavigate();

  return (
    <div className="py-8 text-center px-4 space-y-3">
      <History className="h-5 w-5 mx-auto opacity-30" />
      <p className="ui-caption leading-relaxed">
        로그인하면 지난 대화를
        <br />
        이어서 볼 수 있습니다.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5"
        onClick={() => navigate("/login")}
      >
        <LogIn className="h-3.5 w-3.5" />
        로그인
      </Button>
      <p className="ui-micro leading-relaxed">
        로그인 없이도 채팅은 쓸 수 있어요.
      </p>
    </div>
  );
}
