# 첫 관측 릴리스 실행·복구

DEV-002 / v0.2.0: 우주 탐색→천체 자동 포커스→실제ε Indi B/명왕성 관측→품질→근거 저장/카메라·시각복원 경로다. 공개 서버 업로드·기존 서비스 변경은 수행하지 않았다. Windows Python3.12/Node22에서 검사했으며 Docker Linux 엔진 부재로 컨테이너/실서버는 미검증이다. 실제 CPU/RAM/포트/volume/proxy/HTTPS 할당을 확인한 뒤 적용한다.

1. ZIP 전체를 서버의 **새 릴리스 디렉터리**에 풀고 `release_manifest.json`의 파일/해시·입력3개를 확인한다. 기존 var를 압축 해제로 덮어쓰지 않는다.
2. Python3.12 환경에서 `python -m pip install -r requirements.runtime.lock.txt`를 실행한다(개발검사도 실행할 때만 requirements.lock.txt). 프런트 정적 빌드는 `web/dist`에 포함된다. Linux 명령은 프로젝트 루트에서 `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 1`이다. 한 API가 별도 과학worker를 생성한다.
3. 영속 상태 루트는 환경변수 `APP_STATE_DIR`(기본 var)다. 프록시/방화벽·할당 포트는 실제 서버 설정을 사용한다. 기존 상태는 API/worker를 종료하고 안전하게 별도 보관한 뒤 재사용한다. 원본 경로를 임의 변경하지 않는다.
4. `/health/live`, `/health/ready`→우주탐색/클릭·검색자동포커스→명왕성실제S12/S14와εB S01/S02 날짜/파장→관측 비교→품질/출처→판단 저장/JSON 내보내기→새 세션/import의카메라/시각/결과를 확인한다. API를 종료/재시작한 뒤 같은 근거를 export/import해 확인한다. 성공해도 과학적 천체 연관/운동 측정 완료를 뜻하지 않는다.

Docker가 실제 동작하는 환경에서는 루트에서 `docker compose -f deploy/compose.yaml up --build -d`를 사용할 수 있다. compose는 포함된 data를 읽기전용, var를 쓰기가능 volume으로 연결하고 호스트127.0.0.1:8000을 기본으로 쓴다. 기존 프록시와 다른 네트워크에 있으면 실제 운영 환경에 맞게 `APP_BIND_IP`/포트·접근정책을 조정해야 한다. 이 compose 및 이미지의 Linux 실행은 아직 검증하지 않았다. 이미지 태그는 Docker 빌드 통과 후 digest를 고정해야 한다.

필수 자료는 manifest S01 DR1(D6), S02 QR3(D6), S10 SWCSv5, 명왕성S12/S14 QR3(D3), D3보정L051이다. ZIP은6원본/보정과 solar_system_ephemeris.json/pluto_ephemeris.json/solar_system_orbits.json을포함한다. 전체102파일 manifest도 출처 추적을 위해 포함하지만 나머지 파일은 현재 런타임 필수가 아니며 ZIP에 포함하지 않는다. 나머지 공식4대상의 화면은 archive source 목록/미검증 안내이며 영상·품질 실행 경로는 아직 제공하지 않는다. 필수원본이 누락/해시 불일치하면 worker 오류/준비실패로 남으며 다른자료나합성영상으로대체하지않는다. 궤도는수성~명왕성9개이며원점태양/거리미상별방향의궤도는지어내지않는다. manifest 원URL/Drive 참조에서 동일 파일을 확보해 SHA를 확인한다.

복구: 새 릴리스를 중지→그 worker 종료 확인→이전 코드와 호환되는 보관 상태 및 원본으로 이전 릴리스를 실행→health와 저장/복원 재확인. 배포 실패를 해결하려고 var/원본을 삭제하지 않는다. 파일 백업은 API/worker 종료 후 상태전체와 입력 manifest를 함께 복사한다. 온라인 실행 중 일부 JSON/DB만 복사해 완전백업으로 부르지 않는다.

코드·관측출처 고지는 THIRD_PARTY_NOTICES.md와 docs/ai_usage.*에 있다. 아카이브 L2 데이터는 AI 생성 이미지가 아니며 UI/처리 코드에 AI 지원 고지를 적용했다. 사용자/팀 내부원문·계정/비밀정보는 ZIP에서 제외한다.
