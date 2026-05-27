// Post-build helper for electron main process.
// 1) Write dist-electron/package.json with {"type":"commonjs"} — root
//    package.json 이 "type":"module" 이라 tsc 컴파일된 main.js 가 ESM 으로
//    오인되는 것 방지.
// 2) Section 10 (2026-05-27): release/ 의 오래된 NSIS *.exe 페어 정리
//    (최신 3개 보존 + 7일 이전만 삭제). KEEP_OLD_RELEASES=1 시 skip.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_ELECTRON = path.join(ROOT, 'dist-electron');
const RELEASE_DIR = path.join(ROOT, 'release');

// ── 1) dist-electron/package.json ──
if (!fs.existsSync(DIST_ELECTRON)) {
  fs.mkdirSync(DIST_ELECTRON, { recursive: true });
}
fs.writeFileSync(
  path.join(DIST_ELECTRON, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);
console.log('[post-build-electron] wrote dist-electron/package.json');

// ── 2) release/ cleanup ──
if (process.env.KEEP_OLD_RELEASES === '1') {
  console.log('[post-build-electron] KEEP_OLD_RELEASES=1 — skip cleanup');
  process.exit(0);
}
if (!fs.existsSync(RELEASE_DIR)) {
  // 첫 빌드 — release/ 가 아직 없음
  process.exit(0);
}

const KEEP_RECENT = Number(process.env.KEEP_RECENT_RELEASES ?? 3);
const THRESHOLD_DAYS = Number(process.env.OLD_RELEASE_THRESHOLD_DAYS ?? 7);
const THRESHOLD_MS = THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
const NOW = Date.now();

// NSIS Setup-<version>.exe 페어만 수집 (latest.yml / builder-*.yml 은 제외).
const entries = fs
  .readdirSync(RELEASE_DIR, { withFileTypes: true })
  .filter(
    (d) =>
      d.isFile() &&
      d.name.endsWith('.exe') &&
      /Setup-[0-9.]+\.exe$/.test(d.name),
  )
  .map((d) => {
    const full = path.join(RELEASE_DIR, d.name);
    const stat = fs.statSync(full);
    return { name: d.name, path: full, mtime: stat.mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime); // 최신 우선

const recent = entries.slice(0, KEEP_RECENT);
const candidates = entries.slice(KEEP_RECENT);
const toDelete = candidates.filter((e) => NOW - e.mtime > THRESHOLD_MS);

let deletedCount = 0;
const deletedList = [];
for (const entry of toDelete) {
  const ageDays = Math.floor((NOW - entry.mtime) / (24 * 60 * 60 * 1000));
  try {
    fs.unlinkSync(entry.path);
    // autoupdate 메타 짝꿍 (Section 02 의 *.exe.blockmap) 도 같이 삭제
    const blockmap = `${entry.path}.blockmap`;
    if (fs.existsSync(blockmap)) fs.unlinkSync(blockmap);
    deletedList.push(`${entry.name} (${ageDays}d)`);
    deletedCount += 1;
  } catch (e) {
    console.warn(
      `[post-build-electron] failed to delete ${entry.name}: ${e.message}`,
    );
  }
}

console.log('[post-build-electron] release/ cleanup:');
console.log(
  `  kept: ${recent.length} recent (${
    recent.map((e) => e.name).join(', ') || 'none'
  })`,
);
console.log(
  `  deleted: ${deletedCount} old${
    deletedCount ? ` (${deletedList.join(', ')})` : ''
  }`,
);

// (옵션) release/ 총 크기 로그 — 디스크 사용량 모니터링
function dirSize(dir) {
  let total = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) total += dirSize(full);
    else total += fs.statSync(full).size;
  }
  return total;
}
try {
  const sizeMB = Math.round(dirSize(RELEASE_DIR) / (1024 * 1024));
  console.log(`[post-build-electron] release/ total: ${sizeMB} MB`);
} catch {
  /* ignore — release/ 구조 이상 시 무시 */
}
