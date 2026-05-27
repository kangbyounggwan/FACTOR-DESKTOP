/**
 * capturePageSnapshot — webview 의 rich snapshot (50KB JSON) 생성.
 *
 * 기존 `capturePageText` 의 5000자 단일 string 한계 해결:
 *  - visibleText 50000자 (10x 확장)
 *  - data-* 속성 dump (라인/장비/알람 머신 식별자 보존)
 *  - 보이는 table 직렬화 (header + sample 10 rows)
 *  - meta tags (description, og:title)
 *
 * Plan §3.T0.1, Section 01.
 *
 * 실패 시 null 반환 — 사용자 메시지는 차단하지 않음 (graceful degrade).
 *  - executeJavaScript reject
 *  - JSON parse 에러
 *  - byte size > 80KB (안전 margin)
 *  - 5초 timeout
 */

export interface PageMeta {
  description?: string;
  ogTitle?: string;
}

export interface DataElement {
  tag: string;
  attrs: Record<string, string>;
  text: string;
}

export interface TableSnapshot {
  caption?: string;
  headers: string[];
  rowCount: number;
  sample: string[][];
}

export interface PageSnapshot {
  url: string;
  title: string;
  meta: PageMeta;
  visibleText: string;
  dataElements: DataElement[];
  tables: TableSnapshot[];
  capturedAt: string; // ISO8601
}

const MAX_BYTES = 80 * 1024; // 80KB hard cap
const TIMEOUT_MS = 5000;

// IIFE — webview context 안에서 실행. JSON.stringify 결과 반환.
const SNAPSHOT_JS = `(() => {
  try {
    const slice = (s, n) => (s && s.length > n) ? s.slice(0, n) + '…[truncated]' : (s || '');
    return JSON.stringify({
      url: location.href,
      title: document.title || '',
      meta: {
        description: document.querySelector('meta[name="description"]')?.content || undefined,
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || undefined,
      },
      visibleText: slice(document.body?.innerText || '', 50000),
      dataElements: Array.from(document.querySelectorAll(
        '[data-line], [data-equipment], [data-alarm], [data-kpi]'
      ))
        .slice(0, 200)
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          attrs: Object.fromEntries(Object.entries(el.dataset || {})),
          text: slice((el.innerText || '').trim(), 200),
        })),
      tables: Array.from(document.querySelectorAll('table'))
        .slice(0, 5)
        .map(t => ({
          caption: t.querySelector('caption')?.innerText || undefined,
          headers: Array.from(t.querySelectorAll('thead th')).map(th => (th.innerText || '').trim()),
          rowCount: t.querySelectorAll('tbody tr').length,
          sample: Array.from(t.querySelectorAll('tbody tr')).slice(0, 10)
            .map(tr => Array.from(tr.querySelectorAll('td')).map(td => slice((td.innerText || '').trim(), 100))),
        })),
    });
  } catch (e) {
    return JSON.stringify({ _captureError: String(e && e.message || e) });
  }
})()`;

interface WebViewLike {
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<string>;
}

/**
 * 현재 webview 의 snapshot 생성. 실패/timeout/oversize 시 null.
 */
export async function capturePageSnapshot(
  webview: WebViewLike | null | undefined,
): Promise<PageSnapshot | null> {
  if (!webview?.executeJavaScript) return null;

  // 5s timeout race
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), TIMEOUT_MS);
  });

  let raw: string | null;
  try {
    raw = await Promise.race([
      webview.executeJavaScript(SNAPSHOT_JS, true),
      timeoutPromise,
    ]);
  } catch {
    return null;
  }

  if (!raw) return null;

  // 80KB hard cap (raw string byte size)
  const byteSize = new Blob([raw]).size;
  if (byteSize > MAX_BYTES) {
    // 페이지가 너무 큼 — 추후 visible_text truncation 더 공격적으로 가야 함
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    "_captureError" in (parsed as Record<string, unknown>)
  ) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  return {
    url: String(obj.url ?? ""),
    title: String(obj.title ?? ""),
    meta: (obj.meta as PageMeta) ?? {},
    visibleText: String(obj.visibleText ?? ""),
    dataElements: Array.isArray(obj.dataElements) ? (obj.dataElements as DataElement[]) : [],
    tables: Array.isArray(obj.tables) ? (obj.tables as TableSnapshot[]) : [],
    capturedAt: new Date().toISOString(),
  };
}
