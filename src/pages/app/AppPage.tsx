/**
 * AppPage (/app) — 외부 URL 즐겨찾기 + 내장 웹뷰.
 *
 * DesktopShell이 outer 구조(드래그 영역, 사이드바, auth modal)를 책임.
 * 이 페이지는 main area 내부 컨텐츠(URL 그리드 / 웹뷰)만 담당.
 *
 * URL CRUD는 useAppUrls (Desktop: electron-store, Web: localStorage).
 * webview 메서드(reload, goBack, goForward)는 ref로 호출 (Electron 한계로 unknown 캐스트).
 */

import { useState, useRef, useCallback } from "react";
import {
  useAppUrls,
  UrlGrid,
  AddressBar,
  WebViewFrame,
  AddAppUrlDialog,
} from "@desktop/features/app";
import { electron } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

export default function AppPage() {
  const { urls, loading, add, remove, update } = useAppUrls();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUrlEntry | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const webviewRef = useRef<HTMLElement | null>(null);

  const selected = urls.find((u) => u.id === selectedId) ?? null;

  // webview 메서드 호출 (Electron <webview> 인스턴스에 직접 접근)
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
    [editTarget, update, add],
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
