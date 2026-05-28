/**
 * React Query hooks for data_schedules CRUD.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDataSchedule,
  deleteDataSchedule,
  listDataSchedules,
  resetCircuit,
  toggleDataSchedule,
  updateDataSchedule,
  type DataSchedule,
  type DataScheduleCreate,
  type DataScheduleUpdate,
} from "@desktop/api/dataSchedules";

const KEYS = {
  all: ["data-schedules"] as const,
  list: (companyId?: string) =>
    ["data-schedules", "list", companyId ?? "*"] as const,
};

export function useDataSchedulesList(companyId?: string) {
  return useQuery({
    queryKey: KEYS.list(companyId),
    queryFn: () => listDataSchedules({ companyId }),
    refetchInterval: 30_000, // 30s — last_run_at / status 모니터링용
    staleTime: 10_000,
  });
}

export function useCreateDataSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DataScheduleCreate) => createDataSchedule(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateDataSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DataScheduleUpdate }) =>
      updateDataSchedule(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteDataSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDataSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useToggleDataSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleDataSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useResetCircuit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resetCircuit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export type { DataSchedule };
