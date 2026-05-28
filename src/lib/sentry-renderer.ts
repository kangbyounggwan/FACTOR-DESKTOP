/**
 * Section 03 (2026-05-27) — Sentry renderer process bootstrap.
 *
 * @sentry/electron v7+ — renderer init. main 의 DSN 을 inherit 하는 것이
 * 일반 패턴이지만, 명시적 dsn 전달도 가능 (test / 별도 프로젝트 시).
 *
 * Vite 가 import.meta.env.VITE_SENTRY_DSN 을 빌드 시 inline 처리. .env 에
 * VITE_SENTRY_DSN= 있으면 자동 적용. 없으면 fallback DSN 사용 (main 과 동일).
 */

import * as Sentry from '@sentry/electron/renderer';

// public-safe DSN — main 의 DEFAULT_DSN 과 동일 (Sentry project key).
const DEFAULT_DSN =
  'https://b7e4e21a5ea223ae4e1d7e64fed980fd@o4511462391283712.ingest.us.sentry.io/4511462397181952';

export function setupSentryRenderer() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || DEFAULT_DSN;

  if (!dsn) return;

  Sentry.init({
    dsn,
    // main 과 같은 sample rate (별도 설정 가능).
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = maskSecretsInUrl(event.request.url);
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete (event.user as Record<string, unknown>).username;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data && typeof breadcrumb.data === "object") {
        const data = breadcrumb.data as Record<string, unknown>;
        if (typeof data.url === "string") {
          data.url = maskSecretsInUrl(data.url);
        }
      }
      return breadcrumb;
    },
  });
}

function maskSecretsInUrl(url: string): string {
  return url.replace(
    /([?&](user_id|token|secret[^=]*|password|apikey|access_token|refresh_token)=)[^&]+/gi,
    "$1[REDACTED]",
  );
}
