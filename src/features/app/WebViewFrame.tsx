/**
 * WebViewFrame — Electron <webview> 또는 웹 iframe fallback.
 *
 * Electron에서는 <webview> 태그(별도 프로세스)로 임베드, 웹 빌드에서는 iframe + sandbox.
 * forwardRef로 부모가 reload()/goBack() 등 webview 메서드 호출 가능.
 */

import { forwardRef } from "react";
import { isDesktop } from "@desktop/lib/electron";

interface Props {
  url: string;
}

export const WebViewFrame = forwardRef<HTMLElement, Props>(({ url }, ref) => {
  if (!isDesktop) {
    return <IframeFallback url={url} />;
  }

  // <webview>는 JSX intrinsic이 없어 createElement 우회
  const WebviewTag = "webview" as unknown as React.FC<
    React.HTMLAttributes<HTMLElement> & {
      src?: string;
      partition?: string;
      webpreferences?: string;
      ref?: React.Ref<HTMLElement>;
    }
  >;

  return (
    <WebviewTag
      ref={ref}
      src={url}
      style={{ width: "100%", height: "100%", display: "flex" }}
      partition="persist:factor-apps"
      webpreferences="contextIsolation=yes,nodeIntegration=no,allowRunningInsecureContent=no"
      allowpopups="true"
    />
  );
});
WebViewFrame.displayName = "WebViewFrame";

function IframeFallback({ url }: { url: string }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-[11px] text-amber-300">
        웹 빌드에서는 <code>&lt;iframe&gt;</code>으로 표시합니다. 사이트가 임베드를 차단할 수 있어요.
      </div>
      <iframe
        src={url}
        className="flex-1 w-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        title="external"
      />
    </div>
  );
}
