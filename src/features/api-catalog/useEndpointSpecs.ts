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

export function useUpdateEndpointSpec(adapterType = "seohan") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      methodName,
      patch,
    }: {
      methodName: string;
      patch: EndpointSpecUpdate;
    }) => updateEndpointSpec(methodName, patch, adapterType),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useToggleEndpointSpec(adapterType = "seohan") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (methodName: string) => toggleEndpointSpec(methodName, adapterType),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export type { EndpointSpec };
