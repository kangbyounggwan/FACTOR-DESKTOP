/**
 * factor-desktop API client — data-connector /api/api-catalog 의 사용자 편집 CRUD.
 *
 * v1 (2026-05-28): list/get/update(PATCH)/reset.
 * llm-backend 의 /api/chat/api-catalog (사용자 enabled toggle / custom invoke)
 * 와는 별도 — 이쪽은 카탈로그 설명/도메인/tier 의 운영자 편집 전용.
 */
const BASE_URL =
  (import.meta.env.VITE_DATA_CONNECTOR_URL as string | undefined) ??
  "http://127.0.0.1:8001";

const ROOT = `${BASE_URL.replace(/\/$/, "")}/api/api-catalog`;

export type CostTier = "low" | "tier_a" | "tier_b" | "tier_c" | "high";
export type ModifiedKind = "manual" | "auto" | null;

export interface ApiCatalogEntry {
  method_name: string;
  domain: string;
  korean_label: string;
  description_ko: string;
  when_to_use: string;
  returns_summary: string;
  parameters: Array<{ name: string; type?: string; required?: boolean }> | Record<string, unknown>;
  example_question: string | null;
  cost_tier: CostTier | string;
  /** 마이그 045 — 메서드별 권장 폴링 주기(초). NULL = 폴링 부적절. */
  recommended_interval_sec: number | null;
  /** adapter_endpoint_specs JOIN — 실 HTTP 경로. spec 미시드된 메서드는 null. */
  http_method: string | null;
  path_template: string | null;
  is_working: boolean;
  is_read_only: boolean;
  is_curated: boolean;
  last_verified: string | null;
  last_modified_by: string | null;
  last_modified_kind: ModifiedKind;
  last_modified_note: string | null;
}

export interface ApiCatalogListResponse {
  items: ApiCatalogEntry[];
  total: number;
  domains: string[];
}

export interface ApiCatalogUpdate {
  korean_label?: string;
  description_ko?: string;
  when_to_use?: string;
  returns_summary?: string;
  example_question?: string;
  domain?: string;
  cost_tier?: CostTier;
  recommended_interval_sec?: number | null;
  is_curated?: boolean;
  note?: string;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    // body stream 은 한 번만 소비 가능. text() 로 받아 보고 JSON 시도 (반대 순서면
    // json() 이 fail 후 text() 가 'body stream already read' 로 또 fail).
    let detail = "";
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const j = JSON.parse(raw);
          detail =
            typeof j.detail === "string"
              ? j.detail
              : typeof j.message === "string"
                ? j.message
                : JSON.stringify(j);
        } catch {
          detail = raw;
        }
      }
    } catch {
      // body 읽기 실패 — statusText 만
    }
    throw new Error(`HTTP ${res.status}: ${detail || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listApiCatalog(params: {
  domain?: string;
  search?: string;
  onlyWorking?: boolean;
  onlyCurated?: boolean;
} = {}): Promise<ApiCatalogListResponse> {
  const q = new URLSearchParams();
  if (params.domain) q.set("domain", params.domain);
  if (params.search) q.set("search", params.search);
  if (params.onlyWorking) q.set("only_working", "true");
  if (params.onlyCurated) q.set("only_curated", "true");
  const qs = q.toString();
  return request(`${ROOT}${qs ? `?${qs}` : ""}`);
}

export function getApiCatalogEntry(methodName: string): Promise<ApiCatalogEntry> {
  return request(`${ROOT}/${encodeURIComponent(methodName)}`);
}

export function updateApiCatalogEntry(
  methodName: string,
  patch: ApiCatalogUpdate,
  user?: string,
): Promise<ApiCatalogEntry> {
  const qs = user ? `?user=${encodeURIComponent(user)}` : "";
  return request(`${ROOT}/${encodeURIComponent(methodName)}${qs}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function resetApiCatalogEntry(methodName: string): Promise<ApiCatalogEntry> {
  return request(`${ROOT}/${encodeURIComponent(methodName)}/reset`, {
    method: "POST",
  });
}
