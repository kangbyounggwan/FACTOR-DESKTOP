/**
 * data-connector(:8001) 공용 HTTP 클라이언트.
 *
 * apiCatalog.ts / endpointSpecs.ts 가 각자 복제해 갖고 있던 `request<T>()` 를
 * 하나로 합쳤다. 복제본 둘 다 같은 버그를 갖고 있었다 — 아래 §헤더 병합 참조.
 *
 * ── 왜 Authorization 을 붙이는가 ──────────────────────────────────────
 * data-connector 는 지금까지 인바운드 인증이 없었고, nginx 가 공개 도메인의
 * `/api/*` 를 이 서비스로 프록시한다. 그래서 인증(app/security/jwt_auth.py)을
 * 도입 중인데, 라우트에 강제를 걸려면 **클라이언트가 먼저 토큰을 보내고
 * 있어야 한다.** 순서가 뒤집히면 설정 화면이 통째로 죽는다.
 *
 * 지금 백엔드는 이 헤더를 요구하지 않는다 → **이 변경만으로는 동작이 바뀌지
 * 않는다.** 서버가 Depends(require_principal) 를 붙이는 순간 자연스럽게
 * 이어지도록 미리 깔아 두는 것이다.
 *
 * 세션이 없으면 헤더를 생략하고 그대로 보낸다(throw 하지 않는다).
 * 지금 막으면 인증이 강제되기도 전에 화면이 먼저 깨진다 — 서버가 거절할
 * 준비가 됐을 때 서버가 거절하게 둔다.
 */
import { supabase } from "@/lib/supabase";

export const DATA_CONNECTOR_BASE_URL =
  (import.meta.env.VITE_DATA_CONNECTOR_URL as string | undefined) ??
  "http://127.0.0.1:8001";

/** supabase 세션이 있으면 Bearer 헤더, 없으면 빈 객체. 절대 throw 하지 않는다. */
export async function dataConnectorAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // 세션 조회 실패는 인증 실패와 다르다. 요청 자체를 막지 않는다.
    return {};
  }
}

export class DataConnectorError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DataConnectorError";
    this.status = status;
  }
}

export async function dataConnectorRequest<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const auth = await dataConnectorAuthHeader();

  // ── 헤더 병합 순서 ──
  // 이전 복제본들은 `{ headers: {...}, ...init }` 이었다. spread 가 뒤에 와서
  // init.headers 가 **headers 전체를 통째로 덮어썼고**, 호출부가 헤더를 하나만
  // 넘겨도 Content-Type 이 사라졌다. init 을 먼저 펼치고 headers 를 마지막에
  // 조립해야 한다.
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    // body stream 은 한 번만 소비 가능. text() 로 받아 보고 JSON 시도
    // (반대 순서면 json() 이 fail 후 text() 가 'body stream already read' 로 또 fail).
    let detail = "";
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const j = JSON.parse(raw);
          detail = typeof j?.detail === "string" ? j.detail : raw;
        } catch {
          detail = raw;
        }
      }
    } catch {
      /* 본문 없음 */
    }
    if (res.status === 401 || res.status === 403) {
      throw new DataConnectorError(
        res.status,
        detail || "로그인이 필요하거나 권한이 없습니다.",
      );
    }
    if (res.status === 503) {
      throw new DataConnectorError(
        503,
        detail || "인증 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    // 일반 오류는 기존 복제본과 같은 메시지 형식을 유지한다 — 호출부/토스트가
    // 이 문자열을 그대로 쓰고 있어 형식을 바꾸면 표시가 달라진다.
    throw new DataConnectorError(
      res.status,
      `HTTP ${res.status}: ${detail || res.statusText}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
