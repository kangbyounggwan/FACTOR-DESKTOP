/**
 * AppSidebar — DesktopShell 사이드바의 Recents 영역에 들어가는 어플리케이션 런처.
 *
 * 디자인:
 * - 상단 "+ URL 추가" 인라인 버튼
 * - 등록된 URL을 favicon + name + host 행으로 나열 (Linear/Notion 사이드바 톤)
 * - 활성 URL은 primary 틴트 배경 + leading 컬러 dot
 * - hover 시 우측에 삭제 아이콘 등장
 * - 비어있을 때는 안내 + 빠른 추가 chips
 */

import { useState } from "react";
import { Plus, Trash2, Loader2, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppUrls } from "./useAppUrls";
import { useSelectedAppUrl } from "./useSelectedAppUrl";
import { AddAppUrlDialog } from "./AddAppUrlDialog";
import type { AppUrlEntry } from "@desktop/types/electron";

const QUICK_SUGGESTIONS = [
  { name: "Supabase", url: "https://supabase.com/dashboard" },
  { name: "GitHub", url: "https://github.com" },
  { name: "Linear", url: "https://linear.app" },
  { name: "Notion", url: "https://notion.so" },
];

export function AppSidebar() {
  const { urls, loading, add, remove } = useAppUrls();
  const { selectedId, setSelectedId } = useSelectedAppUrl();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUrlEntry | null>(null);

  const handleAdd = async (name: string, url: string) => {
    if (editTarget) return; // sidebar에서는 새 추가만 (편집은 본문 AddressBar에서)
    const entry = await add(name, url);
    setSelectedId(entry.id);
  };

  const handleQuickAdd = async (name: string, url: string) => {
    const entry = await add(name, url);
    setSelectedId(entry.id);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* + URL 추가 버튼 */}
      <div className="px-2 pt-1 pb-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setEditTarget(null);
            setAddOpen(true);
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-left",
            "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground transition-colors",
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>URL 추가</span>
        </button>
      </div>

      {/* 본문 */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-3">
          {loading ? (
            <LoadingState />
          ) : urls.length === 0 ? (
            <EmptyState onQuickAdd={handleQuickAdd} />
          ) : (
            <ul className="space-y-0.5">
              {urls.map((u) => (
                <AppRow
                  key={u.id}
                  entry={u}
                  active={u.id === selectedId}
                  onClick={() => setSelectedId(u.id)}
                  onRemove={() => {
                    void remove(u.id);
                    if (selectedId === u.id) setSelectedId(null);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>

      <AddAppUrlDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editTarget={editTarget}
        onSubmit={handleAdd}
      />
    </div>
  );
}

// ─── App row (어플리케이션 런처 행) ──────────────────────────────────────

function AppRow({
  entry,
  active,
  onClick,
  onRemove,
}: {
  entry: AppUrlEntry;
  active: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const host = (() => {
    try {
      return new URL(entry.url).hostname;
    } catch {
      return entry.url;
    }
  })();
  const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        title={`${entry.name}\n${entry.url}`}
        className={cn(
          "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left",
          "transition-colors",
          active
            ? "bg-primary/10 text-foreground"
            : "text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground",
        )}
      >
        {/* favicon 컨테이너 */}
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center overflow-hidden border",
            active
              ? "border-primary/40 bg-background/80"
              : "border-border/40 bg-background/40",
          )}
        >
          <img
            src={favicon}
            alt=""
            className="w-4 h-4"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>

        {/* name + host */}
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight">
            {entry.name}
          </p>
          <p className="text-[10px] text-muted-foreground/80 truncate font-mono leading-tight mt-0.5">
            {host}
          </p>
        </div>

        {/* active dot */}
        {active && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
        )}
      </button>

      {/* hover 시 우측 삭제 (active일 땐 dot이 있으니 살짝 옆으로 배치) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="삭제"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-1.5 h-6 w-6",
          "flex items-center justify-center rounded",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "bg-background/80 backdrop-blur-sm hover:bg-destructive/15 hover:text-destructive",
          active && "right-5",
        )}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}

// ─── States ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
      불러오는 중
    </div>
  );
}

function EmptyState({
  onQuickAdd,
}: {
  onQuickAdd: (name: string, url: string) => void;
}) {
  return (
    <div className="text-center py-6 px-3 space-y-3">
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20">
        <Globe className="w-4 h-4 text-primary" />
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        자주 쓰는 서비스를
        <br />
        한 곳에 모아 두세요
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
        {QUICK_SUGGESTIONS.map((s) => (
          <SuggestionChip
            key={s.url}
            name={s.name}
            url={s.url}
            onClick={() => onQuickAdd(s.name, s.url)}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionChip({
  name,
  url,
  onClick,
}: {
  name: string;
  url: string;
  onClick: () => void;
}) {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full",
        "bg-card/60 border border-border/50",
        "text-[10px] font-medium text-foreground/80",
        "hover:bg-card hover:border-primary/40 hover:text-foreground",
        "transition-colors",
      )}
    >
      <img
        src={favicon}
        alt=""
        className="w-3 h-3"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      {name}
    </button>
  );
}
