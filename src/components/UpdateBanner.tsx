/**
 * Section 02 (2026-05-27) — UpdateBanner.
 *
 * Electron autoUpdater 가 새 버전 다운로드 완료를 통보하면 우하단에 배너 표시.
 * 사용자가 "재시작" 클릭 시 quitAndInstall → 새 버전 적용.
 *
 * 웹 빌드 (window.electron === undefined) 에서는 아무것도 렌더링 안 함.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UpdateInfo {
  version: string;
  releaseNotes: string | null;
}

export function UpdateBanner() {
  const [pending, setPending] = useState<UpdateInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const autoUpdater = window.electron?.autoUpdater;
    if (!autoUpdater) return; // 웹 빌드 / preload 미주입 시 noop
    const off = autoUpdater.onUpdateDownloaded((info) => {
      setPending(info);
      toast({
        title: `새 버전 ${info.version} 준비 완료`,
        description: "재시작하면 적용됩니다.",
      });
    });
    return off;
  }, [toast]);

  if (!pending) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg p-3 shadow-lg flex items-center gap-3">
      <div className="text-sm">
        <div className="font-medium">v{pending.version} 준비 완료</div>
        <div className="ui-caption">
          재시작 시 새 버전 적용
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => window.electron?.autoUpdater?.quitAndInstall()}
      >
        재시작
      </Button>
    </div>
  );
}
