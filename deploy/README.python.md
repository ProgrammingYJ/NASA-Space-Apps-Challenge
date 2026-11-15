# 선택적 Python 재검산과 이전 운영 기록

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](../docs/releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다. Git 구현 a55a0e0·철회 d3be874의 main push를 확인했다.

**현재 v0.17.3/OPS-021 운영은 [Node 실행·복구](README.md)다.** 새 EC2 `54.117.136.144`(ap-northeast-2·m7i.xlarge·Ubuntu24.04.5)는 Node24.22.3·loopback3002/nginx HTTPS로 운영한다. 사용자 보조 PDF 철회에 따른 재활성화이며 PDF 통합은 실행하지 않았다. Python API는 개발·독립 재검산을 위한 선택 경로이며 서버 시작의 필수 의존성이 아니다. 새 릴리스는 ZIP 없이 검증된 완결 디렉터리로 전달한다.

현재 검증 상태는 [철회·복귀 정본](../docs/releases/notice-withdrawal-20261115.json)을 따른다. source 검증614개·runtime source1365/필수1270이며 기존114생성JSON/74비교 원핀은 동일하다. v0.17.4의 source1366/필수1271은 보조 PDF가 있던 철회된 과거 검증이다. [v0.17.0](../docs/releases/v0.17.0.json)과 [OPS-021](../docs/qa/ops021_migration_verification.json)의 공개 PC Chrome10/10·실제 운영 재시작7024→7175·근거 원봉투 검증도 당시 Node 기능 검증 스냅샷이다. 아래 v0.8.0 Python/Docker 설명을 현재 공개 서버에서 실행·검증한 것으로 바꾸지 않는다.

## 현재 개발용 선택 경로

Python3.12와 필요한 채택 원자료가 있는 별도 개발 환경에서 저장소 루트를 기준으로 실행한다. 운영 Node shared와 Python 상태를 공유하지 않는다.

```sh
python3.12 -m venv .venv-dev
.venv-dev/bin/python -m pip install -r requirements.runtime.lock.txt
APP_STATE_DIR="$PWD/var/python-review" .venv-dev/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

위 예시는 POSIX 개발 환경용이다. Windows에서는 가상환경의 `Scripts/python.exe`와 PowerShell 환경변수 문법을 사용한다. API 작성자는 하나만 실행하며 `--reload`/여러 worker를 운영 구성으로 사용하지 않는다. 테스트 의존성이 필요할 때만 `requirements.lock.txt`를 사용한다. 이 명령 예시를 제공한 사실 자체가 모든 Python 경로의 현재 검증 완료를 뜻하지 않는다.

기존 Node 산출물의 원핀을 읽기 전용으로 검사할 때는 가상환경 Python으로 `deploy/export_node_runtime.py --verify-only`를 실행할 수 있다. 재생성은 별도 검토·실제 과학 계산과 출처 대조를 거치는 빌드 작업이며, 이미 배포된114JSON/74비교 또는 기존 네 비교 정본을 임의 덮어쓰지 않는다. DEV-027은 이전114파일/74비교 원핀을 유지했고 새 원관측을 추가하지 않았다. 원자료·시간계·품질·출처 범위는 [Data_Spec.md](../Data_Spec.md)와 [FSD](../FSD.md)를 따른다.

현재 `deploy/compose.yaml`의 build 대상은 **Node용 `deploy/Dockerfile`**이다. Python용 파일은 `deploy/Dockerfile.python`이며, 아래 구판 compose 명령이 Python 컨테이너를 실행한다고 해석하지 않는다. Python 이미지/compose 전체 실행은 해당 검증 기록이 없으면 미검증이다.

## 역사: v0.8.0 Python 운영 본문

아래 내용은 당시의 기능·파일 수·전달·검사 계획을 원문으로 보존한 것이다. 은하·외계행성·역사·블랙홀/물리실험과 당시 필수자료/ZIP 규칙은 현재 활성 범위가 아니다. 현재 범위는 태양계1000AU·실관측·P9/실제 궤도 유사도 TOP5·근거 복원이며, 문헌의 조건부 하늘 영역 순위와 실제 천체 유사도 순위를 구분한다. 삭제된 Sydney에서 로컬 사본이 없는 후속 상태까지 복구됐다고 주장하지 않는다.

### v0.8.0 실행·복구

팀 회의의 핵심 기능인 행성3요건 판정은 GET /api/v1/planet-criteria로17개 천체(행성8/공식왜소행성5/후보4)를 제공한다. 선택 정보창의3요건과 확장 대화상자, ‘최소 질량: X M⊕ (현재 질량: Y)’를 확인한다. IAU공식 분류와 태양1M☉·10Gyr·C=2√3 조건의 Margot 원형궤도 청소 참고모형을 구분한다. Sedna의 본체 질량/평형·지배력 미확정과 높은 이심률 한계를 숨기지 않으며, 위성포함 계 질량을 본체 단독값으로 쓰지 않는다. a는 현재 태양 거리가 아닌 source epoch의 긴반지름이다. data/manifests/planet_criteria.json과 data/reference/planet-criteria/facts/·sidecar19쌍이 필수이며 upstream 전체문헌은 로컬 감사용·배포 제외다. 같은 원 물리 HTML을 재사용한 값과 새SBDB8을 구별하고 새로운 독립 관측으로 세지 않는다. optional planet_criteria_manifest_sha256 저장/복원과 해시 변경 시 재계산 필요를 확인한다.

추가 소천체 외관: /api/v1/small-body-appearance의8개ID(Ceres/Haumea/Makemake/Eris/Sedna/Quaoar/Orcus/Gonggong)와12출처 사실추출을 포함한다. data/manifests/small_body_appearance.json 및 data/reference/small-body-appearance/facts/와 sidecar가 필수다. upstream/의 전체 원문은 로컬 감사용으로 배포 제외한다. 기존31지도는 보존하고 Ceres 지도에 우선권을 둔다. 다른7천체는 정성 색/문헌 형상 제약을 사용하며 실제 표면 지도를 생성하지 않는다. 미지도 고체천체에는 임의 크레이터를 만들지 않는다. 고리3개(Haumea1/Quaoar2)는 문헌 중심 반지름과 정적 J2000 기준극의1px선이며 폭/광학두께/세차/현재자세를 복원한 것이 아니다. Haumea의 짧은 형상축과 고리극은 문헌의 공면 모형 아래 정렬하며 자전 위상은 미검증이다. 새 근거의 optional small_body_appearance_manifest_sha256와 time_preference를 함께 복원하고 해시 불일치는 재계산 필요로 처리한다.

DEV-009 / v0.7.0은 기존 우주 탐색·실제 ε Indi B/명왕성 관측·근거 저장/복원을 보존하며 실제 확인목록의 행성 직접선택, 실제 모항성 방향표식, 공개 외계행성 관측사진3개, 지구 표시명/EMB기준 분리, 하나의 시간 조작과 상시 설정 진입을 통합한다. 빅뱅은 실제5관측영상과 출처의 추정연대/범위만 표시한다. 가상 외부은하 행성계와 가상 초기은하 성장장면을 활성제품에 추가하지 않는다.

v0.8.0은 위 경험과 행성 분류의 밀도 가정, 실제 블랙홀 자료, 제한된 관측자 이동 실험을 함께 담는다. 정확한 파일명·source commit·ZIP바이트/SHA256·실행시각/결과는 최종 아카이브 옆 동명 `.zip.sha256.json`·`.verification.json`과 `docs/worklog.md`로 확정한다. 이전 v0.6.0의 검증을 새아카이브 통과로 재사용하지 않는다. 공개서버 업로드/기존서비스 변경·Linux컨테이너 실행을 수행한 것으로 주장하지 않는다. 적용환경의 실제 CPU/RAM/포트/volume/proxy/HTTPS 할당을 확인한다.

## 업로드·시작

1. 완결 ZIP 전체를 서버의 **새 릴리스 디렉터리**에 풀고 `release_manifest.json`의 파일목록/SHA·바이트와 아래 필수자료를 확인한다. 기존 영속상태 `var`를 압축해제로 덮어쓰지 않는다.
2. Python3.12 환경에서 `python -m pip install -r requirements.runtime.lock.txt`를 실행한다. 개발검사까지 실행할 때만 `requirements.lock.txt`를 사용한다. 프런트 정적빌드는 `web/dist`에 포함되므로 직접실행에는 Node가 필수가 아니다.
3. 프로젝트 루트에서 `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 1`을 실행한다. **하나의 API 작성자**가 별도 과학worker를 생성/종료한다. 동일상태영역에 여러API를 실행하거나 `--reload`로 운영하지 않는다.
4. 영속상태 루트는 `APP_STATE_DIR`(기본 `var`)다. 기존 상태는 API/worker 종료 후 전체를 별도보관한 뒤 재사용한다. 프록시/방화벽/할당포트는 실제운영설정에 맞추며 `.env`·키·토큰은 공개ZIP에 넣지 않는다. 안전한 설정키는 `.env.example`을 따른다.
5. `/health/live`·`/health/ready`를 확인하고 아래 대표경로를 실행한다. ready는 실제저장 읽기/쓰기와worker heartbeat 준비를 확인하며 도메인 연결이나 live응답만으로 저장/복원완료를 판정하지 않는다.

Docker가 실제 동작하는 환경에서는 루트에서 `docker compose -f deploy/compose.yaml up --build -d`를 사용할 수 있다. compose는 포함된 `data`를 읽기전용, `var`를 쓰기가능 volume으로 연결하고 기본호스트 `127.0.0.1:8000`을 쓴다. 프록시/네트워크는 실제환경에 맞게 `APP_BIND_IP`/`APP_PORT`를 설정한다. Dockerfile은 Node22.17.0 빌드→Python3.12 slim-bookworm 런타임이며 `web/public`과 `web/dist`를 모두 포함한다. Linux compose/이미지 실행은 미검증이고 digest고정은 실제빌드/검증 뒤 수행한다.

## 필수자료와 누락 처리

필수 관측/보정은 manifest의 S01 DR1(D6), S02 QR3(D6), S10 SWCSv5, 명왕성 S12/S14 QR3(D3), D3보정 L051의 **6파일**이다. ZIP에는 이6원본/보정과 `solar_system_ephemeris.json`·`pluto_ephemeris.json`·`solar_system_orbits.json`을 포함한다. 전체102파일 manifest는 출처 추적을 위해 포함하지만 나머지96개 관측/보정/참조는 현재런타임 필수범위가 아니며 전부 포함됐다고 가정하지 않는다. 나머지 공식4대상은 확보source목록/미검증 안내까지이며 실제영상/품질 실행경로는 미완료다.

필수원본 누락/SHA불일치는 worker오류/준비실패로 남기고 다른관측이나합성사진으로 대체하지 않는다. manifest의 원URL/Drive참조에서 동일파일을 확보해 전체SHA/바이트를 확인한다. 원본 상대경로를 임의변경하지 않는다. 지도·카탈로그·모형/문헌 API의 누락/무결성 실패도 정상빈결과와 구분한다.

| 런타임 자료 | 포함할 경로와 구분 |
| --- | --- |
| NASA행성/확장태양계·지도/고리 | `data/reference/catalog/nasa_science/`, `data/reference/solar-extension/`, `data/reference/appearance/`와 대응manifest, `web/public/textures/`·`web/dist/textures/` |
| 역사/은하/카이퍼·이전근거 | `data/reference/history/`, `data/reference/galaxies/`, `data/reference/kuiper/`, `data/reference/cosmic-morphology/`, `data/reference/cosmic-observations/`와 대응manifest. 실제역사5이미지는 public/dist의 `observations/cosmic/`에 모두 포함 |
| 장기모형/천체계층/표시명 | `data/reference/long-term/`, `data/reference/universe-catalog/`, `data/reference/object-names/`와 대응manifest. 원모형계수·출처SHA·미지원/null값을 보존 |
| DEV-009 외부은하검토 | `data/manifests/extragalactic_planets.json`과 `data/reference/extragalactic-planets/facts/`의 프로젝트작성사실JSON/sidecar. 전체 `upstream/` 문서복제본은 로컬감사 전용이며 ZIP제외 |
| DEV-009 실제외계행성사진 | `data/manifests/exoplanet_observations.json`, `data/reference/exoplanet-observations/facts/`, `web/public/observations/exoplanets/`와 `web/dist/observations/exoplanets/`의3JPEG/필요sidecar. public은 reader입력, dist는실제서빙이므로 둘다필수. 전체 `upstream/` 페이지복제본은 ZIP제외 |

Git에서 제외된 채택원본도 완결ZIP에는 포함한다. Git clone만으로 원본준비완료를 가정하지 않는다. `Data_Spec.md`는 확보/이전자료까지 전수 기록하지만 ZIP은 현재런타임 필수범위만 담는다. 새두군의 facts는 프로젝트가 작성한 사실추출이며 전체논문/페이지 재배포권한을 가정하지 않는다. source경로/해시·원문참조는 보존하고 upstream복제본 없이 런타임 reader가 동작해야 한다.

## 대표경로 확인

- health→우주탐색의 클릭/검색 자동포커스→명왕성 실제 S12/S14와 εB S01/S02 날짜/파장→관측비교→품질/출처→판단저장/JSON내보내기→새세션/import를 실행한다. 같은카메라/시각/관측·result/evidence ID와판단을 확인하고 API/worker실제재시작 뒤 다시 export/import한다. 성공은 천체연관/측광/운동의 과학적 검출판정과 별개다.
- `/api/v1/catalog/exoplanets`의6470행성/4862호스트, `/api/v1/catalog/solar-system`의476등록/471위치지원, `/api/v1/appearance`의31지도/4고리, `/api/v1/catalog/galaxies`의9은하와각지도URL의 원바이트를 확인한다. `pl_controv_flag`/개별논문 reference가 없는 원행은 미상/null이며 ‘논란없음’이나6470전논문 재검토완료로 바꾸지 않는다.
- **우주 천체 탐색→확인 행성**에서 실제목록을 검색/선택해 기존3D항성계로 즉시확대한다. 태양계 배경4862개 표식은 실제호스트 카탈로그방향이며 거리/밝기/epoch전파는 미검증이다. 카메라중심 표시구는 물리거리가 아니다. 외부9은하의 확인목록은 채택자료에서0개이고 후보2/집단추론3은 별도문헌검토만 제공한다. `/api/v1/catalog/extragalactic-planets`의 정상빈객체와503오류를 구분한다.
- `/api/v1/catalog/exoplanet-observations`와 실제3사진의HTTP SHA/바이트를 확인한다. HIP65426b/JWST, BetaPictorisb/SPHERE, HR8799c/NACO를 선택해 미리보기/확대/닫기·전체credit/CC-BY4.0·처리한계/원출처를 확인한다. JPEG3개는 합계1,270,679B이며 표면분해사진이 아니다. 다른실제대상의 ‘채택영상없음’·사진실패/재시도·빠른선택시이전사진미노출을 확인한다. 기존3D외관은 별도 설명모형이다.
- 기본 **자동 시간선**의 날짜입력에서2026-11-14→2500-01-01→0000-01-01→2026-11-14를 Enter/blur로 적용한다. 실제2026-11-13~16UTC72시간에서는천체력표시보간, 그밖지원범위−2999-01-01~3000-01-01에서는TDB달력의JPL적합근사를 선택하며 활성출처/라벨을 표시한다. 출처별달력라벨선택이며 정밀UTC↔TDB변환은아니다. 유효하지않은날짜/범위밖은마지막유효장면을유지한다. 상세에서수동모형도검사한다.
- `/api/v1/long-term-model`의공식계수SHA/범위, `/api/v1/long-term-simulation?year=0`·99·2500의8대표위치, 지구표시명과상세EMB기준/대표지도아이콘·물리반지름비표시를확인한다. 근사모형은Sun+8행성계만지원하며명왕성/달/추가왜행성의새위치를만들지않는다. 속도1/6/24/72h/s와1/10/100Julian년/s·정지/끝·숨김정지/편집정지를확인한다. 수십억년태양계복원/오차상한을제공하지않는다.
- **오른쪽 위 톱니바퀴→카이퍼 벨트**의on/off를확인한다. 최소44px버튼은외계행성/계층/우주역사보기에서도열린다.30–50au/650점은설명용영역표시이며전수실제KBO/밀도/두께가아니다. 근사모형에서표시제외이유, 다른보기에서태양계장면에적용됨을안내하고checkbox값을보존한다. 천체력보기복귀뒤토글상태를확인한다.
- `/api/v1/cosmic-observations`와상단 **빅뱅·우주 역사**의실제5영상/출처추정연대·범위/처리·credit/권리를확인한다. 기존 `/cosmic-history`의10지점은호환API일뿐활성가상장면이아니다. 임의시각사진/가상배치/성장프레임을표시하지않는다.
- `/api/v1/catalog/universe`의기본24·우리은하4871항목/4862호스트·TRAPPIST-1의7자식행성을확인한다. 은하방향선택확대·수동카메라·기호/참조좌표역할과5언어위성표시명/원국제지정명·지원위성로딩/미지원분리를검사한다.

원 `model_epoch`/SPHEREx `DATE-AVG`와 optional `simulation_context`를 구분한다. 저장에는원72시간UTC시각과별도근사TDB달력/원manifestSHA·속도·정지상태가보존된다. 재시작/import에서원본·해시/알고리즘·날짜가맞아야정지상태로복원하며달라지면재계산필요다. 근거JSON만다른서버로옮기면로컬비교정본이없어재계산이필요할수있다.

## 상태 보관·복구

백업은 API와worker를종료한뒤 상태전체와입력manifest/사용원본을함께보관한다. 실행중일부JSON/DB만복사해완전백업이라고하지않는다. 배포실패시새릴리스를중지→해당worker종료확인→이전코드와호환되는보관상태/원본으로이전릴리스실행→health와저장/복원을재확인한다. 문제를해결하려고 `var`/원본을삭제하거나업그레이드기본값으로초기화하지않는다. 기존완결ZIP과검증기록을보존한다.

코드·관측출처·개별자산권리고지는 `THIRD_PARTY_NOTICES.md`·`docs/ai_usage.*`·`Data_Spec.md`에있다. SPHEREx와공개관측사진은AI생성이미지가아니고UI/처리/번역·설명용외관코드의AI지원을구분한다. 사용자/팀내부원문·개인정보·계정/비밀정보·.git·라이브상태/로그는ZIP에넣지않는다. 원어민/팀원과업검수·정밀측정/운동판정·F01잔여/F04/F05·Linux/공개서비스검증은실제기록없이는완료로주장하지않는다.

## 전달본 식별

v0.7.0은 source checkpoint `bb386f38b4a5e971041befc9fe18c5a5be626858`로만 origin/main에 보존했다. 현재 v0.8.0의 정확한 최종 ZIP 검증은 `docs/releases/v0.8.0.json`과 동명 외부 verification/checksum JSON에서 확정한다. 직전 불변 검증본 `NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_182253KST.zip`과 그 검사 기록은 보존한다. Windows 해제/실제 서버 재시작 검사는 Linux 또는 공개 서비스의 검증이 아니다.

## v0.8.0 추가 런타임 자료와 검사

`data/manifests/mass_scenarios.json`, `black_holes.json`, `observer_physics.json`과 `data/reference/mass-scenarios/facts/`, `data/reference/relativity/facts/`를 포함한다. 전체 논문·HTML의 `upstream/` 사본은 로컬 감사 전용으로 ZIP에서 제외하며 프로젝트 작성 사실 JSON과 출처/해시는 보존한다. EHT 실제 영상 2건과 권리/출처 sidecar는 `web/public/observations/black-holes/` 및 실제 서빙하는 `web/dist/observations/black-holes/` 양쪽에 필요하다. 원문 102개 및 이전 사용 자료는 변경하지 않는다.

- 세드나 등의 3요건 창에서 6종 비교 위성 밀도와 직접 입력, 별도 추정 질량/범위/Π를 확인한다. 이 값은 원 실측 질량·IAU 분류를 대체하지 않는다. 고정 6×6 자료 경계의 조건부 필터는 0개이며 직접 입력과 별개다. 밀도 100–10000 kg/m³는 UI 운용 범위다.
- 우측 상단 톱니바퀴 또는 선택 정보의 관측자 실험을 연다. 압축 카메라 위치의 역변환은 위치 스냅샷이며 실제 비행·시간·속도를 복원하지 않는다. 원 관측 적색편이(음수 포함), FLRW 잔여거리의 조건부 계산, 별도 입력 β의 SR, 정적 Schwarzschild 중력 계수를 구별한다. 거리 미상/부적합 모형은 미산출이다. 영상 자체는 재색칠하지 않는다.
- 설정 또는 천체 목록의 블랙홀에서 11개 실제 대상·9개 채택 질량·2개 고정 EHT 관측 영상을 확인한다. 휠과 r/Rs 입력은 별도 정적 관측자 반지름, 드래그는 방위각을 바꾼다. 궤적은 구면 대칭 비회전 시공간의 적도 null 방정식 수치 경로이며 관측자 하늘 영상/강도·Kerr·강착/내부 복원이 아니다. 질량 미확보 2개에는 대상별 Rs를 만들지 않는다.
- 선택한 블랙홀 ID, 관측자 실험 값, 질량 가정과 세 source SHA가 ε Indi B/명왕성 근거의 optional context에 함께 저장되는지 JSON 내보내기/새 세션 import와 재시작 후 확인한다. 변경된 source·유효하지 않은 파라미터·미지원 ID는 정상 복원으로 통과시키지 않는다. 원 노출·판단·관측자/시각은 그대로 보존한다.

새 자료는 NASA/ESA/ESO/JPL 등 확인한 제공기관을 사용하며 중국 기관 자료 제공자는 새 채택에서 제외했다. NED의 NASA/IPAC 집계 제공자와 원 관측 기여기관은 다르다. 원 기여기관 미확인 행은 미확인으로 기록하며 연구자 국적이나 전수 비중국 기원을 확인했다고 주장하지 않는다.
