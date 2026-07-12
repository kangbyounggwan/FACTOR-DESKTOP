/**
 * app_probe.ts — 앱 "실행 가능(백단 이관/준비)" 여부 probe (main process).
 *
 * AppDetailView 의 CTA 를 "지금 열기 vs 다운로드" 로 가르는 근거:
 *  - 외부 URL 앱(우리 백엔드 아님) → gated=false → 항상 "지금 열기".
 *  - FACTOR 백엔드 앱(factor.io.kr) → 백엔드 로직이 준비돼야 실행 가능.
 *      준비됨(probe 2xx/인증필요) → ready=true → "지금 열기"
 *      미준비(404/5xx/네트워크)   → ready=false → "다운로드"(백단 이관 필요)
 *
 * renderer 가 아니라 main 에서 fetch — app:// / localhost origin 의 CORS 회피.
 */
import { ipcMain } from 'electron';

const API_BASE = 'https://api.factor.io.kr';
const TIMEOUT_MS = 8000;

/** GET 후 준비로 간주할 상태: 200(정상) · 401/403(백엔드 존재, 인증만 필요). 그 외/에러=미준비. */
async function probe(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
    return res.status === 200 || res.status === 401 || res.status === 403;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

interface AppReadiness {
  /** 이 앱이 백엔드 준비-게이트 대상인가(FACTOR 백엔드 앱). false=외부앱(게이트 없음). */
  gated: boolean;
  /** gated 일 때 백엔드가 실행 가능한 상태인가. */
  ready: boolean;
}

function isFactorHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'factor.io.kr' || h.endsWith('.factor.io.kr');
}

async function handleProbeReady(rawUrl: unknown): Promise<AppReadiness> {
  if (typeof rawUrl !== 'string') return { gated: false, ready: true };
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { gated: false, ready: true };
  }
  if (!isFactorHost(u.hostname)) return { gated: false, ready: true }; // 외부 앱 = 게이트 없음

  // ── FACTOR 백엔드 앱: 앱별 준비 endpoint probe ──
  // 리포트 앱: FE(리포트 페이지)가 의존하는 백엔드 로직이 살아있어야 실행 가능.
  //   FE 가 report-service(/api/reports/v1)로 repoint 됨(anomaly PR #5 머지) → probe 도 그쪽.
  //   /templates 는 무인증 200 → 200이면 준비(지금열기), 404/미배포면 다운로드.
  if (u.pathname.startsWith('/reports')) {
    return { gated: true, ready: await probe(`${API_BASE}/api/reports/v1/templates`) };
  }

  // 기타 FACTOR 앱: 페이지 자체 도달성으로 준비 판정(기본).
  return { gated: true, ready: await probe(u.href) };
}

export function registerAppProbeIpc(): void {
  ipcMain.handle('app:probeReady', (_e, url: string) => handleProbeReady(url));
}
