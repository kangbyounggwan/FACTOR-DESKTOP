/**
 * OntologyTransferConsentDialog — S4: "이관 동의서".
 *
 * 온톨로지 팩에는 회사 고유 공장 자산(라인/스테이션/공정/개념)이 들어 있어, 다운로드 =
 * 회사 자산의 로컬 디바이스 이관이다. 따라서 install 전에 이 동의서를 띄우고,
 * 사용자가 명시적으로 동의해야만 다운로드·적용한다.
 *
 * 동의 → onAgree(); 취소/닫기 → onOpenChange(false). 데스크탑 자체 컴포넌트(R1/R6).
 */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OntologyAdapter } from "@desktop/types/electron";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adapter: OntologyAdapter | null;
  onAgree: () => void;
  /** 다운로드 진행 중 (버튼 비활성/스피너) */
  busy?: boolean;
}

export function OntologyTransferConsentDialog({
  open,
  onOpenChange,
  adapter,
  onAgree,
  busy = false,
}: Props) {
  const [checked, setChecked] = useState(false);

  // 대상이 바뀌거나 다시 열릴 때 체크 초기화
  useEffect(() => {
    if (open) setChecked(false);
  }, [open, adapter?.adapter_type]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            온톨로지 데이터 이관 동의서
          </DialogTitle>
          <DialogDescription>
            {adapter?.name ?? adapter?.adapter_type} 플러그인을 이 디바이스로 이관합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            본 플러그인에는 회사 고유의 공장 온톨로지(라인·스테이션·공정 순서·개념 사전 등)
            데이터가 포함됩니다. 설치 시 해당 데이터가 이 디바이스의 로컬 저장소
            (<code className="text-xs">%APPDATA%/FACTOR DESKTOP/packs</code>)에 저장됩니다.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>이관된 데이터는 회사 자산이며, 권한 있는 사용자만 다운로드할 수 있습니다.</li>
            <li>데이터는 무결성 검증(SHA-256) 후 저장되며, 외부로 재배포할 수 없습니다.</li>
            <li>퇴사·권한 회수 시 로컬 사본을 삭제할 책임은 사용자에게 있습니다.</li>
          </ul>

          <label className="flex items-start gap-2 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-sm text-foreground">
              위 내용을 확인했으며 데이터 이관에 동의합니다.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            취소
          </Button>
          <Button onClick={onAgree} disabled={!checked || busy}>
            {busy ? "이관 중…" : "동의하고 설치"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
