/**
 * useMyAdapterType — 로그인 사용자 회사의 MES 벤더(adapter_type) 해석.
 *
 * 하드코딩 'seohan' 대신 profiles.company_id → companies.mes_vendor 로 해석한다
 * (멀티테넌트: 고객사색은 회사 데이터에서, 코드/기본값은 중립). 미로그인/미해석 시
 * undefined — 소비 측은 값이 없으면 벤더 스코프 동작을 비활성화한다.
 */
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

// companies/profiles 는 타입드 Database 유니온 밖일 수 있어 untyped 로 좁혀 쓴다.
const sb = supabase as unknown as SupabaseClient;

async function fetchMyAdapterType(): Promise<string | null> {
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const { data: prof } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", uid)
    .maybeSingle();
  const companyId = (prof as { company_id: string | null } | null)?.company_id;
  if (!companyId) return null;

  const { data: company } = await sb
    .from("companies")
    .select("mes_vendor")
    .eq("id", companyId)
    .maybeSingle();
  return (company as { mes_vendor: string | null } | null)?.mes_vendor ?? null;
}

/** 회사 adapter_type(mes_vendor). data=null 이면 미해석(로그인/회사/벤더 미설정). */
export function useMyAdapterType() {
  return useQuery({
    queryKey: ["my-adapter-type"],
    queryFn: fetchMyAdapterType,
    staleTime: 5 * 60_000,
  });
}
