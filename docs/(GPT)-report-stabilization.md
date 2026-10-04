# (GPT) 보고서 저장 안정화 및 Desktop 반영

작업일: 2026-10-05 KST.

## Desktop 변경

- 채팅 보고서 패널의 저장은 표시 중인 버전을 `If-Match`로 보낸다.
- `saveReportSheet`는 공유 `createSheetApi`의 인증, 응답 해석, 409 오류 처리를 그대로 재사용한다.
  버전 헤더는 요청별 클라이언트에만 설정하며 공유 인스턴스의 상태를 변경하지 않는다.
- 지연된 저장 응답이 다른 보고서나 이후 버전의 초안을 덮어쓰지 않는 기존 보호를 유지했다.
- 기존 작업의 보고서 패널, 대화 복원, 계정 양식, 콘텐츠 추가 미션, 메뉴와 로그인 수정도
  현재 Desktop 브랜치의 소스 반영 대상이다. 설치 파일과 비밀 설정은 Git에 포함하지 않는다.
- TypeScript 빌드 메타데이터와 자동 생성된 Vite 설정 파일을 Git에서 제외한다.

## 서버 변경: 별도 저장소/배포 필요

아래 변경은 `factor-MES/llm-backend` 및 `factor-MES/report-plugin`의 로컬 소스에 적용했다.
FACTOR-DESKTOP 저장소의 푸시만으로 이 서버 소스가 배포되지는 않는다.

1. `sheet.apply`의 중복 방지 키에 저장할 버전을 포함한다. 같은 처리 중
   편집 → 저장 → 추가 편집 → 저장을 하면 두 버전 모두 저장된다.
2. capability 저장에도 현재 버전의 `If-Match`를 전달한다. 오래된 버전은 409이며
   저장 성공으로 표시하지 않는다. 같은 버전의 반복 저장은 중복 실행하지 않는다.
3. 저장된 조사 본문/지표가 있는 synth 블록은 다른 기간으로 변경하는 ops를 거부한다.
   오류 코드 `research_requery_required`와 해당 기간의 재조회 안내를 반환한다.
   동일 기간 적용은 허용하고, 일반 데이터 소스의 기간 변경은 유지한다.
4. 저장된 값을 새 기간의 조회값으로 재표기하는 오류를 막은 것이다.
   원본 query descriptor를 저장하고 자동 재조회하는 기능을 완성한 것은 아니다.
5. 보고서 계획 미리보기와 실제 생성의 LLM 호출 생성 함수를
   `report_plugin/planner_llm.py`로 통합했다. 기존 import/테스트 진입점은 유지한다.
6. 호출되지 않는 `ReportService._resolve_adapter`와 백엔드 `CompanyCache` 사본을 제거했다.
   실제 커넥터의 `app.utils.company_cache`와 테넌트 차단 즉시 반영 정책은 유지했다.

## 검증

- Desktop 화면/API 검사: 42/42 통과. 신규 저장 전송/충돌/입력 검사 5개 포함.
- 보고서 로컬 전체 검사: 658/658 통과. DB integration 폴더 제외.
- 백엔드 집중 검사: 168/168 통과. 실 MES, Supabase, 유료 LLM 호출 없음.
- 백엔드 로컬 선택 전체 검사: 2,324 통과, 1 skip, 10 deselected.
  `not live`, manual/consistency_golden/company_pack 제외 및 외부 catalog 검사 2개 제외.
  임시 디렉터리 권한으로 실패했던 초기 실행은 작업 공간 내 임시 경로로 재실행해 통과했다.
- Desktop ESLint: 오류 0개, 기존 경고 5개.
- Desktop 웹 번들 및 Electron 컴파일: 성공.
- Desktop NSIS 설치판: `release/FACTOR DESKTOP-Setup-0.0.126.exe` 생성 성공.
  `--publish never`로 실행해 GitHub 릴리스나 자동 업데이트를 게시하지 않았다.
- Desktop 전체 타입 검사: 실패. 공유 프런트엔드의 React/CSS 타입 충돌,
  Supabase 스키마 타입 불일치와 기존 Desktop 화면의 타입 오류가 남는다.
  타입 검사를 끄거나 `any`로 덮어 통과시킨 것이 아니다.

검사 묶음 사이에 중복 사례가 있으므로 집중 검사와 전체 검사를 합산하지 않는다.
정확한 실행 서버 재시작, 운영 API 재조회, 실제 화면의 MES/LLM 검증과 서버 배포는 실행하지 않았다.

## 다음 정리

- 원본 조회 대상/기간/파라미터와 query descriptor 보존 후 명시적 재조회 기능.
- inbound JWT 검증 핵심 공통화. 서비스별 권한 정책과 프로필 조회는 분리 유지.
- 이전 `ClaudeService.edit_sheet` 진입점은 호환성 조사 후 정리. 현재 편집 경로는 NL capability adapter.
- `resolve_via_rag`와 `_stage_answer` 내부 책임 분리. 기존 운영 API를 일괄 삭제하지 않는다.
- 공유 프런트엔드와 Desktop의 타입 충돌 정리 후 전체 타입 검사 재실행.

Git 푸시는 현재 작업 브랜치 대상이며 main 머지, GitHub 릴리스 게시, 운영 배포와는 별개다.
