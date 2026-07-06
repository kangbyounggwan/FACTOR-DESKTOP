/* test_viewer_graph.cjs — viewer.js 의 pure 함수(buildGraph/buildIndex/escapeHtml)를
 * 실제 정규화 팩(packs/seohan_ontology.json)에 돌려 그래프 빌더·XSS·검색을 검증.
 * 브라우저 없이 빌더 로직이 팩과 정합한지(수용 기준) 보장.
 *
 * 실행: node factor-desktop/electron/ontology-viewer/test_viewer_graph.cjs
 */
const path = require('node:path');
const fs = require('node:fs');

// viewer.js 는 브라우저 <script>(ESM-typed dir) 라 require 불가 → CommonJS 샌드박스로 실행.
// document/window 를 undefined 로 주입하면 DOM 부트스트랩 전에 early-return, pure 함수만 export.
function loadViewer() {
  const src = fs.readFileSync(path.join(__dirname, 'viewer.js'), 'utf-8');
  const sandbox = { exports: {} };
  // eslint-disable-next-line no-new-func
  const fn = new Function('module', 'exports', 'window', 'document', 'vis', src);
  fn(sandbox, sandbox.exports, undefined, undefined, undefined);
  return sandbox.exports;
}
const { escapeHtml, buildGraph, buildIndex } = loadViewer();

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PACK = path.join(ROOT, 'packs', 'seohan_ontology.json');

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.log('  ✗ ' + msg); failed++; }
}

console.log('[A] escapeHtml XSS 중화');
const xss = '<img src=x onerror=alert(1)>';
const esc = escapeHtml(xss);
assert(!esc.includes('<img'), 'img 태그 이스케이프됨');
assert(esc.includes('&lt;img'), '< → &lt; 변환');
assert(escapeHtml(null) === '' && escapeHtml(undefined) === '', 'null/undefined → 빈문자열');
assert(escapeHtml('a"b\'c&d') === 'a&quot;b&#39;c&amp;d', '따옴표/앰퍼샌드 변환');

if (!fs.existsSync(PACK)) {
  console.log('\n(skip) ' + PACK + ' 없음 — 플러그인 미설치 환경. escapeHtml 만 검증.');
  process.exit(failed ? 1 : 0);
}

const pack = JSON.parse(fs.readFileSync(PACK, 'utf-8'));
const g = buildGraph(pack);

console.log('[B] 그래프 빌더 (R1~R6)');
const entCount = Object.keys(pack.entities || {}).length;
const varCount = Object.values(pack.entities || {}).reduce((a, e) => a + Object.keys((e || {}).vars || {}).length, 0);
const conceptCount = (pack.concepts || []).filter((c) => c.id_short || c.preferred_name || c.semantic_id).length;

const kinds = {};
g.nodes.forEach((n) => { kinds[n._kind] = (kinds[n._kind] || 0) + 1; });
console.log('    node kinds: ' + JSON.stringify(kinds));
assert(kinds.entity === entCount, 'entity 노드 = ' + entCount);
assert(kinds.var === varCount, 'var 노드 = ' + varCount + ' (R1)');
assert(kinds.concept === conceptCount, 'concept 노드 = ' + conceptCount + ' (R3)');
assert((kinds.station_type || 0) > 0, 'station_type 노드 존재 (R5)');
assert(g.nodes.length >= varCount + entCount + conceptCount, '총 노드 ≥ vars+ent+concept (R4 합성 포함)');

const edgeTypes = {};
g.edges.forEach((e) => { edgeTypes[e._type] = (edgeTypes[e._type] || 0) + 1; });
console.log('    edge types: ' + JSON.stringify(edgeTypes));
const packEdges = (pack.edges || []).filter((e) => e.src && e.dst && e.type).length;
assert(g.edges.length >= packEdges, '엣지 ≥ 팩 엣지(' + packEdges + ') — isA/value 추가 (R2/R5/R6)');
assert((edgeTypes.hasChild || 0) > 0 && (edgeTypes.hasCause || 0) > 0, 'hasChild/hasCause 엣지 존재');
assert((edgeTypes.isA || 0) > 0, 'isA 엣지 존재 (R5 station_type)');

console.log('[C] adjacency — 변수 약한엣지 제외(엔티티-엔티티 typed 만)');
// var: 노드는 adjacency 에 등장하면 안 됨(weakEdges 는 adj 미포함)
const varInAdj = Object.keys(g.adj).filter((id) => id.startsWith('var:'));
assert(varInAdj.length === 0, 'adjacency 에 var 노드 없음 (이웃강조 정확성)');

console.log('[D] 통합 검색 인덱스');
const idx = buildIndex(g);
assert(idx.length === g.nodes.length + g.edges.length, '인덱스 = 노드+엣지 수');
const conceptHits = idx.filter((i) => i.kind === 'concept');
assert(conceptHits.length === conceptCount, 'concept 인덱싱 = ' + conceptCount);
// 모든 검색 텍스트는 소문자 (대소문자 무관 검색)
assert(idx.every((i) => i.searchText === i.searchText.toLowerCase()), '검색텍스트 소문자 정규화');
// focusTargets 는 실존 노드를 가리킴
const allIds = new Set(g.nodes.map((n) => n.id));
assert(idx.every((i) => i.focusTargets.every((t) => allIds.has(t))), 'focusTargets 모두 실존 노드');

console.log('\n' + (failed ? '❌ FAIL (' + failed + ')' : '✅ ALL PASS'));
process.exit(failed ? 1 : 0);
