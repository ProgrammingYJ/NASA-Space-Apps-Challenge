# 과학 자료 저장 위치와 사용 상태

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다.

## 현재 채택 자료와 DEV-027 / OPS-021 · v0.17.0 검증 스냅샷

현재 배포/자료 검증은 [FSD31~34](../FSD.md)와 v0.17.3 재활성화의 [철회·복귀 정본](releases/notice-withdrawal-20261115.json)을 따른다. 사용자 보조 PDF는 철회됐고 PDF 통합은 실행하지 않았다. 현재 source 검증614개·runtime source1365/필수1270이며 기존114생성JSON/74비교 원핀은 동일하다. v0.17.4의 source1366/필수1271은 보조 PDF가 있던 철회된 과거 검증이다. 아래 표의 파일 수·PDF·백업·SHA도 v0.17.0 당시 기능 검증 스냅샷으로 보존한다.

2026-11-15 21:32 KST 기준 새 EC2에 활성화한 [v0.17.0 릴리스 정본](releases/v0.17.0.json)을 따른다. 기능/상태/운영 계약은 [FSD](../FSD.md)31~32절, 파일별 원출처·바이트/SHA·권리와 사용/확보/이전 구분의 전수 정본은 [Data_Spec.md](../Data_Spec.md)다. 아래 DEV별 자료 목록은 당시 취득/사용 이력이며 현재 필수자료 목록이나 현재 지원 기능의 합계로 사용하지 않는다.

| 현재 입력/산출물 | 사용·검증 상태 | 정본/추적 |
| --- | --- | --- |
| 실제 SPHEREx 등록 입력 | 10대상40제품·37무순서쌍/양방향74선택. ε Indi B·명왕성과 공식대상/추가 태양계 원본·보정·시간/품질 연결을 보존. 같은 노출의 순서변경/재처리는 독립 관측으로 더하지 않음 | [observation_registry.json](../data/manifests/observation_registry.json)·[datasets.json](../data/manifests/datasets.json)·Data_Spec DEV-025 |
| Node 빌드 파생 캐시 | 114JSON/63,027,446B와74방향별 비교의 기존 핀 모두 동일. runtime SHA `e12e8a80f5868234bf09e680d68b8057504f6360bafa3f6606d06b37eec28882`; source1365/필수1270·배포된 선택28개 검증. Node가 요청 때 새 FITS 분석을 수행하는 것은 아님 | [node_runtime.json](../data/manifests/node_runtime.json)·[DEV-027 검사](qa/dev027_local_verification.json) |
| JPL TNO·문헌 P9 표본 | 기존8,341개 exactSPK/원소/누락값 및 저자 합성100,000행·17열·2018 epoch를 그대로 사용. 실제 궤도 유사도 TOP5는 source a/e/i의 설명용 비교; 문헌 조건부 하늘 영역과 별개이며 진위/존재확률·새 관측 목록이 아님 | [outer_tno.json](../data/manifests/outer_tno.json)·[planet_nine_scope.json](../data/manifests/planet_nine_scope.json)·FSD31 |
| 관측·P9 근거/상태 복구 | 삭제된 이전 호스트의 확보된 불변백업13파일 = 관측근거4+P9근거3+비교2+jobs4. 별도 원봉투 검증한 구판3근거는7근거의 부분집합. 과학파일9개의 원바이트 및 재시작 후 ID/판단/SHA를 보존 | [OPS-021 복구 검사](qa/ops021_migration_verification.json). 이후 로컬 사본 없는 최신 근거 복구는 보장하지 않음 |
| 새 stopped-writer 상태 백업 | 공개검사 후24파일/10,762,240B, SHA `a49928a95ca5b9bba9a04554f55cf1343f8bcd4913bd0e85d75118317030c8aa`를 로컬 다운로드 검증. 원관측 자료나 독립 발견 건수와 합산하지 않음 | OPS-021 검사. 개인 상태 내용은 Git/공개 배포에서 제외 |
| 데이터 명세서 PDF | 원MD SHA `477a9bb3e2a88b7212a22cfafd95d1deedbdf4692899c443b4a8f4acaeebc116`의 EOF DEV-027·OPS-021까지 전체변환. 380쪽/5,360,649B, SHA `faac2aeb13e65440421999300d3b57e9c0c92032431fe240f66f9bbb24ce06f9`, 빌드시각2026-11-15T12:17:45Z. 원문첨부/링크/글리프·전수렌더/접촉표·표본 시각검토 확인 | [PDF manifest](../data/manifests/data_spec_pdf.json)·[PDF 검사](qa/dev027_pdf_verification.json). 관측 원본이 아닌 문서 파생물; 사후 MD 편집과 배포 동결판 해시를 구별 |

DEV-027/OPS-021은 **새 원FITS·관측/천체력/문헌 데이터 취득이나 과학 수치규칙 변경 없이**, 기존 실제 자료로 TOP5·패널/검색·JSON 복원·PC 안내/모바일 차단·가이드를 구현하고 운영 호스트/근거를 이전한 작업이다. 공개 정상 TLS Chrome10/10은 DEV-027 9개 경로와 ε Indi B 원본→품질→저장/새 세션 복원을 포함한다. 새 ZIP 없이 검증 디렉터리를 직접 배포했고 과거 ZIP·원자료·기존 비교/근거는 보존한다. 모든 물리법칙·새 발견·원어민 검수를 완료로 표시하지 않는다.

현재 우선 사용은 실제 SPHEREx 등록부/보정·품질, 태양계 JPL/외관/위성·장기모형, TNO/행성3요건·질량가정, P9 문헌 가설/실제 궤도 대조 및 근거 복원이다. 은하/지도·외계행성 도감/TESS·빅뱅/역사·역사혜성·블랙홀/범용실험의 원본·당시 기록은 보존하되 현재 제품/API/필수 배포 의존성에 포함하지 않는다. 촬영범위·등록된 사진·검출·질량어림값과 실측값을 구별한다.

## 이전 취득·사용 보존 이력

DEV-018 문서 단계: 최신1000AU회의/제공사진·로고/위키·공식논문·MCP3개원문을검토하고FSD0.20·Data_Spec·TODO에연결했다. AI는문서/코드지원을했고원관측/로고를생성·변경하지않았다. 후보확률은조건부문헌위치분포만허용하며실제존재확률/새발견을생성하지않는다. 새제품기능/브라우저/정확ZIP·MCP연결은미완료다. 아래제외기능의실사용/검증기록은당시보존이력이며현재유지범위가아니다.

- 지정 팀 Drive: https://drive.google.com/drive/folders/1J065qY_U-Eb_bmOauJH4S4CeRN7KTQPS
- 이번 자료 폴더: https://drive.google.com/drive/folders/1QDOZERq8CvDxa4fr2EJO6II09VHGmtvq
- 업로드 완료: **원본/참조102파일987,987,584B + 출처·체크섬·README3파일153,835B = 총105파일988,141,419B**.
- 파일별 원출처·SHA256·바이트·Drive파일ID/URL은 [drive_sources.json](../data/manifests/drive_sources.json),이 저장소에서 바로 찾을 상대 경로는 [datasets.json](../data/manifests/datasets.json)에 있다.
- Drive의 모든 파일을 최종 목록에서 확인했고 크기·부모폴더가 일치한다. 커넥터는 원격 체크섬을 반환하지 않아 원격 SHA/MD5 일치까지 주장하지 않는다. 로컬 원본과 이 저장소의102개복사본은 모두 SHA256·크기를 대조했다.

## 우선 사용

1. SPHEREx DR1/QR3의 ε Indi B 주쌍과 해당 D6 SWCS v5.
2. 명왕성 QR3 D3의 09/29·10/02 주쌍,10/01 보조 노출.
3. 공식 지정5개와 VY CMa 비교의 기존 원본은 릴리스/품질/검사 이력을 명시해 참조한다.
4. Planet Nine 저자 v3 원본 표본과 WASP-4 b TESS Sector2 실제 LC.
5. 선택 HiPS/Gaia, 보조 WISE, 핵심 완료 후 NEOSSat.

v1.7 현재 공개자료46파일(관측뿐 아니라 문서/튜토리얼/허가문 포함)420,843,868B에기존공식5대상·VY비교·WASP-4/TESS·P9·보정/출처의56파일567,143,716B를보강했다. 같은 노출의 재다운로드/cutout/재처리를 독립 관측으로 중복 계산하지 않는다. 기존37 MEF 검사 이력과46개 다운로드 목록·이번102개원본/참조파일은 범위가 다르다.

원본은 `data/raw/`, 보정은 `data/calibration/`, 공개 문서/표본/예제는 `data/reference/`의 로컬 파일로 사용하고 Git에는 작은 목록만 둔다. 데이터/튜토리얼의 출처·개별 라이선스를 보존한다. 사전 연구 스크립트/검토 그림·팀원 실명 자료는 공개 데이터 묶음에 포함하지 않는다.

자료를 확보하거나 Drive에 올렸다는 사실은 실제 앱 연결·측광/운동 검정·발견 성공을 뜻하지 않는다. 원본→사용 기능→결과의 실제 연결을 E3에 기록한다.

DEV-001: S01 DR1·S02 QR3·S10 SWCS v5를 실제 reader/worker/API/브라우저 작업대에 연결했다. 원본은 변경하지 않았으며 전체 SHA/바이트 확인 뒤 IMAGE/FLAGS/VARIANCE/ZODI native cutout·EPSF/WCS/시각/파장·품질을 결과에 기록한다. 결과ID와 입력·보정·판단/한계가 근거 JSON/CSV로 이어지고 새 세션에서 검증 복원한다. 세부 계산·경로/검사 현황은 FSD6.1/11–13/20절과 DEV-001 작업기록이 정본이다. 이 사용을 천체연관/측광/운동의 과학적 성공으로 쓰지 않는다.

DEV-002: S12/S14 QR3D3·D3보정L051도같은native원본/품질/근거경로에연결했다. 현재DataLink의DR1보정을정상TLS로전체스트리밍해기존L051와SHA/바이트동일함을확인했고원취득QR3 URL은보존했다. 새작은 `solar_system_ephemeris.json`과 `pluto_ephemeris.json`은JPL장면/노출시각의관측자별예측및DataLink출처증거이며기존관측102파일을새관측수로증가시키지않는다. 장면은태양/8행성/명왕성의실제4시각·평균반지름과εB방향을제공한다. 예측변위는실측이아니다. 출처·응답SHA/기준계/단위/제한·검사는FSD8절과DEV-002기록에연결한다.

DEV-003은 기존 네 JPL 시각과 관측 원본을 바꾸지 않고 `display-hermite-v1`로 인접 표본 사이를 표시 보간한다. 위치 AU·속도 AU/TDB-day·UTC→TDB 조건을 보존하고, 재생 범위는 2026-11-13 00:00~11-16 00:00 UTC(72시간)다. `/timeline`의 작은 원본 매듭을 한 번 읽어 브라우저에서 재생하며, 실제 SPHEREx 날짜/파장/원본을 추가 생성하지 않는다. `solar_system_orbits.json`의 아홉 안내선은 11월14일00:00 UTC 기준으로 고정한다.

추가 [timeline_validation.json](../data/manifests/timeline_validation.json)은 13:14:35 KST에 별도 취득한 아홉 천체×세 중간시각의 JPL 응답/검산27개다. 86,812B, SHA256 `6562f9898ba8716d41595f1b9288c0cf364b3ec4119e02cafb6a961a19527f99`. 실제 표본에서 관찰한 최대 보간 차이는 수성 약18.99km이며 전체 구간의 오차 상한이 아니다. 같은 JPL 모형의 별도 시각 조회와 표시 보간의 비교로 한정한다. 기존102 원본/참조 수, 관측 횟수 또는 실측 검출 성과에 더하지 않는다. 수식/범위·검사 상태의 정본은 FSD8.1절과 DEV-003 작업기록이다.

로컬 분류는 raw57개/reference39개/calibration6개다. 이 중VY비교3개는기본인증검증으로재취득해이전SHA와일치했고,동일보정중복3개는재업로드없이같은해시파일로연결했다. π Men의실제FITS는과거HEAD기록만있어가용원본으로포함하지않았다. 누락값/검증이력을숨기지않는다.

## DEV-004 실제 채택 확장 자료

기존102개 관측/참조와 아래 새 카탈로그·천체력·외관 원본은 다른 범위다. 아래 파일 수를 SPHEREx 관측 수나 독립 검출 수에 더하지 않는다. 새 자료를 기존 Drive에 추가 업로드했다는 기록도 아니다.

| 자료 | 실제 취득/사용 | 보존 위치·검증 |
| --- | --- | --- |
| 전체 위성·추가 왜행성/후보 | JPL discovery+Earth Moon461개, 별도 NASA/논문 위성7개로 위성468개. 추가8천체 포함476객체 중471실제 위치지원 | [extended_solar.json](../data/manifests/extended_solar.json) 1,186,595B, SHA `34afdc84d913e7e2089b06d9e0518acff011713df3ac7185b7372ba0ef6ef7a5`; 참조 원본509개19,411,029B, `data/reference/solar-extension/` |
| 시간 표본/중심 검산 | 72시간52,527표본; 평균주기는 cadence 참고만. TNO5위성과4모천체 PRIMARY를 같은 솔루션으로 연결; 원래 barycenter 응답 보존 | 실제 target/parent/UTC 양끝·SHA/bytes·누락검사20PASS,471지원객체 전체 별도 읽기검수. 부모+상대벡터와 별도 태양중심 KM-S5조회 최대차이0.0000989372km는 내부일관성 |
| 공개 표면·대표 대기·고리 | 원본 지도31개102,820,603B와4거대행성 고리. 원본 바이트/지도창·촬영기간·credit·미관측 영역 보존 | [appearance.json](../data/manifests/appearance.json) SHA `4c0f0a03eda761d8bbdcfc57db09874b4ca2ab6416fa94b189c4f7cdefa3458e`; 지도 `web/public/textures/`, 참조 `data/reference/appearance/`; 대상검사11PASS |
| NASA 공개 외계행성 | 날짜 고정6470행성·4862모항성계, 실제115 REST페이지13,740,795B. 원 수치/추정·누락·행별 source 보존 | [exoplanets.json](../data/manifests/exoplanets.json) 3,955,802B, SHA `5b803ea060a52b50ca9afa61ec1a49ee889a7617864c5ba51469e828757f4c06`; 원본 `data/reference/catalog/nasa_science/`, source목록 정본 SHA `4b8361bb95ce146780faf6aeed6fd9d73b2344ae77fd5366a4499f8038a03b85` |

미지원 위성5개는 Daphnis·S/2009 S1·S/2025 U1·MK 2·Xiangliu다. 원래 오류/이름·임시명 조회를 보존하며 다른 천체의 ID·평균요소·가상위치로 대체하지 않는다. Hi'iaka/Namaka/Dysnomia/Weywot/Vanth는 TNO 위성 솔루션의 역사적 관측범위/불확실성을 그대로 기록한다. 2026 정확도나 전구간 오차 상한은 검증하지 않았다. 미측정 반지름은 `null`이다.

NASA 외계행성 공개 REST는 TAP 접속 timeout 후 채택한 별도 공식 원본이다. PS default 일관 문헌해를 취득한 것으로 기록하지 않는다. 빈 게시물 제목4개/Debug 제목4개는 원문 `acf.display_name`과 대조했다. RA/Dec는 방향층에 쓰고 미검증 거리단위/epoch로3D 거리를 만들지 않는다. 표면 모식도는 분류별 설명용 코드 렌더링이다.

외관은 Mercury MESSENGER 향상색, Venus 레이더, Earth 월별 합성, Mars/위성의 Voyager·Viking·Galileo·Cassini 모자이크, LRO, New Horizons, 거대행성 대표 대기/OPAL 자료를 구분한다. Ceres는 USGS 공식1200×380 HAMO clear-filter rectangular preview를 채택하고 DLR 타원 전구 preview는3D 지도에 쓰지 않는다. 원본 무가공·지도창 GPU선택, NAIF PCK 극방향과 미검증 자전위상을 분리한다. 상세 권리·credit는 manifest와 [외부 고지](../THIRD_PARTY_NOTICES.md)가 정본이다.

[Drive출처목록](https://drive.google.com/file/d/1XL1IS37QMpPsViaLtRaxPMwsU_VvSBeR/view?usp=drivesdk)

## DEV-005 역사·은하·카이퍼대 최초 채택 기록

아래는 새 공식 설명/카탈로그 맥락 원문12개2,861,220B이며 SPHEREx 관측12회가 아니다. 각 HTML과 source.json을 별도로 보존하고 기존102파일/Drive업로드 기록을 바꾸지 않는다. 이미지 원본을 새로 복제한 자료도 아니다.

| 자료 | 실제 입력·상태 | manifest·원문 |
| --- | --- | --- |
| 우주 역사 | NASA/ESA4HTML1,269,070B,10개근사/대표지점,약13.8Gyr기준; 최초별미상·관측예시·교육자료상충 보존 | [cosmic_history.json](../data/manifests/cosmic_history.json)15,783B,SHA `bf947edd0a0859466d594b4e968997a70cd51511dd78fbccf6653b042f65b03f`; `data/reference/history/` |
| 은하 맥락(최초4개) | M31/M33/M81/M87,Chandra4+NASA3HTML1,301,145B. 둥근J2000방향/근사2.5·3·11.6·54Mly·ly→Mpc;M87다른55Mly값별도보존 | 이전 manifest는 `data/reference/galaxies/catalog_before_morphology_v1.json`24,160B,SHA `7fd74f67e48a1d5c7ecd4566e69a4ecc808853b00d553d0cb7a32eb084b54e7f`로 보존; 현재 정본은 아래 DEV-006 |
| 카이퍼 표시 | NASA1HTML291,005B. 주영역30–50AU,scattered disk약1000AU별도.650점/±0.6AU/색·opacity는설명용가정 | [kuiper_display.json](../data/manifests/kuiper_display.json)2,071B,SHA `8ea4e597e3c18a363625b493fbdae05ed40ebe359666c5d3f7e7afdfd6675957`; `data/reference/kuiper/` |

실제 source 취득은 기본 TLS 검증을 유지한 Python urllib로 했으며 각 reader는 네트워크 없이 SHA/바이트/경로를 검사한다. history12·galaxy8·새 catalog API19검사와 공식원문 독립 검토를 완료했다. 이 자료는 현재 천체 좌표를 수십억년 전으로 전파하거나 고대 태양계 위치·정밀거리/자세·새 존재확률을 제공하지 않는다. 우주 역사와 현재 JPL72시간·관측 DATE-AVG는 별도다. JPL 고대 근사표는 현재 Pluto제거/8개와 Earth-Moon barycenter임을 확인했고 이번 고대 태양계 모드는 보류했다.

## DEV-006 현재 은하9개·관측 형태 근거

현재 [galaxies.json](../data/manifests/galaxies.json)은80,168B/SHA256 `1363cee1eb52a93d4e6505d437dd3d2291f16592e166fc33bbaef7864ba0890f`다. 공식17원본(HTML16+NASA lithograph PDF1)5,947,706B를 `data/reference/galaxies/`에 원바이트·source.json과 함께 보존한다. DEV-005 대비 추가 원문은10개4,646,561B이며 기존4개 방향·거리·coordinate_source는 snapshot 대조검사로 보존했다. 이전 snapshot24,160B는 공식 원문 수/바이트에 중복 합산하지 않는다. 역사/카이퍼를 함께 센 현재 공식 설명자료는22문서(HTML21+PDF1)7,507,781B이며 독립 관측 횟수가 아니다.

| 천체 | 원 방향·채택 근사거리 | 실제 확인한 형태/근거와 표시 한계 |
| --- | --- | --- |
| M31/M33/M81/M87 | 기존4개와 동일,2.5/3/11.6/54Mly | M31 NASA77°·먼지띠, M33 CXC희미한 여러 팔, M81 NASA PDF두팔, M87타원 halo/제트 |
| LMC | Harvard SIMBAD ICRS(epJ2000) 원문,0.16Mly | NASA APOD중심막대/한팔, 저작권사진은링크만; PM전파없음 |
| SMC | Chandra J2000 Fast Facts,0.2Mly | NASA WISE 불규칙 별/먼지 구름 |
| M51 | Chandra J2000, NASA31Mly(CXC30차이보존) | 상호작용 NGC5195 동반; 분리각/PA미상,화면offset가정 |
| M104 | Chandra J2000, NASA28Mly(CXC31차이보존) | 거의옆에서본원반·큰bulge·먼지띠; 수치경사미상 |
| Centaurus A | Chandra J2000,12Mly | 거대타원/두꺼운먼지띠·제트 |

`official-rounded-galaxy-context-v1`과 `observed-morphology-guide-v1`을 함께 기록한다. M31외 경사각과 모든PA는 `null`; M81두팔/LMC한팔은 원문, 타원은하 arms0은 분류 표현이다. M33 flocculent는렌더스타일이며NASA가명시한분류아님을 표시한다. 입자/크기/회전·미확인각도는표시가정이며 해상사진/정밀pose/별개체수/고대위치를 만들지 않는다. reader는17원문+이전snapshot SHA/바이트/경로를 오프라인 검사한다. science14/Ruff검사를 통과했으며 형태Chrome·종합회귀/최종ZIP 결과는 후속확정한다.

## 추가 태양계 출처 후보

새로 전달된57천체/7통합출처는 [검토문](./solar_system_sources.md)과 [후보 manifest](../data/manifests/solar_system_source_candidates.json)로 분리했다. 고유34URL의 접속/title을 확인했지만 개별 물리량·epoch별 궤도를 채택/검증한 묶음은 아니다. 기존102개 파일/최신46개 목록의 수를 늘리지 않는다. 3D 선택정보/출처와 추후 검증할 천체력·물리량 입력 후보로 활용하며, 실제 채택한 필드/조건/검사·기능/결과는 [FSD.md](../FSD.md)에 연결한다.



## DEV-007 데이터 전수 정본과 실제 과거 관측

사용자의 명시적 요청으로 [Data_Spec.md](../Data_Spec.md)를 별도 전수 기록으로 만들었다. DEV-007 당시1497자료파일이었고 DEV-008 최신snapshot은1631자료파일(data1588+public43)+명시참조helper1, 참조경로877개, 내장원응답32개, 정적복제43개와 후보/URL검토를 기록하며 실사용6원본/보정과 확보만96개를 구분한다. 이 파일의 이전 요약/취득 이력은 보존하고 최신 데이터별용도/가공/권리·SHA는Data_Spec 및실행manifest에서확인한다.

현재 역사화면은 cosmic_observations.json29,430B/SHA bc12aa27c63d8c7b88d8b175534c0b935f4546beb029ccca31c1ce2c14d0b0d6의5공개관측이미지2,034,618B를쓴다. 기존기사5개892,182B재사용+새정책/caption6HTML680,354B=11참조1,572,536B다. age.46/.6/.7/.74Gyr와CEERS.6–6Gyr는출처의추정/표본범위다. raw detector/자연색으로주장하지않고lens/ALMA gas·velocity/처리와credit/license를함께표시한다. NASA2는해당미디어지침,ESA/ESO3은CC-BY4.0/전체credit을보존한다.

기존 cosmic_history/morphology 원문과 가상 renderer는이전/중간기록으로보존하지만현재App에서가상35은하/변형/임의10anchor를표시하지않는다. 사용자실제관측-only선택이중간시안보다우선한다. 별도 관측이 없는 날짜의사진/관측사이중간프레임을만들지않는다.


## DEV-008 장기모형·계층·표시이름 자료

장기근사는 JPL 공식fitted elements/rates(평균궤도요소 아님)를 long_term_model.json과공식HTML에 보존한다. 별도long_term_validation.json은8원응답의4시각 long32/short16비교이며,총9원본75,257B다. TDB달력−2999-01-01~3000-01-01·Sun+8대표행성계/EMB·Pluto/위성미지원·명목오차가보장상한이아님을 Data_Spec4.1/FSD8.6에서연결한다. 기존72h/실노출원본을고치지않는다.

universe_catalog.json은실제성원23사례와태양계참조를연결하고공식20문서/SIMBAD23응답43원본4,929,139B를보존한다. 외부9은하15대표성원과우리은하8사례이며,우리은하동적목록4871항목은4862기존호스트+사례8+Solar1이다. 자식6470행성은기존카탈로그참조다. 개별방향과핵/성단참조역할·미상거리/깊이·이미지/appearance null을보존한다.

object_names.json은476ID×5언어의표시형/표기방법/원출처와원catalog/helper SHA를연결한다. 이름이있는183개와국제지정명293개를구분한다. 기관HTML/PDF12원본30,323,543B와12sidecar는 data/reference/object-names/에보존하고미확보요청·원어민검수공백·기관표기/프로젝트음역을명시했다. 이름표시는새관측/새위치가아니며원과학명/ID/벡터는바꾸지않는다.

최신전수명세 Data_Spec의1631자료파일+명시참조helper1·877참조경로는파일존재/SHA/바이트를대조한snapshot이며독립관측수/물리정확도·권리보장을뜻하지않는다. 현재기능/API/상태·최신실행검사는 FSD와작업기록을따른다.

## DEV-009 실제 확인 대상과 공개 외계행성 관측사진

최신 사용자 지시는 앞서 허용한 가상 외부은하 행성계 대신 실제 논문/확인목록에 근거한 실존 별·행성만 구현하는 것이다. 기존 NASA6470행성/4862호스트 snapshot과 원본102개는 변경하지 않는다. NASA 원행6470개 모두 `pl_controv_flag`·`pl_refname`·`disc_refname`이 없으므로 논란상태와 개별논문 reference는 미상이다. 확인목록 등재를 모든 개별논문 재검증/논란없음 보증으로 확대하지 않고 누락값을false로 바꾸지 않는다. 새 방향 표식4862개는 기존 카탈로그의 첫 유효 호스트 좌표를 참조하며 새로운 별/거리·밝기·epoch전파를 생성하지 않는다. 카메라 중심의 표시구반지름1800·색/크기는 표현 가정이다. 미검증 frame/epoch·고유운동·거리는 그대로 남기고 임의1400별 생성은 활성 태양계 장면에서 제거한다.

| 자료 | 실제 채택/사용 | 정본과 배포 구분 |
| --- | --- | --- |
| 외부은하 행성 문헌 검토 | 후보2건(M51-ULS-1 b,PA-99-N2)·집단추론3건. 확인된 개별 행성 collection은0개이며 후보를 실제행성 목록/지도/3D에 넣지 않음 | [extragalactic_planets.json](../data/manifests/extragalactic_planets.json)39,826B/SHA `80f4532b8a93db37a072da0e56b2bef5303365cb9d26e1f4d61a599b6824fe3a`; facts12JSON8,041B+sidecar는 런타임/ZIP, upstream12원문1,036,181B는 로컬감사/배포제외 |
| 실제 외계행성 사진 | 기존 확인 ID의 HIP65426b/JWST, BetaPictorisb/SPHERE, HR8799c/NACO3JPEG 총1,270,679B. 별과 분리된 광원 관측이며 표면 지도 아님 | [exoplanet_observations.json](../data/manifests/exoplanet_observations.json)21,746B/SHA `9f342bab497683425e7907417a8df587fbe69f0e5557086f3c138a516a094ea0`; facts8JSON7,647B+sidecar와 public3JPEG/sidecar는 런타임/ZIP, upstream8HTML817,955B는 로컬감사/배포제외 |

새 사실추출JSON은 프로젝트가 작성한 검토 입력이며 원 논문/페이지를 재배포하는 것이 아니다. 전체 upstream 원문은 권한을 자동 가정하지 않고 로컬 감사용으로만 보존한다. 원 URL·전체 SHA/바이트·취득시각·원문 참조와 사실추출SHA는 manifest/Data_Spec에 연결한다. 두 reader는 upstream 복제본 없이 facts와 필수 사진/기존카탈로그만으로 오프라인 검증할 수 있어야 한다. 원문 누락/변조와 정상 빈 확인목록/미채택사진을 구별한다.

PA-99-N2의 약6.34목성질량은0.5태양질량 렌즈가정에 조건부이며 새 독립질량 측정/궤도주기가 아니다. 렌즈은하의 집단추론은 개별 행성의 ID/위치/표면이 아니며 원시블랙홀 대안을 보존한다. 미명시 M51 caption 기준계는 임의 ICRS로 선언하지 않아 좌표를null로 둔다. 채택한 검토의 확인객체0은 전우주 행성 부재/논문 전수조사 완료를 뜻하지 않는다.

사진 원바이트는 `web/public/observations/exoplanets/`와 최종 정적빌드에서 동일하게 제공한다. HIP65426b4필터 할당색·별차폐/광학artefact, BetaPictorisb의 여러시기 관측모음, HR8799c의 표시원/회절artefact를 원 제품의 처리/한계로 기록한다. 전체credit·CC-BY4.0 링크를 사진 옆에 표시하며 과거 관측/공개일을 현재 모형시각이나 자연색 지형으로 바꾸지 않는다. 상세3D 외관은 별도 설명모형이다. 사진이 미채택된 확인행성은 관측된 적이 없다고 단정하지 않는다.

새 사진3개는 기관 원본과 직접 시각 대조했고 reader15검사, 외부은하 reader12검사를 완료했다. 이 기록은 실제 API/최신 Chrome·전체Python·완결ZIP 검증을 뜻하지 않으며 최종 실행결과는 DEV-009 작업기록/FSD20절을 따른다. Data_Spec의 앞 절1631+helper1/877참조는 DEV-008 snapshot이고 DEV-009의 새 원문·사실추출·사진·정적복제까지 포함한 전수값은 자료/빌드 동결 후 갱신한 Data_Spec을 따른다.

## DEV-009 추가 소천체 외관 제약 · 자료동결/후속검사

기존8개ID(Ceres/Haumea/Makemake/Eris/Sedna/Quaoar/Orcus/Gonggong)에 `science/small_body_appearance.py`·`small_body_appearance.json`의문헌제약을추가한다. Ceres는기존Dawn해상지도보존용metadata이고나머지7개는분해표면지도가아니다. 원31지도/102관측원본·기존JPL크기/천체력을변경하지않고무지도고체의임의크레이터를제거한다. 원문은NASA/JPL/ESO와실제논문의관측색·알베도/형상모형·크기정의/불확실성·고리조건을분리해추적한다.

런타임/ZIP입력은 `data/reference/small-body-appearance/facts/`의프로젝트작성사실JSON/sidecar와대응manifest다. [small_body_appearance.json](../data/manifests/small_body_appearance.json)은47,999B/SHA `33b3662b6978137bf172ab65064aa73a40f119519cfaf6365e89ab0f60db18ec`이며2026-11-14T10:07:34UTC에12source/8ID로동결했다. facts12JSON8,716B+sidecar8,987B는런타임/ZIP, upstream12원문3,562,951B+sidecar6,006B는로컬감사자료/ZIP제외다. 원문/사실추출의전체SHA/바이트·취득시각/권리·기존두manifest의존성과새48참조파일은최종빌드후Data_Spec전수목록에갱신한다. reader12검사는통과했으며후속API/helper/Chrome/저장복원은실제결과로별도확정한다. 앞선DEV-009잠정21manifest/1720항목snapshot은이추가자료전의기록이며새최종전수값으로재사용하지않는다.

Sedna·Makemake·Quaoar/Gonggong의붉은정성색, Orcus중성색/분광근거와Eris/Haumea높은알베도는표시RGB선택의근거이며측정된정확RGB가아니다. Haumea는occultation/light-curve삼축모형의조건/원문불확실성을보존하고미상3D형상은null이다. Herschel/ALMA열모형크기·투영면적등가반지름·부피등가반지름을같은측정으로바꾸지않는다. Haumea고리와Quaoar Q1R/Q2R은문헌중심거리를1px안내선으로표시하며고리폭/광학두께/현재자세·입자분포는복원하지않는다. 확인되지않은세번째고리·임의지형/국소얼음분포를추가하지않는다. 실제입력/전수해시·후속reader/API/helper/Chrome·저장복원검사결과는FSD2.14/8.8/20절과작업기록으로연결한다.

## DEV-010 회의 승인 핵심 · 행성3요건/청소질량

사용자가공유한팀회의의공동결정에따라기존행성8개·공식왜소행성5개·후보4개,총17개에공식분류/3요건과별도정량연구모형을연결한다. 새로운임의천체를추가하거나기존실제관측/품질/근거경로를교체하지않는다. 실행정본은 `science/planet_criteria.py`와 [planet_criteria.json](../data/manifests/planet_criteria.json)168,453B/SHA `e6124a457dcbba0907d9f4d0f8fbd777b7cac1963b4b2e49cb5fb6322e8753d8`다. 기존 `solar_system_ephemeris.json`·`solar_system_orbits.json`의원SHA/바이트에의존한다.

런타임/ZIP에는 `data/reference/planet-criteria/facts/`의19사실JSON+19sidecar총77,558B를포함한다. upstream19원문+19sidecar총2,558,555B는로컬감사전용/ZIP제외다. 18개는이번새취득이고1개는기존내장JPL물리HTML58,244B를변경없이재사용했다. 기존9천체의원Horizons요소/물리표와새SBDB8응답을원출처·컨테이너/내장원문·추출해시별로추적하며파일수를새독립관측/발견수로세지않는다. 요청중외부파일을임의취득하지않는다.

공식IAU2006태양계정의·NASA의공식왜소행성목록, Margot2015/2024연구모형, JPL요소/단위와실제질량논문을분리한다. 공식행성/왜소행성의형태요건은분류정의에따른표시이며새정수압평형측정이아니다. 후보4개의shape/지배력은자료부족으로유지한다. 질량은행성표의10^24kg와Pluto표의10^18kg를구분하고, Haumea본문질량과Eris/Quaoar/Orcus/Gonggong의계질량정의를원문대로보존한다. 채택본체질량11개·미확보6개와계질량보조4개를분리하며누락을0으로채우거나계질량을본체질량/Π에자동대입하지않는다. ‘채택자료에미확보’는전체문헌에측정이없다는단정이아니다.

연구모형은태양1M☉·10Gyr·C=2√3에서 `m_clear/M⊕ = 0.001239(a/au)^(9/8)`이고Π는채택본체질량/m_clear를직접나눈값이다. 별도반올림상수807을혼합하지않는다. 공식IAU수치규칙·존재확률/청소율·전주기N체모형이아니다. Sedna는a≈543.7195au/e≈0.85988의출처요소에서약1.4803626M⊕라는동일긴반지름원형궤도참고값이며고이심률실궤도의검증된최소질량이아니다. 실제본체질량/Π는null이고정적요소epoch는재생시각과별도다. 긴반지름a·태양초점x=−ae·근일점q/원일점Q의SVG는요소를설명하는모식도다.

현재통합 전체Python372(76.33초)·Vitest64(1.20초)·strict/Vite Bp6N6jEm·Ruff57검사는통과했고새브라우저16경로와후속의미문구교정/좁은재검사·최종ZIP은확정대기다. Data_Spec최종동결은1,566,507B/2648줄/SHA `f26ba122e0bac9fdfdabbe6881bd7686a7692582f62b0efbd376606e1f7e1b9e`,23정본manifest·1846항목(data1796+public49+명시helper1)·총1,193,228,742B다. 정본참조979/sidecar포함984·내장원응답32·dist복제49를추적하고1846항목의독립전체SHA/원102개987,987,584B보존검사에서불일치0을확인했다. 파일전수검증은물리모형정확도/독립발견·공개서버/사람검수를뜻하지않는다.

## DEV-011 밀도 가정과 관측자 물리 · v0.8.0 개발 중

이전23정본/1846항목 Data_Spec은 v0.7.0의 snapshot이다. v0.8.0의 질량가정·관측자/블랙홀 새자료까지 포함한 최종전수목록/해시는 자료·빌드 동결 후 갱신하며 이전값을 새최종본으로 재사용하지 않는다. v0.7 소스 체크포인트는 `bb386f38b4a5e971041befc9fe18c5a5be626858`에 보존했다. 그당시16Chrome 및 lsFtNhUt의후속locale1검사는 새v0.8 검증과 구분한다.

질량 정본은 [mass_scenarios.json](../data/manifests/mass_scenarios.json)130,355B/SHA `7668d7caf418aaae363acf41fa50e9a69795ff1e3c99a178534a83552fc82112`, reader는 `science/mass_scenarios.py`의 `spherical-density-hypothesis-v1`이다. 기존planet_criteria·small_body_appearance의원SHA/바이트에의존한다. `data/reference/mass-scenarios/facts/`의2JSON+2sidecar9,607B는런타임/ZIP, upstreamHTML/PDF+sidecar1,457,981B는로컬감사전용/배포제외다. 원자료는NASA/JPL SSD위성물리표와NASA NTRS의내부진화정성해석이며원관측이나질량을AI로생성하지않는다.

| 비교 위성 | 채택 bulk밀도 kg/m³ | 원 GM 솔루션 |
| --- | --- | --- |
| Tethys | 984.0 ± 3.3 | SAT441 |
| Dione | 1478.1 ± 3.2 | SAT441 |
| Rhea | 1237.2 ± 2.9 | SAT441 |
| Iapetus | 1088.7 ± 12.5 | SAT441 |
| Ariel | 1539 ± 26 | URA111 |
| Umbriel | 1523 ± 41 | URA111 |

JPL의밀도는GM/부피등가평균반지름에서유도된bulk값이고원g/cm³를1000배해kg/m³로쓴다. sigma는원보고값이며다른천체의밀도prior/신뢰구간이아니다. 여섯위성은크기차수의비교사례이며통계적대표/가능밀도전수목록이아니다. 조성·공극률·중력압축·열진화차이를정성한계로설명한다. 대상6개(Makemake/Eris/Sedna/Quaoar/Orcus/Gonggong)는채택자료의본체질량이null인상태를그대로유지하고sourceR정의/보고오차를보존한다.

36개위성–대상조합에서 `M=ρ(4π/3)(R×1000)^3`을계산하고source오프셋/sigma의저·고corner로조건범위를구한다. 독립Decimal36검산을통과했다. 범위는실측질량오차/신뢰구간/공분산전파가아니며보고된R오차가없으면명목값에고정한다. 직접입력ρ100–10000kg/m³도별도가정이며UI한도를물리가능범위로주장하지않는다. 기존Margot원형모형Π/필요ρ비교는실제질량/공식분류를덮지않는다. 고정6위성전체조건범위의임계충족가능대상0개는현재customρ실험과별도이며확률0%/우주후보부재가아니다.

새관측자/BH자료군은 `science/relativity.py`·`observer_physics.json`·`black_holes.json`의초안을통합중이다. 관측z/음의z·문헌질량/거리·기기/관측기여·provider/reference와SR/정적Schwarzschild/고정FLRW모형값을구분한다. 공개처리사진은출처바이트/credit/권리로연결하며새카메라/가정의사진을생성하지않는다. 자료개수/전체SHA/처리사진권리·표본/모형표/새API·프런트의최종완주는source동결/실행후확정한다. 무한대경계·미상자료·모형미지원도구분한다. 모든물리법칙/Kerr/블랙홀내부/실제빛원뿔·세계선복원을제공하는것이아니다.

새채택에서중국아카이브/서비스제공자를제외하는요청은자료provider로추적한다. 논문호스트와원관측기관은별개이며NASA/ESO/arXiv등호스팅만으로모든원관측기여기관/저자국적을일괄판정하지않는다. ESA/Herschel·ALMA등공동관측의원기여는확인된범위대로기록하고미확인자료에비중국원관측보증을붙이지않는다. 새전체/API/브라우저·근거복원/완결v0.8ZIP은후속실제결과로확정한다.

### DEV-011 관측자/BH 최종 자료 동결

정본두개는2026-11-14T10:54:02.621956UTC에동결했다. [black_holes.json](../data/manifests/black_holes.json)106,361B/SHA `4818701162f76fe3bc97383c1b0d2cd8d750b95466d15c95f046b229126cbbbd`는출처선택11BH·채택질량9/null2·EHT2이미지를담는다. [observer_physics.json](../data/manifests/observer_physics.json)271,921B/SHA `61ca1cf4d24dfe337adb905070328d525ac982d4857db335906a7dbac1bea105`는14z행·고정모형/2049표·provider/reference/좌표해석과한계를담는다. 고유53factsJSON46,880B+53sidecar42,665B는 `data/reference/relativity/facts/`의런타임입력이다. 새37upstream원문16,091,431B+37sidecar21,462B는로컬감사/ZIP제외,기존16원문은재참조하며독립새관측으로중복세지않는다.

14z행은9은하의NED값과5역사사례다. 채택수치10개(9NED+REBELS-25의7.31),미확보4개를유지한다. M31/M33/M81의음의값을0으로바꾸거나다른4사례의근사연대를단일z로전환하지않는다. NED배포자는NASA/IPAC이고원측정기여기관은채택카탈로그값만으로전수확인하지못했음을별도기록한다. publicationhost/reference는원관측참여기관/저자국적과다르다.

FLRW모형은H0=67.66km/s/Mpc·Ωm=.3111·ΩΛ=.6889의flat matter+Λ참고모형이다. Tcmb0=0은방사성분을끄는계산설정이고0K의실제우주를가정하거나fullAstropyPlanck18을채택한것이아니다. 2049행표의z0~20범위에서만선형역보간하고범위밖/결합계의미지원과원관측z를구분한다. 현재카메라역압축좌표와공간분리거리는독립가정이며실제이동세계선·속도·다른방출시각의관측영상이아니다. SR/정적Schwarzschild/FLRW인자곱도자기일관전시공간해로승격하지않는다.

| 실제 EHT 처리관측 | 필수 원 JPEG·SHA256 | 처리·권리 |
| --- | --- | --- |
| Sagittarius A* | 62,877B · `43bef2802a78a06ca7dc41089dff623d59da63640a9898c8807f483f9ea84879` | 2017전파간섭관측의처리재구성,1280×1280. EHT Collaboration·ESO CC-BY4.0 |
| M87* | 40,740B · `c23f0006c68d2c35168c1db870be338dd850f6408e27ae9fcbbec286c08d3dc1` | 2017전파간섭관측의처리재구성,1280×746. EHT Collaboration·ESO CC-BY4.0 |

JPEG2개103,617B와sidecar2개1,363B를 public/dist의 `/observations/black-holes/`에포함한다. 자연가시색표면/블랙홀내부/새관측자영상이아니며원사진은변경하지않는다. 실제JPEG와분리된2Dnull경로/정적shadow·Rs계산은모형표시다. 상대론자료36·관측자API27(9.75초),질량순수39/API8/Decimal36·Vitest70(최신1.76초),전체Python483(76.49초)/Ruff63검사를통과했다. 중간TyRAtsbd 질량5검사와observer타이밍/직접화면교정뒤 CNYGnNg7 통합13/13 Chrome(142.460초), 마지막버튼간격교정 BfRDPmgL 전역/언어후속2/2(9.647초)를통과했다. 두빌드의검사범위를구분하며정본은 `var/qa/dev011-final-browser-results.json`·`var/qa/dev011-observer-review.json`이다. 새문맥의원S01/S02·29픽셀품질/물리입력/선택/두SHA/카메라복원을확인했다. 정확v0.8 ZIP의Windows해제·실제서버재시작은후속검증에서통과했다(docs/releases/v0.8.0.json). 새v0.9 ZIP은별도대기다.

최종 [Data_Spec.md](../Data_Spec.md)는1,791,636B/3061줄/SHA `e848ee7025f315a6cfa127f67b3120a2c7ef2f5bee2d3515e26bbd7a1c3aba33`다. 26정본/2041물리항목(data1987+public53+helper1),총1,211,512,385B,부록A102+B1939·정본참조1079/sidecar포함1084·내장원응답32·정적복제53을기록한다. 독립전체SHA/바이트/문서경로set검증에서누락/추가/중복/불일치0,최초102원본987,987,584B보존불일치0이다. 새최종빌드/ZIP실행검증과모든물리모형정확도/사람/공개서버보장은별개다.


### DEV-012 Node 전용 런타임 파생 묶음

`data/node-runtime/runtime_manifest.json`과 같은바이트의 [node_runtime.json](../data/manifests/node_runtime.json)은473,765B/SHA256 `9dfe12f530da0e6993ced98cc1a94932eb8aef161b6ca68e1a5cb081df44a2af`다. `schema_version:1.0`·`algorithm_version:python-built-node-snapshot-v1`이며export시각은2026-11-14T12:00:18.388103UTC다. 생성103JSON66,642,151B는실제reader/API snapshot99개와실제FITS에서새로계산한순서별4비교다. 원source1859항목의1564필수/295선택을분리하며보류96관측/참조·전체upstream원문을새런타임필수로승격하지않는다. source경로/전체SHA/바이트·대응원manifest와계산버전은전수목록에연결한다.

S01/S02와S12/S14를각각정/역순으로계산해원Python정본raw JSON·cmp ID·내용해시를보존했다. 같은두노출의순서변경/새cutout/재처리는독립관측으로세지않는다. Node는운영중FITS를새로분석하지않으며요청한관측쌍과원본/보정·캐시무결성이맞을때이정본을재사용한다. 없는자료/캐시를합성사진·과거참고수치로채우지않는다. runtime API/관측작업대5언어고지가검증된빌드캐시임을밝힌다.

Node의질량/Hermite/장기Kepler는임의지원입력을일반식으로계산한다. 원4UTC/TDB매듭을그대로사용하며구간사이의선형UTC→TDB대응은브라우저와같은표시근사다. 정밀시간변환·새독립천체력·새검출이아니다. Python3.12/Astropy/원API는빌드와독립검산용으로보존하고서버의필수실행환경으로요구하지않는다. 공개원사진/31지도·권리·원102파일과실제본체질량/null은변경하지않는다. public원본이미지가없는배포에서는명시된동일SHA serving_copy_path만허용하며원자료와서빙복제를구분한다.

Node14검사21.90초·Python없는PATH의독립HTTP/과학67검사19.13초와기존Node서버대상release_smoke를통과했다. strict/Vite DLJsfpSc·Vitest71·전체Python550PASS113.36초도확인했다. 최종Data_Spec은아래동결값을따르고Node8081 Chrome23·정확v0.9 ZIP/실제재시작은후속실제결과로확정한다. 이전v0.8 ZIP의2095파일/484956608B와2026-11-14T11:24:20.927409UTC의Windows해제/재시작검증은보존된이력이다.


최종 DEV-012 [Data_Spec.md](../Data_Spec.md)는 **2,026,860B/3422줄**, SHA256 `e441b64d2d22dfda73342cb5465825b9e74fc7ca8a21ca44b0565337cfe796c5`다. 정본27개·물리2146항목(data2092+public53+명시helper1),총1,279,102,066B이며부록A102+B2044·정본참조1932/sidecar포함1937·내장응답32·정적복제53을기록한다. 독립전체SHA/바이트/경로·참조/중복/복제검사불일치0,최초102파일987,987,584B보존불일치0이다. Node source1859중필수1564개531,456,149B와선택295개를구분하며로컬감사전용 `/upstream/` 사본필수0·보류96개선택을유지한다. 기존reader에필요한NASA/JPL전체원응답은각source의필수표시를따른다. 파일수/순서별파생수는독립관측수·물리정확도/사람검수·실제배포성공수가아니다.

DEV-012 전체Python 첫 실행은483PASS/67공유fixture setup ERROR(약172초)였다. Node cold-source 준비 확인의2초 health probe가TimeoutError를냈는데검사fixture가URLError만처리해독립67경로가시작되지않았다. 제품수치/모형실패와구분하고fixture의TimeoutError처리를추가한뒤전체550PASS113.36초(기존Starlette경고1)로확인했다. 별도로완료한Python없는PATH의독립67PASS19.13초·Node14PASS와이번전체실행의범위를구분한다.


DEV-015–016: comets.json/galaxy_atlas.json/numerical_relativity.json의 원본·변환·canonical SHA 및 Node107JSON을 Data_Spec에 연결한다. 실제4혜성의489개 TDB표본, GWGC53,162개18필드, SXS13,869개 native복소모드를 보존한다. 독립 PDE는 사용자 초기조건의 계산이며 실제 관측/행성 존재확률이 아니다. 기존 SPHEREx102개 원본과 근거를 보존하고 필수6개와 참고96개를 계속 구분한다. 최종 검사/완결 ZIP은 DEV-016 작업 기록과 릴리스 검증 정본을 따른다.


DEV-016 최종 전달 준비: Data_Spec 2,102,484B/3,660행/SHA70c0f51522c110ecbfd4421583d46dc0f8bf2d7aa3cbd194226691f67d8a4a29의 30정본·2,186파일 목록·기존102입력987,987,584B·Node1,885 source 전수 재해시 불일치0을 확인했다. Node107JSON76,348,584B·필수1586/623,292,613B·선택299 및 과거4개 comparison ID가 일치한다. 감사보고서는 var/qa/dev016-data-spec-verification.json이다. 본문/원본/정본은 동결했다.

DEV-018현재활성source정본53e05dcf241974c4840536492522b49bca6fbb00eafd415b62467080d9a9849c/39JSON/source1252·필수1165,최종로컬검증docs/qa/dev018_local_verification.json. 기존2,186획득목록과새activeclosure를구분하며TNO8,341/문헌10만/MCP응답·출처는Data_Spec을따른다.


## RELEASE-012 · 실제 EC2·HTTPS 배포 검증 완료

2026-11-15 KST. 정확한 `NASA_SPACE_APPS_CHALLENGE_v0.12.0_20261115_034911KST.zip`는489,039,770B/1,540파일, SHA256 `c251031cc7df5526b038425ba6d672d96cbbe01e0123b2df55c09fc5332ed067`다. Windows와Ubuntu24.04.2WSL/ext4에각각새로풀어1,539manifest항목/필수1,165source·39JSON/원comparison4개SHA를검증했고Node24.22.3단독서버의실제재시작·εB/Pluto/P9근거복원을통과했다.

사용자EC2 Ubuntu24.04.5/x86_64/4vCPU16GB/50GiB에같은ZIP을전송해SHA를확인하고전용planetx/systemd·nginx80/443→loopback3002·shared/node영속상태로배포했다. 실제systemd재시작PID2871→3077후기존근거3개export바이트SHA동일/같은IDimport복원을통과했다. 공개실관측/31지도·P9HTTP검사와정식주소 `https://nasaspaceappschallenge.marulee.dev/`의일반Chrome157(우회옵션없음)3흐름을통과했다. TLS1.3·정확호스트/기본CA검증·HTTP→HTTPS·DNS3.37.17.247,인증서2027-02-12만료·자동갱신timer/실제dry-run성공을확인했다. 초기HTTP-IP브라우저검사에서만HTTPS자동업그레이드를끈사례는정식HTTPS검증과분리한다.

최종기록은`docs/releases/v0.12.0.json`,`docs/qa/dev018_ec2_https_verification.json`과ZIP옆외부Windows/Linux/EC2검증JSON이다. 이사후기록은검증된불변ZIP을고치지않는다. 이전v0.11ZIP/Git/원자료/근거를보존했다. 이번배포에Git새commit/push·심사제출은수행하지않았다. 상호N체/모든물리법칙·미발견전수·새이동검출/존재확률·원어민검수를완료로올리지않는다. 첫EC2배포라구버전으로의실제rollback드릴은수행하지않았고복구계약/안내를유지한다.

## DEV-020 · R029/R030/R031 신규 입력과 표시변환

기존41열/8,341행 JPL TNO 원본/정규화와 관측·보정을 보존했다. 새6열 identity JSON(506,627B/SHA `de0303824a588ead2ebd0a027780946e97c98cec99b7ab8ba0c0f85361608509`)과 source sidecar(1,832B/SHA `09e7c90a324bb7df4ec0d8b0e1029a56f433e3082537fc055970911811226f51`)만 신규 설명의 Node필수입력이다. 정확 SPK문자열/primary designation8,341전부와일치하며 an1,049/au7,292/A-prefix18이다. 설명은 선택객체의 원소epoch·지정명·관측호/수·condition·무차원RMS·원자료물리량/null을 조합한 `jpl-tno-factual-description-v1` 사실요약이다. 기관이작성한 장문8천개를 취득한것이 아니다. 직경13/자전149/질량·밀도0은 해당snapshot의가용성이며 별도17천체의 문헌본체/계질량을 대체하지 않는다.

[후속원장v2](../data/reference/outer-tno/r029-r031-20261115/audit-index.json)(9,160B/SHA `2d973e6d99c5764f5675f05a031cdc85a4d69271124287413034e5694ff5ffa5`)은20파일819,579B를 구분하며 초기 summary의채택상태를대체한다. 이번7개순차MCP읽기에서는 Horizons의 FO563정확SPK를확인했고 PDS의다른천체C/2015G2 검색연결을거부했다. FO563정확토큰0건/Sedna target_description=none·관리변경이력은 서술로채택하지않았다. 나머지18개311,120B는 취득/참고감사로 서버필수가아니다. 신규20파일은원출처/권리/해시를유지한공개감사부록으로새ZIP에포함하는계약이며runtime필수는두identity파일만유지한다. 최종ZIP내포함검사는릴리스단계에서확정한다. 도구envelopeSHA와 직접HTTP원바이트SHA의범위를구별하며 전8천개MCP검색·공식서술·새관측은주장하지않는다.

OPAL공식 Neptune2025 Cycle32/Uranus2025 Cycle33의721×361/RGB8 TIFF(합계1,577,682B)를 별도보존하고 표준라이브러리 `opal-rgb-tiff-png-lossless-v1`로 같은RGB표본/크기를 PNG2개498,510B에무손실변환했다. 모든픽셀/크기동등은 Pillow13/libtiff독립decode로대조해 변환원장에남겼다. 색변환·resize·보간·결측채움은0이며 출판팀의 대비강조·Minnaert/접합보정은 원본에이미포함돼있다. F657N/F547M/F467M=R/G/B이고 정량I/F/자연색/모형시각의새구름사진이아니다. Credit NASA/ESA/STScI; Amy Simon/OPAL team·DOI10.17909/T9G593을유지한다. 원TIF/README/취득·변환JSON10개1,586,689B를보존하고 이전단일필터/토성/명왕성원지도는수정하지않았다. Pillow13.0.0의선택개발검증잠금은 서버/표준변환의필수의존성이아니다.

표시정본재연결은 `appearance.json`128,238B/SHA `d0de5f97913addcfe2d70fff2859024c75e7edb3069d5a17f4d9a7022b4467e1`, 소천체정본47,152B/SHA `a531089598a6b56322d5f407d89026618153a463b5de4c10232156af47e1b49d`, 질량정본130,355B/SHA `adca7ca7cd2425d9063a8db686389d6def187b1a5c7bb0a18b2faf42a97091d9`다. 뒤두정본은 최상위dependencies외모든과학값·생성일/배열이동등하다. [호환원장](../data/manifests/display_dependency_compatibility.json)4,320B/SHA `71dbfc9ef3f9551f583e672a8333e5911cf9071a93aea6332bc3ce3a66e8aa04`와044329ZIP의원member두불변history leaf가정확두hash쌍만증명한다. 원근거봉투·관측·판단은보존하고 활성세션의표시참조만명시이행한다. 문헌/관측/계산의source불일치를포괄허용하지않는다.

[Data_Spec DEV-020절](../Data_Spec.md)에 모든신규파일의현재바이트/SHA·원URL/역할·픽셀/과학payload동등조건을기록했다. 전체새export/최종ZIP/브라우저/공개배포·재시작검사는 진행중이므로 이목록으로완료를대신하지않는다. 기능/상태계약은FSD24를따른다.
