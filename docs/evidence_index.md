# 구현·검증·제출 근거 목록

다음 표의 초기 상태는 계획이다. 실제 증거가 생긴 항목만 구현/검증/제출 상태를 갱신한다. 개인정보와 비밀값을 포함하지 않는다.

| ID | 내용 | 구현/증거 위치 | 검증 상태 | 제출 반영 | 다음 조치 |
| --- | --- | --- | --- | --- | --- |
| E1 | 명왕성 실관측→Planet X 가설→판단→저장/복원 | DEV-002 우주→명왕성S12/S14→관측/판단·근거 | 우주선택/자동포커스·실노출·저장복원까지검사. Planet X/문헌분포는미구현 | 미반영 | F04가설/별도문헌분포연결 |
| E2 | 좌표/시간/단위·가정/오차·대안 독립 검산 | science/·tests/의 실제 reader/천체력/표시계산, 아래 DEV별 원본 검산 | εB/Pluto·기본JPL/궤도/재생 검사, DEV-004 확장20·외관11·원본 독립 대조. 정밀측정/운동판정 미검증 | 미반영 | 실제운동/오차모형·종합 확장회귀 |
| E3 | 공식 Resources→file ID/SHA→기능→결과 | S01/S02/S10·S12/S14/L051→comparison/evidence; 새 공개manifest→카탈로그/장면 | 관측 전체SHA·보정·입력/결과ID 추적·실제API/Chrome. 확장 원본/행별출처 보존 | 미반영 | 다른공식대상 검사·최종 확장ZIP 추적 |
| E4 | 선택/시간/그래프/언어·새 세션 복원 | API/복원·관측/우주/재생 브라우저 검사, 아래 DEV별 증거 | εB/Pluto 새세션·카메라/모형시각·재생정지·누락/변조/버전·서버재시작 검사. 확장 종합회귀 진행 | 미반영 | F04–05 연결·확장회귀·사람검수 |
| E5 | 내부 2명 과업·설명·핵심 5언어 | 항목/체크리스트 수신 | 실행 미확인 | 미반영 | 앱에서 실제 검사 |
| E6 | 비전/학습/역할별 실제 기여 | 작업 기록 시작 | 활동별 확인 | 미반영 | 실제 완료 사례 기록 |

검사 흐름: 3D → Pluto → 실제 노출 → 개별 가설 경로 → 문헌 밀도 분리 → 증거 저장/새 세션 복원. 각 단계에 입력 조건·기대 결과·실제 결과·증거를 붙인다.

공식 종합 5기준과 10개 Recognition 전체를 E1–E6로 뒷받침한다. Scientific Excellence·Data Excellence·Challenge Communication은 독립 검산·원본 추적/복원·대표 경로 반복을 추가한다. 상태 점검은 각 담당이 직접 갱신하고, 동결 뒤 빈칸을 확인한다.

DEV-001 첫εB 경로의 입력/기대·실제·실행환경·result/evidence ID·스크린샷은 작업기록과 var/browser-results에 연결한다. E1의 전체3D/명왕성/가설 경로 및 E5의 팀원2명 과업검사는 아직 수행하지 않았다. 자동5언어 키/화면 검사를 사람의 원어민 검수로 바꾸지 않는다.

DEV-006/FSD0.9의 현재 은하 계약은9개다. E2/E3에 `science/galaxies.py`·`tests/test_galaxies.py`14PASS/Ruff, 공식17원문5,947,706B, `galaxies.json`80,168B/SHA `1363cee1eb52a93d4e6505d437dd3d2291f16592e166fc33bbaef7864ba0890f`를 연결한다. 최초4개 snapshot을 별도로 보존해 방향/거리/coordinate_source불변을검사했다. M31경사77°·M81두팔·LMC막대/한팔·M51동반·타원형/제트·먼지띠의 원문과 미상경사/PA·표시가정을 분리하며 실제 관측사진 원페이지를 링크한다. M33렌더스타일을 NASA분류로 주장하지 않는다.

E4/QA16은9개별형태의 실제Chrome/공식사진 대조·미상각도/5언어·선택자동포커스·기존원본/근거보존을 후속확정한다. 새로운 서사/시각 표현은 정밀 물리pose·별위치·고대우주/새확률검증이 아니다. 아래 DEV-0054은하/원문12개·당시8검사는 최초구현 기록이며현재9개/17은하원문의계약으로승격했다. 최종전체검사·Git·ZIP결과는root완료기록전까지진행중이다.

DEV-005/v0.5.0 최초 추가 기록: E2/E3에 `science/history.py`/`galaxies.py`/`kuiper.py`와3개 manifest→당시12공식원문2,861,220B→새4읽기API/장면의 경로를 연결한다. history12·당시galaxy8·catalog API19검사로10개연대/근사anchor·최초4은하의 원 sexagesimal/거리/단위·주카이퍼/별도scattered구분·finite나이/범위422·TNO6부모·실제JPEG/PNG원본SHA를 확인했다. 별도 검토도 원 NASA/ESA문구·단순좌표 산술을 대조했으며 새로운 정확도/시대경계/존재확률 검증으로 확대하지 않는다.

E4에는 정밀72h/s·카이퍼/은하 설정/legacy두표시off 복원·은하자동포커스·우주역사와 정밀/외계행성 모드 전환의 camera/원관측 보존·실제 원본파일 재검증을 연결한다. 전체Python176(34.15초)·Vitest36/strict/Vite는 이후 작은 수정 전 중간값이며 최종회귀는후속확정한다. DEV-004 지도Chrome3(1.8분)/외계행성1(16.5초)는 완료, DEV-005새Chrome5/GPU·완결v0.5ZIP는진행중이다. 최종수·스크린샷·ZIP은 작업기록에 추가한다. GitHub MVP체크포인트와 공개 앱배포는 계속 구분한다.

DEV-002: 전체화면우주→클릭/검색/자동포커스→Pluto원본/품질→판단·복원까지실제Chrome검사했다. E2에는JPL원벡터/반지름·ICRF/km좌표교차검사, E3에는S12/S14/L051·현재DataLink동일보정SHA확인, E4에는대상별workspace·모형시각/카메라복원을추가한다. Python54·Vitest9·Chrome5시나리오통과와스크린샷/ZIP검사는DEV-002기록에있다. 전체F04가설/문헌분포·F05외계행성·팀원2명과업검사는완료로올리지않는다.

DEV-003/v0.3.0: 이전 완성본 commit `54756ca`를 보존한 뒤 연속 시간 재생·정지와 표시 보간을 추가했다. E2에는 `science/timeline.py`·`tests/test_timeline.py`의17검사와 `timeline_validation.json`의 별도 JPL 중간시각27개 검산을 연결한다. 최대차이 약18.99km는 표본 결과이며 전구간 상한/실측 정확도가 아니다. E4의 재생/끝/수동/저장 정지·정지 복원은 Python100·Vitest18·Chrome11전체경로(새재생4포함)로 검사했다. 숨김탭은 headless hidden/visibilitychange 주입이며 실제OS 전환 검사로 확대하지 않는다. v0.3 완결 ZIP 확정 전달 기록은 없다.

DEV-004/v0.4.0의 최신 증거는 기존 흐름을 보존한 확장이다. E2에 `tests/test_extended_solar.py`20PASS·`tests/test_appearance.py`11PASS·외계행성 원본/API6PASS와 공개 manifest를 연결한다. 위성468개 중463위치지원, 전체476중471지원객체의 target/parent/UTC 양끝을 별도로 읽어 대조했다. TNO PRIMARY+상대벡터의 별도 KM-S5조회 최대차이는0.0000989372km이며 같은 모델의 센터/단위/보간 일관성이다. 실제 정확도/전구간 상한이 아니다.

E3은 `extended_solar.json`→509원본19,411,029B→부모별 API/표식, `appearance.json`→31지도/4고리·원파일SHA/credit/UV→선택 상세, `exoplanets.json`→NASA115페이지13,740,795B→6470행성/4862모항성계→행별 출처로 추적한다. E4에는 태양계/외계행성 전환시 원 카메라 보존, 선택별 지도 로드·시간표본·미지원 사유와 기존 εB/Pluto 근거 source SHA를 연결한다. 카탈로그만 열어 새로운 실제 SPHEREx 관측/근거를 얻었다고 하지 않는다.

개별 Chrome 외계행성1경로(16.5초)는 전체목록/TRAPPIST-1 7행성·설명용 표면/주기 재생·태양계 복귀를 확인했고 Earth/Saturn/Moon/Uranus 실제지도 로드에서 GLSL/JS오류0을 점검했다. 최신 프런트27단위·strict/Vite는 통과했으며 전체 Chrome/Python 회귀·완결 v0.4 ZIP은 진행 중이다. `5d3a450` MVP GitHub push는 코드 체크포인트 증거이며 앱 배포 증거가 아니다. E5의 팀원2명·원어민 검수·Linux/공개서버는 여전히 미검증이다.



DEV-005/006 최종 통합: Python185 PASS(325.37초, 기존 Starlette 경고1)·Vitest40 PASS·TypeScript strict/Vite·Ruff 통과. 실제 Chrome21개 고유 경로 검사를 완료했다. 최초 전체 실행은19PASS/2실패(9.0분)였고, 동시부하의 Titan cold-parent 대기와 OrbitControls 감쇠 대기를 실제 완료/연속 안정 조건으로 고친 뒤 최종 CJgIAKg2 빌드·재시작한 cold API에서 관련4개를 모두 재검사해 통과했다. 수치 허용오차는 완화하지 않았다. E4/QA11–16은 `var/qa/dev006-galaxy-*.png`, `dev006-galaxy-final-probe.json`, `galaxy-source-context.png`, `galaxy-kuiper-evidence-restored.png`, `cosmic-*.png` 및 web/tests의21경로로 연결한다. 완결 배포본은 `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.5.0_20261114_144922KST.zip`다. 포함 파일/바이트/SHA 및 Windows 새 폴더 해제·health·31지도 원바이트·476확장객체/6470외계행성/9은하/역사10지점·εB/Pluto 근거와 실제 서버 재시작 후 동일 evidence/result ID 복원을 확인했다. 검증된 동일 독립 런타임을 재사용했으며 새 설치로 주장하지 않는다. 최종 ZIP의 정확한 SHA/바이트/해제 경로·실행 시각은 동명 `.zip.sha256.json`·`.verification.json`을 기준으로 한다. 문서 확정 후 최종 ZIP도 같은 검사로 재확인한다. Linux 컨테이너/공개 서버 배포는 수행하지 않았다.

## DEV-008 urgent travel checkpoint - 2026-11-14T15:54:38+09:00

User explicitly requested wrap-up within one minute before shutting down. Stop new browser/release work and preserve current source/data/Git.
Implemented v0.6.0: 476 object names in five locales with original designations/IDs retained; separate JPL fitted Kepler simulation -2999-01-01 through 3000-01-01 TDB calendar labels (8 systems + Sun; Earth icon means EMB; unsupported objects omitted); source-backed galaxy-member hierarchy and angular zoom with existing exoplanet-system links; visible header Big Bang/history entry. History remains five published actual observation products and approximate source ages, with no synthetic 35-galaxy growth scene.

Verified: strict TypeScript/Vite index-DSKEjKdg.js; Vitest54 passed; Ruff check/48-file format. Whole pytest:275 passed,1 failed in60.64s. Failure was a test setup calling calendar_jd(-3000), which correctly rejects unsupported input; changed setup to one day before the supported minimum JD. Rerun after that test-only correction is PENDING. New long-term28/catalog19/names4 targeted tests passed previously. DEV007 observed-only Chrome6 passed on its prior build. DEV008 new six browser scenarios were WRITTEN/DISCOVERED, NOT EXECUTED. Do not claim current whole browser verification.

Resume: read AGENTS,SKILLS,FSD,START_HERE,Data_Spec and this checkpoint; preserve raw/data/var/Git. Run whole pytest and new simulation-names/universe-catalog browser scenarios, then existing cosmic/observations. Build complete v0.6 ZIP and verify fresh extraction,health,epsilon/Pluto evidence and real server restart. No public/Linux deployment or F01 remaining/F04/F05/native-language/human QA claimed.

