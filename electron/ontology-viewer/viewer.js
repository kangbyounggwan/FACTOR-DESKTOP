/* 온톨로지 뷰어 (S2) — 정규화 팩(packs/<adapter>.json) → vis-network 그래프 + Obsidian식 검색.
 *
 * CSP script-src 'self' 준수: 인라인 스크립트 0, 외부 .js 만. 데이터는 런타임 fetch.
 * XSS: 팩 = untrusted → 모든 팩 문자열은 escapeHtml/textContent 경유(innerHTML 무이스케이프 0).
 * 통신: webview preload 제거됨 → host 와 런타임 통신 안 함. ?pack= 쿼리 + app://packs fetch 가 유일 채널.
 *
 * pure 함수(escapeHtml/buildGraph/buildIndex)는 module.exports 로 Node 단위 테스트 가능.
 */
(function () {
  'use strict';

  var VOL_COLOR = { realtime: '#e74c3c', event: '#e67e22', static: '#7f8c8d' };
  var ROLE_SHAPE = {
    identifier: 'diamond', measure: 'dot', status: 'triangle', timestamp: 'star',
    flag: 'square', attribute: 'hexagon', label: 'triangleDown', nested: 'database',
  };
  var EDGE_COLOR = {
    hasChild: '#3498db', produces: '#2ecc71', hasMeasure: '#9b59b6',
    hasEvent: '#e67e22', precedes: '#f1c40f', hasCause: '#e74c3c', isA: '#16a085',
  };
  // 이웃 강조에 쓰는 엔티티-엔티티 typed 엣지 (변수 약한엣지·atype dashes 제외)
  var TYPED = { hasChild: 1, produces: 1, hasMeasure: 1, hasEvent: 1, precedes: 1, hasCause: 1, isA: 1 };

  // ── XSS 하드닝: 모든 팩 문자열은 이 함수 경유 ──
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── 그래프빌더 (정규화 팩 → vis nodes/edges + adjacency + index) ──
  // R1 엔티티+변수 / R2 typed 엣지 / R3 concept 노드 / R4 합성 노드 / R5 station_type isA / R6 alarm_type
  function buildGraph(pack) {
    var nodes = [];
    var byId = {};
    var ents = (pack && pack.entities) || {};
    var entityKeys = Object.keys(ents);

    function ensure(id, kind, extra) {
      if (byId[id]) return byId[id];
      var n = { id: id, _kind: kind, label: (extra && extra.label) || id };
      if (extra) for (var k in extra) n[k] = extra[k];
      byId[id] = n;
      nodes.push(n);
      return n;
    }
    // src/dst id → 노드 id (엔티티키면 ent:, 아니면 원문 그대로 — R4 합성)
    function nodeId(x) {
      return entityKeys.indexOf(x) >= 0 ? 'ent:' + x : x;
    }

    // R1 — 엔티티 + 변수 노드
    var weakEdges = [];
    entityKeys.forEach(function (ent) {
      var vars = (ents[ent] && ents[ent].vars) || {};
      var varNames = Object.keys(vars);
      ensure('ent:' + ent, 'entity', {
        label: ent + '\n(' + varNames.length + ' vars)', shape: 'box', _ent: ent,
      });
      varNames.forEach(function (f) {
        var p = vars[f] || {};
        var vid = 'var:' + ent + '.' + f;
        ensure(vid, 'var', {
          label: f, shape: ROLE_SHAPE[p.role] || 'dot',
          color: VOL_COLOR[p.volatility] || '#7f8c8d', size: 9,
          _ent: ent, _role: p.role, _dtype: p.dtype, _vol: p.volatility,
          _sample: p.sample, _source: p.source,
        });
        weakEdges.push({ from: 'ent:' + ent, to: vid, _weak: true, width: 1, smooth: false,
          color: { color: VOL_COLOR[p.volatility] || '#445', opacity: 0.35 } });
      });
    });

    // R3 — concept 노드
    var concepts = (pack && pack.concepts) || [];
    concepts.forEach(function (c) {
      var ids = c.id_short || c.preferred_name || c.semantic_id;
      if (!ids) return;
      ensure('concept:' + ids, 'concept', {
        label: c.preferred_name || ids, shape: 'hexagon', color: '#8e44ad',
        _semantic_id: c.semantic_id, _id_short: c.id_short,
        _preferred_name: c.preferred_name, _category: c.category,
      });
    });
    // cause:<x> ↔ concept:<x> 정규화 매핑(있으면 합성 skip)
    function causeToNode(raw) {
      var stripped = String(raw).replace(/^cause:/, '');
      if (byId['concept:' + stripped]) return 'concept:' + stripped;
      return raw;
    }

    // R5 — station_type → isA
    var stTypes = (pack && pack.station_types) || [];
    var hasStation = !!byId['ent:station'];
    stTypes.forEach(function (t) {
      var code = t.code || t.name;
      if (!code) return;
      ensure('type:' + code, 'station_type', {
        label: code + '\n' + (t.name || '') + '\n×' + (t.n_stations || 0),
        shape: 'box', color: '#16a085', _code: code, _name: t.name, _n: t.n_stations,
      });
    });

    // R6 — alarm_type
    var alTypes = (pack && pack.alarm_types) || [];
    alTypes.forEach(function (t) {
      if (!t.type || t.type === 'NULL') return;
      ensure('atype:' + t.type, 'alarm_type', {
        label: t.type + '\n×' + (t.count || 0), shape: 'box', color: '#5c3310',
        _code: t.type, _n: t.count,
      });
    });

    // R2 — typed 엣지 (+ R4 합성: endpoint 가 노드에 없으면 생성)
    var edges = [];
    var rawEdges = (pack && pack.edges) || [];
    rawEdges.forEach(function (e, i) {
      if (!e || !e.src || !e.dst || !e.type) return;
      var fromId = nodeId(e.src);
      var toId = e.type === 'hasCause' ? causeToNode(e.dst) : nodeId(e.dst);
      if (!byId[fromId]) ensure(fromId, 'instance', { label: e.src, shape: 'dot', color: '#5d6d7e' });
      if (!byId[toId]) ensure(toId, 'instance', { label: e.dst, shape: 'dot', color: '#5d6d7e' });
      edges.push({
        id: 'edge:' + i, from: fromId, to: toId, label: e.type, arrows: 'to',
        color: { color: EDGE_COLOR[e.type] || '#888' }, _type: e.type, _props: e.props || null,
      });
    });
    // R5/R6 엣지
    stTypes.forEach(function (t) {
      var code = t.code || t.name; if (!code || !hasStation) return;
      edges.push({ id: 'edge:isA:' + code, from: 'ent:station', to: 'type:' + code,
        label: 'isA', arrows: 'to', dashes: true, color: { color: '#16a085' }, _type: 'isA' });
    });
    var alarmSrc = byId['var:alarm.type'] ? 'var:alarm.type' : (byId['ent:alarm'] ? 'ent:alarm' : null);
    if (alarmSrc) alTypes.forEach(function (t) {
      if (!t.type || t.type === 'NULL') return;
      edges.push({ id: 'edge:atype:' + t.type, from: alarmSrc, to: 'atype:' + t.type,
        label: '값', arrows: 'to', dashes: true, color: { color: '#e67e22' }, _type: 'value' });
    });

    // adjacency — 엔티티-엔티티 typed 엣지만(변수 약한엣지/dashes 제외) — 이웃강조용
    var adj = {};
    edges.forEach(function (e) {
      if (!TYPED[e._type]) return;
      (adj[e.from] = adj[e.from] || []).push(e.to);
      (adj[e.to] = adj[e.to] || []).push(e.from);
    });

    return { nodes: nodes, edges: edges, weakEdges: weakEdges, byId: byId, adj: adj };
  }

  // ── 통합 검색 인덱스 (node/edge/concept) ──
  function buildIndex(graph) {
    var idx = [];
    graph.nodes.forEach(function (n) {
      var parts = [n.label, n._role, n._dtype, n._vol, n._source, n._sample,
        n._preferred_name, n._id_short, n._semantic_id, n._category, n._name, n._code];
      idx.push({
        kind: n._kind === 'concept' ? 'concept' : 'node', id: n.id, label: n.label,
        searchText: parts.filter(Boolean).join(' ').toLowerCase(), focusTargets: [n.id],
      });
    });
    graph.edges.forEach(function (e) {
      var fl = (graph.byId[e.from] && graph.byId[e.from].label) || e.from;
      var tl = (graph.byId[e.to] && graph.byId[e.to].label) || e.to;
      var pp = e._props ? JSON.stringify(e._props) : '';
      idx.push({
        kind: 'edge', id: e.id, label: fl + ' --' + e._type + '--> ' + tl,
        searchText: (e._type + ' ' + fl + ' ' + tl + ' ' + pp).toLowerCase(),
        focusTargets: [e.from, e.to],
      });
    });
    return idx;
  }

  // ── Node 단위 테스트용 export (browser 에선 무시) ──
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml: escapeHtml, buildGraph: buildGraph, buildIndex: buildIndex };
  }

  // ── 이하 DOM 부트스트랩 (browser 전용) ──
  if (typeof document === 'undefined') return;

  function getAdapter() {
    var p = new URLSearchParams(location.search).get('pack') || '';
    return /^[a-z0-9_]+$/.test(p) ? p : null; // 화이트리스트 — traversal 차단
  }
  // 로그인 계정 격리: ?scope=<userKey> 하위에서 팩을 읽는다(다른 아이디와 공유 안 됨).
  function getScope() {
    var s = new URLSearchParams(location.search).get('scope') || '';
    return /^[a-z0-9_-]+$/.test(s) ? s : null; // 화이트리스트(UUID + '_anon') — traversal 차단
  }
  function packUrl(adapter) {
    var scope = getScope();
    var rel = (scope ? scope + '/' : '') + adapter + '.json';
    return location.protocol === 'app:'
      ? 'app://packs/' + rel
      : './packs/' + rel; // 로컬 dev 폴백
  }

  var STATE = { graph: null, index: null, network: null, local: false };

  function showError(msg) {
    var el = document.getElementById('detail');
    if (el) { el.textContent = ''; var p = document.createElement('div');
      p.className = 'err'; p.textContent = msg; el.appendChild(p); }
  }

  function row(label, value) {
    var tr = document.createElement('tr');
    var th = document.createElement('th'); th.textContent = label;
    var td = document.createElement('td'); td.className = 'mono'; td.textContent = value == null ? '' : String(value);
    tr.appendChild(th); tr.appendChild(td); return tr;
  }

  function backlinks(nodeId) {
    var out = [];
    STATE.graph.edges.forEach(function (e) {
      if (e.from === nodeId) out.push({ dir: 'out', type: e._type, other: e.to });
      else if (e.to === nodeId) out.push({ dir: 'in', type: e._type, other: e.from });
    });
    return out;
  }

  function renderDetail(nodeId) {
    var n = STATE.graph.byId[nodeId];
    var d = document.getElementById('detail');
    d.textContent = '';
    if (!n) { d.textContent = '노드 없음'; return; }
    var h = document.createElement('h2'); h.textContent = n.label; d.appendChild(h);
    var t = document.createElement('table');
    t.appendChild(row('종류', n._kind));
    if (n._role) t.appendChild(row('role', n._role));
    if (n._dtype) t.appendChild(row('타입', n._dtype));
    if (n._vol) t.appendChild(row('휘발성', n._vol));
    if (n._sample !== undefined) t.appendChild(row('샘플', n._sample));
    if (n._source) t.appendChild(row('출처 API', n._source));
    if (n._semantic_id) t.appendChild(row('semantic_id', n._semantic_id));
    if (n._category) t.appendChild(row('category', n._category));
    d.appendChild(t);
    // 백링크 (Obsidian backlink) — 클릭 시 이웃 focus
    var links = backlinks(nodeId);
    var bh = document.createElement('h2'); bh.textContent = '연결 (' + links.length + ')'; d.appendChild(bh);
    links.forEach(function (lk) {
      var other = STATE.graph.byId[lk.other];
      var line = document.createElement('div'); line.className = 'route';
      line.textContent = (lk.dir === 'out' ? '→ ' : '← ') + lk.type + ' : ' + ((other && other.label) || lk.other);
      line.style.cursor = 'pointer';
      line.addEventListener('click', function () { focusNode(lk.other); });
      d.appendChild(line);
    });
  }

  function focusNode(nodeId) {
    if (!STATE.network) return;
    // 이웃(엔티티-엔티티 typed degree 1/2) 수집 — 변수 약한엣지 제외
    var hops = {}; hops[nodeId] = 0;
    var frontier = [nodeId];
    for (var d = 1; d <= 2; d++) {
      var next = [];
      frontier.forEach(function (id) {
        (STATE.graph.adj[id] || []).forEach(function (nb) {
          if (hops[nb] === undefined) { hops[nb] = d; next.push(nb); }
        });
      });
      frontier = next;
    }
    var highlight = Object.keys(hops);
    var upd = STATE.graph.nodes.map(function (n) {
      var on = hops[n.id] !== undefined;
      return { id: n.id, opacity: on ? 1 : 0.15,
        font: n.id === nodeId ? { bold: { color: '#e74c3c' } } : undefined };
    });
    STATE.network.body.data.nodes.update(upd);
    try { STATE.network.fit({ nodes: highlight, animation: true }); } catch (e) { /* ignore */ }
    renderDetail(nodeId);
  }

  function doSearch(q) {
    var list = document.getElementById('results');
    list.textContent = '';
    q = (q || '').trim().toLowerCase();
    if (!q) return;
    var hits = STATE.index.filter(function (it) { return it.searchText.indexOf(q) >= 0; }).slice(0, 30);
    hits.forEach(function (it) {
      var div = document.createElement('div'); div.className = 'result';
      div.textContent = '[' + it.kind + '] ' + it.label;   // textContent = XSS 안전
      div.style.cursor = 'pointer';
      div.addEventListener('click', function () {
        if (it.kind === 'edge') {
          STATE.network.body.data.edges.update({ id: it.id, width: 4, color: { color: '#fff' } });
        }
        focusNode(it.focusTargets[0]);
      });
      list.appendChild(div);
    });
    if (!hits.length) { var none = document.createElement('div'); none.className = 'sub'; none.textContent = '결과 없음'; list.appendChild(none); }
  }

  function render(graph) {
    var visNodes = new vis.DataSet(graph.nodes.map(function (n) {
      return Object.assign({}, n, { font: { multi: true, color: '#cdd9e5' } });
    }));
    var visEdges = new vis.DataSet(graph.edges.concat(graph.weakEdges));
    STATE.network = new vis.Network(
      document.getElementById('net'),
      { nodes: visNodes, edges: visEdges },
      { physics: { stabilization: { iterations: 200 } }, interaction: { hover: true } }
    );
    STATE.network.on('click', function (p) { if (p.nodes && p.nodes.length) focusNode(p.nodes[0]); });
  }

  async function boot() {
    var adapter = getAdapter();
    if (!adapter) { showError('?pack=<adapter> 누락 또는 형식 오류(소문자/숫자/_ 만).'); return; }
    var pack;
    try {
      var res = await fetch(packUrl(adapter));
      if (!res.ok) { showError('팩 로드 실패: HTTP ' + res.status); return; }
      pack = await res.json();
    } catch (e) { showError('팩 fetch 예외: ' + (e && e.message ? e.message : String(e))); return; }
    STATE.graph = buildGraph(pack);
    STATE.index = buildIndex(STATE.graph);
    render(STATE.graph);
    var stat = document.getElementById('stats');
    if (stat) stat.textContent = '노드 ' + STATE.graph.nodes.length + ' · 엣지 ' + STATE.graph.edges.length + ' · adapter ' + adapter;
    var box = document.getElementById('search');
    if (box) box.addEventListener('input', function () { doSearch(box.value); });
  }
  window.addEventListener('DOMContentLoaded', boot);
})();
