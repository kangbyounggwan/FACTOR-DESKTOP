/**
 * useAppRunnable — 앱의 "실행 가능(백단 이관/준비)" 여부 판정 hook.
 *
 * main 프로세스 probe(app:probeReady)를 호출해 AppDetailView 의 CTA 를 결정:
 *  - runnable === undefined → 게이트 없음(외부 URL 앱) → 항상 "지금 열기"
 *  - runnable === true      → FACTOR 백엔드 앱 + 준비됨 → "지금 열기"
 *  - runnable === false     → FACTOR 백엔드 앱 + 미준비 → "다운로드"(백단 이관 필요)
 *
 * 웹 빌드/비데스크탑: probe 불가 → runnable=undefined(게이트 없음)로 degrade.
 */
import { useCallback, useEffect, useState } from "react";
import { isDesktop } from "@desktop/lib/electron";

export interface UseAppRunnable {
  /** undefined=게이트없음(항상 열기), true=준비됨(열기), false=미준비(다운로드). */
  runnable: boolean | undefined;
  /** probe 진행 중. */
  checking: boolean;
  /** 다시 판정(다운로드 클릭 후 백엔드 준비됐는지 재확인). */
  recheck: () => void;
}

export function useAppRunnable(url: string | null | undefined): UseAppRunnable {
  const [runnable, setRunnable] = useState<boolean | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [nonce, setNonce] = useState(0);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url || !isDesktop || !window.electron?.app?.probeReady) {
      setRunnable(undefined);
      setChecking(false);
      return;
    }
    let alive = true;
    setChecking(true);
    window.electron.app
      .probeReady(url)
      .then((r) => {
        if (alive) setRunnable(r.gated ? r.ready : undefined);
      })
      .catch(() => {
        if (alive) setRunnable(undefined); // probe 실패 = 게이트 없이 통과(기존 동작 보존)
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  return { runnable, checking, recheck };
}
