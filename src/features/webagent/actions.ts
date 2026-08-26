/**
 * actions — ref 로 지목된 요소에 실제 액션 실행 (Tier 2 PoC).
 *
 * 1차 전략: webview.executeJavaScript 로 DOM 이벤트 dispatch (구현 간단, 대부분 사이트 OK).
 * 2차 전략(fallback): electron IPC → webContents.sendInputEvent 네이티브 입력
 *   (isTrusted=true 요구하는 사이트 / React 합성이벤트 대응) — electron/ipc/webagent.ts.
 *
 * 모든 액션은 { ok, error?, detail? } 를 반환하고 절대 throw 하지 않는다(에이전트 루프 보호).
 *
 * ⚠ 이 파일은 **쓰기 액션**을 수행한다. 호출 전 위험도 판정(riskOf)을 거칠 것.
 * Plan: planning-ai-web-agent/tier2-web-action-agent-plan.md §10 PoC
 */

export interface ActionResult {
  ok: boolean;
  /** 실패 사유 코드 (NOT_FOUND / DISABLED / EXEC_FAIL / TIMEOUT / BLOCKED) */
  error?: string;
  /** 사람이 읽을 상세 */
  detail?: string;
  /** 액션 후 관측된 변화 힌트 (url 변경 등) */
  changed?: { url?: string; navigated?: boolean };
}

interface WebViewLike {
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<string>;
  getURL?: () => string;
}

const ACTION_TIMEOUT_MS = 8000;

/** JS 문자열 리터럴 안전 삽입 */
function q(s: string): string {
  return JSON.stringify(String(s ?? ""));
}

/**
 * 공통 실행기 — IIFE 를 돌리고 JSON 결과를 파싱.
 * webview 쪽 코드는 항상 {ok, error?, detail?} 형태 JSON 을 문자열로 반환해야 한다.
 */
async function run(
  webview: WebViewLike | null | undefined,
  js: string,
): Promise<ActionResult> {
  if (!webview?.executeJavaScript) {
    return { ok: false, error: "NO_WEBVIEW", detail: "webview 참조 없음" };
  }
  const urlBefore = webview.getURL?.() ?? "";

  const timeout = new Promise<null>((r) => setTimeout(() => r(null), ACTION_TIMEOUT_MS));
  let raw: string | null;
  try {
    raw = await Promise.race([webview.executeJavaScript(js, true), timeout]);
  } catch (e) {
    return { ok: false, error: "EXEC_FAIL", detail: String((e as Error)?.message ?? e) };
  }
  if (raw == null) return { ok: false, error: "TIMEOUT", detail: `${ACTION_TIMEOUT_MS}ms 초과` };

  let parsed: ActionResult;
  try {
    parsed = JSON.parse(raw) as ActionResult;
  } catch {
    return { ok: false, error: "EXEC_FAIL", detail: "결과 파싱 실패" };
  }

  const urlAfter = webview.getURL?.() ?? "";
  if (urlAfter && urlAfter !== urlBefore) {
    parsed.changed = { url: urlAfter, navigated: true };
  }
  return parsed;
}

/** ref → 요소 조회 + 가드 (공통 prelude) */
const PRELUDE = `
  var el = document.querySelector('[data-ai-ref="' + REF + '"]');
  if (!el) return JSON.stringify({ ok:false, error:'NOT_FOUND', detail:'ref_' + REF + ' 요소 없음 (재스냅샷 필요)' });
  if (el.disabled) return JSON.stringify({ ok:false, error:'DISABLED', detail:'비활성 요소' });
  try { el.scrollIntoView({ block:'center', inline:'center' }); } catch (e) {}
`;

/** 클릭 — 실제 사용자 클릭에 가깝게 pointer/mouse 이벤트 시퀀스를 발생시킨다. */
export function clickByRef(webview: WebViewLike | null | undefined, ref: number): Promise<ActionResult> {
  const js = `(() => {
    var REF = ${JSON.stringify(String(ref))};
    ${PRELUDE}
    try {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var opts = { bubbles:true, cancelable:true, view:window, clientX:cx, clientY:cy, button:0 };
      ['pointerover','pointerenter','pointerdown','mousedown','pointerup','mouseup','click']
        .forEach(function (t) {
          var Ctor = t.indexOf('pointer') === 0 && window.PointerEvent ? PointerEvent : MouseEvent;
          el.dispatchEvent(new Ctor(t, opts));
        });
      return JSON.stringify({ ok:true, detail:'clicked ' + (el.innerText || el.value || el.tagName).toString().slice(0,60) });
    } catch (e) {
      return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:String(e && e.message || e) });
    }
  })()`;
  return run(webview, js);
}

/**
 * 텍스트 입력 — React/Vue 등 프레임워크의 value setter 를 우회해 값을 넣고
 * input/change 이벤트를 발생시킨다(네이티브 setter 사용이 핵심).
 */
export function typeByRef(
  webview: WebViewLike | null | undefined,
  ref: number,
  text: string,
  opts?: { clear?: boolean },
): Promise<ActionResult> {
  const clear = opts?.clear !== false;
  const js = `(() => {
    var REF = ${JSON.stringify(String(ref))};
    ${PRELUDE}
    try {
      var text = ${q(text)};
      el.focus();
      if (el.isContentEditable) {
        if (${clear}) el.textContent = '';
        el.textContent = (el.textContent || '') + text;
        el.dispatchEvent(new InputEvent('input', { bubbles:true, data:text }));
        return JSON.stringify({ ok:true, detail:'typed(contenteditable)' });
      }
      var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value');
      var next = (${clear} ? '' : (el.value || '')) + text;
      if (setter && setter.set) { setter.set.call(el, next); } else { el.value = next; }
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
      return JSON.stringify({ ok:true, detail:'typed "' + text.slice(0,40) + '"' });
    } catch (e) {
      return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:String(e && e.message || e) });
    }
  })()`;
  return run(webview, js);
}

/** select 옵션 선택 — value 또는 표시 텍스트로 매칭. */
export function selectByRef(
  webview: WebViewLike | null | undefined,
  ref: number,
  value: string,
): Promise<ActionResult> {
  const js = `(() => {
    var REF = ${JSON.stringify(String(ref))};
    ${PRELUDE}
    try {
      var want = ${q(value)};
      if (el.tagName.toLowerCase() !== 'select') {
        return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:'select 요소가 아님' });
      }
      var opts = Array.prototype.slice.call(el.options || []);
      var hit = opts.filter(function (o) { return o.value === want; })[0]
             || opts.filter(function (o) { return (o.text || '').trim() === want; })[0]
             || opts.filter(function (o) { return (o.text || '').indexOf(want) >= 0; })[0];
      if (!hit) {
        return JSON.stringify({ ok:false, error:'NOT_FOUND',
          detail:'옵션 없음. 가능: ' + opts.slice(0,10).map(function(o){return o.text;}).join(' | ') });
      }
      el.value = hit.value;
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
      return JSON.stringify({ ok:true, detail:'selected "' + (hit.text || hit.value) + '"' });
    } catch (e) {
      return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:String(e && e.message || e) });
    }
  })()`;
  return run(webview, js);
}

/** 키 입력 (Enter/Tab/Escape 등) — ref 가 있으면 그 요소에, 없으면 활성 요소에. */
export function pressKey(
  webview: WebViewLike | null | undefined,
  key: string,
  ref?: number,
): Promise<ActionResult> {
  const js = `(() => {
    try {
      var key = ${q(key)};
      var el = ${ref != null ? `document.querySelector('[data-ai-ref="${String(ref)}"]')` : "document.activeElement"} || document.activeElement || document.body;
      var init = { key:key, code:key, bubbles:true, cancelable:true, view:window };
      if (key === 'Enter') { init.keyCode = 13; init.which = 13; }
      if (key === 'Tab') { init.keyCode = 9; init.which = 9; }
      if (key === 'Escape') { init.keyCode = 27; init.which = 27; }
      el.dispatchEvent(new KeyboardEvent('keydown', init));
      el.dispatchEvent(new KeyboardEvent('keypress', init));
      el.dispatchEvent(new KeyboardEvent('keyup', init));
      return JSON.stringify({ ok:true, detail:'key ' + key });
    } catch (e) {
      return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:String(e && e.message || e) });
    }
  })()`;
  return run(webview, js);
}

/** 스크롤 — ref 지정 시 그 요소로, 아니면 창 단위. */
export function scroll(
  webview: WebViewLike | null | undefined,
  opts: { ref?: number; dir?: "up" | "down"; amount?: number },
): Promise<ActionResult> {
  const amount = opts.amount ?? 600;
  const sign = opts.dir === "up" ? -1 : 1;
  const js = opts.ref != null
    ? `(() => {
        var REF = ${JSON.stringify(String(opts.ref))};
        ${PRELUDE}
        return JSON.stringify({ ok:true, detail:'scrolled into view' });
      })()`
    : `(() => {
        try {
          window.scrollBy({ top: ${sign * amount}, behavior:'instant' });
          return JSON.stringify({ ok:true, detail:'scrolled ${sign * amount}px' });
        } catch (e) {
          return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:String(e && e.message || e) });
        }
      })()`;
  return run(webview, js);
}

/** 요소/문서 텍스트 읽기 (검증용) */
export function readText(
  webview: WebViewLike | null | undefined,
  ref?: number,
  max = 4000,
): Promise<ActionResult> {
  const js = `(() => {
    try {
      var el = ${ref != null ? `document.querySelector('[data-ai-ref="${String(ref)}"]')` : "document.body"};
      if (!el) return JSON.stringify({ ok:false, error:'NOT_FOUND', detail:'요소 없음' });
      var t = (el.innerText || el.textContent || '').trim();
      return JSON.stringify({ ok:true, detail: t.slice(0, ${max}) });
    } catch (e) {
      return JSON.stringify({ ok:false, error:'EXEC_FAIL', detail:String(e && e.message || e) });
    }
  })()`;
  return run(webview, js);
}
