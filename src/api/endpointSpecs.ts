/**
 * factor-desktop API client — data-connector /api/endpoint-specs.
 *
 * adapter_endpoint_specs 의 실 HTTP 명세 (path/query/body/response) 조회 + 편집.
 * api_catalog_cache 의 method 메타와 join 되는 테이블.
 */
import {
  DATA_CONNECTOR_BASE_URL,
  dataConnectorRequest,
} from "@desktop/api/dataConnectorClient";

const ROOT = `${DATA_CONNECTOR_BASE_URL.replace(/\/$/, "")}/api/endpoint-specs`;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec {
  id: string;
  adapter_type: string;
  method_name: string;
  http_method: HttpMethod | string;
  path_template: string;
  query_params: Record<string, string>;
  body_template: Record<string, unknown> | null;
  response_path: string | null;
  parameter_schema: Record<string, unknown>;
  pagination: Record<string, unknown>;
  cache_policy: Record<string, unknown>;
  timeout_ms: number;
  is_read_only: boolean;
  enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface EndpointSpecListResponse {
  items: EndpointSpec[];
  total: number;
  adapter_types: string[];
}

const request = dataConnectorRequest;

export function listEndpointSpecs(params: {
  adapterType?: string;
  enabledOnly?: boolean;
  search?: string;
} = {}): Promise<EndpointSpecListResponse> {
  const q = new URLSearchParams();
  if (params.adapterType) q.set("adapter_type", params.adapterType);
  if (params.enabledOnly) q.set("enabled_only", "true");
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return request(`${ROOT}${qs ? `?${qs}` : ""}`);
}

// adapter_type 은 호출자가 회사에서 해석해 명시 전달 — 벤더 리터럴 기본값 없음(멀티테넌트).
export function toggleEndpointSpec(
  methodName: string,
  adapterType: string,
): Promise<EndpointSpec> {
  return request(
    `${ROOT}/${encodeURIComponent(methodName)}/toggle?adapter_type=${encodeURIComponent(adapterType)}`,
    { method: "POST" },
  );
}
