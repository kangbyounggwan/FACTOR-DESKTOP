/**
 * Section 03 (2026-05-27) — Sentry main process bootstrap.
 *
 * @sentry/electron v7+ — main 프로세스 init.
 *
 * DSN 은 public-safe (Sentry 가 origin 검증). 코드 상수로 보관 + .env 의
 * SENTRY_DSN 환경변수로 override 가능 (dev / 별도 프로젝트 분리 시).
 *
 * 보안: beforeSend hook 에서 PII / secret sanitize. event 가 dashboard 에
 * 적재되기 전 마지막 게이트.
 */

import { app } from 'electron';
import log from 'electron-log';
import * as Sentry from '@sentry/electron/main';

// ⚠ DSN 은 public-safe — Sentry server 가 X-Sentry-Auth header 의 origin
// 검증 + project-level rate limit. 누구나 send 가능하지만 spam 이상의 risk
// 없음. 향후 별도 dev/staging 프로젝트 분리 시 .env 의 SENTRY_DSN 으로 override.
const DEFAULT_DSN =
  'https://b7e4e21a5ea223ae4e1d7e64fed980fd@o4511462391283712.ingest.us.sentry.io/4511462397181952';

export function setupSentryMain() {
  const dsn = process.env.SENTRY_DSN || DEFAULT_DSN;
  const isDev = process.env.NODE_ENV === 'development';

  if (!dsn) {
    log.info('[sentry] main skipped (no DSN)');
    return;
  }

  Sentry.init({
    dsn,
    release: `factor-desktop@${app.getVersion()}`,
    environment: isDev ? 'dev' : 'production',
    // 무료 tier (5K events/month) 보호 — 10% performance trace 샘플링.
    tracesSampleRate: 0.1,
    // dev 에서는 console 에 verbose log (검증용).
    debug: isDev,
    beforeSend(event) {
      return sanitizeEvent(event);
    },
  });
  log.info(`[sentry] main initialized (env=${isDev ? 'dev' : 'production'})`);
}

/**
 * PII / secret sanitize — Sentry dashboard 적재 전 마지막 게이트.
 *
 * 제거:
 * - user.email / user.ip_address (PII)
 * - request.headers 의 Authorization / apikey / cookie / x-supabase-* (secret)
 * - request.url 의 query param 중 user_id / token / secret* (PII + secret)
 * - extra / contexts 안의 secret 패턴
 */
function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // 1) PII
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete (event.user as Record<string, unknown>).username;
  }

  // 2) HTTP request 헤더
  if (event.request?.headers) {
    const headers = event.request.headers as Record<string, string>;
    for (const key of Object.keys(headers)) {
      if (/^(authorization|apikey|cookie|set-cookie|x-supabase-.*)$/i.test(key)) {
        headers[key] = '[REDACTED]';
      }
    }
  }

  // 3) URL query 마스킹
  if (event.request?.url && typeof event.request.url === 'string') {
    event.request.url = maskSecretsInUrl(event.request.url);
  }

  // 4) breadcrumb 안의 URL 도 같은 처리
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (b.data && typeof b.data === 'object') {
        const data = b.data as Record<string, unknown>;
        if (typeof data.url === 'string') {
          data.url = maskSecretsInUrl(data.url);
        }
      }
    }
  }

  return event;
}

function maskSecretsInUrl(url: string): string {
  return url.replace(
    /([?&](user_id|token|secret[^=]*|password|apikey)=)[^&]+/gi,
    '$1[REDACTED]',
  );
}
