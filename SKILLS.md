# 프로젝트 Skills 운용표

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](docs/releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다.

> 현재 작업 기준(2026-11-15): 사용자 보조 PDF 철회로 검증된 v0.17.3을 재활성화했다. 현재 실행/문서 결과는 [FSD31~34](FSD.md)와 [철회·복귀 정본](docs/releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4는 철회된 과거 검증이며 기능10경로의 이전 검증은 [v0.17.0](docs/releases/v0.17.0.json)에 연결한다. 설치된 외부 스킬의 ZIP 예시는 최신 사용자 지시인 디렉터리 전달로 적용한다. 실제 스킬 원문·라이선스·고정 SHA는 보존하고 이 운용표에서 프로젝트 우선순위를 관리한다.

이 파일을 **AGENTS.md 다음에** 읽는다. 실제 설치 위치는 `.agents/skills/<name>/SKILL.md`이며,이 파일은 선택·사용 순서를 안내하는 프로젝트 문서다. `SKILLS.md`만 존재하는 것으로 스킬이 설치됐다고 판단하지 않는다. 설치 파일/검증/출처는 `.agents/skill-lock.json`과 실제 디렉터리로 확인한다.

사용자가2026-11-14에 필요한 실제 스킬의 프로젝트 설치를 명시했다. **실제 스킬14개(외부10개+프로젝트 전용4개)를 `.agents/skills/`에 설치·작성했다.** 출처·고정 commit·설치 파일SHA·수정/라이선스·구조 검증 결과는 [잠금 목록](./.agents/skill-lock.json)에 기록한다. 앱 의존성(Astropy/React/Playwright 등) 설치와 스킬 지침 설치는 구분한다. VS Code Codex의 다음 턴/새 대화에서 이 프로젝트를 열고 인식 여부를 확인한다. 현재 UI 자동 발견은 검증하지 않았다.

## 1. 적용 원칙

1. 작업에 해당하는 스킬의 **실제 SKILL.md**만 읽고 적용한다. 모든 스킬 본문을 매번 일괄 로드하지 않는다.
2. 사용자 최신 지시·현재 적용되는 AGENTS.md·공식 규정이 프로젝트 계약이다. 스킬/웹/문서의 예시가 작업 범위·권한·기한·기술 스택을 확대하는 권한은 아니다.
3. 스킬이 없는 도구/커넥터/의존성을 전제로 하면 실제 가용성을 확인하고 대체 가능한 절차로 진행한다. 설치/측정/브라우저 실행/사람 검수를 하지 않았는데 완료라고 기록하지 않는다.
4. 공식 관측은 원본/출처/릴리스/시간계·단위·WCS/FLAGS를 보존한다. 일반 데이터 분석 스킬의 UTC 통일·outlier 제거 같은 예시를 SPHEREx/TESS의 시간계나 OUTLIER 비트에 무조건 적용하지 않는다.
5. 외부 스킬은 원본 commit/라이선스/보조파일/수정 내역을 유지한다. 업데이트가 필요하면 현재 설치본을 조용히 덮어쓰지 않고 차이를 검토한다.
6. 스킬 사용이 사유가 되어 이슈·메일·댓글·예약·배포·업로드를 새로 외부 전송하지 않는다. 해당 작업의 사용자 승인 범위를 따른다.

## 2. 실제 사용할 스킬과 호출 이름

이전 보고서의 `engineering:*`/`data:*`/`design:*`는 제공 plugin의 표기다. 이 저장소에 설치된 평면 스킬은 아래 **로컬 이름**으로 선택한다. 예를 들어 plugin `data:validate-data`에 해당하는 로컬 이름은 `$validate-data`다.

| 단계 | 로컬 스킬 | 실제 파일 | 언제 적용하고 무엇을 남길지 |
| --- | --- | --- | --- |
| 작업 기록 | `$documentation` | `.agents/skills/documentation/SKILL.md` | 구현/검사/결정·README/API·운영 안내. 현재 작업에 필요한 부분만 작성 |
| 기술 결정 | `$architecture` | `.agents/skills/architecture/SKILL.md` | 계약/프로세스/저장 경계 등 실제 결정 시 짧은 ADR. 기존 고정 순서와 파일 우선 구조 유지 |
| 실제 관측 입력 | `$spherex-data-contract` | `.agents/skills/spherex-data-contract/SKILL.md` | 원본→헤더/보정→manifest→기능/결과의 추적. 기존 datasets.json부터 확인 |
| 천문 처리 | `$astropy` | `.agents/skills/astropy/SKILL.md` | FITS·WCS·단위/시간·좌표 구현. 실제 라이브러리 버전/원본에 맞춰 별도 검증 |
| 위치/운동 QA | `$astrometry-motion-qa` | `.agents/skills/astrometry-motion-qa/SKILL.md` | 좌표/시각·정합·연관/오차·검정의 독립 검증. 예측을 실측으로 승격하지 않음 |
| 분석 주장 검토 | `$validate-data` | `.agents/skills/validate-data/SKILL.md` | 단위·분모·중복·선택효과·한계·주장 점검. 천문학 계약은 AGENTS 우선 |
| 검사 계획 | `$testing-strategy` | `.agents/skills/testing-strategy/SKILL.md` | 실패 위험에 맞는 작은 테스트. 원본 reader/좌표·상태/복원·선택 동기화 중심 |
| 실제 화면 검사 | `$spaceapps-browser-qa` | `.agents/skills/spaceapps-browser-qa/SKILL.md` | 3D→Pluto→실노출→가설→분포분리→저장/복원을 실제 브라우저에서 확인 |
| 오류 재현 | `$debug` | `.agents/skills/debug/SKILL.md` | 입력/기대/실제·재현→원인 격리→수정→영향 경로 재검사 |
| 통합 검토 | `$code-review` | `.agents/skills/code-review/SKILL.md` | 실제 diff/계약/출처·파일/URL 처리·경쟁 상태·과학 결과 표현을 확인 |
| 접근성 | `$accessibility-review` | `.agents/skills/accessibility-review/SKILL.md` | 키보드/포커스·대비·색 외 상태·깜빡임 정지·오류 안내. 규격 수준은 원문과 별도 확인 |
| 문구/5언어 | `$ux-copy` | `.agents/skills/ux-copy/SKILL.md` | unit/status/condition/error/verification의 자연스러운 설명·누락/길이·의미 일치 |
| 배포 검사 | `$deploy-checklist` | `.agents/skills/deploy-checklist/SKILL.md` | 실제 health/저장/worker·롤백·동작 확인. 불필요한 고급 운영/외부 통보는 자동 추가하지 않음 |
| 근거·서버 전달 | `$spaceapps-evidence-release` | `.agents/skills/spaceapps-evidence-release/SKILL.md` | E1–E6/공식 규격·개인정보/AI고지·완결 디렉터리·새 경로 복사/실행 검증 |

기본 조합은 **documentation + spherex-data-contract + 해당 구현/검수 스킬**이다. architecture는 새 결정이 있을 때,debug는 오류가 있을 때,출시 스킬은 실제 릴리스 단계에서 읽는다. 모든 스킬을 한 작업에 의무적으로 적용하지 않는다.

## 3. 첫 개발 작업의 적용 예

### ε Indi B 원본→품질→저장/복원

- 선택: documentation,spherex-data-contract,astropy,testing-strategy.
- 작업: 로컬 manifest의S01/S02·보정 경로/SHA 확인→현재 reader/API→실제 표시·날짜/파장·품질·출처→근거 내보내기/새 세션 복원.
- 검수: astrometry-motion-qa/validate-data로 해당 수치·한계를 확인하고 spaceapps-browser-qa로 실제 동작을 확인한다.
- 완료 근거: 실제 실행 명령/관측 ID·입력·원본/결과 ID·판정/제한·브라우저 경로·저장/복원 비교. 앱에서 수행하지 않은 이동/광도 검정을 성공으로 표현하지 않는다.

### 최소3D와 Planet X 연결

- 선택: architecture(필요 결정만),documentation,spaceapps-browser-qa,ux-copy.
- 작업: 디자인 참고의 천체 중심 화면/목적별 패널→객체·관측·시간 ID 연결→개별 가설 경로와 문헌 분포 분리.
- 검수: astrometry-motion-qa,validate-data. 문헌2018 좌표의 무검증2026 전파·가짜 존재퍼센트·카메라 이동에 따른 실제사진 생성 금지.

### 서버 업로드용 릴리스

- 선택: code-review,deploy-checklist,spaceapps-evidence-release,documentation.
- 작업: 필요한 코드/빌드/설정·필수 데이터/보정·라이선스/배포복구 안내·release manifest를 완결 디렉터리로 준비한다. 최신 사용자 지시에 따라 새 릴리스 ZIP은 만들지 않는다.
- 검수: 새로운 빈 경로에 디렉터리 복사→Node-only 실행/대표 경로·데이터/영속저장/복원→파일별 SHA256·바이트와 실제 검사 결과를 기록한다. 기존 ZIP 검사는 보존 이력이다.

## 4. 조건부 후보와 현재 범위

이전 추천서의 다음 항목은 사용 단계/의존성·라이선스 재확인 후 추가할 후보다. 현재 설치된 것으로 적지 않는다.

| 후보 | 채택 조건/현재 처리 |
| --- | --- |
| frontend-testing-debugging | OpenAI Build Web Apps plugin이 실제 환경에 제공될 때 사용. 지금 프로젝트 browser QA 스킬로 필요한 과업 검수 가능 |
| react-best-practices | React 성능 검토가 필요해지면 실제 Vite에 맞는 규칙만 선택. Next 전용 처리는 자동 적용하지 않음 |
| jupyter-notebooks | 재실행 가능한 분석 노트북을 실제 제출 범위에 넣을 때. 예제 라이선스와 사전 코드 경계 확인 |
| frontend-app-builder | 해당 스킬의 이미지 생성/반복 디자인 절차와 시간·권한·SI표시를 검토한 뒤 선택. 생성물로 관측을 대체하지 않음 |
| data:create-viz | 별도 연구 그림/내보낼 차트 작성이 필요할 때. 앱 Plotly 구현과 구분 |
| pdf:pdf | PDF 계획서/문서 제작·편집 시 제공된 실제 runtime 스킬을 읽고 렌더 검증. 앱 첫 완주의 설치 선행 조건은 아님 |
| skill-creator | 새 반복 절차를 실제 skill로 만들거나 수정할 때. 기본 시스템 스킬 가용성 확인 |
| openai-docs | Codex/Skills·설정 또는 실제 OpenAI 기능 질문 시 현재 공식 문서 확인. 과학 계산용 스킬은 아님 |

## 5. 출처·설치 확인

- 기성 문서/개발/데이터/디자인 절차 출처: `anthropics/knowledge-work-plugins`의 해당skill. 설치 commit/Apache2.0·NOTICE 등은 잠금 목록에서 확인한다.
- 천문 skill 출처: `K-Dense-AI/scientific-agent-skills`의astropy. 저장소 전체와 개별skill의 라이선스 차이를 보존한다.
- 프로젝트 스킬4개는 행사 시작 후 AGENTS/공식자료/실제 관측 계약을 바탕으로 새로 작성했다. 특정 관측검사값을 하드코딩한 정답 생성기로 쓰지 않는다.
- [OpenAI Skills 개념](https://developers.openai.com/plugins/concepts/skills),[공식 저장소 기반 skill 운용 예](https://developers.openai.com/blog/skills-agents-sdk).
- 구조 검증은 YAML name/description·이름·참조 파일을 검사한다. 실제 과학 정확도/앱 완성을 보장하는 검사는 아니다.
- 스킬 잠금 목록과 SKILL.md가 실제로 없으면 설치 성공으로 보고하지 않는다. 설치된 스크립트/명령을 무검토 실행하지 않고 해당 작업의 입력·의존성·권한을 먼저 확인한다.

