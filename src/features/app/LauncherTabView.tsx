/**
 * LauncherTabView — 런처 "새 탭" 페이지 (Chrome 새 탭 페이지 상당).
 *
 * TabBar 의 + 버튼으로 열리는 탭(urlEntryId=null)의 본문. 내 앱 그리드 + APP
 * STORE 카탈로그를 보여주고, 카드를 클릭하면 **이 탭에서 바로** 그 앱이 열린다
 * (useOpenTabs.convertTab — 런처 탭이 webview 탭으로 전환).
 *
 * home 모드(탭 0개)와 달리 카드 클릭 = 상세 페이지가 아니라 즉시 열기.
 */

import { Plus, LayoutGrid } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { UrlCard } from "./UrlCard";
import { AppCatalog } from "./AppCatalog";
import type { AppUrlEntry } from "@desktop/types/electron";
import type { CatalogApp } from "./useAppCatalog";

interface Props {
  urls: AppUrlEntry[];
  installedUrls: string[];
  /** 내 앱 카드 클릭 — 이 탭에서 바로 열기 */
  onPickInstalled: (entry: AppUrlEntry) => void;
  /** 카탈로그 카드 클릭 — (미설치면 즐겨찾기 추가 후) 이 탭에서 바로 열기 */
  onPickCatalog: (app: CatalogApp) => void | Promise<void>;
  /** URL 직접 추가 다이얼로그 열기 (추가 완료 시 이 탭에서 열림) */
  onCustomAdd: () => void;
  /** 내 앱 카드 편집/삭제 (home 모드와 동일 동작) */
  onEditEntry: (entry: AppUrlEntry) => void;
  onRemoveEntry: (entryId: string) => void;
}

export function LauncherTabView({
  urls,
  installedUrls,
  onPickInstalled,
  onPickCatalog,
  onCustomAdd,
  onEditEntry,
  onRemoveEntry,
}: Props) {
  return (
    <div className="absolute inset-0 bg-background flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="px-8 py-8 max-w-5xl mx-auto">
          {/* 내 앱 — 클릭 시 이 탭에서 바로 열기 */}
          <section className="mb-10">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  새 탭에서 열기
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  앱을 클릭하면 이 탭에서 바로 열립니다
                </p>
              </div>
              <Button
                onClick={onCustomAdd}
                size="sm"
                variant="outline"
                className="gap-2 h-9 px-3"
              >
                <Plus className="w-4 h-4" />
                URL 직접 추가
              </Button>
            </header>
            {urls.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {urls.map((u) => (
                  <UrlCard
                    key={u.id}
                    entry={u}
                    onClick={() => onPickInstalled(u)}
                    onEdit={() => onEditEntry(u)}
                    onRemove={() => onRemoveEntry(u.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6">
                아직 즐겨찾기가 없습니다. 아래 STORE 에서 고르거나 URL 을 직접
                추가하세요.
              </p>
            )}
          </section>

          <div className="border-t border-border/40 my-8" />

          {/* STORE 카탈로그 — 클릭 시 (필요하면 즐겨찾기 추가 후) 이 탭에서 바로 열기 */}
          <AppCatalog onPick={onPickCatalog} installedUrls={installedUrls} />
        </div>
      </ScrollArea>
    </div>
  );
}
