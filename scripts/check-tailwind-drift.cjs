/**
 * check-tailwind-drift.cjs
 *
 * factor-desktop ↔ anomaly-eye-monitor 의 `tailwind.config.ts` 가
 * 디자인 토큰 (theme.extend) 영역에서 drift 됐는지 검사.
 *
 * 트리거: 한쪽에만 새 색/폰트/간격을 추가하고 다른 쪽 누락 시 — 양쪽 앱의
 * 같은 Tailwind 클래스가 다르게 보이는 production 버그 사전 차단.
 *
 * 비교 방식:
 *  1. 양쪽 `tailwind.config.ts` 를 esbuild 로 transform → require()
 *  2. `theme.extend` 만 추출 (container, content, plugins 등은 무시)
 *  3. JSON 정규화 (key 정렬) 후 deep diff
 *  4. 차이 있으면 path 별로 diff 출력 + exit 1
 *
 * 사용:
 *   node scripts/check-tailwind-drift.cjs
 *
 * Env:
 *   ALLOW_DRIFT=1     → warning 만, exit 0 (CI 점진 도입용)
 *
 * 룰북: ../CLAUDE.md § 코드 분리 룰북 R5/R6 — Tier 2 진입 시점 자동 신호
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP_CONFIG = path.join(ROOT, 'factor-desktop', 'tailwind.config.ts');
const WEB_CONFIG = path.join(ROOT, 'anomaly-eye-monitor', 'tailwind.config.ts');

function loadTailwindConfig(tsPath) {
  // esbuild 로 TS → CJS 변환 후 메모리에서 require
  const esbuild = require(path.join(__dirname, '..', 'node_modules', 'esbuild'));
  const src = fs.readFileSync(tsPath, 'utf8');
  const result = esbuild.transformSync(src, {
    loader: 'ts',
    format: 'cjs',
    target: 'node20',
  });

  // 임시 module 로 평가 — paths import (e.g. tailwindcss-animate) 가 있을 수 있어
  // 같은 디렉터리 기준으로 resolve.
  const dir = path.dirname(tsPath);
  const m = new Module(tsPath);
  m.filename = tsPath;
  m.paths = Module._nodeModulePaths(dir);
  try {
    m._compile(result.code, tsPath);
  } catch (err) {
    console.error(`[drift] failed to load ${tsPath}:`, err.message);
    process.exit(2);
  }
  return m.exports.default || m.exports;
}

function sortedJson(value) {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = sortedJson(value[k]);
    return sorted;
  }
  return value;
}

// path-별 diff — { '/colors/primary/DEFAULT': { web: 'A', desktop: 'B' } } 같은 형태
function diffDeep(a, b, currentPath = '', diffs = {}) {
  if (a === b) return diffs;
  const isObjA = a && typeof a === 'object' && !Array.isArray(a);
  const isObjB = b && typeof b === 'object' && !Array.isArray(b);
  if (isObjA && isObjB) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      diffDeep(a[k], b[k], `${currentPath}/${k}`, diffs);
    }
    return diffs;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    diffs[currentPath || '/'] = {
      web: a === undefined ? '<missing>' : a,
      desktop: b === undefined ? '<missing>' : b,
    };
  }
  return diffs;
}

function main() {
  const allowDrift = process.env.ALLOW_DRIFT === '1';

  if (!fs.existsSync(WEB_CONFIG)) {
    console.error(`[drift] web config 없음: ${WEB_CONFIG}`);
    process.exit(2);
  }
  if (!fs.existsSync(DESKTOP_CONFIG)) {
    console.error(`[drift] desktop config 없음: ${DESKTOP_CONFIG}`);
    process.exit(2);
  }

  const web = loadTailwindConfig(WEB_CONFIG);
  const desktop = loadTailwindConfig(DESKTOP_CONFIG);

  // theme.extend 만 비교 (container/content/plugins 는 앱별로 다른 게 정상)
  const webExtend = sortedJson(web?.theme?.extend ?? {});
  const desktopExtend = sortedJson(desktop?.theme?.extend ?? {});

  const diffs = diffDeep(webExtend, desktopExtend);
  const diffPaths = Object.keys(diffs);

  if (diffPaths.length === 0) {
    console.log('[drift] OK — tailwind theme.extend 양쪽 동일');
    return;
  }

  const level = allowDrift ? 'WARN' : 'ERROR';
  console.log(
    `[drift] ${level} — tailwind theme.extend drift 감지 (${diffPaths.length} 항목)`,
  );
  console.log('');
  for (const p of diffPaths) {
    const { web: w, desktop: d } = diffs[p];
    console.log(`  • ${p}`);
    console.log(`      web:     ${JSON.stringify(w)}`);
    console.log(`      desktop: ${JSON.stringify(d)}`);
  }
  console.log('');
  console.log(
    '대처: 한쪽에서 새 토큰을 추가했을 가능성. 같은 변경을 다른 쪽에도 반영하거나,',
  );
  console.log(
    'Tier 2 (shared tailwind preset 추출) 를 검토하세요 — planning-factor-desktop-separation/sections/section-06.',
  );

  if (!allowDrift) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error('[drift] 예외:', err);
  process.exit(2);
}
