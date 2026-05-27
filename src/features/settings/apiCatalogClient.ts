/**
 * llm-backend ─ API Catalog client (factor-desktop 설정 → API 연결).
 *
 * 모든 호출은 user_id 필수 — Supabase auth.uid() 를 query param 으로 전달.
 * 백엔드 router (llm-backend/app/routers/api_catalog.py) 는 user_id 없으면 401.
 *
 * Vercel ENV-style 행 = ApiCatalogEntry 한 개.
 */

import { supabase } from "@/lib/supabase";

const LLM_BACKEND_URL =
  import.meta.env.VITE_LLM_BACKEND_URL ?? "http://127.0.0.1:8000";

const BASE = `${LLM_BACKEND_URL}/api/chat/settings/api-catalog`;

// ── Section 07 (2026-05-27) — fetch timeout ──────────────────────────
const FETCH_TIMEOUT_MS = 8000;

// ── Section 04 (2026-05-27) — 401 handler ────────────────────────────
// 백엔드 라우터가 만료/누락 user_id 에 401 을 반환하면 자동으로 Supabase
// signOut + HashRouter /login redirect. 동시 다발 401 시 in-flight
// promise 로 중복 signOut 차단 (race safe).
let signOutInFlight: Promise<void> | null = null;

async function handle401(): Promise<void> {
  if (signOutInFlight) return signOutInFlight;
  signOutInFlight = (async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // signOut 실패해도 redirect 진행 — 토큰이 어쨌든 무효.
      console.warn("[apiCatalogClient] signOut failed", e);
    } finally {
      // HashRouter — file:// 프로토콜에서 BrowserRouter pushState 불가.
      window.location.hash = "#/login";
      // flag 는 5s 후 reset (페이지 전환되면 무의미하지만 safety net).
      setTimeout(() => {
        signOutInFlight = null;
      }, 5000);
    }
  })();
  return signOutInFlight;
}

export type ApiCatalogSource = "catalog" | "custom";
export type ApiCatalogScope = "account" | "company";

export interface ApiCatalogEntry {
  method_name: string;
  domain: string;
  label: string;
  description: string;
  cost_tier: string;
  enabled: boolean;
  is_read_only: boolean;
  is_working: boolean;
  source: ApiCatalogSource;
  notes: string | null;
  // api_catalog_cache.parameters 는 메서드마다 list[{name,type,required}] 또는
  // dict 형태로 저장됨 (서버에서 어느 쪽이든 통과). FE 표시 시에는 둘 다 대응.
  parameters: Record<string, unknown> | Array<Record<string, unknown>>;
  endpoint_url: string | null;
  has_secret: boolean;
  // custom 전용 (source==='catalog' 이면 모두 null/undefined)
  id: string | null;                    // custom row UUID — edit/delete path param
  scope: ApiCatalogScope | null;
  company_id: string | null;
  owner_user_id: string | null;         // 등록자 audit (다른 사람이 등록한 company 항목 표시용)
}

export interface ApiCatalogListResponse {
  entries: ApiCatalogEntry[];
  total: number;
  catalog_count: number;
  custom_count: number;
  domains: string[];
}

export interface ApiPreferencePatch {
  enabled?: boolean;
  custom_label?: string | null;
  cost_tier_override?: string | null;
  notes?: string | null;
}

export interface CustomApiCreate {
  method_name: string;
  domain?: string;
  korean_label: string;
  description_ko?: string;
  endpoint_url?: string | null;
  secret_value?: string | null;
  cost_tier?: string;
  enabled?: boolean;
  parameters?: Record<string, unknown>;
  notes?: string | null;
  scope?: ApiCatalogScope;            // default 'account'
}

// PATCH 는 method_name + scope 변경 불가 (백엔드가 drop).
export type CustomApiPatch = Partial<
  Omit<CustomApiCreate, "method_name" | "scope">
>;

interface ListParams {
  userId: string;
  domain?: string;
  search?: string;
}

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function call<T>(
  path: string,
  init: RequestInit,
  userId: string,
): Promise<T> {
  // 모든 호출에 user_id 강제. POST/PATCH/DELETE 도 query param 으로 (서버 Depends).
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}user_id=${encodeURIComponent(userId)}`;

  // ── Section 07 — timeout via AbortController ──
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    // AbortError → user-friendly timeout
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `서버 응답이 없습니다 (${FETCH_TIMEOUT_MS / 1000}초 초과) — 잠시 후 다시 시도해주세요`,
      );
    }
    // 네트워크 실패 (DNS / offline / CORS 등)
    if (err instanceof TypeError) {
      throw new Error("네트워크 연결을 확인해주세요");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // ── 401: 세션 만료 → signOut + /login redirect (Section 04) ──
  if (res.status === 401) {
    await handle401();
    throw new Error("Session expired — redirecting to login");
  }

  if (!res.ok) {
    // ── Section 09 — detail extract (FastAPI HTTPException + Pydantic ValidationError) ──
    const detail = await extractErrorDetail(res);
    const err = new Error(
      `${init.method ?? "GET"} ${path} failed (${res.status}): ${detail}`,
    ) as Error & { status?: number; detail?: string };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return (await res.json()) as T;
}

// ── Section 09 (2026-05-27) — error detail extraction + toast formatting ──
async function extractErrorDetail(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { detail?: unknown };
    const detail = json?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // Pydantic ValidationError: [{loc: [...], msg, type}]
      return detail
        .map((d: { loc?: unknown; msg?: string }) => {
          const loc = Array.isArray(d?.loc) ? d.loc.join(".") : "";
          const msg = d?.msg ?? "";
          return loc ? `${loc}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join(" / ");
    }
    if (detail) return JSON.stringify(detail);
    return text.slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}

export interface ApiErrorInfo {
  short: string; // 토스트용 (≤ 100자, truncate 시 … 부착)
  full: string; // 모달용 (전체)
  truncated: boolean;
}

export function formatErrorForToast(err: unknown): ApiErrorInfo {
  const detail =
    (err as { detail?: string })?.detail ??
    (err instanceof Error ? err.message : String(err));
  const truncated = detail.length > 100;
  return {
    short: truncated ? `${detail.slice(0, 100)}…` : detail,
    full: detail,
    truncated,
  };
}

export async function listApiCatalog(
  params: ListParams,
): Promise<ApiCatalogListResponse> {
  const path = qs({ domain: params.domain, search: params.search });
  return call<ApiCatalogListResponse>(path, { method: "GET" }, params.userId);
}

export async function patchPreference(
  userId: string,
  methodName: string,
  patch: ApiPreferencePatch,
): Promise<{ ok: boolean; method_name: string }> {
  return call(
    `/preferences/${encodeURIComponent(methodName)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    userId,
  );
}

export async function createCustomApi(
  userId: string,
  body: CustomApiCreate,
): Promise<{ ok: boolean; method_name: string }> {
  return call(
    "/custom",
    { method: "POST", body: JSON.stringify(body) },
    userId,
  );
}

export async function updateCustomApi(
  userId: string,
  customId: string,                  // user_custom_apis.id (UUID) — method_name 아님
  patch: CustomApiPatch,
): Promise<{ ok: boolean; method_name: string }> {
  return call(
    `/custom/${encodeURIComponent(customId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    userId,
  );
}

export async function deleteCustomApi(
  userId: string,
  customId: string,                  // user_custom_apis.id (UUID)
): Promise<{ ok: boolean; method_name: string }> {
  return call(
    `/custom/${encodeURIComponent(customId)}`,
    { method: "DELETE" },
    userId,
  );
}

export interface CustomInvokeResult {
  ok: boolean;
  status: number;
  latency_ms: number;
  content_type?: string | null;
  truncated?: boolean;
  data?: unknown;
  error?: string | null;
  body_preview?: string | null;
}

export async function invokeCustomApi(
  userId: string,
  customId: string,
  params: Record<string, string | number | boolean> = {},
): Promise<CustomInvokeResult> {
  return call<CustomInvokeResult>(
    `/custom/${encodeURIComponent(customId)}/invoke`,
    {
      method: "POST",
      body: JSON.stringify({ params }),
    },
    userId,
  );
}
