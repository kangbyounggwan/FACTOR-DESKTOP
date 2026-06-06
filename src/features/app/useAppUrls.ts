/**
 * useAppUrls — "내 앱" 즐겨찾기 CRUD (로그인 계정별 격리).
 *
 * - 모든 저장/조회를 현재 로그인 user_id 스코프로 한다 → **다른 아이디로 로그인하면
 *   서로의 즐겨찾기가 안 보인다.** 로그인 상태 변화 시 자동으로 해당 계정 목록을 reload.
 * - Desktop: electron-store 의 appUrlsByUser[userId] (영속, OS appdata)
 * - Web: localStorage 키도 userId 로 스코프 (개발 편의)
 * - 비로그인: '_anon' 로컬 버킷 (계정 없는 디바이스 상태)
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isDesktop } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

const LS_PREFIX = "factor-mes:appUrls";
const ANON = "_anon";

function lsKey(userId: string): string {
  return `${LS_PREFIX}:${userId}`;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? ANON;
}

async function loadAll(userId: string): Promise<AppUrlEntry[]> {
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
  localStorage.setItem(lsKey(userId), JSON.stringify(list));
}

export function useAppUrls() {
  const [urls, setUrls] = useState<AppUrlEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>(ANON);

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
    loadAll(userId).then((list) => {
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
    [urls, userId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (isDesktop) {
        const next = await window.electron!.settings.appUrls.remove(userId, id);
        setUrls(next);
      } else {
        const next = urls.filter((u) => u.id !== id);
        await saveAllWeb(userId, next);
        setUrls(next);
      }
    },
    [urls, userId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<AppUrlEntry>) => {
      if (isDesktop) {
        const next = await window.electron!.settings.appUrls.update(userId, id, patch);
        setUrls(next);
      } else {
        const next = urls.map((u) => (u.id === id ? { ...u, ...patch } : u));
        await saveAllWeb(userId, next);
        setUrls(next);
      }
    },
    [urls, userId],
  );

  return { urls, loading, add, remove, update };
}
