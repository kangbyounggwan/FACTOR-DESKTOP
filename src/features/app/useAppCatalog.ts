/**
 * useAppCatalog — Supabase `app_catalog` 테이블에서 추천 앱 목록 fetch.
 *
 * 데이터 소스: supabase/migrations/033_create_app_catalog.sql
 *   + 102_app_catalog_item_type_pack_id.sql (item_type·pack_id — select 가 item_type 을 읽는다)
 * 운영자가 콘솔에서 직접 갱신 — 배포 없이 카탈로그 변경 가능.
 *
 * STORE 노출 규칙(정리안 A, 웹과 동일): is_active=true + item_type 'webapp' +
 * FACTOR 자체 호스트(factor.io.kr) 아닌 행만.
 *
 * 공유 범위: 판정 함수만 웹 leaf "@/features/app/catalogRules" 를 import 한다.
 * 이 훅 자체는 웹 "@/features/app/useAppCatalog" 와 쿼리·필터·반환 형태가 같은
 * 데스크탑 사본이다 — select 컬럼·필터를 바꿀 때는 두 훅을 함께 고친다.
 * 훅 통합(데스크탑 index.ts 가 웹 훅을 re-export 하고 이 파일 삭제)은 P3-b.
 *
 * 사용:
 *   const { apps, byCategory, loading, error, refresh } = useAppCatalog();
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isStoreListable } from "@/features/app/catalogRules";

export interface CatalogApp {
  id: string;
  name: string;
  url: string;
  description: string | null;
  icon_url: string | null;
  category: string;
  category_label: string | null;
  sort_order: number;
  is_featured: boolean;
  tags: string[];
  /** 'webapp'(DB default) | 'ontology_pack' 등. STORE 는 webapp 만 노출. */
  item_type?: string | null;
}

interface CatalogCategory {
  key: string; // app.category 값
  label: string; // 표시명 (category_label || category)
  apps: CatalogApp[];
}

interface UseAppCatalogReturn {
  apps: CatalogApp[];
  byCategory: CatalogCategory[];
  featured: CatalogApp[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAppCatalog(): UseAppCatalogReturn {
  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    // app_catalog 는 자동생성 Database 타입에 아직 없는 테이블 — untyped from 으로 우회
    // (웹 useAppCatalog 와 동일. 결과는 아래에서 CatalogApp[] 로 cast).
    const untypedFrom = supabase.from.bind(supabase) as (
      table: string,
    ) => ReturnType<typeof supabase.from>;
    const { data, error: queryError } = await untypedFrom("app_catalog")
      .select(
        "id,name,url,description,icon_url,category,category_label,sort_order,is_featured,tags,item_type",
      )
      // 비활성 앱은 STORE 에서 숨김 (웹과 동일 — 운영자가 is_active 로 노출 제어)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setApps([]);
    } else {
      // webapp 이 아닌 항목(ontology_pack)·FACTOR 자체 URL 행은 STORE 에서 제외
      setApps(((data ?? []) as unknown as CatalogApp[]).filter(isStoreListable));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  // 카테고리별 그룹화 (category 기준, 표시명은 category_label fallback)
  const byCategory = useMemo<CatalogCategory[]>(() => {
    const map = new Map<string, CatalogCategory>();
    for (const app of apps) {
      const key = app.category;
      const label = app.category_label || app.category;
      if (!map.has(key)) {
        map.set(key, { key, label, apps: [] });
      }
      map.get(key)!.apps.push(app);
    }
    return Array.from(map.values());
  }, [apps]);

  const featured = useMemo(() => apps.filter((a) => a.is_featured), [apps]);

  return { apps, byCategory, featured, loading, error, refresh: fetchCatalog };
}
