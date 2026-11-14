# Planet X and SPHEREx — 기능·개발 명세서

문서 버전 `FSD-0.10` · 갱신일 2026-11-14 KST · 현재 수정 릴리스 준비 `v0.5.1` · 기준: v1.7 통합 계획서와 최신 사용자 지시·D-Day 공식 안내.

**이 파일은 프로젝트의 기능·화면·계산·API·데이터·실행·검사·배포 명세를 통합 관리하는 문서다.** 기능이나 계약을 바꾸는 작업에서는 관련 절과 아래 구현 현황을 함께 갱신한다. 규칙은 [AGENTS.md](./AGENTS.md), 실제 작업 증거는 [작업 기록](./docs/worklog.md), 적용 스킬은 [SKILLS.md](./SKILLS.md)에서 연결한다. 기능·개발 명세는 이 파일에서 유지한다. 사용자의 명시적 요청으로 만든 [Data_Spec.md](./Data_Spec.md)는 실제 사용/확보/이전 데이터의 전수 목록·출처·해시·가공/권리·한계를 담당하며 실행 manifest/타입과 함께 갱신한다. OpenAPI/타입/스키마·lockfile·테스트는 실행 가능한 계약으로 별도 유지하고 이 문서에서 경로/버전을 참조한다.

현재 **우주 탐색→천체 선택/자동 포커스→실제 ε Indi B/명왕성 관측→품질→근거 저장/복원**과72시간 표시 재생, 공개 지도/고리·위성/왜행성·NASA 외계행성 카탈로그, 은하9개와 별도 우주 역사를 v0.5.0에서 로컬 구현·검증했다. 최종 소스 b2930ec는 origin/main에 반영했고 완결 ZIP의 해제/재시작 복원도 검사했다. DEV-007은 사용자의 후속 선택에 따라 빅뱅/우주 역사 화면을 **실제 관측5사례·공개 처리영상·출처의 추정 연대만** 제공하도록 교체하며 v0.5.1을 준비한다. 가상35은하/성장 애니메이션과 연속Gyr시계는 현재 화면에서 제외한다. 현대9개 은하(DEV-006)와 역사 장면의 가상 은하는 별도이며 과거 관측을 복원했다고 주장하지 않는다. 실제 예측·표시 보간·관측 원본·개념적 역사를 구분하고 Planet X/TESS 실험·정밀 측정/운동 판정·공개 서버 배포의 미완료는 유지한다. 실제 검사와 제한은20절·작업 기록에 연결한다.

## 1. 제품 목표와 범위

실제 관측·논문·천체력으로 연결한 우주를 탐색하고, 사용자가 가정을 바꿔 관측과 비교한 근거를 저장하는 PC 우선 웹사이트를 만든다. 입문자와 상세 분석 사용자는 동일한 관측·계산·세션을 사용하며 설명 깊이만 다르게 한다. Planet X/Planet Nine과 외계행성은 함께 유지하되, 구현 우선순위는 아래 순서를 따른다.

| 순서/기능 ID | 결과와 최소 완료 조건 | 현재 상태 |
| --- | --- | --- |
| 1 · F01 | 공개 배포 기반, 좌표/관측·시간 비교, ε Indi B 원본→품질→근거 저장/새 세션 복원, 공식 5대상 검사 경로 | ε Indi B 로컬 경로 구현·검사; 나머지4대상은 실제 자료목록/품질 미검증 경로. 자유좌표·공개서버는 미완료 |
| 2 · F02 | 공식 Resources의 DR1/QR3 실제 입력을 기능과 결과에 연결; source URL→file ID/SHA→기능→결과 추적 | S01/S02·S10 실제 reader→결과→근거 추적 구현; 전체 자료 검증 완료 아님 |
| 3 · F03 | 최소 3D 태양계→명왕성 선택→실제 SPHEREx 노출 연결 | 기본 흐름·9궤도/72시간·DEV-004지도/카탈로그 검사 완료. DEV-005/006 은하/카이퍼대·우주 역사 검증 완료; DEV-007 역사 모양 반복 수정 중. HiPS미채택 |
| 4 · F04 | 개별 Planet X 가설 경로의 관측 투영과 별도의 문헌 조건부 위치 분포 | 입력 자료 확보, 미구현 |
| 5 · F05 | WASP-4 b의 실제 TESS 광도곡선·통과 모형·조건부 기하 통과확률 | 입력 자료 확보, 미구현 |
| 6 · F06 | 핵심 5언어·검사·근거 묶음·제출 완성; 첫 구현부터 병행 | 첫 경로5언어 UI 구현; 사람 검수/후속경로·제출 미완료 |

축소 순서는 외계행성 실시간 모형→문헌/확장 안내, 다음 3D 연출·카메라/천체 수, 다음 Planet X 시나리오 1개다. 관측 핵심·공식자료·3D→관측→가설 연결·핵심 5언어를 보호한다. 방향·핵심 범위·순서 변경은 6인 공동 결정이며 에이전트가 임의로 변경하지 않는다.

HiPS 배경은 F03 안에서 10분 한도로 선택 시도한다. 계정/공개 공유 게시판·BGM·독립 거리/크기 도구·전천 자동 탐색·NEOSSat 고도화·Redis/Celery는 현재 필수가 아니다. 천체 출처 후보가 늘어도 전부 구현 의무가 생기지는 않는다.

## 2. 화면과 사용 흐름

대표 흐름: **3D 탐색→명왕성 선택→실제 노출→개별 가설→별도 문헌 분포→비교/판단→근거 저장/복원**. 좌표/관측 비교부터 시작하는 진입도 제공한다. 첫 개발 검증은 ε Indi B 경로로 먼저 끝까지 완성한다.

| 영역 | 조작/표시 계약 |
| --- | --- |
| 중앙 작업 공간 | 큰 3D/천구·실노출 화면. 관측 비교는 A/B·깜빡임·필요 그래프를 연결하고 고급 정보는 접음 |
| 목적별 메뉴 | 탐색/관측/가설/근거. 처음부터 모든 설정을 펼치지 않음 |
| 선택 대상 패널 | 천체명/문자열 ID, 출처·기준 시각, 거리/좌표의 종류, 실제 관측 진입 |
| 관측 선택 | 실제 존재하는 날짜·파장·release/coverage 목록. 없는 날짜/대역을 실제 사진처럼 생성하지 않음 |
| 품질/출처 패널 | obs_id·detector·VERSION·DATE-AVG/TIMESYS·보정·HDU·단위·FLAGS·검증 상태·원 URL |
| 시간/가설 조작 | 모형 시각/기준계/관측자와 실노출 촬영 시각을 구분. 자유카메라는 실제 관측자와 구분 |
| 근거 | 판단 이유·입력/조건·결과/한계를 저장하고 파일 내보내기/새 세션 가져오기 |

**Space Time을 몰입형 화면·조작의 최우선 참고로 삼는다.** WWT는 검색/안내, NASA Eyes는 천체·관측자/임무 맥락의 보조 참고다. 큰 우주 화면·절제된 메뉴·필요할 때 여는 패널·선택/시간의 연속성을 제품 경험의 중심에 둔다. 실제 확인 범위는 [디자인 관찰 기록](./docs/design_references.md)에 연결한다. 자산을 복제하지 않고 기능 완료 여부는 실제 조작으로 확인한다.

대상·관측·그래프 선택은 `object_id/observation_id/result_id`로 연결한다. 이전 비동기 요청이 늦게 끝나도 현재 선택을 덮어쓰지 않는다. 같은 세션에서 언어/설명 깊이를 바꿔도 과학 값과 가설은 유지한다. 상태는 로딩·빈 검색·미관측·품질 제외·약한 신호·실패·미검증을 구분한다.

### 2.1 우주 화면과 분석 패널

기본 진입은 큰 우주 화면이다. 작은 카드/표/그래프를 먼저 가득 배치한 대시보드로 우주를 대체하지 않는다. 상시 조작은 검색·선택 대상·핵심 시간 조작·목적별 진입으로 줄인다. 상세 정보는 접는 패널/탭으로 제공하고 분석 중에도 선택 대상과 공간 맥락을 유지한다. 좌우 배치는 고정 규칙보다 가독성·천체 집중·실제 조작 결과를 기준으로 조정한다.

천체를 고르면 정보 패널에서 `실제 관측 보기`로 직접 진입한다. 같은 세션에서 노출 날짜/파장을 선택하고 A/B 영상·그래프·품질·출처를 연결한다. 모형시간과 실노출시간은 각자 표시하며, 타임라인/카메라 조작이 원본 관측을 다른 날짜의 사진으로 바꾸지 않는다. 처음 ε Indi B 경로를 구현할 때부터 이 작업대 구조를 사용하고, 이후 F03에서 공간 탐색을 연결한다. 구현1→6 순서를 바꾸는 뜻은 아니다.

### 2.2 클릭 즉시 부드러운 자동 중심 이동

**3D 천체·천체 목록·검색 결과를 클릭/선택하면 별도 스크롤이나 `Go to` 버튼 없이 해당 천체로 자동 포커스한다.** 선택 정보는 즉시 갱신하고, 카메라 위치와 시선 중심을 현재 상태에서 목표 상태로 부드럽게 보간한다. 천체를 화면 중심에 놓고 전체 형상을 이해할 수 있게 프레이밍한다. 고정 카메라 이동 거리/속도/시간을 모든 천체에 무조건 적용하지 않고 표시 반지름·FOV/종횡비·현재 위치를 고려해 실제 화면에서 조정한다.

- 선택 `object_id`와 카메라 목표를 한 동작으로 연결한다. 물리 좌표/궤도를 이동시켜 화면 중앙에 맞추지 않는다. 표시 반지름 확대는 이미 선언된 표현 가정이다.
- 목표가 바뀌면 이전 이동을 취소하고 현재 보간 위치에서 새 목표로 전환한다. 뒤늦은 대상 정보/요청이나 이전 애니메이션이 새 선택을 덮어쓰지 않는다. 도착 뒤에도 선택/정보/카메라 대상이 일치해야 한다.
- 이동 중에도 정보 패널·관측 진입을 사용할 수 있게 한다. 사용자 회전/드래그/줌 입력은 자동 이동을 중단하거나 사용자 제어로 넘기며 카메라를 계속 강제하지 않는다. 드래그를 클릭으로 오인해 천체로 튀는 문제를 검사한다.
- 같은 천체 재선택은 필요할 때 부드럽게 재중심화한다. 모형시각·선택 노출/파장·관측 비교·가설/문헌분포 조건·판단 이유를 초기화하지 않는다. 공간 탐색에서 대상을 바꾸더라도 저장하지 않은 작업을 조용히 버리지 않는다.
- 새 천체를 선택했을 때 이전 관측/판단은 원래 `object_id`와 보관 상태로 유지한다. 이를 새 천체의 관측으로 오표시하지 않는다. 새 대상의 관측 조회·로딩·결과 없음은 별도 상태로 표시하고 기존 분석으로 되돌아갈 수 있게 한다.
- 거리 미상의 방향층은 해당 천구 방향으로 시선을 맞춘다. 미검증 거리를 생성해 실제3D 위치에 도착한 것처럼 연출하지 않는다. 움직이는 천체는 사용자가 고른 모형시각의 위치를 사용하며 포커스만으로 시각을 변경하지 않는다.
- 키보드 선택도 같은 경로를 사용한다. reduced-motion 사용자는 즉시/짧은 전환을 지원한다. 카메라 근접 clipping/천체 내부 진입·급격한 화면 점프·멀리 있는 천체의 과도한 대기를 피한다. 구체적인 시간/성능값은 실측 후 확정한다.

참고 사이트에서 대상 변경 후 선택/스크롤이 번거롭다는 것은 **사용자가 보고한 경험**이다. 이번의 검색→명왕성 선택에서는 자동 이동도 관찰했으므로 해당 사이트에 자동 포커스가 없다고 일반화하지 않는다. 우리 수용 기준은 진입 방식별 동작을 일관되게 만드는 것이다.

### 2.3 프로젝트가 완성할 차별화 경험

| 경험 | 예정 구현과 확인 가능한 차이 |
| --- | --- |
| 천체→실제 SPHEREx 관측 | 선택 ID/공간 맥락을 유지한 채 실제 노출·시각/파장·품질·원출처를 연다 |
| 가설→같은 관측에 투영 | Planet X 가정을 바꾸면 해당 경로/실노출 WCS 투영이 바뀌며 관측 자체는 유지된다 |
| 개별 경로/문헌 분포 분리 | 별도 문헌층의 epoch·표본/분모·정규화가 유지된다. 개별 입력을 바꿔 재추론한 것처럼 표시하지 않는다 |
| 근거와 재현 | 원본SHA/보정·설정/모형·결과/판단을 묶어 저장하고 새 세션에서 같은 상태를 복원한다 |
| 한계의 가시성 | 실제 관측/문헌/예측/사용자 가설·검증/보류 상태를 구분하고 상세 근거를 접어 제공한다 |

Space Time에도 출처/방법/한계·관측·외계행성 관련 UI가 관찰됐다. 따라서 이 표는 상대 사이트의 기능 부재나 우리 도구의 우월성을 주장하는 비교표가 아니다. 우리 프로젝트가 실제 완성·검증할 특화 경로다. 기능 수를 늘리는 대신 QA03/QA05와 아래 UX 검사로 증명한다.

### 2.4 화면/자동 포커스 수용 기준

| ID | 실제 검사 |
| --- | --- |
| UX01 | 기본 우주 화면에서 검색·선택·시간/관측 진입을 찾고 상세 패널을 열고 닫아도 주요 천체/선택을 잃지 않는다 |
| UX02 | 3D 클릭·목록·검색 선택 모두 별도 스크롤/이동 버튼 없이 부드럽게 중심/프레이밍이 바뀐다. 선택 정보는 즉시 갱신된다 |
| UX03 | 이동 중 A→B→C를 빠르게 선택하면 마지막 C만 최종 목표다. 드래그/줌으로 사용자 제어에 들어가면 자동 카메라가 맞서지 않는다 |
| UX04 | 작거나 멀리 있는 천체·움직이는 천체·방향층·좁은 창·키보드/reduced-motion에서도 올바른 표현으로 포커스한다 |
| UX05 | 카메라 이동 전후 실제 노출·시각/파장·가설·문헌층 조건·판단 이유가 보존된다. 천체 변경 시 이전 관측/판단은 원래 object_id로 보관하고 새 대상의 관측으로 오표시하지 않는다. 저장 후 새 세션 복원과 QA03/QA05도 확인한다 |
| UX06 | 실제 관측 진입 후 원본/모형 구분·날짜/파장·품질/출처를 읽을 수 있고 미관측/미검증 상태를 성공으로 표시하지 않는다 |

UX01–06의 최소태양계/εB·명왕성관측 범위를 DEV-002에서 실제 Chrome으로 검사했고 DEV-003 재생 회귀를 추가했다. DEV-004 카탈로그 탐색과 F05의 실제 TESS/통과 모형은 별개이며, Planet X/문헌분포·TESS까지의 전체 경로는 미구현이다. 실제 기기/브라우저·언어·입력/기대/실제·증거를 남긴다. Notion 체크리스트 수신을 앱테스트 완료로 기록하지 않는다.

DEV-001은관측기능의첫독립작업대였다. 사용자는우주를탐색하다대상을선택하는제품을원했다고다시명시했으며DEV-002에서기본진입을전체우주화면으로바로잡았다. 기존작업대를ObservationWorkbench컴포넌트로재사용해같은장면안의접는관측/근거패널로연결했다. 큰카드/표를기본화면에배치하지않는다.

### 2.5 DEV-002 우주 탐색과 보존 계약

기본은태양계전체화면이며검색·탐색/관측/근거·언어·모형시각을상시제공한다. Three.js scene은패널열기/닫기에도unmount하지않는다. 태양/8행성/명왕성은실제태양중심JPL위치,εIndiB는고유운동전파한방향층이다. 나머지공식4대상은검색/자료목록에는있지만공간좌표가미검증이므로위치를지어내지않는다.

3D표식/천체클릭·검색/키보드목록선택은동일object_id로정보를즉시갱신하고카메라를현재위치에서부드럽게포커스한다. 방향층은카메라눈위치를유지하고시선을회전한다. 이동중재선택은현재보간상태에서교체하며반대방향시선도카메라와target이겹치지않게구면보간한다. 드래그/휠·WASD/방향키/Q·E는자동이동을중단하고직접조작한다. reduced-motion에서는포커스를즉시적용한다. 포인터이동5px초과는클릭선택으로처리하지않는다. 태양계전체버튼은별도overview전환이며단순패널닫기는카메라를초기화하지않는다.

관측버튼으로같은천체의실제자료목록/노출을연다. 공간장면을유지하고분석패널을접을수있다. object_id별workspace에선택노출/표시·비교·판단/근거ID를보관한다. εB→명왕성→εB로옮겨도각판단을보존하고다른대상의관측으로보이지않는다. 늦은응답은선택/작업generation·revision·unmount경계를확인하며현재선택/새세션을덮지않는다.

원본 천체력은 11/13·14·15·16 00:00 UTC의 정확한 네 표본이다. DEV-003은 이 표본을 바꾸지 않고 두 표본 사이를 명시적인 표시 보간으로 연결해 72시간 연속 재생을 제공한다(2.6절). 범위 밖 외삽과 임의 시각의 실제 사진 생성은 허용하지 않는다. 로딩/실패 상태에서 이전 위치를 새 시각의 결과로 표시하지 않는다. 모형시각/카메라변경은 실노출 DATE-AVG·관측자·선택/판단을 바꾸지 않는다. 근거에는 universe_context의 선택천체·장면출처SHA·모형시각·카메라 position/target·표현버전·패널상태를 저장/복원한다.

사용자의추가요청으로수성~명왕성9개궤도안내선을기본표시한다. 선은1px·기본opacity.22/선택.58이며선택천체를강조하고상단궤도버튼으로전체를켠다/끈다. 선은클릭대상이아니며전환으로카메라/선택/관측을바꾸지않는다. Sun은태양중심원점,εB는방향층으로별도의궤도를생성하지않는다. 궤도표시조건/원출처SHA도근거에저장하고새세션에서동일하게복원한다.

### 2.6 DEV-003 연속 시간 재생·정지 계약

사용자는 현재 완성 작업을 먼저 commit한 뒤 시간 재생을 추가하도록 지시했다. `54756ca`(2026-11-14 13:12:27 KST, 140파일)를 보존 기준으로 확정한 후 구현을 시작했다. 원격 push·공개 서버 배포를 수행한 commit은 아니다.

재생 범위는 **2026-11-13 00:00:00 ~ 2026-11-16 00:00:00 UTC, 72시간**이다. 시작은 정지이며 Play/Pause와 수동 시각 탐색을 제공한다. 속도는 실제 1초당 모형 1/6/24시간, 기본 6시간이다. UI 모형 상태는 최대 약 30fps로 갱신하며 이는 보장 성능값이 아니다. 끝에 도달하면 정확한 끝 시각에서 멈추고, 끝에서 다시 Play하면 시작 시각부터 재생한다. 수동 시각 변경·숨겨진 탭·근거 저장은 재생을 멈춘다. import·새 세션도 정지 상태로 시작한다. 탭 복귀 때 숨겨진 시간을 한꺼번에 더하지 않는다.

초기 `/universe` 장면과 `/timeline`의 작은 표본 묶음을 읽은 뒤 브라우저가 오프라인 수식으로 연속 표시를 계산한다. 매 프레임 서버나 외부 Horizons를 조회하지 않는다. 천체력 원본 시각에서는 원 위치·속도를 그대로 쓰고, 중간 시각에는 `display-hermite-v1` 표시 보간임을 알린다. 서버도 같은 범위의 임의 시각을 `/universe?epoch=`로 재현한다. 실제 SPHEREx 노출·관측자·품질·판단은 시간 재생과 독립적이다.

선택에 의한 포커스 요청과 시간 tick을 분리한다. 재생 tick이 매번 새 자동 포커스를 시작하지 않는다. 포커스 완료 후 추적 중인 천체는 현재 카메라 offset을 유지해 이동을 따르며, 드래그/줌/키보드로 수동 조작하면 추적을 해제해 카메라를 고정한다. 선택한 천체와 optional `follow_object_id`를 별도로 저장한다. 전체 보기·새 세션·복원 경계에서도 이전 자동 이동이 새 상태를 덮지 않는다.

아홉 궤도 안내선은 **2026-11-14 00:00 UTC의 접촉궤도**로 고정한다. 이동하는 천체의 모형시각과 안내선 기준시각을 따로 표시하며, 재생 중 매 프레임 새 Horizons 궤도를 추론한 것처럼 바꾸지 않는다. ε Indi B는 두 catalog 방향 표본의 정규화 보간으로 표현하고 물리적 거리를 만들지 않는다.

### 2.7 표면·고리·위성·외계행성 전체 카탈로그 (DEV-004, 통합 검사 중)

사용자는 태양계 왜행성·위성과 태양계 밖 외계행성을 **둘 다 포함**하라고 확인했다. 기존 실노출/근거 경로를 보존하며 공개 원본 지도·실제 위성 천체력·전체 공개 외계행성 카탈로그를 추가한다.

- `science/appearance.py`·`appearance.json`: 공개 지도31개와 거대행성 고리4개, 채택 지도 원본102,820,603B. 원 URL·전체 SHA·바이트·촬영시기·credit·미관측 영역을 보존하며 원본 이미지를 고치지 않는다. 논문 그림의 지도 창은 `texture_region_px`를 GPU UV에 적용해 축/캡션을 제외한다. 선택 천체와 그 부모 행성의 최대2지도만 고해상도로 읽고 다른 천체는 설명용 LOD를 쓴다. 위성은 선택 전 점/간략도형, 선택 후 확대 상세표시다. 31지도에 NAIF PCK 극방향/자전율 출처를 기록하되 texture 경도·자전위상 정합은 미검증이다. Earth의 IAU pole은 정밀 EOP 기반 지구 자세가 아니다. 관측 모자이크/레이더/대표 대기와 설명용 외관, 지도촬영시기와 모형시각을 구분한다.
- `science/extended_solar.py`·`extended_solar.json`: 위성468개+추가 왜행성/후보8개=476개 등록, 실제2026-11-13~16 천체력 지원471개(위성463개). 미지원5개는 목록/사유만 표시한다. 인정된 왜행성5개(기존 명왕성+추가4개)와 외곽 후보4개를 구분하며 모든 소행성·모든 왜행성 후보를 구현했다는 뜻은 아니다. 부모중심·TDB/UTC·J2000황도·AU/AU-day·cadence를 보존한다. TNO위성5개는 모천체 PRIMARY 중심과 정합한 원본을 별도로 사용한다.
- 위성의 실제 부모상대 벡터와 태양중심 합성값을 구분한다. 화면은 부모 표시위치에 별도 확대 거리를 더한다. 미측정 반지름은 과학값 `null`, 표시 크기만 사용하며 부모 반지름 미상시 표시 기준0.0001AU는 물리값이 아니다. 부모 선택시 위성 목록/표식을 열고 상시 라벨은 큰 위성/선택 위성으로 제한한다. 추가 천체의 선은 확보한72시간의 **예측 표본 경로**로 열린 선이며 완전 궤도/실측 운동이 아니다.
- `science/exoplanets.py`/`nasa_catalog.py`·`exoplanets.json`: NASA Science 공개6470행성·4862모항성계의 날짜 고정 전체 목록. TAP호스트 timeout후 공식 NASA 공개 REST115페이지로 대체 취득했으며 PS 문헌 기본해를 취득한 것으로 주장하지 않는다. 원문 표시이름·추정 질량/반지름 표기·누락값을 보존한다. 게시물 오류 제목 대신 원본 `acf.display_name`을 사용한다.
- 외계행성 방향구는 원 카탈로그 RA/Dec를 쓰며 거리 단위·epoch/고유운동·공분산 미검증으로 3D 항성 거리를 만들지 않는다. 선택은 항성계 모식도·상세 구와 공개 수치/출처로 연결한다. 표면은 분류에 따른 절차적 **설명용 외관**이며 실제 지형/구름 관측이나 생명·존재확률이 아니다. 모식도의 방향·위상·24시간 자전은 가정이고 보고된 주기만 표시 재생에 사용한다. 현재 위치 예측·자기일관된 동역학 모형으로 해석하지 않는다.
- 새 읽기 API: GET `/api/v1/appearance`, `/api/v1/catalog/solar-system`(목록; `parent_id` 지정시 해당 부모의 시간표본 포함), `/api/v1/catalog/exoplanets`(전체 색인), `/api/v1/catalog/exoplanets/{object_id}`(원 수치/항성계/출처). 서버는 로컬 원본을 검증하며 요청 중 외부 자료를 가져오지 않는다. 검증한 빌드의 지도는 `/textures`에서 제공한다.
- 기존 εB/명왕성 근거의 `universe_context`에 선택적으로 `appearance_manifest_sha256`·`extended_solar_manifest_sha256`를 저장하며 변경시 재계산 필요를 알린다. 카탈로그 화면과 기존 두 실제 관측의 근거 저장을 구분하며 미연결 노출을 생성하지 않는다.

토성 자동 프레이밍은 prominent/faint 고리를 포함하고 매우 희미한 E/G의 전체 범위로 화면을 과도하게 벌리지 않는다. 실제 고리 반지름과 낮은 표시 불투명도는 보존한다. 좁은 고리의1px 중심선은 가독성 보조선이며 물리적 폭이 아니다. 외계행성 화면으로 전환하면 태양계 host를 `visibility:hidden`으로 두고 RAF를 정지해 기존 WebGL/카메라를 보존한다. 외계행성 모식도의 GLSL 표면은 분류별 설명용 코드 표현이며 관측지도 파일이 아니다.

실제 브라우저 GPU/지도·위성/카탈로그·원본 회귀·릴리스 ZIP 결과는 작업기록에서 확정한다. 이 체크포인트를 공개 서버·Linux·전체 해상 표면 관측 완료로 해석하지 않는다.

### 2.8 DEV-005 설정·은하 탐색·수십억년 우주 역사 (v0.5.0 기록)

**후속 지시:** 아래 개념적 우주 역사 화면은 v0.5.0의 구현 기록이다. 사용자가 실제 관측 사례만을 선택해 v0.5.1의 현재 화면은2.10절로 교체한다. 이전 원문/코드/연대 API는 보존하지만 현재 UI에서 가상 장면을 호출하지 않는다.

사용자는 카이퍼대 on/off·더 빠른 시간 재생·은하 선택/자동 이동을 요청했고, 과거의 범위를 **수십억년 전 우주 역사까지**라고 확인했다. 이를 현재 태양계 궤도를 수십억년 역산하는 기능으로 구현하지 않는다. 정밀 태양계의2026-11-13~16 UTC72시간 모드와 별도 우주 역사 모드를 제공하며 서로 다른 시간 단위를 섞지 않는다.

설정은 카이퍼대/은하 표시 checkbox를 제공하며 새 세션의 기본값은 둘 다true다. 카이퍼대는 NASA가 설명한 주영역 약30–50AU의 설명용 annulus다.650 seeded점·수직±0.6AU·색/불투명도는 표시 가정이며 실제 객체 수·분포/밀도·궤도경사/두께가 아니다. scattered disk의 약1000AU범위를 이 annulus의 외곽경계로 쓰지 않는다. 토글이 실제 왜행성/위성·관측/판단을 바꾸지 않는다.

DEV-005의 첫4개 M31/M33/M81/M87은 공식 Chandra J2000 Fast Facts의 둥근 방향과 NASA의 약2.5/3/11.6/54백만 광년 소개값을 연결했다. 원 방향/거리는 DEV-006에서도 보존한다. source frame realization/공분산·고유운동은 미검증이며 FK5/ICRS frame-bias 변환 없이 근사 ICRS 표시값으로 사용한다. Mpc변환은 단위변환이며 정밀도를 높이지 않는다. M87의 Chandra55/NASA54백만 광년 차이는 별도로 보존한다. 기존 개념적 외관은 DEV-006에서 은하별 관측 형태를 반영하는 계약으로 보강하며 점 수·크기·회전·미확인 각도는 계속 표시 가정이다(2.9절). 선택·빠른 재선택·수동 이동 취소·reduced-motion은 기존 자동 포커스 경로를 재사용한다.

정밀 모드 속도는 실제1초당 모형1/6/24/**72시간**, 기본6시간이다. 원본3일 범위·끝 정지·수동/숨김/저장시 정지·정지 복원 계약은 유지한다.72h/s도 원자료 범위를 늘리거나 중간 노출을 생성하지 않는다.

우주 역사는 Big Bang 후나이 `age_gyr`0~13.8Gyr와 `lookback_gyr=13.8−age_gyr`를 구별한다.13.8은 반올림한 근사 기준이다. 역사10지점은 공식 NASA/ESA 원문과 SHA를 연결하며 일부는 넓은 시대 안의 대표 표시 anchor다. 화면의 **최근 표시 지점**은 물리적 시대의 순간적/전역 경계가 아니다. 최초 별의 정확한 시점·통계적 신뢰구간·새 확률을 산출하지 않는다. 입력은 slider/수치·지점별 버튼·Play/Pause, 속도는 실제1초당1/10/100/1000Myr(기본100)이며 시작/수동선택/끝/숨김탭은 정지한다. 끝에서 다시 재생하면0부터 시작한다.

`cosmic-concept-v1` 장면은 plasma/CMB·별/은하·filament·태양계의 **개념적 시각화**다. source 관측사진이나 현재 카탈로그 좌표를 과거로 재생하지 않는다. 표시 가중치는 물리적 밀도·팽창인자·복사전달 함수가 아니며 초기별0.1Gyr·태양계9.2Gyr의 선택 anchor 이전에 해당 표현을 등장시키지 않는다. 정밀 UTC/관측 DATE-AVG·workspace·기존 근거는 보존한다. 우주 역사에서 관측/근거 nav는 정밀 모드로 복귀한다. 별도 역사 age/카메라를 기존 관측 Evidence의 ISO model_epoch에 넣지 않는다. 우주 역사 자체의 정본 근거 저장/복원을 구현했다고 주장하지 않는다.

정밀/외계행성/우주역사 세 장면은 숨김 host와 RAF정지로 WebGL/카메라를 보존하고 외계행성/역사 모듈은 처음 열 때 lazy load한다. 모드 전환으로 숨겨진 시간을 누적 재생하지 않는다. 별도 BCSolar 모드는 현재 공식 JPL 근사표에서 Pluto가 제거된8개/Earth-Moon barycenter만 지원함을 확인했고, 사용자 수십억년 요청을 우선해 이번에는 보류했다. 범위 밖/수십억년 태양계 천체력을 제공하지 않는다.

### 2.9 DEV-006 은하별 관측 형태와 설명용 공간 표현

사용자는 은하가 모두 같은 모양으로 보이고 고증이 부족하다고 지적하며 실제 다른 은하를 요청했다. 현재 목록은 M31/M33/M81/M87/LMC/SMC/M51/M104/Centaurus A의9개다. 태양계 원점에서 해당 방향을 보는 관측 외관을 참고하며 은하 선택 시 그 시선에 맞춰 자동 포커스한다. 실제 방향/거리값을 카메라에 맞추어 바꾸지 않는다. 관측된 spiral/elliptical/irregular 구조, 팔/막대/먼지띠/동반은하/제트 특징을 출처와 연결하고 설명용 입자 기하로 구분한다.

M31의77°경사, M81의두팔, LMC의중심막대/한팔은 각 원문이 명시한 값/특징이다. M87/Centaurus A의 arms=0은 타원은하 형태 분류를 표현한 값이며 새 측정 결과가 아니다. 다른 경사각과 모든 위치각은 자료 계약에서 `null`이고 임의 표시값을 측정값처럼 노출하지 않는다. M33의 `flocculent_spiral`은 실제 사진의 희미하고 조각난 팔을 반영하는 렌더 스타일이며 NASA가 명시한 공식 분류라는 주장이 아니다. M51 동반 NGC5195의 화면 간격/방향은 표시 가정이고 측정된 분리각/PA로 내보내지 않는다.

입자 수·색/발광·먼지/제트 굵기·크기 확대·회전 위상·미확인 방향은 별도 `display_assumptions`다. 현재 물리적 자세·별의 실측 위치/개체수·고대 배치·속도장이나 정밀 은하 동역학을 복원하지 않는다. 공식 관측 참고페이지는 `image_source`로 연결하되 새 관측사진을 앱 자산으로 복제하지 않는다.9개별 형태·보이는 차이·출처/각도 미상 표시·선택 이동과 기존 관측 보존을 QA16으로 확인한다.


### 2.10 DEV-007 실제 초기 우주 관측만 표시

사용자는 빅뱅 모드의 은하가 같은 모형이라고 지적한 뒤 ‘실제 데이터와 사실만을 바탕으로 된 것인지’를 확인했다. 설명용35은하/개별 성장과 실제관측의 차이를 설명했고 사용자는 **실제 관측 사례와 확인된 연대만 표시**하는 방식을 선택했다. 따라서 모양을 다양화한 중간 시안은 게시하지 않고 현재 App에서 가상 역사 renderer/별·은하 배치·plasma/CMB·성장 변형·연속0~13.8Gyr 입력과 임의10지점 버튼을 제거한다. 기존 코드·원문은 이전 버전/중간 검토 기록으로 보존한다.

현재 `CosmicObservationViewer`는 공개 처리 관측5사례(Cosmic Gems,Firefly Sparkle,CEERS,REBELS-25,ZS7)의 공식 JPEG/PNG만 원바이트로 제공한다. 중앙 영상은 object-fit:contain으로 보여 원본을 자르거나 내용을 합성하지 않는다. 이전 이미지의 늦은 load/error가 새 선택을 덮지 않도록 id/SHA/URL/retry 키를 검사한다. 관측영상은 raw detector/natural-color와 구분하고 원 credit·license·공식caption·원본URL·SHA·처리/렌즈의 한계를 제공한다.

표시 우주나이는 지목된 대상/표본에서 출발한 빛에 대한 **출처의 근사 추정값**이다. 사진 취득일과 다르고 적색편이/채택 우주론에 의존한다. 사진 전체의 전경·배경 대상에 같은 연대를 배정하지 않는다. Gems0.46/Firefly0.6/REBELS0.7/ZS70.74Gyr와CEERS표본0.6~6Gyr를 보존하며 CEERS에 하나의 연대를 생성하지 않는다. ‘확인된 연대’는 출처로 확인한 추정값이며 정밀한 절대시각 보장이 아니다.

5개 tab/키보드 선택과 정수 case-index slider는 **관측자료 순서**다. 자동 재생은 이미지당3/5/8초(기본5)의 슬라이드쇼로 실제 물리시간·은하의 성장·관측 사이 중간 프레임을 생성하지 않는다. 현재 영상이 로드된 뒤 다음 사례 대기를 시작하고 끝에서 정지/재재생은 첫 사례다. 수동 선택·간격 변경·숨김탭·import/모드전환·오류/상세 펼침은 정지한다. 원래 Solar의 모형시각/카메라·εB/Pluto 원본/판단/근거는 보존하며 새 세션은 사례 선택/재생을 초기화한다.

핵심5언어는 source 추정/범위·가공관측·렌즈/색·크레딧/권리·슬라이드쇼의 뜻을 유지한다. Gems의 서로 다른 두 렌즈은하를 모두 하나의 중복상이라고 설명하지 않고, Firefly의 미래성장·ZS7의 향후 블랙홀 합체를 관측 완료로 만들지 않는다. REBELS의ALMA gas/velocity 색을 자연색 표면으로 설명하지 않는다. 실제 상세 caption/credit/이용 조건은 원문을 함께 제공한다.

## 3. 언어·라이브러리·프로세스 책임

| 위치 | 언어/기본 기술 | 책임 |
| --- | --- | --- |
| `web/` | TypeScript strict, React/Vite, HTML, CSS Modules, JSON | UI·선택 상태·국제화·렌더링·API 호출 |
| 3D/천구/그래프 | Three.js / Aladin Lite / Plotly.js | 모형 공간·천구 관측·과학 그래프. 큰 모듈/자료는 필요 시 로드 |
| 클라이언트 상태 | Zustand, TanStack Query | 세션/선택과 서버 조회·취소/오래된 응답 구분 |
| 국제화 | i18next/react-i18next | `ko/en/ja/zh-Hant/fr` 문맥별 키·수치/단위 형식 |
| `api/` | Python 3.12 계열, FastAPI/Uvicorn/Pydantic | 요청 검증·목록·작업 상태의 유일한 작성자·근거 파일/정적 빌드 제공 |
| `science/` | Python, Astropy/NumPy; 필요 시 SciPy/Photutils/reproject | FITS·WCS·시간/단위·품질·검증된 계산. UI/HTTP와 분리 |
| `worker/` | 별도 Python 프로세스, 초기 동시 작업 1개 | 무거운 과학 처리·임시 산출물·IPC 결과 보고 |
| 외부 자료 조회 | 검증된 HTTP 클라이언트/PyVO 등 | 허용된 아카이브·bounded 요청·TLS·출처 보존 |
| `contracts/` | OpenAPI/JSON Schema·TypeScript 타입 | 입력/출력·오류·버전 계약 |
| `deploy/` | Dockerfile/설정·검증한 시작/복구 스크립트 | Node 정적 빌드→Python 3.12 Debian slim 계열에서 API/정적파일·별도 worker |
| `tests/` | Python pytest/Ruff, TS typecheck/lint/Vitest, Playwright | 실제 위험에 맞는 원본/과학·상태/복원·대표 브라우저 검사 |

위 목록은 기본 선택안이며 설치 완료 목록이 아니다. 실제 Node/Python/라이브러리 버전·플랫폼 검사를 기록하고 lockfile/이미지 digest를 고정한다. 무거운 FITS 계산을 API 이벤트 루프에서 실행하지 않는다. AI API는 핵심 조회·계산의 필수가 아니며 과학 판정을 LLM 응답으로 대체하지 않는다.

## 4. 파일 구조와 데이터 흐름

`web/ → /api/v1 → api/ → worker/IPC → science/ → 파생 파일 → api/ 상태 확정 → web/` 흐름을 기본으로 한다. API 하나가 상태 파일 갱신을 직렬화한다. worker는 상태 파일을 직접 덮어쓰지 않는다.

| 경로 | 저장 내용/정책 |
| --- | --- |
| `data/manifests/datasets.json` | 현재 확보한 102원본/참조의 source·SHA·바이트·실행 상대경로. 파일 수를 독립 관측 수로 쓰지 않음 |
| `data/manifests/drive_sources.json` | 공유 Drive 출처/ID 연결 |
| `data/manifests/solar_system_source_candidates.json` | 새 태양계 링크 후보. 물리량/궤도 원본 및 102파일 관측 목록과 분리 |
| `data/manifests/timeline_validation.json` | DEV-003 표시 보간의 별도 JPL 중간 시각 27개 검산·원응답/해시. 관측102파일 목록과 분리 |
| `data/manifests/extended_solar.json` | DEV-004 위성468개/추가 왜행성·후보8개와 실제 위치지원/미지원, 부모중심·출처509개·SHA·검산. 불변 원응답은 `data/reference/solar-extension/` |
| `data/manifests/exoplanets.json` | NASA Science 공개 외계행성6470개/모항성계4862개의 날짜 고정 목록. 원본115페이지는 `data/reference/catalog/nasa_science/`; PS 기본해와 구분 |
| `data/manifests/appearance.json` | 공개 원본 지도·지도창 UV/미관측 영역·credit와 고리 반지름/IAU pole. 이미지 원본은 `web/public/textures/`, 참조는 `data/reference/appearance/` |
| `data/manifests/cosmic_history.json` | DEV-005 약13.8Gyr기준10개 개념적 역사 지점·채택/상충 설명·NASA/ESA4원문; `data/reference/history/` |
| `data/manifests/galaxies.json` | DEV-0069은하·공식17원문(HTML16/PDF1), 방향/거리·관측 형태와 미상각도/표시 가정; 기존4개 snapshot도 보존; `data/reference/galaxies/` |
| `data/manifests/kuiper_display.json` | NASA주영역30–50AU와별도scattered disk,650점/두께 등의 표시 가정; `data/reference/kuiper/` |
| `data/raw/`, `data/calibration/`, `data/reference/` | 불변 원본/보정/문헌·참조. Git 제외 |
| `data/derived/` | 행사 중 계산한 파생 결과. 입력·처리 버전/설정 추적 |
| `var/jobs/`, `var/cache/`, `var/evidence/`, `var/logs/` | 작업/캐시·근거·로그; 실제 `.env` 디렉터리 키와 맞춰 영속 volume 구성 |
| `docs/internal/` | 실명 계획서·팀원 원문·비공개 검토. Git/빌드/공개 ZIP 제외 |

기존 manifest/로컬 파일부터 사용하고 102개를 무조건 다시 다운로드하지 않는다. 원본 SHA 불일치는 중단/원인 확인 상태로 남긴다. 동일 노출의 재처리·cutout·재다운로드를 새 독립 시점으로 세지 않는다. DB/계정/분산 큐는 파일 저장을 먼저 완성한 뒤 필요성과 조건을 검토한다.

## 5. 실제 관측 입력

| 용도 | 입력과 주의점 |
| --- | --- |
| ε Indi B | S01 DR1 `2025W18_1B_0238_4/D6`, S02 QR3 `2026W39_1A_0578_3/D6`, VERSION7.0.5. DATE-AVG는 각각 2025-04-30T02:06:28.716, 2026-09-23T17:21:46.185 UTC |
| D6 보정 | DataLink와 manifest의 실제 관계를 읽어 `cal-swcs-v5-2026-191`를 연결. 별도의 QR3 보정을 추정하거나 QR2 v4와 혼용하지 않음 |
| 명왕성 | QR3 D3 `2026W40_1A_0373_4`→`2026W40_2A_0244_1`; 보조 `2026W40_2A_0033_1`. 실제 시각/WCS/release 확인 |
| 공식 5대상 | Barnard's Star, Epsilon Indi B, WISE0855, RW Aurigae, R Draconis. 포화/약한 신호/보류도 정상 검사 결과 |
| 결함 대안 | VY CMa/ε Oct/GY UMa 원본·문헌은 검출기 결함/대안 설명 참고. 적합성을 확인하지 않고 첫 사례를 대체하지 않음 |
| Planet Nine | 문헌 v3 CSV 100,000개 가설 표본·17열, epoch JD2458270.0(2018). 발견된 행성 목록이 아님 |
| WASP-4 b | TIC402026209/TESS Sector2 실제 LC, 일관된 문헌 모형. SPHEREx 모항성 주변 2표본은 별도 맥락 |

파일별 archive/release·obs_id/detector·pipeline VERSION·HDU·관측 시각/시간계·관측자·보정 ID·원 URL·SHA256·바이트·취득 시각을 원본→기능→결과로 연결한다. 실제 상대경로는 manifest를 읽고 결정하며 문서에서 경로를 새로 추정하지 않는다. 자세한 확보 범위는 [자료 목록](./docs/data_inventory.md)에서 확인한다.

## 6. FITS·품질·측정 계약

1. DR1/QR3의 실제 HDU를 검사한다. `IMAGE/FLAGS/VARIANCE/ZODI`와 `EPSF` 테이블을 보존한다. D6 EPSF441행, D3 451행처럼 실제 zone/OVSMP를 읽고 구판 PSF cube 구조를 강제하지 않는다.
2. IMAGE의 MJy/sr는 표면밝기다. 배경·픽셀 입체각·구경/PSF/오차를 검증한 뒤에만 Jy flux를 계산한다. 기존 L2에 dark/AGM을 재적용하거나 ZODI 차감 상태를 혼동하지 않는다.
3. 비트 이름/값은 해당 파일 헤더 선언을 읽는다. SOURCE는 천체식별/불량 판정이 아니다. OVERFLOW는 약 반-full-well 표시이며 완전포화와 다르다. TRANSIENT에는 cosmic ray와 밝은 별 blooming 등도 포함될 수 있다.
4. OUTLIER 원본과 검토 상태를 보존한다. 목적별 `mask_policy_id`로 retained/excluded/review_required와 이유를 저장한다. 비트 개수는 겹칠 수 있으므로 합산해 픽셀 총수로 쓰지 않는다.
5. FLAGS에 bilinear 보간을 하지 않는다. nearest 또는 명시한 bit-OR 규칙과 원본/변환 이력을 유지한다. IMAGE/분산 재표본화·상관 잡음도 별도로 검증한다.
6. 유한 값·양의 분산·flag0만으로 정밀 검출/측광 성공을 선언하지 않는다. 근접 파장·같은 detector만으로 응답/PSF/보정이 동일하다고 가정하지 않는다.
7. 검사표 A의 과거 예측 중심/픽셀 집계는 입력·창·정책 회귀 참고다. 앱의 독립 중심 측정·운동 검출·광도 결과로 전사하지 않는다.

### 6.1 DEV-001 실제 reader 계약

`science/spherex.py`의 `spherex-native-v1`은 S01/S02와 manifest S10(D6 SWCS v5)의 전체 SHA/바이트를 매 비교 시 확인한다. readonly FITS에서81×81 native cutout을 만들며 S02 경계에서 실제 폭80으로 잘리는 상태/offset을 보존한다. IMAGE/VARIANCE/ZODI 비유한 값은 null, FLAGS는 원본 정수이며 보간하지 않는다. EPSF 실제441행·열·OVSMP, VERSION7.0.5·DATE-AVG/UTC·주 TAN-SIP·HDU를 기록한다. 원본은 L2 표면밝기이며 ZODI는 차감하지 않는다.

SIMBAD ε Indi B의 ICRS J2000 좌표와 pm_ra_cosdec/pm_dec를 DATE-AVG로 구면 전파한다. 출처·문헌 bibcode와 입력을 prediction.source에 저장한다. 관측자 시차/RV/완전 공분산을 누락했다고 명시하며 중심측정으로 부르지 않는다. 주 WCS에는 SIP를 유지하되 대체 A/W에는 잘못 상속되는 SIP를 제거한다. SWCS v5 CWAVE/CBAND만 예측 active detector 좌표에서 bilinear 평가한다. S01/S02는 각각4.8321886063/4.8263525963 μm, 폭0.0366896614/0.0353709720 μm이며 내장 근사 WCS값도 별도로 보존한다.

분수 예측 중심과 정수픽셀 거리r≤3의 실제 집계는29/32픽셀, NONFUNC1/1·TRANSIENT0/1·SOURCE29/32이다. 비트 중첩을 합산하지 않는다. `native-display-review-v1`은 유한 원본을 표시하되 검토 필요/비유한·VAR 비양수·미선언 비트를 따로 기록한다. 정량 마스크/측정은 not_validated, 과학 상태는 association_insufficient다. 기대 좌표/집계는 tests/test_science.py의 독립 v1.7 회귀 참조이며 실측 검출 증거가 아니다.

## 7. 좌표·시간·과학 상태

천구 입력은 ICRS 도(`0≤ra<360`, `-90≤dec≤90`), 파장은 μm다. 배열 `[y,x]`와 픽셀 `(x,y)`·origin0/1·cutout offset·주 TAN-SIP WCS와 파장 대체 WCS를 구분한다. 큰 식별자는 JSON 문자열로 보존한다.

SPHEREx는 원 `DATE-AVG/TIMESYS`·관측자를 유지한다. DATE 생성 시각을 관측 시각으로 쓰지 않는다. TESS는 BJD 기준값/TDB/보정 방향을 유지한다. 관측자 수신시각과 태양계 질량중심 보정 시각을 단순 UTC 변환만으로 동일시하지 않는다. KST는 표시용이다.

고유운동 pmra의 cosδ 정의, epoch/기준계·시차/관측자·RV/공분산 누락을 표시한다. 음의/저신뢰 시차를 역수로 강제 거리화하지 않는다. 거리 미상은 천구 방향으로, 실제 천체력/거리 추정/가설은 출처별로 표시한다.

과학 결과는 최소 **관측 없음 / 품질 제외 / 약한 신호 / 정합·연관 불충분 / 모형 불일치 / 유효 측정 / 검증된 이동**을 구분한다. 작업 실행의 succeeded와 과학 유효성은 다른 축이다. 상한·신뢰구간은 검증된 오차모형·수준·방법이 있을 때만 제공한다.

## 8. 움직임과 3D 연결

명왕성 등 알려진 태양계 천체의 예측 좌표는 JPL 등의 독립 천체력과 같은 기준계/시각/관측자·광행시간 조건으로 대조한다. 별의 위치/고유운동은 해당 카탈로그·문헌과 검증한다. 명왕성 09/29→10/02의 약72.326969″(약11.760483 native px)는 예측값이다. 가까운 피크/SOURCE·깜빡임만으로 실측 검출을 주장하지 않는다.

실측 운동 판정은 대조별 정합 잔차·독립 오차, 두 위치×두 영상의 신호/coverage·감도·혼합, 정지 가설 기각과 예측 경로 적합을 확인한다. 임계값은 실제 오차와 검증에서 정한다. 미달하면 보류/불충분 상태를 저장한다.

3D는 천체력/거리/사용자 가설과 표시 좌표 변환을 기록한다. 거리 압축·반지름 확대·외관/미측정 궤도 방향은 표현 가정으로 표시한다. 물리 거리와 화면 길이를 혼동하지 않는다. 카메라 이동으로 원본 관측자의 시점/노출이 바뀌지 않는다.

DEV-002의science/solar_system.py는새solar_system_ephemeris.json에실제Horizons응답9개/원조회조건·SHA와JPL물리량표를보존한다. 태양중심500@10,각천체중심199–999,J2000황도,AU/AU-day,기하벡터(no light-time/aberration),UTC해석을확인했다. 천체별DE441/위성계천체력등실제응답source를보존하며전부같은DE441이라고쓰지않는다. 지구/목성/명왕성을별도ICRF/km조회→고정황도회전/AU변환경로로대조했다(동일JPL모형의좌표·단위교차검사이며독립천체력모형검증아님).

표현solar-display-v1: rAU=|벡터|에화면거리18·ln(1+rAU)를적용하고황도[x,y,z]를화면[x,z,-y]로회전한다. 태양화면반지름2.65,행성은min(1.65,max(.32,.4+.43·ln(1+Rkm/6371)))로확대한다. 원AU벡터와평균반지름km/불확도/각출처는정보패널에별도로표시한다. 외관색/조명·확대·설명용별배경은관측영상/실측밝기가아니다. εB의거리값은null이며장면거리300은방향표시용이다.

명왕성science/pluto.py는S12/S14·D3보정L051의실제SHA/HDU/EPSF451행을읽는다. 보존한pluto_ephemeris.json에서각DATE-AVG의JPL관측자500@-163182(SPHEREx)예측좌표를주SIP에투영한다. 관측자궤도는Space-Track TLE기반으로정밀도제한을표시한다. 예측변위72.3269690287″는실측운동이아니다. SWCSv5 bilinear파장/대역폭은S12 2.3132327492/0.0575278851μm,S14 2.3666596870/0.0590125858μm이며응답/PSF동일성을가정하지않는다. 현재DataLink의DR1 D3보정을전체TLS스트리밍검증해기존QR3취득L051와SHA/바이트동일함을보존했다. 원본취득출처를조용히바꾸지않는다.

science/orbits.py의osculating-kepler-guide-v1은solar_system_orbits.json에추가취득한9개Horizons ELEMENTS 원응답/해시를보존한다. 실제4UTC시각을TDB JD로변환해동일event의태양중심J2000황도a/e/i/Ω/ω/진근점이각과Keplerian GM을읽는다. 이심근점이각E기준의점[a(cosE−e),a√(1−e²)sinE,0]을Rz(Ω)Rx(i)Rz(ω)로회전해257점닫힌안내선을만든다. 현재위치를첫점으로두며모든점에같은화면거리압축을적용한다. 이는선택시각의접촉궤도Kepler근사이고수백년의실제N체적분궤적/후속위치예측으로쓰지않는다. 9천체×4시각의별도statevector첫점잔차max5.86e-12au·독립P/Q타원/평면검사는같은JPL자료/수식의수치일관성이다. 물리적정밀도보증으로해석하지않는다.

### 8.1 DEV-003 표시 보간의 계산·검산

`science/timeline.py`와 `web/src/timelineMath.ts`의 `display-hermite-v1`은 원본 네 매듭의 위치 AU·속도 AU/TDB-day를 사용한다. 인접한 두 TDB 시각 차이를 Δ, 구간 비율을 u라 하면 `p(u)=(2u³−3u²+1)p0+(u³−2u²+u)Δv0+(−2u³+3u²)p1+(u³−u²)Δv1`이다. 속도는 이 식을 TDB-day로 미분한 값이며 매듭의 원래 위치·속도는 직접 반환한다. UI는 UTC를 표시하고 서버는 Astropy UTC→TDB 변환을 쓴다. 브라우저의 매듭 간 UTC 밀리초→TDB 구간 비율 근사와 서버의 차이는 이 범위의 표본으로 별도 검사한다. 이를 천체력 자체의 오차 검증으로 확대하지 않는다.

새 `timeline_validation.json`은 아홉 천체×세 중간 시각(각 날짜 12:00 UTC)의 별도 Horizons VECTORS/UT 조회 27개와 원응답·파라미터·SHA를 보존한다. 13:14:35 KST 기록의 파일은 86,812B, SHA256 `6562f9898ba8716d41595f1b9288c0cf364b3ec4119e02cafb6a961a19527f99`다. 검사된 중간 시각의 최대 위치 차이는 수성 약 18.986654km(목성 약 6.944946km, 명왕성 약 5.120192km, 지구 약 0.052990km)다. 같은 JPL 동역학 자료의 별도 시각 조회와 보간을 비교한 결과이며, 전 구간 상한·물리적 위치 불확도·독립 동역학 모형 검증이 아니다. 표시용 보간은 측광/위치/운동 측정 입력으로 쓰지 않는다.

궤도 원소·원 응답은 그대로 보존한다. DEV-003 화면과 `/universe`의 아홉 안내선은 `guide_reference_epoch=2026-11-14T00:00:00Z`를 사용하며, 재생 모형시각과 다를 수 있다. 기존 원본 시각에서의 궤도 첫점 일관성 검사를 임의 재생 시각의 실제 위치 검증으로 주장하지 않는다.

### 8.2 DEV-004 확장 천체력·표면/고리의 과학 계약

JPL discovery 목록의 행성 위성460개와 지구의 달1개를 합쳐461개로 대조했다. mean-element 표의 중복 Puck과 누락 S/2009 S1, 두 철자 차이는 원본과 명시적 별칭으로 보존한다. 이 mean-element 값은 이름/ID와 표본 간격을 고르는 주기 참고에만 쓰며 현재 위치를 계산하지 않는다. 각 위치는 별도의 Horizons 기하 벡터다. 평균 주기0.5일 미만은5분,2일 미만은15분, 나머지/미상은60분 간격으로 72시간을 확보했다. 새 위성/왜행성 벡터도 TDB cubic Hermite로 범위 안에서만 표시하며, 경로선은 확보한 표본의 열린 경로다.

별도 NASA/논문 근거로 Hi'iaka·Namaka·Dysnomia·MK 2·Weywot·Vanth·Xiangliu 7개를 등록해 위성468개다. Ceres/Haumea/Makemake/Eris는 추가 인정 왜행성, Sedna/Quaoar/Orcus/Gonggong은 후보이며 기존 Pluto를 포함해 인정 왜행성5개·후보4개 범위다. 위성463개와 추가8천체의 실제 위치를 지원한다. Daphnis는2026 범위를 지원하지 않고, S/2009 S1·S/2025 U1의 잘못 매칭된 혜성/소행성은 신원검사로 배제했다. MK 2/Xiangliu는 이름·임시명·Horizons 전체 major-body 목록을 확인해 검증된 ID가 없음을 기록했다. 이5개는 `ephemeris_unavailable`, `knots:[]`이며 다른 천체의 위치나 평균 궤도로 대신하지 않는다.

Hi'iaka/Namaka/Dysnomia/Weywot/Vanth는 실제 이름 조회에서 확인한 TNO 위성 솔루션과 PRIMARY 중심을 사용한다. Haumea/Eris/Quaoar/Orcus도 같은 PRIMARY의 태양중심 벡터를 별도 취득해 부모 위치와 상대 위치를 더할 때 중심을 맞췄다. 이전 현재 small-body system-barycenter 응답은 `superseded_barycenter_source`로 보존한다. 원문 관측기간·솔루션일자·2025 예측 불확실성/Weywot 외삽 경고는 원본과 `solution_notes`에 남기며 2026의 정확도를 보장하지 않는다. 별도 태양중심 KM-S 비매듭 시각5조회와 부모+상대벡터 합성의 최대 표본 차이는0.0000989372km다. 이는 같은 모델의 중심·단위·보간 일관성이지 실제 위치의 오차 상한이 아니다.

지도는 원래 공개 이미지의 바이트를 보존하고 GPU에서 지도창/UV만 선택한다. 실제 지도·레이더 반사도·향상색·대표 대기·코드로 만든 설명용 외관을 구분한다. 미관측 영역, 불균일 해상도, 원 지도 처리와 촬영시기를 보존하며 지도 경도/자전위상을 실제 관측 자세에 맞췄다고 주장하지 않는다. 거대행성 고리4개는 출처가 있는 중심거리 km와 IAU pole의 적도면을 쓰되 두께/불투명도·원형면은 표시 가정이다. 작은 틈·호·워프·진화·광학전달은 미구현이며 Neptune arc를 완전한 관측 고리로 만들지 않는다. 극방향 출처와 자전위상 검증은 별개다.

### 8.3 DEV-005 우주 역사·은하·카이퍼대의 근거/시간

`science/history.py`의 `cosmic-chronology-v1`은 네 NASA/ESA 원문을 불변 보존한다. 채택한 표시 지점은 아래와 같으며 `sample_history`는 요청나이 이하의 최근 anchor를 고른다. dark ages/reionization/cosmic noon의 범위는 넓은 시대 설명이고 신뢰구간이 아니다. first stars0.1–0.3Gyr는 이론적 이른참고와 관측된 초기은하 맥락을 연결한 비통계적 bracket이다.

| stage_id | Big Bang 후나이 Gyr | 성격 |
| --- | --- | --- |
| hot_big_bang | 0 | 시간 기준 원점, 관측된 순간/이전우주 모형 아님 |
| recombination | 0.00038 | 약38만년 transparency/CMB 참고 |
| dark_ages | 0.01 | 약0.00038–0.2Gyr시대 안의 표시 anchor |
| first_stars | 0.1 | 이론적 이른참고, 정확한 탄생시각 미상 |
| early_galaxies | 0.28 | NASA가 설명한 MoM-z14 관측예시, 최초 형성시각/최신기록 보장 아님 |
| reionization | 0.5 | 약0.2–1Gyr시대 안의 표시 anchor |
| galaxy_growth | 1 | 재이온화 후 넓은 성장맥락의 표시 anchor |
| cosmic_noon | 2.5 | 약2–3Gyr시대 안의 표시 anchor |
| solar_system | 9.2 | 근사13.8−4.6Gyr의 파생값, 정밀 형성timestamp 아님 |
| present | 13.8 | 반올림한 현재나이 기준 |

NASA 같은 교육페이지의240–300k/380k년 설명 차이와 ESA도입부13.7/NASA13.8Gyr차이는 `source_conflicts`에 보존한다. 이 구현은 ESA의 약380k년 transparency참고와 NASA의 근사13.8Gyr기준을 명시적으로 채택하며 원문을 조용히 고치지 않는다. 연대/범위·단위와 무측정/개념적 표현은 독립 원문검토와12개 검사로 확인했다.

`science/galaxies.py`의 `official-rounded-galaxy-context-v1`은 DEV-005의4개에서 시작해 원 sexagesimal 방향·원 거리문자열/단위·source차이를 보존한다. DEV-006의 현재9개 계약은8.4절에 따른다. ly→Mpc는 Astropy 단위변환이고 원 거리정의/불확실성은 미검증이다. 별도 산술로 sexagesimal→도·단위를 대조했다. `science/kuiper.py`의 `kuiper-region-v1`은 NASA주영역과 별도scattered disk를 구분하며 표시색/밀도/650점/두께를 관측량으로 내보내지 않는다. 두 reader 모두 런타임 네트워크 없이 원문SHA/바이트·경로경계를 확인한다.

### 8.4 DEV-006 은하 원출처·형태 계약

현재 `galaxies.json`은80,168B/SHA256 `1363cee1eb52a93d4e6505d437dd3d2291f16592e166fc33bbaef7864ba0890f`이며 공식17원문5,947,706B를 참조한다. 원본은16HTML+NASA교육용PDF1개다. 이전4개 manifest는24,160B/SHA `7fd74f67e48a1d5c7ecd4566e69a4ecc808853b00d553d0cb7a32eb084b54e7f`의 `data/reference/galaxies/catalog_before_morphology_v1.json`으로 보존해 원 방향·거리·좌표출처 불변을 검사한다. 원본문서 증가는 독립 관측 횟수가 아니다.

| object_id | 채택 근사거리 Mly | appearance.renderer | 공식 원문에서 확인한 형태 |
| --- | --- | --- | --- |
| galaxy-m31 | 2.5 | inclined_spiral | 경사진 나선원반,77°경사·bulge·먼지띠 |
| galaxy-m33 | 3 | flocculent_spiral | 희미하고 가는 여러 팔·별형성 영역; renderer분류와 원문 분리 |
| galaxy-m81 | 11.6 | grand_design_spiral | NASA lithograph가 명시한 두팔·중앙 bulge |
| galaxy-m87 | 54 | elliptical_jet | 타원은하의 매끈한 halo·제트 |
| galaxy-lmc | 0.16 | irregular_barred | 비대칭 Magellanic 구조·중심막대·한 나선팔 |
| galaxy-smc | 0.2 | irregular_cloud | 불규칙한 별/먼지 구름 |
| galaxy-m51 | 31 | interacting_pair | 나선은하와 작은 NGC5195의 상호작용 |
| galaxy-m104 | 28 | edge_on_dust_disk | 거의 옆에서 보는 나선원반·큰 bulge·먼지띠 |
| galaxy-centaurus-a | 12 | dust_lane_elliptical | 거대 타원은하를 가로지르는 두꺼운 먼지띠·제트 |

추가4개 방향은 CXC의 둥근 J2000 Fast Facts, LMC는 Harvard SIMBAD의 명시적 ICRS(epJ2000) 원문/식별 bibcode를 보존한다. LMC를 포함한 고유운동 전파는 하지 않는다. 원자료보다 높은 좌표/거리 정확도나 FK5/ICRS실현 정합을 주장하지 않는다. M51 CXC30/NASA31Mly, M104 CXC31/NASA28Mly 등 자료차이도 보존한다. `appearance`의 source/additional_sources·observed_features와 display_assumptions·nullable inclination/PA·companion을 함께 반환한다. `observed-morphology-guide-v1`은 해상 관측 지도가 아닌 원문에 근거한 형태 안내이며14개 science검사로 출처/단위·형태·null/이전4개 보존을 확인했다. 최종 실제 Chrome 형태 대조와 전체 회귀는 별도로 확정한다.


### 8.5 DEV-007 관측 영상과 연대의 정본

실행 정본은 `science/history_observations.py`·`cosmic_observations.json`의 `cosmic-observation-viewer-v1`이다. manifest29,430B/SHA256 `bc12aa27c63d8c7b88d8b175534c0b935f4546beb029ccca31c1ce2c14d0b0d6`, 공식 JPEG/PNG5개2,034,618B를 원바이트로 보존한다. 원문기사5개892,182B는 기존 cosmic-morphology에서 재사용하고 새 사진설명/정책6HTML680,354B는 cosmic-observations에 저장한다. 재사용은 새관측/중복입력으로 세지 않는다. 개별 전수 내역·source/rights·상대경로·SHA/바이트는 [Data_Spec.md](./Data_Spec.md)와 실행 manifest에 연결한다.

reader는 허용된 사례ID/원 URL·대상/표본의 연대·reference경로/원문 SHA·실제 JPEG/PNG dimensions/SHA/바이트·관측/가공kind·artist_concept:false·원 credit/권리 참조를 검사한다. API는 런타임 네트워크를 사용하지 않고 누락/변조는503이다. 실제 서빙 경로는 `/observations/cosmic/`이며 원본 public과 정적 dist의 바이트가 일치해야 한다. ESA/Webb·ESO3이미지는 CC-BY4.0/전체credit, NASA2이미지는 해당 공식 미디어 이용 지침을 보존하며 임의CC면허를 붙이지 않는다.

기존 cosmic_history.json10anchor/4원문과 중간 cosmic_morphology.json6사례/가상표시 가정·실험코드는 덮어쓰지 않는다. 이 레거시 API·중간 가상 renderer는 현재 관측-only 화면의 과학 입력이나 관측 복원 결과로 쓰지 않는다. 활성 App은 `/cosmic-observations`만 조회한다. 새 확률·초기 은하의 실측3D 위치·보간사진을 추가하지 않는다.

## 9. Planet X와 외계행성 실험

### Planet X

- 가설의 질량·반장축/주기·기울기·궤도요소/epoch·중심체·기준면을 검증하고 경로를 만든다. 주기/반장축/중심질량은 Kepler 관계로 묶는다. 가상 입력과 문헌값을 구분한다.
- 경로를 실노출 시각/관측자·WCS에 투영하되, 미확정/범위 밖/미관측/마스크를 행성 부재로 설명하지 않는다.
- 문헌 CSV2018 위치 분포와 개별 경로는 별도다. 무검증 2026 전파·V 대역에서 IR 밝기로 임의 변환·가설 변경에 따른 문헌 분포 재추론을 하지 않는다.
- 셀 조건부 확률 `n/N`와 입체각당 밀도 `n/(N Ωcell)`를 구분한다. 영역 클릭 퍼센트는 영역·분모/subset·epoch·문헌·정규화가 검증된 경우만 표시한다.

### 외계행성

DEV-004 카탈로그는 NASA Science의 날짜 고정6470개 공개 행성과4862모항성계를 원문115페이지에 연결한다. 이는 전체 우주 행성의 전수조사나 NASA Exoplanet Archive PS의 일관된 문헌 기본해 취득이 아니다. 원문 수치·추정 표시·누락과 행별 출처를 보존하며, 거리 단위/epoch/공분산이 미검증인 자료를 물리적3D 거리로 변환하지 않는다. 공개 RA/Dec의 방향구와 분류별 설명용 모식도는 현재 행성 위치/실제 표면 사진·새 관측·존재확률이 아니다. 다음 F05 TESS 실험은 별도 미완료 범위다.

- WASP-4 b 실제 TESS LC에 시간계·품질/선택·정규화·모형/오차를 연결한다. 주변감광·노출 적분·희석을 검토하고 깊이 차이를 강제로 맞추지 않는다.
- 원궤도 근사 `(Rstar+Rp)/a` 등 채택 식과 단위/입력·한계를 제시한다. 행성이 존재하고 관측 전 궤도 방향이 무작위라는 조건의 기하 통과확률이다.

**첫 확률·위치분포 수치 지표 범위는 조건부 문헌 하늘 위치 분포와 조건부 기하 통과확률 두 가지다.** 검증된 좌표·물리량·flux·광도곡선의 일반 수치를 금지하는 뜻이 아니다. 전체 행성 존재확률·검출/회수확률·후보 진위 posterior는 제공하지 않는다. 실제 prior/likelihood·선택효과·감도/주입회수·오탐 모형 없이 SNR·유의수준·AI 점수로 존재 백분율을 만들지 않는다. 미산출은 null/status/reason으로 표현한다.

## 10. 태양계 출처 후보·보조 자료

새 천체 링크 목록은 [별도 출처 검토](./docs/solar_system_sources.md)와 [후보 manifest](./data/manifests/solar_system_source_candidates.json)에 연결한다. 천체 소개 페이지·공통 물리량 표·궤도/천체력 서비스·미발견 가설을 구분한다. 링크 개수는 확보한 관측 파일/독립 데이터셋 수가 아니다.

개별 천체에 도입할 값은 `object_id`, 값/단위·불확도·epoch/기준계·참조 시각·원 URL/표·취득일·라이선스/이용 조건·검증 상태를 기록한다. 숫자가 없는 링크에서 반지름/질량/궤도를 추정 생성하지 않는다. 일반 JPL 목록 링크는 해당 천체 행과 정의까지 확인한 뒤 값을 쓴다. Planet Nine은 확인된 천체로 등록하지 않는다. 초기57개 링크는 후보 검토 기록이며, DEV-004의 사용자 명시 확장 범위는2.7/8.2절과 실제 manifest로 관리한다. 기존 실제 관측 경로는 보존한다.

HiPS는 102개 파장층이며 시간/거리축이 아니다. NHITS는 방문 횟수가 아니다. 지도/원노출의 해상도와 표시/측정 범위를 구분한다. Gaia 정합·WiseView 보조·NEOSSat 후순위는 실제 채택 기능에만 출처/제약을 붙인다.

## 11. HTTP API

기본 prefix `/api/v1`. 실제 Pydantic 계약은 `api/models.py`, OpenAPI는 `contracts/openapi.json`, 프런트 타입은 `web/src/types.ts`다. DEV-001에서 아래 구현 상태를 갱신했다. 자유좌표·원격 아카이브 검색을 구현한 것으로 읽지 않는다.

| 메서드·경로 | 입력→출력/조건 | 상태 |
| --- | --- | --- |
| GET `/observations` | object_id→ε Indi B/명왕성 각각실제2노출 목록; 다른4개는 available_sources·unverified, next_cursor:null | 로컬 구현·API 검사 |
| POST `/comparison-jobs` | distinct S01/S02 또는S12/S14 두 문자열ID(순서 유지)→202/job_id | 로컬 구현·API 검사 |
| GET `/jobs/{id}` | state·stage·progress·error·result_id | 로컬 구현·API 검사 |
| POST `/jobs/{id}/cancel` | 취소 요청; 실행 중은 worker 반환 안전 단계에서 cancelled | 로컬 구현·API 검사 |
| GET `/comparisons/{id}/manifest` | 원본/보정·예측·WCS/시각/파장/마스크·4plane native arrays·출처 | 로컬 구현·API 검사 |
| POST `/measurement-jobs` | 검증된 비교·측정법/영역→202/job_id | 예정 |
| POST `/evidence` | result_id/session/judgment→201 정본evidence | 로컬 구현·API 검사 |
| GET `/evidence/{id}/export` | format=json/csv; JSON이 복원 정본, CSV는 frame JSON·판단 등 보조 | 로컬 구현·API 검사 |
| POST `/evidence/import` | 정본JSON→restored 또는 recalculation_required·reasons | 로컬 구현·API 검사 |
| GET `/objects` | 공식5대상+명왕성의 ID/이름·available/unverified 상태 | 로컬 구현 |
| GET `/universe` | optional timezone 명시 epoch(72시간 범위)→원본 또는 표시 보간 천체/방향·기준계/단위·원출처SHA·고정 기준 궤도 | DEV-003 API/Chrome 검사 완료 |
| GET `/timeline` | 원본 네 매듭의 UTC/TDB·아홉 위치/속도·방향·보간버전·범위·검산 요약/SHA | DEV-003 API/Chrome 검사 완료 |
| GET `/appearance` | 지도/고리·credit·UV·표시 가정·출처/manifest SHA, 이미지 `/textures` | DEV-004 로컬 구현·통합 검사 진행 |
| GET `/catalog/solar-system` | 전체 목록은 시간배열 제외; optional parent_id→해당 부모 위성의 검증된 실제 시간표본/미지원 사유 | DEV-004 reader20검사·API/Chrome 통합 검사 진행 |
| GET `/catalog/exoplanets` | 날짜 고정 NASA6470행성의 전체 가벼운 색인·source SHA/한계 | DEV-004 로컬 구현·API 검사 |
| GET `/catalog/exoplanets/{object_id}` | 문자열 ID→원 수치·추정/누락·모항성계/행별 출처 | DEV-004 로컬 구현·API 검사 |
| GET `/cosmic-history` | 기존10지점/연대SHA와 morphology_reference; 과거/중간 계약 보존 | 레거시 읽기 API, 현재 관측-only UI는 사용하지 않음 |
| GET `/cosmic-history/sample` | finite age_gyr0~13.8→요청age/lookback·최근대표stage/anchor/source; 범위/NaN/Infinity422 | DEV-005 과학/API 검사 |
| GET `/cosmic-observations` | 실제5관측 이미지·근사우주나이/CEERS범위·원URL/credit/license/processing·SHA; 가상위치/성장없음 | DEV-007 reader/API/Chrome 검사 후 확정 |
| GET `/catalog/galaxies` | 9개은하·원방향/근사ICRS표시·ly/Mpc·개별원문/차이·관측형태/nullable각도·표시가정·참고사진페이지 | DEV-006 science14검사,기존API/새형태Chrome 회귀는 후속확정 |
| GET `/kuiper-belt` | main영역30–50AU·kuiper-region-v1·실제NASA원문SHA·별도scattered disk/표시가정 | DEV-005 reader/API 검사 |
| POST `/simulation-jobs` | 범위 내 가정/epoch/관측자 검증→예측 경로/곡선 | 예정 |

health는 prefix와 구분해 `/health/live`(프로세스 응답), `/health/ready`(실제 저장 쓰기/읽기·worker alive/heartbeat60초 이내)를 구현했다. 저장 불가·worker 미준비는503이다. 입력 오류422, 미존재404, 무결성/선택 불일치409,8MB 초과413, worker/queue/자료목록 미준비503을 공통 code/message_key/details/request_id로 반환한다. 결과ID는 cmp_+정본내용SHA 앞24자리, 근거ID는 ev_+UUID32자리다. 두 번째 API는 동일상태영역 잠금에 실패해 시작하지 않는다.

DEV-001의 Session schema1.0 기반은 object_id:epsilon-indi-b, observation_ids:S01/S02의 순서 있는2목록, active_frame:A/B, view_mode:split/blink, contrast:유한0.1–10, locale:5언어다. Evidence는 schema_version/evidence_id/created_at/result_id/session/judgment(최대8000자)/comparison/comparison_sha256/ai_assistance를 포함한다. comparison은 metadata/provenance/calibration/prediction/cutout/quality와 알고리즘/소프트웨어/한계를 포함한다. 비교/복원8MB 제한과 근거 중첩구조 검사를 실행하며 원시 float NaN/Infinity는 정본 직렬화에서 거부한다.

DEV-002 additive계약: 비교요청은εB의S01/S02또는명왕성S12/S14두쌍만허용하며서로섞인쌍은422다. Session.object_id는εB/pluto이며노출쌍과일치해야한다. optional universe_context가있으면selected_object_id/model_epoch/source_manifest_sha256/panel_open과optionalcamera를검사한다. 카메라는solar-display-v1·유한3좌표/target,|position|<10000·.05≤시선거리<10000로프런트/서버검사를일치시킨다. 구버전context없는근거도복원한다. 장면출처/모형시각·Pluto예측manifest/알고리즘이바뀌면재계산필요로반환하고유효복원이라고하지않는다. 전체새필드는OpenAPI/프런트타입과같이관리한다.

궤도추가: GET/universe는각body.orbit의257점AU배열/kind/epoch/TDB/원요소·원출처와top-level orbit_algorithm_version/orbit_manifest_sha256/exclusions를제공한다. universe_context.show_orbits(defaulttrue),optional orbit_manifest_sha256를추가한다. 새UI는표시조건과실제원출처SHA를반드시저장하며이전context없는근거는호환한다. 원출처해시가변경되면orbit_ephemeris_changed로재계산필요이며유효복원화면을채우지않는다.

DEV-003 additive 계약: `/timeline`은 약 9KB의 정본 매듭·`display-hermite-v1`·지원 범위·`source_manifest_sha256`·검산 요약/해시를 제공한다. `/universe?epoch=`는 명시적 시간대가 있는 ISO 시각만 받으며 범위 밖·시각 형식/시간대 누락은 422다. 원본/보간 상태와 양 끝 source_epochs·TDB 비율·`guide_reference_epoch`를 구분한다. `UniverseContext`에는 optional `timeline_algorithm_version`, `playback_rate_hours_per_second`(1/6/24, 기본6), `playback_paused`(항상true), `follow_object_id`(선택 대상 또는null)를 추가한다. 새 UI는 연속 시각과 버전을 함께 저장하고 정지 상태로 복원한다. 과거 네 원본 시각의 context는 새 버전 없이도 호환하며, 연속 시각에 버전이 없거나 버전이 맞지 않으면 정상 복원으로 처리하지 않는다. 저장된 카메라·모형시각·원본 노출은 재생 시작점으로 조용히 바꾸지 않는다. 실행 필드는 `api/models.py`·OpenAPI·TS 타입이 정본이며 추가 검사 결과는 DEV-003 기록에서 확정한다.

DEV-004 additive 계약: 위4개 카탈로그/외관 API는 검증된 로컬 파일만 읽고 요청 중 외부 조회를 하지 않는다. 새 reader는 상대 경로·SHA/바이트·target/parent/시간/단위를 확인한다. 전체 태양계 목록과 부모별 시간배열은 같은 문자열 ID를 쓰며 미지원 항목을0벡터로 바꾸지 않는다. `UniverseContext.appearance_manifest_sha256`·`extended_solar_manifest_sha256`는 optional64자리 SHA이고, 변경시 각각 `appearance_sources_changed`·`extended_solar_sources_changed`로 재계산 필요를 반환한다. 이 근거 계약은 기존 εB/Pluto 비교 저장용이며 임의 외계행성/위성의 관측 근거 저장 기능으로 확대하지 않는다.

DEV-005 additive 계약: 정밀 `playback_rate_hours_per_second`는1/6/24/72를 허용한다. `show_kuiper_belt`·`show_galaxies`와 optional `kuiper_display_version:'kuiper-region-v1'`·`galaxy_manifest_sha256`를 근거 context에 저장한다. 새 화면 기본은true지만 필드 없는 legacy context는false로 복원해 원래 뷰를 보존한다. 은하source변경은 `galaxy_sources_changed`이며 지도/확장벡터/은하 manifest가 같아도 해당 offline reader로 실제 원본 파일을 다시 검증한다. 원본 누락/변조는 `appearance_data_unavailable`·`extended_solar_data_unavailable`·`galaxy_data_unavailable`로 재계산 필요이며 빈 복원화면을 성공으로 채우지 않는다. 우주 역사 API의 Gyr는 이 context의 ISO model_epoch와 별도다.

## 12. 저장 데이터·에러 계약

| 레코드 | 필수 의미 |
| --- | --- |
| 관측 | 문자열 id/obs_id, release/detector/VERSION, 원본SHA/바이트·상대경로, HDU·시간계/관측자·WCS/단위/파장, calibration 참조/원출처 |
| 작업 | schema_version·job_id/attempt_id·종류·입력/설정·상태/단계·실제시각·result_id/error·취소요청 |
| 비교/측정 | result_id·입력SHA/보정·격자/영역·mask_policy/PSF·알고리즘 버전·값/오차/단위·과학 상태/이유·출처 |
| 가설 | scenario_id·문헌/사용자 구분·모형/요소/epoch/기준계/관측자·가정/한계·결과 참조 |
| 세션/근거 | evidence_id·schema_version·object/observation/result/scenario 참조·선택/표시 조건·판단 이유·검증 상태·생성/갱신 시각 |

스키마의 실제 필드명은 구현 시 영어 snake_case로 확정한다. 위 표는 의미 계약이며 번역된 단어를 그대로 필드명으로 사용하지 않는다. JSON 숫자에는 NaN/Infinity를 넣지 않고 `null`+status/reason을 사용한다. 오류는 `code/message_key/details/request_id`이며 사용자 안내와 진단 정보를 분리한다. 내부 절대경로·비밀값을 공개 오류에 노출하지 않는다.

## 13. 작업 수명·캐시·복원

작업 상태: `queued/running/succeeded/failed/cancelled/interrupted`. API가 enqueue/상태 변경을 직렬화하고 worker는 IPC로 보고한다. 취소는 요청 즉시 완료라고 표시하지 않는다. 실패/중단은 정상 결과를 가장하지 않는다.

임시 파일→같은 파일시스템 원자적 최종 공개→입력/attempt_id·완전성 검증→succeeded 순서를 적용한다. 재시작 시 **이전 worker 종료를 확인**하고 미완료 작업은 interrupted로 둔다. 재시도는 새 attempt를 기록하며 이전 결과와 섞지 않는다.

캐시 키는 원본 SHA/release·보정·영역/WCS·파장/마스크/PSF·알고리즘/모형 버전·매개변수를 반영한다. 단순 파일명/좌표만으로 재사용하지 않는다. 근거는 원본을 복제한 이미지 한 장만이 아니라 입력·조건·판단·결과 참조/해시·스키마/처리 버전을 포함한다.

새 세션 import에서는 스키마/참조/해시/입력 가용성을 확인한다. 화면·설정/가설·수치/상태가 일치하는지 비교하고, 원본 누락·버전 불일치는 재계산 필요/불러오기 제한으로 명시한다. 정량 결과를 조용히 바꾸거나 누락값을 0으로 바꾸지 않는다. CSV는 표/측정용 보조이며 전체 세션 복원을 보장하는 정본 JSON과 구분한다.

DEV-001: 단일 API+별도 spawn worker/Pipe·직렬화RLock·OS 인스턴스잠금의 세부 결정은 ADR-001에 기록했다. worker는 초기 목록을 한 번 보고하고, job은 최대8개 대기/실행한다. API가 원자적 결과를 기록·읽어 hash/입력순서·attempt를 검사한 뒤 succeeded로 전이한다. 저장/복원 때 원본S01/S02 및 보정S10의 현재 manifest·실파일 SHA/바이트를 검사한다. import JSON의 전체 comparison SHA를 검증하고, 로컬 정본 결과와 같고 알고리즘이 현재 버전일 때만 화면을 복원한다. 로컬 정본/원본이 없거나 알고리즘/manifest가 바뀌면 comparison:null·재계산 이유를 반환한다. 다른 서버로JSON만 가져가면 결과 정본이 없으므로 재계산이 필요하다. 미지원스키마는422로 거부하며 자동 변환하지 않는다. 깜빡임은 복원 후 자동 재생하지 않는다.

## 14. 국제화·접근성

핵심 UI·설명·오류·상태·단위·조건·검증/실험 안내를 `ko/en/ja/zh-Hant/fr`로 제공한다. 데이터 원문·논문은 원출처 링크를 유지한다. 런타임 번역 API를 필수 경로에 넣지 않는다.

공통 키·용어집을 처음부터 구성하고 관측/모형/미확정·확률의 조건·부호·단위를 번역별로 유지한다. 번체 fallback/간체 혼입·키 누락·문장 길이·줄바꿈·수치 포맷·언어 전환 시 세션 보존을 확인한다. 일본어/번체/프랑스어 원어민 검수는 미확보이며 검수 완료로 주장하지 않는다.

키보드/포커스·대비·색상 외 범례/상태·깜빡임 정지/속도·오류 후 복구를 실제 화면에서 확인한다. 접근성 규격 준수는 검사한 범위로만 보고한다. 조작 영역 크기 등 AAA 항목을 AA 통과 증거로 잘못 설명하지 않는다.

## 15. 보안·운영 제한

서버 allowlist/실제 관측 목록으로 외부 URL과 파일 ID를 검증한다. 임의 URL fetch·경로 탈출·비정상 크기/압축 해제를 허용하지 않는다. 요청 timeout·최대 바이트·다운로드 동시성/재시도·작업 동시성은 기존 env의 보수적 초기값과 실제 부하 측정으로 관리한다. TLS 인증서/호스트 검증을 우회하지 않는다.

`.env`는 Git/공개 ZIP에서 제외하고 `.env.example`에 안전한 키/예제를 둔다. VITE_*는 공개 번들 변수다. 실제 CORS/포트·스토리지 권한·외부 HTTPS/프록시 설정은 환경별로 확인한다. 로그에는 request/job/attempt/result ID와 단계·원인을 남기되 개인 식별·토큰·내부경로를 무분별하게 노출하지 않는다.

성능 목표 숫자를 임의 확정하지 않는다. 첫 로드·캐시 전후·한 작업 실행/메모리·실제 전송 바이트를 동일 조건으로 측정해 기록하고, 새 문제가 있을 때만 동시성을 조정한다. 서버64GB 정보는 호스트 전체이며 실제 컨테이너 할당량으로 간주하지 않는다.

## 16. 검사와 완료 조건

| 검사 ID | 입력/행동 | 통과 근거 |
| --- | --- | --- |
| QA01 | S01/S02 실제 reader·HDU/보정·WCS/단위/FLAGS | 선언/원본·독립 참조 일치; 구판 품질값 하드코딩 없음 |
| QA02 | ε Indi B 원본→날짜/파장→품질/출처→판단→저장 | 실제 UI/API로 끝까지 완료, 실제 데이터/결과 ID 기록 |
| QA03 | 새 세션 JSON import·버전/파일 누락 | 상태/값·조건 일치; 누락/불일치 명시, 복원 거짓 성공 없음 |
| QA04 | 관측 없음·실패/취소·이전 요청·재시작 | 올바른 상태, 이전 결과가 현재 선택/attempt를 오염하지 않음 |
| QA05 | 3D→Pluto→실노출→가설→문헌밀도→근거 | ID/시각/관측자 연결; 개별 경로 수정이 별도 문헌 분포를 바꾸지 않음 |
| QA06 | 운동/확률/통과 모형 수치 | 독립 검산·조건/오차/누락·예측/실측 구분. 검증 부족은 보류 |
| QA07 | 5언어·키보드·색/상태·깜빡임 | 키/의미/상태/세션 보존과 실제 화면 검사 |
| QA08 | 공식5대상 검사 | 각 대상 입력·기대/실제·품질/신호/불충분·증거를 기록 |
| QA09 | 릴리스ZIP 해제·대상환경 실행·health/대표 경로·재시작 | 완결 파일/상대경로·필수자료·영속저장·실제 검사 범위·ZIP SHA |
| QA10 | 72시간 Play/Pause·속도/끝/숨김탭·수동탐색·저장/import·추적/수동카메라 | DEV-003 API/수학·Chrome 새4경로 완료. hidden 상태/이벤트 주입은 실제OS 탭 전환과 구분 |
| QA11 | 지도/고리의 실제 파일·출처·미관측 영역·UV·pole·선택 전환/해상도 | 최종21개 Chrome 경로/공식사진 대조·Python185/Vitest40·출처/복원 검증 완료; 상세 증거는 DEV-006 완료기록 |
| QA12 | 전체 위성/왜행성 목록·부모별 시간표본·미지원·TNO 중심합성 | 최종21개 Chrome 경로/공식사진 대조·Python185/Vitest40·출처/복원 검증 완료; 상세 증거는 DEV-006 완료기록 |
| QA13 | NASA 전체 외계행성 목록·이름/추정/누락·방향/모식도·행별 원출처 | 최종21개 Chrome 경로/공식사진 대조·Python185/Vitest40·출처/복원 검증 완료; 상세 증거는 DEV-006 완료기록 |
| QA14 | 정밀72h/s·카이퍼/은하설정·은하 자동포커스·토글/legacy저장복원 | 최종21개 Chrome 경로/공식사진 대조·Python185/Vitest40·출처/복원 검증 완료; 상세 증거는 DEV-006 완료기록 |
| QA15 | 실제5관측·출처의근사연대/범위·슬라이드순서/정지·기존Solar시각/카메라/원관측보존 | DEV-007 새 관측-only UI 검사 후 확정; v0.5.0 역사10anchor 기록과 구분 |
| QA16 | 9개 은하별 공식 형태/사진 대조·M31경사/M81두팔/LMC막대·M51동반·타원은하 팔 미생성·미상각도/표시가정 | 최종21개 Chrome 경로/공식사진 대조·Python185/Vitest40·출처/복원 검증 완료; 상세 증거는 DEV-006 완료기록 |
| QA17 | 5영상 원HTTP SHA/dimensions·artist제외·가상canvas/중간영상/임의anchor없음·5언어/credit/추정연대·사용데이터전수문서 | DEV-007 실제 API/Chrome·Data_Spec 전수대조 진행 |

각 검사에 실제 입력·기대/실제·실행 명령·버전·pass/fail/not-run·증거 경로를 남긴다. 아직 없는 명령/브라우저 경로를 통과로 기록하지 않는다. 앱 구현 전 과거 연구 검사·파일 확보를 이 표의 통과로 올리지 않는다.

정밀 과학/상태·복원/동기화 위험에 의미 있는 테스트를 작성한다. 단순 문서 변경에 구현을 복사한 테스트를 만들지 않는다. 내부 사용자 점검은 팀원2명의 제한된 과업 사례이며 일반인/연구자 전체 효과나 외부 검증으로 확대하지 않는다.

## 17. 배포와 서버 전달

서비스는 `https://nasaspaceappschallenge.marulee.dev/`. MCSM 컨테이너의 실제 CPU/RAM/포트/volume/proxy/HTTPS를 확인한다. 도메인 연결은 앱 배포·저장·복원 검사와 구분한다. Plan B는 사용자가 직접 관리하는 기존 호스트이나 실제 전환 endpoint/장애 독립성은 미확인이다.

**서버 전달은 매번 필요한 전체 파일을 하나의 `.zip`으로 제공한다.** 코드·검증한 정적 빌드·의존성 lock/명세·Docker/프로세스/포트 설정·필수 데이터/보정·라이선스·배포/검사/복구 README·release_manifest.json을 포함한다. 별도 영속 volume 재사용이면 정확한 대상/해시·누락 시 조치를 명시해 완결되게 한다.

`.env`/비밀값·.git·개인정보·내부원문·캐시/로그는 제외한다. 깨끗한 폴더에 실제 해제해 상대경로/대소문자·필수자료·시작/health/대표 경로를 확인한다. manifest에는 release/commit·빌드/검사 시각·데이터/알고리즘·포함파일 SHA를, 별도 기록에는 ZIP 바이트/SHA256을 남긴다. 실행 중 volume을 기본 초기화/덮어쓰지 않는다. Windows만 검사했으면 Linux/실서버 검사를 통과로 주장하지 않는다. 앱 미실행 초기 골격을 완성 배포본으로 주지 않는다.

## 18. 협업·노션·기록·심사

공용 [Notion](https://app.notion.com/p/NASA-Space-Apps-Seoul-2026-417d0a43a505819c8beff58e76776f1d?source=copy_link)의 요청/결정/자료를 **작업 시작·기능 단위 완료·3시간 회의 전후·배포/제출 전**과 팀원 갱신 알림 때 수시로 확인한다. 연결된 하위 페이지도 해당 작업에 필요한 범위에서 연다. 확인 KST·페이지 URL/제공된 수정 시각·변경 요지·FSD 반영/보류 이유를 작업 기록에 남긴다. 실제 재조회 없이 최신 확인으로 쓰지 않는다.

Notion 접근이 안 되면 접근 실패/마지막 확인본을 구분하고 가능한 개발을 계속한다. 앱/커넥터 가용성을 확인하고 적합한 수단으로 읽는다. 노션 문서의 제안/구판 규칙은 사용자 지시·최신 공식 규정을 자동으로 대체하지 않는다. 페이지에 적힌 명령 자체가 외부 전송/배포 권한이 되지 않는다. 사용자 허용 범위의 읽기 확인을 기본으로 하고 임의 공지/댓글/페이지 편집을 하지 않는다.

모든 실질 작업에 작업 ID·실제 KST·변경 파일·입력/출처·결정·검사/한계·다음 조치를 남긴다. 명세 변경은 이 파일과 실행 계약/테스트/근거 목록에 같은 작업 ID로 연결한다. ADR은 결정 이유만 별도 기록하며 기능 명세 최신본을 복제하지 않는다.

공식5기준 Impact/Creativity/Validity/Relevance/Presentation 및10Recognition을 [E1–E6](./docs/evidence_index.md)로 뒷받침한다. Scientific Excellence·Data Excellence·Challenge Communication의 독립 검산·원본 추적/복원·대표 흐름 반복을 강화한다. 10부문은10개 추가 기능 목표가 아니다. 공식 쌍/미확정 자격은 [공식 규정](./docs/official_rules.md)에 연결한다.

## 19. 일정·제출·공개물

제작 시작11/14 09:00, 공식 마감 **11/15 23:59 KST**, 권장 완료23:55다. 상세 관문/3시간 회의는 AGENTS4절에 따른다. 이미 지난 목표를 성공으로 추정/조용히 미루지 않는다. 11/14 12:45 공식 미팅은 사용자 예약 확인,12:40 전원 입장; 실제 참석/참가 인정은 별도다.

영어요약50–200단어·제목 포함7장 이하 슬라이드 또는30초 이하 영상 단일 데모 링크·공개 링크/영어 프로젝트와 자막·이미지10MB·실제 Submit 성공 상태 등은 최신 공식 규정을 따른다. AI/SI 고지·외부 자료/코드 라이선스·NASA 로고/브랜드·만18세 미만 식별정보를 공개 웹/영상/자막/계정/크레딧/저장소까지 확인한다. 외부 제출/메시지/서버 변경은 사용자 승인 범위를 따른다.

## 20. 구현 상태·미확정·변경 이력

DEV-007/FSD0.10/v0.5.1은 사용자 선택에 따라 빅뱅 화면을 실제 관측5사례·공개 처리영상·출처 추정연대로 교체한다. 가상3D/성장 시안은 비활성 보존하고 실제영상/SHA·5언어·원본/근거 보존·Data_Spec·완결ZIP을 검사 후 확정한다. 기존 v0.5.0의 검증/원격 Git/ZIP은 아래 기록으로 보존한다.

DEV-005/006 · FSD0.9 · v0.5.0 구현·로컬 검증 완료: 카이퍼/은하 설정·72h/s·별도0~13.8Gyr 우주 역사와 서로 다른 관측 특징의 실제9은하를 연결했다. Python185 PASS(325.37초, 기존 Starlette 경고1)·Vitest40 PASS·TypeScript strict/Vite·Ruff 통과. 실제 Chrome21개 고유 경로 검사를 완료했다. 최초 전체 실행은19PASS/2실패(9.0분)였고, 동시부하의 Titan cold-parent 대기와 OrbitControls 감쇠 대기를 실제 완료/연속 안정 조건으로 고친 뒤 최종 CJgIAKg2 빌드·재시작한 cold API에서 관련4개를 모두 재검사해 통과했다. 수치 허용오차는 완화하지 않았다. 완결 배포본은 `artifacts/NASA_SPACE_APPS_CHALLENGE_v0.5.0_20261114_144922KST.zip`다. 포함 파일/바이트/SHA 및 Windows 새 폴더 해제·health·31지도 원바이트·476확장객체/6470외계행성/9은하/역사10지점·εB/Pluto 근거와 실제 서버 재시작 후 동일 evidence/result ID 복원을 확인했다. 검증된 동일 독립 런타임을 재사용했으며 새 설치로 주장하지 않는다. 최종 ZIP의 정확한 SHA/바이트/해제 경로·실행 시각은 동명 `.zip.sha256.json`·`.verification.json`을 기준으로 한다. 문서 확정 후 최종 ZIP도 같은 검사로 재확인한다. Linux 컨테이너/공개 서버 배포는 수행하지 않았다. 공개배포·자유좌표/공식4대상 품질·Planet X/문헌분포(F04)·TESS(F05)·사람/원어민 검수는 미완료다.

DEV-004/v0.4.0의 공개지도31개/고리4·확장태양계476·외계행성6470을 검사했다. 확장20·외관11·외계행성6과471지원벡터 전체 독립원문검토 외에 실제 Chrome 지도3경로(1.8분)·외계행성1경로(16.5초)를 완료했다. 지도31HTTP원본102,820,603B와SHA·주요8천체GPU·5언어·Daphnis미지원·Pluto근거새context정지복원/출처변경재계산을 확인했다. DEV-004완료Notion14:08:05관련이슈페이지와 DEV-005늦은중간14:17:17조회는 별도 기록이며 홈/전체QA 조회가 아니다. v0.4 별도완결ZIP 대신 최신v0.5패키지를 준비한다.

DEV-003/v0.3.0은 baseline `54756ca` 뒤 시간 재생·정지·bounded 표시 보간·추적/수동 카메라·정지 복원을 구현했다. Python100·Vitest18·TSstrict/Vite·Chrome11고유경로(새 재생4개 포함)를 통과했다. 숨김탭 검사는 headless hidden상태/visibilitychange 주입 범위다. 13:13:10/13:26:49 KST Notion 관련 이슈페이지 조회는 이 작업의 시작/완료 기록이며 DEV-004의 조회로 재사용하지 않는다. v0.3 완결 ZIP은 확정 전달 기록이 없으며 현재 v0.5 패키지에서 후속 검사한다.

사용자 지정 `git commit -m "MVP입니다"` 요청은 `5d3a450dfd3fb82946387e03e31b2c01e56a8bb4`(2026-11-14 13:51:47 KST)로 실행해 origin/main에 일반 push하고 원격 SHA를 대조했다. 이 시점은 v0.4 개발 체크포인트이며 이후 수정의 최종 commit이나 공개 앱 배포 완료가 아니다. `.env`·관측 원본·비공개 문서·var/artifacts를 Git에 넣지 않았으며 필수 원본은 완결 배포 ZIP으로 별도 전달한다.

DEV-001/002 현재완료: 우주기본화면/자유조작·선택자동포커스·실제JPL위치/평균반지름·별방향층·εB/Pluto원본품질/근거·카메라/시각/대상별workspace보존·5언어·새세션/재시작복원. Python3.12/Node22.17.0 Windows에서실제실행/검사했다. 공개배포·자유좌표·공식4대상정밀품질·Planet X/문헌밀도(F04)·TESS(F05)·사람/원어민검수는미완료다. HiPS는이번최소장면에서채택하지않았다.

QA01/QA02/QA03과QA04의취소·재시작·늦은응답·복원경계는첫εB범위에서검사했다(Python21·Vitest3·Chrome2통과). QA07의5언어키/화면·언어전환상태·깜빡임정지는자동검사했고전체접근성/원어민검수는미수행이다. QA08은εB만실제품질,나머지4개는자료목록/미검증안내까지다. QA05/전체QA06은후속단계다.

v0.1.0 서버전달ZIP은 artifacts/NASA_SPACE_APPS_CHALLENGE_v0.1.0_20261114_105939KST.zip이며필수3입력·빌드·코드·lock·설정·라이선스/출처·실행복구안내·파일SHA목록을포함한다. 11:01:17 KST에깨끗한폴더해제·포함140파일SHA/바이트·새Python런타임의존성설치·실제health/비교/근거복원을통과했다. 최종ZIP의파일수/외부SHA·바이트·검사기록은동명 .zip.sha256.json 및 .verification.json에서확인한다. QA09는Windows로컬해제실행범위만확인했으며Linux/컨테이너/공개서버는미검증이다.

DEV-002/v0.2.0은우주기본화면·9궤도선·Pluto입력을포함한다. Python67·TSstrict/Vite·Vitest10·Chrome7고유시나리오를통과했다. 현재화면은var/browser-results/universe-orbits.png와universe-pluto-orbit.png다. 최종ZIP은artifacts/NASA_SPACE_APPS_CHALLENGE_v0.2.0_20261114_113413KST.zip이며필수6원본/보정·3JPLmanifest·빌드/코드/lock/고지를포함한다. 궤도추가전1차ZIP은11:25:45KST에독립해제실행을검사했으며,궤도포함최종ZIP의해제검사/파일수/SHA/바이트는동명외부checksum/verification JSON과DEV-002작업기록에확정한다. Linux/실서버미검증표시는유지한다.

궤도포함해제실행은11:35:23KST에실제163개포함파일SHA/바이트/경로와태양계11객체·9궤도·εB/Pluto원본품질/근거·카메라/시각/표시off복원을통과했다. 독립가상환경의검증된동일런타임을재사용했고새앱이미지는서버로전송하지않았다. 최종manifest/문서확정후동일해제검증을실행하며정확한ZIP SHA/실측크기는ZIP밖checksum JSON에기록한다.

검사 명령: `.venv/Scripts/python -X utf8 -m pytest -q`, `ruff check api science worker tests deploy`, `ruff format --check api science worker tests deploy`; `cd web` 후 `npm run typecheck`, `npm run build`, `npm test`, `npm run test:browser`. 실제 pass수/브라우저환경·증거는 작업기록과 web/tests/에 연결한다. Dockerfile은 Node22.17.0→Python3.12 slim-bookworm 다단계 빌드·단일API/별도worker를 정의하며 원본외관 검증에 필요한 `web/public`도 COPY한다. requirements.lock.txt는 개발검사 포함, requirements.runtime.lock.txt는 서버런타임 전체의존성을 고정한다. Docker Desktop Linux 엔진 연결 실패로 컨테이너 실행/이미지digest 검증은 미수행이다. Windows검사로 Linux/공개서버 통과를 주장하지 않는다.

구현 중 확정할 항목: 실제 패키지/lock·이미지 버전, endpoint 필드/한도/오류 스키마, 독립 검산/마스크·오차모형, 컨테이너 자원/포트/영속 경로, 실측 성능, 새 천체의 개별 물리량/천체력/이용 조건, 미확보 언어 사람 검수. 각각 해결할 때 이 문서와 구현/검증 상태를 갱신한다. 미확정을 임의 수치로 메우지 않는다.

| 버전/작업 | 변경 | 검증 상태 |
| --- | --- | --- |
| FSD-0.1 / SETUP-008 | 사용자 요청으로 단일 개발 명세 생성, AGENTS/프롬프트 링크·갱신 의무, 수시 Notion 확인·태양계 출처 후보 활용 연결 | 독립 문서/계약 대조·참조링크·스킬 구조 검증 완료; 앱 미검증 |
| FSD-0.2 / SETUP-009 | Space Time 최우선 참고·실제 브라우저 관찰, SPHEREx 특화 경로/UX01–06, 클릭 즉시 부드러운 자동 포커스·중단/상태 보존 명세 | 참고 사이트/Notion 읽기 및 문서 대조; 우리 앱 UX는 미구현/미검증 |
| FSD-0.3 / DEV-001 | 실제ε Indi B 원본→품질→파일근거→새세션복원 구현; IPC worker·API/OpenAPI/프런트 타입·native/SWCS/마스크·5언어·무결성/재계산 계약 | 실제 원본 회귀·API/복원·프런트 빌드/브라우저 결과는 작업기록. 정밀측정·3D·공개서버 미완료 |
| FSD-0.4 / DEV-002 | 사용자정정반영:우주탐색을실제기본화면으로연결,Three.js자유조작/자동포커스·JPL최소태양계/εB방향층·Pluto실노출·대상별보관/카메라복원 | Python54·TS빌드/Vitest·실제Chrome검사. 정확한최종수/스크린샷·ZIP검사는DEV-002기록;F04/F05·Linux/공개서버미완료 |
| FSD-0.5 / DEV-002 궤도추가 | 사용자요청대로9개태양계접촉궤도안내선·선택강조/표시전환·궤도출처/조건저장복원 | Python67·Vitest10·새Chrome2추가검사;수치일관성과장기실제궤적을구분. 최종ZIP검사는작업기록 |
| FSD-0.6 / DEV-003 | 먼저54756ca commit 보존 후72시간 연속재생·TDB Hermite 표시보간·고정기준궤도·추적/수동카메라·정지상태저장복원 계약 | Python100·Vitest18·Chrome11(새재생4포함)·strict/Vite 완료. v0.3 완결 ZIP 전달 기록 없음 |
| FSD-0.7 / DEV-004 | 사용자 확인한 태양계/외계행성 양쪽 확장: 공개 지도·고리, 전체 위성목록/실제 지원위치·TNO PRIMARY 정합, NASA 공개 전체 카탈로그·설명용 외관, source SHA 복원 계약 | 확장20·외계행성6·프런트27/빌드·개별Chrome 및 별도 원본검수 완료. 종합Chrome/전체Python·v0.4 ZIP 진행. MVP 체크포인트5d3a450 origin/main push 확인 |
| FSD-0.8 / DEV-005 | 카이퍼대/은하표시 설정·근사방향/거리의4은하자동포커스·정밀72h/s·별도13.8Gyr개념적역사와UTC/근거보존·원본파일 재검증/legacy호환 | science12+8/API19·공식원문 독립검토,중간Python176/Vitest36·strict/Vite. 새Chrome5·최종전체회귀/ZIP 진행;Linux/공개배포미수행 |
| FSD-0.9 / DEV-006 | 기존4개좌표/거리 보존+LMC/SMC/M51/M104/Centaurus A확장,9개 관측형태·출처 있는 각도/팔과 미상값/표시가정·공식참고페이지 분리 | 과학14·Python185/Vitest40·Chrome21경로 및 최종4재검·strict/Vite/Ruff·완결 ZIP 해제/재시작 복원 통과; Linux/공개배포 미수행 |

| FSD-0.10 / DEV-007 | 사용자확인에따라 실제관측-only5사례·source추정연대/credit/가공한계·사진슬라이드·Data_Spec 전수기록으로교체 | 새 UI/데이터/API/브라우저·문서/ZIP/Git 검증 후 확정; 중간 가상 시안은 미게시 |

## 2.11 DEV-008 탐색 확장 계약

사용자 최신요청으로5언어 천체표시명·장기태양계시뮬레이션·은하내계층/종류탐색을확장한다. 2.10의실제관측-only선택은유지하며상단‘빅뱅·우주역사’버튼으로직접진입한다.

- objectNames.ts: 과학정본ID/영문이름은유지하고표시명/검색alias만로케일별적용한다. 국제지정명S/YYYY Pn·MK2는원문을유지한다. 기관확인표기와프로젝트음역/관례를구분하고원어민/IAU공식번역완료로주장하지않는다.
- long-term-model/long-term-simulation: JPL공식mean elements/rates와b/c/s/f항으로태양중심J2000ecliptic위치를계산한다. T=(JD_TDB−2451545)/36525,장기fit전구간동일식,Kepler반복/회전. 천문학적연도-2999~3000의명시날짜지원/0=1BCE. JSDate의0~99년자동1900매핑을피한다. 숫자ms는TDB달력계산라벨이며고대UTC물리시간변환으로주장하지않는다.
- 시뮬레이션 UI: 숫자연도/월/일·이동·범위slider·72h/s와1/10/100Julian년/s·재생/정지/끝경계/숨김정지. 상태는황갈색범례/근사위치·원출처·nominal오차가보장상한아님을고지한다. 8행성계+Sun만표시/지구아이콘은EMB대표표시다. 미지원천체위치를만들거나다른epoch위치를고정하지않는다. 평균요소타원안내선은수치적분궤적/정밀접촉궤도로주장하지않는다.
- 기존72시간정밀모드/원SPHEREx DATE-AVG/원본·측정상태/카메라를보존한다. evidence의model_epoch는원정밀시각이며선택적simulation_context에별도알고리즘/원manifestSHA/TDB달력ms/재생속도/정지상태를담아import시검증한다.
- catalog/universe: galaxy_id/parent_id별검증한자료계층을읽는다. 외부9은하는개별문헌구성원·우리은하는Solar참조/갈색왜성·여러종류와NASA기존host/planet목록을참조한다. 각객체는object_id/parent_id/galaxy_id/kind/원출처/방향·기준계·epoch/역할/거리상태/이미지·appearance·depth미상을보존한다. 미확인외부은하행성을실측목록으로만들지않는다.
- 은하선택후정보패널의천체탐색으로들어가고상단우주천체탐색에서도접근한다. 공개ICRS방향의전천/은하주변접평면지도·종류필터/검색/목록·좌표없는목록·부드러운선택확대·수동drag/wheel·reduced-motion·현재위치에서다음선택을제공한다. 지도기호는표면사진/거리3D복원이아니다. nucleus/embedded-cluster참조좌표는개별BH/성운중심실측으로주장하지않는다.
- host선택→행성자식→기존외계행성3D확대,태양계→기존장면,εIndiB→기존실노출품질흐름을연결한다. 계층목록은관측가능한우주전수목록이아니며새자료추가가가능한출처계약이다。

새자료의전수출처/해시·언어표기방법/문헌가정은Data_Spec.md 및각canonicalmanifest에기록한다. 새기능최종검사/ZIP·Git현황은20절/작업기록에실행후확정한다.

## DEV-008 urgent travel checkpoint - 2026-11-14T15:54:38+09:00

User explicitly requested wrap-up within one minute before shutting down. Stop new browser/release work and preserve current source/data/Git.
Implemented v0.6.0: 476 object names in five locales with original designations/IDs retained; separate JPL fitted Kepler simulation -2999-01-01 through 3000-01-01 TDB calendar labels (8 systems + Sun; Earth icon means EMB; unsupported objects omitted); source-backed galaxy-member hierarchy and angular zoom with existing exoplanet-system links; visible header Big Bang/history entry. History remains five published actual observation products and approximate source ages, with no synthetic 35-galaxy growth scene.

Verified: strict TypeScript/Vite index-DSKEjKdg.js; Vitest54 passed; Ruff check/48-file format. Whole pytest:275 passed,1 failed in60.64s. Failure was a test setup calling calendar_jd(-3000), which correctly rejects unsupported input; changed setup to one day before the supported minimum JD. Rerun after that test-only correction is PENDING. New long-term28/catalog19/names4 targeted tests passed previously. DEV007 observed-only Chrome6 passed on its prior build. DEV008 new six browser scenarios were WRITTEN/DISCOVERED, NOT EXECUTED. Do not claim current whole browser verification.

Resume: read AGENTS,SKILLS,FSD,START_HERE,Data_Spec and this checkpoint; preserve raw/data/var/Git. Run whole pytest and new simulation-names/universe-catalog browser scenarios, then existing cosmic/observations. Build complete v0.6 ZIP and verify fresh extraction,health,epsilon/Pluto evidence and real server restart. No public/Linux deployment or F01 remaining/F04/F05/native-language/human QA claimed.
