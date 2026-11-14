# v0.12.1 Node 서버 실행·복구

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
