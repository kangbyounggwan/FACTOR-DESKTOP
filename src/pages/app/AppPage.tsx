/**
 * AppPage (/app) — 외부 URL 즐겨찾기 + 내장 웹뷰.
 *
 * DesktopShell이 outer 구조(드래그 영역, 사이드바, auth modal)를 책임.
 * 이 페이지는 main area 내부 컨텐츠(URL 그리드 / 웹뷰)만 담당.
 *
 * 선택된 URL ID는 useSelectedAppUrl(Zustand) 글로벌 store에서 관리 —
 * 사이드바(AppSidebar)와 본문(이 페이지)이 같은 selectedId를 공유.
 */

import { useState, useRef, useCallback } from "react";
import {
  useAppUrls,
  useSelectedAppUrl,
  UrlGrid,
  AddressBar,
  WebViewFrame,
  AddAppUrlDialog,
} from "@desktop/features/app";
import { electron } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

export default function AppPage() {
  const { urls, loading, add, remove, update } = useAppUrls();
  const { selectedId, setSelectedId } = useSelectedAppUrl();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUrlEntry | null>(null);
  const webviewRef = useRef<HTMLElement | null>(null);

  const selected = urls.find((u) => u.id === selectedId) ?? null;

  // webview 메서드 호출
  const reload = useCallback(() => {
    const wv = webviewRef.current as unknown as { reload?: () => void } | null;
    wv?.reload?.();
  }, []);
  const goBack = useCallback(() => {
    const wv = webviewRef.current as unknown as {
      goBack?: () => void;
      canGoBack?: () => boolean;
    } | null;
    if (wv?.canGoBack?.()) wv.goBack?.();
  }, []);
  const goForward = useCallback(() => {
    const wv = webviewRef.current as unknown as {
      goForward?: () => void;
      canGoForward?: () => boolean;
    } | null;
    if (wv?.canGoForward?.()) wv.goForward?.();
  }, []);

  const handleSubmit = useCallback(
    async (name: string, url: string) => {
      if (editTarget) {
        await update(editTarget.id, { name, url });
      } else {
        const entry = await add(name, url);
        setSelectedId(entry.id);
      }
    },
    [editTarget, update, add, setSelectedId],
  );

  // Empty 상태에서 suggestion chip 클릭 — 모달 없이 즉시 추가 + 선택
  const handleQuickAdd = useCallback(
    async (name: string, url: string) => {
      const entry = await add(name, url);
      setSelectedId(entry.id);
    },
    [add, setSelectedId],
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {selected ? (
        <>
          <AddressBar
            entry={selected}
            onBack={goBack}
            onForward={goForward}
            onReload={reload}
            onOpenExternal={() => void electron.openExternal(selected.url)}
            onEdit={() => {
              setEditTarget(selected);
              setAddOpen(true);
            }}
            onRemove={() => {
              void remove(selected.id);
              setSelectedId(null);
            }}
            onUrlChange={(url) => void update(selected.id, { url })}
          />
          <div className="flex-1 min-h-0">
            <WebViewFrame ref={webviewRef} url={selected.url} />
          </div>
        </>
      ) : (
        <UrlGrid
          urls={urls}
          loading={loading}
          onAddClick={() => {
            setEditTarget(null);
            setAddOpen(true);
          }}
          onSelect={setSelectedId}
          onEdit={(u) => {
            setEditTarget(u);
            setAddOpen(true);
          }}
          onRemove={(id) => void remove(id)}
          onQuickAdd={handleQuickAdd}
        />
      )}

      <AddAppUrlDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editTarget={editTarget}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
