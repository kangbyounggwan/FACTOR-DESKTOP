/**
 * useAppUrls — 등록된 외부 URL 목록 CRUD.
 *
 * - Desktop: electron-store (영속, OS appdata)
 * - Web: localStorage fallback (개발 편의)
 */

import { useEffect, useState, useCallback } from "react";
import { isDesktop } from "@desktop/lib/electron";
import type { AppUrlEntry } from "@desktop/types/electron";

const LS_KEY = "factor-mes:appUrls";

async function loadAll(): Promise<AppUrlEntry[]> {
  if (isDesktop) {
    return (await window.electron!.settings.get("appUrls")) ?? [];
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as AppUrlEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(list: AppUrlEntry[]): Promise<void> {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function useAppUrls() {
  const [urls, setUrls] = useState<AppUrlEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAll().then((list) => {
      if (!cancelled) {
        setUrls(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        const next = await window.electron!.settings.appUrls.add(entry);
        setUrls(next);
      } else {
        const next = [...urls, entry];
        await saveAll(next);
        setUrls(next);
      }
      return entry;
    },
    [urls],
  );

  const remove = useCallback(async (id: string) => {
    if (isDesktop) {
      const next = await window.electron!.settings.appUrls.remove(id);
      setUrls(next);
    } else {
      const next = urls.filter((u) => u.id !== id);
      await saveAll(next);
      setUrls(next);
    }
  }, [urls]);

  const update = useCallback(async (id: string, patch: Partial<AppUrlEntry>) => {
    if (isDesktop) {
      const next = await window.electron!.settings.appUrls.update(id, patch);
      setUrls(next);
    } else {
      const next = urls.map((u) => (u.id === id ? { ...u, ...patch } : u));
      await saveAll(next);
      setUrls(next);
    }
  }, [urls]);

  return { urls, loading, add, remove, update };
}
