# Release Flow — factor-desktop

> 2026-05-27 — Section 02 autoupdate 도입 후 절차.
> **현재 미서명 EXE** (Section 01 code-signing 은 B2B 외부 고객 확대 시점에 도입 예정).

## 1. 사전 준비 (최초 1회)

### GitHub Personal Access Token (PAT)

`electron-builder` 가 GitHub Releases 에 publish 하려면 토큰 필요.

1. https://github.com/settings/tokens/new 접속
2. Scope: `repo` (private repo) 또는 `public_repo` (public 시)
3. 토큰 발급 후 로컬 환경변수 설정:

```bash
# Windows PowerShell
$env:GH_TOKEN = "ghp_xxxxxxxxxxxx"

# Git Bash / WSL
export GH_TOKEN="ghp_xxxxxxxxxxxx"
```

또는 `.env.release` (gitignore 추가 필수) 에 저장 후 빌드 시 source.

### Repository 가시성 결정

`electron-updater` 는 사용자의 설치된 앱에서 GitHub Releases 를 fetch.

| Repo 상태 | 사용자 측 요구 | 비고 |
|----------|---------------|------|
| **public** | 토큰 불필요 | 가장 단순. 코드 노출 OK 면 권장 |
| **private** | 사용자에게도 토큰 배포 필요 | 안전하지 않음 — 비권장 |
| **하이브리드** | 별도 release-only public repo | 권장 대안 — 코드 비공개 유지하며 release 만 공개 |

현재 (2026-05-27): repo `kangbyounggwan/FACTOR-DESKTOP` 가 private — autoupdate
정상 동작하려면 **public 전환** 또는 **release-only mirror repo** 생성 필요.

## 2. Release 절차

```bash
cd C:/Users/USER/factor-MES/factor-desktop

# 1) 버전 bump (자동 — 변경 있으면 patch +1)
#    수동 bump: npm version patch / minor / major

# 2) 빌드 + publish (npm run release 가 _auto-bump + build + electron-builder --publish always)
GH_TOKEN="ghp_xxxxx" npm run release
```

`electron-builder` 가 자동으로 다음 파일을 GitHub Releases 에 업로드:
- `FACTOR DESKTOP-Setup-X.Y.Z.exe`
- `FACTOR DESKTOP-Setup-X.Y.Z.exe.blockmap` (delta update 용)
- `latest.yml` (autoupdate 메타 — version + sha512)

## 3. 미서명 EXE 안전성

`electron-updater` 는 다음 검증을 수행:

| 검증 | 미서명 EXE | 서명된 EXE |
|------|-----------|-----------|
| sha512 hash (latest.yml) | ✅ 항상 검증 | ✅ 항상 검증 |
| Authenticode signature | ⏭️ skip (서명 없음) | ✅ publisherName 매칭 |
| Windows SmartScreen (첫 설치 시) | ⚠️ "추가 정보 → 실행" 1회 클릭 필요 | ✅ 경고 없음 |
| 자동 업데이트 무결성 | ✅ sha512 OK 면 적용 | ✅ sha512 + 서명 모두 OK |

**결론: 미서명이어도 자동 업데이트는 안전.** SmartScreen 경고는 **첫 설치 1회**만 발생. 자동 업데이트는 background 적용이라 SmartScreen 트리거 없음.

## 4. 사용자 측 동작

기존 사용자 (구버전 설치된 상태) 가 앱 시작:

1. `main.ts` 의 `setupAutoUpdater(mainWindow)` 가 시작 직후 + 4시간마다 GitHub Releases 의 latest.yml 확인
2. 새 버전 발견 시 `autoUpdater.autoDownload = true` 라서 **자동 다운로드** 시작
3. 다운로드 완료 → `autoUpdater:update-downloaded` IPC → renderer 의 `UpdateBanner` 표시 → 토스트 + 우하단 배너
4. 사용자 "재시작" 클릭 → `autoUpdater.quitAndInstall()` → 새 버전 적용
5. (사용자 액션 없이) 다음 앱 종료 시 자동 적용 — `autoInstallOnAppQuit = true`

사용자 데이터 (`%APPDATA%/FACTOR DESKTOP/` — electron-store, logs 등) 는 보존.

## 5. 첫 설치 (신규 사용자) SmartScreen 우회

미서명 EXE 라 첫 설치 시 Windows Defender SmartScreen 경고:

```
Windows에서 PC를 보호했습니다
Microsoft Defender SmartScreen에서 인식할 수 없는 앱의 시작을 차단했습니다...
[추가 정보] → [실행]
```

→ 사용자에게 다음 안내:
1. **추가 정보** 클릭
2. **실행** 클릭
3. 한 번만 클릭하면 끝 — 이후 같은 EXE 는 경고 없음

신규 사용자 안내 시 위 절차를 1줄로 첨부.

## 6. Trouble shooting

### `electron-updater` 로그 위치

`%APPDATA%/FACTOR DESKTOP/logs/main.log` 에 `[autoUpdater]` prefix 로 기록:
- `checking` — 확인 시도
- `available {version}` — 새 버전 발견
- `up-to-date` — 최신
- `download {percent}%` — 다운로드 진행
- `downloaded {version}` — 다운로드 완료
- `error` — 실패 (네트워크 / GitHub API rate limit / 토큰 등)

### 업데이트 안 되는 경우 체크리스트

1. `package.json` build.publish 의 owner/repo 가 실제 GitHub repo 와 일치
2. GitHub Releases 에 `latest.yml` 이 publish 되어 있나 (수동 확인: https://github.com/kangbyounggwan/FACTOR-DESKTOP/releases/latest)
3. 사용자 PC 가 `api.github.com` 접근 가능 (사내 방화벽 차단 시 별도 채널 필요)
4. private repo 면 사용자 측 토큰 필요 (현 상태 — 비권장, public 전환 권장)
5. `NODE_ENV=development` 로 실행 중이면 skip (`setupAutoUpdater` 의 dev guard)

### 강제 업데이트 검증

dev 머신에서 새 버전 만들어 publish 후, 구버전 EXE 설치된 다른 PC 에서:
- 앱 실행 → 1~2분 내 다운로드 → 토스트 표시 → "재시작" 적용

또는 `setInterval` 의 4시간을 임시로 60초로 단축해서 테스트.

## 7. Section 01 (code-signing) 도입 시점

다음 조건 충족 시 검토:
- 외부 고객 50명+ 신규 진입
- SmartScreen 경고로 인한 설치 거부 사례 누적
- 인증서 비용 부담 가능 (Certum OSS ~$30/년 또는 국내 OV ~20만원/년)

도입 시:
- `package.json` build.win 에 `signingCertificateFile` + `signingCertificatePassword`
- `electron-updater` 는 `publisherName` 매칭 자동 활성화 → 보안 강화
- 사용자 측 1회 재설치 (서명된 EXE 로 교체) → 이후 SmartScreen 경고 영구 사라짐
