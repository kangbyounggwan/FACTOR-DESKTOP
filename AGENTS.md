# factor-desktop — Codex Context

> Electron + React 데스크탑 클라이언트. `anomaly-eye-monitor`(웹 FE) 와 같은 모노레포에 있지만 **화면이 다르다.**
> 작업 시작 전 root [`../AGENTS.md`](../AGENTS.md) 의 "코드 분리 룰북" / "새 페이지 추가 결정 트리" 섹션을 먼저 읽을 것.

## 코드 분리 룰 (반드시 읽고 시작)

핵심 룰: **`anomaly-eye-monitor/src/pages/*` 의 어떤 파일도 import 하지 않는다.**
(R1 / R2 위반 — `npm run lint` 에서 error)

데스크탑은 자체 페이지를 `factor-desktop/src/pages/` 에 만들고, FE 의 leaf 컴포넌트 / hook 만 `@/features/*`, `@/components/*`, `@/hooks/*` 로 import 한다.

분기 prop (`hideHeader`, `embedded`, `isDesktop`, `isElectron`) 을 FE 컴포넌트에 추가하는 패턴 **금지** (R5 위반). 필요하면 데스크탑 쪽에서 wrapper 로 처리.

shared 위치(`shared/ui/`, `packages/shared-*/`) 에 코드 추가/변경 시 해당 디렉터리의 `INDEX.md` 도 같이 갱신 (R10).

전체 룰북(R1 ~ R10) 과 새 페이지 추가 결정 트리, Bad vs Good 예시는 root [`../AGENTS.md`](../AGENTS.md) 참조 — SoT 는 root.

## 폴더 구조

```
factor-desktop/
├── src/
│   ├── components/           # DesktopShell, DesktopTopBar, DesktopAuthWidget 등
│   ├── features/
│   │   ├── sidebar/          # ConversationSidebar, SidebarMenu (CHAT 탭 사이드바)
│   │   └── app/              # AppPage, WebViewFrame (APP 탭 — 임의 URL webview)
│   ├── pages/                # 데스크탑 자체 페이지 (FE 페이지 import 금지)
│   │   ├── chat/             # ChatPage — FE 의 AIChatPanelView 호스팅
│   │   ├── app/              # AppPage
│   │   ├── monitoring/       # MonitoringPage — FE 의 MonitoringContent 호스팅
│   │   └── settings/         # (예정) 데스크탑 자체 SettingsPage
│   ├── lib/, types/
│   ├── App.tsx               # HashRouter
│   └── main.tsx
├── electron/                 # Electron 메인 프로세스 (preload, IPC, deep-link)
│   ├── main.ts
│   ├── preload.ts
│   ├── windows/mainWindow.ts
│   └── ipc/settings.ts
├── scripts/
│   ├── auto-bump-version.cjs # 빌드 시 소스 변경 감지 → patch 버전 자동 +1
│   └── post-build-electron.cjs
├── release/                  # electron-builder 산출물 (NSIS installer)
├── .build-stamp.json         # auto-bump 의 해시 stamp (gitignored)
├── package.json
├── vite.config.ts            # @/* (FE 소스), @desktop/* (자체 소스) alias
└── tailwind.config.ts
```

## Alias 약속

- `@desktop/*` → `./src/*` (데스크탑 자체 소스)
- `@/*` → `../anomaly-eye-monitor/src/*` (FE leaf 컴포넌트 / hook / utils — **페이지 제외**, R1/R2)

## 라우팅 (HashRouter)

- `/chat` → ChatPage (default)
- `/app` → AppPage
- `/monitoring` → MonitoringPage (ProtectedRoute)
- `/settings` → SettingsPage (ProtectedRoute)
- `/login`, `/signup` → 현재 FE 페이지 직접 사용 — Tier 1 의 마지막 단계에 데스크탑 자체로 전환 예정 (R1 강화)

**왜 HashRouter?** Electron 의 `file://` 프로토콜에서 BrowserRouter 의 `history.replaceState` 가 URL 을 `file:///C:/chat` 으로 변형해 라우트 매칭이 깨짐 → 빈 화면. HashRouter 는 `#/chat` 라 경로 변형 없음.

## 빌드 / 실행

```bash
# 개발 (vite dev + electron)
npm run dev:electron

# 풀 빌드 (auto-bump → vite → electron tsc → NSIS installer)
npm run build:electron
# → release/FACTOR DESKTOP-Setup-{version}.exe

# 빌드 시 동작:
# 1. _auto-bump 가 src/ + electron/ + index.html + 설정파일 SHA-256 계산
# 2. .build-stamp.json 과 비교
#    - 변경 없으면 → 버전 유지
#    - 변경 있으면 → package.json 의 patch 버전 자동 +1
# 3. vite build → dist/
# 4. tsc electron → dist-electron/
# 5. electron-builder → release/win-unpacked + NSIS installer

# 우회
SKIP_AUTO_BUMP=1 npm run build:electron   # 버전 그대로
FORCE_BUMP=1 npm run build:electron       # 변경 없어도 강제 +1
```

## 로그 / 진단

- 메인 프로세스 로그: `%APPDATA%\FACTOR DESKTOP\logs\main.log`
- 캡쳐되는 이벤트: `did-fail-load`, `render-process-gone`, `preload-error`, `console-message` (렌더러 console.\* 까지), `unresponsive`, `did-finish-load`
- 디버그 모드: `FACTOR_DEBUG=1 "release/win-unpacked/FACTOR DESKTOP.exe"` → 자동으로 DevTools 열림
- 렌더러 측 uncaught error / unhandledrejection 은 preload 에서 `console.error` 로 흘려 메인 로그에 캡쳐됨

## 현재 분리 진행 상황 (Tier 1)

- ✅ Section 01: 룰북 + AGENTS.md (이 문서)
- ⏳ Section 02: 데스크탑 자체 SettingsPage
- ⏳ Section 03: MonitoringPage 정리 (이미 작업됨, 검증 단계)
- ⏳ Section 04: FE 의 `embedded` 등 잔여 분기 prop 제거
- ⏳ Section 05: ESLint `no-restricted-imports` 강제

상세: [`../planning-factor-desktop-separation/sections/`](../planning-factor-desktop-separation/sections/)
