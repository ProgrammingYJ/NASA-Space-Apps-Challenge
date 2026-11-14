# NASA-Space-Apps-Challenge

Planet X and SPHEREx — 실제 관측과 과학적 가설을 연결하는 우주 탐색 웹사이트.

2026 NASA Space Apps Seoul · 제작 11월 14일 09:00부터 · 최신 공식 마감 11월 15일 23:59 KST(권장 완료23:55).

기본 화면은 자유롭게 조작하는 우주 탐색이다. 실제 JPL 태양계 위치와9개 궤도 안내선을 둘러보다 천체를 선택하면 자동으로 포커스하고, 같은 화면에서 ε Indi B/명왕성의 실제 SPHEREx 관측·품질·근거를 연다. 대상별 작업과 카메라/모형시각·궤도표시조건을 보존·새 세션 복원한다. 공개 지도31개와 고리4개·확장 태양계476개·외계행성6470개를 연결했다. 공개 서버·Planet X/TESS 실험·정밀 운동/광도 측정은 미완료다. 전체 최신 명세와 범위는 FSD에서 관리한다.

현재 v0.6.0은 위성·왜행성476개 표시명/검색의5언어 적용, 별도 과거·미래 태양계 근사 모드, 은하 내부의 출처 확인 천체/항성계 탐색을 추가했다. 상단 **빅뱅 · 우주 역사**는 실제 관측5영상과 출처의 추정 연대/범위만 제공한다. 가상35은하·성장 장면은 현재 App에서 호출하지 않는다. 이동 전37d9548은 GitHub main에 저장했고, 재개초기Python276과 최신Vitest55·strict/Vite,입력/API교정후장기29검사를 통과했다. 관련Chrome13개고유경로와Windows준비번들의해제/재시작검증을통과했다. 최종ZIP의정확한커밋/바이트/해시와실행결과는동명외부검증JSON에서확인한다. [Data_Spec.md](Data_Spec.md)는자료파일1631개+명시참조helper1개,877참조경로·32내장원응답·43정적복제의 사용/확보/이전 상태·출처/SHA·가공/권리를 기록한다. 공개서버·F01잔여/Planet X/TESS·정밀 측정·사람/원어민 검수는 미완료다.

- 개발 규칙: [AGENTS.md](./AGENTS.md)
- 단일 기능·개발 명세: [FSD.md](./FSD.md)
- 데이터 사용·출처 전수 명세: [Data_Spec.md](./Data_Spec.md)
- 프로젝트 Skills 운용/설치 목록: [SKILLS.md](./SKILLS.md)
- 상세 초기 개발 프롬프트: [START_HERE_PROMPT.md](./START_HERE_PROMPT.md)
- 설정 목록: [.env.example](./.env.example) — 로컬 `.env`는 Git에 포함하지 않는다.
- 작업 기록: [docs/worklog.md](./docs/worklog.md)
- 자료 위치/상태: [docs/data_inventory.md](./docs/data_inventory.md)
- 검사·근거 목록: [docs/evidence_index.md](./docs/evidence_index.md)
- 최신 공식 규정: [docs/official_rules.md](./docs/official_rules.md)
- 화면 설계 참고: [docs/design_references.md](./docs/design_references.md)
- AI 사용 고지: [docs/ai_usage.md](./docs/ai_usage.md)
- 서비스 주소: https://nasaspaceappschallenge.marulee.dev/

기본 흐름은 **우주 탐색 → 실제 SPHEREx 관측 → 가설 변경/예측 비교 → 근거 저장·복원**이다. 태양계 외곽 Planet X와 외계행성 탐구를 연결하며, 관측/모형/미검증 값을 구분한다. 구현 순서와 범위 축소는 AGENTS.md를 따른다.

현재 구성: TypeScript/React/Vite/Three.js 우주 탐색과 관측 작업대, Python3.12 FastAPI와 별도 과학worker, Astropy FITS reader, 파일기반 근거 저장. Aladin/Plotly·가설 실험은 후속 단계다.

## 로컬 실행

Python3.12와 Node22.17.0에서 검사했다. 먼저 [자료목록](data/manifests/datasets.json)의 S01/S02/S10(εB), S12/S14/L051(명왕성)을 동일한 `local_relative_path`에 배치한다. 작은 JPL장면/Pluto관측자 manifest도 필요하다. 확장 카탈로그는 `data/reference/solar-extension/`·`data/reference/catalog/nasa_science/`, 외관은 `web/public/textures/`·`data/reference/appearance/`, 역사/은하/카이퍼대는 `data/reference/history/`·`data/reference/galaxies/`·`data/reference/kuiper/`와`data/reference/cosmic-morphology/`·`data/reference/cosmic-observations/`의 manifest 지정 원본 및`web/public/observations/cosmic/`의5관측 이미지가 필요하다. 장기근사/계층/이름은 data/reference/long-term/·universe-catalog/·object-names/와 대응manifest도 보관한다. 관측/참조 원본은 Git 제외이므로 저장소 clone만으로 모든 데이터가 준비되지는 않는다. 현재 로컬에는 확보했고 실행 시 SHA/바이트를 확인한다. 서버 전달용 완결 ZIP에는 필수6관측/보정과 채택한 확장 원본을 포함한다.

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python -X utf8 -m pip install -r requirements.lock.txt
npm --prefix web ci
npm --prefix web run build
.venv/Scripts/python -X utf8 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

http://127.0.0.1:8000/ 에서 드래그/휠/키보드로 우주를 탐색한다. 천체 클릭 또는 검색에서 `명왕성`/`ε Indi B` 선택→자동 포커스→`실제 관측 보기`→`관측 비교 열기`→품질/출처→판단 저장→JSON 내보내기→새 세션→JSON 가져오기를 실행한다. 관측 패널을 닫아도 우주/카메라를 유지하고 대상별 판단을 보관한다. CSV는 보조자료이며 JSON이 전체 복원 정본이다. 나머지 공식4대상은 확보된 자료목록과 품질/공간위치 미검증 상태를 제공한다.

정밀 시간 재생은2026년11월13~16일의72시간 범위로 정지 상태에서 시작한다. 실제1초당 모형1/6/24/72시간(기본6)을 선택하며, 끝에서는 멈추고 다시 재생하면 처음부터 시작한다. 수동 시각 변경·탭 숨김·저장은 정지시키고 가져오기/새 세션도 정지 상태로 연다. 연속 위치는 `display-hermite-v1` 보간이며, 아홉 궤도 안내선은11월14일00:00 UTC의 접촉궤도로 고정한다. 선택 추적 중 직접 카메라를 조작하면 추적을 해제한다. 재생 시각·속도·카메라/추적 상태는 근거에 보관한다.


시간 모드의 **과거·미래 시뮬레이션**은 기존72시간 천체력과 별도다. 천문학적연도−2999(기원전3000년)1월1일부터서기3000년1월1일까지 JPL 적합요소 근사를 계산하며0년은기원전1년이다. 표시시각은TDB달력값이고 당시UTC나수십억년진화복원이 아니다. 연도/월/일은 입력후 Enter·다른필드로이동·이동버튼으로 적용한다. 편집중 재생을정지하고잘못된날짜는오류와함께마지막유효장면을유지한다. slider와72h/s·1/10/100년/s도 지원한다. Sun+8대표행성계만 표시하며 지구는지구–달질량중심이다. 해당표식의물리반지름은표시하지않고지구지도는대표아이콘임을안내한다. 명왕성·위성 등 미지원천체를 과거72시간위치에 고정해 넣지 않는다. 원본 관측 시각은 바뀌지 않고 정밀 모드로 돌아가면 원래시각을 유지한다. 명목오차는 보장 상한이 아니다.

상단 **우주 천체 탐색**, 또는 은하를 고른 뒤 정보패널의 천체 탐색을 열면 출처로 확인한 성원과 종류별 목록을 본다. 공개하늘방향 지도에서 선택하면 자동확대하고 드래그/휠로 탐색한다. 방향지도는 깊이/표면의3D복원이 아니며 미측정 거리는 만들지 않는다. 외부9은하15대표성원과 우리은하 사례8개·태양계, 기존4862호스트/6470외계행성을 연결했다. 호스트→자식행성을 고르면 기존3D항성계 모식도에서 확대하고, 태양계/εIndiB는 원래장면/실관측으로 돌아간다. 목록은 전체우주 전수조사가 아니다.

위성468개·추가왜행성/후보8개는 언어별 표시명과 검색별칭을 쓴다. 국제지정명293개는 원문을 유지하고 부모/종류 문맥을 번역한다. 기관확인 표기와 프로젝트음역·관례를 Data_Spec에 구분했으며 원과학ID/영문명/벡터는 변경하지 않았다. 일본어·번체·프랑스어 전체사전의 원어민검수는 미확보다.

설정에서 카이퍼대/은하 표시를 켜고 끈다(새 화면 기본on). 카이퍼대30–50AU의650점은 설명용 분포이며 실제 객체/밀도/두께가 아니다. M31/M33/M81/M87/LMC/SMC/M51/M104/Centaurus A의9개 은하는 원문 방향·근사거리로 배치하고 선택하면 자동 포커스한다. 경사진 나선원반·타원은하/제트·막대/불규칙구름·상호작용 동반은하·먼지띠를 공식 관측 특징에 맞춰 구분한다. M31경사77°·M81두팔·LMC막대/한팔은 출처를 연결하고 다른 경사/모든 위치각 미상값과 표시 가정을 분리한다. 입자·크기/회전·미확인 자세는 설명용이며 실제 별 위치나 과거 공간 복원이 아니다. 새 설정은 근거에 저장하고 필드가 없는 과거 context는 두 표시off로 호환 복원한다.

상단 **빅뱅 · 우주 역사** 또는 시간 모드의 같은 항목을 열면 Cosmic Gems/Firefly Sparkle/CEERS/REBELS-25/ZS7의 실제 공개 처리영상5개를 본다. 대상의 빛이 출발한 우주 나이는 출처의 근사추정 .46/.6/.7/.74Gyr 또는CEERS표본.6–6Gyr범위를 보존한다. 영상 취득일과 구별하고 전경·배경 전체에 같은연대를 배정하지 않는다. 중력렌즈/색합성·가스속도map·크레딧/권리·원본링크를 제공한다. 사례선택/정수slider·3/5/8초 슬라이드쇼는 자료순서 표시이며 물리성장/중간시각사진을 생성하지 않는다. 숨김·import·수동선택/모드전환은정지하고 원래 태양계시각/카메라/실노출·판단은 유지한다. 가상3D 과거장면·임의 Gyr 입력·10anchor버튼은 현재화면에서 제외했다.

확장 태양계는 위성468개와 추가 왜행성/후보8개를 등록하고 실제 위치471개(위성463개)를 지원한다. 위치 미지원5개는 목록/사유만 제공한다. 추가 경로선은 실제72시간 예측 표본의 열린 선이며 완전 궤도나 실측 이동이 아니다. 공개 지도31개는 촬영시기·미관측 영역·향상색/레이더/대표 대기를 구분하고, 고리4개도 반지름·극방향 출처와 표시 가정을 알린다.

외계행성은 날짜 고정 NASA Science 공개6470개/4862모항성계를 검색하고 원 수치·추정/누락·출처를 연다. 거리/epoch가 검증되지 않은 자료는 방향구로 표시하며 설명용 표면/항성계 모식도를 실제 관측 지형·현재 행성 위치·존재확률로 쓰지 않는다. NASA Exoplanet Archive PS 기본해나 WASP-4 b 실제 TESS 실험과는 별도다.

기본 영속 경로는 `var/jobs`, `var/comparisons`, `var/evidence`다. 환경변수 `APP_STATE_DIR`로 상태 루트를 지정할 수 있다. 같은 디렉터리에 API를 여러 개 실행하지 않는다. `--reload` 대신 수정 후 API를 종료하고 다시 실행한다. API가 worker를 생성/종료하며 worker는 상태파일을 직접 쓰지 않는다. 개발용 Vite는 별도 터미널에서 `npm --prefix web run dev`로 실행한다.

복원은 현재 원본/보정SHA·알고리즘과 로컬 비교 정본도 확인한다. 서버를 옮길 때 근거JSON만 가져오면 비교 정본이 없어 재계산 필요 상태가 된다. 상태보관은 API/worker를 종료한 뒤 `var`와 사용 원본의 manifest를 함께 보관한다. 재시작/업그레이드 시 기존 `var`를 초기화하지 않는다. 오래된 미완료 작업은 interrupted로 남는다.

## 실행 검사

```powershell
.venv/Scripts/python -X utf8 -m pytest -q
.venv/Scripts/python -X utf8 -m ruff check api science worker tests
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web test
npm --prefix web run test:browser
```

브라우저 검사는 실행 중인8000번 API와 production build를 사용한다. 설정/증거는 web/playwright.config.ts와 var/browser-results·var/qa에 있다. [작업기록](docs/worklog.md)의 DEV-001~008에서 당시 결과와 현재 재개 검사를 구분한다. 재개초기Python276PASS(76.90초)·strict/Vite/Ruff를 통과했다. 이후보고된 연도입력의Enter/blur 적용과검색겹침을수정했고 최신Vitest55/장기API29·strict/Vite를확인했다. 이동 전 테스트준비오류1건은 수정 후전체실행으로 해결했다. 입력/검색수정빌드의새Chrome6,이후EMB/기존관측회귀,마지막지원위성로딩을포함해13개고유Chrome경로를통과했다. 빌드별수정영향경로를재검사한결과이며13개모두를마지막빌드에서한번에실행했다는뜻은아니다. 지원위성의대기문구도관측loading과구분해천체력timelineLoading으로교정했고 최종제품빌드는index-D7O_yXx_.js다. 이빌드에서이름/시간/오류/로딩4경로를추가재검해통과했다. Windows초기준비번들의해제/재시작검사는통과했다. 최종D7 ZIP의정확동일아카이브검사는패키징후별도로실행하며동명외부검증JSON이정본이다. DEV-007 실제관측-only Chrome6과v0.5.0의21경로/ZIP검사는 이전 이력이다. 원어민/내부사용자·Linux/Docker/공개서버 검사는 별도다.

## 실제 제공 API

`GET /api/v1/universe`, `GET /api/v1/timeline`, `GET /api/v1/objects`, `GET /api/v1/observations?object_id=epsilon-indi-b`(또는pluto), `POST /api/v1/comparison-jobs`, `GET /api/v1/jobs/{id}`, `POST /api/v1/jobs/{id}/cancel`, `GET /api/v1/comparisons/{id}/manifest`, `POST /api/v1/evidence`, `GET /api/v1/evidence/{id}/export?format=json`, `POST /api/v1/evidence/import`를 제공한다. `/timeline`은 한 번 읽을 작은 원본 매듭 묶음이며 매 재생 프레임의 요청이 아니다. `/universe?epoch=`는 지원72시간 범위의 시간대 명시 시각을 받는다. `/docs`와 [OpenAPI](contracts/openapi.json)에서 입력을 확인한다. `/health/live`는 응답, `/health/ready`는 실제 저장 쓰기/읽기와 worker heartbeat를 확인한다. 자유좌표/원격아카이브 검색·measurement-jobs/simulation-jobs는 아직 제공하지 않는다. 별도장기모형의읽기 API는 아래에구분한다.

확장 읽기 API는 `GET /api/v1/appearance`, `GET /api/v1/catalog/solar-system`(목록; `?parent_id=saturn` 등은 해당 부모의 시간표본), `GET /api/v1/catalog/exoplanets`, `GET /api/v1/catalog/exoplanets/{object_id}`다. 실제 이미지 파일은 `/textures`에서 제공한다. 요청 중 외부 자료를 내려받지 않으며 카탈로그 탐색을 새 SPHEREx 관측/근거 저장 성공으로 표시하지 않는다.


DEV-008 읽기 API는 GET /api/v1/long-term-model(로컬공식계수/범위·출처), GET /api/v1/long-term-simulation?year=2500&month=1&day=1(8대표위치), GET /api/v1/catalog/universe(기본24), ?galaxy_id=galaxy-milky-way(4871총항목), ?parent_id=호스트ID(자식행성)다. 입력달력/범위·미지원선택은422, 확인할 원문/모형이 없으면503이며 실제세부는 OpenAPI/FSD를 따른다. 정적경로는 /textures/*와 /observations/cosmic/*이며 API접두사를 붙이지 않는다.

과거 DEV-005의 호환 읽기 API는 `GET /api/v1/cosmic-history`, `GET /api/v1/cosmic-history/sample?age_gyr=0.00038`, `GET /api/v1/catalog/galaxies`, `GET /api/v1/kuiper-belt`다. 이 호환연대 API의 입력은 유한0~13.8Gyr이며 범위 밖/NaN/Infinity는422다. 현재 과거 UI는 GET `/api/v1/cosmic-observations`만 사용한다. 실제5이미지는 `/observations/cosmic/`에서 제공하고 임의연대 사진을 생성하지 않는다. 모두 검증된 로컬 원문만 사용한다. 저장/import는 manifest뿐 아니라 해당 지도/벡터/은하 실제 원본의 무결성도 확인한다.

관측 작업대 이미지는 정합하지 않은 native cutout이며 표식은 예측이다. 깜빡임으로 이동/검출을 확정하지 않는다. 원본 IMAGE는 MJy/sr의 표면밝기로 ZODI 미차감이며 정량 flux/운동은 미검증이다. 실제 입력/출처·품질/상태·한계가 근거에 포함된다. 공개 표면지도와 카탈로그 설명용 외관은 이 실제 관측과 구분한다.

Git에는 작은 코드·계약·출처 목록을 보관하고, 대형 관측 파일과 내부 실명/공지 원문은 로컬 또는 별도 자료 저장소에 보관한다. 공개 산출물은 NASA 로고·이용 조건·만18세 미만 식별 정보 검사를 적용한다.

서버 전달용 전체 ZIP의 로컬경로는 artifacts/NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_182253KST.zip다. 필수6원본/보정·공개지도/5관측영상·기존JPL/확장/NASA카탈로그와 새장기계수/검산·천체계층/이름의 원문/manifest, Data_Spec·정적빌드·코드·lock·라이선스/실행복구안내·release_manifest를 포함한다. 초기Windows준비번들은18:22:00KST에새폴더해제/파일1807개·health·주요카탈로그·εB/Pluto근거와실제서버재시작복원을통과했다. 최종D7 ZIP은clean소스로생성후정확동일아카이브검사를별도실행하고ZIP밖동명checksum/verificationJSON에커밋·바이트/SHA·실제결과를기록한다. 준비번들검사를최종D7바이트검사로혼동하지않는다. Linux/공개서버는 미검증이다. 업로드→새디렉터리해제→[실행/복구 안내](deploy/README.md)로 시작→health/정밀·근사·역사보기·계층/카탈로그·저장복원을 확인한다. 이전 v0.5.0 완결 ZIP은 보존한다.

## 보존 이력: DEV-008 urgent travel checkpoint - 2026-11-14T15:54:38+09:00

다음은 이동 당시 기록이다. 현재 상태와 최신검사는 위 요약 및 작업기록을 따른다.

User explicitly requested wrap-up within one minute before shutting down. Stop new browser/release work and preserve current source/data/Git.
Implemented v0.6.0: 476 object names in five locales with original designations/IDs retained; separate JPL fitted Kepler simulation -2999-01-01 through 3000-01-01 TDB calendar labels (8 systems + Sun; Earth icon means EMB; unsupported objects omitted); source-backed galaxy-member hierarchy and angular zoom with existing exoplanet-system links; visible header Big Bang/history entry. History remains five published actual observation products and approximate source ages, with no synthetic 35-galaxy growth scene.

Verified: strict TypeScript/Vite index-DSKEjKdg.js; Vitest54 passed; Ruff check/48-file format. Whole pytest:275 passed,1 failed in60.64s. Failure was a test setup calling calendar_jd(-3000), which correctly rejects unsupported input; changed setup to one day before the supported minimum JD. Rerun after that test-only correction is PENDING. New long-term28/catalog19/names4 targeted tests passed previously. DEV007 observed-only Chrome6 passed on its prior build. DEV008 new six browser scenarios were WRITTEN/DISCOVERED, NOT EXECUTED. Do not claim current whole browser verification.

Resume: read AGENTS,SKILLS,FSD,START_HERE,Data_Spec and this checkpoint; preserve raw/data/var/Git. Run whole pytest and new simulation-names/universe-catalog browser scenarios, then existing cosmic/observations. Build complete v0.6 ZIP and verify fresh extraction,health,epsilon/Pluto evidence and real server restart. No public/Linux deployment or F01 remaining/F04/F05/native-language/human QA claimed.


최종 v0.6.0 ZIP 검증 확정: 481,789,033B/1807파일, source bf1a09f. 18:25:16KST에 정확한 최종 ZIP의 새폴더 해제·health·카탈로그/장기모형·실제서버 재시작 후 εB/Pluto 근거복원을 통과했다. [검증 기록](docs/releases/v0.6.0.json)은 검증 후 추가한 문서이며 불변 ZIP에는 들어 있지 않다. 공개서버/Linux 배포는 수행하지 않았다.
