# NASA-Space-Apps-Challenge

Planet X and SPHEREx — 실제 관측과 과학적 가설을 연결하는 우주 탐색 웹사이트.

2026 NASA Space Apps Seoul · 제작 11월 14일 09:00부터 · 최신 공식 마감 11월 15일 23:59 KST(권장 완료23:55).

기본 화면은 자유롭게 조작하는 우주 탐색이다. 실제 JPL 태양계 위치와9개궤도안내선을둘러보다 천체를 선택하면 자동으로 포커스하고, 같은 화면에서 ε Indi B/명왕성의 실제 SPHEREx 관측·품질·근거를 연다. 대상별 작업과 카메라/모형시각·궤도표시조건을 보존·새 세션 복원한다. 공개 서버·Planet X/외계행성 실험·정밀 운동/광도 측정은 아직 완료하지 않았다. 전체 최신 명세와 범위는 FSD에서 관리한다.

현재 `v0.3.0` 시간 재생을 구현·검사 중이다. 이전 완성 작업은 먼저 `54756ca`에 commit했다. 11월13일~16일의 72시간을 Play/Pause로 탐색하며, 중간 위치는 원본 JPL 일별 위치·속도의 표시 보간이다. 실제 관측 사진이나 촬영 시각을 바꾸지 않는다. 종합 검사와 새 배포 ZIP의 확정 결과는 작업기록에서 구분한다.

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

Python3.12와 Node22.17.0에서 검사했다. 먼저 [자료목록](data/manifests/datasets.json)의 S01/S02/S10(εB), S12/S14/L051(명왕성)을 동일한 `local_relative_path`에 배치한다. 원본/보정은 Git에 포함되지 않으며 릴리스ZIP에 필수6개를 포함한다. 작은 JPL장면/Pluto관측자 manifest도 필요하다. 현재 로컬에는 준비되어 있으며 실제 SHA를 실행할 때 검사한다.

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python -X utf8 -m pip install -r requirements.lock.txt
npm --prefix web ci
npm --prefix web run build
.venv/Scripts/python -X utf8 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

http://127.0.0.1:8000/ 에서 드래그/휠/키보드로 우주를 탐색한다. 천체 클릭 또는 검색에서 `명왕성`/`ε Indi B` 선택→자동 포커스→`실제 관측 보기`→`관측 비교 열기`→품질/출처→판단 저장→JSON 내보내기→새 세션→JSON 가져오기를 실행한다. 관측 패널을 닫아도 우주/카메라를 유지하고 대상별 판단을 보관한다. CSV는 보조자료이며 JSON이 전체 복원 정본이다. 나머지 공식4대상은 확보된 자료목록과 품질/공간위치 미검증 상태를 제공한다.

시간 재생은 정지 상태에서 시작한다. 실제 1초당 모형 1/6/24시간(기본6)을 선택하며, 끝에서는 멈추고 다시 재생하면 처음부터 시작한다. 수동 시각 변경·탭 숨김·저장은 정지시키고 가져오기/새 세션도 정지 상태로 연다. 연속 위치는 `display-hermite-v1` 보간이며, 아홉 궤도 안내선은 11월14일00:00 UTC의 접촉궤도로 고정한다. 선택 추적 중 직접 카메라를 조작하면 추적을 해제한다. 재생 시각·속도·카메라/추적 상태는 근거에 보관한다.

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

브라우저 검사는 실행 중인8000번 API와 production build를 사용한다. 실제 테스트 설정/증거는 `web/playwright.config.ts`와 `var/browser-results`에서 확인한다. QA 범위·실제 결과와 진행 중 검사는 [작업기록](docs/worklog.md)의 DEV-001~003을 참조한다. 원어민/내부사용자 검수, Linux/Docker/공개서버 검사는 별도다.

## 실제 제공 API

`GET /api/v1/universe`, `GET /api/v1/timeline`, `GET /api/v1/objects`, `GET /api/v1/observations?object_id=epsilon-indi-b`(또는pluto), `POST /api/v1/comparison-jobs`, `GET /api/v1/jobs/{id}`, `POST /api/v1/jobs/{id}/cancel`, `GET /api/v1/comparisons/{id}/manifest`, `POST /api/v1/evidence`, `GET /api/v1/evidence/{id}/export?format=json`, `POST /api/v1/evidence/import`를 제공한다. `/timeline`은 한 번 읽을 작은 원본 매듭 묶음이며 매 재생 프레임의 요청이 아니다. `/universe?epoch=`는 지원72시간 범위의 시간대 명시 시각을 받는다. `/docs`와 [OpenAPI](contracts/openapi.json)에서 입력을 확인한다. `/health/live`는 응답, `/health/ready`는 실제 저장 쓰기/읽기와 worker heartbeat를 확인한다. 자유좌표/원격아카이브 검색·measurement/simulation endpoint는 아직 제공하지 않는다.

이미지는 정합하지 않은 native cutout이며 표식은 고유운동 예측이다. 깜빡임으로 이동/검출을 확정하지 않는다. 원본 IMAGE는 MJy/sr의 표면밝기로 ZODI 미차감이며 정량 flux/운동은 미검증이다. 실제 입력/출처·품질/상태·한계가 근거에 포함된다.

Git에는 작은 코드·계약·출처 목록을 보관하고, 대형 관측 파일과 내부 실명/공지 원문은 로컬 또는 별도 자료 저장소에 보관한다. 공개 산출물은 NASA 로고·이용 조건·만18세 미만 식별 정보 검사를 적용한다.

서버 전달용 v0.3.0 ZIP을 준비 중이며, 필수6원본/보정·JPL장면/관측자/궤도자료·시간 보간 검산 manifest·정적빌드·코드·lock·설정·라이선스·실행/복구 안내·release manifest를 포함해야 한다. 최종 경로·해시·실제 해제/실행 검사 전에는 완결 배포본으로 보고하지 않는다. 이전 v0.2.0의 Windows/브라우저·ZIP 검사는 [작업기록](docs/worklog.md)에 보존한다. Linux/공개서버 실행은 미검증이다. 완성 ZIP은 업로드→새디렉터리에해제→[실행/복구 안내](deploy/README.md)로시작/재시작→health/시간재생·정지/우주선택/관측/저장복원순서로확인한다.
