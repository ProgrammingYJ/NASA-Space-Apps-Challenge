# NASA-Space-Apps-Challenge

Planet X and SPHEREx — 실제 관측과 과학적 가설을 연결하는 우주 탐색 웹사이트.

**Node.js 전용 서버의 시작 파일은 프로젝트 루트 [app.js](app.js)다.** Node.js 22.17.0 이상에서 완결 배포본을 풀고 루트에서 실행한다.

```sh
node app.js
```

또는 `npm start`를 사용한다. 서버 실행에 Python 설치·Python 프로세스·별도 Python API가 필요하지 않고 Node 외부 패키지도 없다. **v0.9.1부터 기본 접속은 `http://127.0.0.1:3002/`**, bind는 `0.0.0.0`이다. 포트는 `PORT`→`APP_PORT`→3002 순서로 선택하며 영속 상태는 `APP_STATE_DIR` 또는 기본 `var/node/`에 보관한다. 호스팅의 시작 파일 항목에는 **`app.js`**, 시작 명령 항목에는 **`node app.js`**를 지정한다. 기존 포트 환경변수가8000이면 제거하거나3002로 바꾼다. `.env` 파일은 자동으로 읽지 않으므로 환경변수는 호스팅 설정에서 지정한다. 전체 실행·필수 자료·MCSM 포트 매핑/프록시·복구는 [배포 안내](deploy/README.md)를 따른다.

현재 **DEV-015–016 / v0.11.0**은 클릭 전 출처 표면·자료층 기본값·과거 은하 유지·역사 혜성4개·자유 중력 실험과 실제 GWGC 은하53,162개·세 독립 PDE 실험·SXS 실제 h22 모드 재생을 구현하고 로컬 검증했다. 모든 물리법칙/임의 블랙홀의 새 GR 계산이나 개별 은하의 미관측 행성·표면을 구현했다는 뜻은 아니다. 검사 결과와 정확한 ZIP 검증은 작업 기록과 release JSON에서 구분한다. 기본 포트3002·같은 Wi-Fi 운영·기존 관측 근거를 유지하며 공개 nginx502/MCSM 설정 변경은 별도다.

보존된 **DEV-012 / v0.9.0**은 Node 전용 호스팅 전환본이다. Node14검사·Python 없는 PATH의 독립 HTTP/과학 대조67검사와 Node 서버 대상 기존 배포 smoke를 통과했다. 프런트 strict/Vite `DLJsfpSc`·Vitest71(1.62초)을 확인했고 전체Python550PASS(113.36초,기존Starlette경고1)도확인했다. Node8081의 Chrome23고유경로(22+1후속)를 확인했으며 정확v0.9 ZIP 실행·실제 Node 재시작 복원도 통과했다. 검증된 이전 v0.8 ZIP은 그대로 보존한다.

Node의 관측 비교는 실제 FITS에서 빌드 시 새로 계산한 두 쌍의 **출처 검증 결과 캐시**를 재사용한다. 요청 시 FITS를 새로 분석하는 기능과 구분해 화면에 안내한다. 원본/보정·캐시 해시가 없거나 맞지 않으면 오류/재계산 필요로 남기며 합성 사진이나 과거 참고 숫자로 채우지 않는다.

필수 묶음은 `data/node-runtime/`의 생성 JSON 107개/76348584B(실제 reader snapshot103개+새 FITS 비교4개), source 1885개/필수 1586개다. [정본 manifest](data/manifests/node_runtime.json)와 같은 바이트의 runtime manifest를 검사한다. 큰 원자료/파생 JSON은 Git clone만으로 준비되지 않으므로 완결 ZIP 또는 출처 검증 빌드 산출물이 필요하다. 이전 릴리스의 불변 ZIP은 보존한다.

2026 NASA Space Apps Seoul · 제작 11월 14일 09:00부터 · 최신 공식 마감 11월 15일 23:59 KST(권장 완료23:55).

기본 화면은 자유롭게 조작하는 우주 탐색이다. 실제 JPL 태양계 위치와9개 궤도 안내선을 둘러보다 천체를 선택하면 자동으로 포커스하고, 같은 화면에서 ε Indi B/명왕성의 실제 SPHEREx 관측·품질·근거를 연다. 대상별 작업과 카메라/모형시각·궤도표시조건을 보존·새 세션 복원한다. 공개 지도31개와 고리4개·확장 태양계476개·외계행성6470개를 연결했다. 공개 서버·Planet X/TESS 실험·정밀 운동/광도 측정은 미완료다. 전체 최신 명세와 범위는 FSD에서 관리한다.

보존된 **DEV-011 / v0.8.0은 구현·Windows ZIP 검증을 완료**했다. 행성 3요건 창에 반지름·밀도 가정으로 질량을 추정하는 실험을 추가한다. 대상의 실측/문헌 질량과 공식 분류는 유지하고, 비교 위성의 밀도를 옮겨 쓴 가정 결과를 별도로 보여준다. 관측자·블랙홀 App/API 연결과 자료 동결을 마쳤으며, 모든 물리법칙이나 실제 이동 관측을 완성했다는 뜻은 아니다. 당시 전체Python483검사·Vitest70·타입/빌드와 Chrome13회귀 및 마지막 간격교정 후속2검사를 통과했다. 완결v0.8 ZIP의 새폴더 해제·실제서버재시작 복원도 통과했다. [정확 검증 기록](docs/releases/v0.8.0.json)을 따른다.

이전 **v0.7.0 소스 체크포인트**는 `bb386f38b4a5e971041befc9fe18c5a5be626858`까지 GitHub에 보존했다. 실제 NASA 확인 목록6470행성/4862모항성 방향, 외계행성 공개 관측3사진, 실제 역사5영상, 소천체 문헌 외관, 통합시간/상시설정,17천체3요건·궤도 그림을 제공한다. 후보/집단추론은 확인 행성 목록에 넣지 않으며 개별 발견 논문 전수 검증을 주장하지 않는다. 지구의 화면 이름과 장기모형 EMB 기준도 분리한다. 소스 저장은 공개서비스 배포나 완결 ZIP 전달과 별개다.

v0.7에서는 전체Python372(76.33초)·Vitest64(1.20초)·strict/Vite Bp6N6jEm·Ruff57을 통과했다. 해당 빌드의16개 Chrome 영향경로와 의미문구 교정 뒤 lsFtNhUt의5언어1경로를 별도로 검사했다. 이전 단계21/9경로도 당시 빌드의 이력이며 새 v0.8 검증으로 재사용하지 않는다. v0.7 Data_Spec의23정본manifest/1846전수항목 snapshot도 새 자료군을 포함한 최종 v0.8 목록과 구분한다.

보존된 **v0.6.0 완결 ZIP**은 [검증 기록](docs/releases/v0.6.0.json)과 동명 외부검증JSON을 따른다. 이 불변 ZIP은 이후 소스 변경을 포함하지 않는다. [FSD](FSD.md)와 [작업기록](docs/worklog.md)에 새 구현·실행 범위를, [Data_Spec.md](Data_Spec.md)에 사용/확보/이전 자료·출처/SHA·가공/권리를 기록한다. 공개서버·F01잔여/Planet X/TESS·정밀 측정·사람/원어민 검수는 미완료다.

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

팀회의에서사용자가공유한공동결정에따라 **행성3요건·최소질량**을핵심으로추가하며기존관측/근거경로를보호한다. 태양계행성8개·공식왜소행성5개·후보4개,총17개를선택하면태양공전/거의둥근평형형태/궤도주변지배력의충족·미충족·자료부족을바로본다. **펼쳐보기**에서근거·계산·궤도그림을연다. 공식분류를따른형태요건은새정수압평형측정이아니고후보의크기/표시구체로충족을만들지않는다. 위성·태양·갈색왜성·외계행성에는IAU2006태양계정의를억지로적용하지않는다.

조건3에는 **최소 질량: X M⊕ (현재 질량: Y)**를표시한다. 최소질량은태양1M☉·청소시간10Gyr·C=2√3의Margot연구모형 `m_clear/M⊕ = 0.001239(a/au)^(9/8)`이며IAU공식수치규칙이아니다. Π는현재본체질량을이값으로나눈모형지표이고확률/청소율/새공식분류가아니다. Sedna는채택a≈543.7195au에서약1.48036M⊕의 **동일긴반지름 원형궤도 참고값**을주며,이심률이큰실제궤도의검증된청소질량이라고주장하지않는다. 잔해0·모두위성화·완벽한진공을뜻하지않는다.

채택자료에서본체질량을확보한대상은11개,확보하지못한대상은6개다. ‘채택자료에본체질량미확보’는전체문헌에서한번도측정되지않았다는뜻이아니다. Eris/Quaoar/Orcus/Gonggong의계전체질량은위성을포함한보조값으로구분하고본체질량/Π에자동대입하지않는다. Sedna의본체질량·Π와후보4개의형태/지배력미확정상태는null/자료부족으로유지한다. 긴반지름a는타원중심에서끝까지이며현재태양거리나원일점Q가아니다. 그림은태양을초점x=−ae에놓고a·근일점q·원일점Q를구분한다. 각출처의TDB요소시각은재생시각/현재위치와별도다.


채택자료의 본체질량이null인6대상은 선택창에서 **밀도 가정의 근사 질량**을 별도로본다. 기본은Tethys의명목bulk밀도984kg/m³이며사용자가적용한위성/직접입력ρ를축약창과확장실험이공유한다. 이값을대상의실측질량/밀도나공식3요건판정으로바꾸지않는다.

위성을선택하면장면의mesh/geometry·표면group크기를더키우지않고기존표시크기를유지한채카메라만가까이이동한다. 전체장면에서이미선언한반지름/위성간격확대는별도표시가정으로유지한다.

질량 가정 실험은3요건의 **펼쳐보기** 안에서 Makemake/Eris/Sedna/Quaoar/Orcus/Gonggong6개를 지원한다. source 반지름 R은 읽기전용이고, Tethys/Dione/Rhea/Iapetus/Ariel/Umbriel의 JPL bulk밀도 또는 직접입력ρ를 사용해 `M = ρ(4π/3)R³`를 계산한다. 밀도100–10000kg/m³는 입력 한도이며 물리적 가능 범위가 아니다. Enter/blur로 적용하고 잘못된 입력은 마지막 유효 결과를 유지한다. 구형 부피·반지름의 원 정의·조성/공극률/중력압축의 차이를 안내하며 유사 위성의 밀도를 대상의 실측으로 바꾸지 않는다.

원문 오차값을 입력 경계로 쓴 질량/Π 범위는 신뢰구간이 아니다. 명목 반지름에서 모형 임계에 필요한 밀도도 보여주되, 큰 요구값이 실제 가능한 천체라는 뜻은 아니다. 별도 필터는 **채택6위성 전체×6대상,36개source조건범위의 비교**이며 위의 직접입력 실험과 다르다. 이 범위에서 임계 충족 가능한 대상0개는 확률0%나 전우주 후보 부재가 아니다. Margot 원형태양10Gyr 참고값과 공식분류는 계속 분리하며, 명왕성의2006년 분류 변경도 IAU근거로 설명한다.

관측자 실험은 **오른쪽 위 설정→관측자 물리 실험**에서 열고 **카메라를 가상 관측자로 사용**을 켠다. 현재 카메라 위치에서 `18ln(1+r/au)` 거리압축을 역변환한 좌표 스냅샷을 쓰며, 마우스 이동으로 실제 속도·비행경로·여행시간을 측정하지 않는다. 원 관측z는 카메라 이동에도 유지하고 가상 FLRW거리·독립SR속도·정적중력 인자를 별도로 보여준다. NED은하9개와역사5사례의14행중채택수치는10개이고4개는미확보다. M31등의음의z를0으로바꾸지않으며미상거리/결합계에허블흐름을지어내지않는다.

**설정→블랙홀**에서는11개출처대상을선택한다. 채택질량9개만대상별Rs를계산하고미확보2개는물리규모를만들지않는다. SgrA*/M87*의실제EHT2사진은2017전파관측의처리재구성이며전체credit EHT Collaboration·CC-BY4.0/ESO공식페이지를표시한다. 사진을새관측자시점으로변형하지않는다. 별도좌표그림에서wheel은정적r/Rs스냅샷,drag는방위각을바꾸고유한정적관측자의local광선각으로2Dnull경로를역추적한다. Rs/광자구/임계impact는서로다른계산량이고물질표면이아니다. 회전/Kerr·강착방출/복사전달·내부/실제하늘픽셀밝기·빛원뿔/세계선은재구성하지않는다.

모형입력은β−.99~.99,유한정적반지름1.01~10^6Rs,기준방출파장.001~10^9nm로제한하고잘못된입력은마지막유효값을유지한다. FLRW는H0=67.66·Ωm=.3111·ΩΛ=.6889의고정matter+Λ참고값과z0~20/2049행표를쓴다. Tcmb0=0은방사성분을끄는계산스위치이고우주CMB가0K라는뜻이나fullPlanck18모형이아니다. 표시색은파장범례이며실제분광/가시광색이아니다. 관측/모형값과원사진은분리한다.

새 자료 채택에서는 사용자가 제외한 중국 아카이브/서비스 제공자를 구분한다. 논문 호스트·자료 제공자와 실제 관측 참여기관은 별도이며, 기여기관 미확인을 일괄적인 비중국 관측 보증으로 표시하지 않는다. arXiv/A&A등의 호스팅에서 저자 국적을 추정하지 않는다.

현재 서버 기본 구성은 `app.js`→`node/server.js`의 Node HTTP API/정적파일 제공과 해시/캐시 읽기용 worker thread 1개, 파일 기반 근거 저장이다. TypeScript/React/Vite/Three.js 작업대와 기존 API/스키마를 유지한다. Python3.12 FastAPI·Astropy 원본 reader는 선택적인 빌드/재검산 경로로 보존한다. Node 서버가 Python을 실행하거나 프록시하지 않는다. Aladin/Plotly·Planet X/TESS 실험은 별도 미완료다.

## 로컬 실행

서버는 Node22.17.0에서 검사했다. 빌드된 `web/dist`, `data/node-runtime`, `contracts/openapi.json`과 manifest에 지정된 필수 원본/보정을 갖춘 완결 배포본에서 `node app.js`로 시작한다. Git clone만으로 필수 자료가 준비되지는 않는다. 자료를 다시 만들거나 과학 수치를 대조할 개발 환경에서는 선택적으로 Python3.12를 사용한다. 먼저 [자료목록](data/manifests/datasets.json)의 S01/S02/S10(εB), S12/S14/L051(명왕성)을 동일한 `local_relative_path`에 배치한다. 작은 JPL장면/Pluto관측자 manifest도 필요하다. 확장 카탈로그는 `data/reference/solar-extension/`·`data/reference/catalog/nasa_science/`, 외관은 `web/public/textures/`·`data/reference/appearance/`, 역사/은하/카이퍼대는 `data/reference/history/`·`data/reference/galaxies/`·`data/reference/kuiper/`와`data/reference/cosmic-morphology/`·`data/reference/cosmic-observations/`의 manifest 지정 원본 및`web/public/observations/cosmic/`의5관측 이미지가 필요하다. 장기근사/계층/이름은 data/reference/long-term/·universe-catalog/·object-names/와 대응manifest도 보관한다. 관측/참조 원본은 Git 제외이므로 저장소 clone만으로 모든 데이터가 준비되지는 않는다. 현재 로컬에는 확보했고 실행 시 SHA/바이트를 확인한다. 서버 전달용 완결 ZIP에는 필수6관측/보정과 채택한 확장 원본을 포함한다.

```powershell
# 완결 배포본: Node만 실행
node app.js
```

프런트 소스를 수정한 개발 환경에서는 `npm --prefix web ci`와 `npm --prefix web run build`로 정적 빌드를 갱신한다. 캐시를 다시 생성하는 개발·빌드 작업에는 기존 검증된 Python 환경과 원자료를 사용한다.

```powershell
# 선택적 빌드/재검산 경로이며 Node 운영서버의 시작 명령이 아니다.
.venv/Scripts/python -X utf8 deploy/export_node_runtime.py
# 보존된 Python API를 별도로 검사할 경우
.venv/Scripts/python -X utf8 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

http://127.0.0.1:8000/ 에서 드래그/휠/키보드로 우주를 탐색한다. 천체 클릭 또는 검색에서 `명왕성`/`ε Indi B` 선택→자동 포커스→`실제 관측 보기`→`관측 비교 열기`→품질/출처→판단 저장→JSON 내보내기→새 세션→JSON 가져오기를 실행한다. 관측 패널을 닫아도 우주/카메라를 유지하고 대상별 판단을 보관한다. CSV는 보조자료이며 JSON이 전체 복원 정본이다. 나머지 공식4대상은 확보된 자료목록과 품질/공간위치 미검증 상태를 제공한다.

기본 시간 조작은 **하나의 날짜입력/시간선에서 자동 자료 선택**이다. `2026-11-13~16 UTC` 안에서는 확보한 JPL천체력의 `display-hermite-v1` 표시보간을 쓰고, 그 밖의 지원날짜는 JPL 적합요소 근사를 선택한다. 지원 범위는 천문학적연도−2999(기원전3000년)1월1일부터서기3000년1월1일까지다. 날짜를 `2500-01-01T12:00:00`·`0000-01-01`·`-2999-01-01`처럼 입력한 뒤 Enter 또는 다른곳을 눌러 적용한다. 0년은기원전1년이다. 활성자료와UTC/TDB달력 라벨을 시각 옆에서 확인할 수 있다. 출처별 달력라벨 선택이며 UTC↔TDB의 정밀 물리시간 변환이나 모든날짜의 정밀천체력이 아니다.

속도는 실제1초당 모형1/6/24/72시간과1/10/100Julian년을 지원한다. 기본6h/s·정지 시작이고 수동입력·탭숨김·저장은 정지시킨다. 잘못된날짜/지원범위밖 입력은 오류와 함께 마지막 유효장면을 유지한다. **시간 자료 상세**에서 자동·확보한72시간 천체력만·근사만·우주역사를 선택할 수 있다. 근사는Sun+8대표행성계만 표시하고 명왕성/위성의 위치를 만들지 않는다. 화면 이름은 지구이며 계산참조는 지구–달질량중심이라고 상세에 표시한다. 해당표식의 물리반지름은 숨기고 지구지도는 대표아이콘임을 안내한다. 명목오차는 보장상한이 아니며 수십억년 태양계진화 복원을 제공하지 않는다.

시간을 바꿔도 원 SPHEREx촬영시각/관측·판단은 바뀌지 않는다. 선택/카메라·재생속도·추적/표시설정을 근거에 보관하며 원72시간UTC의 `model_epoch`와 근사TDB달력의 `simulation_context`를 구분한다. 아홉 천체력궤도 안내선은11월14일00:00UTC 기준으로 고정되고 근사모형의 타원안내는 별도 표시가정이다. 직접카메라를 조작하면 추적을 해제한다.

설정은 **오른쪽 위 톱니바퀴→카이퍼 벨트**다. 모든보기에서 열 수 있는48px 아이콘과5언어접근성이름을 제공한다. 카이퍼대는30–50au 주영역의650점 설명층을 켜고 끄며 실제 모든 KBO의 위치/궤도·밀도/두께를 구현한 상태는 아니다. 장기근사에서는8대표계만 지원하므로 설명층을 숨기고 이유를 안내한다. 외계행성/천체계층/우주역사에서는 설정이 태양계장면에 적용됨을 안내하며, 저장된checkbox값은 천체력 보기로 돌아오면 적용된다. 이전검사빌드의 새세션버튼/별출처note 겹침은 직접화면검토에서 발견해 후속빌드에서 교정/재검사한다.

상단 **우주 천체 탐색**, 또는 은하를 고른 뒤 정보패널의 천체 탐색을 열면 출처로 확인한 성원과 종류별 목록을 본다. 공개하늘방향 지도에서 선택하면 자동확대하고 드래그/휠로 탐색한다. 방향지도는 깊이/표면의3D복원이 아니며 미측정 거리는 만들지 않는다. 외부9은하15대표성원과 우리은하 사례8개·태양계, 기존4862호스트/6470외계행성을 연결했다. 호스트→자식행성을 고르면 기존3D항성계 모식도에서 확대하고, 태양계/εIndiB는 원래장면/실관측으로 돌아간다. 목록은 전체우주 전수조사가 아니다.

위성468개·추가왜행성/후보8개는 언어별 표시명과 검색별칭을 쓴다. 국제지정명293개는 원문을 유지하고 부모/종류 문맥을 번역한다. 기관확인 표기와 프로젝트음역·관례를 Data_Spec에 구분했으며 원과학ID/영문명/벡터는 변경하지 않았다. 일본어·번체·프랑스어 전체사전의 원어민검수는 미확보다.

오른쪽 위 톱니바퀴 설정에서 카이퍼대/은하 표시를 켜고 끈다(새 화면 기본on). 카이퍼대30–50AU의650점은 설명용 분포이며 실제 객체/밀도/두께가 아니다. M31/M33/M81/M87/LMC/SMC/M51/M104/Centaurus A의9개 은하는 원문 방향·근사거리로 배치하고 선택하면 자동 포커스한다. 경사진 나선원반·타원은하/제트·막대/불규칙구름·상호작용 동반은하·먼지띠를 공식 관측 특징에 맞춰 구분한다. M31경사77°·M81두팔·LMC막대/한팔은 출처를 연결하고 다른 경사/모든 위치각 미상값과 표시 가정을 분리한다. 입자·크기/회전·미확인 자세는 설명용이며 실제 별 위치나 과거 공간 복원이 아니다. 새 설정은 근거에 저장하고 필드가 없는 과거 context는 두 표시off로 호환 복원한다.

상단 **빅뱅 · 우주 역사** 또는 시간 모드의 같은 항목을 열면 Cosmic Gems/Firefly Sparkle/CEERS/REBELS-25/ZS7의 실제 공개 처리영상5개를 본다. 대상의 빛이 출발한 우주 나이는 출처의 근사추정 .46/.6/.7/.74Gyr 또는CEERS표본.6–6Gyr범위를 보존한다. 영상 취득일과 구별하고 전경·배경 전체에 같은연대를 배정하지 않는다. 중력렌즈/색합성·가스속도map·크레딧/권리·원본링크를 제공한다. 사례선택/정수slider·3/5/8초 슬라이드쇼는 자료순서 표시이며 물리성장/중간시각사진을 생성하지 않는다. 숨김·import·수동선택/모드전환은정지하고 원래 태양계시각/카메라/실노출·판단은 유지한다. 가상3D 과거장면·임의 Gyr 입력·10anchor버튼은 현재화면에서 제외했다.

확장 태양계는 위성468개와 추가 왜행성/후보8개를 등록하고 실제 위치471개(위성463개)를 지원한다. 위치 미지원5개는 목록/사유만 제공한다. 추가 경로선은 실제72시간 예측 표본의 열린 선이며 완전 궤도나 실측 이동이 아니다. 공개 지도31개는 촬영시기·미관측 영역·향상색/레이더/대표 대기를 구분하고, 고리4개도 반지름·극방향 출처와 표시 가정을 알린다.

세드나 등8개 기존소천체(Ceres/Haumea/Makemake/Eris/Sedna/Quaoar/Orcus/Gonggong)의 문헌외관 제약을 추가한다. Ceres는 기존Dawn지도를보존하고 미분해천체의 임의크레이터를 제거한다. 관측의 정성색/밝기를 반영한 표시팔레트, Haumea의 모형조건부축비, Haumea/Quaoar의 고리중심거리안내를 제공하며 RGB·미측정형상/현재자세·고리1px색/두께는 가정으로 구분한다. 정성색은 보정된자연색이 아니고 열모형/occultation크기정의도 별도로 유지한다. 기존31지도/천체력/물리반지름을 바꾸지 않는다. 새12source자료동결/reader12검사는완료했고 후속빌드의 실제화면/저장복원검사는 완료후확정한다.

외계행성은 날짜 고정 NASA Science 공개6470개/4862모항성계를 검색하고 원 수치·추정/누락·출처를 연다. 거리/epoch가 검증되지 않은 자료는 방향구로 표시하며 설명용 표면/항성계 모식도를 실제 관측 지형·현재 행성 위치·존재확률로 쓰지 않는다. NASA Exoplanet Archive PS 기본해나 WASP-4 b 실제 TESS 실험과는 별도다.

Node 기본 영속 경로는 `var/node/jobs`, `var/node/comparisons`, `var/node/evidence`다. `APP_STATE_DIR`로 전용 영속 루트를 지정할 수 있다. 같은 상태 디렉터리에 여러 API를 실행하지 않는다. Node API만 상태를 쓰고 worker thread는 해시 검증/캐시 읽기 결과만 보고한다. 배타 잠금·임시파일/fsync/rename·재시작의 interrupted 처리를 적용하며 기존 상태를 초기화하지 않는다. Python API의 이전 `var` 상태도 보존하고 두 런타임을 같은 상태영역에서 동시에 쓰지 않는다. 개발용 Vite는 별도 터미널에서 `npm --prefix web run dev`로 실행한다.

복원은 현재 원본/보정SHA·알고리즘과 로컬 비교 정본도 확인한다. 서버를 옮길 때 근거JSON만 가져오면 비교 정본이 없어 재계산 필요 상태가 된다. 상태보관은 API/worker를 종료한 뒤 `var`와 사용 원본의 manifest를 함께 보관한다. 재시작/업그레이드 시 기존 `var`를 초기화하지 않는다. 오래된 미완료 작업은 interrupted로 남는다.

## 실행 검사

```powershell
# Node 전용 런타임·실제 번들 검사
npm test
# Python 참조/빌드 경로를 함께 검수할 개발 환경
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


DEV-008 읽기 API는 GET /api/v1/long-term-model(로컬공식계수/범위·출처), GET /api/v1/long-term-simulation?year=2500&month=1&day=1(8대표위치), GET /api/v1/catalog/universe(기본24), ?galaxy_id=galaxy-milky-way(4871총항목), ?parent_id=호스트ID(자식행성)다. 입력달력/범위·미지원선택은422, 확인할 원문/모형이 없으면503이며 실제세부는 OpenAPI/FSD를 따른다. 정적경로는 /textures/*와 /observations/cosmic/*·/observations/exoplanets/*이며 API접두사를 붙이지 않는다.


DEV-009의 확인 행성 보기는 상단 **우주 천체 탐색→확인 행성**에서 연다. 우리은하의 기존6470행성을 검색·선택하면 항성계3D로 즉시 이동한다. 외부은하에서 채택 자료에 확인 행성이 없으면 빈 상태와 문헌 검토를 보여주며 후보를 확정 행성으로 채우지 않는다. 선택한 실제 행성의 상세정보에는 공개 관측사진이 채택된 경우 미리보기/확대·credit·CC-BY4.0·처리 한계를 제공한다. 다른 대상의 ‘채택한 영상 없음’은 행성의 부재나 관측된 적이 없다는 뜻이 아니다.

새 읽기 API는 `GET /api/v1/catalog/extragalactic-planets?galaxy_id=galaxy-m31`과 `GET /api/v1/catalog/exoplanet-observations?object_id=exo-27e52bc5e4a85faba3a2`다. 별도 문헌 검토의 후보/집단추론과 실제 확인객체를 분리하고, 사진은 기존6470목록ID로만 연결한다. 실제 JPEG는 `/observations/exoplanets/`에서 제공한다. 새2개 manifest 및 `data/reference/extragalactic-planets/facts/`·`data/reference/exoplanet-observations/facts/`, `web/public/observations/exoplanets/`가 런타임에 필요하다. facts는 프로젝트가 작성한 사실추출이고 `upstream/` 전체원문은 로컬 감사용으로만 보존해 서버ZIP에 넣지 않는다. API/브라우저 최종검사 결과는 DEV-009 기록에서 확정한다.

추가소천체읽기 API는 `GET /api/v1/small-body-appearance`이며 `small_body_appearance.json`과 `data/reference/small-body-appearance/facts/`를검증한다. 해당군의전체 `upstream/` 원문은로컬감사전용/ZIP제외다. 기존외관과독립조회하고실제지도우선으로병합하며정상무지도와503/재시도를구별한다. 근거의 optional `small_body_appearance_manifest_sha256`가변경되거나필수입력무결성이실패하면재계산필요이고 optional `time_preference`로자동/수동시간UI를복원한다. 이전근거는호환하며새계약의최종영향검사는후속확정한다.

행성요건읽기 API는 `GET /api/v1/planet-criteria`(17개dictionary)와 `?object_id=sedna`필터다. 미지원대상422·자료/무결성503을구분한다. `planet_criteria.json`과 `data/reference/planet-criteria/facts/`가런타임필수이고전체 `upstream/` 원문은로컬감사전용/ZIP제외다. 정본manifest는168,453B/SHA `e6124a457dcbba0907d9f4d0f8fbd777b7cac1963b4b2e49cb5fb6322e8753d8`이며기존JPL요소/물리원문과새SBDB8개를원출처/단위/시각별보존한다. 근거의optional `planet_criteria_manifest_sha256`가변경되거나reader검증에실패하면재계산필요이고필드없는이전근거는호환한다. 이판정창이원SPHEREx DATE-AVG·관측/판단을변경하지않는다.


v0.8 질량 API는 `GET /api/v1/mass-scenarios`와 `POST /api/v1/mass-scenarios/calculate`다. POST는6대상target_id·100~10000kg/m³의유한밀도·6analogue_id/null·include_source_ranges를 검증하고 가정 질량/조건범위·Π·필요ρ·sourceSHA를 반환한다. analogue와밀도 불일치/입력오류는422,source무결성/누락은503이다. `mass_scenarios.json`130,355B/SHA `7668d7caf418aaae363acf41fa50e9a69795ff1e3c99a178534a83552fc82112`, `data/reference/mass-scenarios/facts/`가런타임필수이며전체upstream은로컬감사/ZIP제외다. 기존기준/소천체manifest에의존하고독립Decimal36사례검산을통과했다. optional `mass_scenarios_manifest_sha256`와`mass_scenario`는마지막전역가정을저장하며원실제εB/Pluto관측·판단과독립이다. source가바뀌면재계산필요이고기존근거는호환한다. 관측자/BH읽기와저장계약은아래를따른다.


물리읽기 API는 `GET /api/v1/black-holes`와 `GET /api/v1/observer-physics`이며자료실패/무결성오류는503이다. 동결 `black_holes.json`106,361B/SHA `4818701162f76fe3bc97383c1b0d2cd8d750b95466d15c95f046b229126cbbbd`, `observer_physics.json`271,921B/SHA `61ca1cf4d24dfe337adb905070328d525ac982d4857db335906a7dbac1bea105`와 `data/reference/relativity/facts/`가필수다. 고유53facts/sidecar는런타임,새37upstream원문/sidecar는로컬감사전용/ZIP제외이며기존16원문은재참조한다. EHT2JPEG103,617B/sidecar1,363B는public/dist의 `/observations/black-holes/`에포함한다. optional `observer_experiment`·2source해시·선택BH를검증복원하고import는품질화면을먼저열며실험창은닫고파라미터를보존한다. 원실제관측시각/결과·판단은불변이다.

v0.8 현재검사: 질량순수39/API8·relativity36/관측자API27, 독립Decimal36·Vitest70(최신1.76초)·전체Python483(76.49초,기존Starlette경고1)/Ruff63을통과했다. 중간TyRAtsbd 질량5검사와DbNwNokf 관측자5PASS/1QA타이밍교정·직접시각겹침교정뒤 CNYGnNg7에서 관측자6+질량5+기존관측2의13/13 Chrome을142.460초에통과했다. 정본은 `var/qa/dev011-final-browser-results.json`이다. 새브라우저문맥에서 관측자 R=7.5Rs·β=.001·λ=600nm·M87/두물리SHA·카메라 및 실제S01/S02·29픽셀품질 복원을확인했다. 이후닫기/블랙홀버튼간격을교정한최종 `index-BfRDPmgL.js`/`index-DZOoVrJ5.css`의strict/Vite와전역/언어후속2/2 Chrome(9.647초), bounding 비겹침/직접사진검토를통과했다(`var/qa/dev011-observer-review.json`). 13회귀와마지막간격교정2검사는서로다른빌드의검사다. 정확v0.8 ZIP 해제·실제서버재시작은 통과했고 Linux/공개서버·사람/원어민검수는 미실행이다.

최종Data_Spec은1,791,636B/3061줄/SHA `e848ee7025f315a6cfa127f67b3120a2c7ef2f5bee2d3515e26bbd7a1c3aba33`다. 26정본manifest/2041전수항목(data1987+public53+helper1),정본참조1079/sidecar포함1084·내장원응답32·정적복제53을추적하고독립전체SHA/바이트·원102파일보존검사에불일치0을확인했다. 파일전수검사를모든물리모형의정확도/독립발견·사람검수/배포완료로확대하지않는다.

과거 DEV-005의 호환 읽기 API는 `GET /api/v1/cosmic-history`, `GET /api/v1/cosmic-history/sample?age_gyr=0.00038`, `GET /api/v1/catalog/galaxies`, `GET /api/v1/kuiper-belt`다. 이 호환연대 API의 입력은 유한0~13.8Gyr이며 범위 밖/NaN/Infinity는422다. 현재 과거 UI는 GET `/api/v1/cosmic-observations`만 사용한다. 실제5이미지는 `/observations/cosmic/`에서 제공하고 임의연대 사진을 생성하지 않는다. 모두 검증된 로컬 원문만 사용한다. 저장/import는 manifest뿐 아니라 해당 지도/벡터/은하 실제 원본의 무결성도 확인한다.

관측 작업대 이미지는 정합하지 않은 native cutout이며 표식은 예측이다. 깜빡임으로 이동/검출을 확정하지 않는다. 원본 IMAGE는 MJy/sr의 표면밝기로 ZODI 미차감이며 정량 flux/운동은 미검증이다. 실제 입력/출처·품질/상태·한계가 근거에 포함된다. 공개 표면지도와 카탈로그 설명용 외관은 이 실제 관측과 구분한다.

Git에는 작은 코드·계약·출처 목록을 보관하고, 대형 관측 파일과 내부 실명/공지 원문은 로컬 또는 별도 자료 저장소에 보관한다. 공개 산출물은 NASA 로고·이용 조건·만18세 미만 식별 정보 검사를 적용한다.

보존된 v0.6.0 서버 전달본은 `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_182253KST.zip`이다. 481,789,033B/1807파일이며 source commit `bf1a09f5ebafc5fdd74abe82231e522b3eec9b95`, SHA256 `af2759fc30eb844dc5ba440f76580beb7b4ca2e92444c39235bfafc38bda0d28`이다. 18:25:16 KST에 정확한 최종 ZIP을 새폴더에 해제해 파일/health·대표API와 실제 서버재시작 뒤 εB/Pluto 근거복원을 통과했다. 필수6원본/보정·공개지도/5역사관측영상·기존카탈로그/장기계수·계층/이름·정적빌드·코드/lock·라이선스/실행복구안내를 포함한다. 최종 결과는 [검증 기록](docs/releases/v0.6.0.json)과 ZIP밖 동명 checksum/verification JSON을 따른다. 이 불변 ZIP은 이후 DEV-009/010/011 변경을 포함하지 않으며 v0.8.0 전달본은 아래 별도 확정 기록을 따른다. Linux/공개서버는 미검증이다. 업로드→새디렉터리해제→[실행/복구 안내](deploy/README.md)로 시작→health·시간/역사·카탈로그·저장복원을 확인한다. 이전 완결ZIP은 보존한다.

## 보존 이력: DEV-008 urgent travel checkpoint - 2026-11-14T15:54:38+09:00

다음은 이동 당시 기록이다. 현재 상태와 최신검사는 위 요약 및 작업기록을 따른다.

User explicitly requested wrap-up within one minute before shutting down. Stop new browser/release work and preserve current source/data/Git.
Implemented v0.6.0: 476 object names in five locales with original designations/IDs retained; separate JPL fitted Kepler simulation -2999-01-01 through 3000-01-01 TDB calendar labels (8 systems + Sun; Earth icon means EMB; unsupported objects omitted); source-backed galaxy-member hierarchy and angular zoom with existing exoplanet-system links; visible header Big Bang/history entry. History remains five published actual observation products and approximate source ages, with no synthetic 35-galaxy growth scene.

Verified: strict TypeScript/Vite index-DSKEjKdg.js; Vitest54 passed; Ruff check/48-file format. Whole pytest:275 passed,1 failed in60.64s. Failure was a test setup calling calendar_jd(-3000), which correctly rejects unsupported input; changed setup to one day before the supported minimum JD. Rerun after that test-only correction is PENDING. New long-term28/catalog19/names4 targeted tests passed previously. DEV007 observed-only Chrome6 passed on its prior build. DEV008 new six browser scenarios were WRITTEN/DISCOVERED, NOT EXECUTED. Do not claim current whole browser verification.

Resume: read AGENTS,SKILLS,FSD,START_HERE,Data_Spec and this checkpoint; preserve raw/data/var/Git. Run whole pytest and new simulation-names/universe-catalog browser scenarios, then existing cosmic/observations. Build complete v0.6 ZIP and verify fresh extraction,health,epsilon/Pluto evidence and real server restart. No public/Linux deployment or F01 remaining/F04/F05/native-language/human QA claimed.


최종 v0.6.0 ZIP 검증 확정: 481,789,033B/1807파일, source bf1a09f. 18:25:16KST에 정확한 최종 ZIP의 새폴더 해제·health·카탈로그/장기모형·실제서버 재시작 후 εB/Pluto 근거복원을 통과했다. [검증 기록](docs/releases/v0.6.0.json)은 검증 후 추가한 문서이며 불변 ZIP에는 들어 있지 않다. 공개서버/Linux 배포는 수행하지 않았다.


### DEV-011 최종 완결 ZIP 확정 · 2026-11-14 20:24:20 KST

`NASA_SPACE_APPS_CHALLENGE_v0.8.0_20261114_202331KST.zip`는 **484956608B/2095파일**, SHA256 **`1bb76a9158cf6d36c0c632b4d32cf0b7edd380a07e1f3031b8a6bdcbaa3253e3`**이다. source `45375fc52300c41211063160b1cf9f2dee45ef67`의 clean tree와 최종 BfRDPmgL/DZOoVrJ5 빌드로 생성했다. 추적 manifest/source sidecar 32개의 Git index와 동결 working bytes가 모두 일치함을 확인하고 origin/main의 정확 SHA도 대조했다.

정확한 최종 ZIP을 새 폴더 `tmp/release-verify-y39fvc3n/extracted`에 풀어2094개 manifest 항목의 경로/대소문자/바이트/SHA와 금지 파일 제외를 확인했다. Windows에서 health·대표/신규 API·실제 지도/사진 원바이트·질량 가정·11BH/2EHT/2049표를 확인하고 실제 API/worker 재시작 뒤 같은 εB/Pluto result/evidence ID·세션/판단·새 가정을 복원했다. 검사시각 `2026-11-14T11:24:20.927409+00:00`, 재사용한 독립 runtime이며 새 의존성 설치·Linux·공개 서비스 검증은 아니다. 상세 정본은 [v0.8.0 검증 기록](./docs/releases/v0.8.0.json)과 ZIP 밖 동명 checksum/verification JSON이다. 이 사후 문서와 커밋은 이미 검증한 불변 ZIP에 추가하지 않는다. 이전 v0.6 ZIP/기존 원본/Git 이력도 보존한다.


최종 DEV-012 [Data_Spec.md](Data_Spec.md)는 **2,026,860B/3422줄**, SHA256 `e441b64d2d22dfda73342cb5465825b9e74fc7ca8a21ca44b0565337cfe796c5`다. 정본27개·물리2146항목(data2092+public53+명시helper1),총1,279,102,066B이며부록A102+B2044·정본참조1932/sidecar포함1937·내장응답32·정적복제53을기록한다. 독립전체SHA/바이트/경로·참조/중복/복제검사불일치0,최초102파일987,987,584B보존불일치0이다. Node source1859중필수1564개531,456,149B와선택295개를구분하며로컬감사전용 `/upstream/` 사본필수0·보류96개선택을유지한다. 기존reader에필요한NASA/JPL전체원응답은각source의필수표시를따른다. 파일수/순서별파생수는독립관측수·물리정확도/사람검수·실제배포성공수가아니다.

DEV-012 전체Python 첫 실행은483PASS/67공유fixture setup ERROR(약172초)였다. Node cold-source 준비 확인의2초 health probe가TimeoutError를냈는데검사fixture가URLError만처리해독립67경로가시작되지않았다. 제품수치/모형실패와구분하고fixture의TimeoutError처리를추가한뒤전체550PASS113.36초(기존Starlette경고1)로확인했다. 별도로완료한Python없는PATH의독립67PASS19.13초·Node14PASS와이번전체실행의범위를구분한다.


DEV-012 검증 최적화: 초기 Node UI 부분검사는 완료19개 중15 PASS/4 응답·전체시간 한도 실패였고20번째 중단/3미실행으로 보존했다. 수치·분류·원질량·geometry의 실패 증거는 없었으나, job/result/save/import가 약700MB의 필수/파생/서빙 복제 원바이트를 반복해서 읽어 지연됐다. `sha256-stat-fingerprint-v1`은 최초 전체SHA 검증 후 매transaction 모든 필수 실경로와 dev/ino/size/mtimeNs/ctimeNs를 검사한다. 같은 식별/메타이면 이미 검증한digest를 재사용하고 변경되면 사용 전 원바이트 SHA를 다시 계산한다. 동시에 이미 대기하는 요청만 검증pass를 공유하며 시간TTL은 없다. 원 비교raw SHA는 매읽기 확인하고 시작/CLI/정확ZIP의 full audit는 유지한다. 입력은 읽기전용·불변 운영 계약이며 관리자가 파일식별과모든시각까지 위조하는 상황의 보증으로 확대하지 않는다. `node app.js --verify-sources`는 서버 시작 대신 필수자료 전체SHA 감사를 실행한다.

Node14 회귀는 같은크기+mtime복원변조/누락/강재fullaudit/동시5요청1검증을 포함해9.701초에통과했다. root 재검 Node14 PASS9.515초·Python 없는 PATH 실제 HTTP/과학67 PASS14.12초를 확인했고 source key의 prototype 상속을 실제 천체로 허용하지 않도록 Object.hasOwn 검사를 보강한 뒤 HTTP6후속 PASS10.265초를 확인했다. 실제 warm Windows/이미 SHA확인된 Node8081에서12GET동시480ms·job185ms·manifest173ms·save332ms·import490ms,합계1.836초를 관찰했다(`var/qa/dev012-node-performance.json`). 초기/다른호스트 성능 보장이 아니다. 수치/결과ID·동결103JSON/원본해시는 변경하지 않았고 최종 Chrome/ZIP 검증은 별도로 확정한다.


DEV-012 최종 브라우저 확정: Node8081/최종 client `index-DLJsfpSc.js`·runtime manifest9dfe…에서23고유경로를 확인했다. 23개 batch는22 PASS/1복합workflow 전체60초 timeout(374.878초)이었고 개별15초 기대값 실패는0이다. 5언어/깜빡임/PNG·JSON·CSV/새문맥복원/공식4대상왕복을한case로묶은검사만전체120초로명시해별도후속1 PASS68.454초(2026-11-14T12:35:11.024Z시작)를확인했다. 과학기대값·단계별15초·제품/Node/source를변경하지않았다. 23개가같은batch모두통과했다고주장하지않고22+1후속으로기록한다. 초기최적화전부분실행15PASS/4지연실패와도구분한다. 정본은 var/qa/dev012-node-final-browser-results.json,dev012-node-observation-followup.json과review보고서다.

Moon의표시R0.20874/물리R1737.4km·group/mesh scale1은선택전후유지됐고camera eye-target은3.089216→0.923769표시단위로접근했다. Phobos의표시R0.036108/물리R11.08km도유지됐고camera거리는0.159789였다. bounding sphere≤1.5e-9차이는12→64 subdivision Float32정점반올림이며확대scale가아니다. 실측첨부 var/qa/dev012-moon-geometry-evidence.json에원수치를보존했다. 질량approx/원mass null/IAU분류·늦은결과·실제촬영시각/품질·관측자/근거/복원·Node사전계산5언어고지도검사했다. 정확v0.9 ZIP의실제Node실행/재시작검증은최종사후기록으로확정한다.


### DEV-012 최종 완결 ZIP 검증 확정 · 2026-11-14 21:40:02 KST

`NASA_SPACE_APPS_CHALLENGE_v0.9.0_20261114_213804KST.zip`는 **495916482B/2223파일**, SHA256 **`fd3c694f354bac02ba9728dae521b13d7b41250870bc3b050ee8629d6b467db7`**이다. source `7b2dbf7c4e5ee6798fd9c56230a7858ae8dde3e4`의 clean tree, 최종 DLJsfpSc 프런트와 Node 전용 `app.js`/검증된103JSON으로 생성했다. 추적 manifest/source sidecar33개의 Git index와 실제 동결바이트도 전부 일치했다.

정확한 ZIP을 새 `tmp/node-release-verify-r4s83m6d/extracted`에 풀어2222개 release manifest 항목의경로/바이트/SHA와필수원본·캐시를확인했다. Node22.17 절대경로와 `app.js`만서버로실행했고 PATH에서Python실행파일을찾을수없게했다. 개발검증기/HTTP클라이언트의Python과서버의Node를구분한다. 실제두관측·29/32품질·지도/사진·카탈로그·새가정을확인하고실제Node프로세스와worker thread를종료/재시작한뒤 εB/Pluto및추가근거의같은ID·판단·카메라·밀도/관측자설정·export원바이트/import복원을통과했다. 정확완료시각 `2026-11-14T12:40:02.175944+00:00`이다. 상세는 `docs/releases/v0.9.0.json`과ZIP밖동명verification/checksum JSON을따른다. 이사후문서는검증한불변ZIP에추가하지않는다. 기존v0.8 ZIP/원본/Git이력도보존했다. Linux/Docker·공개서비스·사람/원어민검수는수행하지않았다.
