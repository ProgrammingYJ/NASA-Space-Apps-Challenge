# Node 서버 실행·복구 — 현재 운영과 OPS-021 검증 이력

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](../docs/releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다. Git 구현 a55a0e0·철회 d3be874의 main push를 확인했다.

현재 진입점은 릴리스 디렉터리 루트의 `app.js`, 시작 명령은 `node app.js`다. 검증된 정적 프런트·Node 코드·계약·필수 원자료와 빌드 캐시를 함께 준비한다. Python/PIP/프런트 재빌드는 서버 시작의 필수 단계가 아니다. 큰 원자료가 제외된 Git clone만으로 실행을 보증하지 않는다.

현재 운영은 보조 고지 PDF를 철회하고 재활성화한 **v0.17.3**이다. source 검증614개·runtime source1365/필수1270이며 기존114생성JSON/74비교 원핀은 동일하다. 실제 복귀·운영 재시작12469→13323·17과학파일 보존·보조 PDF 경로404는 [철회·복귀 정본](../docs/releases/notice-withdrawal-20261115.json)을 따른다. PDF 통합은 실행하지 않았다.

철회된 과거 검증 v0.17.4의 디렉터리는 `NASA_SPACE_APPS_CHALLENGE_v0.17.4_20261115_221244KST`, source 검증616개이며 manifest SHA는 `6bae69f6bfe7df117d2d55caf782f011805ba554adcacf64d2996b882cad5490`이었다. 보조 고지 PDF1개가 추가된 당시 runtime source1366/필수1271과114생성JSON/74비교의 동일성은 [철회된 릴리스 이력](../docs/releases/v0.17.4.json)에 보존한다. 현재 배포 수치로 사용하지 않는다.

아래 v0.17.0 수치·SHA는 [당시 기능 검증 스냅샷](../docs/releases/v0.17.0.json), [OPS-021 이전·복원 검사](../docs/qa/ops021_migration_verification.json), [DEV-027 검사](../docs/qa/dev027_local_verification.json), [FSD32.4](../FSD.md#324-dev-027ops-021-공개-검증-확정)의 역사다. v0.17.3의 공개5경로와 당시 v0.17.0의10기능경로를 구분한다. 사후 문서 현행화로 검증한 불변 디렉터리를 변경하지 않는다.

## AWS EC2 구성과 v0.17.0 당시 검증

| 항목 | 확인값 |
| --- | --- |
| 공개 서비스 | <https://nasaspaceappschallenge.marulee.dev/> |
| 호스트·리전 | `54.117.136.144` · `ap-northeast-2` (SSH/IMDSv2 확인) |
| 인스턴스·OS | `m7i.xlarge` · 4CPU/약16GB · Ubuntu24.04.5 LTS x86_64 |
| 런타임 | Node24.22.3 · nginx1.24.0 |
| 앱·프록시 | `127.0.0.1:3002` → nginx80/443 · 정상 HTTPS |
| 코드·상태 | `/srv/planet-x/current` → 릴리스 디렉터리 · `/srv/planet-x/shared/node` 영속 상태 |
| 서비스 | `planet-x.service` · 전용 `planetx` 사용자 |

v0.17.0 당시 정확한 `NASA_SPACE_APPS_CHALLENGE_v0.17.0_20261115_212528KST` 디렉터리를 활성화했다. payload1971개/1,103,576,581B, 디렉터리 manifest SHA `acde18eded0d97f6d65768910a172b8ae14606a25827d45b1478a10af59af591`이며 source612개 바이트를 대조했다. Node-only clean-copy와 공개 PC Chrome10/10, 실제 운영 PID7024→7175 재시작·구판 근거 복원을 확인했다. 이 결과는 모든 기기/실험의 성공이나 향후 무중단 보장이 아니다.

설치와 콘솔 설정은 [EC2_SETUP.md](EC2_SETUP.md)를 따른다. SSH22는 운영자 IP로 제한하고 앱3002/MCP 포트를 공개하지 않는다. 개인키·인증서 개인키·기존 shared 백업은 Git/공개 배포물에 넣지 않는다.

## 디렉터리 전달·활성화

사용자 지시에 따라 **새 릴리스 ZIP은 만들지 않는다.** 파일별 경로/바이트/SHA가 있는 완결 디렉터리를 새 `/srv/planet-x/releases/RELEASE`에 전달한다. 기존 릴리스·`shared`를 덮어쓰지 않고 `release_manifest.json`과 필수 원자료를 검증한다. 이전 불변 ZIP과 복구용 불변 tgz는 역사·백업 입력으로 보존한다.

아래 `RELEASE`는 전달받은 정확한 디렉터리명으로 바꾼다. 명령 제공과 실제 실행·검증은 구분한다.

```sh
release=/srv/planet-x/releases/RELEASE
# 이미 HTTPS가 구성된 호스트: 새 디렉터리 검증 후 활성화
sudo bash "$release/deploy/ec2/activate-release.sh" "$release"
curl --fail http://127.0.0.1:3002/health/ready
curl --fail https://nasaspaceappschallenge.marulee.dev/health/ready
sudo systemctl status planet-x --no-pager
sudo journalctl -u planet-x -n 100 --no-pager
```

새 Ubuntu 호스트의 첫 설치에만 `sudo bash "$release/deploy/ec2/install-host.sh"`를 먼저 사용한다. 이미 구성된 호스트에 이를 재적용해 nginx/인증서를 덮어쓰지 않는다. 활성화기는 `deploy/ec2/verify-manifest.cjs`와 `node app.js --verify-sources`를 전용 사용자로 실행한 뒤 기존 writer를 중지하고 `current` symlink를 바꾼다. 활성화 전에 writer 정지 상태의 shared 전체를 별도 비공개 경로에 백업하고 SHA를 확인한다. 활성화 자체가 백업을 대신하지 않는다.

`/etc/planet-x/app.env`의 운영값은 `APP_HOST=127.0.0.1`, `PORT=3002`, `APP_STATE_DIR=/srv/planet-x/shared/node`다. 실제 서비스 파일은 [planet-x.service](ec2/planet-x.service)를 따른다. 실패하면 shared를 초기화하지 않고 로그·이전 릴리스 경로를 보존해 호환되는 코드/전체 상태로 복귀한다.

## 직접 실행·LAN

```sh
node app.js
node app.js --verify-sources
```

직접 실행의 기본 bind는 `0.0.0.0`, 포트는 `PORT` → `APP_PORT` →3002 순이다. `APP_HOST=127.0.0.1`이면 같은 호스트에서만 접근한다. 같은 Wi-Fi에서는 현재 PC의 LAN IP와 운영체제 방화벽 허용을 사용한다. 과거 LAN IP가 지금도 같다고 추정하지 않는다. EC2 운영에서 public3002 개방을 요구하는 설정이 아니다.

상태는 `APP_STATE_DIR` 또는 프로젝트 루트의 `var/node`에 저장한다. `.env.example` 복사만으로 환경변수가 로드되지는 않는다. 필요하면 `node --env-file=.env app.js`를 사용한다. Docker/compose는 선택 경로이며 현재 `deploy/compose.yaml`은 **Node용 `deploy/Dockerfile`**을 사용한다. Python 재검산은 [README.python.md](README.python.md)의 별도 개발 경로다.

## 자료·과학 상태·health

v0.17.0 당시 `data/manifests/node_runtime.json`과 `data/node-runtime/runtime_manifest.json`은 생성114JSON/63,027,446B, source1365개 중 필수1270개를 추적했다. 당시 배포는 선택28개 present·67개 미배포를 구분했다. 당시 runtime manifest SHA는 `e12e8a80f5868234bf09e680d68b8057504f6360bafa3f6606d06b37eec28882`다. DEV-027에서 이전114생성파일과74방향별 비교의 핀은 모두 동일하며 새 원관측을 추가하지 않았다. 현재 source/필수 수와 runtime SHA는 위 철회·복귀 정본을 따른다.

실제 SPHEREx 등록은10대상·40제품·37무순서쌍/양방향74비교다. 대표 ε Indi B S01/S02와 명왕성 S12/S14의 기존 네 정본 ID/원JSON 바이트를 보존한다. Node는 검증된 **빌드 때 FITS 계산 결과**를 제공하며 요청 때 새 FITS 분석·검출/측광/운동 확인을 수행한 것으로 표시하지 않는다. DATE-AVG/TIMESYS/FLAGS·원자료/보정 SHA·품질/미검증 상태를 유지한다. 입력·권리·한계는 [Data_Spec.md](../Data_Spec.md)를 따른다.

`/health/live`는 프로세스 응답, `/health/ready`는 저장 쓰기·worker 생존·필수 자료/캐시 무결성을 확인한다. `/api/v1/runtime`은 검증 빌드 캐시와1000AU 범위·계산 한계를 제공한다. 최초 전체 SHA 감사 이후 과학 요청에서는 실경로/identity/fingerprint를 확인하고 변경 시 SHA를 재계산한다. 자료 누락·해시 불일치를 합성 데이터로 채우지 않는다. 정적 지도 성공이 과학 ready 실패를 해제하지 않는다.

## 저장·복원과 점검

현재 제품은 태양계1000AU·공전/자전/시간재생·행성3요건·실관측·제9행성 가설을 유지한다. 은하/지도·외계행성 도감·빅뱅/역사·블랙홀/범용 실험은 현재 코드/API/새 배포 의존성에서 제외했다. 실제 천체 궤도 유사도 TOP5는 a/e/i의 설명용 비교 규칙이며 별도의 문헌 조건부 하늘 영역 TOP5·존재확률과 구분한다.

PC Chrome을 권장하며 모바일은 탐색 앱/WebGL·과학 API를 로드하기 전에 안내 화면으로 제한한다.5언어 가이드·검색/INFO/P9 패널 재열기·검색 Escape/바깥 클릭·카메라 드래그 잠금을 검사한다. 패널 숨김으로 가설 입력·모형시각·실제 관측 시각/판단을 잃지 않아야 한다.

전역 JSON 가져오기는 관측/P9 근거의 종류별 endpoint로 분기한다. 원관측 근거는 `evidence_id`/비교/판단·원봉투 바이트를 보존한다. 새 TOP5 기준에는 알고리즘·a/e/i/epoch·TNO source SHA를 저장하며 구판 가설 전용 필터는 안내 후 전체 보기로 연다. 원근거를 새 의미로 재작성하지 않는다. 제거된 선택 맥락은 `partially_restored`, 핵심 비교를 검증할 수 없는 경우는 `recalculation_required`로 구분한다.

점검 순서는 ready → 실제 원본/품질 → 판단 저장 → export → 새 세션 import → `sudo systemctl restart planet-x` → 같은 ID/조건·원봉투 export 대조다. 동일 shared에는 Node 단일 writer만 실행하고 미완료 작업은 재시작 시 `interrupted`로 남긴다.

## 복구 범위와 이전 이력

이전 Sydney `16.176.170.4`는 사용자가 삭제했다고 확인했다. 로컬 불변 백업13파일(관측 근거4·P9근거3·비교2·jobs4)에서 근거7개·비교2개의 원바이트를 새 호스트에 복구·검증했다. 별도 구판3근거는 이 범위의 부분집합이므로 더하지 않는다. 사본 없는 이후 근거의 복구는 보장할 수 없다.

v0.17.0의 OPS-021 재시작 후 stopped-writer 백업24파일/10,762,240B를 로컬로 내려받아 SHA `a49928a95ca5b9bba9a04554f55cf1343f8bcd4913bd0e85d75118317030c8aa`를 대조했다. 이는 당시 백업 이력이며 최신 상태는 철회·복귀 정본을 확인한다. 백업 내용은 비공개다. 구 Sydney의 과거 HTTPS/재시작 성공을 새 호스트의 성공으로 대신 쓰지 않는다.

아래 v0.12.1의39JSON·4비교·ZIP 전달 및 OPS-020 Sydney 문단 전체는 **당시 기록**이다. 실행 지침은 위의 Node 디렉터리 절차이고 현재 활성 버전은 v0.17.3 철회·복귀 정본, 정확한 과거 식별자·상태는 [릴리스 기록](../docs/releases/)과 Git 이력을 따른다. Python v0.8.0 본문은 [README.python.md](README.python.md)에 역사로 남아 있다.

<details>
<summary>역사: v0.12.1 Node 및 OPS-020 운영 기록</summary>

## v0.12.1 Node 서버 실행·복구 (당시 기록)

시작 파일은 ZIP 루트의 `app.js`, 명령은 `node app.js`다. 완결 ZIP에는 검증된 정적 프런트·Node 코드·계약·필수 관측/보정·자료와 출처/라이선스가 포함된다. Node 런타임은 내장 모듈만 사용한다. Python/PIP/프런트 재빌드는 서버 시작의 필수 단계가 아니다. 큰 원자료가 없는 Git clone만으로 실행을 보증하지 않는다.

## AWS EC2

채택 구성과 콘솔 생성/설치/HTTPS 순서는 [EC2_SETUP.md](EC2_SETUP.md)를 따른다. 새 Ubuntu24.04 amd64에 고정 Node24.22.3/전용planetx/nginx/systemd를 준비한다. 파일은 `deploy/ec2/`에 있으며 배포 전에 정확한 ZIP SHA를 대조한다. 루프백3002의 Node 앞에 nginx80/443을 두고 근거는 `/srv/planet-x/shared/node`에 영속 보관한다. SSH22는 사용자IP만 허용한다. 앱/도구 포트를 추가로 공개하지 않는다.

```sh
# ZIP을 새 /srv/planet-x/releases/릴리스명 폴더에 푼 후
sudo bash /srv/planet-x/releases/릴리스명/deploy/ec2/install-host.sh
sudo bash /srv/planet-x/releases/릴리스명/deploy/ec2/activate-release.sh /srv/planet-x/releases/릴리스명
curl --fail http://127.0.0.1/health/ready
sudo journalctl -u planet-x -n 100 --no-pager
```

첫 설치 때만 install-host.sh를 사용한다. 이미 HTTPS가 구성된 EC2의 수정 배포는 새 릴리스에 압축을 푼 뒤 activate-release.sh만 실행해 인증서/nginx/shared를 보존한다. 설치기는 기존 사용자 설정이 다르면 덮어쓰지 않고 중단한다. 활성화기는 경로·전용계정 읽기·전체 파일/원자료 SHA를 먼저 검사하고 이전 writer를 중지한 뒤 current symlink를 바꾼다. 실패 시 shared를 초기화하지 않고 이전 경로와 로그를 남긴다. 실제 EC2/DNS/HTTPS/재시작 성공은 해당 호스트 검사 기록으로 확정하며 로컬 Windows/WSL 검사와 구분한다.

## 직접 실행·LAN

기본 bind는0.0.0.0, 포트는 `PORT` 우선 → `APP_PORT` →3002다. `APP_HOST=127.0.0.1`이면 같은 호스트에서만 접근한다. 같은 Wi-Fi 서버는0.0.0.0 bind와 현재 PC의 LAN IP, 운영체제 방화벽 허용이 필요하다. 과거 확인한 LAN IP가 현재도 같다고 추정하지 않는다.

상태 경로는 `APP_STATE_DIR` 또는 ZIP 루트의 `var/node`다. `.env.example`을 복사만 해서는 로드되지 않는다. 호스트 환경변수를 지정하거나 `node --env-file=.env app.js`를 사용한다. Docker/compose는 선택 경로이고 실제 컨테이너 검증 여부는 릴리스 보고서와 구분한다. 예전 MCSM 할당 포트3002는 기본 포트 이력이며 새 EC2에서 public3002 개방을 뜻하지 않는다.

## 자료와 health

현재 정본 `data/manifests/node_runtime.json`/`data/node-runtime/runtime_manifest.json`은 생성39JSON/19,190,204B, source1,252개·필수1,165개를 추적한다. 원4관측+2보정, 태양계/지도/이름/3요건, 제9행성 Caltech 표본·JPL TNO를 active closure로 사용한다. 은하·외계행성·역사·블랙홀/범용실험 자료는 새 실행 필수/번들에서 제외한다. 모든 확보 원본이 독립 관측이나 런타임 사용 자료인 것은 아니다. [Data_Spec](../Data_Spec.md)을 따른다.

`/health/live`는 프로세스 응답, `/health/ready`는 저장 쓰기·worker 생존·필수 원본/캐시 무결성이다. `/api/v1/runtime`은 Node/검증 빌드 캐시/1000AU 범위·계산 한계를 제공한다. `node app.js --verify-sources`는 전체 SHA 감사를 강제한다. 자료 누락/해시 불일치는 가짜 데이터로 채우지 않는다.

Node는 εB S01/S02와 명왕성 S12/S14의 양순서4개 비교를 실제 FITS에서 빌드한 정본 캐시로 제공한다. 요청 때 새 FITS 분석·실측 이동/광도 검출로 표시하지 않는다. 원 DATE-AVG/TIMESYS/FLAGS/결과 ID/SHA를 보존한다. 전체 최초 SHA 감사 후 과학 요청별 모든 필수 파일의 실경로/identity/fingerprint를 검사하고 변경 시 SHA를 재계산한다. 정적 지도는 자기 serving-copy를 검증하며 지도 성공으로 과학ready 실패를 해제하지 않는다.

## 저장·복원·복구

Node 단일 writer가 파일을 원자적으로 저장한다. 동일 상태에 두 프로세스를 붙이지 않는다. 재시작 전 writer 종료를 확인하고 미완료 작업은interrupted로 둔다. 배포는 정지 상태의 shared 전체를 백업하고 릴리스별 코드/입력과 스키마 호환을 보존한다.

기존 관측 근거의 원 봉투·결과 ID·SHA를 유지한다. 제거된 선택 맥락만 제외하면 응답1.1의 `partially_restored`이며 활성 세션에 제외 목록/이유를 보여준다. 원 핵심 비교를 검증할 수 없으면 `recalculation_required`다. 새 P9 가설 근거는 별도 버전/종류/ID와 문헌/날짜/가설/coverage원문/판단으로 저장하며 실제 관측 근거와 섞지 않는다.

검사 순서는 ready→εB/명왕성 원본/품질→판단 저장→export→새 세션 import→실제 프로세스 재시작 후 동일 ID/조건 복원이다. 새 P9 영역 선택/표본/날짜/MOST 원응답 근거도 별도로 검사한다. 공개 주소와 실제 자료·저장·복구의 성공은 별개다.

실패하면 서비스를 중지하고 검증된 이전 릴리스 current와 호환 가능한 shared 전체로 복귀한 뒤 같은 검사를 반복한다. 원본/근거를 삭제해 문제를 숨기지 않는다. 기존v0.11 불변 ZIP과 Git은 보존하며 새 전달은 항상 완결 ZIP이다. 정확한 새 ZIP의 크기/SHA·해제/실행·Windows/Ubuntu/EC2 검증 상태는 ZIP 옆 외부 verification JSON을 따른다.


DEV-019: 전체 TNO 목록/겹친 점 선택과 −2999~3000년 장기 궤도 외삽을 제공한다. runtime 계산은jpl-sbdb-tno-two-body-v2이며 원본 snapshot v1은 보존했다. ±100Julian년은 경고 전환 기준일 뿐 정확도 보장 구간이 아니다. 최종 검사/수정 배포는 v0.12.1 외부 보고서로 확인한다.


OPS-020: 현재실제호스트는16.176.170.4/시드니m7i.xlarge/Ubuntu24.04.5다. 기존저장13파일의정지백업/모든SHA를대조해이전했다. nginx서버블록의gzip은JSON/JS/CSS/SVG전송만압축하며자료/계산값과압축해제SHA를보존한다. 최신배포/재시작/검사는docs/qa/ops020_migration_verification.json과정확ZIP외부보고서로확인한다. 개인키·기존shared상태백업·실제인증서개인키는ZIP에없다.

</details>
