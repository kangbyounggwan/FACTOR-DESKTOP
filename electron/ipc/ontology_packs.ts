/**
 * ontology_packs.ts — S4: 온톨로지 플러그인 다운로드/설치 IPC (main process).
 *
 * 흐름: 렌더러 install UI → preload bridge → 이 핸들러 → backend 레지스트리(S3) proxy
 *   → 다중 검증 게이트 → atomic 저장(%APPDATA%/FACTOR DESKTOP/packs/<adapter>.json)
 *   → S1 의 app://packs/ 핸들러가 그 파일을 뷰어에 서빙.
 *
 * 보안 (S4 §3):
 *  - backend base = **빌드 상수 allowlist** (사용자 설정 URL 금지 → SSRF/피싱 차단).
 *  - 신원 = 렌더러가 넘긴 user_id 를 ?user_id= 로 전달(S3 require_user_id). company_id 우회 없음.
 *  - install 검증 9단계(싼 것 먼저): adapter 정규식 → URL → 상태 → content-type → 크기 →
 *    JSON 파싱 → 필수키 → adapter 일치 → SHA-256(서버 canonical body 해시 == 헤더).
 *    하나라도 실패 시 throw → 디스크에 아무것도 안 남음(atomic temp→rename).
 *  - 저장 파일명 = 요청 adapterType(정규식 통과값)만 → path traversal 불가 + containment 재검사.
 */
import { app, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import log from 'electron-log';

// ── backend base — 빌드 상수 allowlist (R: 사용자 설정 절대 금지) ──────────
// nginx 가 /api/chat/* 만 llm-backend 로 보냄 → 레지스트리 prefix = /api/chat/ontology.
const PROD_BASE = 'https://api.factor.io.kr';
const DEV_BASE = 'http://127.0.0.1:8000';
const API_PREFIX = '/api/chat/ontology';

const ADAPTER_RE = /^[a-z0-9_]+$/;
const MAX_PACK_BYTES = 10 * 1024 * 1024; // 10MB DoS 상한
const FETCH_TIMEOUT_MS = 20_000;

function backendBase(): string {
  // packaged = prod, dev = local. 환경/렌더러 입력으로 못 바꾼다.
  return app.isPackaged ? PROD_BASE : DEV_BASE;
}

function packsDir(): string {
  // S1 ontology_protocol.ts 의 app://packs/ 핸들러가 읽는 바로 그 루트와 동일해야 함.
  return path.join(app.getPath('userData'), 'packs');
}

/** user_id → 저장 버킷 키. settings.userKey / OntologyWebView 의 scope 와 동일 규칙이어야 함. */
export function userScopeKey(userId: unknown): string {
  const k = String(userId ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);
  return k || '_anon';
}

/** 로그인 계정별 팩 디렉터리: userData/packs/<userKey>/. 다른 아이디면 서로 안 보임. */
function userPacksDir(userId: unknown): string {
  return path.join(packsDir(), userScopeKey(userId));
}

function assertAdapter(adapterType: unknown): asserts adapterType is string {
  if (
    typeof adapterType !== 'string' ||
    adapterType.length === 0 ||
    adapterType.length > 64 ||
    !ADAPTER_RE.test(adapterType)
  ) {
    throw new Error('Invalid adapter_type');
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'error' });
  } finally {
    clearTimeout(t);
  }
}

interface InstalledPack {
  adapter_type: string;
  bytes: number;
  installedAt: number;
}

/** GET /available-adapters — S3 가 이미 테넌트 필터한 목록. */
async function handleAvailable(userId: string): Promise<unknown> {
  assertUserId(userId);
  const url = `${backendBase()}${API_PREFIX}/available-adapters?user_id=${encodeURIComponent(userId)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`available 실패: HTTP ${res.status}`);
  const json = await res.json();
  return json?.adapters ?? [];
}

/** GET /plugins/<adapter>/pack → 검증 → atomic 저장. */
async function handleInstall(adapterType: string, userId: string): Promise<InstalledPack> {
  // 게이트 1: adapter 정규식 (traversal/형식)
  assertAdapter(adapterType);
  assertUserId(userId);

  // 게이트 2: URL = allowlisted base + 검증된 adapter
  const url =
    `${backendBase()}${API_PREFIX}/plugins/${encodeURIComponent(adapterType)}/pack` +
    `?user_id=${encodeURIComponent(userId)}`;

  const res = await fetchWithTimeout(url);

  // 게이트 3: HTTP 상태
  if (res.status === 403 || res.status === 404) {
    throw new Error('NO_ACCESS'); // 권한 없음/미존재 — 렌더러가 사용자 메시지로 변환
  }
  if (!res.ok) throw new Error(`install 실패: HTTP ${res.status}`);

  // 게이트 4: content-type
  const ct = res.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) {
    throw new Error('BAD_CONTENT_TYPE');
  }

  // 게이트 5: 크기 상한 (raw 바이트)
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PACK_BYTES) throw new Error('PACK_TOO_LARGE');
  const rawText = buf.toString('utf-8');

  // 게이트 6: JSON 파싱
  let pack: Record<string, unknown>;
  try {
    pack = JSON.parse(rawText);
  } catch {
    throw new Error('BAD_JSON');
  }

  // 게이트 7: 필수 키
  for (const k of ['adapter_type', 'entities', 'edges'] as const) {
    if (!(k in pack)) throw new Error(`PACK_MISSING_KEY:${k}`);
  }

  // 게이트 8: adapter_type 자기선언 == 요청값 (타사 팩 끼어듦 차단)
  if (pack.adapter_type !== adapterType) throw new Error('ADAPTER_MISMATCH');

  // 게이트 9: SHA-256 — 서버가 canonical body 로 보낸 헤더와 raw body 해시 대조.
  //   서버 router 는 응답 본문 자체가 canonical(compact) JSON 이라 raw 바이트 해시 == 헤더.
  const headerSum = res.headers.get('x-pack-checksum') || '';
  if (headerSum) {
    const localSum = 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
    if (localSum !== headerSum) throw new Error('CHECKSUM_MISMATCH');
  }

  // ── 백단 이관 기록 (DB 추적) — 로컬 저장 前. 이게 "다운로드=백단 이관"의 핵심.
  //   실패 시 throw → 로컬에도 아무것도 안 남김(설치 = 백엔드 기록 성공이 조건).
  //   plugin_id 경로 세그먼트는 pack 다운로드와 동일 규칙(adapter_type==plugin_id 관례).
  const recUrl =
    `${backendBase()}${API_PREFIX}/plugins/${encodeURIComponent(adapterType)}/install` +
    `?user_id=${encodeURIComponent(userId)}`;
  const rec = await fetchWithTimeout(recUrl, { method: 'POST' });
  if (rec.status === 403 || rec.status === 404) throw new Error('NO_ACCESS');
  if (!rec.ok) throw new Error(`BACKEND_RECORD_FAILED:${rec.status}`);

  // ── atomic 저장 (로그인 계정별 디렉터리 — 다른 아이디와 공유 안 됨) ──
  const dir = userPacksDir(userId);
  await fs.mkdir(dir, { recursive: true });
  const dest = path.resolve(dir, `${adapterType}.json`);
  // 방어적 containment 재검사 (정규식상 불가하지만 2중)
  if (dest !== path.join(dir, `${adapterType}.json`) || !dest.startsWith(dir + path.sep)) {
    throw new Error('Invalid destination path');
  }
  const tmp = `${dest}.tmp-${process.pid}`;
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, dest);

  log.info('[ontology] installed pack adapter=%s bytes=%d', adapterType, buf.length);
  return { adapter_type: adapterType, bytes: buf.length, installedAt: Date.now() };
}

/** 설치된 팩 목록 (로그인 계정 디렉터리 userData/packs/<userKey>/*.json). */
async function handleListInstalled(userId: string): Promise<InstalledPack[]> {
  assertUserId(userId);
  const dir = userPacksDir(userId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return []; // 디렉터리 없음 = 설치 0
  }
  const out: InstalledPack[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const adapter = name.slice(0, -'.json'.length);
    if (!ADAPTER_RE.test(adapter)) continue; // dummy.json 등 비정상 제외
    try {
      const st = await fs.stat(path.join(dir, name));
      out.push({ adapter_type: adapter, bytes: st.size, installedAt: st.mtimeMs });
    } catch {
      /* skip */
    }
  }
  return out;
}

/** GET /installs — 백엔드 설치 이력(테넌트 스코프, DB 추적). 기기 간 설치상태 동기화 근거. */
async function handleInstallsRemote(userId: string): Promise<unknown> {
  assertUserId(userId);
  const url = `${backendBase()}${API_PREFIX}/installs?user_id=${encodeURIComponent(userId)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`installs 조회 실패: HTTP ${res.status}`);
  const json = await res.json();
  return json?.installs ?? [];
}

/** DELETE /plugins/<adapter>/install — 백엔드 soft-remove(status=removed) + 로컬 팩 삭제. */
async function handleUninstall(adapterType: string, userId: string): Promise<{ ok: boolean }> {
  assertAdapter(adapterType);
  assertUserId(userId);
  const url =
    `${backendBase()}${API_PREFIX}/plugins/${encodeURIComponent(adapterType)}/install` +
    `?user_id=${encodeURIComponent(userId)}`;
  const res = await fetchWithTimeout(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`uninstall 실패: HTTP ${res.status}`);
  // 로컬 캐시 파일 제거 (있으면). 백엔드 기록이 SoT, 로컬은 뷰어 캐시.
  const dir = userPacksDir(userId);
  const dest = path.resolve(dir, `${adapterType}.json`);
  if (dest.startsWith(dir + path.sep)) {
    await fs.rm(dest, { force: true }).catch(() => {});
  }
  log.info('[ontology] uninstalled adapter=%s', adapterType);
  return { ok: true };
}

function assertUserId(userId: unknown): asserts userId is string {
  // S3 가 UUID 검증하지만 클라도 최소 형식 체크(빈 값/타입).
  if (typeof userId !== 'string' || userId.length < 8 || userId.length > 64) {
    throw new Error('Invalid user_id');
  }
}

export function registerOntologyPacksIpc(): void {
  ipcMain.handle('ontology:available', (_e, userId: string) => handleAvailable(userId));
  ipcMain.handle('ontology:install', (_e, adapterType: string, userId: string) =>
    handleInstall(adapterType, userId),
  );
  ipcMain.handle('ontology:listInstalled', (_e, userId: string) =>
    handleListInstalled(userId),
  );
  ipcMain.handle('ontology:installsRemote', (_e, userId: string) =>
    handleInstallsRemote(userId),
  );
  ipcMain.handle('ontology:uninstall', (_e, adapterType: string, userId: string) =>
    handleUninstall(adapterType, userId),
  );
}
