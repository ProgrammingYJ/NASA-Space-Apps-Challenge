# Planet X and SPHEREx · Solar System 1000 AU

NASA Space Apps Seoul 2026. 태양계 외곽의 알려진 천체·문헌 제9행성 가설·실제 SPHEREx 관측을 연결하고 근거를 저장·복원하는 웹사이트다. 최신 개발 명세는 [FSD](FSD.md), 자료·출처·해시·한계는 [Data_Spec](Data_Spec.md), 진행 상태는 [TODO](TODO.md)와 [작업 기록](docs/worklog.md)을 따른다.

현재 소스는 **v0.13.0 / DEV-020**이다. 팀 결정에 따라 은하/은하지도·외계행성 도감·빅뱅/우주역사·역사 혜성·블랙홀·범용 물리실험 구현/API/신규 배포 자료를 제거했다. 이전 Git·불변 릴리스 ZIP·로컬 불변 원자료는 보존한다. 과거 릴리스의 검증 결과는 [이전 릴리스 기록](https://github.com/ProgrammingYJ/NASA-Space-Apps-Challenge/tree/main/docs/releases)이며 새 소스의 검증으로 대체하지 않는다.

## 실행

**진입 파일은 루트 [app.js](app.js)이며, 완결 배포 ZIP을 푼 폴더에서 실행한다.** 서버에는 Node.js만 필요하다. 운영 진입 경로에서 Python·pip·외부 npm 의존성을 요구하지 않는다. 프런트·자료는 빌드되어 포함된다. Git clone만으로 큰 관측 원본과 파생 캐시가 준비되지는 않는다.

```sh
node app.js
```

기본 주소는 `http://127.0.0.1:3002/`, 기본 bind는 `0.0.0.0`이다. `APP_HOST`로 bind를 바꾸고, 포트는 `PORT` → `APP_PORT` →3002 순서로 선택한다. `APP_STATE_DIR`의 기본값은 `var/node`다. 기존 상태와 원본을 삭제하거나 두 writer를 동시에 실행하지 않는다. `.env`는 복사만으로 로드되지 않는다. 환경변수를 지정하거나 Node의 `--env-file` 옵션을 사용한다.

[배포 안내](deploy/README.md)는 Node 실행·자료·상태/복구를, [EC2 안내](deploy/EC2_SETUP.md)는 사용자 생성 AWS 서버의 설치·nginx/systemd·HTTPS 순서를 설명한다. 현재 사용자 생성 서버의 사양은 **시드니 m7i.xlarge / Ubuntu Server24.04LTS 일반판 amd64 / 암호화 gp3 50GiB**다. 전용 프로세스는3002 loopback, 외부 접속은nginx80/443으로 분리한다. EC2 원격 배포 완료는 실제 IP/health/재시작 기록으로만 확정한다.

## 탐색과 근거

- 태양계476개 항목과 JPL SBDB의 TNO8,341개 스냅샷을 연결한다. 궤도요소가 유효한8,340개는 기본 ON인 GPU점층으로 표시한다. 알려진 본체의 중복 점은 억제한다. 실제 점을 클릭해 선택하며, 겹친 점은 천체 목록에서 고른다. 검색 옆 전체 TNO 목록에서8,341개 항목을 페이지별로 조회할 수 있다. 화면 표지는 실제 반지름이 아니며 미측정 표면·질량을 생성하지 않는다.
- 선택하면 천체 크기를 바꾸지 않고 카메라가 접근한다. 출처 있는 지도·고리·위성, 과거/미래 공전·자전 재생, 카이퍼 영역 설정, 행성3요건과 구형 부피·가정 밀도 질량을 유지한다.
- 모든 TNO 선택은 정확한 SPK ID의 사실 설명·임시명/점 의미·관측호/불확실성·원자료 링크와 판정/궤도/질량 대화상자로 연결된다. 미측정 질량은 null이며 밀도/비교위성은 사용자가 명시적으로 고르는 선택 기능이다. 설정과 검색 아래에서 8개 확인 행성, P9 문헌 가설, 두 범위 조합을 표시 필터로 고른다. 문헌 가설을 발견된 행성으로 분류하지 않는다.
- Neptune/Uranus 공식 OPAL RGB의 모든 픽셀을 보존하고 설명용/태양방향 조명을 제공한다. 원자료 결측·강조색과 촬영 시기는 유지한다. 상세 지도 실패 시 기존 지도를 유지하고 재선택으로 다시 시도한다. 기본 그래픽은30fps/DPR1.25다.
- TNO의 현재 거리r·반장축a·근일점q·원일점Q와 궤도 원소 시각을 구분한다. 전체 타원은 순간 접촉궤도이며 한 바퀴 섭동 적분이 아니다. 달력 범위 −2999~3000년 전체에서 태양 중심 2체 전파를 제공한다. 소스 epoch에서 ±100Julian년을 넘으면 검증되지 않은 장기 외삽으로 표시하며, 이 경계 안의 정확도도 보장하지 않는다. 현재 거리1000AU 밖과 원소 미확보를 따로 표시한다. 1000AU는 탐색 기준이며 중력의 경계가 아니다.
- 제9행성 문헌10만 합성 궤도 표본은 발견된 행성 목록이 아니다. HEALPix RING nside32의 동일 면적 셀을 정해진 survey/r 필터 아래 `n/N`과 `n/(NΩ)`로 정렬한다. 기본 필터의 분모는20,406이며 원래10만/문헌 ZTF/DES/PS1 flag=0 조건 후21,740과 구별한다. **존재확률·검출확률·개별 행성 후보 진위 점수는 산출하지 않는다.**
- 원2018 위치 분포에서 실제 표본 행을 선택하고 요청 날짜로 전파한 개별 가설 경로를 MOST의 SPHEREx 촬영 범위와 비교한다. 범위 중첩은 검출이 아니다. 원문/입력/관측 ID/응답 SHA와 판단을 독립 가설 근거로 저장·내보내기·복원한다. 영역 분포를 사용자 궤도 변경에 따라 재추론한 것으로 보이지 않는다.
- 실제 ε Indi B(S01/S02)와 명왕성(S12/S14)은 FITS 원본→품질→판단 저장→새 세션 복원을 제공한다. 4노출과2보정을 사용하며 요청 때의 새 FITS 분석이 아닌 출처 검증 빌드 캐시다. 영상에서 검증한 이동/광도 측정으로 주장하지 않는다. 연결 노출이 없는 천체는 빈 A/B 대신 정상 안내를 보여준다.
- 이전 근거의 원 비교 ID·SHA·봉투를 보존한다. 제거된 선택적 맥락만 제외한 활성 세션은 `partially_restored`, 핵심 무결성이 맞지 않으면 `recalculation_required`로 복원한다.

## 계산의 한계

제한된 동역학은 태양과 JPL 적합요소로 위치를 지정한8개 대표행성계의 Newton 중력과 태양 중심 간접항, 선택적 태양1PN/가상 섭동원, 제한된 시험입자 RK4 적분이다. 전체 천체의 상호 N체·모든 위성 질량·조석/J2·복사/유체/양자/완전 GR·미발견 천체 전수 복원을 구현한 것이 아니다. 장기 시각·장면 근사와 검증된 관측 시각을 구분한다.

문헌 채택·반론·선택편향은 [논문 검토](docs/reviews/2026-11-15_planet-nine_sources.md)를 따른다. 근거 옆 논문 DOI·공식 자료 링크가 원출처로 연결된다. [Caltech 표본](https://doi.org/10.22002/8fjad-x7y61), [Brown & Batygin2021](https://doi.org/10.3847/1538-3881/ac2056), [Napier et al.2021 선택편향](https://doi.org/10.3847/PSJ/abe53e), [IRSA MOST](https://irsa.ipac.caltech.edu/applications/MOST/), [JPL SBDB](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html).

## 개발·검사

프런트는 TypeScript/React/Vite/Three.js, 서버는 Node 내장 HTTP/worker thread와 파일 저장이다. Python3.12/Astropy 원본 reader는 빌드·재검산 경로로 유지한다.

```sh
# Node 의미 있는 계산·HTTP·무결성·재시작 회귀
npm test
# web 폴더의 프런트 검사
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
# 전체 자료 SHA 검사
node app.js --verify-sources
```

실제 데이터가 준비된 개발 환경에서 `.venv/Scripts/python -m deploy.export_node_runtime --verify-only`로 빌드 정본을 대조한다. 새 관측 계산/스키마 변경 시에는 재수출·검증·완결 ZIP이 필요하다. 전체 검사 완료 여부와 정확한 ZIP SHA·한계는 작업 기록 및 외부 릴리스 검증 JSON으로 확정한다.

요청된 MCP3개는 격리된 **선택 개발 도구**다. 실제 연결·최소 조회와 공식 JPL 동일 상위모델 전달 일관성을 확인했으며 제품 관측·발견 확률 엔진으로 쓰지 않는다. [검토/실행 기록](docs/reviews/2026-11-15_mcp_review.md), [버전·응답 provenance](data/manifests/mcp_tools.json), [개발 잠금](tools/mcp/). 사용자 전역 설정/개인키/API키는 배포하지 않는다.

핵심 UI는 ko/en/ja/zh-Hant/fr를 지원한다. 일본어·번체·프랑스어 원어민 검수는 확보되지 않았다. 코드/번역의 Codex 지원은 [AI 사용 기록](docs/ai_usage.md), 자료·라이브러리 권리는 [고지](THIRD_PARTY_NOTICES.md)를 따른다. 사용자 제공 로고는 원본 그대로 사용하며 크레딧 대화상자의 실제 문구는 사용자 입력 전 빈틀이다.

공식 서비스 도메인: https://nasaspaceappschallenge.marulee.dev/ · 도메인 존재는 새 앱 배포 완료와 별개다. 공식 마감2026-11-15 23:59KST, 안전 목표23:55. 제출/심사 최종 동작은 자동 수행하지 않는다.


DEV-018 MCP후속확인: 현재Codex대화에서3서버의native16도구가실제발견됐고PDS세드나검색/Astronomy명왕성위치/Horizons명왕성Sun벡터를각1회native호출해모두성공했다(2026-11-15 03:45:58KST). 이전“자동발견미확인”상태를대체하며8개응답·대조기록파일/입력/전체SHA는data/manifests/mcp_tools.json에연결한다. 제품관측/발견의독립검증으로승격하지않는다.


운영 주소는 **https://nasaspaceappschallenge.marulee.dev/** 의Sydney EC2다. v0.13 완결 ZIP·Ubuntu Node 단독 실행/재시작·정식 HTTPS Chrome5흐름·기존 근거 원바이트 복원을 확인했다. 정확 활성 버전·SHA·검증한계는 [릴리스 기록](docs/releases/v0.13.0.json)을 따른다. 사후 문서는 검증한 불변 ZIP을 변경하지 않는다.


OPS-020 현재운영: 사용자요청으로16.176.170.4(ap-southeast-2)로이전했고기존13개저장파일을정지백업/해시검사해복원했다. 정상HTTPS·기존관측근거·개별TNO/과거표시검사를확인했다. 새호스트최종보고서와수정완결ZIP을따른다. 이전서울EC2의앱은중지했으나컴퓨트인스턴스자체는중지하지않았다.
