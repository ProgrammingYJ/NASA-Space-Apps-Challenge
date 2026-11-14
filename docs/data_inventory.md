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

[Drive출처목록](https://drive.google.com/file/d/1XL1IS37QMpPsViaLtRaxPMwsU_VvSBeR/view?usp=drivesdk)

## 추가 태양계 출처 후보

새로 전달된57천체/7통합출처는 [검토문](./solar_system_sources.md)과 [후보 manifest](../data/manifests/solar_system_source_candidates.json)로 분리했다. 고유34URL의 접속/title을 확인했지만 개별 물리량·epoch별 궤도를 채택/검증한 묶음은 아니다. 기존102개 파일/최신46개 목록의 수를 늘리지 않는다. 3D 선택정보/출처와 추후 검증할 천체력·물리량 입력 후보로 활용하며, 실제 채택한 필드/조건/검사·기능/결과는 [FSD.md](../FSD.md)에 연결한다.

