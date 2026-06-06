/**
 * OntologyWebView — S4: 설치된 팩을 app:// 뷰어로 여는 webview (데스크탑 전용).
 *
 * S1 의 app:// custom protocol + host-lock partition(persist:factor-ontology) 위에서 동작.
 * 뷰어는 ?pack=<adapter> 로 자족적으로 app://packs/<adapter>.json 을 fetch (host IPC 없음).
 *
 * ⚠️ R5: FE 공유 컴포넌트 WebViewFrame 을 수정하거나 app:// 분기 prop 을 넣지 않는다.
 *    이 컴포넌트는 desktop 소유의 app:// 전용 별도 webview.
 */
import { isDesktop } from "@desktop/lib/electron";

interface Props {
  adapterType: string;
  /** 로그인 user_id — 설치 디렉터리 격리 키. 뷰어가 app://packs/<scope>/<adapter>.json 을 읽음. */
  userId: string | null;
}

/** ontology_packs.ts(main)/settings.ts 의 userKey 와 동일 규칙이어야 함. */
function userScopeKey(userId: string | null): string {
  const k = String(userId ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);
  return k || "_anon";
}

export function OntologyWebView({ adapterType, userId }: Props) {
  if (!isDesktop) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
        온톨로지 뷰어는 데스크탑 클라이언트에서만 사용할 수 있습니다.
      </div>
    );
  }

  // <webview> 는 JSX intrinsic 이 없어 createElement 우회 (WebViewFrame 과 동일 패턴)
  const WebviewTag = "webview" as unknown as React.FC<
    React.HTMLAttributes<HTMLElement> & {
      src?: string;
      partition?: string;
      webpreferences?: string;
    }
  >;

  const scope = userScopeKey(userId);
  const src =
    `app://ontology/viewer.html?pack=${encodeURIComponent(adapterType)}` +
    `&scope=${encodeURIComponent(scope)}`;

  return (
    <WebviewTag
      src={src}
      style={{ width: "100%", height: "100%", display: "flex" }}
      partition="persist:factor-ontology"
      webpreferences="contextIsolation=yes,nodeIntegration=no,allowRunningInsecureContent=no"
    />
  );
}
