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
const MAX_BYTES = 512 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36 FACTOR-DESKTOP/link-preview';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    isPrivateIpv4(host)
  );
}

function normalizeFetchableHttpUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Only http(s) URLs are supported');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Local and private network URLs are not allowed');
  }
  return parsed.toString();
}

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
      } catch {}
      reject(new Error(`timeout after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);

    request.on('response', (response) => {
      const responseUrl = (response as { url?: string }).url;
      if (responseUrl) {
        try {
          normalizeFetchableHttpUrl(responseUrl);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
          return;
        }
      }

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
          } catch {}
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

function parseMetadata(html: string, baseUrl: string): Partial<LinkMetadata> {
  const result: Partial<LinkMetadata> = {};
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html.slice(0, 32 * 1024);

  const ogTitle =
    head.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const titleTag = head.match(/<title[^>]*>([^<]+)<\/title>/i);
  result.title = decodeHtml((ogTitle?.[1] || titleTag?.[1] || '').trim()) || undefined;

  const ogDesc =
    head.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const metaDesc =
    head.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  result.description = decodeHtml((ogDesc?.[1] || metaDesc?.[1] || '').trim()) || undefined;

  const ogImage =
    head.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
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
    } catch {}
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
      url = normalizeFetchableHttpUrl(rawUrl);
    } catch {
      return { url: String(rawUrl), error: 'Blocked or invalid URL' };
    }

    try {
      const html = await fetchText(url);
      const meta = parseMetadata(html, url);
      if (!meta.iconUrl) {
        try {
          const host = new URL(url).hostname;
          meta.iconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
        } catch {}
      }
      return { url, ...meta };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('[link:fetchMetadata]', url, 'failed:', msg);
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
