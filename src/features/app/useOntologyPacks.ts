/**
 * useOntologyPacks — S4: 온톨로지 플러그인 install 상태 hook (데스크탑 전용).
 *
 * - available: 레지스트리(S3)가 테넌트 필터한 설치 가능 어댑터.
 * - installed: 로컬(%APPDATA%/.../packs)에 이미 설치된 팩.
 * - install(adapter): 다운로드+검증+저장 (이관 동의 후 호출). 성공 시 refresh.
 *
 * 신원: FE supabase 세션의 user_id 를 IPC 에 전달(main 이 ?user_id= 로 S3 호출).
 * 웹 fallback 없음(R: 데스크탑 전용) — supported=false 면 UI 가 안내로 대체.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isDesktop } from "@desktop/lib/electron";
import type {
  InstalledOntologyPack,
  OntologyAdapter,
} from "@desktop/types/electron";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

interface UseOntologyPacks {
  available: OntologyAdapter[];
  installed: InstalledOntologyPack[];
  installedSet: Set<string>;
  loading: boolean;
  error: string | null;
  /** 현재 로그인 user_id (뷰어 scope·격리 키). 비로그인 시 null. */
  userId: string | null;
  /** 데스크탑 + ontology bridge 사용 가능 여부 */
  supported: boolean;
  refresh: () => Promise<void>;
  install: (adapterType: string) => Promise<void>;
}

export function useOntologyPacks(): UseOntologyPacks {
  const [available, setAvailable] = useState<OntologyAdapter[]>([]);
  const [installed, setInstalled] = useState<InstalledOntologyPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const supported = isDesktop && !!window.electron?.ontology;

  const refresh = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    setError(null);
    try {
      const uid = await currentUserId();
      setUserId(uid);
      if (!uid) {
        setError("로그인이 필요합니다.");
        setAvailable([]);
        setInstalled([]);
        return;
      }
      // 설치 목록은 로그인 계정(uid) 디렉터리에서만 — 다른 아이디 것과 격리.
      const [av, inst] = await Promise.all([
        window.electron!.ontology!.available(uid),
        window.electron!.ontology!.listInstalled(uid),
      ]);
      setAvailable(av);
      setInstalled(inst);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const install = useCallback(
    async (adapterType: string) => {
      if (!supported) throw new Error("데스크탑 클라이언트 전용 기능입니다.");
      const uid = await currentUserId();
      if (!uid) throw new Error("로그인이 필요합니다.");
      await window.electron!.ontology!.install(adapterType, uid);
      await refresh();
    },
    [supported, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installedSet = useMemo(
    () => new Set(installed.map((p) => p.adapter_type)),
    [installed],
  );

  return {
    available,
    installed,
    installedSet,
    loading,
    error,
    userId,
    supported,
    refresh,
    install,
  };
}
