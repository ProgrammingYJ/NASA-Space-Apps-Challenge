# AI/SI 지원 사용 기록

DEV-018 문서 단계: 최신1000AU회의/제공사진·로고/위키·공식논문·MCP3개원문을검토하고FSD0.20·Data_Spec·TODO에연결했다. AI는문서/코드지원을했고원관측/로고를생성·변경하지않았다. 후보확률은조건부문헌위치분포만허용하며실제존재확률/새발견을생성하지않는다. 새제품기능/브라우저/정확ZIP·MCP연결은미완료다. 아래제외기능의실사용/검증기록은당시보존이력이며현재유지범위가아니다.

OPS-013 / v0.9.1: 사용자가 요청한 MCSM 기본 포트3002에 맞춰 app.js/Node서버·Docker/compose·실행 문서와 실제 childprocess 회귀를 수정했다. 기존과학자료·프런트·관측비교 캐시는 변경하지 않았다. 전체 Node18검사 PASS10.909초와 포트 환경변수 없는 시작 검사를 확인했으며, 새 ZIP의 실제 해제/3002 재시작 결과는 동명 외부 검증 JSON으로 확정한다. 공개 프록시/MCSM 설정은 변경하지 않았다.

공식 안내의 코드/데이터·음성 생성 고지는 설명문과 메타데이터에,이미지/영상 생성 고지는 눈에 보이는 워터마크에 적용한다. 이 파일과 `ai_usage.json`은 실제 작업이 늘어날 때 함께 갱신한다.

| 작업 | 도구 | 지원 범위 | 실제 확인 | 한계 |
| --- | --- | --- | --- | --- |
| 행사 초기 설정 | Codex 및 분리된 서브에이전트 | AGENTS/환경·ignore/문서 작성,GitHub 초대,공개원본 데이터/출처 목록 정리,공식 안내·팀원 자료 대조 | 원격 초대 목록/Drive 크기·폴더,로컬 SHA,설정/추적 상태 점검 | 앱/worker·과학 검출·영상/이미지 생성은 이 작업에서 수행하지 않음 |
| Skills·개발 명세·초기 프롬프트 | Codex 및 분리된 서브에이전트 | 스킬10개 설치/출처 기록·전용4개 작성, FSD/프롬프트/노션 확인 규칙 작성, 태양계57천체 출처 후보 정리 | 스킬 구조14/14·51파일SHA/바이트·상대링크60개, 출처34URL HTTP/title 확인·일부 내용 대조 | UI 스킬 발견·앱 라이브러리 설치/구현·수치/천체력·브라우저/배포 실행 미검증; 새 Notion 본문은 이 작업에서 재조회하지 않음 |
| Space Time 주 참고·자동 중심 이동 명세 | Codex 및 분리된 검토 에이전트 | 실제 참고사이트 브라우저 조작·공용Notion 관련3페이지 읽기, FSD-0.2/AGENTS/프롬프트 갱신 | 검색→명왕성 이동·정보·별 Evidence UI 관찰, 문서 독립 대조 | 우리 앱의 카메라·관측 연동은 미구현/미검증; 참고사이트 전체기능/수치 검증·자산 복제·Notion편집 없음 |
| DEV-001 · ε Indi B 첫 완주 | Codex 및 과학reader/프런트/독립검토 에이전트 | 실제 FITS reader·API/IPC worker·5언어 관측작업대·파일근거/복원·테스트·배포패키지 코드 작성 | 실제S01/S02/S10 SHA·단위/WCS/FLAGS·API/재시작·Chrome 새세션복원·변조/누락·경쟁상태 검사; 정확한 결과는 worklog | 원어민/팀내2인검수·정밀측정/운동/3D·Linux/공개서버 미검증. 관측 원본 생성·변경 없음 |
| DEV-002 · 우주 탐색 기본 흐름 | Codex 및 장면/천체력/Pluto·독립검토 에이전트 | Three.js 자유조작·자동포커스,선택맥락의관측패널,공식JPL위치/물리량·Pluto실제노출/관측자연결,대상별작업/카메라·시각저장복원 | Python54·Vitest9·TS빌드·Chrome5시나리오검사,원본/보정/JPL출처SHA·epoch/frame·반대방향포커스/경쟁/복원검사 | 장면거리/크기/색·조명/별배경은설명용코드표현. 관측원본변경/이미지생성API없음. F04/F05·정밀측정·원어민/팀원과업·Linux/공개서버미검증 |

실행 모델의 정확한 식별자는 이 작업 결과에서 제공되지 않아 미확인으로 둔다. Codex/ChatGPT 요금제와 API 모델·실제 API 사용을 혼동하지 않는다. API 키/비밀값은 이 기록에 포함하지 않는다.

원본 SPHEREx/TESS/Gaia/WISE/NEOSSat 및 저자 Planet Nine 자료는 각 원출처의 관측/공개자료다. AI 지원 목록 작성과 원본 데이터의 생성 주체를 구분한다. 이미지/영상/음성을 실제 생성하는 경우에만 해당 자산별 표시·서비스 조건·사람 검수를 추가한다.

DEV-001의 외부 소프트웨어/절차 출처와 라이선스 고지는 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)에 기록했다. Astropy 절차스킬의 Scientific Agent Skills 논문은 현재 arXiv v2의 저자/연도/DOI를 직접 확인해 기재했다. 이 인용은 해당 논문의 저자가 이 앱을 검증했다는 뜻이 아니다.

DEV-002중사용자가9개궤도선도추가요청했다. JPL의실제4시각접촉궤도요소와UTC→TDB를검증해닫힌Kepler안내선을계산하고,원출처/표시조건을저장·복원했다. 257점/9개/4시각의회전·타원평면·현재위치수치일관성을별도수식으로확인했으며장기실제궤적정밀도로확대하지않는다. 이추가후검사는Python67·Vitest10·Chrome추가2개를포함한다. 기존관측원본은변경하지않았다.

DEV-003/v0.3.0은 사용자 지시에 따라 기존 완성본을 먼저 `54756ca`로 commit한 후 진행한다. Codex와 분리 에이전트는 원본 JPL 위치/속도의 bounded cubic Hermite 표시 보간·시간 재생/정지·카메라 추적/수동 구분·재생 조건 저장/복원·테스트와 문서 작성을 지원했다. 원래 네 시각의 원본 벡터·SPHEREx 원본/촬영시각은 변경하지 않았다. 계산된 중간 위치는 `display-hermite-v1`으로 구별하고 아홉 궤도선은 11월14일00:00 UTC 기준으로 고정한다. 별도 JPL 중간시각27개 조회의 원응답/SHA·보간 차이 기록을 추가했으며 실측 관측·새 정밀 천체력·전구간 오차보장으로 주장하지 않는다.

DEV-003 최종 확인은 Python100·Vitest18·TSstrict/Vite·Chrome11경로(새재생4포함)다. 원본 보존·Hermite 수식/단위·범위·독립 시각 조회를 검토했고 숨김탭은 headless 이벤트 주입 범위로 한정했다. v0.3 완결 ZIP 전달 기록은 없으며 v0.4 패키지에서 후속 확인한다. 이 작업 당시 새 이미지/영상/음성 생성·AI API/키·원격 push·공개 서버 배포는 없었다. 원어민/팀원 과업 검수·Linux/공개 서버 제한은 유지한다.

DEV-004/v0.4.0에서 Codex와 분리 에이전트는 실제 공개 지도/credit·고리와 PCK 극방향·전체 위성명부/Horizons 원본·왜행성/후보·NASA 공개6470개 카탈로그 취득/reader·API/타입·선택/상세 UI·분류별 GLSL 설명용 표면·테스트·문서 통합을 지원했다. 외부 생성형 이미지 서비스를 사용하거나 관측 원본을 AI로 생성·수정하지 않았다. 모식도의 절차적 지형/구름·방향/위상/24시간 자전은 AI 지원으로 작성한 코드의 설명용 렌더링이며 실제 해상 지도가 아니다.

실제 확인은 확장과학20·외관11·외계행성/API6·프런트27단위/strict빌드,476ID/471지원벡터 전체 독립 읽기검수,별도 TNO센터합성5조회,개별 Chrome 외계행성/지도 로드다. 원본SHA·부모중심·UTC/TDB·추정/누락·반지름미상·위치미지원 사유를 보존한다. 최신 전체 Chrome/Python·v0.4 완결 ZIP/해제실행은 진행 중이며 최종 수치는 작업기록에 확정한다. 실제 천체 측광/운동 검출·새 확률·PS 문헌 기본해 획득·원어민/팀원 검수·Linux/공개서버 완료로 확대하지 않는다.

사용자의 추가 명시 Git 요청에 따라 `git commit -m "MVP입니다"`를 실행한 `5d3a450dfd3fb82946387e03e31b2c01e56a8bb4`를 origin/main에 push하고 원격 SHA를 확인했다. 이는 승인된 저장소 체크포인트이며 공개 앱 배포가 아니다. Notion은 DEV-004 진행 중13:57:21KST에 관련 이슈페이지만 늦게 읽었고, 시작 시점 또는 홈/전체QA 재조회로 주장하지 않는다. 공개 원본의 제작 주체/credit·조건은 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)와 각 manifest에서 유지한다.

DEV-004 완료 확인은14:08:05KST의 같은 이슈페이지 background읽기와 Chrome 지도3경로/외계행성1경로다. 원문31지도HTTP SHA/바이트·GPU·5언어/미지원/기존Pluto근거를 대조했고 정확한검사/증거는작업기록에 남겼다. 홈/전체QA확인·원어민검수나 별도v0.4완결ZIP 전달을 주장하지 않는다.

DEV-005/v0.5.0은 사용자 지정 카이퍼대/은하설정·72h/s·은하선택이동·수십억년 우주역사까지의 범위를 구현한다. Codex와 분리 에이전트는 공식원문/해시를 보존하는 history/galaxy/Kuiper reader·4새API·별도Gyr플레이어/개념적장면·설정/legacy복원·원본실파일재검증·5언어42키·수학/과학/API/브라우저검사·문서를 지원했다. 역사plasma/CMB·별/은하·filament와 은하2400점/회전·카이퍼650점/두께는 AI지원코드의 설명용 렌더링이며 관측으로 복원한 과거·개별실측천체·밀도/개체수·생성형 이미지서비스 출력이 아니다. 실제 관측원본/DATE-AVG는 바꾸지 않았다.

실제확인:history12·galaxy8·catalog API19와 독립NASA/ESA원문/좌표산술검토, 중간전체Python176·Vitest36/strict빌드. 이후작은변경의최종회귀·DEV-005새Chrome5/GPU·완결v0.5ZIP는진행중이므로완료후확정한다. 새이미지/영상/음성생성서비스·AI API/키·공개서버배포·정밀우주동역학/확률계산은없다. 원어민/팀원검수·Linux/공개서버는미검증이다. DEV-005 Notion은14:17:17KST에 같은 관련페이지를늦게중간조회했으며 정시착수조회·홈/전체QA확인으로재사용하지않는다. MVP이후추가최종commit/push는실제수행후기록한다.

DEV-006/FSD0.9는 사용자의 은하별 형태 고증 요청을 v0.5.0에 통합한다. Codex와 분리 에이전트는 NASA/CXC/SIMBAD 공식 원문 취득·원문값/형태 검토·9개 catalog/reader·출처가 있는 경사/팔/막대와 미상값 분리·9개 설명용 렌더러·자동포커스·참고페이지·5언어·검사·문서를 지원했다. 최초4개의 방향/거리/출처는 snapshot으로 보존하고 5개를 추가했다. 현재 공식17원문(HTML16/PDF1)5,947,706B와 manifest80,168B/SHA `1363cee1eb52a93d4e6505d437dd3d2291f16592e166fc33bbaef7864ba0890f`를 추적한다.

실제확인은 과학14검사/Ruff·추가5개좌표단순산술/거리단위·이전4개불변·M31경사77°/M81두팔/LMC막대와한팔의원문·다른경사/모든PA미상·M51동반표시가정이다. M33 flocculent는 사진상 wispy/patchy팔을표현하는렌더스타일이며NASA가명시한분류아님을고지했다. 코드입자/색/광도·크기/회전·먼지/제트폭·미확인각도는관측사진/현재물리pose/별분포가아니다. 공식참고사진은링크로연결하며새사진을앱자산으로복제하거나생성형이미지서비스를사용하지않았다. LMC APOD사진의Ireneusz Nowakcredit/별도권리도보존한다. 실제형태Chrome·최종전체회귀/Git/완결ZIP·Notion최종조회는수행후기록하며사람/원어민·Linux/공개서버제한은그대로다.



DEV-005/006 최종 로컬 검증: Python185 PASS(325.37초, 기존 Starlette 경고1)·Vitest40 PASS·TypeScript strict/Vite·Ruff 통과. 실제 Chrome21개 고유 경로 검사를 완료했다. 최초 전체 실행은19PASS/2실패(9.0분)였고, 동시부하의 Titan cold-parent 대기와 OrbitControls 감쇠 대기를 실제 완료/연속 안정 조건으로 고친 뒤 최종 CJgIAKg2 빌드·재시작한 cold API에서 관련4개를 모두 재검사해 통과했다. 수치 허용오차는 완화하지 않았다. 은하9종 실제 관측사진은 독립 검토용으로만 열었고 앱 자산으로 복제하지 않았다. 최종 ZIP 해제/실제 재시작·같은 근거 복원을 검증했으며 Linux/공개배포·사람 검수는 수행하지 않았다.

## DEV-008 urgent travel checkpoint - 2026-11-14T15:54:38+09:00

User explicitly requested wrap-up within one minute before shutting down. Stop new browser/release work and preserve current source/data/Git.
Implemented v0.6.0: 476 object names in five locales with original designations/IDs retained; separate JPL fitted Kepler simulation -2999-01-01 through 3000-01-01 TDB calendar labels (8 systems + Sun; Earth icon means EMB; unsupported objects omitted); source-backed galaxy-member hierarchy and angular zoom with existing exoplanet-system links; visible header Big Bang/history entry. History remains five published actual observation products and approximate source ages, with no synthetic 35-galaxy growth scene.

Verified: strict TypeScript/Vite index-DSKEjKdg.js; Vitest54 passed; Ruff check/48-file format. Whole pytest:275 passed,1 failed in60.64s. Failure was a test setup calling calendar_jd(-3000), which correctly rejects unsupported input; changed setup to one day before the supported minimum JD. Rerun after that test-only correction is PENDING. New long-term28/catalog19/names4 targeted tests passed previously. DEV007 observed-only Chrome6 passed on its prior build. DEV008 new six browser scenarios were WRITTEN/DISCOVERED, NOT EXECUTED. Do not claim current whole browser verification.

Resume: read AGENTS,SKILLS,FSD,START_HERE,Data_Spec and this checkpoint; preserve raw/data/var/Git. Run whole pytest and new simulation-names/universe-catalog browser scenarios, then existing cosmic/observations. Build complete v0.6 ZIP and verify fresh extraction,health,epsilon/Pluto evidence and real server restart. No public/Linux deployment or F01 remaining/F04/F05/native-language/human QA claimed.

DEV-007/008 최종 통합에서 Codex와 독립 에이전트는 실제 관측5이미지/credit·추정연대 viewer, 데이터 전수 명세,476개 이름의5언어 표시/검색, JPL fitted Kepler 장기모형/TDB달력·검산, 출처가 있는 은하 구성원 계층/방향지도 및 기존 항성계 연결, 연도입력 Enter/blur 적용과 로딩/EMB 표시 수정·검사를 지원했다. 관측 원본·계수·사진은 AI로 생성/변형하지 않았다. 프로젝트 음역·설명용 marker/표면·가상 궤도 위상과 실제 관측/문헌/계산은 구별한다. 재개Python276/영향29·Vitest55·Chrome13고유 경로/strict/Vite/Ruff를 확인했고 build별범위·실패/수정·자료 hash는 작업기록에 연결한다. 이미지/영상/음성 생성서비스·새AI키/API·공개서버 배포·새확률/발견 판정은 수행하지 않았다. 원어민/팀원 과업 검수·Linux/공개서버는 미검증이다.

## DEV-009 실제 확인 천체·외관과 시간 조작 통합

Codex와 분리 에이전트는 최신의 실존/논문확인 대상만이라는 지시에 따라 기존6470개 NASA확인행성의 직접 선택,4862개 실제모항성 카탈로그 방향표식, 지구5언어 표시명과 EMB 계산참조의 분리, 외부은하 후보2/집단추론3을 확인목록에서 제외한 문헌검토, 실제 외계행성 공개 처리사진3개와 credit/권리/미분해표면 안내, 한 시간입력의 자료자동선택 및 설정진입 개선을 지원한다. 앞서 잠시 허용한 가상 외부은하 행성계는 후속 지시로 취소했고 활성 객체·지도·장면으로 추가하지 않았다. 임의1400배경별 생성은 실제 카탈로그 모항성방향으로 교체했으며 거리/밝기·현재/고대 정밀좌표를 생성한 것으로 주장하지 않는다.

기관 공개 JPEG3개1,270,679B는 원바이트 그대로 보존한 직접촬영 처리제품이다. 관측사진·원천문서·JPL계수·기존102관측원본을 AI로 생성/수정하지 않았다. 작성 사실추출JSON/코드/번역과 upstream 원문·실제사진의 제작주체를 구별한다. 전체 upstream페이지/논문은 로컬감사 자료로 보존하고 재배포 권한을 가정하지 않아 새 서버ZIP에서 제외한다. 기존 분류별GLSL 표면·카메라구/색·크기/위상은 AI지원코드의 설명용표현이며 실제 외계행성 지형/해상표면이 아니다. 실제사진에도 표면분해·자연색/현재 위치라고 표기하지 않는다.

새 source reader12+15검사와 사진3개 직접 시각검토, catalogSky/sceneMath helper15검사는 변경시점에 완료했다. 새 전체Python/Vitest·production build·API/Chrome/완결v0.7.0 ZIP/재시작 검증은 아직 확정하지 않았다. 시간통합은 기존72시간UTC표본과−2999~3000TDB달력 근사의 지원범위·출처를 보존해 진행하며 모든날짜의 정밀천체력/수십억년 동역학을 생성하지 않는다. 최종 구현/실행 증거와 실패/교정은 FSD/DEV-009 작업기록 및 실제 외부검증JSON으로 확정한다. 이미지/영상/음성 생성서비스·새AI키/API·새확률/발견판정·공개서버배포는 수행하지 않았다. 사람/원어민 검수·Linux/공개서버는 미검증이다.

후속 세드나 등8소천체외관 요청에서는 Codex와 분리 에이전트가 실제논문/기관원문의정성색·알베도/삼축형상모형·서로다른크기정의/고리근거의취득/사실추출과reader/API·독립조회/병합·코드표현/검사를 지원한다. Ceres는기존지도보존용metadata이고나머지7개에해상지형을생성하지않는다. 무지도고체천체의임의크레이터를제거하고정성색을참고한RGB선택·부피보존축비·문헌중심거리의1px고리안내선으로구분한다. RGB/조명·미측정몸체자세/회전위상·고리색/폭·정적원문pole의표시변환은관측복원/현재정밀자세가아니다. 기존31지도·천체력/관측원본은불변이고upstream전체원문은로컬감사전용/ZIP제외다. 새 optional source SHA/time_preference의저장/복원과잘못된수동모드조합검증도추가한다.

앞선 DRyIMrA 빌드에서는19+2=21개고유Chrome경로가통과했지만직접화면검토에서gear–새세션겹침과별출처note가시간선에가려지는2문제를발견했다. 버튼을48px상시아이콘/접근성이름으로, 별출처note를검색아래로교정하며새소천체자료/최종빌드와함께후속영향QA를실행한다. 기존21PASS를교정뒤새빌드/추가8프로필의최종검증으로확대하지않는다. 새자료동결·전수Data_Spec·전체/영향검사·브라우저·ZIP결과는실제실행뒤확정한다. 잠정21manifest/1720항목snapshot은추가소천체자료전기록이다.

## DEV-010 팀회의 승인 핵심 · 행성3요건/최소질량

사용자가팀회의의공동결정을공유해행성3요건과최소청소질량을핵심으로지정했다. Codex와분리에이전트는기존17천체(행성8/공식왜소행성5/후보4)의IAU분류근거·문헌질량/궤도요소·Margot2015/2024연구모형을연결하는reader/API·선택즉시3상태카드·확장대화상자/궤도SVG·5언어·테스트/문서를지원했다. 우선순위변경은이명시적공동결정을따르며기존실제관측·품질·근거저장/복원을보호한다. 새로운임의행성·관측·물리량을생성하지않았다.

공식분류의형태요건은새정수압평형측정이아니며후보4개는표시구체/크기로충족시키지않는다. 최소질량은태양1M☉·10Gyr·C=2√3의 `0.001239(a/au)^(9/8) M⊕` 연구모형이고IAU공식수치규칙이아니다. Π는채택본체질량/m_clear이며807반올림상수와혼합하지않는다. 확률/청소율/새공식분류·실제청소역사의N체검증을수행한것이아니다. Sedna의약1.4803626M⊕는고이심률실궤도가아닌동일긴반지름원형참고값이고본체질량/Π는채택자료미확보로null이다. ‘채택자료미확보’를전체논문에서전혀측정되지않았다는주장으로확대하지않는다. 본체질량11/미확보6과계질량보조4를분리한다.

정본manifest168,453B/SHA `e6124a457dcbba0907d9f4d0f8fbd777b7cac1963b4b2e49cb5fb6322e8753d8`는기존두JPLmanifest의SHA를참조한다. facts19JSON+19sidecar77,558B는프로젝트작성사실추출/출처metadata이고upstream19+19sidecar2,558,555B는로컬감사전용/ZIP제외다. 기존JPL물리HTML58,244B는원바이트재사용했으며새관측/새취득으로세지않는다. 원관측/계수/논문은AI가생성/변형한자료가아니고코드로계산한모형값·SVG/번역과구별한다. `planet_criteria_manifest_sha256`를근거에저장하고해시/reader불일치는재계산필요로처리하며이전payload는호환한다.

현재전체Python372PASS(76.33초)·Vitest64PASS(1.20초)·strict/Vite Bp6N6jEm·Ruff57파일을확인했다. source/패널의미문구추가교정과좁은재검사·새16개브라우저경로·최종ZIP해제/실제서버재시작은아직확정전이며이전단계의성공을새최종변경의검증으로바꾸지않는다. Data_Spec최종동결은1,566,507B/2648줄/SHA `f26ba122e0bac9fdfdabbe6881bd7686a7692582f62b0efbd376606e1f7e1b9e`,23정본/1846전수항목이며독립전체SHA·원102관측/참조보존검사에불일치0이다. 사람이수행한과업/원어민검수나모든논문의물리정확도·Linux/공개서버배포·대회제출완료로확대하지않는다. 최종실행결과는FSD/작업기록/외부검증JSON을따른다.

DEV-010 후속 확정: Bp6N6jEm의16개Chrome영향경로는206.567초에통과했고, 본체값미확보/계질량문구와locale숫자교정뒤lsFtNhUt의5언어1경로도별도로통과했다(6.568초). 직접화면도당시범위에서대조했다. 소스는 `bb386f38b4a5e971041befc9fe18c5a5be626858`에보존하고원격저장을확인했다. 이는 v0.7 소스체크포인트이며새완결ZIP이나공개서버배포가아니다. 이전21/9경로·이16/1경로의검사를후속DEV-011의검증으로재사용하지않는다.

## DEV-011 v0.8.0 밀도 가정·관측자/블랙홀 확장

Codex와분리에이전트는밀도/반지름가정의질량실험reader·정본/근거해시·GET/POST API·6대상/6비교위성UI·source-corner/직접입력분리·5언어·검사를지원한다. `M=ρ(4π/3)R³`의계산결과는가정값이며원실측/문헌본체질량/계질량·공식3요건·IAU분류를바꾸지않는다. JPL의6위성bulk밀도는GM/부피등가반지름에서유도된출처값이며다른천체의실측밀도나조성같음의증거가아니다. 크기/밀도원오차를입력경계로쓴범위는신뢰구간/확률/통계적prior가아니다. 직접입력ρ실험과고정6위성전체36비교를분리하고조건부대상0건을우주부재/확률0%로표시하지않는다.

질량정본130,355B/SHA `7668d7caf418aaae363acf41fa50e9a69795ff1e3c99a178534a83552fc82112`와source2facts/sidecar9,607B는동결했고독립Decimal36사례검산을통과했다. upstream1,457,981B는로컬감사/배포제외다. 전역의마지막질량가정을optional입력/원해시로저장·검증하며실제εB/Pluto관측세션과독립으로보존한다. 새source해시/필수입력불일치는재계산필요다. 원관측·계수·source사진은AI가생성/변형한것이아니며프로젝트작성facts·수식계산·코드/번역과제작주체를구분한다.

제한된관측자SR·정적Schwarzschild·고정FLRW/거리–z·2Dnull경로와실제source블랙홀목록/관측사진연결은현재통합중이다. 명시적카메라관측자가정·source관측z/음의z·모형z/β/중력인자·λ비/nm/표시색·미상질량을분리하며압축팬을실제측정속도/비행경로로변환했다고주장하지않는다. 실제사진을새시점사진으로생성하지않고Kerr/강착복사전달·내부/광원뿔/세계선·모든물리법칙완료를주장하지않는다. sourceprovider/논문host/원관측기여기관을분리해중국자료제외요청을추적하고미확인기여를비중국보증으로쓰거나저자국적을추정하지않는다.

물리/BH정본·사진권리/개수/전체SHA, v0.8전체Python/프런트·실제브라우저/근거복원·최종Data_Spec/완결ZIP/재시작은실제동결/실행후확정한다. 현재단계에서새이미지/영상/음성생성서비스·새AI API/키·공개서버/대회제출·사람/원어민검수를수행한것으로기록하지않는다.

DEV-011 동결/통합 후속: `black_holes.json`106,361B/SHA `4818701162f76fe3bc97383c1b0d2cd8d750b95466d15c95f046b229126cbbbd`와 `observer_physics.json`271,921B/SHA `61ca1cf4d24dfe337adb905070328d525ac982d4857db335906a7dbac1bea105`를확정했다. BH11/채택질량9/null2·EHT2, z14행/채택10/null4·거리표2049행이다. 고유53프로젝트작성factsJSON46,880B+sidecar42,665B는런타임입력이고새37upstream16,091,431B+sidecar21,462B는로컬감사/ZIP제외이며기존16원문은재참조했다. 원관측/사진은AI가만든자료가아니다. EHT2JPEG103,617B/sidecar1,363B는2017전파강도/그림자처리재구성으로EHT Collaboration·ESO CC-BY4.0/공식페이지를유지하고실제표면·가시광/새카메라사진으로바꾸지않았다.

Codex와분리에이전트는실제소스조회/문헌근거·provider/reference/미상기여구분,SR/정적GR/고정FLRW·유한정적관측자의2Dnull경로/수치검사,UI/App/API·5언어·optional관측자가정/해시·품질우선복원/원관측보존을지원했다. inverse18ln(1+r/au)카메라좌표는명시적가정스냅샷이며측정속도/여행/빛원뿔이아니다. Tcmb0=0은방사성분비활성계산설정이고0K우주/fullPlanck18을뜻하지않는다. NED원측정기관은전수미확인이며NASA/IPAC배포나논문호스트로비중국원관측/저자국적을보증하지않는다.

검사범위: 질량순수39/API8·relativity36/관측자API27(9.75초)·Decimal36·Vitest70(최신1.76초),전체Python483(76.49초,기존Starlette경고1)/Ruff63이통과했다. TyRAtsbd질량5고유Chrome은초회4와nullable JSONnull생략기대교정후마지막1경로재검으로완료했다. 이후DbNwNokf관측자검사는5PASS/1QA source-ready타이밍조건교정이었으며직접화면의BH제목검색/소개겹침을발견해App표시조건을교정했다. CNYGnNg7에서 관측자6+질량5+기존관측2의13/13 Chrome을142.460초에통과했다(시작2026-11-14T11:17:28.357Z,skip/flaky/unexpected/error0; `var/qa/dev011-final-browser-results.json`). 새브라우저문맥에서 R=7.5Rs·β=.001·λ=600nm·M87/두물리SHA·카메라 및 실제S01/S02·29픽셀품질 복원을확인했다. 이후직접시각검토에서관측자닫기/블랙홀버튼16px겹침을발견해CSS위간격24→50px를교정했다. 최종 BfRDPmgL/DZOoVrJ5 strict/Vite 및전역/언어후속2/2 Chrome(9.647초,시작2026-11-14T11:20:48.806Z)·bounding비겹침/직접사진검토를통과했다(`var/qa/dev011-observer-review.json`). 13회귀와마지막간격교정2검사의빌드를구분한다. 카메라추가100ms throttle제거와원UniverseScene150ms/end emit보존은프런트교정이며source/자료·수식은바꾸지않았다. 정확ZIP/실제서버재시작 복원도 통과했으며 사후 기록 docs/releases/v0.8.0.json으로 확인한다.

최종Data_Spec은1,791,636B/3061줄/SHA `e848ee7025f315a6cfa127f67b3120a2c7ef2f5bee2d3515e26bbd7a1c3aba33`·26정본/2041전수항목(data1987+public53+helper1)/1,211,512,385B다. 정본참조1079/sidecar포함1084·내장32·복제53및독립전체SHA/바이트/문서경로set·최초102원본987,987,584B보존검사에서불일치0이다. 브라우저13회귀/마지막간격교정2검사의완료범위는위기록을따른다. 정확v0.8ZIP해제·실제서버재시작은 통과했고 Linux/공개서버·사람/원어민검수와모든물리법칙/Kerr/강착/내부/세계선복원완료는미확정/미구현범위대로남긴다.

DEV-011 최종 완결 ZIP의2095파일/484956608B·원본SHA/정적빌드와 실제 API/worker 재시작 후 εB/Pluto 근거/새 가정 복원을20:24:20KST에 확인했다. source45375fc clean tree, 상세 [v0.8.0 검증 기록](releases/v0.8.0.json). 사후 검증문서는 불변 ZIP 밖에 추가하며 Linux/공개 서비스·사람/원어민 검수는 수행하지 않았다.


DEV-012 / v0.9.0: 사용자가Node.js전용호스팅을확인해Codex와분리에이전트가app.js/CommonJS·NodebuiltinHTTP/fs/worker_threads1개·원자적파일상태/배타잠금·기존UI API/실제자료snapshot exporter·관측캐시고지·근거schema/해시/복원을구현하고검토했다. 운영중Python실행/프록시는없고기존PythonAPI/Astropy는빌드/참조검산으로보존한다. 새외부Node의존성·AI API/키·이미지/영상/음성생성서비스·새프로젝트라이선스는추가하지않았다.

실제FITS/보정에서빌드중새로계산한두쌍/양순서4비교와실제reader99snapshot을출처해시와묶었다. 103JSON66,642,151B는파생물이며독립관측수나새관측사진이아니다. 정본473,765B/SHA `9dfe12f530da0e6993ced98cc1a94932eb8aef161b6ca68e1a5cb081df44a2af`는1859source/1564필수/295선택을추적한다. Node는검증된캐시를재사용하며없는원자료/결과를AI/샘플로채우지않는다. Pythonrawfloat·cmp ID/내용SHA·원S01/S02/S12/S14날짜/품질/판단·3새상태/카메라를보존한다.

AI지원은Node일반질량/Hermite/Kepler식이식·OpenAPI입력검증·동결자료/경로/8MB·취소/재시작·정적서빙,채택질량null의default984kg/m³근사가정과축약/확장입력공유,위성선택시mesh/geometry/groupscale을키우지않고카메라만이동하는교정·5언어/메타데이터갱신도포함한다. 추정질량은실측본체질량이나IAU판정을덮지않고UTC/TDB매듭선형대응은표시근사다. 원사진/원본/계수는AI로생성·변형하지않았다.

현재Node14PASS21.90초·Python없는PATH의독립HTTP/과학67PASS19.13초·Node서버대상기존release_smoke/실관측29/32·31지도/카탈로그·근거복원,strict/Vite DLJsfpSc·Vitest71PASS1.62초를확인했다. 최초Node통합검사의ISO24시500을422로교정하고테스트필드명2건을바로잡아재검했다. 전체Python550PASS113.36초(기존Starlette경고1)와최종Data_Spec동결도확인했다. Node8081 Chrome23/정확v0.9ZIP해제·실제재시작은아직확정전이다. 이전v0.8ZIP/소스b6b4545와검증기록은불변이력으로보존하며Linux/공개서비스·사람/원어민검수·대회제출완료로확대하지않는다.


최종 DEV-012 [Data_Spec.md](../Data_Spec.md)는 **2,026,860B/3422줄**, SHA256 `e441b64d2d22dfda73342cb5465825b9e74fc7ca8a21ca44b0565337cfe796c5`다. 정본27개·물리2146항목(data2092+public53+명시helper1),총1,279,102,066B이며부록A102+B2044·정본참조1932/sidecar포함1937·내장응답32·정적복제53을기록한다. 독립전체SHA/바이트/경로·참조/중복/복제검사불일치0,최초102파일987,987,584B보존불일치0이다. Node source1859중필수1564개531,456,149B와선택295개를구분하며로컬감사전용 `/upstream/` 사본필수0·보류96개선택을유지한다. 기존reader에필요한NASA/JPL전체원응답은각source의필수표시를따른다. 파일수/순서별파생수는독립관측수·물리정확도/사람검수·실제배포성공수가아니다.

DEV-012 전체Python 첫 실행은483PASS/67공유fixture setup ERROR(약172초)였다. Node cold-source 준비 확인의2초 health probe가TimeoutError를냈는데검사fixture가URLError만처리해독립67경로가시작되지않았다. 제품수치/모형실패와구분하고fixture의TimeoutError처리를추가한뒤전체550PASS113.36초(기존Starlette경고1)로확인했다. 별도로완료한Python없는PATH의독립67PASS19.13초·Node14PASS와이번전체실행의범위를구분한다.


DEV-012 검증 최적화: 초기 Node UI 부분검사는 완료19개 중15 PASS/4 응답·전체시간 한도 실패였고20번째 중단/3미실행으로 보존했다. 수치·분류·원질량·geometry의 실패 증거는 없었으나, job/result/save/import가 약700MB의 필수/파생/서빙 복제 원바이트를 반복해서 읽어 지연됐다. `sha256-stat-fingerprint-v1`은 최초 전체SHA 검증 후 매transaction 모든 필수 실경로와 dev/ino/size/mtimeNs/ctimeNs를 검사한다. 같은 식별/메타이면 이미 검증한digest를 재사용하고 변경되면 사용 전 원바이트 SHA를 다시 계산한다. 동시에 이미 대기하는 요청만 검증pass를 공유하며 시간TTL은 없다. 원 비교raw SHA는 매읽기 확인하고 시작/CLI/정확ZIP의 full audit는 유지한다. 입력은 읽기전용·불변 운영 계약이며 관리자가 파일식별과모든시각까지 위조하는 상황의 보증으로 확대하지 않는다. `node app.js --verify-sources`는 서버 시작 대신 필수자료 전체SHA 감사를 실행한다.

Node14 회귀는 같은크기+mtime복원변조/누락/강재fullaudit/동시5요청1검증을 포함해9.701초에통과했다. root 재검 Node14 PASS9.515초·Python 없는 PATH 실제 HTTP/과학67 PASS14.12초를 확인했고 source key의 prototype 상속을 실제 천체로 허용하지 않도록 Object.hasOwn 검사를 보강한 뒤 HTTP6후속 PASS10.265초를 확인했다. 실제 warm Windows/이미 SHA확인된 Node8081에서12GET동시480ms·job185ms·manifest173ms·save332ms·import490ms,합계1.836초를 관찰했다(`var/qa/dev012-node-performance.json`). 초기/다른호스트 성능 보장이 아니다. 수치/결과ID·동결103JSON/원본해시는 변경하지 않았고 최종 Chrome/ZIP 검증은 별도로 확정한다.


DEV-012 최종 브라우저 확정: Node8081/최종 client `index-DLJsfpSc.js`·runtime manifest9dfe…에서23고유경로를 확인했다. 23개 batch는22 PASS/1복합workflow 전체60초 timeout(374.878초)이었고 개별15초 기대값 실패는0이다. 5언어/깜빡임/PNG·JSON·CSV/새문맥복원/공식4대상왕복을한case로묶은검사만전체120초로명시해별도후속1 PASS68.454초(2026-11-14T12:35:11.024Z시작)를확인했다. 과학기대값·단계별15초·제품/Node/source를변경하지않았다. 23개가같은batch모두통과했다고주장하지않고22+1후속으로기록한다. 초기최적화전부분실행15PASS/4지연실패와도구분한다. 정본은 var/qa/dev012-node-final-browser-results.json,dev012-node-observation-followup.json과review보고서다.

Moon의표시R0.20874/물리R1737.4km·group/mesh scale1은선택전후유지됐고camera eye-target은3.089216→0.923769표시단위로접근했다. Phobos의표시R0.036108/물리R11.08km도유지됐고camera거리는0.159789였다. bounding sphere≤1.5e-9차이는12→64 subdivision Float32정점반올림이며확대scale가아니다. 실측첨부 var/qa/dev012-moon-geometry-evidence.json에원수치를보존했다. 질량approx/원mass null/IAU분류·늦은결과·실제촬영시각/품질·관측자/근거/복원·Node사전계산5언어고지도검사했다. 정확v0.9 ZIP의실제Node실행/재시작검증은최종사후기록으로확정한다.


### DEV-012 최종 완결 ZIP 검증 확정 · 2026-11-14 21:40:02 KST

`NASA_SPACE_APPS_CHALLENGE_v0.9.0_20261114_213804KST.zip`는 **495916482B/2223파일**, SHA256 **`fd3c694f354bac02ba9728dae521b13d7b41250870bc3b050ee8629d6b467db7`**이다. source `7b2dbf7c4e5ee6798fd9c56230a7858ae8dde3e4`의 clean tree, 최종 DLJsfpSc 프런트와 Node 전용 `app.js`/검증된103JSON으로 생성했다. 추적 manifest/source sidecar33개의 Git index와 실제 동결바이트도 전부 일치했다.

정확한 ZIP을 새 `tmp/node-release-verify-r4s83m6d/extracted`에 풀어2222개 release manifest 항목의경로/바이트/SHA와필수원본·캐시를확인했다. Node22.17 절대경로와 `app.js`만서버로실행했고 PATH에서Python실행파일을찾을수없게했다. 개발검증기/HTTP클라이언트의Python과서버의Node를구분한다. 실제두관측·29/32품질·지도/사진·카탈로그·새가정을확인하고실제Node프로세스와worker thread를종료/재시작한뒤 εB/Pluto및추가근거의같은ID·판단·카메라·밀도/관측자설정·export원바이트/import복원을통과했다. 정확완료시각 `2026-11-14T12:40:02.175944+00:00`이다. 상세는 `docs/releases/v0.9.0.json`과ZIP밖동명verification/checksum JSON을따른다. 이사후문서는검증한불변ZIP에추가하지않는다. 기존v0.8 ZIP/원본/Git이력도보존했다. Linux/Docker·공개서비스·사람/원어민검수는수행하지않았다.


DEV-015–016 / v0.11.0: Codex와 분리 에이전트가 출처 표면의 기본 로딩·자료층·과거 은하·실제 JPL 혜성4창·GWGC53,162개 변환/검색/선택·Newton/CN/Yee/Euler 독립 실험·실제 SXS h22 추출/환산/재생·상태복원/자동검사와 문서를 작성했다. 관측 원본/사진/음성을 생성하거나 원본을 변경하지 않았다. h5py는 빌드에서만 사용한다. 실제 원문/숫자/해시·독립해/보존·브라우저 결과와 최종 ZIP은 worklog/Data_Spec/동명 외부 검증 JSON을 따른다. 모든 물리법칙·runtime full GR·관측자 strain·미관측 은하 행성을 구현했다고 주장하지 않는다. 사람/원어민검수와 공개 프록시 복구는 미확인이다.


DEV-016 최종 자동검사: 2026-11-15 00:05:23 KST 동결 검증: 107 JSON/76348584B, source1885개·필수1586개/623292613B·선택299개. manifest480792B/SHA`aa8895a820e4356747570c381d8af1c317f90e60e7598abda89e54916c01b204`. 실제 FITS4비교의 기존 result ID/내용SHA를 보존했다. Python전체 608 passed, 1 warning in 106.21s (0:01:46); Vitest154PASS·strictTS·Ruff전체 PASS, Node전체22PASS. Production ZVxA7rKp Chrome42PASS/417.029초(새 PDE/NR·Atlas·기존관측/복원), 이후 T=-3 렌즈형 경계1곳 교정의 최종 CumtP9k6 빌드 Atlas Chrome3PASS/34.552초를 구분한다. 로컬기기/자동검사이며 사람·원어민·Linux/공개호스팅 검증으로 확대하지 않는다.


RELEASE-011 · v0.11.0 완결 ZIP 검증 확정: `NASA_SPACE_APPS_CHALLENGE_v0.11.0_20261115_001122KST.zip` / 580,411,280B / 2,320파일 / SHA256 `db7468317fa4ab1d3c0a8a616815d12ca22bb15bd1486f6848b5a8d2c1715d69`. clean source `aa3b2c44cba9125e7832f535ce8232c4b20ab8e9`에서 패키징했다. 실제 ZIP을 새 폴더에 풀어 2,319 manifest 항목·필수1,586 source·107생성JSON을 대조했고, Node22.17.0만 PATH에 둔 app.js 실행/ready·ε Indi B/Pluto 실원본/품질·근거 내보내기/가져오기·실제 프로세스 재시작 후 복원을 PASS했다. 정확 ZIP은 기존LAN을 유지하기 위해 PORT8011로 검사했고 기본3002는 현재 Node22 child회귀에서 별도로 확인했다. 새GWGC53,162·SXS13,869·혜성4/489 TDB표본 HTTP검사도 PASS했다. source297이 아니라 최종 source1885/필수1586/선택299이며 ZIP에는 선택32개가 있고267개는 보류/감사본으로 제외됐다. 현재 LAN CumtP9k6와 기존var/node는 계속 실행/보존한다. 공개호스팅/Linux/모든물리법칙·runtimefullGR/결합 계산은 완료로 올리지 않는다. 최종 공개 기록은 `docs/releases/v0.11.0.json`, 정확검증은 동명 외부 `.verification.json`이다. 이 사후문서 기록은 이미 검증한 ZIP 바이트를 수정하지 않는다.


## RELEASE-012 · 실제 EC2·HTTPS 배포 검증 완료

2026-11-15 KST. 정확한 `NASA_SPACE_APPS_CHALLENGE_v0.12.0_20261115_034911KST.zip`는489,039,770B/1,540파일, SHA256 `c251031cc7df5526b038425ba6d672d96cbbe01e0123b2df55c09fc5332ed067`다. Windows와Ubuntu24.04.2WSL/ext4에각각새로풀어1,539manifest항목/필수1,165source·39JSON/원comparison4개SHA를검증했고Node24.22.3단독서버의실제재시작·εB/Pluto/P9근거복원을통과했다.

사용자EC2 Ubuntu24.04.5/x86_64/4vCPU16GB/50GiB에같은ZIP을전송해SHA를확인하고전용planetx/systemd·nginx80/443→loopback3002·shared/node영속상태로배포했다. 실제systemd재시작PID2871→3077후기존근거3개export바이트SHA동일/같은IDimport복원을통과했다. 공개실관측/31지도·P9HTTP검사와정식주소 `https://nasaspaceappschallenge.marulee.dev/`의일반Chrome157(우회옵션없음)3흐름을통과했다. TLS1.3·정확호스트/기본CA검증·HTTP→HTTPS·DNS3.37.17.247,인증서2027-02-12만료·자동갱신timer/실제dry-run성공을확인했다. 초기HTTP-IP브라우저검사에서만HTTPS자동업그레이드를끈사례는정식HTTPS검증과분리한다.

최종기록은`docs/releases/v0.12.0.json`,`docs/qa/dev018_ec2_https_verification.json`과ZIP옆외부Windows/Linux/EC2검증JSON이다. 이사후기록은검증된불변ZIP을고치지않는다. 이전v0.11ZIP/Git/원자료/근거를보존했다. 이번배포에Git새commit/push·심사제출은수행하지않았다. 상호N체/모든물리법칙·미발견전수·새이동검출/존재확률·원어민검수를완료로올리지않는다. 첫EC2배포라구버전으로의실제rollback드릴은수행하지않았고복구계약/안내를유지한다.


DEV-019: Codex가 실제TNO 개별 선택/겹침 목록,5언어 UI 줄바꿈, 장기2체 외삽의 경고 상태와 회귀 검사를 수정했다. 독립 에이전트 검토와 실제 Chrome/정확 ZIP 검증을 연결한다. 새 관측/발견 확률/과거 정밀 궤도를 생성했다고 주장하지 않는다.

## DEV-020 · 사실 요약·명시 밀도가정·OPAL·표시호환

Codex와분리 에이전트는 사용자R029/R030/R031에따라 원소/식별사실의 선택객체요약, 정확SPK/지정명연결·PDS오연결차단, 일반TNO의3요건근거·궤도/질량미산출안내,6대상선택적밀도가정,OPAL공식RGB의표준라이브러리무손실형식변환·픽셀대조,표시정본의dependency-only동등성·원근거보존을코드/문구/5언어/검사/문서로지원했다. R030필터는사용자가확인한공식8행성/제9행성문헌가설·영역의별도경로이며knownTNO를P9자체/새행성발견으로분류하지않는다.

8,341개설명은기존41열snapshot과별도6열exactSPKidentity의사실조합(`jpl-tno-factual-description-v1`)이다. 기관장문8천개·생성관측·발견일/표면·새물리량을만든것이아니다. nativeMCP7개순차호출의FO563식별/PDS한계와원envelopeSHA는감사원장에보존했다. 잘못연결된C/2015G2/description=none/관리변경이력을천체서술로채택하지않았다. 신규Node필수identity응답+sidecar508,459B외의18감사파일은실행비필수다. 새20파일은원출처/권리·해시를보존한소형공개감사부록으로ZIP포함계약을적용하며새관측/정량입력으로승격하지않는다. 최종포함검증은진행중이다. 기존원관측·JPL41열/8,341원소·문헌17대상본체/계질량은그대로다.

Tethys984kg/m³최초자동대입을제거하고밀도/비교위성은명시선택으로만가정한다. 비교위성밀도는대상실측/공식분류의근거가아니며모든genericTNO의임의질량을생성하지않는다. 기존저장가정은동일대상·출처/입력으로복원한다. OPAL2025공식TIF두개는불변이고같은721×361 RGB8표본을PNG로재부호화했다. 색변환/리사이즈/보간/결측채움/새독립관측0이며출판팀의원대비강조·limb/접합보정과원결측은유지한다. Pillow13.0.0은독립픽셀검증용선택개발도구이고Node실행/표준변환에필요없다. 실제사진을이미지생성서비스로만들거나새카메라/시각관측으로바꾸지않았다.

소천체/질량정본의최상위dependencies만현재appearance연결로변경했고나머지모든과학payload·생성일/중첩값의deep-canonical동등성을검증했다. 원044329ZIP member두개를불변history에보존하고정확두hash쌍/원바이트·payloadSHA를호환원장에기록했다. AI지원코드/번역·source사실추출·기관원관측의제작주체는구분한다. 원근거봉투/ID/판단·비교바이트는유지하고활성표시참조만명시이행한다. 일반적인source/과학값불일치를허용하지않는다.

현재문서는각신규파일의실바이트/SHA·역할및해당순수helper검사의범위만확인했다. 최종통합/production브라우저/새export·정확ZIP/공개EC2배포·재시작은진행중이며별도실행기록으로확정한다. 일본어/번체/프랑스어원어민검수·사람과업연구·모든물리법칙/상호N체·새관측검출/존재확률·대회최종제출완료를주장하지않는다. 이미지/영상/음성생성서비스·새AI키/API는사용하지않았다. 전체실파일정본과권리는Data_Spec DEV-020절·THIRD_PARTY_NOTICES를따른다.

DEV-020 재현성 한계: Linux fresh FITS 재계산은 같은 과학 상태·품질픽셀을 냈지만 예측x 약7.8×10⁻¹²px/roundtrip 진단 약2.4×10⁻¹²px의 부동소수점 마지막자리 차이로 정본hash/ID가 달랐다. 이는 별도 수치비교로 기록하며 전플랫폼 bitwise 동일성을 주장하지 않는다. 새 단일 Windows export가 기존 네 comparison ID/정본SHA를 그대로 재현했으므로 최종 Node는 이 원정본 캐시로 기존 운영 근거 ID/바이트를 보존한다. AI가 원관측을 수정하거나 Linux 재계산값을 원봉투에 덮어쓴 것이 아니다. 최종릴리스/공개재시작 검증은 별도 진행 중이다.


DEV-021: Codex 지원으로 P9 표본 dialog/단위·명시질량 계산, 저장 JPL r/v 기반 위성2체 근사, 원 RGB 표시 보조와 QA·문서·디렉터리 배포 검증 코드를 작성/검토했다. AI로 관측·천체/물리량·표면 지형·후보 존재확률을 생성하지 않았다. 실제 검사는 docs/qa/dev021_local_verification.json과 릴리스 사후기록을 따른다.


DEV-022~024: Codex와 분리 에이전트가 NASA 원VTAD 모델의 embedded PNG 원바이트 추출/별도설명용외관, 태양방향 조명/밤보조광0, P9 원행→자동경로→실제TNO a/e/i 비교 및연속선택패널, 혼합거리척도제거와저장좌표계메타데이터, 일괄가정을명시한질량어림값 helper/문구/5언어/검사를지원한다. 0.15.0의정식HTTPS/재시작/기존근거보존은외부릴리스정본에서확인했으며0.15.1의새수정은아직통합검증중이다. NASA원사진/관측·JPL원소/반지름/절대등급/공식분류는AI생성/수정하지않았다. rho1000kg/m³·미확보albedo0.1은사용자가요청한계산을위한공개프로젝트가정이며개별천체실측이나통계추정으로주장하지않는다. 미확보입력/신뢰구간·실영상점광원탐색·새발견/존재확률·전물리구현을완료로부르지않는다. 상세FSD28/Data_Spec·사후릴리스검증정본을따른다.


DEV-024 후속: 공개 느린응답에서Pluto선택의선형보기의도누락을발견해실제응답gate회귀로교정했고두공개후속·실제서비스재시작/기존3근거원봉투복원을확인했다. 정본 docs/releases/v0.15.1.json. DEV-025의MCP/등록reader/실사진/디자인분석에AI가코드·문구·검사를지원하되Gemini예시점수·합성FITS·예측의실측승격은채택하지않는다. 데이터는원본/문헌출처와별도모형표시를따른다.


## DEV-025 · 등록형 실제 관측·디자인·공개 문서

Codex와 독립 에이전트가 실제 SPHEREx 노출 등록/QR2·현대 FITS reader·관측자 예측/품질·저장복원, ε Indi Ba/Bb 별도 원사진·문헌 상세, 사용자 제공 Gemini 저장본의 화면 구성을 참고한 P9 TOP5 카드, 실제 원위치의 줌아웃 표식과 사용자 지정 크레딧·전체 데이터 PDF를 구현/검토했다. Gemini 예시의 합성FITS/가짜 점수/측정 주장은 채택하지 않았다. PDF는 Markdown 전체의 조판이며 원문 byte 동일 첨부·출처 링크·서체/권리/해시를 보존한다. 사용자가 승인한 제작자/학교/감사 표기와 공개 저장소 링크를 사용했고 GitHub ID 대응표를 추가하지 않는다. 번역은 AI 지원이며 원어민 검수 완료를 주장하지 않는다. 최종 실행·브라우저·AWS 배포 상태는 FSD29와 사후 릴리스 기록을 따른다.


DEV-025 최종검증: 단위/브라우저 실패와 조치, 정확 디렉터리/정식 HTTPS/실제 재시작/구판 근거 원바이트 보존은 docs/qa/dev025_local_verification.json과 docs/releases/v0.16.0.json에 기록했다. AI는 원관측을 생성·수정하거나 새 검출/운동/존재확률을 확정하지 않았다. 공개검사 후 두 테스트의 응답 본문 대기·부동소수점 비교만 교정했으며 검증한 배포 디렉터리는 불변이다.
