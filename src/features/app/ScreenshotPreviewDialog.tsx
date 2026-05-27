/**
 * ScreenshotPreviewDialog — webview 캡쳐 결과 미리보기 + 액션.
 *
 * 현재 (Frontend MVP) 액션:
 *  - "다운로드" — base64 PNG 를 사용자 PC에 저장
 *  - "AI 분석" — placeholder (backend multimodal endpoint 준비 후 활성화)
 *  - "닫기"
 *
 * 향후 backend `/api/chat/v2/analyze-image` 가 추가되면 "AI 분석" 이 실제 호출
 * → AI 어시스턴트 패널에 결과 표시.
 */

import { Camera, Download, Sparkles, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** base64 data URL (data:image/png;base64,...) */
  imageDataUrl: string | null;
  /** 캡쳐된 사이트 호스트 (파일명 + 표시용) */
  host?: string;
  /** AI 분석 (Phase 2 — backend 준비 후 활성화). 미지정 시 placeholder 메시지 */
  onAnalyze?: () => void;
}

export function ScreenshotPreviewDialog({
  open,
  onOpenChange,
  imageDataUrl,
  host,
  onAnalyze,
}: Props) {
  const handleDownload = () => {
    if (!imageDataUrl) return;
    const a = document.createElement("a");
    a.href = imageDataUrl;
    const safeName = host ? host.replace(/[^a-z0-9.-]/gi, "_") : "screenshot";
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `factor-${safeName}-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            화면 캡쳐
          </DialogTitle>
          <DialogDescription>
            {host ? (
              <>
                <span className="font-mono">{host}</span> 의 현재 화면이 캡쳐되었습니다.
              </>
            ) : (
              "현재 화면이 캡쳐되었습니다."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* 이미지 미리보기 */}
        <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden max-h-[400px] flex items-center justify-center">
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt="화면 캡쳐"
              className="max-w-full max-h-[400px] object-contain"
            />
          ) : (
            <div className="py-12 text-sm text-muted-foreground">캡쳐 데이터 없음</div>
          )}
        </div>

        {/* AI 분석 안내 (backend 준비 전) */}
        {!onAnalyze && (
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
            <Info className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="font-semibold">AI 분석 기능 준비 중</strong> — 백엔드의
              multimodal endpoint (Anthropic Claude 이미지 분석) 가 곧 활성화됩니다.
              지금은 캡쳐 + 다운로드만 가능합니다.
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-1.5"
          >
            <X className="w-4 h-4" />
            닫기
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!imageDataUrl}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            다운로드
          </Button>
          {onAnalyze && (
            <Button size="sm" onClick={onAnalyze} disabled={!imageDataUrl} className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              AI 로 분석
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
