# 구현·검증·제출 근거 목록

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다. Git 구현 a55a0e0·철회 d3be874의 main push를 확인했다.

## 실행 기능 검증 기준 · DEV-027 / OPS-021 · v0.17.0

2026-11-15 21:32 KST 기준 [릴리스 정본](releases/v0.17.0.json), [DEV-027 검사](qa/dev027_local_verification.json), [OPS-021 복구 검사](qa/ops021_migration_verification.json)로 갱신했다. 제품은 태양계 외곽1000AU·실제 SPHEREx·제9행성 문헌 가설/알려진 천체 대조·판단/복원에 집중한다. 은하/지도·외계행성 도감·빅뱅/역사·역사 혜성·블랙홀/범용 물리실험의 아래 기록은 보존 이력이다. **공식 심사 제출 상태와 제출물 반영 여부는 확인하지 않았으며, 배포·자동 검사를 심사 제출 완료로 해석하지 않는다.**

| ID | 내용 | 구현/증거 위치 | 검증 상태 | 제출 반영 | 다음 조치 |
| --- | --- | --- | --- | --- | --- |
| E1 | 태양계 탐색→Pluto/ε Indi B 실관측→가설/실제 궤도 대조→판단·복원 | [관측 등록부](../data/manifests/observation_registry.json)·[P9 출처](../data/manifests/planet_nine_scope.json)·[DEV-027](qa/dev027_local_verification.json) | 공개 Chrome 10/10에서 Pluto 관측 JSON·P9 가설 JSON 분기 복원, 실제 천체 TOP5/연속 선택·패널 보존, ε Indi B S01/S02 원본→품질→저장/새 세션 복원을 확인. 같은 한 번의 연속 과업을 10번 검증한 뜻은 아님 | 공식 제출 미확인 | 검증된 실제 흐름을 승인된 제출물과 연결하고 최종 심사 상태 별도 확인 |
| E2 | 좌표/시간/단위·자료 출처·계산 가정/한계 | science/·node/·tests/의 reader/계산과 아래 DEV별 검산; [FSD](../FSD.md)31~32절·[DEV-027](qa/dev027_local_verification.json) | 원격 strict/Vite·Vitest135·Python context28/메타1·Node91/Ruff 및 최종 영향 Node7 통과. 실제 TOP5는 기존 a/e/i 규칙의 설명용 순위이며 독립 궤도 적합·행성 판정·존재확률 아님. 새 정밀 측광/운동 검증 없음 | 공식 제출 미확인 | 수식·조건·미측정/외삽 한계를 출처와 함께 제시; 자동 검사를 독립 관측 정확도로 확대하지 않음 |
| E3 | 공식 Resources→file ID/SHA→기능→결과 | [Data_Spec](../Data_Spec.md)·[자료 목록](data_inventory.md)·[런타임](../data/manifests/node_runtime.json)·[PDF 검사](qa/dev027_pdf_verification.json) | 등록10대상40제품·37무순서쌍/74방향별 비교와114파생JSON 핀 보존. DEV-027/OPS-021 새 원관측/천체력 취득 없음. PDF380쪽은 EOF의 DEV-027·OPS-021까지 원문/링크/해시를 보존한 문서 파생물 | 공식 제출 미확인 | 크레딧·원출처·문서 PDF와 공개 가능한 제출 링크 대조 |
| E4 | 공개 실행·실제 재시작·근거 원봉투/새 세션 복원 | [v0.17.0](releases/v0.17.0.json)·[OPS-021](qa/ops021_migration_verification.json) | 새 EC2의 Node-only clean-copy PID6870→6883 및 운영7024→7175 재시작 통과. 구판3근거 원봉투/ID/판단/SHA 복원; 확보된 원백업13파일과 공개검사 후24파일 백업 검증 | 공식 제출 미확인 | 로컬 사본 없는 삭제 호스트 후속 근거 복구를 보장하지 않고 현 백업/근거를 보존 |
| E5 | 핵심5언어·PC 권장/모바일 차단·간단 가이드·키보드 | [DEV-027 공개 검사](qa/dev027_local_verification.json)·web/tests/dev027-platform.spec.ts | ko/en/ja/zh-Hant/fr, PC1024/1280/1440·좁은 터치PC 허용, 모바일 App/3D/과학API 미실행, 가이드 Escape/focus복귀를 실제 Chrome에서 확인. 팀원2인 과업/일본어·번체·프랑스어 원어민 검수 미확인 | 공식 제출 미확인 | 팀 내부 과업 결과와 번역 사람 검수는 실제 수행 시에만 추가 |
| E6 | 문제의식·학습·역할별 실제 기여와 AI 고지 | [작업 기록](worklog.md)·[AI 사용 기록](ai_usage.md)·[고지](../THIRD_PARTY_NOTICES.md)·현재 크레딧 | 구현/자료/디자인·검산/운영 활동과 AI 지원 범위를 기록. 제9행성 발견 기여 가능성은 목표이며 발견 실적/생활 효과 측정은 없음 | 공식 제출 미확인 | 실제 활동·승인된 공개 기여 설명을 제출물에 연결하고 미확인 성과를 만들지 않음 |

검사 흐름: 3D → Pluto → 실제 노출 → 개별 가설 경로 → 문헌 밀도 분리 → 증거 저장/새 세션 복원. 각 단계에 입력 조건·기대 결과·실제 결과·증거를 붙인다.

공식 종합 5기준과 10개 Recognition 전체를 E1–E6로 뒷받침한다. Scientific Excellence·Data Excellence·Challenge Communication은 독립 검산·원본 추적/복원·대표 경로 반복을 추가한다. 상태 점검은 각 담당이 직접 갱신하고, 동결 뒤 빈칸을 확인한다.

구판3근거는 복구한7근거(관측4+P9 3)의 부분집합이다. 원백업13파일의 비교2개를 포함한 과학파일9개는 원바이트를 보존했고, jobs4개와 이후 새 stopped-writer24파일 백업은 별도 상태 기록이다. 삭제된 이전 호스트에서 로컬 사본 없이 유실된 후속 근거를 복구했다고 주장하지 않는다. 격리 Chrome9개는 초회7PASS/fixture2FAIL→기본값 검사2FAIL→정확 source/default fixture 후속2PASS를 보존하며 공개10/10과 구분한다. 새 ZIP은 생성하지 않았다.

## 이전 작업 보존 이력

아래 현재/미구현/미배포 표현과 제외 기능·자료 수는 해당 DEV 당시 상태다. 현재 상태는 위 표와 링크한 외부 검증 정본을 따른다. 이전 ZIP·원자료·근거와 실패 기록은 삭제하거나 현재 성공으로 바꾸지 않는다.

DEV-018 문서 단계 보존 기록: 최신1000AU회의/제공사진·로고/위키·공식논문·MCP3개원문을검토하고FSD0.20·Data_Spec·TODO에연결했다. AI는문서/코드지원을했고원관측/로고를생성·변경하지않았다. 후보확률은조건부문헌위치분포만허용하며실제존재확률/새발견을생성하지않는다. 이 문서 단계 당시 새제품기능/브라우저/정확ZIP·MCP연결은미완료였다. 당시 E1~E6 표는 계획에서 시작했으며 위의 현재 표로 갱신했다.

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

DEV-008 재개 검증: E2/E3에 JPL fitted-element 장기8계 모형과32long/16short 검산,5언어476이름의 기관/프로젝트 표기 구분, 실제 은하구성원23개·4862host/6470planet 참조 및 Data_Spec1632항목/877참조/43복제 무결성을 연결한다. E4에는 연도0/음수/미래 Enter·Tab·이동 적용·빈/잘못된 입력 보존·503복구·G1방향확대/host→planet자동포커스·εB/Pluto 원본/판단/근거 복원을 연결했다. 재개 전체Python276·변경영향29·Vitest55·strict/Vite/Ruff 및 실제Chrome13고유 경로를 확인했다. 빌드별 범위/초기실패·수정은 작업기록과 var/qa/dev008-*에 보존한다. 전구간 정확도·우주전수목록·해상 외계행성 표면·과학적 발견·사람/원어민/공개서버 검증으로 확대하지 않는다.

DEV-008 E4/QA09: Windows 준비번들의 새 폴더 해제·manifest/입력SHA·health·대표 API·εB/Pluto 근거 및 실제 서버 재시작 복원을 확인했다. 후속 최종 정본 ZIP의 정확한 바이트·해시·실행 결과는 아래 최종 확정 기록과 동명 verification/checksum JSON을 따른다. Linux/공개 서버 검증은 수행하지 않았다.


DEV-008 최종 전달 정본 확정: source bf1a09f의 clean tree로 생성한 NASA_SPACE_APPS_CHALLENGE_v0.6.0_20261114_182253KST.zip(481,789,033B/1807파일/SHA af2759fc30eb844dc5ba440f76580beb7b4ca2e92444c39235bfafc38bda0d28)을 정확히 새해제·실행/실제재시작복원 검사해2026-11-14T09:25:16.188578+00:00 PASS했다. 폴더tmp/release-verify-zdv3hisw/extracted, metadata1806항목검증, εB ev_bfe8b26234a4451bba85f355210b700c/Pluto ev_e0003ef4c8b54dc98c35241c6b46239b의 같은 result/세션/판단 복원을 확인했다. 상세 docs/releases/v0.6.0.json과외부verification/checksum이정본이다. 이사후기록은검증완료불변ZIP과분리하며제품/데이터변경없다. 원격반영은일반push/원격SHA대조결과로최종보고한다.

DEV-009/010 소스 체크포인트: E2/E3에 실제19출처/17천체의IAU공식정의와Margot조건부원형청소질량,8소천체외관/실제사진3과본체·계질량분리를연결한다. E4는wholePython372/Vitest64/Chrome빌드별21+9+16검사와직접화면기록이며중복실행과후속문구수정을구분한다. source관련정본은var/qa/dev009-browser-review.json,dev010-browser-review.json과DataSpecf26ba122...다. 아직새ZIP/공개서버/새DEV011질량가정·관측자물리·블랙홀검증이아니다.

DEV-011 E2/E3: 비교 위성 6종×대상6종의 출처/구형밀도 가정과 실측/공식분류 분리, 11개 블랙홀/9개 채택 질량/2개 고정 EHT 관측 영상, 원 관측 z14행 중10값/4미확보와 제한된 FLRW/SR/Schwarzschild 모형을 연결한다. 36개 질량 가정은 Decimal45자리 독립 검산을 통과했다. DataSpec은26정본/2041물리파일/53서빙복제의 SHA·바이트와 원102개 보존을 확인했으며 SHA e848ee7025f315a6cfa127f67b3120a2c7ef2f5bee2d3515e26bbd7a1c3aba33이다.

DEV-011 E4: 전체 Python483/Vitest70·strict/Vite/Ruff와 `CNYGnNg7` Chrome13/13 PASS142.460초를 확인했다. 마지막 CSS 여백 교정 뒤 `BfRDPmgL`의 관측자 이동/5언어2경로 PASS9.647초를 따로 확인했다. 실제 εB 근거의 새 세션 복원과 마지막 질량 가정·선택 블랙홀·r/Rs/β/파장/source SHA를 대조했다. 세부는 `var/qa/dev011-mass-browser-review.json`, `dev011-observer-review.json`, `dev011-final-browser-results.json`, `dev011-observer-spacing-followup.json` 및 FSD QA26/27·작업기록에 있다. 최종 ZIP의 해제/실제 OS 서버 재시작 검사는 동명 verification/checksum 및 `docs/releases/v0.8.0.json`에서 별도 확정하며 여기의 Chrome 성공만으로 배포 성공을 주장하지 않는다. 공개 서비스·Linux·원어민/팀원 과업 검수와 미완료 관측/F04/F05의 한계는 유지한다.

DEV-011 E4/QA09 최종 확정: 정확 v0.8.0 ZIP 2095파일/484956608B/SHA1bb76a91…의 새폴더 해제 및 API/worker 실제 재시작 뒤 동일 εB/Pluto 근거·새 가정 복원을20:24:20KST에 통과했다. source45375fc clean tree이며 상세는 [검증 정본](releases/v0.8.0.json)을 따른다. 이 사후 기록은 검증한 불변 ZIP 밖의 별도 문서이며 공개/Linux 검증이 아니다.


DEV-012 최종 브라우저 확정: Node8081/최종 client `index-DLJsfpSc.js`·runtime manifest9dfe…에서23고유경로를 확인했다. 23개 batch는22 PASS/1복합workflow 전체60초 timeout(374.878초)이었고 개별15초 기대값 실패는0이다. 5언어/깜빡임/PNG·JSON·CSV/새문맥복원/공식4대상왕복을한case로묶은검사만전체120초로명시해별도후속1 PASS68.454초(2026-11-14T12:35:11.024Z시작)를확인했다. 과학기대값·단계별15초·제품/Node/source를변경하지않았다. 23개가같은batch모두통과했다고주장하지않고22+1후속으로기록한다. 초기최적화전부분실행15PASS/4지연실패와도구분한다. 정본은 var/qa/dev012-node-final-browser-results.json,dev012-node-observation-followup.json과review보고서다.

Moon의표시R0.20874/물리R1737.4km·group/mesh scale1은선택전후유지됐고camera eye-target은3.089216→0.923769표시단위로접근했다. Phobos의표시R0.036108/물리R11.08km도유지됐고camera거리는0.159789였다. bounding sphere≤1.5e-9차이는12→64 subdivision Float32정점반올림이며확대scale가아니다. 실측첨부 var/qa/dev012-moon-geometry-evidence.json에원수치를보존했다. 질량approx/원mass null/IAU분류·늦은결과·실제촬영시각/품질·관측자/근거/복원·Node사전계산5언어고지도검사했다. 정확v0.9 ZIP의실제Node실행/재시작검증은최종사후기록으로확정한다.


### DEV-012 최종 완결 ZIP 검증 확정 · 2026-11-14 21:40:02 KST

`NASA_SPACE_APPS_CHALLENGE_v0.9.0_20261114_213804KST.zip`는 **495916482B/2223파일**, SHA256 **`fd3c694f354bac02ba9728dae521b13d7b41250870bc3b050ee8629d6b467db7`**이다. source `7b2dbf7c4e5ee6798fd9c56230a7858ae8dde3e4`의 clean tree, 최종 DLJsfpSc 프런트와 Node 전용 `app.js`/검증된103JSON으로 생성했다. 추적 manifest/source sidecar33개의 Git index와 실제 동결바이트도 전부 일치했다.

정확한 ZIP을 새 `tmp/node-release-verify-r4s83m6d/extracted`에 풀어2222개 release manifest 항목의경로/바이트/SHA와필수원본·캐시를확인했다. Node22.17 절대경로와 `app.js`만서버로실행했고 PATH에서Python실행파일을찾을수없게했다. 개발검증기/HTTP클라이언트의Python과서버의Node를구분한다. 실제두관측·29/32품질·지도/사진·카탈로그·새가정을확인하고실제Node프로세스와worker thread를종료/재시작한뒤 εB/Pluto및추가근거의같은ID·판단·카메라·밀도/관측자설정·export원바이트/import복원을통과했다. 정확완료시각 `2026-11-14T12:40:02.175944+00:00`이다. 상세는 `docs/releases/v0.9.0.json`과ZIP밖동명verification/checksum JSON을따른다. 이사후문서는검증한불변ZIP에추가하지않는다. 기존v0.8 ZIP/원본/Git이력도보존했다. Linux/Docker·공개서비스·사람/원어민검수는수행하지않았다.


DEV-015–016: comets.json/galaxy_atlas.json/numerical_relativity.json의 원본·변환·canonical SHA 및 Node107JSON을 Data_Spec에 연결한다. 실제4혜성의489개 TDB표본, GWGC53,162개18필드, SXS13,869개 native복소모드를 보존한다. 독립 PDE는 사용자 초기조건의 계산이며 실제 관측/행성 존재확률이 아니다. 기존 SPHEREx102개 원본과 근거를 보존하고 필수6개와 참고96개를 계속 구분한다. 최종 검사/완결 ZIP은 DEV-016 작업 기록과 릴리스 검증 정본을 따른다.


DEV-016 LAN: 최종 CumtP9k6 프런트를 기존 var/node/3002에 반영했다. 실제 Wi-Fi HTTP origin에서 양자1단계·실제NR13,869표본·은하53,162검색/포커스·ε Indi B S01/S02의 기존 cmp_d88083664b6fd27592eb68c1 표시를 확인했다. pageerror0, ready200이다. var/qa/dev016-lan-final.json/PNG가 자동검사 근거이며 다른 물리기기의 최신빌드 검사를 대신하지 않는다. IP/PID는 Git제외 var/lan-host.json에 보관한다. 이전 빌드와 var/node 근거를 보존했고 공개 MCSM/nginx 설정은 변경하지 않았다.


RELEASE-011 · v0.11.0 완결 ZIP 검증 확정: `NASA_SPACE_APPS_CHALLENGE_v0.11.0_20261115_001122KST.zip` / 580,411,280B / 2,320파일 / SHA256 `db7468317fa4ab1d3c0a8a616815d12ca22bb15bd1486f6848b5a8d2c1715d69`. clean source `aa3b2c44cba9125e7832f535ce8232c4b20ab8e9`에서 패키징했다. 실제 ZIP을 새 폴더에 풀어 2,319 manifest 항목·필수1,586 source·107생성JSON을 대조했고, Node22.17.0만 PATH에 둔 app.js 실행/ready·ε Indi B/Pluto 실원본/품질·근거 내보내기/가져오기·실제 프로세스 재시작 후 복원을 PASS했다. 정확 ZIP은 기존LAN을 유지하기 위해 PORT8011로 검사했고 기본3002는 현재 Node22 child회귀에서 별도로 확인했다. 새GWGC53,162·SXS13,869·혜성4/489 TDB표본 HTTP검사도 PASS했다. source297이 아니라 최종 source1885/필수1586/선택299이며 ZIP에는 선택32개가 있고267개는 보류/감사본으로 제외됐다. 현재 LAN CumtP9k6와 기존var/node는 계속 실행/보존한다. 공개호스팅/Linux/모든물리법칙·runtimefullGR/결합 계산은 완료로 올리지 않는다. 최종 공개 기록은 `docs/releases/v0.11.0.json`, 정확검증은 동명 외부 `.verification.json`이다. 이 사후문서 기록은 이미 검증한 ZIP 바이트를 수정하지 않는다.

DEV-018현재활성source정본53e05dcf241974c4840536492522b49bca6fbb00eafd415b62467080d9a9849c/39JSON/source1252·필수1165,최종로컬검증docs/qa/dev018_local_verification.json. 기존2,186획득목록과새activeclosure를구분하며TNO8,341/문헌10만/MCP응답·출처는Data_Spec을따른다.


## RELEASE-012 · 실제 EC2·HTTPS 배포 검증 완료

2026-11-15 KST. 정확한 `NASA_SPACE_APPS_CHALLENGE_v0.12.0_20261115_034911KST.zip`는489,039,770B/1,540파일, SHA256 `c251031cc7df5526b038425ba6d672d96cbbe01e0123b2df55c09fc5332ed067`다. Windows와Ubuntu24.04.2WSL/ext4에각각새로풀어1,539manifest항목/필수1,165source·39JSON/원comparison4개SHA를검증했고Node24.22.3단독서버의실제재시작·εB/Pluto/P9근거복원을통과했다.

사용자EC2 Ubuntu24.04.5/x86_64/4vCPU16GB/50GiB에같은ZIP을전송해SHA를확인하고전용planetx/systemd·nginx80/443→loopback3002·shared/node영속상태로배포했다. 실제systemd재시작PID2871→3077후기존근거3개export바이트SHA동일/같은IDimport복원을통과했다. 공개실관측/31지도·P9HTTP검사와정식주소 `https://nasaspaceappschallenge.marulee.dev/`의일반Chrome157(우회옵션없음)3흐름을통과했다. TLS1.3·정확호스트/기본CA검증·HTTP→HTTPS·DNS3.37.17.247,인증서2027-02-12만료·자동갱신timer/실제dry-run성공을확인했다. 초기HTTP-IP브라우저검사에서만HTTPS자동업그레이드를끈사례는정식HTTPS검증과분리한다.

최종기록은`docs/releases/v0.12.0.json`,`docs/qa/dev018_ec2_https_verification.json`과ZIP옆외부Windows/Linux/EC2검증JSON이다. 이사후기록은검증된불변ZIP을고치지않는다. 이전v0.11ZIP/Git/원자료/근거를보존했다. 이번배포에Git새commit/push·심사제출은수행하지않았다. 상호N체/모든물리법칙·미발견전수·새이동검출/존재확률·원어민검수를완료로올리지않는다. 첫EC2배포라구버전으로의실제rollback드릴은수행하지않았고복구계약/안내를유지한다.


DEV-020: 실제8341개 exactSPK 설명·선택/판정·원출처, 공식OPAL2RGB무손실/원본결측·조명·고리·LOD, 조건부P9와8행성표시필터, 실제관측/질량가정새세션복원을 연결했다. Source1272/필수1182·39JSON·기존4comparison SHA 및3운영근거원export를 보존한다. 문서/DataSpec 신규40파일전수표와 docs/qa/dev020_local_verification.json이 빌드 전 검증 정본이며, 완결ZIP/원격서비스·실제재시작/커밋은 후속 외부 docs/releases/v0.13.0.json으로 확정한다. 이전 릴리스 기록은 당시 상태다.

DEV-020 사후 확정:073754 ZIP/Ubuntu Node단독실행·재시작·동일ZIP Sydney배포·정식HTTPS Chrome5흐름·운영PID변경후기존3근거의원export SHA/ID/판단복원이완료됐다. 새근거/지도원본추적/정확SHA는 docs/releases/v0.13.0.json. 이기록은불변ZIP외부에추가하며새검출·존재확률·모든물리법칙구현을뜻하지않는다.
