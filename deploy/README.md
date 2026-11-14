# v0.9.0 Node.js 서버 실행·복구

**시작 파일은 ZIP을 푼 프로젝트 루트의 `app.js`다. 실행 명령은 `node app.js` 또는 `npm start`다.** 서버에는 Node.js 22.17.0 이상만 필요하며 Python·pip·별도 Python API를 실행하지 않는다. Node 런타임은 내장 모듈만 사용한다. 검증한 정적 프런트와 실제 자료/파생 캐시를 ZIP에 포함하므로 서버에서 npm 패키지를 설치하거나 프런트를 다시 빌드할 필요가 없다.

## 관리 패널 / MCSM

| 항목 | 값 |
| --- | --- |
| 작업 디렉터리 | 압축 해제 후 `app.js`, `package.json`, `node`, `web`, `data`가 함께 있는 폴더 |
| 시작 파일 | `app.js` |
| 시작 명령 | `node app.js` |
| Node 버전 | 22.17.0 이상 |
| 공개 서비스 포트 | 관리 패널에서 실제 할당한 포트를 환경변수 `PORT`로 설정 |
| 기본 포트 | `PORT` 미설정 시 `APP_PORT`, 둘 다 없으면 8000 |
| 상태 경로 | `APP_STATE_DIR`, 기본 프로젝트 루트의 `var/node` |
| 입력 자료 | 포함된 `data` 및 `web/public`·`web/dist`, 읽기 가능해야 함 |

예를 들어 할당 포트가 8000이면 패널 환경변수에 `PORT=8000`을 지정한다. 호스트 할당 포트가 다르면 그 실제 값을 사용한다. 동일 상태 경로에 두 앱을 동시에 실행하지 않는다. `.env.example`은 공개 설정 예시이며 실제 `.env`를 ZIP에 넣지 않는다. Node는 파일을 복사했다는 이유만으로 `.env`를 읽지 않는다. 환경변수를 패널에 지정하거나 선택적으로 `node --env-file=.env app.js`를 쓸 수 있다([Node 22.17 공식 CLI](https://nodejs.org/download/release/v22.17.0/docs/api/cli.html#--env-filefile)).

## 업로드 → 실행 → 확인

1. **완결 ZIP 전체**를 서버의 새 릴리스 폴더에 풀고 `release_manifest.json`의 파일·크기·SHA를 확인한다. 이전 릴리스 폴더와 기존 `var`를 덮어쓰거나 지우지 않는다.
2. 패널 작업 디렉터리를 그 폴더로, 시작 명령을 `node app.js`로 지정한다. 할당 포트와 영속 상태 경로를 환경변수로 설정한다.
3. 실행 뒤 `/health/live`와 `/health/ready`를 확인한다. ready는 실제 상태 쓰기·worker thread·원본/캐시 무결성이 맞을 때만 성공한다. `/api/v1/runtime`은 `runtime: node`, `observation_processing: verified_build_cache`를 반환해야 한다.
4. 실제 ε Indi B의 S01/S02 및 명왕성 S12/S14에서 원시각/품질/출처 → 판단 저장 → JSON 내보내기 → 새 세션 가져오기를 확인한다. 앱을 재시작한 뒤 같은 근거·카메라·시간·질량 가정·관측자 실험이 복원되는지 확인한다.

로그에 `Planet X Node runtime listening on port ...`가 표시된다. live만 성공하고 ready가 실패하면 자료/파생 캐시·경로/해시·상태 폴더 쓰기·중복 인스턴스를 확인한다. 데이터가 없을 때 가짜 관측이나 0값으로 대체하지 않는다.

## 실제 자료와 빌드 캐시

`data/node-runtime/runtime_manifest.json`과 동일한 정본 `data/manifests/node_runtime.json`은 각각473765B, SHA256 `9dfe12f530da0e6993ced98cc1a94932eb8aef161b6ca68e1a5cb081df44a2af`다. 실제 reader 출력99개와 실제 FITS에서 새로 계산한 정/역순 비교4개, 총103JSON/66642151B를 추적한다. 기존 관측102개 중 Node 런타임에 필요한 실제 FITS/보정은 S01/S02/S10/S12/S14/L051의6개다. 나머지96개는 확보/참고 자료이며 전부 서버에 포함됐다고 가정하지 않는다.

런타임 manifest의 `source_files`는1859개 참조 중1564개/531456149B를 필수로 표시하며 나머지295개는 로컬 감사/빌드 참고 등 선택 자료다. 완결 ZIP에는 모든 필수 원본·보정·source facts·시간 배열·카탈로그·원지도/사진과103개 파생 JSON을 넣는다. 전체 논문/출판사 upstream 사본과 보존 자료96개는 이 계약의 필수 파일로 만들지 않는다. 원본과 파생/복제의 전수 구분은 `Data_Spec.md`를 따른다.

비교는 기존 API가 지원하는 두 관측 쌍과 양순서만 제공한다. Node 요청 시 현재 원본·보정·알고리즘과 정본 캐시의 SHA/크기를 검증하고 빌드 때 계산한 결과를 재사용한다. 이는 새 런타임 FITS 분석·검출/측광·운동 측정이 아니다. UI에서 검증된 사전 계산 결과임을5언어로 고지한다. 원 DATE-AVG/TIMESYS·native 픽셀·FLAGS·판단을 유지하고 Python의 원 JSON float·내용 SHA·result ID를 보존한다. 임의 새 좌표/ROI/새 FITS의 즉시 분석은 제공하지 않는다.

가정 밀도 질량·표시 천체력 Hermite·장기 Kepler는 Node의 일반 수식으로 계산한다. 표시 Hermite의 UTC/TDB 변환은 저장 매듭 간 선형 대응이며 정밀 시간계 변환이 아니다. 기존4개 원매듭은 원 벡터 그대로다. 모델/가정·원 실측과 IAU 분류의 구분은 FSD를 따른다.

## 상태 보관과 이전

Node의 기본 상태는 `var/node`이며 이전 Python의 `var`와 분리했다. 이전 근거 JSON은 원 비교정본·SHA가 맞으면 가져올 수 있다. Node는 비교 JSON의 원 canonical 바이트를 유지해 `1.0`/`1` 직렬화가 이전 Python의 결과 ID·내용 SHA를 깨지 않게 한다.

기존 상태 경로를 직접 재사용할 때는 먼저 이전 API/worker를 종료하고 상태 **전체**를 백업한다. 두 런타임을 같은 상태에 동시에 붙이지 않는다. 이전 writer가 살아 있으면 잠금 오류로 거부한다. Node 하나만 상태를 쓰고 worker thread는 검증/읽기를 보고한다. 종료되지 못한 queued/running 작업은 재시작 시 interrupted로 남는다. 기본 실행에서 volume을 초기화하지 않는다.

배포 실패 시 새 앱을 중지하고, 보관한 이전 릴리스와 호환 상태 전체로 복귀한 뒤 health·같은 근거의 복원을 다시 확인한다. 캐시/해시 오류를 해결하려고 원본이나 사용자 근거를 삭제하지 않는다. 모델/입력이 바뀐 파생 결과는 개발 환경에서 Python 과학 코드를 이용해 명시적으로 다시 빌드·검증해야 한다. 서버에서 자동 재다운로드·TLS 우회·원본 덮어쓰기를 하지 않는다.

## 선택적 Docker / 개발·재검산

Docker 환경에서는 `docker compose -f deploy/compose.yaml up --build -d`를 사용한다. 기본 Dockerfile은 Node22.17의 prebuilt 런타임이며 `data`를 읽기 전용, `var`를 쓰기 가능한 volume으로 연결한다. 해당 실제 호스트의 포트/proxy/HTTPS/RAM은 별도 확인 대상이다. 이번 로컬 Windows 검증으로 Linux 컨테이너·공개 서비스의 동작을 주장하지 않는다.

기존 Python 코드와 `Dockerfile.python`, `README.python.md`, Python lockfile은 빌드/독립 재검산 또는 선택적 이전 API용으로 보존했다. Node 운영 시작 절차에 Python을 넣지 않는다. 개발 환경의 새 snapshot 생성은 `.venv/Scripts/python -m deploy.export_node_runtime`이고 `--verify-only`로 출처/산출물만 검사할 수 있다. 생성한 정본과 데이터·빌드·검증 기록을 함께 동결한 새 완결 ZIP으로 전달한다.

정확한 v0.9 ZIP 식별/파일 수·실측 바이트/SHA·실제 Node 재시작 검증은 최종 ZIP 옆 동명 checksum/verification JSON과 `docs/releases/v0.9.0.json`에서 확정한다. 사후 검증문서는 이미 검증한 ZIP 바이트를 수정하지 않고 별도 기록한다. v0.8.0의 불변 ZIP과 Git 이력도 보존한다.

현재 Node 검증 정책은 `sha256-stat-fingerprint-v1`이다. 최초 전체 SHA 검증 뒤 매 요청 묶음에서 모든 필수 실경로·파일 ID(dev/ino)·크기·나노초 mtime/ctime을 검사하고, 변경 시 원바이트 SHA를 다시 계산한다. 변경 없는 불변 입력은 검증된 digest를 재사용하며 시간 TTL로 검사를 생략하지 않는다. 원 비교 JSON의 SHA는 읽을 때마다 확인한다. `node app.js --verify-sources`로 명시적 전체 SHA 감사를 실행할 수 있다. 원본/캐시는 읽기전용으로 운영하고 바꾸려면 새 빌드·새 배포 검증을 수행한다.


### DEV-012 최종 완결 ZIP 검증 확정 · 2026-11-14 21:40:02 KST

`NASA_SPACE_APPS_CHALLENGE_v0.9.0_20261114_213804KST.zip`는 **495916482B/2223파일**, SHA256 **`fd3c694f354bac02ba9728dae521b13d7b41250870bc3b050ee8629d6b467db7`**이다. source `7b2dbf7c4e5ee6798fd9c56230a7858ae8dde3e4`의 clean tree, 최종 DLJsfpSc 프런트와 Node 전용 `app.js`/검증된103JSON으로 생성했다. 추적 manifest/source sidecar33개의 Git index와 실제 동결바이트도 전부 일치했다.

정확한 ZIP을 새 `tmp/node-release-verify-r4s83m6d/extracted`에 풀어2222개 release manifest 항목의경로/바이트/SHA와필수원본·캐시를확인했다. Node22.17 절대경로와 `app.js`만서버로실행했고 PATH에서Python실행파일을찾을수없게했다. 개발검증기/HTTP클라이언트의Python과서버의Node를구분한다. 실제두관측·29/32품질·지도/사진·카탈로그·새가정을확인하고실제Node프로세스와worker thread를종료/재시작한뒤 εB/Pluto및추가근거의같은ID·판단·카메라·밀도/관측자설정·export원바이트/import복원을통과했다. 정확완료시각 `2026-11-14T12:40:02.175944+00:00`이다. 상세는 `docs/releases/v0.9.0.json`과ZIP밖동명verification/checksum JSON을따른다. 이사후문서는검증한불변ZIP에추가하지않는다. 기존v0.8 ZIP/원본/Git이력도보존했다. Linux/Docker·공개서비스·사람/원어민검수는수행하지않았다.
