/**
 * refSnapshot — AI 웹제어용 "요소 인덱싱" 스냅샷 (Tier 2 PoC).
 *
 * 기존 `features/app/capturePageSnapshot.ts` 는 읽기 전용(텍스트·표·data-*)이라
 * **클릭 대상을 지목할 식별자가 없다**. 여기서는 인터랙티브 요소마다
 * `data-ai-ref="N"` 을 부여하고 role/name/bbox 를 수집해, AI 가 `ref` 로
 * 정확히 지목 → dispatcher 가 그 ref 로 실행할 수 있게 한다.
 * (Claude Browser 의 read_page → ref_N 방식과 동일 개념)
 *
 * 원칙:
 *  - 이 파일은 **읽기만** 한다. 실제 클릭/입력은 actions/* 가 담당.
 *  - ref 는 캡처 시점 스냅샷 기준. 페이지가 바뀌면 재캡처해야 함(stale 방지용 capturedAt).
 *  - 실패 시 null (graceful degrade) — 기존 capturePageSnapshot 규약과 동일.
 *
 * Plan: planning-ai-web-agent/tier2-web-action-agent-plan.md §10 PoC
 */

export interface RefElement {
  /** data-ai-ref 값 — 액션 호출 시 이 값으로 지목 */
  ref: number;
  /** button | link | textbox | checkbox | radio | combobox | tab | ... */
  role: string;
  /** 접근성 이름 (label/aria-label/placeholder/text) */
  name: string;
  tag: string;
  type?: string;
  value?: string;
  disabled?: boolean;
  /** 뷰포트 기준 bounding box — native sendInputEvent 좌표 클릭에 사용 */
  rect: { x: number; y: number; w: number; h: number };
  /** select 요소의 선택 가능 옵션 */
  options?: string[];
}

export interface RefSnapshot {
  url: string;
  title: string;
  elements: RefElement[];
  /** 뷰포트 크기 — 좌표 스케일 검증용 */
  viewport: { w: number; h: number };
  /** 전체 인터랙티브 요소 수 (elements 는 상한으로 잘릴 수 있음) */
  totalFound: number;
  capturedAt: string;
}

const MAX_ELEMENTS = 150;
const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 5000;

/**
 * webview 컨텍스트에서 실행되는 IIFE.
 * 인터랙티브 요소를 찾아 data-ai-ref 를 부여하고 메타를 수집한다.
 */
const REF_SNAPSHOT_JS = `(() => {
  try {
    var MAX = ${MAX_ELEMENTS};
    var SEL = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]',
      '[role=radio]', '[role=combobox]', '[role=menuitem]', '[role=switch]',
      '[onclick]', '[contenteditable=true]'
    ].join(',');

    var slice = function (s, n) {
      s = (s == null ? '' : String(s));
      return s.length > n ? s.slice(0, n) : s;
    };

    // 화면에 실제로 보이는지 (레이아웃 + 스타일 + 뷰포트 교차)
    var isVisible = function (el, r) {
      if (!r || r.width <= 0 || r.height <= 0) return false;
      var st = window.getComputedStyle(el);
      if (!st || st.visibility === 'hidden' || st.display === 'none') return false;
      if (parseFloat(st.opacity || '1') < 0.05) return false;
      // 뷰포트 밖이어도 스크롤로 도달 가능하므로 문서 범위 내면 허용
      return true;
    };

    // 접근성 이름 추정 (우선순위: aria-label > label > placeholder > value > text > title)
    var accName = function (el) {
      var n = el.getAttribute('aria-label');
      if (n && n.trim()) return n.trim();
      var labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        var lb = document.getElementById(labelledby);
        if (lb && lb.innerText && lb.innerText.trim()) return lb.innerText.trim();
      }
      if (el.id) {
        var lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lab && lab.innerText && lab.innerText.trim()) return lab.innerText.trim();
      }
      var closestLabel = el.closest && el.closest('label');
      if (closestLabel && closestLabel.innerText && closestLabel.innerText.trim()) {
        return closestLabel.innerText.trim();
      }
      var ph = el.getAttribute('placeholder');
      if (ph && ph.trim()) return ph.trim();
      var t = (el.innerText || el.textContent || '').trim();
      if (t) return t;
      var ttl = el.getAttribute('title');
      if (ttl && ttl.trim()) return ttl.trim();
      var alt = el.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
      if (el.value) return String(el.value).trim();
      return '';
    };

    // role 추정
    var roleOf = function (el) {
      var explicit = el.getAttribute('role');
      if (explicit) return explicit;
      var tag = el.tagName.toLowerCase();
      if (tag === 'a') return 'link';
      if (tag === 'button') return 'button';
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') {
        var ty = (el.getAttribute('type') || 'text').toLowerCase();
        if (ty === 'checkbox') return 'checkbox';
        if (ty === 'radio') return 'radio';
        if (ty === 'submit' || ty === 'button' || ty === 'reset') return 'button';
        if (ty === 'hidden') return 'hidden';
        return 'textbox';
      }
      if (el.getAttribute('contenteditable') === 'true') return 'textbox';
      if (el.hasAttribute('onclick')) return 'button';
      return 'generic';
    };

    var all = Array.prototype.slice.call(document.querySelectorAll(SEL));
    var out = [];
    var total = 0;
    var seq = 0;

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      var role = roleOf(el);
      if (role === 'hidden') continue;
      if (!isVisible(el, r)) continue;
      total++;
      if (out.length >= MAX) continue;

      seq++;
      el.setAttribute('data-ai-ref', String(seq));

      var item = {
        ref: seq,
        role: role,
        name: slice(accName(el), 160),
        tag: el.tagName.toLowerCase(),
        rect: {
          x: Math.round(r.left), y: Math.round(r.top),
          w: Math.round(r.width), h: Math.round(r.height)
        }
      };
      var ty2 = el.getAttribute('type');
      if (ty2) item.type = ty2.toLowerCase();
      if (el.disabled === true) item.disabled = true;
      if (typeof el.value === 'string' && el.value) item.value = slice(el.value, 120);
      if (el.tagName.toLowerCase() === 'select') {
        item.options = Array.prototype.slice.call(el.options || [])
          .slice(0, 40)
          .map(function (o) { return slice(o.text || o.value || '', 60); });
      }
      out.push(item);
    }

    return JSON.stringify({
      url: location.href,
      title: document.title || '',
      elements: out,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      totalFound: total
    });
  } catch (e) {
    return JSON.stringify({ _captureError: String((e && e.message) || e) });
  }
})()`;

interface WebViewLike {
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<string>;
}

/**
 * 현재 webview 의 요소 인덱싱 스냅샷. 실패/timeout/oversize 시 null.
 * 부작용: 페이지 DOM 의 인터랙티브 요소에 `data-ai-ref` 속성이 부여된다(읽기 목적).
 */
export async function captureRefSnapshot(
  webview: WebViewLike | null | undefined,
): Promise<RefSnapshot | null> {
  if (!webview?.executeJavaScript) return null;

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), TIMEOUT_MS);
  });

  let raw: string | null;
  try {
    raw = await Promise.race([
      webview.executeJavaScript(REF_SNAPSHOT_JS, true),
      timeoutPromise,
    ]);
  } catch {
    return null;
  }
  if (!raw) return null;

  if (new Blob([raw]).size > MAX_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if ("_captureError" in (parsed as Record<string, unknown>)) return null;

  const obj = parsed as Record<string, unknown>;
  return {
    url: String(obj.url ?? ""),
    title: String(obj.title ?? ""),
    elements: Array.isArray(obj.elements) ? (obj.elements as RefElement[]) : [],
    viewport: (obj.viewport as RefSnapshot["viewport"]) ?? { w: 0, h: 0 },
    totalFound: Number(obj.totalFound ?? 0),
    capturedAt: new Date().toISOString(),
  };
}

/** AI 프롬프트용 압축 텍스트 — ref 목록을 한 줄씩. */
export function formatRefsForPrompt(snap: RefSnapshot, limit = 80): string {
  const lines = snap.elements.slice(0, limit).map((e) => {
    const bits = [`[ref_${e.ref}]`, e.role];
    if (e.name) bits.push(JSON.stringify(e.name));
    if (e.type) bits.push(`type=${e.type}`);
    if (e.value) bits.push(`value=${JSON.stringify(e.value)}`);
    if (e.disabled) bits.push("disabled");
    if (e.options?.length) bits.push(`options=${JSON.stringify(e.options.slice(0, 8))}`);
    return bits.join(" ");
  });
  const more = snap.totalFound > snap.elements.length
    ? `\n… (총 ${snap.totalFound}개 중 ${snap.elements.length}개 표시)`
    : "";
  return `URL: ${snap.url}\nTITLE: ${snap.title}\n${lines.join("\n")}${more}`;
}
