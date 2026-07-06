/**
 * useAppUrls — "내 앱" 즐겨찾기 CRUD (로그인 계정별 격리 + DB 동기화).
 *
 * 저장소 (마이그 064 — 웹 FE anomaly-eye-monitor useAppUrls 와 동일 패턴):
 * - 로그인 사용자 → supabase `user_app_favorites` (RLS user_id=auth.uid(),
 *   세션 JWT 로 직접 CRUD) — **웹/데스크탑/기기 간 동기화**.
 *   최초 로드 시 DB 가 비어 있고 같은 계정의 로컬 버킷(electron-store)이 있으면
 *   1회 이관 후 로컬 버킷 비움. DB 조회 실패 시 로컬로 degrade
 *   (오프라인/장애에도 APP 탭 동작 유지, 다음 마운트 때 DB 재시도).
 * - 비로그인(_anon) → 종전대로 로컬만 (Desktop: electron-store 의
 *   appUrlsByUser[_anon], Web dev: localStorage) — 계정 없는 디바이스 상태.
 *
 * 반환 계약 { urls, loading, add, remove, update } 은 종전과 동일.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isDesktop } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

const LS_PREFIX = "factor-mes:appUrls";
const ANON = "_anon";
const TABLE = "user_app_favorites";

// user_app_favorites 는 자동생성 Database 타입에 없는 신규 테이블 —
// untyped from 으로 우회 (행은 아래 rowToEntry 로 명시 매핑).
const untypedFrom = supabase.from.bind(supabase) as (
  table: string,
) => ReturnType<typeof supabase.from>;

interface FavoriteRow {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  description: string | null;
  added_at: string;
}

function rowToEntry(r: FavoriteRow): AppUrlEntry {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    addedAt: Date.parse(r.added_at) || Date.now(),
    ...(r.icon_url ? { iconUrl: r.icon_url } : {}),
    ...(r.description ? { description: r.description } : {}),
  };
}

function lsKey(userId: string): string {
  return `${LS_PREFIX}:${userId}`;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? ANON;
}

// ── 로컬 저장 (Desktop: electron-store IPC / Web dev: localStorage) ──────

async function loadLocal(userId: string): Promise<AppUrlEntry[]> {
  if (isDesktop) {
    return (await window.electron!.settings.appUrls.list(userId)) ?? [];
  }
  try {
    const raw = localStorage.getItem(lsKey(userId));
    return raw ? (JSON.parse(raw) as AppUrlEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveAllWeb(userId: string, list: AppUrlEntry[]): Promise<void> {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify(list));
  } catch {
    /* quota 초과 등 — 메모리 상태는 유지되므로 무음 */
  }
}

/** 이관 성공 후 로컬 버킷 비우기 (재이관으로 인한 중복 방지). */
async function clearLocal(userId: string, list: AppUrlEntry[]): Promise<void> {
  if (isDesktop) {
    for (const e of list) {
      await window.electron!.settings.appUrls.remove(userId, e.id);
    }
    return;
  }
  try {
    localStorage.removeItem(lsKey(userId));
  } catch {
    /* ignore */
  }
}

// ── DB 저장 (user_app_favorites) ─────────────────────────────────────────

async function loadFromDb(userId: string): Promise<AppUrlEntry[]> {
  const { data, error } = await untypedFrom(TABLE)
    .select("id,name,url,icon_url,description,added_at")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as FavoriteRow[]).map(rowToEntry);
}

/** DB 비어 있고 로컬 버킷이 있으면 1회 이관 (성공 시 로컬 버킷 비움). */
async function migrateLocalToDb(
  userId: string,
  local: AppUrlEntry[],
): Promise<void> {
  if (local.length === 0) return;
  const rows = local.map((e) => ({
    user_id: userId,
    name: e.name,
    url: e.url,
    icon_url: e.iconUrl ?? null,
    description: e.description ?? null,
    added_at: new Date(e.addedAt || Date.now()).toISOString(),
  }));
  const { error } = await untypedFrom(TABLE).insert(rows);
  if (error) throw error;
  await clearLocal(userId, local);
}

export function useAppUrls() {
  const [urls, setUrls] = useState<AppUrlEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>(ANON);
  // DB 접근이 실패한 세션은 로컬 모드로 degrade (다음 마운트 때 재시도)
  const [dbBroken, setDbBroken] = useState(false);

  const useDb = userId !== ANON && !dbBroken;

  // 로그인 사용자 추적 — 로그인/로그아웃/계정전환 시 userId 갱신 → 목록 reload 트리거.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const uid = await currentUserId();
      if (!cancelled) setUserId(uid);
    };
    void sync();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void sync();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // userId 가 바뀌면 그 계정의 목록만 로드 (이전 계정 데이터는 화면에서 사라짐).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = async (): Promise<AppUrlEntry[]> => {
      if (userId === ANON) {
        return loadLocal(userId);
      }
      try {
        let list = await loadFromDb(userId);
        if (list.length === 0) {
          const local = await loadLocal(userId);
          if (local.length > 0) {
            await migrateLocalToDb(userId, local);
            list = await loadFromDb(userId);
          }
        }
        return list;
      } catch {
        // DB 장애/미적용 — 로컬로 degrade (기능은 유지, 동기화만 없음)
        if (!cancelled) setDbBroken(true);
        return loadLocal(userId);
      }
    };
    void run().then((list) => {
      if (!cancelled) {
        setUrls(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const add = useCallback(
    async (
      name: string,
      url: string,
      extra?: { iconUrl?: string; description?: string },
    ) => {
      if (useDb) {
        const { data, error } = await untypedFrom(TABLE)
          .insert({
            user_id: userId,
            name: name.trim(),
            url: url.trim(),
            icon_url: extra?.iconUrl ?? null,
            description: extra?.description ?? null,
          })
          .select("id,name,url,icon_url,description,added_at")
          .single();
        if (error) throw error;
        const entry = rowToEntry(data as unknown as FavoriteRow);
        setUrls((prev) => [...prev, entry]);
        return entry;
      }
      const entry: AppUrlEntry = {
        id: crypto.randomUUID(),
        name: name.trim(),
        url: url.trim(),
        addedAt: Date.now(),
        ...(extra?.iconUrl ? { iconUrl: extra.iconUrl } : {}),
        ...(extra?.description ? { description: extra.description } : {}),
      };
      if (isDesktop) {
        const next = await window.electron!.settings.appUrls.add(userId, entry);
        setUrls(next);
      } else {
        const next = [...urls, entry];
        await saveAllWeb(userId, next);
        setUrls(next);
      }
      return entry;
    },
    [useDb, urls, userId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (useDb) {
        const { error } = await untypedFrom(TABLE)
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw error;
        setUrls((prev) => prev.filter((u) => u.id !== id));
        return;
      }
      if (isDesktop) {
        const next = await window.electron!.settings.appUrls.remove(userId, id);
        setUrls(next);
      } else {
        const next = urls.filter((u) => u.id !== id);
        await saveAllWeb(userId, next);
        setUrls(next);
      }
    },
    [useDb, urls, userId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<AppUrlEntry>) => {
      if (useDb) {
        const dbPatch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.url !== undefined) dbPatch.url = patch.url;
        if (patch.iconUrl !== undefined) dbPatch.icon_url = patch.iconUrl ?? null;
        if (patch.description !== undefined)
          dbPatch.description = patch.description ?? null;
        const { error } = await untypedFrom(TABLE)
          .update(dbPatch)
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw error;
        setUrls((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
        return;
      }
      if (isDesktop) {
        const next = await window.electron!.settings.appUrls.update(userId, id, patch);
        setUrls(next);
      } else {
        const next = urls.map((u) => (u.id === id ? { ...u, ...patch } : u));
        await saveAllWeb(userId, next);
        setUrls(next);
      }
    },
    [useDb, urls, userId],
  );

  return { urls, loading, add, remove, update };
}
