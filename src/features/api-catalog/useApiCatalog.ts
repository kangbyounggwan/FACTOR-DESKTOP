/**
 * React Query hooks for api_catalog_cache 사용자 편집.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listApiCatalog,
  resetApiCatalogEntry,
  updateApiCatalogEntry,
  type ApiCatalogEntry,
  type ApiCatalogUpdate,
} from "@desktop/api/apiCatalog";

const KEYS = {
  all: ["api-catalog"] as const,
  list: (params: { domain?: string; search?: string; onlyCurated?: boolean }) =>
    ["api-catalog", "list", params] as const,
};

export function useApiCatalogList(params: {
  domain?: string;
  search?: string;
  onlyCurated?: boolean;
} = {}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => listApiCatalog(params),
    staleTime: 30_000,
  });
}

export function useUpdateApiCatalog(user?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ methodName, patch }: { methodName: string; patch: ApiCatalogUpdate }) =>
      updateApiCatalogEntry(methodName, patch, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useResetApiCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (methodName: string) => resetApiCatalogEntry(methodName),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export type { ApiCatalogEntry };
