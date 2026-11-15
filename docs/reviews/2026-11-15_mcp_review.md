# 태양계 1000 AU 전환: 요청한 MCP 3개 원문·소스 검토

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](../releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다. Git 구현 a55a0e0·철회 d3be874의 main push를 확인했다.

> 현행 연결(2026-11-15): 이 문서는 작성 당시 결정·검토 기록이다. 당시의 “미구현/예정”은 현재 상태 판정이 아니다. 현재 태양계1000AU·제9행성/실관측 범위와 Node 전용 실행, 실제 궤도 유사도 TOP5·PC Chrome 권장·모바일 안내, 새 EC2 검증은 [FSD31~34](../../FSD.md)와 v0.17.3 재활성화의 [철회·복귀 정본](../releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4는 철회된 과거 검증이며 [v0.17.0](../releases/v0.17.0.json)은10기능경로의 당시 검증 스냅샷이다. 외부 자료를 이번 문서 정리에서 다시 조회한 것으로 주장하지 않는다.

검토일: 2026-11-15 KST. 최초 검토 상태는 설치 전이었다. **현재는8절의 격리 설치·실제 MCP 호출까지 완료**했으며, 제품 관측/발견 검증과는 구분한다.

이 문서는 읽은 저장소의 사실과 도입 권고를 남기는 검토 기록이다. 최신 개발 명세는 [FSD.md](../../FSD.md)에서만 관리한다. 기존 사용자 코드·Git 변경·원자료는 수정하지 않았다. 최초 검토 때의 MD 우선 중단은 수정·독립검토·보고를 마쳐 해제됐으며, 이후 실제 실행 결과는8절에 이어 기록한다.

## 1. 결론

세 MCP는 역할이 다르다. **Horizons는 알려진 태양계 천체의 독립 천체력 조회, PDS는 관측 자료의 검색·식별·출처 확인, Astronomy는 지원하는 태양계 천체의 오프라인 교차 점검**에 사용할 수 있다. 어느 것도 미발견 제9행성의 존재확률·후보 진위·전체 물리환경을 계산하는 엔진은 아니다.

현재 제품의 Node.js 전용 실행 계약에 세 서버를 필수 의존성으로 넣는 것은 적절하지 않다. 개발 도구로 분리하고, 채택한 응답을 출처·입력·원문·SHA와 함께 검토한 후 제품 데이터로 넣는 방식이 맞다. 웹사이트가 매 요청마다 LLM/MCP 응답을 기다리도록 만들 필요도 없다.

## 2. 확인한 버전과 실제 실행 요구사항

GitHub `main`의 commit API와 해당 SHA에 고정한 원문을 읽었다. 아래 SHA는 이 검토 시점의 스냅샷이며 향후 최신 버전을 보장하지 않는다.

| 저장소 | 확인 SHA / commit 시각 UTC | 패키지 버전 | 언어·실행 요구 | 라이선스 |
| --- | --- | --- | --- | --- |
| [pipeworx-io/mcp-horizons-nasa](https://github.com/pipeworx-io/mcp-horizons-nasa) | `ebe1de1b9ce340188015fcc2c9b6cc1fa4eccec0` / 2026-11-09 14:08:22 | `@pipeworx/mcp-horizons-nasa` 0.2.1 | JavaScript ESM, Node >=18, 직접 npm 의존성 없음 | MIT |
| [NASA-PDS/pds-mcp-server](https://github.com/NASA-PDS/pds-mcp-server) | `2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd` / 2026-08-23 22:13:56 | `pds-mcp-server` 0.2.0 | Python **>=3.13**, FastMCP | MIT |
| [cyanheads/astronomy-mcp-server](https://github.com/cyanheads/astronomy-mcp-server) | `9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d` / 2026-10-28 18:03:29 | `@cyanheads/astronomy-mcp-server` 0.5.0 | TypeScript/ESM, **Node >=24 또는 Bun >=1.4** | Apache-2.0 |

현재 프로젝트에서 확인한 Node 22.17.0은 Pipeworx의 선언 범위에 들어간다. Cyanheads 최신판의 선언된 Node 요구사항에는 미달한다. 프로젝트의 선택적 Python 3.12도 PDS 최신판의 선언된 요구사항에는 미달한다. 설치해 보지 않은 상태에서 호환·성능·기능 검증 완료로 쓰지 않는다.

근거: 각 SHA의 [Pipeworx package.json](https://github.com/pipeworx-io/mcp-horizons-nasa/blob/ebe1de1b9ce340188015fcc2c9b6cc1fa4eccec0/package.json), [PDS pyproject.toml](https://github.com/NASA-PDS/pds-mcp-server/blob/2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd/pyproject.toml), [Cyanheads package.json](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/package.json).

## 3. Pipeworx Horizons: 알려진 천체의 천체력에 활용

실제 공개 도구 정의는 네 개다.

- `lookup(query)`: 이름을 SPK ID로 해석한다.
- `ephemeris(command, center, start_time, stop_time, step_size, table_type)`: `OBSERVER`, `VECTORS`, `ELEMENTS` 종류를 받는다.
- `observers(...)`: 관측자 표 편의 호출이다.
- `vectors(...)`: 위치·속도 벡터 표 편의 호출이다.

기본 중심은 `500@399`, 즉 지구 중심이다. 태양 중심 벡터를 원하면 중심을 명시하고 실제 응답 헤더의 중심·기준면·시간계·단위·광행시간 보정 상태를 확인해야 한다. 이름이 모호한 천체는 조회가 실제 선택한 ID와 이름을 보존한다. 작은 천체 번호와 행성 본체·계 질량중심을 혼동하지 않는다. [고정된 tools.json](https://github.com/pipeworx-io/mcp-horizons-nasa/blob/ebe1de1b9ce340188015fcc2c9b6cc1fa4eccec0/tools.json)

**이 npm 패키지는 NASA API를 로컬에서 직접 구현한 서버가 아니다.** `lib/index.js`는 모든 호출을 Pipeworx 게이트웨이로 보내는 relay다. 공개 저장소에 NASA 어댑터의 실제 서버 구현은 포함되어 있지 않다. 로컬 stdio 프로세스를 실행해도 네트워크·게이트웨이에 의존한다. 직접 연결 주소는 `https://gateway.pipeworx.io/horizons-nasa/mcp`이며, README는 NASA와 무관한 비공식 연동임을 명시한다. [relay 소스](https://github.com/pipeworx-io/mcp-horizons-nasa/blob/ebe1de1b9ce340188015fcc2c9b6cc1fa4eccec0/lib/index.js)

README 기준 익명 호출 한도는 하루 50회, 무료 계정은 200회다. 추가 키는 `PIPEWORX_API_KEY`이며 **NASA 키가 아니라 게이트웨이 키**다. 실제 현재 요금·사용 가능량은 접속 때 다시 확인해야 한다. 원격 MCP 주소는 공통 meta-tool들도 함께 노출한다. 로컬 npm bridge는 기본적으로 이 팩의 네 도구만 열거하고 `PIPEWORX_META_TOOLS=1`이면 공통 도구까지 열거한다. [고정 README](https://github.com/pipeworx-io/mcp-horizons-nasa/blob/ebe1de1b9ce340188015fcc2c9b6cc1fa4eccec0/README.md)

권고:

1. 알려진 TNO·왜행성의 이름/ID와 선택한 epoch의 상태 벡터·궤도요소를 조사하는 개발용 참고 도구로 사용한다.
2. 제품용 정본은 가능하면 공식 JPL 원응답으로 별도 확인하고, 서로 같은 원천인 두 조회를 독립 관측 두 개로 세지 않는다.
3. 이 도구 스키마는 개별 사용자 가설의 `a/e/i/omega/Omega/M/epoch`를 일반적으로 입력하는 궤도 적분 인터페이스가 아니다. 미발견 Planet Nine을 알려진 천체처럼 조회하거나 새 존재확률을 산출하는 용도로 쓰지 않는다.
4. 쿼리의 object ID·center·table type·step·시각과 원문 응답·조회 시각·전체 SHA를 저장한다. 도구의 요약 문장만 과학 정본으로 채택하지 않는다.

## 4. NASA PDS: 관측·표면 자료의 검색과 출처 확인

`src/pds_mcp_server.py`에서 확인한 도구는 `search_investigations`, `search_targets`, `search_instrument_hosts`, `search_instruments`, `crawl_context_product`, `search_collections`, `get_product`의 일곱 개다. 자원 네 개는 표적·기기·플랫폼·조사 유형 목록이다. 실제 조회 대상은 `https://pds.mcp.nasa.gov/api/search/1/products`다. [서버 소스](https://github.com/NASA-PDS/pds-mcp-server/blob/2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd/src/pds_mcp_server.py)

태양계 천체를 촬영하거나 측정한 임무·관측 장비·collection·PDS 제품을 찾는 데 적합하다. 그러나 검색 결과의 label/metadata나 원자료 링크를 받는 것과 실제 영상·형상·질량 자료를 확보해 보정·검증한 것은 별개다. 궤도 적분, 미확인 표면 생성, 제9행성 발견·존재확률 계산 기능은 없다.

패키지 핵심 의존성은 `fastmcp`, `httpx`, `pydantic`, `pyyaml`, `requests`다. 전체 `requirements.txt`의 Gradio·smolagents·OpenAI 관련 extras는 시연/연구 클라이언트까지 포함한 추가 구성이다. **공개 PDS 검색 서버 자체에 LLM API 키를 필수로 요구하는 소스는 확인되지 않았다.** 기존 연구용 AI 평가 경로를 제품의 필수 의존성으로 가져오지 않는다. [pyproject](https://github.com/NASA-PDS/pds-mcp-server/blob/2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd/pyproject.toml), [requirements](https://github.com/NASA-PDS/pds-mcp-server/blob/2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd/requirements.txt)

문서의 시작 방법은 Python 모듈을 실행하는 MCP 클라이언트 구성이고, 엔트리는 `mcp.run()`이다. 현재 Node 전용 운영 서버 안에 설치하는 방식은 채택하지 않는다. 별도 개발 환경 또는 향후 확인한 원격 서비스로 분리할 수 있다. 현재 저장소 원문만으로 운영 가능한 공개 MCP URL을 확인했다고 쓰지 않는다. [개발 안내](https://github.com/NASA-PDS/pds-mcp-server/blob/2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd/DEVELOPMENT.md)

출처 추적 시 주의할 실제 코드 특성:

- `clean_urn()`은 `::version` 부분을 제거한다. 재현 근거에는 **요청한 LIDVID와 실제 반환된 제품 버전**을 모두 보존해야 한다.
- collection 검색은 label 파일 주소를 상위 디렉터리로 바꾼다. 결과 디렉터리를 원본 파일 URL이나 확보 완료 파일로 세면 안 된다.
- 일부 `requests.get`은 async 도구 안의 동기 호출이며 명시적 timeout이 없다. context traversal은 여러 요청을 순차 호출한다. 제품 경로에 채택하려면 시간·호출 수·응답 크기 제한과 stdout 처리부터 검토해야 한다.

이 항목들은 설치·실행에서 재현한 오류가 아니라 해당 SHA의 코드 정적 검토 결과다. [utils.py](https://github.com/NASA-PDS/pds-mcp-server/blob/2dfe9866bac1ec4a9ecb3961a1e3107e6a934bbd/src/utils.py)

## 5. Cyanheads Astronomy: 지원 범위 안의 오프라인 교차 점검

`src/index.ts`는 기본 다섯 도구 `astronomy_get_sky_position`, `astronomy_get_rise_set`, `astronomy_get_moon_phase`, `astronomy_find_events`, `astronomy_list_visible`를 등록한다. 계산은 `astronomy-engine`에서 수행한다. API 키나 네트워크가 필요 없는 기본 모드와 두 네트워크 확장 모드를 구분해야 한다. [진입 소스](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/src/index.ts)

- `ASTRONOMY_ENABLE_HORIZONS=true`: `astronomy_get_ephemeris` 추가. JPL Horizons에 접근한다.
- `ASTRONOMY_ENABLE_SATELLITES=true`: `astronomy_get_satellite_passes` 추가. CelesTrak 요소와 SGP4를 사용한다. 현재 태양계 1000 AU 주제에는 인공위성 통과 기능을 추가할 이유가 없다.

실제 실행 의존성은 `@cyanheads/mcp-ts-core`, `astronomy-engine`, `pino-pretty`, `satellite.js`, `zod`다. stdio와 Streamable HTTP를 지원한다. README에 공개 서버 `https://astronomy.caseyjhand.com/mcp`가 있지만 이번에는 접속·initialize·도구 실행을 하지 않았으므로 해당 서버의 현재 도구·버전·가용성은 미확인이다. [설정 소스](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/src/config/server-config.ts), [패키지](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/package.json)

기본 모드가 받는 시각은 UTC이며 지원 범위는 **1900–2100년**이다. 기본 태양계 목록은 태양·달·수성·금성·화성·목성·토성·천왕성·해왕성·명왕성이며, 모든 TNO·위성을 계산하는 목록이 아니다. `get_sky_position`의 RA는 **시간 단위**, 좌표는 관측 장소 기준의 **겉보기·날짜 기준 적도 좌표**다. 프로젝트의 J2000 근사 좌표/RA 도와 그대로 빼면 안 된다. 같은 관측자·프레임·광행시간·수차 조건으로 변환한 뒤 비교해야 한다. [실제 출력 스키마](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/src/mcp-server/tools/definitions/get-sky-position.tool.ts), [계산 소스](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/src/services/ephemeris/ephemeris-service.ts)

선택적 Horizons 도구는 지구 중심 또는 지구 표면 관측자의 **OBSERVER 표만** 만든다. 실제 요청은 `QUANTITIES=1,9,20`, 표면 관측이면 `1,4,9,20`이며 최대 200행이다. 태양 중심 VECTORS/ELEMENTS나 SPHEREx 관측자 선택, 임의의 미발견 행성 요소 입력 인터페이스는 제공하지 않는다. `Q1` 좌표는 JPL의 astrometric 출력 조건으로 읽어야 하며, 도구·설명의 “apparent” 단어만 보고 다른 좌표와 동일시하지 않는다. [Horizons URL 생성 소스](https://github.com/cyanheads/astronomy-mcp-server/blob/9d2dcf9a74e6bbcac5e7b735ad59638e18295f1d/src/services/horizons/horizons-service.ts), [JPL Horizons 정의](https://ssd.jpl.nasa.gov/horizons/manual.html)

따라서 기본 모드는 기존 태양계 시각·단위·관측자 처리의 교차 점검에 쓸 수 있지만, 미발견 제9행성이나 수천 년 장기 적분을 검증하는 기준 엔진으로 쓰지 않는다. 두 MCP가 모두 JPL Horizons를 부르는 경우 계산 경로 두 개를 독립 원자료 두 개로 세지 않는다.

## 6. 기존 개발 환경의 설정 확인

비밀값을 출력하지 않고 파일 존재 여부, MCP 서버 테이블 이름, 구성 키 이름만 확인했다.

- 프로젝트 `.mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`: 없음.
- 사용자 Codex `config.toml`: `unityMCP`, `node_repl` 테이블 확인.
- VS Code 사용자 `mcp.json`: `unityMCP` 확인.
- 현재 노출된 도구 목록: 요청한 세 MCP의 도구 없음.

기존 파일을 새 설정으로 덮어쓰면 안 된다. 향후 연결 시 정확한 클라이언트 형식과 실행 버전을 확인하여 별도 서버 항목을 추가하고 기존 서버·비밀 설정을 보존해야 한다. 공개 저장소·배포 ZIP에는 사용자 전역 설정·자격증명을 넣지 않는다.

## 7. 후속 반영 순서와 완료 구분

1. FSD에서 **도구 도입 계획**과 **실제로 채택한 데이터·계산**을 분리한다. 이 검토만으로 설치/연동 완료 표시를 하지 않는다.
2. 개발용 Horizons 조회 경로를 먼저 검토한다. 알려진 TNO의 실제 ID·기준시각·관측자·응답 형식 확인이 목적이다. 제품 API는 공식 출처와 입력/응답 정본을 보존한다.
3. PDS는 필요한 천체·임무 자료가 있을 때만 자료 검색용으로 사용한다. 검색 결과→원 제품/버전→다운로드·해시→실제 활용 기능으로 연결하기 전에는 Data_Spec의 “사용 중”으로 세지 않는다.
4. Astronomy는 Node24/Bun 또는 별도 원격 환경이 확보됐을 때 지원 범위 내 교차 점검에 사용한다. 현재 운영 Node를 검증 없이 업그레이드하지 않는다.
5. 새 응답은 도구/서버 버전·조회 조건·반환 ID·원문·시각/시간계·단위·좌표계/중심·SHA·가공/검증 상태를 기록한다. 실제 SPHEREx 원본의 불변성과 관측 근거 복원을 유지한다.

제9행성의 위치 분포는 적절한 문헌 모형·표본·epoch·정규화에 조건을 둔 분포로만 표현할 수 있다. MCP의 답변 순위나 자연어 확신, 검색 적중률은 존재확률이 아니다. 세 MCP를 연결해도 알려지지 않은 천체·질량·관측 공분산·선택효과가 자동으로 채워지지 않는다.


## 8. DEV-018 실제 연결 검사 · 2026-11-15 03:17 KST

MD 수정·독립검토·보고 후 구현을 재개했다. 공식 Node v24.22.3 Windows 포터블 배포본의 공식 SHA256을 대조하고 `.tools/mcp`에 격리했다. 기존 전역 Node22.17/앱/Python3.12 환경은 유지했다. PDS는 이미 설치된 안정 Python3.14.3의 별도 venv에 pinned 소스를 설치했다. FastMCP4.2.0/MCP2.3.0의 실제 동작을 확인했으며 이 Windows 잠금은 Linux용 의존성 보증이 아니다. `.tools`와 사용자 전역 설정/자격증명은 Git/ZIP에서 제외한다.

세 서버에 stdio initialize→tools/list→읽기 도구 호출을 실제 수행했다. [기계 판독 기록](../../data/manifests/mcp_tools.json)에 버전·시각·입력·전체 응답 SHA와 보존 경로를 기록했다. `tools/mcp/smoke.py`는 자격증명을 상속하지 않고 최소 OS 환경만 전달한다. 첫 검사 클라이언트의 MCP2 `is_error` 필드 이름 오류를 고친 후 세 호출을 다시 완료했다.

- Pipeworx 실제 목록은 `horizons_nasa_lookup/ephemeris/observers/vectors`였다. 정적 tools.json의 `lookup`과 다른 이름을 그대로 기록했다. 명왕성999/태양500@10/2026-11-14~15/1d 벡터 2행을 받았고 실제 헤더는 J2000 황도, TDB, km·km/s, geometric였다. 공식 JPL API에 같은 조건을 직접 요청한 2행×6성분은 전부 동일했다. 이는 같은 Horizons 상위 자료의 전달 일관성 검사이며 독립 관측 정확도 검증이 아니다. 익명 gateway 호출만 사용했고 별도 계정·키·유료구독을 만들지 않았다.
- PDS `search_targets(keywords=Sedna,limit=3)`는 1개 context target `urn:nasa:pds:context:target:trans-neptunian_object.90377_sedna`를 반환했다. 본체 질량이나 표면 사진을 확보한 결과가 아니다.
- Astronomy 기본 5도구를 확인하고 명왕성/2026-11-14T00:00:00Z/서울37.5665,126.978의 위치를 계산했다. RA20.44271346236536시간·Dec−23.570132387351837°·거리35.936660077486AU이며 원 관측자·날짜 기준 겉보기 좌표다. J2000 방향과 무변환 차이를 계산하지 않았다. Horizons/인공위성 확장은 활성화하지 않았다.

Codex CLI로 전역 서버 `planetx_horizons/planetx_pds/planetx_astronomy`를 추가했고 기존 `unityMCP/node_repl`을 보존했다. 사용자 설정 원문/비밀값은 공개하지 않는다. 현재 대화의 네이티브 도구 자동 재발견은 확인하지 않았으며 다음 클라이언트 연결/새 대화에서 별도 확인한다. 이 결과는 제품의 새 관측 처리·제9행성 발견·확률 산출 성공으로 승격하지 않는다. 실제 제품 과학 정본은 독립 입력·manifest 검사를 계속 따른다.


DEV-018 MCP후속확인: 현재Codex대화에서3서버의native16도구가실제발견됐고PDS세드나검색/Astronomy명왕성위치/Horizons명왕성Sun벡터를각1회native호출해모두성공했다(2026-11-15 03:45:58KST). 이전“자동발견미확인”상태를대체하며8개응답·대조기록파일/입력/전체SHA는data/manifests/mcp_tools.json에연결한다. 제품관측/발견의독립검증으로승격하지않는다.
