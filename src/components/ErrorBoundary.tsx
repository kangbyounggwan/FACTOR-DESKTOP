/**
 * ErrorBoundary — 렌더 예외가 앱 전체를 백화면으로 만드는 것을 막는다.
 *
 * 배경(UX 감사 2026-07-22): 앱 전체에 ErrorBoundary 가 0개였다. 챗 카드·차트
 * 렌더 중 예외 1건이면 화면 전체가 하얗게 되고, 사용자는 앱을 재시작하는 것
 * 외에 복구 수단이 없었다.
 *
 * 정책:
 *  - 라우트 단위로 감싸 **해당 화면만** 대체 UI 로 바꾸고 셸(상단바/사이드바)은 살린다.
 *  - Sentry 가 이미 연결돼 있으므로(`lib/sentry-renderer.ts`) 예외를 리포트한다.
 *  - "다시 시도" 로 리마운트, "홈으로" 로 탈출 경로를 준다.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** 오류 화면에 표시할 영역 이름 (예: "채팅", "설정") */
  label?: string;
  /** 대체 UI 를 직접 지정하고 싶을 때 */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 메인 프로세스 로그(main.log)로도 흘러가도록 console.error 사용
    console.error("[ErrorBoundary]", this.props.label ?? "", error, info.componentStack);
    // Sentry 가 로드돼 있으면 리포트 (없어도 앱은 계속 동작)
    const sentry = (window as unknown as {
      Sentry?: { captureException?: (e: unknown, ctx?: unknown) => void };
    }).Sentry;
    sentry?.captureException?.(error, {
      tags: { boundary: this.props.label ?? "unknown" },
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const label = this.props.label ? `${this.props.label} 화면` : "화면";
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8">
        <div className="ui-panel max-w-md w-full p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <h2 className="ui-h3 mb-1.5">{label}을 표시하지 못했습니다</h2>
          <p className="ui-caption mb-4">
            일시적인 오류일 수 있습니다. 다시 시도해도 계속되면 앱을 재시작해 주세요.
          </p>
          <pre className="ui-fs-2xs text-left text-muted-foreground/70 bg-foreground/[0.03] rounded-md p-2.5 mb-4 overflow-x-auto whitespace-pre-wrap break-all max-h-24">
            {error.message || String(error)}
          </pre>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={this.reset} className="gap-1.5">
              <RotateCw className="h-3.5 w-3.5" />
              다시 시도
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                this.reset();
                window.location.hash = "#/chat";
              }}
            >
              <Home className="h-3.5 w-3.5" />
              홈으로
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
