/**
 * link IPC — URL 의 메타 정보 (title / description / icon) 를 메인 프로세스에서 fetch.
 *
 * 렌더러에서 fetch 하면 CORS 차단되는 사이트가 대부분 (Notion, GitHub, ...).
 * Electron 메인 프로세스 = Node fetch → CORS 무관.
 *
 * 사용:
 *   const meta = await window.electron.link.fetchMetadata("https://notion.so");
 *   // → { url, title: "Notion ...", description: "...", iconUrl: "..." }
 */

import { ipcMain, net } from 'electron';
import log from 'electron-log';

interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  error?: string;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024; // 512 KB — <head> 만 보면 충분, 거대 페이지 방어
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36 FACTOR-DESKTOP/link-preview';

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      redirect: 'follow',
    });
    request.setHeader('User-Agent', USER_AGENT);
    request.setHeader('Accept', 'text/html,application/xhtml+xml,*/*');

    let received = 0;
    const chunks: Buffer[] = [];
    let aborted = false;

    const timeout = setTimeout(() => {
      aborted = true;
      try {
        request.abort();
      } catch {
        /* noop */
      }
      reject(new Error(`timeout after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);

    request.on('response', (response) => {
      if (response.statusCode >= 400) {
        clearTimeout(timeout);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.on('data', (chunk: Buffer) => {
        if (aborted) return;
        received += chunk.length;
        chunks.push(chunk);
        if (received >= MAX_BYTES) {
          aborted = true;
          try {
            request.abort();
          } catch {
            /* noop */
          }
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks).toString('utf8'));
        }
      });
      response.on('end', () => {
        if (aborted) return;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      response.on('error', (err: Error) => {
        if (aborted) return;
        clearTimeout(timeout);
        reject(err);
      });
    });

    request.on('error', (err) => {
      if (aborted) return;
      clearTimeout(timeout);
      reject(err);
    });

    request.end();
  });
}

// HTML <head> 에서 메타 태그 추출 (정규식 — cheerio 의존 회피)
function parseMetadata(html: string, baseUrl: string): Partial<LinkMetadata> {
  const result: Partial<LinkMetadata> = {};

  // <head> 영역만 본다 (성능 + 정확도)
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html.slice(0, 32 * 1024);

  // og:title
  const ogTitle = head.match(
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  ) || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  // <title>
  const titleTag = head.match(/<title[^>]*>([^<]+)<\/title>/i);
  result.title = decodeHtml((ogTitle?.[1] || titleTag?.[1] || '').trim()) || undefined;

  // og:description / meta description
  const ogDesc = head.match(
    /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  ) || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const metaDesc = head.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i,
  ) || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  result.description = decodeHtml((ogDesc?.[1] || metaDesc?.[1] || '').trim()) || undefined;

  // og:image > link[rel=icon] > link[rel=shortcut icon] > apple-touch-icon
  const ogImage = head.match(
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  ) || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  let icon = ogImage?.[1];
  if (!icon) {
    const linkIcon =
      head.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i) ||
      head.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i) ||
      head.match(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i);
    icon = linkIcon?.[1];
  }
  if (icon) {
    try {
      result.iconUrl = new URL(icon, baseUrl).toString();
    } catch {
      // 잘못된 URL — 무시
    }
  }

  return result;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function registerLinkIpc(): void {
  ipcMain.handle('link:fetchMetadata', async (_e, rawUrl: string): Promise<LinkMetadata> => {
    let url: string;
    try {
      const parsed = new URL(rawUrl);
      if (!/^https?:$/.test(parsed.protocol)) {
        return { url: rawUrl, error: 'http(s) URL 만 지원합니다' };
      }
      url = parsed.toString();
    } catch {
      return { url: rawUrl, error: '잘못된 URL 형식' };
    }

    try {
      const html = await fetchText(url);
      const meta = parseMetadata(html, url);
      // 최소 fallback — favicon 없으면 Google s2 사용
      if (!meta.iconUrl) {
        try {
          const host = new URL(url).hostname;
          meta.iconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
        } catch {
          /* noop */
        }
      }
      return { url, ...meta };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('[link:fetchMetadata]', url, '→', msg);
      // 실패해도 favicon 정도는 제공
      try {
        const host = new URL(url).hostname;
        return {
          url,
          iconUrl: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
          error: msg,
        };
      } catch {
        return { url, error: msg };
      }
    }
  });
}
