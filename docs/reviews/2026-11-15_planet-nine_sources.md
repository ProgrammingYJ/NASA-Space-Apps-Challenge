# 제9행성 출처 검토와 주장별 원논문 연결

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](../releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다.

> 현행 연결(2026-11-15): 이 문서는 작성 당시 결정·검토 기록이다. 당시의 “미구현/예정”은 현재 상태 판정이 아니다. 현재 태양계1000AU·제9행성/실관측 범위와 Node 전용 실행, 실제 궤도 유사도 TOP5·PC Chrome 권장·모바일 안내, 새 EC2 검증은 [FSD31~34](../../FSD.md)와 v0.17.3 재활성화의 [철회·복귀 정본](../releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4는 철회된 과거 검증이며 [v0.17.0](../releases/v0.17.0.json)은10기능경로의 당시 검증 스냅샷이다. 외부 자료를 이번 문서 정리에서 다시 조회한 것으로 주장하지 않는다.

검토일: 2026-11-15 KST. **문헌·데이터 읽기와 문서 작성만 수행했다.** 새 제품 코드·모형 피팅·후보 순위·지도·MCP 연결을 구현하거나 검증한 결과가 아니다. 최신 개발 계약은 [FSD.md](../../FSD.md), 실제 데이터 채택 상태는 [Data_Spec.md](../../Data_Spec.md)에 둔다.

## 1. 실제 확인한 원논문과 역할

아래 링크는 검색결과가 아닌 해당 논문 원문/저자 업로드와 DOI다. arXiv 초록·버전과 필요한 본문, Crossref DOI 등록 메타데이터를 확인했다. 모든 논문을 수치 재현하거나 모든 부록을 정밀 검산했다는 뜻은 아니다. DOI를 web 도구가 차단한 경우 접근 가능한 arXiv 원문과 등록 메타데이터를 대조했다.

| source_id | 논문과 원문 링크 | 주장을 지지하는 범위 / 제품 활용 상태 |
| --- | --- | --- |
| P9-P01 | Batygin & Brown (2016), **Evidence for a Distant Giant Planet in the Solar System**. [arXiv:1601.05438v1](https://arxiv.org/abs/1601.05438v1), [DOI](https://doi.org/10.3847/0004-6256/151/2/22) | 초기 동역학 가설과 궤도 정렬 설명. 당시 모형·통계이며 현재의 측정된 행성이나 존재확률이 아니다. 역사·가설 맥락 참고. |
| P9-P02 | Batygin, Adams, Brown & Becker (2019), **The Planet Nine Hypothesis**. [arXiv:1902.10103](https://arxiv.org/abs/1902.10103), [DOI](https://doi.org/10.1016/j.physrep.2019.01.009) | 질량5–10 M⊕·반장축400–800 AU 등은 이 검토 논문의 가설 범위다. 현재 거리800 AU라는 관측값으로 옮기지 않는다. 배경 문헌. |
| P9-P03 | Brown & Batygin (2021), **The Orbit of Planet Nine**, AJ162,219. [arXiv:2108.09868v2](https://arxiv.org/abs/2108.09868v2), [DOI](https://doi.org/10.3847/1538-3881/ac2056) | 관측 선택효과와 시뮬레이션을 결합한 조건부 매개변수 추론. Caltech 표본의 바탕이다. 99.6%라는 군집 통계는 P9 존재확률이 아니다. 원표본의 과학적 맥락으로 채택. |
| P9-P04 | Brown & Batygin (2022), **A Search for Planet Nine using the Zwicky Transient Facility Public Archive**, AJ163,102. [2021년 arXiv:2110.13117](https://arxiv.org/abs/2110.13117), [DOI](https://doi.org/10.3847/1538-3881/ac32dd) | 합성 참조 집단과 ZTF 탐색·회수 조건. ZTF flag 해석의 근거다. 사전논문은2021년, 학술지 출판은2022-01-31로 구분한다. |
| P9-P05 | Belyakov, Bernardinelli & Brown (2022), **Limits on the Detection of Planet Nine in the Dark Energy Survey**. [arXiv:2203.07642](https://arxiv.org/abs/2203.07642), [DOI](https://doi.org/10.3847/1538-3881/ac5c56) | DES에서 합성 표본의 탐색 가능 영역·회수 제약. DES flag 근거다. 회수율을 실제 P9의 진위나 앱 검출 성능으로 사용하지 않는다. |
| P9-P06 | Brown, Holman & Batygin (2024), **A Pan-STARRS1 Search for Planet Nine**, AJ167,146. [arXiv:2401.17977v1](https://arxiv.org/abs/2401.17977v1), [DOI](https://doi.org/10.3847/1538-3881/ad24e9) | PS1+ZTF+DES에 의한 BB21 모형 공간 제약. 논문의 약78% 배제는 해당 합성 모형·조사 조건에 관한 결과이고, P9 부재확률78%가 아니다. survey subset 해석에 채택. |
| P9-P07 | Napier et al. (2021), **No Evidence for Orbital Clustering in the Extreme Trans-Neptunian Objects**, PSJ2,59. [arXiv:2102.05601v3](https://arxiv.org/abs/2102.05601v3), [DOI](https://doi.org/10.3847/PSJ/abe53e) | 선택함수가 알려진 조사들의14 ETNO 표본은 균일 각도 분포와 양립한다는 반론. 군집 가설·선택효과 안내에 함께 연결한다. 이 표본에서 유의한 군집을 못 찾았다는 결과가 P9의 부재 증명은 아니다. |
| P9-P08 | Shankman et al. (2017), **OSSOS VI. Striking Biases in the detection of large semimajor axis Trans-Neptunian Objects**. [arXiv:1706.05348v2](https://arxiv.org/abs/1706.05348v2), [DOI](https://doi.org/10.3847/1538-3881/aa7aed) | 실제 조사 선택효과가 겉보기 정렬을 만들 수 있음을 보이는 독립 표본 검토. 전체 SBDB 산점도를 무편향 모집단처럼 분석하지 않는 근거. |
| P9-P09 | Siraj, Chyba & Tremaine (2025), **Orbit of a Possible Planet X**, ApJ978,139. [arXiv:2410.18170v2](https://arxiv.org/abs/2410.18170v2), [DOI](https://doi.org/10.3847/1538-4357/ad98f6) | 질량4.4±1.1 M⊕·a290±30 AU·e0.29±0.13·i6.8±5.0°는 이 별도 모형의 추론이다. Caltech BB21 표본을 이 값으로 바꾸거나 두 사후분포를 섞지 않는다. 비교 문헌이며 새 분포로 제품 채택하지 않음. |
| P9-P10 | Cheng, Li & Yang (2026), **Discovery of a Dwarf Planet Candidate in an Extremely Wide Orbit: 2017 OF201**, ApJL998,L6. [최신 arXiv:2505.15806v2](https://arxiv.org/abs/2505.15806v2), [고정2025년v1](https://arxiv.org/abs/2505.15806v1), [DOI](https://doi.org/10.3847/2041-8213/ae3a75) | 실제 알려진 TNO의 궤도와 정렬 논의에 주는 제약이다. 왜행성 후보이며 P9 자체가 아니다. 추정 크기는 알베도 가정에 의존한다. 새 관측·공식 SBDB 입력 검토 대상. |
| P9-P11 | Malhotra, Volk & Wang (2016), **Corralling a distant planet with extreme resonant Kuiper belt objects**. [arXiv:1603.02196v3](https://arxiv.org/abs/1603.02196v3), [DOI](https://doi.org/10.3847/2041-8205/824/2/L22) | 주기비가 특정 공명에 가깝다는 가정을 활용한 별도 위치/궤도 제약. 주기비만으로 실제 공명이 확인되었다고 하지 않는다. 대안 모형 참고. |
| P9-P12 | Holman et al. (2023), **ASSIST: An Ephemeris-quality Test-particle Integrator**, PSJ4,69. [DOI](https://doi.org/10.3847/PSJ/acc9a9) | 고정 천체력에 따른 시험입자 적분과 선택적 상대론 항 검토의 참고다. 현재 제한 RK4 구현을 ASSIST와 동일한 정밀 해로 부르지 않는다. 수식·검증 방법 참고. |

위 목록은 문헌 전수조사가 아니다. 실제 계산 입력, 독립 검산, 가설·반론 설명, 후속 검토를 역할별로 나누어 채택해야 한다. 문헌을 많이 열었다는 사실이 위치 정확도나 발견 가능성을 보장하지 않는다.

## 2. 실제 Caltech Version3 표본과 survey subset

정본: [Planet Nine reference population, Version3.0](https://data.caltech.edu/records/8fjad-x7y61), [자료 DOI](https://doi.org/10.22002/8fjad-x7y61). 저장소 기록의 공개일은2023-04-05이며,2021년 BB21 분포에서 만든 합성 집단에 조사별 제약 flag가 추가된 자료다. PS1 논문의2024년 출판 연도와 데이터 버전을 혼동하지 않는다.

실제 로컬 원본과 저자 예제의 읽기 결과:

| 파일 | 바이트 / SHA256 | 의미 |
| --- | --- | --- |
| `reference_population.csv` | 13,000,682 / `050b68182ecbf7fd76f280d8cc43c0683d207499aba1488a68092b834420a422` | 합성100,000행·17열. 실측 행성 목록이나 가설 존재확률 열이 아니다. |
| `README.TXT` | 1,208 / `89e96e080072d71aacd9c31110813e3a6a6f2cbfbae7e8d832d2bfafded3139b` | 원본 용도와 survey 제약 설명. |
| `overview_map.pro` | 3,554 / `d20e1ed69292f6cc15b0e24d1d26f8492566bcf69fc4f311d007086045f683b3` | subset 조건과 HEALPix RING/nside32의 예제. 실행하지 않고 전체 소스를 읽었다. |

`overview_map.pro`는 다음 조건을 사용한다. 이번 표의 행수는 원 CSV를 직접 읽어 센 검토값이며 제품 기능·UI 검증 결과가 아니다.

| subset_id 제안 | 저자 조건 | N | 그중 원 `R≤1000 AU` 행수 |
| --- | --- | ---: | ---: |
| `bb21_v3_full` | 전체 (`ZTF>=0`) | 100,000 | 98,549 |
| `bb21_v3_after_ztf` | `ZTF==0` | 43,827 | 42,376 |
| `bb21_v3_after_ztf_des` | `ZTF==0 && DES==0` | 38,794 | 37,460 |
| `bb21_v3_after_ztf_des_ps1` | `ZTF==0 && DES==0 && PS1==0` | 21,740 | 20,406 |

실제 예제의 현재 기본 조건은 마지막 행이다. **21,740/100,000은 이 합성 집단에서 남은 표본 비율이고 P9가 존재할 확률21.74%가 아니다.** `R`은 원 표본 기준시각의 합성 태양 거리다.2026년 현재 거리나 실제 관측 거리로 표시하면 안 된다.

예제는 `nside=32`, `ang2pix_ring`을 사용하므로 셀 수는12×32²=12,288개이고 면적이 같다. 예제의 sky-map 배열은 셀별 원시 count이며 색 막대는 상대 표시다. 제품에서 `n/N`과 `n/(NΩ)`를 제공하려면 선택 subset/분모·단위 입체각·epoch를 별도로 명시해야 한다.1000AU 조건을 추가하면 필터 전·후 분모를 함께 보존한다.

추가 확인 사항:

- 원 `varpi`는 근일점 경도다. 계산용 근일점 인수는 `omega=(varpi−Omega) mod360`이다.
- 숫자 JD2458270.0의 달력은2018-05-31 정오다. 원 주석의 “1 June2018”과 불일치하며 원 시간계·관측자 정의도 독립 확인 전이다.
- 원본의 반올림된 요소와 RA/Dec를 초각 수준의 정확한 역산 정답으로 쓰지 않는다.
- CSV의 밝기 열 이름은 `V`지만 예제 그림의 축에는 `R magnitude`가 적혀 있다. 그림 글자를 근거로 열 정의를 바꾸지 않고, 이를 SPHEREx 적외선 밝기로 변환하지 않는다.
- 지도 셀을 고른 뒤 MOST로 갈 때는 해당 셀의 **실제 원 row/궤도**를 고르고 요청 날짜의 별도 가설 예측/조회로 연결해야 한다.2018년 원 분포를 현재 날짜 사후분포로 조용히 바꾸면 안 된다.

## 3. 새 모형과 원 표본을 섞지 않는 이유

P9-P09는 BB21의 일부 수치만 갱신한 표가 아니라 다른 표본·모형·우도 비교를 사용한다. 논문 초록은 BB21 참조 집단 중0.06%만 새 모형 최댓값의1σ 영역에 든다고 설명한다. 이 수치 역시 P9의 존재확률이 아니다. 질량4.4 M⊕와 기존 BB21 궤도 분포를 조합하면 어느 논문의 일관된 사후분포도 되지 않는다. 새 모형은 별도 이름·입력/분포·검증 상태로만 비교한다. [P9-P09 원문](https://arxiv.org/html/2410.18170v2)

P9-P10의2025년v1은 보존 가능한 당시 문헌이다. 다만 현재 arXiv에는2026-01-16 v2가 있고 Crossref는2026-02-03의 ApJL 출판을 확인한다. 최신 안내에서 논문 전체를 “2025년 미심사 초안”으로만 소개하지 않는다.

## 4. 알려진 TNO 확장을 위한 공식 원자료 계약

- [JPL SBDB Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html): 여러 천체의 조건부 목록. `fields`, `full-prec`, `limit/limit-from` 및 실제 반환 `signature/version/count`를 기록한다.
- [SBDB filter 정의](https://ssd-api.jpl.nasa.gov/doc/sbdb_filter.html): `sb-class=TNO`는 **a>30.1 AU**의 궤도 분류다. 현재 태양 거리 r≤1000AU나 `a>250,q>30`과 동일한 조건이 아니다.
- [개별 SBDB API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html): 정밀 출력·물리량·공분산 등 필요한 개별 항목의 실제 제공 여부와 원 출처를 확인한다. 누락값을 임의0·평균 질량으로 채우지 않는다.
- [JPL Horizons 설명](https://ssd.jpl.nasa.gov/horizons/manual.html): 동일한 천체·중심·프레임·epoch·시간계·광행시간 조건에서 검산한다. 목록의 a/q/Q와 요청 날짜 r를 구분한다.

SBDB 문서는 `epoch`를 TDB Julian day, `om`을 승교점 경도, `w`를 근일점 인수로 정의한다. 행별 epoch/equinox·orbit ID·해결 시각·관측 arc·오차·source를 확보하고 큰 SPK ID는 문자열로 보존한다. 페이지 사이에 데이터베이스가 변할 수 있으므로 조회 시각/정렬/전수 행수·중복/누락을 검사해야 한다. 이 검토에서 새 TNO 전수 목록을 취득한 것은 아니다.

## 5. 사용자가 제공한 위키 문서의 처리

[나무위키 제9행성](https://namu.wiki/w/%EC%A0%9C9%ED%96%89%EC%84%B1)의 로컬 열람본에서 본문과 각주를 읽었고, [Wikipedia Planet Nine](https://en.wikipedia.org/wiki/Planet_Nine)의 모형 연혁·동역학·선택효과·대안·탐색/위치 제약 본문을 확인했다. 두 문서는 문헌 탐색 안내이며 계산 정본으로 채택하지 않는다.

서로 다른 시기의 궤도값·관측 거리·모형 추정이 함께 나오므로 값마다 원논문·모형을 분리한다. 나무위키의 해왕성 발견 연대 오류와 P9의 높은 발견확률·정확한 존재 판단처럼 읽힐 수 있는 서술은 전사하지 않는다. 새 TNO 하나의 궤도만으로 P9 전체를 확정하거나 배제하지 않는다. 외관·위성·표면 중력·밝기의 미측정 값을 실측으로 만들지 않는다.

나무위키 로컬 원문은 `var/qa/dev018/references/namu_planet_nine.html`(250,650B, SHA`e1636424ca0891ae21eac39c4a3825997e4bc6b2f3ba6e14ac5272ce278b39b5`)로 감사용 보존 중이다. 본문을 제품·공개 문서에 복제하거나 위키의 모든 주장·각주를 확인 완료로 올리지 않는다. 앱의 실제 설명 옆에는 위의 source_id에 연결되는 정확한 원논문 링크를 제공하는 것이 후속 구현 사항이다.
