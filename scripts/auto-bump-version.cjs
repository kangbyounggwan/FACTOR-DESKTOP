/**
 * auto-bump-version.cjs
 *
 * EXE 빌드 직전에 소스 변경 여부를 확인해 patch 버전을 자동으로 +1.
 *
 * 동작:
 *  1. `package.json` 의 version 읽음 (예: 0.0.1)
 *  2. 관찰 대상(src/, electron/, index.html, *.config.*, package.json) SHA-256 계산
 *  3. `.build-stamp.json` 의 마지막 빌드 해시와 비교
 *      - 없음 → stamp만 생성하고 bump 하지 않음 (첫 실행 안전)
 *      - 동일 → 변경 없음 → bump 안 함
 *      - 다름 → patch 버전 +1 → package.json 저장 → stamp 갱신
 *
 * 빌드 사이에 소스 수정이 있을 때만 자동으로 버전이 올라가므로,
 * 동일 코드를 반복 빌드해도 버전이 무한히 증가하지 않음.
 *
 * Env:
 *  - `SKIP_AUTO_BUMP=1` → 우회 (수동 버전 관리)
 *  - `FORCE_BUMP=1`     → 변경 없어도 강제 bump
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const STAMP_PATH = path.join(ROOT, '.build-stamp.json');

// 해시에 포함할 경로 (디렉터리는 재귀)
const WATCH_PATHS = [
  'src',
  'electron',
  'public',
  'index.html',
  'vite.config.ts',
  'tailwind.config.ts',
  'postcss.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'package.json',
];

// 해시 계산에서 제외 (빌드 산출물, 캐시, 로그 등)
const EXCLUDE = new Set([
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  '.vite',
  '.cache',
]);

function walk(p, accum) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isFile()) {
    accum.push(p);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(p)) {
    if (EXCLUDE.has(entry)) continue;
    walk(path.join(p, entry), accum);
  }
}

function computeSourceHash() {
  const files = [];
  for (const rel of WATCH_PATHS) {
    walk(path.join(ROOT, rel), files);
  }
  files.sort();
  const h = crypto.createHash('sha256');
  for (const f of files) {
    const relKey = f.replace(ROOT, '').replace(/\\/g, '/');
    h.update(relKey + ':');
    // package.json 의 version 필드는 bump 가 직접 바꾸므로 해시에서 제외
    // (그렇지 않으면 bump → 해시 변경 → 다음 빌드에서 또 bump → 무한 증가)
    if (f === PKG_PATH) {
      const pkg = readJson(f);
      delete pkg.version;
      h.update(JSON.stringify(pkg));
    } else {
      h.update(fs.readFileSync(f));
    }
    h.update('\n');
  }
  return { hash: h.digest('hex'), fileCount: files.length };
}

function bumpPatch(v) {
  // SemVer: major.minor.patch[-prerelease][+build]
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) throw new Error(`Cannot parse version: ${v}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}${m[4]}`;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function main() {
  if (process.env.SKIP_AUTO_BUMP === '1') {
    console.log('[auto-bump] SKIP_AUTO_BUMP=1 → skip');
    return;
  }

  const pkg = readJson(PKG_PATH);
  const currentVersion = pkg.version;
  const { hash: currentHash, fileCount } = computeSourceHash();
  const force = process.env.FORCE_BUMP === '1';

  let prevStamp = null;
  if (fs.existsSync(STAMP_PATH)) {
    try {
      prevStamp = readJson(STAMP_PATH);
    } catch (e) {
      console.warn('[auto-bump] stamp file invalid, treating as missing:', e.message);
    }
  }

  if (!prevStamp) {
    // 최초 실행 — stamp만 생성, bump 안 함
    writeJson(STAMP_PATH, {
      version: currentVersion,
      sourceHash: currentHash,
      fileCount,
      stampedAt: new Date().toISOString(),
      note: 'initial stamp — no bump',
    });
    console.log(
      `[auto-bump] first run → stamp created (v${currentVersion}, ${fileCount} files), no bump`,
    );
    return;
  }

  if (!force && prevStamp.sourceHash === currentHash) {
    console.log(
      `[auto-bump] no source changes since v${prevStamp.version} (${fileCount} files) → keep v${currentVersion}`,
    );
    return;
  }

  // 변경 감지 — bump
  const newVersion = bumpPatch(currentVersion);
  pkg.version = newVersion;
  writeJson(PKG_PATH, pkg);
  writeJson(STAMP_PATH, {
    version: newVersion,
    previousVersion: currentVersion,
    sourceHash: currentHash,
    fileCount,
    stampedAt: new Date().toISOString(),
    reason: force ? 'FORCE_BUMP=1' : 'source-hash changed',
  });
  console.log(
    `[auto-bump] ${force ? 'forced' : 'source changed'} → v${currentVersion} → v${newVersion} (${fileCount} files)`,
  );
}

try {
  main();
} catch (err) {
  console.error('[auto-bump] failed:', err);
  // bump 실패해도 빌드는 계속 진행 (안전 default)
  process.exitCode = 0;
}
