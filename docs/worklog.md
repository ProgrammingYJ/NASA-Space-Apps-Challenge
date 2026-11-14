# 작업 기록

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
