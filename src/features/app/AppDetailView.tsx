/**
 * AppDetailView — Play Store 스타일 앱 상세 페이지.
 *
 * 레이아웃:
 *   ┌── 뒤로 ─────────────────────────────────────────────┐
 *   │                                                     │
 *   │  ┌── 좌측 (제목/메타/CTA/설명/태그) ──┐ ┌─ 큰 아이콘 ┐│
 *   │  │  이름 (큰 제목)                    │ │           ││
 *   │  │  호스트 / 카테고리                 │ │  160x160  ││
 *   │  │  ──────────────                   │ │           ││
 *   │  │  [지금 열기] [즐겨찾기에 추가]      │ └───────────┘│
 *   │  │  ──────────────                   │ ┌─ 정보 카드 ┐│
 *   │  │  설명                              │ │  URL      ││
 *   │  │  태그                              │ │  카테고리  ││
 *   │  └───────────────────────────────────┘ │  상태     ││
 *   │                                        └───────────┘│
 *   └─────────────────────────────────────────────────────┘
 *
 * 진입 경로:
 *  - 카탈로그 카드 → catalog 소스
 *  - 내 앱 카드    → installed 소스
 */

import { useMemo } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Tag,
  CheckCircle2,
  Globe,
  FolderOpen,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppFavicon } from "./AppFavicon";
import type { AppUrlEntry } from "@desktop/types/electron";
import type { CatalogApp } from "./useAppCatalog";

export type DetailViewSource =
  | { kind: "catalog"; app: CatalogApp; alreadyInstalled: boolean }
  | { kind: "installed"; entry: AppUrlEntry };

interface Props {
  source: DetailViewSource;
  onBack: () => void;
  onOpen: () => void;
  onAddToFavorites?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  /**
   * 앱의 백엔드 로직이 실행 가능(백단 이관/준비)한가.
   *  - true  → "지금 열기" (webview)
   *  - false → "다운로드" (백단 이관 필요 — onDownload)
   *  - undefined → 게이트 없음(외부 URL 앱): 항상 "지금 열기"
   */
  runnable?: boolean;
  /** runnable 판정(백엔드 probe) 진행 중 — 버튼 잠깐 비활성. */
  checkingRunnable?: boolean;
  /** "다운로드" 클릭 — 백단 이관 트리거. runnable===false 일 때만 노출. */
  onDownload?: () => void;
  /** 다운로드(이관) 진행 중. */
  downloading?: boolean;
}

export function AppDetailView({
  source,
  onBack,
  onOpen,
  onAddToFavorites,
  onEdit,
  onRemove,
  runnable,
  checkingRunnable,
  onDownload,
  downloading,
}: Props) {
  const { name, url, description, iconUrl, category, tags } = useMemo(() => {
    if (source.kind === "catalog") {
      return {
        name: source.app.name,
        url: source.app.url,
        description: source.app.description,
        iconUrl: source.app.icon_url,
        category: source.app.category_label || source.app.category,
        tags: source.app.tags,
      };
    }
    return {
      name: source.entry.name,
      url: source.entry.url,
      description: source.entry.description ?? null,
      iconUrl: source.entry.iconUrl ?? null,
      category: null,
      tags: [] as string[],
    };
  }, [source]);

  const host = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  const isInstalled =
    source.kind === "installed" || (source.kind === "catalog" && source.alreadyInstalled);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* 상단 뒤로가기 */}
      <div className="flex items-center px-6 py-3 border-b border-border/40 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </Button>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">
          {/* ─── 헤더: 좌측 메타 + 우측 큰 아이콘 ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start mb-10">
            {/* 좌측: 이름 / 호스트 / 메타 / CTA */}
            <div className="space-y-6 min-w-0">
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight truncate">{name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate">{host}</span>
                </div>
                {source.kind === "catalog" && category && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1 rounded-md bg-muted/40 border border-border/40">
                      <FolderOpen className="w-3 h-3" />
                      {category}
                    </span>
                    {isInstalled && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                        <CheckCircle2 className="w-3 h-3" />
                        내 앱에 추가됨
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CTA — primary 강조. 백엔드 앱은 실행 가능(백단 이관) 시에만 "지금 열기",
                  아니면 "다운로드". 외부 URL 앱(runnable===undefined)은 항상 "지금 열기". */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                {checkingRunnable ? (
                  <Button disabled className="h-11 px-7 gap-2 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    확인 중
                  </Button>
                ) : runnable === false && onDownload ? (
                  <Button
                    onClick={onDownload}
                    disabled={downloading}
                    className="h-11 px-7 gap-2 text-sm font-medium"
                    title="백엔드에 로직이 아직 이관되지 않았습니다 — 다운로드로 이관합니다."
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    다운로드
                  </Button>
                ) : (
                  <Button
                    onClick={onOpen}
                    className="h-11 px-7 gap-2 text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    지금 열기
                  </Button>
                )}

                {source.kind === "catalog" && !source.alreadyInstalled && onAddToFavorites && (
                  <Button
                    onClick={onAddToFavorites}
                    variant="outline"
                    className="h-11 px-5 gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    즐겨찾기에 추가
                  </Button>
                )}

                {source.kind === "installed" && onEdit && (
                  <Button onClick={onEdit} variant="outline" className="h-11 px-5 gap-2 text-sm">
                    <Pencil className="w-4 h-4" />
                    편집
                  </Button>
                )}

                {source.kind === "installed" && onRemove && (
                  <Button
                    onClick={onRemove}
                    variant="ghost"
                    className="h-11 px-5 gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </Button>
                )}
              </div>
            </div>

            {/* 우측: 큰 아이콘 */}
            <div className="flex justify-center lg:justify-end">
              <div
                className={cn(
                  "w-[160px] h-[160px] rounded-3xl bg-muted/40 border border-border/60",
                  "flex items-center justify-center flex-shrink-0 overflow-hidden",
                  "shadow-lg shadow-black/20",
                )}
              >
                <AppFavicon primarySrc={iconUrl} host={host} size={112} />
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 mb-8" />

          {/* ─── 본문 2-column: 설명/태그 (좌측) + 정보 카드 (우측) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            {/* 좌측: 설명 + 태그 */}
            <div className="space-y-8 min-w-0">
              {description ? (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold">설명</h2>
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </section>
              ) : (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold">설명</h2>
                  <p className="text-sm text-muted-foreground italic">
                    설명이 없습니다.
                  </p>
                </section>
              )}

              {source.kind === "catalog" && tags.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold">태그</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2.5 py-1 rounded-md bg-muted/40 border border-border/40"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* 우측: 정보 카드 */}
            <aside className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
                <h3 className="text-sm font-semibold">앱 정보</h3>
                <dl className="space-y-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">URL</dt>
                    <dd className="font-mono text-foreground break-all">{url}</dd>
                  </div>
                  {source.kind === "catalog" && category && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground">카테고리</dt>
                      <dd className="text-foreground">{category}</dd>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">상태</dt>
                    <dd
                      className={cn(
                        "text-foreground inline-flex items-center gap-1.5",
                        isInstalled && "text-primary",
                      )}
                    >
                      {isInstalled ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          즐겨찾기에 추가됨
                        </>
                      ) : (
                        <span className="text-muted-foreground">미추가</span>
                      )}
                    </dd>
                  </div>
                  {source.kind === "installed" && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground">추가된 날짜</dt>
                      <dd className="text-foreground">
                        {new Date(source.entry.addedAt).toLocaleDateString("ko-KR")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* 보조 안내 카드 */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">데스크탑에서 바로 실행</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  외부 브라우저 전환 없이 데스크탑 안에서 바로 열립니다. 데스크탑 셸의
                  탭/사이드바를 그대로 유지한 상태로 작업 가능.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
