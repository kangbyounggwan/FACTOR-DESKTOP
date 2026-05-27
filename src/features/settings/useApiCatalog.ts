/**
 * API Catalog react-query 훅 — Vercel ENV-style 설정 화면 데이터 흐름.
 *
 * 모든 훅은 useAuth().user.id 를 자동 주입. 비로그인 시 enabled=false 로
 * 쿼리 자체가 disable (라우터의 401 도 같이 막힘 — defense in depth).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import {
  type ApiCatalogEntry,
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

// ── Section 06 (2026-05-27) — optimistic toggle ───────────────────────
// onMutate 에서 list cache 를 미리 변경 → 토글 즉시 반영 (0ms).
// onError 시 snapshot 으로 rollback. onSettled 에서 background re-fetch.
// 핵심: cancelQueries 로 in-flight refetch 취소 → race 방지.
function applyPatch(
  entry: ApiCatalogEntry,
  patch: ApiPreferencePatch,
): Partial<ApiCatalogEntry> {
  const out: Partial<ApiCatalogEntry> = {};
  if (patch.enabled !== undefined) out.enabled = patch.enabled;
  if (patch.custom_label !== undefined)
    out.label = patch.custom_label ?? entry.label;
  if (patch.cost_tier_override !== undefined)
    out.cost_tier = patch.cost_tier_override ?? entry.cost_tier;
  if (patch.notes !== undefined) out.notes = patch.notes;
  return out;
}

export function usePatchPreference() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      methodName,
      patch,
    }: {
      methodName: string;
      patch: ApiPreferencePatch;
    }) => patchPreference(user!.id, methodName, patch),

    // 1) mutate 직전: in-flight refetch 취소 + cache 즉시 변경
    onMutate: async ({ methodName, patch }) => {
      await qc.cancelQueries({ queryKey: apiCatalogKeys.all });

      // 영향받는 모든 list cache snapshot + 즉시 새 상태 적용
      const snapshots: Array<
        [readonly unknown[], ApiCatalogListResponse | undefined]
      > = [];
      qc.getQueriesData<ApiCatalogListResponse>({
        queryKey: apiCatalogKeys.all,
      }).forEach(([key, data]) => {
        snapshots.push([key, data]);
        if (!data) return;
        qc.setQueryData<ApiCatalogListResponse>(key, {
          ...data,
          entries: data.entries.map((e) =>
            e.method_name === methodName
              ? { ...e, ...applyPatch(e, patch) }
              : e,
          ),
        });
      });
      return { snapshots };
    },

    // 2) 실패 시: snapshot 으로 rollback
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, prev]) => {
        qc.setQueryData(key, prev);
      });
    },

    // 3) 성공/실패 무관: background re-fetch (truth 동기화)
    onSettled: () => {
      qc.invalidateQueries({ queryKey: apiCatalogKeys.all });
    },
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
