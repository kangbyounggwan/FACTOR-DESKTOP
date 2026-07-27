/**
 * ChatWebView — 챗 화면에 붙는 단일 웹 렌더러 (Tier 2 Phase A).
 *
 * APP 탭의 멀티탭 `WebViewTabs` 와 달리, 챗 옆에서 "지금 보고 있는 한 페이지"를
 * 띄우는 단일 webview. 이 webview 의 ref 를 상위로 노출해 AI 웹제어(ref 스냅샷
 * → click/type)의 대상이 된다.
 *
 * 구성: 주소창 + 네비게이션(←/→/⟳) + 사내 시스템 바로가기 + webview 본체.
 * 세션은 APP 탭과 동일한 `persist:factor-apps` — 한쪽에서 로그인하면 양쪽 공유.
 *
 * Plan: planning-ai-web-agent/tier2-web-action-agent-plan.md §Phase A
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ArrowRight, RotateCw, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isDesktop } from "@desktop/lib/electron";

/** 사내 시스템 바로가기 — 1차 대상(사용자 결정: 사내 MES/EIS 전용) */
const SHORTCUTS: Array<{ label: string; url: string }> = [
  { label: "EIS 포털", url: "https://ep.iseohan.com/EIS/Main.aspx" },
  { label: "서한 MES", url: "https://smartops.seohan.com" },
];

const DEFAULT_URL = SHORTCUTS[0].url;

const WebviewTag = "webview" as unknown as React.FC<
  React.HTMLAttributes<HTMLElement> & {
    src?: string;
    partition?: string;
    webpreferences?: string;
    allowpopups?: string;
    ref?: React.Ref<HTMLElement>;
    style?: React.CSSProperties;
  }
>;

interface WebviewEl extends HTMLElement {
  getURL?: () => string;
  reload?: () => void;
  goBack?: () => void;
  goForward?: () => void;
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  loadURL?: (url: string) => Promise<void>;
}

export function ChatWebView({
  webviewRef,
  onClose,
  initialUrl,
}: {
  /** 상위(ChatPage)가 AI 제어에 쓰는 활성 webview ref */
  webviewRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  initialUrl?: string;
}) {
  // src 는 최초 1회만 — 이후 이동은 loadURL 로 (src 변경 시 webview 가 리마운트되어 세션이 끊김)
  const [src] = useState(initialUrl || DEFAULT_URL);
  const [addr, setAddr] = useState(initialUrl || DEFAULT_URL);
  const [loading, setLoading] = useState(false);
  const localRef = useRef<WebviewEl | null>(null);

  const attachRef = useCallback(
    (el: HTMLElement | null) => {
      localRef.current = el as WebviewEl | null;
      (webviewRef as React.MutableRefObject<HTMLElement | null>).current = el;
    },
    [webviewRef],
  );

  // 로딩/네비게이션 상태 → 주소창 동기화
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      const u = el.getURL?.();
      if (u) setAddr(u);
    };
    const onNav = () => {
      const u = el.getURL?.();
      if (u) setAddr(u);
    };
    el.addEventListener("did-start-loading", onStart);
    el.addEventListener("did-stop-loading", onStop);
    el.addEventListener("did-navigate", onNav);
    el.addEventListener("did-navigate-in-page", onNav);
    return () => {
      el.removeEventListener("did-start-loading", onStart);
      el.removeEventListener("did-stop-loading", onStop);
      el.removeEventListener("did-navigate", onNav);
      el.removeEventListener("did-navigate-in-page", onNav);
    };
  }, []);

  const go = useCallback((raw: string) => {
    const el = localRef.current;
    if (!el) return;
    let url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setAddr(url);
    // loadURL 은 리다이렉트/연속 네비게이션 시 ERR_ABORTED(-3) 로 reject 된다.
    // 정상 동작 중에도 발생하므로 삼켜야 한다 (미처리 시 unhandled rejection →
    // Sentry 에 에러로 보고됨. v0.0.111 에서 실제 발생).
    el.loadURL?.(url).catch(() => {
      /* ERR_ABORTED 등 네비게이션 취소 — 무시 */
    });
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* 툴바 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 flex-shrink-0">
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          title="뒤로" onClick={() => localRef.current?.goBack?.()}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          title="앞으로" onClick={() => localRef.current?.goForward?.()}
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          title="새로고침" onClick={() => localRef.current?.reload?.()}
        >
          <RotateCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>

        <form
          className="flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            go(addr);
          }}
        >
          <Input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            spellCheck={false}
            className="h-7 text-xs"
            placeholder="주소 입력 후 Enter"
          />
        </form>

        {onClose && (
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            title="웹 패널 닫기" onClick={onClose}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* 사내 시스템 바로가기 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border/40 flex-shrink-0">
        {SHORTCUTS.map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => go(s.url)}
            className="ui-micro px-2 py-0.5 rounded hover:text-foreground hover:bg-foreground/[0.06] transition-colors flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div>

      {/* 본체 */}
      <div className="flex-1 min-h-0 relative">
        {isDesktop ? (
          <WebviewTag
            ref={attachRef}
            src={src}
            partition="persist:factor-apps"
            webpreferences="contextIsolation=yes,nodeIntegration=no,allowRunningInsecureContent=no"
            allowpopups="true"
            style={{ width: "100%", height: "100%", display: "flex" }}
          />
        ) : (
          // 웹 빌드 fallback — Electron 이 아니면 webview 태그가 없다
          <iframe
            src={src}
            title="web"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        )}
      </div>
    </div>
  );
}
