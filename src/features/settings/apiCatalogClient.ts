/**
 * llm-backend ─ API Catalog client (factor-desktop 설정 → API 연결).
 *
 * 모든 호출은 user_id 필수 — Supabase auth.uid() 를 query param 으로 전달.
 * 백엔드 router (llm-backend/app/routers/api_catalog.py) 는 user_id 없으면 401.
 *
 * Vercel ENV-style 행 = ApiCatalogEntry 한 개.
 */

const LLM_BACKEND_URL =
  import.meta.env.VITE_LLM_BACKEND_URL ?? "http://127.0.0.1:8000";

const BASE = `${LLM_BACKEND_URL}/api/chat/settings/api-catalog`;

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
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `${init.method ?? "GET"} ${path} failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
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
