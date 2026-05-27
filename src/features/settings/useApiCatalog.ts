/**
 * API Catalog react-query 훅 — Vercel ENV-style 설정 화면 데이터 흐름.
 *
 * 모든 훅은 useAuth().user.id 를 자동 주입. 비로그인 시 enabled=false 로
 * 쿼리 자체가 disable (라우터의 401 도 같이 막힘 — defense in depth).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import {
  type ApiCatalogListResponse,
  type ApiPreferencePatch,
  type CustomApiCreate,
  type CustomApiPatch,
  createCustomApi,
  deleteCustomApi,
  invokeCustomApi,
  listApiCatalog,
  patchPreference,
  updateCustomApi,
} from "./apiCatalogClient";

export const apiCatalogKeys = {
  all: ["apiCatalog"] as const,
  list: (userId: string, domain?: string, search?: string) =>
    [...apiCatalogKeys.all, "list", userId, domain ?? "", search ?? ""] as const,
};

interface UseApiCatalogParams {
  domain?: string;
  search?: string;
}

export function useApiCatalogList({ domain, search }: UseApiCatalogParams = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery<ApiCatalogListResponse>({
    queryKey: apiCatalogKeys.list(userId, domain, search),
    queryFn: () => listApiCatalog({ userId, domain, search }),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

function useInvalidateCatalog() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: apiCatalogKeys.all });
}

export function usePatchPreference() {
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({
      methodName,
      patch,
    }: {
      methodName: string;
      patch: ApiPreferencePatch;
    }) => patchPreference(user!.id, methodName, patch),
    onSuccess: invalidate,
  });
}

export function useCreateCustomApi() {
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: CustomApiCreate) => createCustomApi(user!.id, body),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomApi() {
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({
      customId,
      patch,
    }: {
      customId: string;            // user_custom_apis.id (UUID)
      patch: CustomApiPatch;
    }) => updateCustomApi(user!.id, customId, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomApi() {
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (customId: string) =>     // user_custom_apis.id (UUID)
      deleteCustomApi(user!.id, customId),
    onSuccess: invalidate,
  });
}

export function useInvokeCustomApi() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      customId,
      params,
    }: {
      customId: string;
      params?: Record<string, string | number | boolean>;
    }) => invokeCustomApi(user!.id, customId, params ?? {}),
  });
}
