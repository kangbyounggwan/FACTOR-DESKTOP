/**
 * React Query hooks for adapter_endpoint_specs.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listEndpointSpecs,
  toggleEndpointSpec,
  updateEndpointSpec,
  type EndpointSpec,
  type EndpointSpecUpdate,
} from "@desktop/api/endpointSpecs";

const KEYS = {
  all: ["endpoint-specs"] as const,
  list: (params: { adapterType?: string; search?: string }) =>
    ["endpoint-specs", "list", params] as const,
};

export function useEndpointSpecsList(params: {
  adapterType?: string;
  search?: string;
} = {}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => listEndpointSpecs(params),
    staleTime: 30_000,
  });
}

// adapterType 은 회사에서 해석된 값(useMyAdapterType) 을 넘긴다. 미해석(undefined)이면
// 변경 뮤테이션은 실패시킨다 — 벤더 리터럴 폴백 없음(멀티테넌트).
export function useUpdateEndpointSpec(adapterType: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      methodName,
      patch,
    }: {
      methodName: string;
      patch: EndpointSpecUpdate;
    }) => {
      if (!adapterType) throw new Error("회사 adapter_type 미해석 — 로그인/회사 설정 확인");
      return updateEndpointSpec(methodName, patch, adapterType);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useToggleEndpointSpec(adapterType: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (methodName: string) => {
      if (!adapterType) throw new Error("회사 adapter_type 미해석 — 로그인/회사 설정 확인");
      return toggleEndpointSpec(methodName, adapterType);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export type { EndpointSpec };
