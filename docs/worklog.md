# 작업 기록

## OPS-013 · 2026-11-14 21:57:35 KST 확인부터 · MCSM 공개 502 진단

- 후속 통합검사: `npm test` Node전체18PASS/0FAIL/10.909초. 변경 배포 Python2파일 Ruff/check-format 및 git diff check PASS. 새포트 child 검사 프로세스는 전부 종료했다. 새 v0.9.1 완결ZIP은 원본/프런트/103JSON을 그대로 사용해 별도 패키징·기본3002/실제Node재시작검사 예정이며 v0.9.0 ZIP은 수정하지 않는다.

- 후속 사용자 지시(22:03:48 KST 착수): app.js를 수정해 기본3002로 제공한다. 실제 CLI와 내부서버의 기본값, Docker/compose 및 환경변수 예제를3002로 맞추고 명시 PORT/APP_PORT 우선권은 유지했다. v0.9.1로 구분하며 실제 childprocess 기본3002·PORT우선·APP_PORT단독 회귀4PASS521.7ms를 확인했다. 기존 불변 ZIP과 과학자료·Data_Spec/103JSON/프런트 빌드는 재생성하지 않는다. 전체 Node/깨끗한 새ZIP의 환경변수 없는3002 실행·재시작 검사는 후속 결과로 확정한다.

- 사용자: `Planet X Node runtime listening on port 8000` 이후 공개502, 인스턴스 할당 포트3002 확인. 실제 nginx upstream/컨테이너 매핑은 아직 제공되지 않았다.
- 실제 HTTPS GET 네 경로(`/`, `/health/live`, `/health/ready`, `/api/v1/runtime`) 모두 nginx/1.24.0 (Ubuntu)의502 HTML을 확인했다. 공개8000/3002 HTTP health 조회는 각각5초 timeout으로 방화벽/매핑/대상 주소 중 원인을 확정할 수 없다. TLS 검증을 우회하지 않았다.
- debug/documentation 실제 스킬 및 별도 읽기 검토를 적용했다. Node 소스는0.0.0.0 HTTP, PORT→APP_PORT→8000, 성공 바인딩 뒤 로그이며 앱ready 실패는503이다. 공개 프록시 연결/포트 불일치가 유력하되 확정 버그로 보고하지 않는다.
- 로컬 기존8081의 live/ready200을 확인했다. 독립 임시 상태로 `node -e "process.env.PORT='3002';require('./app.js').start()"`를 실제 실행해3002 listening 및 `/`, live, ready200을 확인하고 이 검사 프로세스만 종료했다. 기존 사용자 상태/실행 서버/원본/ZIP은 보존했다.
- 직접 실행은 PORT=3002, `호스트3002→컨테이너8000`이면 내부PORT8000 유지로 구분해 안내한다. nginx upstream은HTTP이며 실제 접근 가능한 IP/포트와 일치해야 한다. 근거: node/server.js34/135–141/239–245, deploy/compose.yaml7, nginx 공식 proxy_pass 문서. FSD17.2에 운영 상태를 기록했다. 과학/데이터/기능 변경은 없다.
- 공용 Notion 지정 URL 재열람은 도구접근 실패였다. 최신 팀 요청을 확인했다고 주장하지 않는다. 실제 MCSM/프록시 서버 설정 변경과 공개 복구 검증은 아직 수행하지 않았다.

각 작업에 ID·KST 시각·목적·영향 파일·출처/입력·결정·검사·실제 결과·남은 문제를 기록한다. 완료와 예정/확인 중을 구분하며 비밀값·개인 식별 정보는 넣지 않는다.

## SETUP-001 · 2026-11-14 · 행사 시작 후 저장소 초기 설정

- 요청: 바탕화면 프로젝트 폴더, v1.7 기반 AGENTS.md, `.gitignore`/`.env`, GitHub 협업자 초대, 검증한 데이터의 지정 Drive 업로드.
- 착수 시각: 실제 UTC 시계 확인 `2026-11-14T00:53:46Z` = KST09:53:46. 사용자도 행사 시작을 명시했다.
- GitHub 원격의 기존 main/README를 보존해 clone했다. 초기 원격 HEAD `68c6cae08cee6f2ab29a00fe4a1aa0fe95804e8c`.
- 로컬 설정: AGENTS.md·ignore·공유 가능한 env example·로컬 env·줄바꿈 규칙·작업/근거/자료 안내. 앱/API/worker/CI 자체는 이 작업에서 아직 만들지 않았다.
- 작업 분리: 협업자 초대·과학 자료 업로드는 별도 에이전트가 담당. 원격 게시/초대의 실제 결과는 후속 항목에 기록한다.
- 새 팀원 자료: 검사 순서/번역 대상 목록, 구판 기반 규정 템플릿, 참고 사이트/공개물 체크리스트, Notion, 공식 안내 PPT를 수신했다. 실제 앱 테스트·공식 규정 확인 완료와 구분해 검토한다.
- 초기화 작업의 최종 검사·업로드 결과·공식 안내 변경 대조는 아래 후속 항목에 기록한다.

## SETUP-002 · 2026-11-14 · GitHub 협업자 초대

- 원격 계정/대상 저장소 관리자 권한·기존 접근/초대와 요청 계정 존재를 확인했다.
- 사용자가 정정한 ID를 포함한5명에게 일반 write(push) 권한 초대 완료. 원격 최종 조회에서 모두 수락 대기였고 관리자 권한 부여/중복 초대는 없었다.
- 사용자명·초대 ID 등 원격 처리 상세는 내부 기록에 보존한다. 이 작업은 다른 사람의 초대 수락까지 완료한 것이 아니다.

## SETUP-003 · 2026-11-14 · 과학 자료 Drive 업로드와 로컬 배치

- 지정 Drive 아래 프로젝트 폴더에105파일988,141,419B 업로드 완료:원본/참조102파일987,987,584B + 공개 출처/체크섬/README3파일153,835B.
- 원본102개 로컬 SHA256·바이트 검증,Drive 원격 크기/부모폴더/최종 목록(누락0) 확인. 커넥터가 원격 체크섬을 반환하지 않아 원격 암호학적 일치 검증은 주장하지 않는다.
- 기존 공식46자료와 보강56자료를 구분하고 원본 관측/표본·문서·허가문만 옮겼다. VY비교3원본은 기본 TLS 인증검증 재취득 후 이전 SHA 일치. 동일보정 중복은 같은 파일로 연결. π Men FITS는 HEAD기록뿐이라 포함하지 않았다.
- 같은102원본을 이 저장소 raw57/reference39/calibration6개로 복사하고 SHA256·크기를 대조했다. 실행에 쓸 상대경로와 원출처/Drive ID/SHA를 data/manifests에 기록했다. 앱 실제 사용/과학 검출 결과는 아직 아니다.

## SETUP-004 · 2026-11-14 · 팀 전달자료·공식 공지·디자인 참고

- 논리 검사 흐름/5언어 항목,구판 기반 규정 템플릿,사용 흐름/참고사이트/공개물 체크리스트,Notion 홈/운영페이지를 읽었다. 초안 수신을 실제 앱 검사 완료로 해석하지 않았다. 내부 원문은 docs/internal에만 보존한다.
- 공식 D-Day 안내53장 전체를 읽고23:59공식마감/23:55권장,대표1회예약,제출규격·SI고지·Submit성공상태·공식Recognition기준쌍을 규칙에 반영했다. NASA 최신 제출가이드 별도 본문은502로 독립확인하지 못했고 구연도 자료로 대체하지 않았다.
- 사용자가 제공한 세참고사이트의 초기 페이지를 확인하고 디자인 담당의 관찰을 핵심 흐름/정보구조에 연결했다. 전인터랙션 재현·자산 복제는 수행하지 않았다. 조건부 위치밀도/영역확률을 행성 존재확률과 구분하고 추가공유/BGM을 자동필수로 넣지 않았다.
- 사용자 확인:11/14 12:45KST 필수미팅 예약완료.12:40입장,정오내부회의는공식미팅직후통합. 실제 참석/체크인 인정은별도확인이다.

## SETUP-005 · 2026-11-14 · 서버 전달 ZIP 규칙과 초기 설정 검수

- 사용자 요청으로 모든 서버 전달 릴리스는 필요한 코드/빌드/설정/필수데이터·배포/복구 안내·버전/체크섬 목록을 완결된 ZIP에 담아 제공하도록 AGENTS10.1절에 추가했다. 실제 비밀값·내부 원문·캐시/로그는 기본 제외한다.
- 공개 문서의 개인 호칭은 역할 별칭으로 바꾸고 기하 통과확률의 무작위 방향·원궤도 근사·알려진 통과 조건을 보완했다. 독립 검토의 공식 규칙/미팅/ZIP/상태 구분 대조를 반영했다.
- 최종 검수: UTF-8/LF·JSON/로컬설정 형식·문서 링크·Git 제외·원격 연결/기존 tracked 파일 보존·소스102개 상대경로/메타데이터·필수 규칙을 검사한다. 결과는 완료 후 아래 기록한다.
- 현재 작업 범위는 초기 설정·참조문서·자료 배치/업로드다. 앱/worker·과학 적합/이동 검정·배포 가능한 ZIP은 아직 만들지 않았다. 로컬 변경의 commit/push는 이 작업에서 수행하지 않았다.


## SETUP-006 · 최종 확인 2026-11-14T10:18:19+09:00

- 초기 설정 검사 통과: 공개 문서 UTF-8/JSON/상대링크·개인 호칭 제외, env/example 키 일치·비밀값 미출력, env/내부문서/원본/캐시 Git 제외, 작은 manifest 추적 가능, 원격 origin/main과 기존HEAD 보존.
- 소스102개 로컬 경로·크기·앞선 SHA검사,Drive105개 업로드/크기·부모폴더/누락0을 확인했다. 상세 검수는 내부 project_setup_verification.json.
- GitHub 최신 재조회: 요청5명 중2명 접근 수락·3명 초대 대기. 정확한 계정은 내부 초대 결과 기록에 보존.
- 문서 검수에서 발견한 공개 개인 호칭·기하확률 조건·JSON 마지막 줄바꿈을 보완하고 재검사했다. 앱 구현/배포 검사를 수행한 것으로 보고하지 않는다.

## SETUP-007 · 2026-11-14 · Skills 우선 작성·실제 설치·개발 시작 프롬프트

- 사용자 요청: 먼저 루트SKILLS.md에 합의한 스킬/사용 절차를 정리하고 필요한 실제 스킬도 설치한 뒤 상세 초기 개발 프롬프트를 제공한다.
- SKILLS.md를 먼저 작성하고 AGENTS/README 참조를 연결했다. 일반 운영문서·실제 `.agents/skills/*/SKILL.md` 설치·앱 라이브러리 설치를 구분한다.
- 기성10개는 공식 installer로 고정commit에서 설치하고, 프로젝트전용4개는 행사 시작 후 현재 계약으로 새로 작성했다. 설치는 `.agents/skills/`, 원본/설치SHA·버전/수정/라이선스와 검증 결과는 `.agents/skill-lock.json`에 기록했다.
- 외부10개는 원본 라이선스/필수 참조를 보존하고, frontmatter/커넥터 상대경로·접근성 수준 표기의 필요한 수정만 기록했다. K-Dense 저장소MIT와 개별Astropy의BSD 선언은 구분 보존했다. 개별 디렉터리에 BSD 전문/저작권 파일이 없다는 한계도 NOTICE에 남겼다.
- 최종 구조 검사14/14, 설치파일51개 해시/바이트·현재 문서/스킬 상대참조60개 확인. 네이티브4개 검사 시 Windows 기본cp949 디코딩 오류가 있어 Python `-X utf8`로 실행해 해결했다. 설치된 스킬 스크립트/앱 라이브러리는 실행/설치하지 않았으며 UI 자동 발견은 다음 턴/세션 확인 사항이다.
- 상세 초기 개발 프롬프트를 START_HERE_PROMPT.md에 작성하고 현재 FSD/공식규칙·실제 자료·스킬·ZIP·노션 확인 절차를 연결했다. 독립 문서 검토에서 worker 종료 확인·관측 시간계·확률 지표 범위를 명확하게 보완했다.
- 현재 요청은 스킬·프롬프트 준비이며 앱 기능 구현·배포를 수행한 것으로 기록하지 않는다.

## SETUP-008 · 2026-11-14T10:35:25+09:00 · 단일 개발 명세·수시 Notion 확인·천체 출처 후보

- 사용자 지시: 개발 상세를 루트 FSD.md에 통합하고 AGENTS에서 링크/갱신 의무 연결, 새 태양계 출처 자료 검토, 공용 Notion 수시 확인 규칙 반영.
- FSD-0.1에 기능/우선순위·화면·언어/라이브러리/프로세스·자료/품질/좌표/시간·Planet X/통과모형·API/오류·작업/복원·다국어/검사·배포/ZIP·현황을 작성했다. 모두 예정/미구현 상태를 분리했다. import 예정 endpoint를 명세와 AGENTS에 함께 구체화했다.
- AGENTS/SKILLS/README/초기프롬프트와 네이티브4개 스킬을 FSD에 연결했다. 개발 계약 변경 시 관련 절·구현/검증 상태·변경 이력을 같은 작업에서 갱신한다.
- Notion은 작업 시작·기능 단위 완료·3시간 회의 전후·배포/제출 전 및 갱신 알림 때 확인하고 실제 KST/URL·수정/반영·보류 이유를 남기도록 규칙화했다. 이 규칙 작성 중 새 Notion 본문을 재조회한 것은 아니며 마지막 확인 기록을 최신 조회로 바꾸지 않았다.
- 첨부 전체57천체(항성1/행성8/왜행성5/위성41/세드나1/미발견 가설1), 통합출처7개를 별도 후보 manifest/검토문으로 정리했다. 고유34URL 기본TLS GET·HTTP200/title 확인, PlanetX/Pluto/JPL위성표/SednaSBDB의 내용 범위를 일부 직접 대조했다. URL 접속 확인과 개별 물리량/천체력 검증은 다르며 채택한 수치/궤도는0개다.
- 후보자료는 기존 관측102개/최신공식46파일에 합치지 않았다. 57개 전부의3D 구현을 새 필수 범위로 추가하지 않았다. 원문은 내부 폴더에만 보존했다.
- 최종 확인: JSON/UTF-8 LF·작은 공개문서의 실명/개인경로 제외·상대참조60개·스킬51파일 SHA/바이트·기존102파일 manifest건수·Git 공개파일 추적 가능/내부원문/env 제외·git diff --check 통과. 상세 결과는 내부 skills_spec_verification.json에 보존한다. 앱/브라우저/서버 실행이나 commit/push를 수행한 것으로 기록하지 않는다.
- 기록 갱신 뒤 공개 문서12개 UTF-8/LF·끝줄/공백, 문서 상대링크33개, lock/AI/후보 JSON 및 git diff --check를 추가 확인했다. FSD30,738B·초기프롬프트21,218B, 실제 SKILL.md14개다.

## SETUP-009 · 2026-11-14T10:43:56+09:00 · Space Time 주 참고·자동 포커스 명세

- 사용자 최신 지시: Space Time을 특히 강하게 참고하되 차별화, 천체 선택 즉시 별도 스크롤/이동 버튼 없이 부드럽게 화면 중심으로 이동.
- FSD-0.2의2.1–2.4절에 우주 중심 작업대·참고 우선순위·SPHEREx 관측/가설/문헌분포/근거복원 특화 경로와 UX01–06을 작성했다. 자동 카메라의 재선택/중단·마지막 요청·프레이밍·방향층·reduced-motion·관측/시각/가설 보존을 명세하고 AGENTS9절·초기프롬프트C에 연결했다. 구현1–6/축소 순서는 유지했다.
- 출처 https://space.pointdynamics.com/app/ 를 기본 웹 열람과 실제 Chrome으로 확인: 기본3D·Explore·검색Pluto→자동 이동/명왕성 정보, 별 Evidence탭의출처/방법/한계를 읽었다. 자동 이동 초기 상태에서 Evidence선택은 완료되지 않았고 새 상태를 확인해 다시 실행했다. 모든클릭/동작·수치/성능·앱전체 기능을 검증한 것은 아니다.
- 사용자가 보고한 선택/스크롤 불편과 실제 검색 경로 자동 이동 관찰을 구분했다. 상대 사이트에도 관측/외계행성/증거 UI가 있어 기능 부재/우월성을 주장하지 않는다. 자산/코드·음악을 복사하지 않았다.
- Notion실제 재조회: 홈 https://app.notion.com/p/NASA-Space-Apps-Seoul-2026-417d0a43a505819c8beff58e76776f1d?source=copy_link →기기·브라우저QA https://app.notion.com/p/417d0a43a505814984a1ebc8452f1c2d →화면·버튼·데이터·차트·3D점검 https://app.notion.com/p/3D-417d0a43a50581d7b3e7d3a94c2e4b4e?pvs=24 를읽었다. UI수정시각은QA폴더11시간전/세부29분전이라는상대표시뿐이라정확한수정시각은미확인이다.
- 세부QA에는실제빌드후3D로딩/회전/확대/선택·화면/차트·값/단위/시간/출처·오류/복원·기기/브라우저/언어/기대·실제/스크린샷기록이있고상태는미시작이었다. UX/QA명세에연결했으며노션을편집하거나앱테스트통과로바꾸지않았다. 전하위페이지최신확인은주장하지않는다.
- 이번 변경은문서명세이며우리앱/자동카메라구현·실행·배포완료를뜻하지않는다. 링크/문서정합·공개정보검사를이어서확인한다.
- 완료 검수: 변경문서7개 UTF-8/LF·끝줄/공백·개인 식별/경로 제외, JSON·상대링크14개·git diff --check 통과. 독립 검토로 새 천체 선택 시 이전 분석의 원래object_id 보관/오표시 방지를 추가했다. 우리 앱 UI 검사는 미수행이다.

## DEV-001 · 2026-11-14 · 실제 ε Indi B 원본→품질→근거 저장/새 세션 복원

- 요청: AGENTS→SKILLS→FSD→START_HERE 전체 순서 읽기 후 첫 경로를 실제 구현·실행·브라우저검사하고 명세/기록 갱신. 첫 실제시계 기록10:46:37 KST, 완료 전 검사 기록10:58 KST. 기존HEAD68c6cae와 README수정/미추적준비파일을 보존했다. 초기 앱코드는 없었고 commit/push·서버/DNS·외부제출은 수행하지 않았다.
- 적용스킬: documentation/spherex-data-contract/astropy/testing-strategy/astrometry-motion-qa/validate-data/spaceapps-browser-qa/ux-copy/code-review/architecture/deploy-checklist/spaceapps-evidence-release. 실제SKILL.md12개 SHA가 skill-lock과 일치. 과학reader·프런트·독립자료/코드검토를 소유파일별로 병렬화하고 부모가 계약/실행을 대조했다. 내부v1.7 전체와 공식변경은 검토에만 사용했고 공개원문/과거스크립트·그림을 복사하지 않았다.
- 변경파일: science/spherex.py, api/{main,models,service,storage}.py, worker/process.py, web/의React/TS/CSSModules·locale5개·상태/API·검사, contracts/openapi.json, tests/test_{science,api,restore_edges}.py, deploy의Docker/compose/실행복구/패키지, 의존성lock, FSD/README·자료/근거/AI기록·ADR-001·외부고지.
- 실제입력: manifest S01 DR1 `2025W18_1B_0238_4/D6` 66,456,000B, S02 QR3 `2026W39_1A_0578_3/D6`68,112,000B, S10 D6 SWCSv5 33,312,960B. 전체SHA/바이트를 reader와 저장/복원에서 대조했다. VERSION7.0.5·UTC DATE-AVG·IMAGE/FLAGS/VARIANCE/ZODI·EPSF441행·주SIP/대체WCS·실제CWAVE/CBAND를 읽었다. SIMBAD기준J2000고유운동 예측은 누락관측자시차/RV/공분산과 함께 저장했다.
- 실제출력: 원본81×81(S01),80×81(S02,경계81픽셀잘림)·native offset·원본정수FLAGS·비유한null, r≤3의29/32픽셀·NF1/1·T0/1·SOURCE29/32. 파장4.8321886063/4.8263525963μm·대역폭0.0366896614/0.0353709720μm. r3창잘림0과 전체cutout잘림을 구분한다. 원본L2 IMAGE표면밝기·ZODI미차감, 각영상표시명암 범위/대비만 변경하며 영상정합/광도정규화하지 않는다. 과학상태association_insufficient, 정량측정not_validated다.
- 실행구조: 단일API작성자+OS잠금/RLock, 별도spawn과학worker1개/Pipe, 최대대기8·실행1. 입력/attempt·결과정본SHA확인→원자적공개→succeeded. 취소는 안전반환에서 결과폐기, 종료확인후재시작미완료interrupted. 근거JSON은 원본/보정·결과/조건/판단/5언어표시조건/버전을 포함한다. 로컬정본누락·알고리즘/manifest변경은재계산필요, 변조/미지원스키마/잘못된중첩입력은거부한다.
- 검사환경: Windows,Python3.12.3,Node22.17.0/npm10.9.2. FastAPI0.162.7/Uvicorn0.54.0/Pydantic2.14.3/Astropy8.0.2/NumPy2.5.4/SciPy1.18.1. React19.2.0/Vite7.2.2/TS5.9.3/Playwright1.56.1. 실제설치전체버전은 requirements.lock.txt와 web/package-lock.json, 서버런타임은 requirements.runtime.lock.txt에 고정한다.
- Python: `.venv/Scripts/python -X utf8 -m pytest -q`21통과(과학10/API5/복원엣지6). 실제원본회귀, 주SIP의대체WCS오염방지, 플래그중첩/미선언비트·단위/해시/경로탈출·비유한·근거변조/파일누락/보정변경/버전·취소/재시작·실제API종료후동일근거복원 포함. Starlette TestClient의httpx→httpx2전환예고1경고는 남아 있으며 실패가아니다. Ruff check/format,git diff --check통과. 없던검사를성공으로기록하지않았다.
- 프런트: `npm --prefix web run typecheck`, `npm --prefix web run build`, `npm --prefix web test`(Vitest3), `npm --prefix web run test:browser`(실제설치Chrome,1440×1000,2개)통과. 실제날짜/파장선택→A/B원본→품질29/32/EPSF/보정→5언어의동일결과→깜빡임시작/정지→판단저장→JSON/CSV다운로드→완전히새브라우저context에서JSON가져오기→같은result/조건/판단/근거ID복원. 나머지4대상의미검증/출처목록과원래분석으로복귀, 실제지연응답의저장/import가새세션을덮지않는검사도통과했다. 스크린샷 `var/browser-results/workbench-evidence.png`를부모가직접열어날짜/영상/상태/근거를확인했다. 초기flat목록타입불일치·늦은응답·일부UTF8문자문제를수정하고최종빌드/검사를재실행했다.
- 실제브라우저예시 result `cmp_d88083664b6fd27592eb68c1`, evidence `ev_18c1e723071d4bc695cb22c262dad4357`. 자동검사로생긴근거이며 사람과학판정/팀내사용자과업검사완료를뜻하지않는다. 정확한전체원본SHA·설정은실제evidence JSON에보존한다.
- Notion: 웹도구의홈접근실패후native앱에서10:49–10:50 KST에 홈/기기QA/상세QA/기록·이슈/이슈보고를읽었다. 상세QA표시수정시각오늘10:12·상태미시작, 새범위변경없음. 홈의구판6명개별슬롯문구는공식대표1회예약과충돌해적용보류. 완료후10:55:40–10:56:44에이슈보고페이지(`https://app.notion.com/p/417d0a43a5058140b867fcf93b1f81f3`)동일본문만재확인했고홈/QA는창전환/geometry실패로재조회미완료. 전체확인은10:49–10:50을마지막으로유지했다. 쓰기/공지/댓글/예약변경없음. 홈/QA URL은SETUP-009와동일.
- 제한/다음작업: 자유좌표/시간검색·공식4대상실제품질실행·공개서비스검사·F03최소3D/Pluto·F04가설/문헌분포·F05TESS미완료. 원어민/팀원2명과업검수미수행. Docker Linux엔진연결실패로컨테이너/서버/이미지digest미검증. 이번첫경로의로컬성공을전체F01/대회제출완료로올리지않는다. 다음순서는기존F01잔여/자료추적을보호하며F03연결이다.
- 서버전달준비: 첫경로의전체코드·검증빌드·필수3원본·lock/설정·출처/라이선스·실행복구안내를하나의ZIP으로묶고깨끗한폴더에해제해검사한다. 실제해제실행/ZIP해시·크기는아래완료항목에기록한다. `.env`/내부문서/.git/계정/캐시/실행근거는포함하지않는다.
- ZIP실행검사11:01:17KST: `deploy/verify_release.py`로새폴더실제해제·파일140개SHA/바이트/대소문자/상대경로·필수3원본·제외대상없음을확인하고, 별도Python3.12가상환경을새로만들어런타임lock의의존성을설치했다. 해제본자체를8011번에서실행해health live/ready200·UI정적빌드·원본목록·실제worker비교29/32·근거201·내보내기·import동일값/판단복원통과. result `cmp_d88083664b6fd27592eb68c1`, test evidence `ev_b99fe5c4a7844c978c5d01c1813106f4`. 임시검사서버는종료했다.
- 전달대상: `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.1.0_20261114_105939KST.zip`. release_manifest에실제base commit/dirty tree·시각/알고리즘·3입력·파일SHA와검사범위를기록한다. 최종ZIP자체SHA/실측바이트는동명 `.zip.sha256.json`(ZIP밖)에,최종해제검사는 `.verification.json`에기록한다. ZIP의자기해시를ZIP안에넣는순환기록은하지않는다. 원본/결과/정밀측정/공개서비스완료를혼동하지않는다. Docker/Linux·실서버는실행하지않았다.
- 최종ZIP확인11:02:46KST:142파일(자기manifest제외141개SHA검증),118,521,989B, SHA256 `1852e152a3fc352dd86f0d8f7f618df8e6363ca7ecae1b0596f237117039fa89`. 최종ZIP을다시새폴더에해제해앞서신규설치한독립런타임으로health/원본비교/저장/복원통과. 외부검증기록에test evidence `ev_d08b6afb2b1b4dcb89b6affb40a03330`을남겼다. 이마지막체크섬기록은순환을피해ZIP밖작업기록에만추가한다. Python소스16개Ruff check/format·Git diff공백·TLS우회패턴없음·env/내부문서/var Git제외를최종확인했다. 로컬기본앱은127.0.0.1:8000에서확인할수있게두고임시해제검사프로세스는종료했다.

## DEV-002 · 2026-11-14 · 우주 탐색을 기본 화면으로 연결

- 사용자정정: 독립관측작업대가제품기본화면이아니라자유롭게우주를탐색하다선택하면관측/품질/근거가열리는경험이다. DEV-001검증조각을그지점에서끝낸문제를인정하고기존FSD2.1의기본우주화면을실제진입점으로구현했다. 작업시계11:05:51KST확인. 원본/Git사용자변경과기존εB/저장복원기능을보존했다. 핵심범위/축소순서는바꾸지않았다.
- 적용: documentation/architecture/spaceapps-browser-qa/ux-copy·원본계약/Astropy/astrometry-motion-qa/validate-data/testing-strategy/code-review·릴리스스킬. 장면/태양계원출처·Pluto원본/독립검토를서로다른소유파일로병렬화했다. 실제설치파일/스킬은기존lock을사용했으며새AI API/이미지생성/로그인/외부메시지·배포는없다.
- UI: App의기본을전체화면UniverseScene으로바꾸고기존작업대는ObservationWorkbench로보존해같은scene안에연결했다. 천체클릭/검색/목록→즉시정보갱신→현재위치부터부드러운자동포커스,드래그회전/휠/우측팬/WASD·방향키/QE,빠른재선택/사용자입력취소,reduced-motion/좁은화면·태양계전체복귀를구현했다. 패널을닫을때scene/카메라를다시만들지않는다. 천체별workspace에관측/판단을보관해εB↔Pluto전환에도소속/값을유지한다.
- 실제장면출처: science/solar_system.py + data/manifests/solar_system_ephemeris.json(172715B;SHA83fb1ac397b4c64e36377965efe57f9a1bf19e5b1a60ce290a12b39411613a8a). 정상TLS로JPL Horizons9원응답·물리량표·응답SHA/조건을보존했다. 태양중심/천체중심J2000황도기하벡터AU/AU-day,11/13·14·15·16 00:00UTC정확한4표본(72시간)만사용한다. 보간/외삽없음. 천체별실제응답천체력source를그대로기록했다. 지구/목성/Pluto의별도ICRF/km조회교차검사약4.5e-15AU(같은JPL모형의단위/축검사;독립천체력모형검증아님).
- 장면표현: 실제태양+8행성+Pluto와εB방향층(총11객체). 거리18ln(1+rAU),축[x,z,-y],반지름확대·외관/조명·장식별배경은설명용으로고지한다. 평균반지름/불확도/각원출처는정보패널에서물리단위km로별도표시한다. εB는ICRS고유운동방향을고정황도회전으로표시하며실제거리를만들지않는다. 카메라는SPHEREx관측자가아니며실제노출DATE-AVG는모형시각변경과무관하다. 새시각조회중에는현재표시시각을알린다.
- Pluto실제자료: S12 QR3D3 2026W40_1A_0373_4→S14 QR3D3 2026W40_2A_0244_1,보정L051,전체원본SHA/바이트·EPSF451행확인. science/pluto.py + pluto_ephemeris.json(49392B;SHA8083b6fbf91ce242ce4e5355c2d2a6e9df994fba34e246a81daf848ab71f8683). 실제DATE-AVG의JPL SPHEREx관측자500@-163182 예측좌표/원응답·TLE궤도제한을보존했다. 예측변위72.3269690287″는실측이동이아니다. D3SWCSv5 bilinear파장2.3132327492/2.3666596870μm,폭0.0575278851/0.0590125858μm;파장/PSF차이의정량밝기비교를보장하지않는다. 11:11:18KST현재DR1DataLink보정33MB전체를검증해기존QR3취득L051와동일SHA임을확인했다.
- 저장/복원: optionalSession.universe_context의선택대상·4시각·장면출처SHA·유한camera position/target·solar-display-v1·패널상태를기존정본JSON에추가한다. context가없던DEV-001근거도호환한다. 장면/Pluto예측manifest·알고리즘변경은재계산필요다. 서버/브라우저카메라범위검사를동일하게맞췄으며camera눈위치/시선겹침·반대방향보간·언마운트후이전응답·새세션/대상전환을검사했다.
- 코드/계약: web/App.tsx/UniverseScene/sceneMath/UniverseShell CSS·ObservationWorkbench/기존frame/store/type/5locale,science/solar_system.py/pluto.py,api/models/main/service·worker,OpenAPI,새과학/API/브라우저검사,ADR-002,FSD0.4·README·AI/데이터/근거·v0.2ZIP설정을갱신했다. Three.js/@types0.180.0을실제설치·정확히lock했다. Python/Node버전은DEV-001과동일이다. runtime npm audit--omit=dev는취약점0이었다(개발의존성전체audit과구분).
- 검사: Python전체54PASS(기존21+태양계13+Pluto8+우주/Pluto API12),Ruff check/format,TSstrict/Vite빌드,Vitest9(계약3/카메라수학6)PASS. 실제Chrome5고유시나리오PASS: 기존εB실관측/5언어/새context카메라복원·늦은저장/import방지2개,우주기본화면/클릭·검색·빠른포커스/드래그·휠·키보드·全10태양계라벨·reduced-motion/좁은화면/overview·대상별workspace/모형시각/Pluto실노출3개. worker완료를기다리는5초assertion1건은데이터도착후15초명시대기로재검사통과했으며성능SLA/과학임계값완화가아니다. 새세션firstpath는최종strict API/빌드로다시검사한다.
- 시각증거: var/browser-results/universe-default.png,universe-pluto.png,universe-observations.png,workbench-evidence.png를직접열어확인했다. 초기설명/키보드도움말겹침·외곽천체화면잘림·평면처럼보이는조명을고쳤다. 최신기본화면은분석카드없이우주/검색/시각을보여주며선택후맥락패널만연다. 전체관측이동/광도성공이나전우주/전체57객체구현으로확대하지않는다.
- Notion: 작업시작11:06:51KST·완료후11:20:27KST에현재관련이슈보고페이지https://app.notion.com/p/417d0a43a5058140b867fcf93b1f81f3 를포커스변경없는background읽기로재조회했다. 상태미시작·환경/재현/기대/실제·P0–P3·증거요구동일,새변경없음. 정확한최신편집시각은미제공. 홈/QA/전체하위페이지는이번최신조회로주장하지않는다. 댓글/체크/내용변경이나창활성화없음.
- 남은범위: F01자유좌표/공개배포/다른4대상품질, F04개별PlanetX/별도문헌분포,F05TESS,사람/원어민검수,Linux·실서버/이미지digest. HiPS는선택범위이며이번에는채택하지않았다. v0.2전달ZIP은기존출력을덮지않고필수6원본·2JPLmanifest·코드/빌드/lock/설정/라이선스/실행복구안내를포함해새폴더해제/실행검사후아래기록한다. 공개서버/Git원격변경없음.
- 최종strict API/빌드회귀: 11:24KST직접Playwright CLI의fresh-context대상1개를재실행해40.7초/1PASS(실측전체사용자시나리오시간이며서버응답SLA아님). 새scenehash필수계약으로도5언어/원본품질·근거JSON/CSV·완전히새브라우저camera/epoch복원·공식4대상미검증경로가통과했다. 코드/데이터변경에영향없는전체suite반복은하지않았다.
- ZIP1차실행확인11:25:45.888KST: `NASA_SPACE_APPS_CHALLENGE_v0.2.0_20261114_112505KST.zip`을깨끗한폴더에실제해제해160포함파일SHA/바이트/상대경로/대소문자·제외대상없음을검사했다. 이전에신규설치검증한격리Python3.12런타임을재사용해해제본API/worker를8011에서실행했다. health live/ready200,scene11객체/4시각/출처SHA,εB29/32품질·저장복원,PlutoEPSF451·실제worker/근거/카메라·시각복원PASS. εB result cmp_d88083664b6fd27592eb68c1, Pluto result cmp_0d749ea3f9ec3a8da925dc44. 상세ephemeral근거ID/최종checksum은외부검증JSON에있다. 임시검사서버는종료했고로컬8000앱은유지한다. 검사결과/문서를manifest에확정한최종ZIP을한번더해제검사한다.

### DEV-002 추가 사용자 요청 · 전체 궤도 안내선

- 사용자가진행중“궤도도약간선으로싹다”를요청해최종배포전추가했다. 태양계수성~명왕성9개의가는선·선택강조·기본on/전체toggle을같은scene에연결했다. 태양은태양중심원점이고εB는검증된방향층이므로새궤도를만들지않는다. 선이천체선택/카메라/관측조작을가로채지않는다.
- science/orbits.py와solar_system_orbits.json(105261B,SHA b58622f6ce82c686c644c26c48625ab3d3af8a36fb426790939ab6473ba6c623)에9Horizons ELEMENTS원응답/쿼리/시간계/요소·GM을보존했다(취득11:29:38KST). 정확한4UTC사건을TDB JD로변환해조회하고257점닫힌접촉궤도Kepler안내선을계산했다. 현재위치를첫점으로하고모든점에기존거리압축을적용한다. 장기적분실제궤적/후속시각예측이아님을5언어/출처에표시했다.
- 별도P/Q기저·평면/타원식으로9천체×4시각36개를독립수식검산했다. 기존JPL state와궤도첫점최대잔차5.86155e-12AU,평면잔차max4.22023e-15AU,타원식잔차max1.33227e-15. 같은JPL자료/수식의수치일관성이며실제궤도정밀도보증아니다. 시간계·단위·기준계·Sunfocus·현재위상·폐곡선검사12개PASS.
- GET/universe에각body.orbit·원요소/원출처·orbit_algorithm_version/orbit_manifest_sha256/exclusions를추가했다. 근거universe_context에show_orbits와궤도원출처SHA를저장/복원하고변경시재계산필요를표시한다. 기존scene/관측/작업은보존했다.
- 최종검사: Python67PASS(이전54+궤도12+API1),Ruff check/format23파일,Pydantic/OpenAPI/TS빌드,Vite빌드,Vitest10(기존9+선점별좌표변환1)PASS. Chrome새2개PASS:실제9궤도/257점/폐곡선·첫점/현재위치·전체표시전환카메라보존·Pluto포커스,표시off근거저장→새context에서카메라/출처/표시off복원→다시9개표시. 앞선5고유시나리오와합쳐7개고유브라우저흐름을검사했다. 최종추가자바스크립트는index-Dujq5U8M.js,물리/관측사진생성없음.
- 시각증거 var/browser-results/universe-orbits.png,universe-pluto-orbit.png를주에이전트가직접열어가는선과기울어진Pluto안내선·선택강조/가독성을확인했다. 궤도요청전기본/관측스크린샷은앞선검사기록이며현재기본화면은궤도on이다. 11:25의궤도미포함1차ZIP은최종전달본으로쓰지않고새시각의완결ZIP을다시만든다.
- 궤도포함ZIP실행11:35:23.771KST: `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.2.0_20261114_113413KST.zip`을새폴더로해제해163개포함파일(자기manifest제외)SHA/바이트/경로와제외목록을검사했다. 같은검증된별도가상환경에서health·11객체/4시각/9궤도·εB와Pluto실제worker·근거/카메라/시각·궤도표시off복원PASS. 별도Python의존성버전은앞선격리신규설치와동일한runtime lock을재사용했다. 임시8011프로세스종료. 최종manifest에67/10/7검사와해제결과를확정하고새ZIP을다시해제해정본파일해시/대표경로를확인한다. 최종ZIP의SHA/바이트는자기순환을피해ZIP밖동명checksum/verification JSON에남긴다.
- 최종확인11:36:18.020KST: 동일최종ZIP을다시새폴더에해제해163개포함파일SHA/바이트·대표실행/저장복원PASS. ZIP총164파일,236,678,269B,SHA256 `acec9d6e1feac9ffdc31e2556c955ed7116ac153c9b513f3be15cb62e0f2ad64`. 별도파일해시재계산일치와로컬8000 ready·9궤도/osculating-kepler-guide-v1 응답을확인했다. 임시검사서버종료,로컬앱은검토가능하게유지. 이마지막자기ZIP해시는순환방지를위해ZIP밖기록에만추가한다. 공개서버배포·Linux검사는수행하지않았다.

## DEV-003 · 2026-11-14T13:23:48+09:00 · 기존 완성본 commit 후 시간 재생·정지

- 사용자 요청: 현재 완성된 작업을 먼저 commit한 다음 시간에 따라 천체가 움직이는 재생/정지를 추가한다. 실제 Git 조회로 `54756ca`, commit시각2026-11-14 13:12:27KST,140파일 변경을 확인했다. 이 기준을 확정한 뒤 새 구현을 진행했으며 원격 push·history rewrite·공개 서버 배포는 수행하지 않았다. 이전 DEV-001/002 실행·ZIP 기록은 그대로 보존한다.
- 적용: 기존 documentation·원본/Astropy·과학검산·브라우저/검토 스킬을 필요한 범위에서 사용했다. 과학 코드/검사·새 검산manifest, API/계약·배포, 프런트 시간/카메라, 독립검토를 파일 소유별로 분리했다. 새 패키지/자격증명·AI API·이미지/영상/음성 생성은 없다.
- 계약: FSD-0.6/v0.3.0,2026-11-13 00:00~11-16 00:00UTC의72시간만 연속 표시한다. 원본 네 시각의 아홉 천체 위치AU·속도AU/TDB-day를 변경하지 않고 `display-hermite-v1` bounded cubic Hermite와 그 미분을 쓴다. 원본 매듭은 원 배열을 직접 반환하며 중간 시각은 표시 보간으로 알린다. UI는UTC, 계산은TDB 구간이다. εB 방향은 정규화 보간이며 실제 거리를 생성하지 않는다. SPHEREx 촬영 시각·관측자·원본/품질·판단은 그대로다.
- UI/API 연결: 초기 `/universe`와 약9KB `/timeline`을 읽고 클라이언트가 오프라인 계산한다. 매프레임 API/Horizons 요청은 없다. 실제1초당 모형1/6/24시간(기본6),최대약30fps 상태갱신이며 보장SLA가 아니다. 시작정지·끝정지/끝에서재생시처음·수동탐색/숨김탭/저장시정지·import/새세션정지를 적용한다. 포커스요청과 tick을 분리해 시간갱신이 자동이동을 반복하지 않게 하고, 선택추적은offset유지·수동조작은추적해제한다. 전체 통합 동작은 아래 최종 검사에서 확정한다.
- 궤도/복원: 아홉 접촉궤도 안내선은11/14 00:00UTC 기준으로 고정해 이동시각과 별도 표시한다. 기존 원소/응답/SHA를 바꾸거나 매프레임 새 궤도를 추론하지 않는다. UniverseContext에 optional timeline_algorithm_version·playback_rate_hours_per_second·playback_paused:true·follow_object_id를 추가하고 연속시각/원카메라·추적조건을 저장해 정지 복원한다. 과거 네 원본시각 context는 호환하며 버전 없는 연속시각은 정상복원으로 처리하지 않는다. 실행 스키마/OpenAPI/TS 계약은 통합 검사와 함께 확정한다.
- 실제 검산자료: 정상TLS·bounded순차요청으로9천체×세 중간시각의 별도 Horizons VECTORS/UT27표본을 취득했다. `timeline_validation.json` 취득기록13:14:35KST,86812B,SHA256 `6562f9898ba8716d41595f1b9288c0cf364b3ec4119e02cafb6a961a19527f99`. 원응답/쿼리/해시·실제위치/속도·보간 차이를 보존한다. 최대관찰 위치차이 수성18.986654km,목성6.944946km,명왕성5.120192km,지구0.052990km. 같은JPL동역학 자료의 별도시각 조회 비교이며 전구간 상한·물리적 불확도·독립천체력 모형 검증이 아니다. 기존102 관측/참조 수에 더하지 않는다.
- 현재 확인된 검사: `.venv/Scripts/python -X utf8 -m pytest -q tests/test_timeline.py`17PASS(1.04초),대상Ruff PASS. 원본매듭/속도·출처보존,알려진cubic/미분·TDB단위,지원범위/명시적시간대,거리없는방향층,27원응답/해시와차이재계산,브라우저UTC구간근사와서버TDB의표본차이를 확인했다. 독립검토도Hermite수식/단위·원본/범위·표본검산한계를 대조했다. API 통합 전체수·프런트수학/빌드·Chrome 새4시나리오·완결v0.3 ZIP해제/실행 검사는 진행 중이며 아직 통과로 기재하지 않는다.
- Notion 시작확인13:13:10KST: 관련 이슈보고페이지 `https://app.notion.com/p/417d0a43a5058140b867fcf93b1f81f3`를 background로 읽어 기존본문과 동일함을 확인했다. 완료13:26:49KST에같은관련페이지만재확인했다. 홈/전체QA 최신조회나 정확한편집시각 확인으로 확대하지 않는다. 페이지쓰기/댓글/예약변경 없음.
- DEV-003 통합확인: Python100PASS(23.52초,기존Starlette경고1),Vitest18PASS·TSstrict/Vite,실제Chrome전체11경로PASS(2.5분). 기존원본/품질·5언어·늦은응답·궤도·카메라와 새4재생/정지복원을 함께 검사했다. 숨김탭은headless의 hidden상태+visibilitychange 주입검사로실제OS탭전환과구분한다. timeline-manual-camera.png/timeline-observation-snapshot.png를직접열어확인하고range폭/Play hover대비를수정했다.
- 문서 동기화: FSD·README·자료/근거·AI MD/JSON·외부고지를 함께 갱신했다. 기존F01자유좌표/다른4대상 정량품질·F04/F05·팀원/원어민검수·Linux/실서버 제한을 유지한다. v0.3 ZIP의 실제 경로/SHA/바이트·해제대표경로·최종 검사 결과는 패키지 완성 후 추가한다. 현재 준비를 완결 배포/공개서비스 성공으로 표시하지 않는다.

## DEV-004 · 2026-11-14 · 표면·고리·위성·외계행성 및 GitHub 체크포인트

### 13:59 KST 현재 확정 상태 — 아래 착수/중간 기록을 보완

- Git 요청 완료: `5d3a450dfd3fb82946387e03e31b2c01e56a8bb4`, 메시지 `MVP입니다`, commit2026-11-14 13:51:47KST. 지정 origin/main에 일반 push하고 원격 SHA를 대조했다. 체크포인트 뒤 지도 metadata/API/UI·문서 수정이 이어지므로 이후 최종 commit이라고 하지 않는다. force/history rewrite·공개 앱 배포·비밀값/관측원본 Git추가는 하지 않았다.
- 확장 자료 최종:476개 유일ID(위성468+추가왜행성/후보8),471위치지원(위성463+8),5미지원 Daphnis/S/2009 S1/S/2025 U1/MK 2/Xiangliu. manifest1,186,595B/SHA `34afdc84d913e7e2089b06d9e0518acff011713df3ac7185b7372ba0ef6ef7a5`,509참조원본19,411,029B/52,527매듭. 위성종류/부모·mean-table중복/누락/별칭과 별도NASA/논문7위성 출처를 보존했다. TNO5위성+4PRIMARY를 같은 솔루션의 실제 중심으로 맞추고 이전 barycenter원본은 superseded source로 보존했다.
- 과학 확인: 확장 pytest20PASS(3.98초)·Ruff,별도 읽기검수에서476ID유일·471전부 실제 raw target/parent/UTC양끝·반지름양수/미상null·5미지원knots[]·모든SHA/bytes/rootbounds PASS. 별도 Sun-centered KM-S5조회와 PRIMARY+상대벡터 합성의 최대 표본차이0.0000989372km는 내부 일관성이지 실제2026정확도/전구간오차보증이 아니다. 역사적 관측기간·2025예측불확실성·Weywot 외삽 경고를 원문/solution_notes에 남겼다.
- 외관 최종 metadata:31지도102,820,603B/고리4계,manifestSHA `4c0f0a03eda761d8bbdcfc57db09874b4ca2ab6416fa94b189c4f7cdefa3458e`. 채택원본무가공·촬영기간/credit·미관측영역·지도창UV 보존. 31지도에14Nov기준 PCK극방향·자전율을 연결하되 texture경도/위상정합은 미검증이다. Earth IAU모형은 정밀EOP가 아니다. Ceres는 USGS공식1200×380rectangular HAMO clear-filter preview를 채택하고,취득한 DLR3798×1881 타원전구preview는3D텍스처로 쓰지 않는다. Enceladus8230px파일/7981px지도창·Charon9520px원본 등의 예외를 실제 크기대로 기록했다. 외관 pytest11PASS(9.53초)·Ruff.
- 렌더러 계약:선택천체+부모행성 최대2지도만고해상도,나머지설명용LOD·위성선택전점/간략도형,선택후상세크기확대. 토성프레이밍은prominent/faint고리까지이며 very_faintE/G전체반지름으로과도하게벌리지 않는다. 물리반지름/낮은opacity는보존하고 좁은고리1px중심선은표시보조임을고지한다. 외계행성전환때태양계visibility:hidden/RAF정지로원카메라/WebGL을보존한다.
- 외계행성:NASA공개6470개/4862모항성계/115원본페이지13,740,795B,manifestSHA `5b803ea060a52b50ca9afa61ec1a49ee889a7617864c5ba51469e828757f4c06`. TAP PS기본해취득과구분하고원문acf.display_name·추정질량/반지름·누락·행별source를보존한다. 방향층은미검증거리/epoch를3D거리로만들지않는다. 모식도 방향/위상·24h자전은가정이며 보고된주기표시재생은현재위치추론이아니다. 분류별GLSL지형/구름은설명용코드렌더링이고 실제해상표면/새관측/존재확률은아니다.
- 현재 통합확인:외계행성원본/API6PASS,프런트27단위/strict/Vite PASS. 개별Chrome외계행성1경로16.5초PASS(전체목록·TRAPPIST-1 7행성·설명용표면/주기재생·태양계복귀);수치표시의소수3자리잘림을고쳐6.101013d/.02925au등원값을보존했다. Earth/Saturn/Moon301/Uranus지도ready·GLSL/JS오류0을실제브라우저에서확인했다. parent_id허용목록의 TNO부모 누락은문서/API대조에서발견해통합담당에게전달했다. 31지도bytes/SHA·468위성/미지원5·6TNO부모·6470외계행성의API회귀와 전체Chrome/Python·v0.4완결ZIP/해제실행은진행중이며 최종수는후속확정한다.
- Notion 실제조회:13:57:21KST에 관련 이슈보고페이지 `https://app.notion.com/p/417d0a43a5058140b867fcf93b1f81f3`만 background로 읽었다. 기존 미시작/P1·환경/재현/기대/실제·증거규칙에서 새변경을관찰하지못했다. 이는진행중늦은조회이며 착수gate시점조회가아니다. DEV-003의13:13/13:26을재사용하지않고 홈/전체QA·정확한편집시각을확인했다고하지않는다. 포커스/창이동/쓰기없음. 완료조회는실제완료후별도확정한다.
- 문서 통합:FSD0.7/v0.4.0의2.7/8.2/API/QA11–13/현황·README·자료/근거·AI MD/JSON·외부고지를같이갱신했다. 과거v0.1/v0.2ZIP과DEV-003검사이력은보존한다. 공개서버/Linux·사람/원어민검수·F01잔여/F04/F05·최종v0.4ZIP을완료로올리지않는다.

### 착수·중간 진행 기록

- 사용자요청: 공개자료/논문으로 행성표면·고리/위성·추가행성구현, 범위답변은태양계왜행성/위성과태양계밖외계행성 **둘다포함**. 원본/Git와기존실노출/근거를보존하고FSD0.7/v0.4.0에확장계약을반영한다. 원래미완료범위를조용히완료로변경하지않는다.
- 공개NASA6470행성/4862모항성계/115페이지13740795B취득. 원페이지source목록정본SHA `4b8361bb95ce146780faf6aeed6fd9d73b2344ae77fd5366a4499f8038a03b85`. 원본data/reference/catalog/nasa_science,Gitmanifest3955802B. TAP와별도공식호스트timeout후공식NASA REST로대체했으며PS일관문헌해취득주장없음. 제목공백4개/Debug오류제목4개를원문display_name으로대조해6470개정체성을보존했다.
- 확장태양계: 위성468+추가왜행성/후보8=476등록,463위성+8=471위치지원. Daphnis/S2009S1/S2025U1/MK2/Xiangliu5개는원응답과사유를보존하고위치미생성. 원참조509개19411029B/52527시간표본,manifest1186595B SHA `34afdc84d913e7e2089b06d9e0518acff011713df3ac7185b7372ba0ef6ef7a5`. TNO위성/PRIMARY의별도KM-S5조회합성차이max0.0000989372km는내부정합이며실제불확도상한아님. 실제reader/과학20PASS/Ruff.
- 외관31지도/4고리원본102820603B준비. 관측/레이더/대표대기와미해상설명용외관을구분하고선택시고해상도로드한다. 실제지도원본무가공·SHA/출처/날짜/미관측영역·지도창UV를보존한다. 새5언어문구의Windows pipe인코딩손상을발견해UTF8파일입력으로교정하고??/대체문자없음을확인했다.
- 현재검사: 외계행성실제원본/이름/누락/추정/경로탈출/API6PASS,확장과학20PASS,프런트수학27PASS·TSstrict/Vite. GPU사전검사에서ringshader중복include와/textures route누락을발견해교정한다. 새표면/위성/외계행성종합Chrome·완결ZIP·Linux/공개배포는체크포인트에서완료로주장하지않는다.
- 사용자추가Git요청: GitHub에안보인다고질문하며 `git commit -m "MVP입니다"`를지정했다. 실제조회로54756ca는로컬,origin/main은68c6cae임을확인했다. 지정메시지로체크포인트commit하고지정origin/main일반push후SHA를대조한다. .env/원본FITS·내부문서·개인정보·var/tmp/artifacts는staging에서제외하고force/historyrewrite는하지않는다. 결과는후속기록한다. push후확장통합검사를계속한다.

### DEV-004 완료 후속 확인

- 실제 Chrome 지도3경로PASS(1.8분),외계행성1경로PASS(16.5초). 모든31지도HTTP102,820,603B/SHA일치,Earth/Saturn/Uranus/Neptune/Titan/Charon/Ceres/Pluto GPUready·GLSL/JS오류0·5언어 조건/상태·Daphnis미지원·Pluto원본근거→변경SHA재계산/새context정지복원을 확인했다. 증거는 `var/qa/appearance-earth.png`, `appearance-saturn.png`, `appearance-moon-606.png`, `appearance-ceres.png`, `appearance-pluto-evidence-restored.png`다. v0.4별도완결ZIP전달이아니며 후속v0.5패키지에 통합한다.
- Notion완료조회14:08:05KST:현재관련 이슈 `https://app.notion.com/p/417d0a43a5058140b867fcf93b1f81f3`만background읽기. 미시작/P1·환경재현기대실제증거규칙이13:57:21중간조회와동일했다. 홈/QA·정확한편집시각미확인,포커스/창이동/쓰기없음.

## DEV-005 · 2026-11-14 · 카이퍼대·72h/s·은하와 별도 우주 역사

- 사용자범위:카이퍼대설정on/off·72시간/초·은하몇개선택자동이동과 매우과거 모형을 요청했다. 확인답변은 **수십억년전우주역사까지**다. 기존정밀2026태양계72시간/실노출을 보존하고별도cosmicHistory모드로 구현한다. BCSolar는현재공식JPL근사표가Pluto제거/8개·Earth-Moonbarycenter범위인것을확인한뒤 사용자billions우선으로 보류했다. 고대/수십억년JPL위치를만들지않았다.
- 적용스킬:기존 documentation·Astropy·astrometry-motion-qa·validate-data·browser QA/코드검토/릴리스 절차를 실제관련파일범위에 적용했다. source reader/API/화면·독립원문/5언어검토를 분리했고 새자격증명·AI API·이미지생성서비스·관측원본수정은없다.
- 역사원본:science/history.py/cosmic-chronology-v1,공식NASA/ESA4HTML1,269,070B를 `data/reference/history/`에원바이트/sourceJSON보존. cosmic_history.json15,783B,SHA `bf947edd0a0859466d594b4e968997a70cd51511dd78fbccf6653b042f65b03f`. hotBigBang0/recombination.00038/darkages.01/firststars.1/earlygalaxies.28/reionization.5/galaxygrowth1/cosmicnoon2.5/SolarSystem9.2/present13.8Gyr의10지점이다. 일부는넓은시대내표시anchor이고최근표시지점은물리적전역경계아니다. firststars정확시점미상·280Myr관측예시/최초형성시각아님·13.8−4.6=9.2파생근사를 명시했다. NASA동일페이지240–300k/380k와ESA13.7/NASA13.8차이는원문변경없이채택근거/source_conflicts로보존했다.
- 은하원본:science/galaxies.py/official-rounded-galaxy-context-v1,Chandra4+NASAHubble3HTML1,301,145B를 `data/reference/galaxies/`에저장했다. galaxies.json24,160B,SHA `7fd74f67e48a1d5c7ecd4566e69a4ecc808853b00d553d0cb7a32eb084b54e7f`. M31/M33/M81/M87의둥근J2000sexagesimal을보존하고근사2.5/3/11.6/54Mly를ly/Mpc로단위변환했다. frame realization/공분산/고유운동미검증·ICRSframe-bias변환미적용과M87CXC55/NASA54차이를명시했다. 2400점형태/기울기/회전/크기는설명용이며실제별수·현재물리pose/고대좌표아니다. 관측합성사진은새다운로드/복제하지않고공식출처링크만연결했다.
- 카이퍼원본:science/kuiper.py/kuiper-region-v1, NASA1HTML291,005B SHA `1f814d9a2e0cd139422a62c4a161ccc5bc53385f0212f02b9c7d4ff753e3b318`를 `data/reference/kuiper/`에보존했다. kuiper_display.json2,071B,SHA `8ea4e597e3c18a363625b493fbdae05ed40ebe359666c5d3f7e7afdfd6675957`. main30–50AU와scattered disk약1000AU를구분한다. seeded650점/seed1949030/수직±.6AU·불투명도는실측객체/밀도/두께/확률아닌표시가정이다. 실제천체/관측과분리한다. 새12HTML2,861,220B를새관측12회/기존Drive업로드로세지않는다.
- 화면/계약:정밀속도1/6/24/72h/s(기본6),원래3일범위/끝/수동/숨김/저장정지를유지한다. 역사시간은BigBang후Gyr와근사lookback13.8−age,속도1/10/100/1000Myr/s(기본100),지점/범위/수치·Play/Pause·끝/숨김정지다. cosmic-concept-v1의plasma/CMB·seeded별/은하/filament·태양계는개념적장면이며sourceanchor전firststars.1/Solar9.2표현을등장시키지않는다. 실제팽창/밀도/복사전달함수·현재카탈로그좌표역산이아니다.
- 보존/복원:정밀/외계행성/역사의hiddenhost+RAFpause로원카메라/WebGL보존,외계행성/역사는firstopenlazyload. 역사에서관측/근거nav는정밀모드로복귀해workspace/DATE-AVG/원본을유지한다. Gyr를기존Evidence의ISO model_epoch로저장하지않고역사자체근거저장구현주장없다. 설정show_kuiper_belt/show_galaxies의새기본은true,legacycontext필드없으면false다. optionalkuiper_display_version/galaxy_manifest_sha256와72속도를실행스키마/TS/OpenAPI에추가했다. import는manifest일치만보지않고offline reader로지도/벡터/은하실파일을재검증해변조/누락을재계산필요로표시한다.
- API/검사:GET `/cosmic-history`, `/cosmic-history/sample?age_gyr=`, `/catalog/galaxies`, `/kuiper-belt`추가. age유한0~13.8만허용한다. history12PASS1.23초,galaxy8PASS2.37초,catalog API18PASS5.40초+추가KuiperHTTP1PASS1.53초/Ruff. 이19검사는10stage/SHA·0/.00038/13.8·-1/nan/inf/13.81→422·4은하ly/Mpc·TNO6부모200/미지원빈배열·mountedJPEG/PNG원SHA/unknown404·카이퍼가정분리를확인했다. 독립검토도NASA/ESA원문·sexagesimal단순산술1e-12deg이내·근사거리/단위·카이퍼표시한계와원본SHA를대조해블로킹결함없음을보고했다.
- 현재통합체크포인트:Python176PASS34.15초/기존Starlette경고1,TSstrict/Vite·Vitest36PASS. 그뒤작은기본값/실파일checker수정이있어최종전체회귀는후속확정한다. 새0.5빌드index-CDpOhZCN/history-nohVHtsp,8000실제5신규Chrome와GPU검사중이다. 이진행상태를완료통과수로더하지않는다. 최종v0.5ZIP·해제/실행/파일SHA·최종Gitcommit/push는아직준비단계이고Linux/공개서버배포는없다.
- Notion:DEV-00514:17:17KST에관련이슈페이지 `https://app.notion.com/p/417d0a43a5058140b867fcf93b1f81f3`를늦은진행중background읽기로확인했다. 기존본문동일,정시착수조회·홈/QA전체·최신편집시각확인으로확대하지않는다. 포커스/창이동/쓰기없음,완료조회는실제완료시후속기록한다. DEV-004완료14:08:05와구분한다.
- 문서:FSD0.8/v0.5.0의2.8/8.3/API/QA14–15/현황,README·자료/근거·AI MD/JSON·외부고지를함께갱신했다. 과거기록/원본/Git은보존하며 F01잔여/F04/F05·사람/원어민검수·Linux/공개서버·최종ZIP의미완료표시는유지한다.

## DEV-006 · 2026-11-14 · 은하별 관측 형태 고증·9개 확장

- 사용자 추가 지시: 은하가 모두 같은 모양이며 고증이 부족하다고 지적하고 실제 다른 은하를 요청했다. DEV-005의 최초4개를 보존하며 LMC/SMC/M51/M104/Centaurus A를 추가했다. 릴리스는 v0.5.0에 묶고 통합 명세를 FSD0.9로 올린다.
- 자료 동결: `science/galaxies.py`의 현재 `galaxies.json`80,168B/SHA256 `1363cee1eb52a93d4e6505d437dd3d2291f16592e166fc33bbaef7864ba0890f`. 공식17원문(HTML16+NASA교육PDF1)5,947,706B를 원바이트/취득시각·SHA·source.json으로 보존했다. 기존7원문 대비10개4,646,561B를 추가했으며 새 SPHEREx방문/관측 횟수로 세지 않는다. 이전4개 manifest는 `data/reference/galaxies/catalog_before_morphology_v1.json`24,160B/SHA `7fd74f67e48a1d5c7ecd4566e69a4ecc808853b00d553d0cb7a32eb084b54e7f`로 보존하고 원 방향·거리·coordinate_source 불변을 검사했다.
- 좌표/거리: 추가4개는 CXC의 둥근 J2000 Fast Facts, LMC는 정상 TLS로 취득한 Harvard SIMBAD 명시적ICRS(epJ2000)·원식별 bibcode다. CDS/TAP 연결 문제를 우회해 허위 좌표를 만들거나 TLS검증을 끄지 않았다. LMC/SMC/M51/M104/Centaurus A 채택거리는0.16/0.2/31/28/12Mly다. M51 CXC30/NASA31·M104 CXC31/NASA28 등 출처차이를 보존하고 단위변환이 원정확도를 높이지 않음을 명시했다. 고유운동/고대좌표 전파는 하지 않는다.
- 형태 계약: `observed-morphology-guide-v1`에9개 renderer·observed_features·개별source/additional_sources·image_source 공식참고페이지·표시가정을 반환한다. M31경사77°는NASA본문, M81두팔은NASA lithograph, LMC중심막대/한팔은NASA APOD본문 근거다. M87/Centaurus A의arms0은타원형분류표현이다. M33 flocculent는희미하고조각난팔을표현하는렌더스타일이며NASA공식분류아님을따로기록했다. M51동반NGC5195는출처로확인하되화면분리/방향은미상값과표시가정으로분리한다. 다른수치경사와모든위치각은null이다.
- 표시/권리: 관측사진을 해상3D물리복원으로 주장하지 않는다. 점수/색/크기·먼지/제트폭·회전위상/미확인방향은설명용코드표현이다. 새 관측사진파일을 앱 자산으로복제하지 않고 원페이지링크만 제공한다. LMC APOD Ireneusz Nowak사진의별도credit/권리를고지했다. 원거리/방향은선택자동포커스로바꾸지않으며관측workspace/근거를보존한다.
- 과학 검사: `tests/test_galaxies.py`14PASS(2.73초),Ruff/diffcheck통과. 원문17개SHA/bytes·추가5개sexagesimal독립산술/근사거리·9표시형태·M31각도/팔근거·미상각도·동반표시가정·PDFmagic·기존4개불변을확인했다. 별도검토에자료동결/hash를전달했고실제Chrome9형태대조/5언어·최종전체Python/프런트/브라우저수치는후속확정한다. 동시프런트build중정적파일삭제와겹친이전전체실행의setup18실패는완료검사로세지않고build완료후분리재실행한다. 이후catalog19개와최적화대상55개검사는통과한중간결과다.
- 운영/문서: Dockerfile은외관reader가검증하는 `web/public` 원본COPY를추가했으나Linux엔진연결이없어컨테이너실행미검증이다. 사용자MVP체크포인트 `5d3a450dfd3fb82946387e03e31b2c01e56a8bb4`의13:51:47KST commit/일반push/원격SHA확인사실을보존한다. 이후최종commit/push·완결v0.5ZIP/해제실행·공개서버배포는실제결과로후속기록한다. FSD2.9/8.4/API/QA16/현황,README·고지·자료/근거·AI MD/JSON을같이갱신했다. F01잔여/F04/F05·사람/원어민검수·Linux/공개서버미완료는그대로다.

### DEV-005/006 최종 통합·릴리스 검사 · 2026-11-14T14:51:14+09:00

- Python185 PASS(325.37초, 기존 Starlette 경고1)·Vitest40 PASS·TypeScript strict/Vite·Ruff 통과. Python3.12.3/Node22.17.0, Windows 실행 결과이며 다른 OS/사람 검수로 확대하지 않는다.
- 실제 Chrome21개 고유 경로 검사를 완료했다. 최초 전체 실행은19PASS/2실패(9.0분)였고, 동시부하의 Titan cold-parent 대기와 OrbitControls 감쇠 대기를 실제 완료/연속 안정 조건으로 고친 뒤 최종 CJgIAKg2 빌드·재시작한 cold API에서 관련4개를 모두 재검사해 통과했다. 수치 허용오차는 완화하지 않았다. 최초 실패 trace/context는 `var/qa/dev006-initial-browser-failures/`에 보존했다. 9종 공식사진 대조·최종M31/M87 GPU/빠른 재선택/수동취소/역사 왕복 카메라 보존도 통과, JS/GLSL 오류0이다.
- 최종 변경: M31 먼지띠 대비/두께와 M87 제트 표시 길이/밝기를 낮춰 관측 특징과 비교했다. 공유 gallery의 M104/CenA 링크는 NASA Chandra/CXC로 중립 표시하며 실제 source 원문/방향/거리/SHA는 보존했다. 5언어261키·UTF8/JSON 검사 통과.
- 복원 알림은 저장 locale로 즉시 번역한다. 가져오기 시작에 두 시간 재생을 정지하고 새 세션은 열린 검색목록도 닫는다. Solar 원본 누락은500 대신 재계산 필요다. 실제 file SHA 검증은 유지하되 벡터 재생성 없이 검사(로컬 약0.314s+지도0.127s), 확장 index metadata/부모별 cache로 시작 계산을 줄였다. 관련 회귀 포함 Python185 통과다.
- 완결 배포본은 `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.5.0_20261114_144922KST.zip`다. 포함 파일/바이트/SHA 및 Windows 새 폴더 해제·health·31지도 원바이트·476확장객체/6470외계행성/9은하/역사10지점·εB/Pluto 근거와 실제 서버 재시작 후 동일 evidence/result ID 복원을 확인했다. 검증된 동일 독립 런타임을 재사용했으며 새 설치로 주장하지 않는다. 최종 ZIP의 정확한 SHA/바이트/해제 경로·실행 시각은 동명 `.zip.sha256.json`·`.verification.json`을 기준으로 한다. 문서 확정 후 최종 ZIP도 같은 검사로 재확인한다. Linux 컨테이너/공개 서버 배포는 수행하지 않았다. 첫 해제 검증: `2026-11-14T05:50:41.905350+00:00`, manifest에 기록된 파일 1599개와 release_manifest1개. Dockerfile은 reader 검증용 public도 포함하며 release algorithm 목록의 observed-morphology-guide-v1 누락을 독립 검토로 보완했다.
- Notion 완료/배포전 조회 시도: 14:48:40 KST. native inventory에 기존 ‘이슈 보고 전달’ 창이 없어 포커스/창/탭 이동 없이 재열람하지 못했다. 이번 내용 재확인은 미완료/접근불가이며 최신 내용 확인 완료로 쓰지 않는다. 마지막 실제 확인은14:17:17KST의 관련 이슈 한 페이지였고 당시 기존 미시작/P1·환경/재현/기대/실제/증거 규칙과 동일했다. 홈/전체QA·현재 편집시각은 미확인이고 포커스/창이동/쓰기는 없었다.
- Git: 사용자 요청 MVP는5d3a450(13:51:47KST) origin/main 일반push/원격SHA 대조 완료. 이 통합의 최종 source commit/push는 release_manifest.base_commit과 실제 원격 SHA로 확정한다. .env/관측원본/팀내부/var/tmp/artifacts는 Git에서 제외하고 이전 코드·작업·근거와 Git 이력은 보존한다.
- Linux/공개서버·실제 제출·F01잔여/F04/F05·사람/원어민 검수는 완료로 올리지 않는다.

## DEV-007 · 2026-11-14 · 우주 역사 초기 은하의 반복 모양 수정

- 진행 중 첫 실제 시각 조회15:00:07 KST. 사용자가 빅뱅 모드의 초기 은하가 모두 같은 모형이라고 지적했다. 착수 직후의 초 단위 시각은 별도 계측하지 않았으므로 이 시각을 최초 착수 시각으로 주장하지 않는다. Git기준은 origin/main에 반영한 b2930ec이고 작업 전 변경은 없었다.
- 원인 재현/독립 검토: 현재 UniverseHistoryScene의35개 노드는 모두190점과 동일한 세 팔 `(i%3)*2π/3+r*.7` 기하를 사용한다. 반경/자세만 달라지고 시간은 전체 불투명도를 바꿔 실제 형태 다양성/개별 성장은 구현되지 않았다. 이전 DEV-006의9개 현대 은하 개선은 별도 우주 역사 장면에 적용되지 않았다.
- 적용: 실제 debug·validate-data·spaceapps-browser-qa·documentation·ux-copy 지침/설치 lock을 확인한다. 프런트 형태/연속 성장·공식 초기 은하 원문/사진 검토·독립 회귀를 파일 소유별로 분리하고 root가 API/5언어/명세/배포 통합을 맡는다. 현재까지의 관측·Git·근거는 보존한다.
- 과학 경계: 초기 은하를 모두 동일한 현대 나선은하로 그리지 않는다. 형태 다양성을 근거로 clumpy/compact/작은 disk/disturbed 등의 설명용 가상 개체를 구분하되 개체 수·위치·형태 비율·전이 시각을 실측 통계/동역학이나 개별 은하 복원으로 내보내지 않는다. 기존10개 연대 anchor와 불변 관측 원본·UTC/역사 모드 구분은 유지한다.
- Notion 시작 조회14:59:39 KST: 관련 이슈 창이 native inventory에 없어 내용을 재확인하지 못했다. 마지막 실제 조회는14:17:17KST이며 이번 내용 확인 완료로 재사용하지 않는다. 포커스/창/탭 이동·쓰기는 없었고 가능한 개발을 계속한다.
- 구현·수학/API·5언어·실제Chrome·최신 ZIP/해제·원격 Git 결과는 완료 후 후속 기록한다.

### DEV-007 사용자 정확성 확인·명시 선택 반영

- 사용자가 ‘실제 데이터와 사실만을 바탕으로 된 것인지’를 질문했다. 실제SPHEREx/천체력/공개지도와 가상35은하의 위치·모양·성장이 다름을 즉시 설명했고, 사용자는 **실제 관측 사례와 확인된 연대만 표시**를 선택했다. 이후 가상 시안의 게시/ZIP을 중단하고 관측-only로 교체한다.
- 중간 시안의205Python/43Vitest/Chrome7PASS는 프로그램 동작·가정 표시 검사이며 과거 우주의 실측 복원 검증이 아니다. 이 시안은 완료 제품으로 전달하지 않는다. var/qa/dev007-superseded-diversity/에 이전QA를 보존한다.
- 새 계약은 실제 관측5이미지·published approximate age 또는CEERS범위다. image간 자동넘김은 슬라이드쇼이며 물리적 진화/중간시각 생성이 아니다. 당시임의10anchor/가상scene은 현재 App에서 제거한다. 이전원문/코드는 비활성/레거시로 보존한다.
- 사용자 추가 요청으로 root Data_Spec.md를 데이터 전수 기록 전용으로 작성한다. FSD는 기능·화면/실행 명세를 유지하고 원본/사용/확보만/이전 자료의 출처·가공·권리·SHA·바이트는 Data_Spec과 canonical manifest로 연결한다.

### DEV-007 실제 관측 전용 경로 검증

- Python227 PASS(43.32초, 기존Starlette경고1), Vitest45 PASS, strict/Vite 최종 index-DZP8VB6-/CosmicObservationViewer-OpoqVQrh, Ruff43파일 통과. 실제Chrome 관련6경로 모두 PASS(1.6분)다. 다른 전체브라우저 경로를 이번에 모두 재실행했다고 주장하지 않는다.
- 공개관측5이미지2,034,618B SHA/바이트/치수·원문11개1,572,536B·크레딧/권리·CEERS.6–6Gyr/다른4근사연대·5언어298키를 확인했다. 이전동일35모형/다양성중간7QA는 superseded 기록으로보존한다.
- 최초관측전용빌드의클릭실패(pointer-events상속)와숨김사진의inlinevisibility우선문제를재현·수정했고수정빌드6검사로재확인했다. 독립보고 var/qa/dev007-observed-review.json 및5사례/εB새세션복원사진을직접대조했다.
- Data_Spec.md 별도작성: data1454+public43=1497물리파일/내장원응답32/서빙복제43. 전체상대경로와실제SHA전수독립대조 누락0. 원본102개987,987,584B의SHA/크기불변 확인. 이후DEV008추가원문은최종snapshot에서재생성한다.
- Notion 완료시도15:31:01KST: 기존관련창없어내용재확인실패. 포커스/창/탭이동·쓰기없음. 마지막실제읽기14:17:17KST를이번최신조회로주장하지않는다.
- 사용자새요청을DEV008로이어받아現在v0.5.1 ZIP/Git전달은중간출시하지않고최종v0.6.0에묶는다. 이전v0.5.0/b2930ec원격과ZIP은보존한다.

## DEV-008 · 위성 현지 이름·과거/미래 시뮬레이션·은하 내부 계층 탐색

- 기록시각 2026-11-14T15:49:33+09:00. 사용자요청: 언어를바꾸면위성이름도변경, 과거/미래시간확장, 은하→행성·갈색왜성등모든종류선택/확대, 빅뱅모드진입복구. 기존데이터·원본·Git/품질근거는보존한다.
- 3병렬분담: 이름helper/5언어사전·기관표기출처, 장기JPL계수/검산과학, 실제천체계층/원문/방향검토. root는시간/은하UI·API/저장계약·통합검사/FSD/DataSpec/ZIP을담당한다.
- 명시선택한실제관측-only우주역사는유지하고상단항상보이는‘빅뱅·우주역사’진입버튼을추가한다. 가상35개·수십억년개별성장장면을조용히되살리지않는다.
- JPL공식장기근사는prolepticGregorian astronomical연도-2999(3000BCE)-01-01~3000-01-01 TDB달력라벨만지원한다. 8행성계+Sun원점/EMB(지구-달질량중심),미지원Pluto/달/왜행성/별은기존다른epoch로고정표시하지않는다. 원정밀2026-11-13~16시각과관측DATE-AVG는보존한다.
- 은하내지도는출처확인하늘방향투영이며깊이/물리반경/현재3D위치를임의생성하지않는다. 외부9은하대표구성원+우리은하의태양계/갈색왜성/여러종류·기존NASA4862host/6470planet를계층참조한다. host→planet선택은기존설명용3D항성계로연결하고측정표면으로주장하지않는다.
- 새원문/공식표기·계수/검산·은하좌표의SHA/bytes/원URL/취득시각을불변보존하고Data_Spec전수snapshot을재생성한다. 최종테스트/브라우저/ZIP해제·재시작/Git결과는후속실행으로확정한다.

## DEV-008 urgent travel checkpoint - 2026-11-14T15:54:38+09:00

User explicitly requested wrap-up within one minute before shutting down. Stop new browser/release work and preserve current source/data/Git.
Implemented v0.6.0: 476 object names in five locales with original designations/IDs retained; separate JPL fitted Kepler simulation -2999-01-01 through 3000-01-01 TDB calendar labels (8 systems + Sun; Earth icon means EMB; unsupported objects omitted); source-backed galaxy-member hierarchy and angular zoom with existing exoplanet-system links; visible header Big Bang/history entry. History remains five published actual observation products and approximate source ages, with no synthetic 35-galaxy growth scene.

Verified: strict TypeScript/Vite index-DSKEjKdg.js; Vitest54 passed; Ruff check/48-file format. Whole pytest:275 passed,1 failed in60.64s. Failure was a test setup calling calendar_jd(-3000), which correctly rejects unsupported input; changed setup to one day before the supported minimum JD. Rerun after that test-only correction is PENDING. New long-term28/catalog19/names4 targeted tests passed previously. DEV007 observed-only Chrome6 passed on its prior build. DEV008 new six browser scenarios were WRITTEN/DISCOVERED, NOT EXECUTED. Do not claim current whole browser verification.

Resume: read AGENTS,SKILLS,FSD,START_HERE,Data_Spec and this checkpoint; preserve raw/data/var/Git. Run whole pytest and new simulation-names/universe-catalog browser scenarios, then existing cosmic/observations. Build complete v0.6 ZIP and verify fresh extraction,health,epsilon/Pluto evidence and real server restart. No public/Linux deployment or F01 remaining/F04/F05/native-language/human QA claimed.

## DEV-008 재개 · 2026-11-14 18:03:29 KST

- 이동 후 기존 Git37d9548/origin main의 중단 지점과 보존 파일을 확인하고 작업을 재개했다. 앞선 긴급 체크포인트의 검사 결과와 실제 후속 검사는 아래에 구분한다.
- AGENTS→SKILLS→FSD→START_HERE의 지침과 실제 설치 스킬을 적용했다. 관측 원본·영속 근거·Git 이력을 보존하며 날짜 입력 오류, 번역, 은하 선택 및 배포 묶음을 통합 검사했다.
- Notion의 최신 접근 가능한 페이지를 확인하지 못했으므로 새 외부 협업 반영을 완료로 주장하지 않는다. 공개 서버/Linux, F01 자유 좌표/공식 다른4대상 품질 및 F04/F05는 별도 미완료 범위다.
- 이 문단과 다음 Windows 준비번들 문단은 당시 PowerShell→Python 파이프의 문자 인코딩으로 손상됐던 기록을 DEV-009에서 복구했다. 원본 데이터나 당시 ZIP 바이트를 바꾸지 않았다.

### DEV-008 재개 후 수정·통합 검사 · 2026-11-14T18:19:13+09:00

- 재개 전체 Python276 PASS(76.90초, 기존 Starlette/httpx 경고1), TypeScript strict·Vite 및 Vitest55 PASS, Ruff check/48파일 format 통과. 이후 long-term-simulation의 자료 무결성 오류를 날짜 입력 오류422와 구분해503으로 바꾸고 해당 과학/API29개를 다시 실행해 PASS(1.66초)했다. 전체277개를 같은 최종 실행에서 돌렸다고 주장하지 않는다.
- 사용자가 연도0/다른연도 적용 안 됨을 보고했다. 실제 Chrome에서 기존 index-DSKEjKdg의 연도입력+Enter/Tab은 시각을 바꾸지 않고 ‘이동’만 적용하는 결함을 재현했다. 0년/2500년 자체 계산은 정상이며 Earth벡터 변화도 확인했다. 입력을 문자열 초안으로 유지하고 Enter/form-submit·각입력 blur·이동 버튼으로 적용하며, 빈칸/단독마이너스/잘못된 날짜는0으로 강제변환하지 않고 마지막 유효 시각/벡터를 유지하도록 수정했다. 편집시 재생을 정지하고 초안을 재생 tick으로 덮지 않는다. 5언어 안내를 제공한다.
- 프랑스어 검색 결과를 설정 버튼이 가리던 실제 클릭 실패는 검색층 z-index를8로 올려 바로잡았다. 지구–달 질량중심의 대표 지구아이콘에 지구 반지름6371km를 질량중심 반지름처럼 표시하지 않도록 해당 물리반지름 행을 숨기고5언어 대표아이콘 설명을 추가했다. 지원 위성의 부모 응답 대기를 미지원으로 오표시하던 문구도 로딩 상태로 분리했다. 원본/과학수치/지도의 바이트는 바꾸지 않았다.
- 실제 Chrome13개 고유 경로 PASS: 수정후1XZd56Et에서 신규6개(72.98초), EMB고지추가2USPLncj에서 기존 cosmic4+입력/EMB1개(46.54초)와 observation2개(49.96초), 최종BaIOI0V5에서 로딩1개(3.8초/실행5.4초). 중복된 입력검사를 제외한13개이며 마지막 빌드에서13전체를 다시 실행한 것처럼 기록하지 않는다. 0Enter/99Tab/2500Enter·음수/빈값·503복구·실제5영상SHA/credit/5언어·관측원본/판단·저장/새세션복원·G1실좌표/방향확대·TRAPPIST7→f3D자동포커스·9은하 구성을 확인했다.
- 원본102개987,987,584B SHA/바이트 불변, Data_Spec의 자료파일1631+명시참조helper1=1632항목/877참조·32내장원응답·43서빙복제 및 names helperSHA를 독립 대조해 누락/불일치0이다. 신규자료 취득은 없으며 Data_Spec SHA a382a30920b18cb50facae5b896992468bd9bd504827a799cf37ac1b26728e36을 유지한다.
- 초기 French가로막힘/연도입력 재현/중간 및 최종회귀 JSON·스크린샷은 var/qa/dev008-*로 보존한다. 독립 QA는 자동에이전트/Chrome 검수이며 사람/원어민 검수로 주장하지 않는다. 최종 배포 ZIP의 해제·health·기존/새API·εB/Pluto근거 및 서버 재시작 복원은 다음 릴리스 기록에서 실제 결과를 확정한다.

### DEV-008 최종 로딩 문구 확인 · 2026-11-14T18:21:54+09:00

- 최종 위성 로딩 문구는 기존 timelineLoading(천체력 표본 읽기) 키를 사용한다. 공용 loading이 ‘원본 관측 읽기’라고 되어 있어 JPL 예측 자료의 종류를 오해하지 않도록 두 참조만 교정했다. 수치/계수/원본 변경은 없다.
- 최종 빌드 index-D7O_yXx_.js에서 simulation-names4경로를 추가 실행해 모두PASS(26.4초), 기존13고유경로의 부분 재검사다. 0Enter/99Tab/미래연도·빈값·자료실패·5언어이름·EMB대표아이콘/반지름비표시·지원위성의loading→실제천체력 전환을 확인했다. 최신 기록은 var/qa/dev008-final-copy-regression.json과 통합 dev008-browser-review.json이다.
- 추가 실행의 npm 옵션 전달 문제로 의도한1개 필터 대신4개가 실행됐다. 기본 관리출력 var/browser-results가 Playwright에 의해 초기화되어 과거 해당 폴더의 일부 스크린샷/임시trace는 현재 없다. 원본/영속근거/이전ZIP 및 별도 var/qa 정본/현재스크린샷은 보존됐고, 이후 검사는 Node Playwright CLI에 고유 output경로를 직접 지정한다. 이전 폴더의 과거 사진을 현존 증거로 재사용하지 않는다.

### DEV-008 Windows 준비번들 검사와 정본 구분

- 내부 준비번들 NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_181913KST.zip(481,784,994B/1807파일)을 tmp/release-verify-f5vt0brn/extracted에 새로 해제하고, manifest1806항목과 입력6개를 대조했다. Windows health, 지도31개, 확장476/외계행성6470, 역사5영상/9은하, 장기8계와 대표 연도, 계층24/MW4871/TRAPPIST7, εB/Pluto 근거와 실제 API 재시작 뒤 같은 result/세션/판단 복원을 2026-11-14T09:22:00.694531+00:00 PASS했다.
- 검증한 독립 Python 런타임을 재사용했으며 새 의존성 설치나 Linux/공개 서버 실행으로 주장하지 않는다. 이 준비번들 BaIOI0V5 검사는 후속 D7O_yXx_ 최종 ZIP의 정확한 동일 바이트 검사가 아니다. 최종 정본은 아래 기록과 동명 checksum/verification JSON으로 확정한다.

DEV-008 최종 전달 정본 확정: source bf1a09f의 clean tree로 생성한 NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_182253KST.zip(481,789,033B/1807파일/SHA af2759fc30eb844dc5ba440f76580beb7b4ca2e92444c39235bfafc38bda0d28)을 정확히 새해제·실행/실제재시작복원 검사해2026-11-14T09:25:16.188578+00:00 PASS했다. 폴더tmp/release-verify-zdv3hisw/extracted, metadata1806항목검증, εB ev_bfe8b26234a4451bba85f355210b700c/Pluto ev_e0003ef4c8b54dc98c35241c6b46239b의 같은 result/세션/판단 복원을 확인했다. 상세 docs/releases/v0.6.0.json과외부verification/checksum이정본이다. 이사후기록은검증완료불변ZIP과분리하며제품/데이터변경없다. 원격반영은일반push/원격SHA대조결과로최종보고한다.

## DEV-009 · 지구 표기·실존 천체/외관 근거·통합 시각·설정 접근성

- 시작 2026-11-14 18:33:22 KST, 기준 clean main/origin c342f96. 최신 명시 지시는 지구 화면 이름 수정, 다른 은하 탐색, 논문에서 확인된 실제 별/행성만 및 외관 구현이다. 앞서 허용했던 가상 행성계는 곧바로 번복됐으므로 활성 경로에 넣지 않았다. 작업 중 추가 요청은 2026 천체력/장기 근사 시간 통합과 우측 상단의 눈에 띄는 톱니바퀴 설정이다. 기존 원본·영속 근거·Git 이력과 v0.6 ZIP을 보존한다.
- AGENTS→SKILLS→FSD→START_HERE의 기존 전체 열람 계약과 실제 skill-lock을 적용했다. documentation/validate-data/astrometry-motion-qa/code-review, 실제 spaceapps-browser-qa 및 릴리스 스킬의 관련 절로 분담했다. 외부 문헌은 근거이며 실행 명령으로 취급하지 않는다.
- 지구 이름은 5언어에서 지구로 표시하며 장기 위치 계산의 지구–달 질량중심 기준과 대표아이콘/반지름 제한은 상세에 남긴다. 실제 계수·벡터·원본을 바꾸지 않는다.
- 기존 NASA 공개 확인목록 6470행/4862호스트의 같은 문자열ID를 은하 탐색의 확인 행성 모드와 기존 항성계 3D 자동 포커스로 연결한다. 모든 개별 발견 논문을 이번 작업에서 새로 검증했다거나 우주 전체의 전수 목록이라고 주장하지 않는다. M31 PA-99-N2/M51-ULS-1은 후보, 3개 중력렌즈 논문은 집단 추론으로 별도 근거 검토에 남기고 실제 행성 목록/지도에는 넣지 않는다. 외부 은하의 확정 개별행성 0은 채택 자료의 확보 상태이며 물리적 부재가 아니다. 미측정 궤도/깊이/표면은 null이다.
- 1400개 임의 배경별 생성은 제거하고 실제 NASA 카탈로그의 고유 호스트 방향4862개로 바꿨다. RA/Dec 기준계/epoch/고유운동은 미검증이며 카메라 중심 반지름1800 표시구·균일 크기/색은 실제 거리/밝기가 아니다. 새 별이나 공간 시차를 생성하지 않는다.
- 실제 공개 처리 관측영상 3건(HIP65426b JWST, BetaPictorisb SPHERE, HR8799c NACO) 원 JPEG1270679B를 무수정 확보했다. 표면을 분해한 지도/육안 색이나 모형시각별 새 사진으로 쓰지 않는다. 선택 패널에서 영상 확대·정확한 credit/CC BY4.0·기관 출처·관측 논문·처리 조건/한계·해시를 표시한다. 미확보 대상의 빈 상태와 자료/이미지 실패·재시도를 구분한다. 기존 실제 태양계 지도31개·외계행성 분류에 따른 설명용 3D 외관을 보존하며 실측 표면으로 승격하지 않는다.
- 새 source manifest는 extragalactic_planets.json 39826B/SHA80f4532b8a93db37a072da0e56b2bef5303365cb9d26e1f4d61a599b6824fe3a와 exoplanet_observations.json 21746B/SHA9f342bab497683425e7907417a8df587fbe69f0e5557086f3c138a516a094ea0이다. 공개 사실추출JSON/영상은 런타임·ZIP에 넣고 원문 전체 페이지/논문은 로컬 감사자료로 보존·배포 제외한다. Data_Spec의 전수 목록/권리/해시와 연결한다.
- 새 API는 GET /api/v1/catalog/extragalactic-planets와 /api/v1/catalog/exoplanet-observations다. 지원 선택의 정상 빈 결과와 무결성/입력 실패503/422/404를 분리한다. 두 기존 저장 속도 필드의 enum을1/6/24/72/8766/87660/876600 h/s 합집합으로 확장했다. 정지 복원·기존 스키마1.0·기존 근거는 보존한다.
- 18:55 KST 검사: 새 자료/API/저장속도40개 targeted pytest PASS3.03초 후 전체 Python317개 PASS76.28초(기존 Starlette/httpx 경고1). Ruff check 및53파일 format PASS. 당시 TypeScript strict/Vitest61개 PASS1.15초. 시간/설정 추가 UI와 최종 브라우저/ZIP는 후속 실제 결과로 확정한다. 이 시점에서 배포/최종 통합 완료를 주장하지 않는다.

### DEV-009 추가 외관·통합 검사 기록

- 작은천체8프로파일을47999B/SHA33b3662b6978137bf172ab65064aa73a40f119519cfaf6365e89ab0f60db18ec로 추가했다. 기존31지도와102원본은 불변이다. Sedna의 적색·열모형 크기, Haumea의 문헌삼축/공면고리, Quaoar2025고리2개의 중심반지름/기준극과 색·크기 조건을 출처별로 보존한다. 미지도 고체의 임의 크레이터를 제거하고 RGB/자세/미측정형상 가정을 표시한다.
- 전체Python335 PASS74.01초(기존경고1), strict/Vitest64 PASS1.42초·Vite CmkF8NHm·Ruff55파일 검사를 통과했다. 앞선 DRyIMrA 빌드에서19Chrome+기존focus/exoplanet2=21고유경로 PASS(148.853초/25.393초), 직접 화면 대조의 gear–새세션 겹침과 출처노트 가림을 발견했다. 이후 Cmk에서 작은천체4·강화시간/gear3·sky1·boundedtimeline1=9경로 PASS95.366초와 직접4사진 대조로 첫 두 결함을 교정 확인했다. 원문 JSON/사진은 var/qa/dev009-browser-review.json과 실행별 경로에 보존한다.
- 후속 직접검토로 미분해외관에도 Published map displayed라고 하던 ready문구와820px프랑스어 gear–언어선택 겹침을 발견했다. 판정창 추가 빌드에서5언어 문구를 외관 표시 완료로 고치고 중간폭 header줄바꿈/검색·출처 위치를 함께 조정한다. 이 후속 변경을 앞선21/9PASS로 소급 검증하지 않는다.
- 작은천체까지 DataSpec의1769파일/22canonicalmanifest, 최초102원본987987584B 무결성을 대조했으나 이후 DEV-010 신규 자료 전이므로 최종 릴리스 전 다시 갱신한다.

## DEV-010 · 팀 회의 핵심 결정: 행성 3요건·궤도 청소 질량

- 2026-11-14 19:24:59 KST 기록. 사용자가 팀 회의에서 승인한 핵심 기능으로 세드나·에리스 등 선택 시3요건 충족/미충족과 최소 질량을 요구했다. 이어 조건3에 최소질량과 괄호 안 현재질량의 형식을 명시했다. 기존 관측/근거/Git을 보존하고 승인된 범위 변경을 FSD2.15에 통합했다.
- IAU2006 원문과 Margot2015/2024 논문을 primary source로 확인했다. 공식3요건과 연구 청소모형/가능 시간을 분리하고, a는 현재 태양 거리가 아닌 궤도 긴반지름임을 설명한다. 원형모형mclear=.001239*a^(9/8) 지구질량과 직접비Π를 계산한다. Sedna의 높은 이심률에 대한 실제 청소 임계값으로 주장하지 않는다.
- 기존9천체 실제 Horizons 요소/물리HTML과 새SBDB8, 실제 질량 문헌을 추적한다. JPL 표의10^24kg와Pluto10^18kg를 구분하고 Earth5.97217e24kg, Pluto1.30246e22kg를 검산했다. Ceres는Moon제외Earth-bodyGM에대한GM비, Haumea는논문본체질량을 사용한다. Eris/Quaoar/Gonggong/Orcus는위성포함계전체질량을별도보존하고본체값으로승격하지 않는다. 반지름/표시형상/가정밀도로Sedna질량을 만들지 않는다.
- 독립 검토자는 Decimal40자리로17개mclear를 대조하고 분류8/5/4, 본체/계전체 구분과 source해시를 확인했다. source자료 API/근거40개 PASS10.53초다. 원문과 컨테이너SHA를 혼동하지 않도록 pre-freeze 추출본을보존하고 provenance를 보강하는 중이다. 최종 해시·브라우저/전체검사·DataSpec·ZIP는 후속 실제 결과로 확정한다.

### DEV-010 소스 체크포인트와 후속 DEV-011 승인

- 최종 source e6124a457dcbba0907d9f4d0f8fbd777b7cac1963b4b2e49cb5fb6322e8753d8/168453B를 동결했다.19facts+sidecar77558B는런타임,19upstream+sidecar2558555B는로컬감사전용이다. 원문HTML58244B무수정재사용과 기존2manifest/내장원응답 SHA를 구분한 provenance 교정을 독립 검토했다.
- 전체Python372 PASS76.33초·Vitest64 PASS1.20초·strict/Vite Bp6N6jEm·Ruff57 PASS. 해당빌드의16Chrome영향검사 PASS206.567초, 출처/분류/조건부질량·source503·5언어·그림·실제3사진/포커스·실제관측/근거복원과820French배치를확인했다. 출력 var/qa/dev010-final-browser-results.json 및 dev010-browser-review.json. 같은빌드에서6개직접화면을대조했다. 후보의‘미측정’문구를 채택 자료의 본체 단독값 미확보로 좁히고, q/Q의locale형식을교정한lsFtNhUt에좁은후속검사를진행한다.
- 이시점DataSpec1566507B/2648줄/SHAf26ba122e0bac9fdfdabbe6881bd7686a7692582f62b0efbd376606e1f7e1b9e,23정본1846파일1796data+49public+helper1·979정본참조/984sidecar포함·32내장응답/49서빙복제다. 최초102원본987987584B와 전체기록파일의SHA/bytes는 독립대조불일치0이다.
- 사용자의 후속 지시로 DEV-011 밀도가정 질량추정·적색편이/실제카메라관측자실험·블랙홀을 승인 범위에 추가했다. 소스중단점부터 Git에 보존하고 다음 개발을 진행한다. 새미완료작업을 앞선16검사/v0.7구현으로완료라하지않는다. 중국기관 제공자료는 새채택에서 제외하며 관측/배포기관과논문호스트를구분한다. 아날로그밀도는 중력압축/조성/공극률의 조건을 갖는 사용자실험값으로만 허용한다. 관측 질량/IAU분류는 불변이다. 적색편이는 source관측값과 FLRW거리·명시속도SR·Schwarzschild모형의한계를 구분하고 압축카메라팬을측정속도/물리적비행경로로주장하지않는다.

- 마지막lsFtNhUt의5언어1경로 PASS6.568초(실제검사5.3초), French q/Q와KoreanEris2화면직접대조로 숫자locale/채택본체값미확보·계질량분리 문구를 확인했다. 앞선Bp6의16PASS와분리한다. var/qa/dev010-locale-followup.json 및통합browser-review가정본이다.
- Git정본바이트감사에서 JSON줄바꿈자동정규화가SHA에포함되는manifest와충돌함을발견했다. .gitattributes에서data/manifests/*.json과public관측source sidecar의텍스트/eol자동변환을해제했다. 신규4manifest/3sidecar와이전6manifest의Gitindex를 실제동결바이트와일치시켰다. 이전6의차이는CRLF→LF자동정규화뿐임을byte-assert검증했으며관측원본·수치·현재manifest의실제파일바이트는수정하지않았다. 전체추적manifest/sidecar의Gitindex와workingbytes를대조했다. 과거commit/ZIP은그대로보존한다.

### DEV-011 · 밀도 가정과 관측자 위치 실험 · v0.8.0

- 사용자가 카메라를 실제 관측자 이동으로 간주하는 실험을 선택했다. 현재 압축 표시 좌표를 `R=18 ln(1+r/au)`로 역변환한 위치 스냅샷과 대상의 채택 위치를 비교한다. 마우스 움직임으로 물리적 속도나 세계선을 추정하지 않는다. 원 관측 z와 음수 부호를 유지하며 FLRW 거리 참고값·별도 입력 β의 SR·정적 Schwarzschild 계수를 분리한다. 계수 곱은 설명용 근사이며 전체 물리법칙/자기일관적인 전 우주 시공간 복원을 구현했다고 주장하지 않는다.
- 질량 정본은 130355B/SHA `7668d7caf418aaae363acf41fa50e9a69795ff1e3c99a178534a83552fc82112`이다. 6종 실제 비교 위성의 bulk 밀도와 6개 대상의 기존 크기로 36개 가정을 만들고 Decimal45자리 독립 계산과 전부 대조했다. 질량/범위·Π·필요 밀도를 별도로 표시한다. 밀도에는 조성·공극률·중력압축이 영향을 주며, 다른 천체로 복사하는 것은 가정이다. 출처 경계는 통계적 신뢰구간이 아니고 고정 6종 자료 범위의 조건부 목록은 0개다. 사용자 입력과 이 목록을 구분하고 실측 질량/IAU 공식 분류는 보존한다. 명왕성의 2006년 분류 이유를 설명한다.
- 블랙홀 정본은 106361B/SHA `4818701162f76fe3bc97383c1b0d2cd8d750b95466d15c95f046b229126cbbbd`, 관측자 정본은 271921B/SHA `61ca1cf4d24dfe337adb905070328d525ac982d4857db335906a7dbac1bea105`이다. 11개 실재 대상 중 9개에 채택 질량, 2개에 고정 EHT 관측 영상이 있다. 실제 사진 2개는 103617B이며 재색칠하지 않는다. 14개 z 행 중 채택값 10개/미확보 4개를 보존한다. NASA/IPAC 집계와 원 관측 기여기관/기준계 미확인을 구분하고 전수 비중국 기원으로 확대하지 않는다. 새 중국 기관 제공자는 채택하지 않았다.
- FLRW 참고표는 H0=67.66, Ωm=.3111, ΩΛ=.6889의 matter+Λ 모형이며 radiation/neutrino 진화를 생략한다. 계산의 Tcmb0=0은 radiation 비활성화이며 실제 CMB 0K 주장이 아니다. 전체 Astropy Planck18과 구분하고 z0..20/2049행 범위 밖은 미산출이다. 블랙홀 근접 보기의 휠/정확 r/Rs/방위각과 null RK4 경로는 별도 비회전·비전하 적도 모형이다. 강착 강도·Kerr·내부·관측자 하늘 영상을 복원하지 않는다. 질량 미확보 대상에는 Rs를 만들지 않는다.
- GET mass-scenarios/POST calculate, GET black-holes/observer-physics, Pydantic/OpenAPI/TS와 optional 세션 가정·세 source SHA·선택 블랙홀 ID를 연결했다. 새 세션 import는 실제 관측 품질을 우선 열며 실험을 다시 열면 파라미터를 재사용한다. 원 SPHEREx 영상·DATE-AVG·판단은 불변이다. 단위/상태/조건/오류를 5언어로 구현했다.
- 전체 Python **483 PASS/76.49초**, 기존 의존성 deprecation 경고 1개다. Vitest **70 PASS/1.30초**, strict TypeScript/Vite, Ruff check 및 63파일 format check를 통과했다. 별도 관측자 API27 PASS/9.75초는 실제 FITS 비교와 새 앱 인스턴스 복원을 포함하며 OS 서버 재시작 검사와 구분한다. DataSpec은 **1791636B/3061줄/SHA `e848ee7025f315a6cfa127f67b3120a2c7ef2f5bee2d3515e26bbd7a1c3aba33`**로 동결했다. 26정본/2041물리파일(1987data+53public+helper1),1079정본참조/1084sidecar포함/32내장응답/53서빙복제다. 최초102원본987987584B 보존 및 문서·실파일·참조·복제 SHA/크기·누락/중복 불일치0을 독립 확인했다.
- 중간 TyRAtsbd 질량 Chrome5고유경로를 통과했다. 최초 optional null 생략의 테스트 기대를 정본의 의미에 맞춰 교정했으며 제품 수치는 바꾸지 않았다. 중간 DbNwNokf 관측자 Chrome5 PASS/1은 source 첫 로딩을 기다리지 않은 테스트 기대 문제였다. root가 직접 화면을 읽어 검색/소개 문구와 블랙홀 제목의 겹침을 발견했고 App hidden 조건을 교정했다. 최종 camera end 이벤트 누락을 막기 위해 중복 100ms throttle도 제거했다. 최종 빌드는 `index-CNYGnNg7.js`이며 현재 13경로 회귀와 정확 ZIP/실제 서버 재시작 검증을 후속 확정한다. 이전 통과를 새 아카이브의 성공으로 대체하지 않는다.

- 후속 확정: `CNYGnNg7`에서 질량5+관측자6+기존실관측2의 **13/13 PASS/142.460초**(2026-11-14T11:17:28.357Z 시작), unexpected/flaky/skipped0이다. 실제 εB의 S01/S02·품질·원시각·판단과 새 context의 질량가정/블랙홀ID·r/Rs/β/파장·카메라/source SHA를 복원했다. root/검토자가 직접 화면에서 관측자 패널 닫기 버튼과 블랙홀 버튼의 작은 겹침도 확인해 CSS 상단 여백 한 값(24→50px)을 교정했다. 최종 **`index-BfRDPmgL.js`/`index-DZOoVrJ5.css`**의 영향2경로 **PASS/9.647초**(11:20:48.806Z 시작)와 비겹침 bounding/직접화면을 확인했다. 13개 전체를 마지막 CSS 빌드에서 재실행한 것은 아니며 두 실행을 분리한다. 정본은 `var/qa/dev011-final-browser-results.json`·`dev011-observer-spacing-followup.json`·`dev011-observer-review.json`이다. 최종 Vitest70 PASS1.76초/strict/Vite도 확인했다. 정확 ZIP/OS 서버 재시작은 아래 릴리스 확정 기록으로 별도 확인한다.


### DEV-011 최종 완결 ZIP 확정 · 2026-11-14 20:24:20 KST

`NASA_SPACE_APPS_CHALLENGE_v0.8.0_20261114_202331KST.zip`는 **484956608B/2095파일**, SHA256 **`1bb76a9158cf6d36c0c632b4d32cf0b7edd380a07e1f3031b8a6bdcbaa3253e3`**이다. source `45375fc52300c41211063160b1cf9f2dee45ef67`의 clean tree와 최종 BfRDPmgL/DZOoVrJ5 빌드로 생성했다. 추적 manifest/source sidecar 32개의 Git index와 동결 working bytes가 모두 일치함을 확인하고 origin/main의 정확 SHA도 대조했다.

정확한 최종 ZIP을 새 폴더 `tmp/release-verify-y39fvc3n/extracted`에 풀어2094개 manifest 항목의 경로/대소문자/바이트/SHA와 금지 파일 제외를 확인했다. Windows에서 health·대표/신규 API·실제 지도/사진 원바이트·질량 가정·11BH/2EHT/2049표를 확인하고 실제 API/worker 재시작 뒤 같은 εB/Pluto result/evidence ID·세션/판단·새 가정을 복원했다. 검사시각 `2026-11-14T11:24:20.927409+00:00`, 재사용한 독립 runtime이며 새 의존성 설치·Linux·공개 서비스 검증은 아니다. 상세 정본은 [v0.8.0 검증 기록](./releases/v0.8.0.json)과 ZIP 밖 동명 checksum/verification JSON이다. 이 사후 문서와 커밋은 이미 검증한 불변 ZIP에 추가하지 않는다. 이전 v0.6 ZIP/기존 원본/Git 이력도 보존한다.

- 릴리스 인계 전 Notion 가용성을 다시 확인했다. 현재 연결 도구 목록에 Notion 도구가 없고 기존 공용 URL의 읽기 시도는 도구 접근 불가로 반환됐다. 새 팀 요청/후속 공지를 최신 확인했다고 기록하지 않는다. 사용자 직접 지시와 현재 로컬 정본을 기준으로 승인된 개발/검증을 완료했다. 외부 메시지·페이지 편집·공개 배포/제출은 수행하지 않았다.

### DEV-012 · Node.js 전용 실행 / 질량 어림값 / 카메라 확대 · v0.9.0

- 사용자가 서버에 Node.js만 실행 가능하다고 확인했다. `app.js`를 루트 시작 파일로 제공하고 내장 모듈만으로 HTTP/API·정적 빌드·상태/근거와 worker thread를 실행한다. Python 서버를 시작하거나 프록시로 필수 연결하지 않는다. 기존 Python 과학 코드는 실제 FITS 빌드 계산/독립 재검산용으로 보존했다. 새로운 임의 FITS 분석 API가 생겼다고 주장하지 않는다. ADR-003과 FSD의 최신 Node 계약으로 이전 기본 Python 운영 지침의 충돌을 정리했다.
- 원 reader 응답99개와 실제 FITS에서 **새로 계산한 비교4개**(두쌍의 정/역순)를103JSON/66642151B로 내보냈다. runtime/canonical manifest는 각각473765B/SHA `9dfe12f530da0e6993ced98cc1a94932eb8aef161b6ca68e1a5cb081df44a2af`다. source1859개 중필수1564개/531456149B, optional295개를 구분한다. HOLD96/출판사 감사 upstream의 전부를 런타임에 요구하지 않는다. source/보정·알고리즘·사전 계산 결과와 Python 원 JSON float·comparison SHA/result ID를 보존하고 Node 요청 때 검증한다. 실제 관측창에5언어의 검증 사전계산 고지를 연결했다. 새 원본을 런타임에 분석하거나 새 운동/측광을 검출했다고 표시하지 않는다.
- 세번째 요건의 본체 질량 미확보 대상은 원 실측 mass/null·공식 분류를 유지하며 가정값으로 `현재 질량 ≈ X M⊕`를 표시한다. 기본 출처 Tethys984 또는 마지막 유효 밀도 입력을 compact/확장창/editor가 공유하고 가정 밀도·미측정임을 함께 설명한다. 잘못된 입력/실패는 마지막 유효값을 보존하고 다른 대상/출처 해시의 늦은 값은 표시하지 않는다.
- 위성 선택 시 radius를 min.32로 키우고 비선택 min.035~.22로 줄이던 분기가 원인이었다. 선택과 무관한 표시 반지름과 실제 geometry/group/surface mesh scale을 유지하고 카메라만 작은 위성에 접근하도록 변경했다. 최소 시선거리는.05로 기존 세션 계약과 일치한다. 지도 로딩·선택 취소·관측자 전환에서도 실제 geometry/scale·물리 참고반지름과 카메라를 별도 검사하도록 metadata와 QA를 연결했다. 전역 거리/반지름 압축은 기존 표시 가정이며 제거했다고 주장하지 않는다.
- Node14검사 PASS21.900초(양순서4비교·8MB/스키마/잠금·실제 Node 서버/worker 재시작·소스 누락/변조/복제·근거/새 상태 복원)를 확인했다. 별도 Python-free PATH의 새 실제 Node 서버와 Python 참조를 HTTP로 대조한67검사 PASS19.13초다. 임의 밀도48·BCE/0/미래 달력8·표시 보간6·잘못된 날짜5를 포함한다. 첫 전체실행은483 PASS/67 공유fixture ERROR172.00초였다. 원본 해시 검증 중2초 health probe의 TimeoutError를 테스트가 재시도하지 않던 조건을 교정했다. 재실행 **전체550 PASS113.36초**, 기존 의존성 경고1개다. Vitest71 PASS1.62초·strict/Vite 최종 `index-DLJsfpSc.js` 및 Ruff65 check/format도 확인했다.
- Node8081의 실제 GET/사진 원바이트·카탈로그/원시각·29/32품질·εB/명왕성 근거 save/export/import·새 가정 저장을 기존 smoke client로 확인했다. 이 호출의 Python은 개발 검증 클라이언트이며 서버 프로세스가 아니다. 기존 Python8000과 다른 고유 상태/포트를 사용했다. Node8081의 실제 Chrome23경로는 현재 수행 중이고 정확 ZIP의 해제/실제 Node 재시작은 후속 확정한다.
- 최종 DataSpec은2026860B/3422줄/SHA `e441b64d2d22dfda73342cb5465825b9e74fc7ca8a21ca44b0565337cfe796c5`다. 27정본/2146전수파일(data2092+public53+helper1),1279102066B이며1932정본참조/1937sidecar포함·32내장응답/53서빙복제를 기록했다. 독립 전체 경로/해시·크기/누락/중복/복제 검수에서불일치0, 원102개987987584B도 모두 보존했다. 초기 Node manifest 두 번의 동결 전 metadata/Windows 경로guard 교정은 기존 비교4개/99응답의 원바이트를 바꾸지 않았으며 최종SHA와 구분한다.
- 현재 Notion 읽기 재시도는 도구 접근 불가이며 새 공지/팀 요청의 최신 확인으로 보고하지 않는다. 현재 사용자 직접 지시와 실제 코드/자료를 기준으로 작업했다. Git/원본/이전ZIP은 보존하고 외부 메시지·공개 배포/제출·Linux/Docker 실행은 수행하지 않았다.


DEV-012 검증 최적화: 초기 Node UI 부분검사는 완료19개 중15 PASS/4 응답·전체시간 한도 실패였고20번째 중단/3미실행으로 보존했다. 수치·분류·원질량·geometry의 실패 증거는 없었으나, job/result/save/import가 약700MB의 필수/파생/서빙 복제 원바이트를 반복해서 읽어 지연됐다. `sha256-stat-fingerprint-v1`은 최초 전체SHA 검증 후 매transaction 모든 필수 실경로와 dev/ino/size/mtimeNs/ctimeNs를 검사한다. 같은 식별/메타이면 이미 검증한digest를 재사용하고 변경되면 사용 전 원바이트 SHA를 다시 계산한다. 동시에 이미 대기하는 요청만 검증pass를 공유하며 시간TTL은 없다. 원 비교raw SHA는 매읽기 확인하고 시작/CLI/정확ZIP의 full audit는 유지한다. 입력은 읽기전용·불변 운영 계약이며 관리자가 파일식별과모든시각까지 위조하는 상황의 보증으로 확대하지 않는다. `node app.js --verify-sources`는 서버 시작 대신 필수자료 전체SHA 감사를 실행한다.

Node14 회귀는 같은크기+mtime복원변조/누락/강재fullaudit/동시5요청1검증을 포함해9.701초에통과했다. root 재검 Node14 PASS9.515초·Python 없는 PATH 실제 HTTP/과학67 PASS14.12초를 확인했고 source key의 prototype 상속을 실제 천체로 허용하지 않도록 Object.hasOwn 검사를 보강한 뒤 HTTP6후속 PASS10.265초를 확인했다. 실제 warm Windows/이미 SHA확인된 Node8081에서12GET동시480ms·job185ms·manifest173ms·save332ms·import490ms,합계1.836초를 관찰했다(`var/qa/dev012-node-performance.json`). 초기/다른호스트 성능 보장이 아니다. 수치/결과ID·동결103JSON/원본해시는 변경하지 않았고 최종 Chrome/ZIP 검증은 별도로 확정한다.


DEV-012 최종 브라우저 확정: Node8081/최종 client `index-DLJsfpSc.js`·runtime manifest9dfe…에서23고유경로를 확인했다. 23개 batch는22 PASS/1복합workflow 전체60초 timeout(374.878초)이었고 개별15초 기대값 실패는0이다. 5언어/깜빡임/PNG·JSON·CSV/새문맥복원/공식4대상왕복을한case로묶은검사만전체120초로명시해별도후속1 PASS68.454초(2026-11-14T12:35:11.024Z시작)를확인했다. 과학기대값·단계별15초·제품/Node/source를변경하지않았다. 23개가같은batch모두통과했다고주장하지않고22+1후속으로기록한다. 초기최적화전부분실행15PASS/4지연실패와도구분한다. 정본은 var/qa/dev012-node-final-browser-results.json,dev012-node-observation-followup.json과review보고서다.

Moon의표시R0.20874/물리R1737.4km·group/mesh scale1은선택전후유지됐고camera eye-target은3.089216→0.923769표시단위로접근했다. Phobos의표시R0.036108/물리R11.08km도유지됐고camera거리는0.159789였다. bounding sphere≤1.5e-9차이는12→64 subdivision Float32정점반올림이며확대scale가아니다. 실측첨부 var/qa/dev012-moon-geometry-evidence.json에원수치를보존했다. 질량approx/원mass null/IAU분류·늦은결과·실제촬영시각/품질·관측자/근거/복원·Node사전계산5언어고지도검사했다. 정확v0.9 ZIP의실제Node실행/재시작검증은최종사후기록으로확정한다.


### DEV-012 최종 완결 ZIP 검증 확정 · 2026-11-14 21:40:02 KST

`NASA_SPACE_APPS_CHALLENGE_v0.9.0_20261114_213804KST.zip`는 **495916482B/2223파일**, SHA256 **`fd3c694f354bac02ba9728dae521b13d7b41250870bc3b050ee8629d6b467db7`**이다. source `7b2dbf7c4e5ee6798fd9c56230a7858ae8dde3e4`의 clean tree, 최종 DLJsfpSc 프런트와 Node 전용 `app.js`/검증된103JSON으로 생성했다. 추적 manifest/source sidecar33개의 Git index와 실제 동결바이트도 전부 일치했다.

정확한 ZIP을 새 `tmp/node-release-verify-r4s83m6d/extracted`에 풀어2222개 release manifest 항목의경로/바이트/SHA와필수원본·캐시를확인했다. Node22.17 절대경로와 `app.js`만서버로실행했고 PATH에서Python실행파일을찾을수없게했다. 개발검증기/HTTP클라이언트의Python과서버의Node를구분한다. 실제두관측·29/32품질·지도/사진·카탈로그·새가정을확인하고실제Node프로세스와worker thread를종료/재시작한뒤 εB/Pluto및추가근거의같은ID·판단·카메라·밀도/관측자설정·export원바이트/import복원을통과했다. 정확완료시각 `2026-11-14T12:40:02.175944+00:00`이다. 상세는 `docs/releases/v0.9.0.json`과ZIP밖동명verification/checksum JSON을따른다. 이사후문서는검증한불변ZIP에추가하지않는다. 기존v0.8 ZIP/원본/Git이력도보존했다. Linux/Docker·공개서비스·사람/원어민검수는수행하지않았다.


### OPS-013 v0.9.1 기본3002 완결 ZIP 검증 확정 · 2026-11-14 22:08:22 KST

`NASA_SPACE_APPS_CHALLENGE_v0.9.1_20261114_220703KST.zip`는 495928120B/2224파일, SHA256 `53a162c40395198559eb1ef2d67840e44aa568bf2a5afebffa47857706c30803`다. source `4b18d32b37c5bccb37e08ed040ffd5931f129dec`의 clean tree에서 생성했고 기존 프런트/과학103JSON 및 Data_Spec SHA를 보존했다. 정확한 ZIP을 새 폴더에 해제해 manifest2223개와 모든 필수자료를 검사했다. PORT/APP_PORT 없이 `node app.js`만으로 기본3002에서 실제 Node 서버를 실행했고 ready·실제 관측/품질·근거저장과 프로세스/worker 재시작 뒤 같은 근거/결과·export 바이트 복원을 통과했다. Python은 개발 검증/HTTP 클라이언트일 뿐 서버 의존성이 아니다. Node전체18PASS10.909초와 변경 배포도구Ruff를 확인했다. 정본은 `docs/releases/v0.9.1.json` 및 ZIP 밖 동명 checksum/verification JSON이다. 이전 ZIP/원본/사용자 상태는 변경하지 않았고 이 사후문서는 이미 검증한 불변 ZIP에 넣지 않는다. 실제 MCSM/nginx 설정 변경·Linux/Docker·공개502 복구는 수행/확인하지 않았다.
