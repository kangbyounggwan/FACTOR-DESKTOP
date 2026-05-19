/**
 * AddAppUrlDialog — 새 URL 즐겨찾기 추가/편집 모달.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppUrlEntry } from "@desktop/types/electron";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: AppUrlEntry | null;
  onSubmit: (name: string, url: string) => Promise<void> | void;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function AddAppUrlDialog({
  open,
  onOpenChange,
  editTarget,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editTarget?.name ?? "");
      setUrl(editTarget?.url ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, editTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("URL을 입력하세요");
      return;
    }
    try {
      new URL(normalized);
    } catch {
      setError("올바르지 않은 URL 형식");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim(), normalized);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            {editTarget ? "URL 편집" : "URL 추가"}
          </DialogTitle>
          <DialogDescription>
            등록한 웹 페이지를 앱 안에서 바로 열 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="app-url-name" className="text-xs">
              이름
            </Label>
            <Input
              id="app-url-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: Supabase Dashboard"
              autoFocus
              disabled={submitting}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="app-url-url" className="text-xs">
              URL
            </Label>
            <Input
              id="app-url-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              disabled={submitting}
              className="h-9 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              http(s) 생략 시 https:// 자동 추가
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" size="sm" className="flex-1" disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editTarget ? (
                "저장"
              ) : (
                "추가"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
