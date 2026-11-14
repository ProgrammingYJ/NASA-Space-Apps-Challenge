# v0.6.0 실행·복구

DEV-008 / v0.6.0: 우주 탐색·시간 재생·실제 εIndiB/명왕성 관측/근거를 보존하며 5언어위성명, 별도장기JPL근사, 은하내성원/항성계탐색과 상단빅뱅진입을 추가했다. 빅뱅은 실제관측5영상/추정연대만 표시한다. 재개초기Python276 및 최신Vitest55·strict/Vite·입력/API교정후장기29검사를 통과했으며 관련Chrome13고유경로를수정빌드별로통과했고최종제품빌드는index-D7O_yXx_.js이며지원위성대기문구의천체력/관측분리교정후이름/시간/오류/로딩4경로도추가통과했다. 전체13개를마지막빌드에서한번에재실행한것은아니다. Windows준비번들해제/실제서버재시작검증을통과했으며최종D7 ZIP의정확한검사는패키징후동명외부검증JSON으로확인한다. 최종결과는 docs/worklog와 동명검증JSON으로 확정한다. 공개서버 업로드·기존서비스 변경은 수행하지 않았다. Windows검사와 Linux/실서버검증은 별개다. 실제 CPU/RAM/포트/volume/proxy/HTTPS 할당을 확인한 뒤 적용한다.

1. ZIP 전체를 서버의 **새 릴리스 디렉터리**에 풀고 `release_manifest.json`의 전체 파일/해시·필수6FITS와 공개 자료를 확인한다. 기존 var를 압축 해제로 덮어쓰지 않는다.
2. Python3.12 환경에서 `python -m pip install -r requirements.runtime.lock.txt`를 실행한다(개발검사도 실행할 때만 requirements.lock.txt). 프런트 정적 빌드는 `web/dist`에 포함된다. Linux 명령은 프로젝트 루트에서 `python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 1`이다. 한 API가 별도 과학worker를 생성한다.
3. 영속 상태 루트는 환경변수 `APP_STATE_DIR`(기본 var)다. 프록시/방화벽·할당 포트는 실제 서버 설정을 사용한다. 기존 상태는 API/worker를 종료하고 안전하게 별도 보관한 뒤 재사용한다. 원본 경로를 임의 변경하지 않는다.
4. `/health/live`, `/health/ready`→우주탐색/클릭·검색자동포커스→명왕성실제S12/S14와εB S01/S02 날짜/파장→관측 비교→품질/출처→판단 저장/JSON 내보내기→새 세션/import의카메라/시각/결과를 확인한다. API를 종료/재시작한 뒤 같은 근거를 export/import해 확인한다. 성공해도 과학적 천체 연관/운동 측정 완료를 뜻하지 않는다.

Docker가 실제 동작하는 환경에서는 루트에서 `docker compose -f deploy/compose.yaml up --build -d`를 사용할 수 있다. compose는 포함된 data를 읽기전용, var를 쓰기가능 volume으로 연결하고 호스트127.0.0.1:8000을 기본으로 쓴다. 기존 프록시와 다른 네트워크에 있으면 실제 운영 환경에 맞게 `APP_BIND_IP`/포트·접근정책을 조정해야 한다. 이 compose 및 이미지의 Linux 실행은 아직 검증하지 않았다. 이미지 태그는 Docker 빌드 통과 후 digest를 고정해야 한다.

필수 자료는 manifest S01 DR1(D6), S02 QR3(D6), S10 SWCSv5, 명왕성S12/S14 QR3(D3), D3보정L051이다. ZIP은6원본/보정과 solar_system_ephemeris.json/pluto_ephemeris.json/solar_system_orbits.json을포함한다. 전체102파일 manifest도 출처 추적을 위해 포함하지만 나머지 파일은 현재 런타임 필수가 아니며 ZIP에 포함하지 않는다. 나머지 공식4대상의 화면은 archive source 목록/미검증 안내이며 영상·품질 실행 경로는 아직 제공하지 않는다. 필수원본이 누락/해시 불일치하면 worker 오류/준비실패로 남으며 다른자료나합성영상으로대체하지않는다. 궤도는수성~명왕성9개이며원점태양/거리미상별방향의궤도는지어내지않는다. manifest 원URL/Drive 참조에서 동일 파일을 확보해 SHA를 확인한다.

추가 필수 자료: `data/reference/catalog/nasa_science/`, `data/reference/solar-extension/`, `data/reference/appearance/`, `data/reference/history/`, `data/reference/galaxies/`, `data/reference/kuiper/`·`data/reference/cosmic-morphology/`·`data/reference/cosmic-observations/`·data/reference/long-term/·data/reference/universe-catalog/·data/reference/object-names/와 대응 공개manifest, `web/public/textures/` 및 실제서빙용 `web/dist/textures/`와 public/dist 양쪽의 `observations/cosmic/`5이미지를 포함한다. Git에서 제외된 공개 원본도 ZIP에는 들어 있다. Git clone만으로 원본 준비 완료를 가정하지 않는다. `/api/v1/catalog/exoplanets`6470개·`/api/v1/catalog/solar-system`476개/지원471개·`/api/v1/appearance`31지도/4고리·`/api/v1/cosmic-observations`5실제사진/추정연대(기존`/cosmic-history`10지점은호환API)·`/api/v1/catalog/galaxies`9개·`/api/v1/kuiper-belt`와각지도URL을 확인한다. 지도/역사화면5사진은출처시기의처리관측이다. 미해상외관/현대은하3D/카이퍼입자는별도설명용표현이다. 과거화면은가상배치/성장/임의시각영상을표시하지않는다. 정밀모형은2026-11-13~16 UTC72시간이다. 별도장기근사는−2999-01-01~3000-01-01 TDB달력값의Sun+8대표행성계만지원하며earth는EMB,Pluto/달/왜행성/별은미지원이다. 초기우주보기는확보한5관측사례/표본범위다. 저장시정지·새세션에서시각/카메라/표시설정복원도확인한다.

복구: 새 릴리스를 중지→그 worker 종료 확인→이전 코드와 호환되는 보관 상태 및 원본으로 이전 릴리스를 실행→health와 저장/복원 재확인. 배포 실패를 해결하려고 var/원본을 삭제하지 않는다. 파일 백업은 API/worker 종료 후 상태전체와 입력 manifest를 함께 복사한다. 온라인 실행 중 일부 JSON/DB만 복사해 완전백업으로 부르지 않는다.

코드·관측출처 고지는 THIRD_PARTY_NOTICES.md와 docs/ai_usage.*에 있다. 아카이브 L2 데이터는 AI 생성 이미지가 아니며 UI/처리 코드에 AI 지원 고지를 적용했다. 사용자/팀 내부원문·계정/비밀정보는 ZIP에서 제외한다.


추가 점검: /api/v1/long-term-model의공식계수SHA·범위, /api/v1/long-term-simulation?year=0·99·2500의TDB달력/8대표위치/EMB대표아이콘·물리반지름비표시, /api/v1/catalog/universe의기본24·우리은하4871총항목/4862호스트·TRAPPIST-1의7자식행성을 확인한다. 화면에서5언어 위성이름/영문alias·국제지정명 원문·지원위성의표본로딩과미지원분리, 상단빅뱅실제5사진, 장기연도입력의Enter/blur/이동적용·편집중정지·invalid마지막장면보존·재생/자료503/정밀복귀와 은하방향선택확대/기호·참조좌표역할을 검사한다. 장기모형은정밀천체력·수십억년복원이나오차보장이아니고 은하방향지도도미측정깊이를만들지않는다.

근거의원 model_epoch/원본 DATE-AVG와 optional simulation_context를 구분한다. 모형해시/원문·날짜가 맞아야 정지상태로복원하며 달라지면 재계산필요다. Data_Spec은전체확보자료1631파일+참조helper1을기록하지만 ZIP은현재런타임필수범위만포함한다. 확보만96관측/보정/참조가모두포함됐다고가정하지않는다.


## 전달본 식별과 검증 기록

서버 전달 최종본의 로컬 경로는 artifacts/NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_182253KST.zip다. 정확한 최종ZIP 바이트/SHA256·커밋·해제실행 시각/결과는 패키지 옆 동명 .zip.sha256.json과 .verification.json을 정본으로 따른다. 최종묶음은 현재동결제품D7O_yXx_와 이 문서를 포함해 clean Git소스에서 생성하며, 정확한최종아카이브의새폴더해제/재시작검사는 패키징후 별도로 실행한다.

Windows 준비번들 검증은 2026-11-14 18:22:00 KST(2026-11-14T09:22:00.694531+00:00)에 PASS했다. 대상은 내부보존용 NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_181913KST.zip(BaIOI0V5 UI)이며 tmp/release-verify-f5vt0brn/extracted의 새폴더에서 manifest1806파일+release_manifest1개를대조했다. 이전에검증한동일독립Python런타임을재사용했으며새설치로주장하지않는다. health·31지도SHA·확장476/외계행성6470·역사5실관측/9은하·장기8대표위치와−2999/0/99/2500/3000년·curated24/MW4871/TRAPPIST7을실행했다. εB/Pluto근거저장과실제API서버재시작뒤동일evidence/result ID복원도통과했다. 이초기준비번들검사를후속D7최종ZIP의정확동일바이트검사와혼동하지않는다. 최종ZIP의실제검사는동명검증JSON에서확인한다. Linux/컨테이너/공개서버는검증하지않았다.
