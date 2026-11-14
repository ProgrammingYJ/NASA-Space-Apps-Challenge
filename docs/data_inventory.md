# 과학 자료 저장 위치와 사용 상태

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

사용자의 명시적 요청으로 [Data_Spec.md](../Data_Spec.md)를 별도 전수 기록으로 만들었다. 파일1497개(data1454+public43), 내장원응답32개, 정적복제43개와 후보/URL검토를 기록하며 실사용6원본/보정과 확보만96개를 구분한다. 이 파일의 이전 요약/취득 이력은 보존하고 최신 데이터별용도/가공/권리·SHA는Data_Spec 및실행manifest에서확인한다.

현재 역사화면은 cosmic_observations.json29,430B/SHA bc12aa27c63d8c7b88d8b175534c0b935f4546beb029ccca31c1ce2c14d0b0d6의5공개관측이미지2,034,618B를쓴다. 기존기사5개892,182B재사용+새정책/caption6HTML680,354B=11참조1,572,536B다. age.46/.6/.7/.74Gyr와CEERS.6–6Gyr는출처의추정/표본범위다. raw detector/자연색으로주장하지않고lens/ALMA gas·velocity/처리와credit/license를함께표시한다. NASA2는해당미디어지침,ESA/ESO3은CC-BY4.0/전체credit을보존한다.

기존 cosmic_history/morphology 원문과 가상 renderer는이전/중간기록으로보존하지만현재App에서가상35은하/변형/임의10anchor를표시하지않는다. 사용자실제관측-only선택이중간시안보다우선한다. 별도 관측이 없는 날짜의사진/관측사이중간프레임을만들지않는다.
