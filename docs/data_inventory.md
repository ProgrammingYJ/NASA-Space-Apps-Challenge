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
