/**
 * ontology_protocol.ts — 온톨로지 뷰어/팩용 `app://` custom protocol (S1).
 *
 * 책임: 뷰어 정적자산(`app://ontology/<asset>`) + 설치된 팩(`app://packs/<adapter>.json`)을
 * traversal-safe 하게 서빙. `file://`(전체 파일 접근 = XSS/유출 위험)를 쓰지 않는다.
 *
 * 보안:
 *  - privileged scheme(standard/secure/supportFetchAPI) — app.whenReady 이전 1회 등록.
 *  - path traversal 방어: decodeURIComponent → `..` 거부 → normalize/resolve → containment
 *    → 확장자 화이트(.html/.js/.json) → realpath 심볼릭 재검사.
 *  - CSP `script-src 'self'` (인라인 스크립트 금지).
 *  - 뷰어 webview 전용 partition(persist:factor-ontology)에만 등록 — 외부 MES partition
 *    (persist:factor-apps)은 app:// 자체를 모름(2중 격리).
 *
 * deep-link 전용 `protocol.ts`(factor-mes://)와 책임 분리 — 섞지 않는다.
 */
import { app, protocol, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import log from 'electron-log';

export const ONTOLOGY_PARTITION = 'persist:factor-ontology';

const ALLOWED_EXT = new Set(['.html', '.js', '.json']);

const CSP =
  "default-src 'self' app:; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' app:;";

/** app.whenReady() 이전 1회. 없으면 fetch/CSP/secure-context 깨짐. */
export function registerOntologySchemePrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

function viewerDir(): string {
  // dev: tsc outDir 이 dist-electron 이라 __dirname=dist-electron → 소스 electron/
  //      ontology-viewer 를 직접 가리킨다(복사 불필요). 패키지: resources/ontology-viewer
  //      (asar 밖, extraResources — S2/S4 빌드 통합에서 확정).
  return app.isPackaged
    ? path.join(process.resourcesPath, 'ontology-viewer')
    : path.join(__dirname, '..', 'electron', 'ontology-viewer');
}

function packsDir(): string {
  return path.join(app.getPath('userData'), 'packs');
}

function contentType(ext: string): string {
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

/** baseDir 안의 안전한 실제 경로만 반환. 위반 시 null. */
async function resolveSafe(baseDir: string, rawPath: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null; // 잘못된 인코딩
  }
  decoded = decoded.replace(/^\/+/, ''); // 선행 슬래시 제거
  // .. 토큰 거부 (디코드 후 — %2e%2e 우회 포함). 백슬래시도 슬래시로 정규화 후 검사.
  if (decoded.split(/[\\/]/).some((seg) => seg === '..')) return null;

  const resolved = path.resolve(baseDir, path.normalize(decoded));
  // containment — baseDir 자신 또는 baseDir/ 하위만
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) return null;

  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;

  let real: string;
  try {
    real = await fs.realpath(resolved); // 심볼릭 해소 (없으면 throw → 404)
  } catch {
    return null;
  }
  // 심볼릭이 밖을 가리키는 것 차단 — realpath 후 재검사
  if (real !== baseDir && !real.startsWith(baseDir + path.sep)) return null;
  return real;
}

async function handleApp(request: Request): Promise<Response> {
  let host: string;
  let pathname: string;
  try {
    const u = new URL(request.url); // app://ontology/hello.html
    host = u.host;
    pathname = u.pathname;
  } catch {
    return new Response('bad request', { status: 400 });
  }

  let baseDir: string;
  if (host === 'ontology') baseDir = viewerDir();
  else if (host === 'packs') baseDir = packsDir();
  else return new Response('not found', { status: 404 });

  const real = await resolveSafe(baseDir, pathname);
  if (!real) {
    log.warn('[ontology-protocol] denied app://%s%s', host, pathname);
    return new Response('forbidden', { status: 403 });
  }

  try {
    const body = await fs.readFile(real);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType(path.extname(real).toLowerCase()),
        'Content-Security-Policy': CSP,
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}

/** app.whenReady() 이후. default + 뷰어 partition 양쪽 등록. */
export function registerOntologyProtocolHandlers(): void {
  protocol.handle('app', handleApp);
  session.fromPartition(ONTOLOGY_PARTITION).protocol.handle('app', handleApp);
  log.info(
    '[ontology-protocol] app:// handler registered (default + %s)',
    ONTOLOGY_PARTITION,
  );
}
