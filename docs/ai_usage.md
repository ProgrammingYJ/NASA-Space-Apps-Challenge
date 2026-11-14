# AI/SI 지원 사용 기록

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
