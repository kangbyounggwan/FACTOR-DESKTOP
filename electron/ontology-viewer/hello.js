// S1 더미 — app://packs/dummy.json 을 fetch 해 textContent 로 표시.
// supportFetchAPI(privileged scheme) + 뷰어 partition protocol 등록 + CSP connect-src app: 검증.
// XSS sink 없음(textContent only) — innerHTML 미사용.
(async () => {
  const out = document.getElementById('out');
  try {
    const res = await fetch('app://packs/dummy.json');
    if (!res.ok) {
      out.textContent = 'fetch 실패: HTTP ' + res.status;
      return;
    }
    const json = await res.json();
    out.textContent = 'app://packs/dummy.json OK → ' + JSON.stringify(json);
  } catch (e) {
    out.textContent = 'fetch 예외: ' + (e && e.message ? e.message : String(e));
  }
})();
