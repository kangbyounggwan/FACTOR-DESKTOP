/**
 * AddAppUrlDialog — 새 URL 즐겨찾기 추가/편집 모달.
 *
 * URL 입력 후 blur(또는 1.2초 debounce) → Electron 메인 프로세스가 메타 fetch:
 *  - og:title → 이름 자동 채움 (사용자가 비워뒀을 때만)
 *  - og:description → 설명 자동 채움
 *  - og:image / link[rel=icon] → 아이콘 미리보기 + 저장
 *
 * 추출 결과는 미리보기 카드로 보여주고, 사용자가 필요시 수정 가능.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Globe, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { electron } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

export interface AddAppUrlSubmit {
  name: string;
  url: string;
  iconUrl?: string;
  description?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: AppUrlEntry | null;
  onSubmit: (data: AddAppUrlSubmit) => Promise<void> | void;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

export function AddAppUrlDialog({
  open,
  onOpenChange,
  editTarget,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // 사용자가 직접 수정한 필드는 자동 추출이 덮어쓰지 않음
  const userEditedNameRef = useRef(false);
  const userEditedDescRef = useRef(false);
  const fetchedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editTarget?.name ?? "");
      setUrl(editTarget?.url ?? "");
      setDescription(editTarget?.description ?? "");
      setIconUrl(editTarget?.iconUrl);
      setError(null);
      setFetchError(null);
      setFetching(false);
      setSubmitting(false);
      userEditedNameRef.current = !!editTarget?.name;
      userEditedDescRef.current = !!editTarget?.description;
      fetchedUrlRef.current = editTarget?.url ?? null;
    }
  }, [open, editTarget]);

  // 메타 fetch
  const fetchMeta = useCallback(
    async (rawUrl: string, opts: { manual?: boolean } = {}) => {
      const normalized = normalizeUrl(rawUrl);
      if (!normalized || !isValidUrl(normalized)) return;
      if (!opts.manual && fetchedUrlRef.current === normalized) return; // 같은 URL 중복 호출 회피

      setFetching(true);
      setFetchError(null);
      try {
        const meta = await electron.fetchLinkMetadata(normalized);
        fetchedUrlRef.current = normalized;
        if (meta.error) setFetchError(meta.error);
        // 사용자가 직접 입력 안 한 필드만 자동 채움
        if (meta.title && !userEditedNameRef.current) {
          setName(meta.title.slice(0, 80));
        }
        if (meta.description && !userEditedDescRef.current) {
          setDescription(meta.description.slice(0, 200));
        }
        if (meta.iconUrl) setIconUrl(meta.iconUrl);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : String(e));
      } finally {
        setFetching(false);
      }
    },
    [],
  );

  // URL 입력 후 blur 시 자동 fetch
  const handleUrlBlur = () => {
    void fetchMeta(url);
  };

  // 수동 새로고침 버튼
  const handleManualFetch = () => {
    fetchedUrlRef.current = null;
    void fetchMeta(url, { manual: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized || !isValidUrl(normalized)) {
      setError("올바르지 않은 URL 형식");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        url: normalized,
        iconUrl,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const host = (() => {
    try {
      return new URL(normalizeUrl(url)).hostname;
    } catch {
      return null;
    }
  })();
  const previewIcon =
    iconUrl ||
    (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            {editTarget ? "URL 편집" : "URL 추가"}
          </DialogTitle>
          <DialogDescription>
            URL 만 입력하면 페이지 제목 / 설명 / 아이콘을 자동으로 가져옵니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="app-url-url" className="text-xs flex items-center gap-2">
              URL
              {fetching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            </Label>
            <div className="flex gap-1.5">
              <Input
                id="app-url-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://..."
                disabled={submitting}
                className="h-9 font-mono text-xs flex-1"
                autoFocus={!editTarget}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={handleManualFetch}
                disabled={submitting || fetching || !isValidUrl(normalizeUrl(url))}
                title="메타 정보 새로 가져오기"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", fetching && "animate-spin")} />
              </Button>
            </div>
            <p className="ui-fs-2xs text-muted-foreground">
              http(s) 생략 시 https:// 자동 추가. URL 입력 후 클릭 밖으로 나가면 자동 추출.
            </p>
          </div>

          {/* 미리보기 — URL 유효하면 항상 표시 */}
          {host && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
              <div className="w-10 h-10 rounded-lg bg-background border border-border/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {previewIcon ? (
                  <img
                    src={previewIcon}
                    alt=""
                    className="w-7 h-7"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <Globe className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  {name || <span className="text-muted-foreground/60">제목</span>}
                </div>
                <div className="ui-fs-2xs text-muted-foreground truncate font-mono mt-0.5">
                  {host}
                </div>
                {description && (
                  <div className="ui-fs-2xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {description}
                  </div>
                )}
              </div>
              {fetchError && (
                <div className="flex items-center gap-1 ui-fs-2xs text-amber-500 flex-shrink-0" title={fetchError}>
                  <AlertCircle className="w-3 h-3" />
                  자동추출 실패
                </div>
              )}
              {!fetchError && (name || description || iconUrl) && (
                <div className="flex items-center gap-1 ui-fs-2xs text-primary flex-shrink-0">
                  <Sparkles className="w-3 h-3" />
                  자동
                </div>
              )}
            </div>
          )}

          {/* 이름 */}
          <div className="space-y-1.5">
            <Label htmlFor="app-url-name" className="text-xs">이름</Label>
            <Input
              id="app-url-name"
              value={name}
              onChange={(e) => {
                userEditedNameRef.current = true;
                setName(e.target.value);
              }}
              placeholder="예: Supabase Dashboard"
              disabled={submitting}
              className="h-9"
            />
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <Label htmlFor="app-url-desc" className="text-xs">
              설명 <span className="text-muted-foreground/60">(선택)</span>
            </Label>
            <Textarea
              id="app-url-desc"
              value={description}
              onChange={(e) => {
                userEditedDescRef.current = true;
                setDescription(e.target.value);
              }}
              placeholder="한 줄 설명"
              disabled={submitting}
              rows={2}
              className="text-xs resize-none"
            />
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

