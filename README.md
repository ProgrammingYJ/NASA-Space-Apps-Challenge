# NASA-Space-Apps-Challenge

Planet X and SPHEREx — 실제 관측과 과학적 가설을 연결하는 우주 탐색 웹사이트.

2026 NASA Space Apps Seoul · 제작 11월 14일 09:00부터 · 최신 공식 마감 11월 15일 23:59 KST(권장 완료23:55).

기본 화면은 자유롭게 조작하는 우주 탐색이다. 실제 JPL 태양계 위치와9개 궤도 안내선을 둘러보다 천체를 선택하면 자동으로 포커스하고, 같은 화면에서 ε Indi B/명왕성의 실제 SPHEREx 관측·품질·근거를 연다. 대상별 작업과 카메라/모형시각·궤도표시조건을 보존·새 세션 복원한다. 공개 지도31개와 고리4개·확장 태양계476개·외계행성6470개를 연결했다. 공개 서버·Planet X/TESS 실험·정밀 운동/광도 측정은 미완료다. 전체 최신 명세와 범위는 FSD에서 관리한다.

현재 `v0.5.0` 구현·로컬 검증을 완료했다. Python185 PASS(325.37초, 기존 Starlette 경고1)·Vitest40 PASS·TypeScript strict/Vite·Ruff 통과. 실제 Chrome21개 고유 경로 검사를 완료했다. 최초 전체 실행은19PASS/2실패(9.0분)였고, 동시부하의 Titan cold-parent 대기와 OrbitControls 감쇠 대기를 실제 완료/연속 안정 조건으로 고친 뒤 최종 CJgIAKg2 빌드·재시작한 cold API에서 관련4개를 모두 재검사해 통과했다. 수치 허용오차는 완화하지 않았다. 완결 배포본은 `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.5.0_20261114_144922KST.zip`다. 포함 파일/바이트/SHA 및 Windows 새 폴더 해제·health·31지도 원바이트·476확장객체/6470외계행성/9은하/역사10지점·εB/Pluto 근거와 실제 서버 재시작 후 동일 evidence/result ID 복원을 확인했다. 검증된 동일 독립 런타임을 재사용했으며 새 설치로 주장하지 않는다. 최종 ZIP의 정확한 SHA/바이트/해제 경로·실행 시각은 동명 `.zip.sha256.json`·`.verification.json`을 기준으로 한다. 문서 확정 후 최종 ZIP도 같은 검사로 재확인한다. Linux 컨테이너/공개 서버 배포는 수행하지 않았다. 사용자 지정 `MVP입니다` 커밋 `5d3a450`은 GitHub origin/main에 반영했다. 이후 최종 소스 commit은 ZIP의 `release_manifest.json.base_commit`과 Git 이력에서 확인한다.

- 개발 규칙: [AGENTS.md](./AGENTS.md)
- 단일 기능·개발 명세: [FSD.md](./FSD.md)
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

Python3.12와 Node22.17.0에서 검사했다. 먼저 [자료목록](data/manifests/datasets.json)의 S01/S02/S10(εB), S12/S14/L051(명왕성)을 동일한 `local_relative_path`에 배치한다. 작은 JPL장면/Pluto관측자 manifest도 필요하다. 확장 카탈로그는 `data/reference/solar-extension/`·`data/reference/catalog/nasa_science/`, 외관은 `web/public/textures/`·`data/reference/appearance/`, 역사/은하/카이퍼대는 `data/reference/history/`·`data/reference/galaxies/`·`data/reference/kuiper/`의 manifest 지정 원본이 필요하다. 관측/참조 원본은 Git 제외이므로 저장소 clone만으로 모든 데이터가 준비되지는 않는다. 현재 로컬에는 확보했고 실행 시 SHA/바이트를 확인한다. 서버 전달용 완결 ZIP에는 필수6관측/보정과 채택한 확장 원본을 포함한다.

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python -X utf8 -m pip install -r requirements.lock.txt
npm --prefix web ci
npm --prefix web run build
.venv/Scripts/python -X utf8 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

http://127.0.0.1:8000/ 에서 드래그/휠/키보드로 우주를 탐색한다. 천체 클릭 또는 검색에서 `명왕성`/`ε Indi B` 선택→자동 포커스→`실제 관측 보기`→`관측 비교 열기`→품질/출처→판단 저장→JSON 내보내기→새 세션→JSON 가져오기를 실행한다. 관측 패널을 닫아도 우주/카메라를 유지하고 대상별 판단을 보관한다. CSV는 보조자료이며 JSON이 전체 복원 정본이다. 나머지 공식4대상은 확보된 자료목록과 품질/공간위치 미검증 상태를 제공한다.

정밀 시간 재생은2026년11월13~16일의72시간 범위로 정지 상태에서 시작한다. 실제1초당 모형1/6/24/72시간(기본6)을 선택하며, 끝에서는 멈추고 다시 재생하면 처음부터 시작한다. 수동 시각 변경·탭 숨김·저장은 정지시키고 가져오기/새 세션도 정지 상태로 연다. 연속 위치는 `display-hermite-v1` 보간이며, 아홉 궤도 안내선은11월14일00:00 UTC의 접촉궤도로 고정한다. 선택 추적 중 직접 카메라를 조작하면 추적을 해제한다. 재생 시각·속도·카메라/추적 상태는 근거에 보관한다.

설정에서 카이퍼대/은하 표시를 켜고 끈다(새 화면 기본on). 카이퍼대30–50AU의650점은 설명용 분포이며 실제 객체/밀도/두께가 아니다. M31/M33/M81/M87/LMC/SMC/M51/M104/Centaurus A의9개 은하는 원문 방향·근사거리로 배치하고 선택하면 자동 포커스한다. 경사진 나선원반·타원은하/제트·막대/불규칙구름·상호작용 동반은하·먼지띠를 공식 관측 특징에 맞춰 구분한다. M31경사77°·M81두팔·LMC막대/한팔은 출처를 연결하고 다른 경사/모든 위치각 미상값과 표시 가정을 분리한다. 입자·크기/회전·미확인 자세는 설명용이며 실제 별 위치나 과거 공간 복원이 아니다. 새 설정은 근거에 저장하고 필드가 없는 과거 context는 두 표시off로 호환 복원한다.

시간 모드를 `우주 역사`로 바꾸면 Big Bang 후0~13.8Gyr의 별도 개념적 장면을 연다. 근사 현재나이13.8과 lookback=13.8−나이를 구분하며, NASA/ESA10지점은 최근 표시 anchor이지 날카로운 시대경계가 아니다. 지점/slider/수치·Play/Pause와1/10/100/1000Myr/s(기본100)를 제공한다. 별/은하·plasma/CMB표현은 관측으로 복원한 과거 배치가 아니며 정밀태양계/실노출을 바꾸지 않는다. 모드 전환은 카메라를 보존하고 숨김 재생을 정지한다. 관측/근거는 원래 정밀 모드로 돌아가며 우주역사 자체의 근거 저장 기능과는 구분한다.

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

브라우저 검사는 실행 중인8000번 API와 production build를 사용한다. 실제 설정/증거는 `web/playwright.config.ts`와 `var/browser-results`·`var/qa`에 있다. QA 범위·실제 결과와 진행 중 검사는 [작업기록](docs/worklog.md)의 DEV-001~006을 참조한다. DEV-004 지도Chrome3/외계행성1경로, DEV-005 과학12+8/API19·중간전체Python176·프런트36단위/strict/Vite와 DEV-006 은하과학14검사를 확인했다. 새 은하 형태의 실제 브라우저 대조·최종전체회귀·v0.5ZIP는 후속확정한다. 원어민/내부사용자·Linux/Docker/공개서버 검사는 별도다.

## 실제 제공 API

`GET /api/v1/universe`, `GET /api/v1/timeline`, `GET /api/v1/objects`, `GET /api/v1/observations?object_id=epsilon-indi-b`(또는pluto), `POST /api/v1/comparison-jobs`, `GET /api/v1/jobs/{id}`, `POST /api/v1/jobs/{id}/cancel`, `GET /api/v1/comparisons/{id}/manifest`, `POST /api/v1/evidence`, `GET /api/v1/evidence/{id}/export?format=json`, `POST /api/v1/evidence/import`를 제공한다. `/timeline`은 한 번 읽을 작은 원본 매듭 묶음이며 매 재생 프레임의 요청이 아니다. `/universe?epoch=`는 지원72시간 범위의 시간대 명시 시각을 받는다. `/docs`와 [OpenAPI](contracts/openapi.json)에서 입력을 확인한다. `/health/live`는 응답, `/health/ready`는 실제 저장 쓰기/읽기와 worker heartbeat를 확인한다. 자유좌표/원격아카이브 검색·measurement/simulation endpoint는 아직 제공하지 않는다.

확장 읽기 API는 `GET /api/v1/appearance`, `GET /api/v1/catalog/solar-system`(목록; `?parent_id=saturn` 등은 해당 부모의 시간표본), `GET /api/v1/catalog/exoplanets`, `GET /api/v1/catalog/exoplanets/{object_id}`다. 실제 이미지 파일은 `/textures`에서 제공한다. 요청 중 외부 자료를 내려받지 않으며 카탈로그 탐색을 새 SPHEREx 관측/근거 저장 성공으로 표시하지 않는다.

DEV-005 읽기 API는 `GET /api/v1/cosmic-history`, `GET /api/v1/cosmic-history/sample?age_gyr=0.00038`, `GET /api/v1/catalog/galaxies`, `GET /api/v1/kuiper-belt`다. 역사 입력은 유한0~13.8Gyr이며 범위 밖/NaN/Infinity는422다. 모두 검증된 로컬 원문만 사용한다. 저장/import는 manifest뿐 아니라 해당 지도/벡터/은하 실제 원본의 무결성도 확인한다.

관측 작업대 이미지는 정합하지 않은 native cutout이며 표식은 예측이다. 깜빡임으로 이동/검출을 확정하지 않는다. 원본 IMAGE는 MJy/sr의 표면밝기로 ZODI 미차감이며 정량 flux/운동은 미검증이다. 실제 입력/출처·품질/상태·한계가 근거에 포함된다. 공개 표면지도와 카탈로그 설명용 외관은 이 실제 관측과 구분한다.

Git에는 작은 코드·계약·출처 목록을 보관하고, 대형 관측 파일과 내부 실명/공지 원문은 로컬 또는 별도 자료 저장소에 보관한다. 공개 산출물은 NASA 로고·이용 조건·만18세 미만 식별 정보 검사를 적용한다.

서버 전달용 v0.5.0 ZIP을 준비 중이며, 필수6원본/보정·JPL장면/관측자/궤도·표시보간 검산·확장태양계/NASA카탈로그·지도/외관·역사/은하/카이퍼대 원문·정적빌드·코드·lock·설정·라이선스·실행/복구 안내·release manifest를 포함해야 한다. 최종 경로·해시·실제 해제/실행 검사 전에는 완결 배포본으로 보고하지 않는다. 이전 v0.2.0의 완결 ZIP 검사는 [작업기록](docs/worklog.md)에 보존한다. Linux/공개서버 실행은 미검증이다. 완성 ZIP은 업로드→새 디렉터리에 해제→[실행/복구 안내](deploy/README.md)로 시작/재시작→health/두 시간모드·설정/은하선택·카탈로그·관측/저장복원 순서로 확인한다.
