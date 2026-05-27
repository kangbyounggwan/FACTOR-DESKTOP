/**
 * useAppCatalog — Supabase `app_catalog` 테이블에서 추천 앱 목록 fetch.
 *
 * 데이터 소스: supabase/migrations/033_create_app_catalog.sql
 * 운영자가 콘솔에서 직접 갱신 — 배포 없이 카탈로그 변경 가능.
 *
 * 사용:
 *   const { apps, byCategory, loading, error, refresh } = useAppCatalog();
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
}

export interface CatalogCategory {
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
    const { data, error: queryError } = await supabase
      .from("app_catalog")
      // @ts-expect-error — app_catalog 는 신규 테이블, 자동생성 Database 타입에 아직 없음
      .select(
        "id,name,url,description,icon_url,category,category_label,sort_order,is_featured,tags",
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setApps([]);
    } else {
      setApps((data ?? []) as unknown as CatalogApp[]);
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
