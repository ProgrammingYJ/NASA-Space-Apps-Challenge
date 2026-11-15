# 태양계 출처 사용 경계와 초기57개 후보 검토

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다.

## 현재 사용 상태 — v0.17.0 / DEV-027·OPS-021

현재 제품은 태양계1000AU의 알려진 천체·공전/자전/시간재생·행성3요건·실제 SPHEREx·제9행성 가설을 다룬다. 아래57개 표는 **초기 출처 후보 inventory의 역사**이며 현재 구현 천체 수·원관측 수·모든 데이터 사용 여부를 나타내지 않는다. 최신 채택 파일/ID·원URL/해시·권리·누락·검증 범위는 [Data_Spec.md](../Data_Spec.md), 동작과 가정은 [FSD](../FSD.md)를 따른다.

| 현재 용도 | 정본과 해석 |
| --- | --- |
| 위치·공전·시간 | `data/manifests/solar_system_ephemeris.json`·`solar_system_orbits.json`·장기/확장 태양계 manifest. 천체력 보간·장기 근사·위성 상대궤도를 구분하고 기준계/epoch·시간계·유효범위를 보존한다. |
| 분류·물리량·외관 | `planet_criteria.json`·`mass_scenarios.json`·`small_body_appearance.json`·`appearance.json`. 실측·계 질량·가정 질량·설명용 대표 외관/실제 지도·미측정 값을 구분한다. 초기 설명 URL 확인만으로 수치를 채택하지 않는다. |
| 해왕성 바깥 알려진 천체 | `outer_tno.json`의 JPL snapshot8341개. 관측 목록의 소천체이며 모두 행성이 아니다. 원소 누락/불확실성·단순 두체 외삽 경고를 유지한다. 1000AU는 탐색 기준이며 전수 발견·물리적 벽이 아니다. |
| 실제 궤도 유사도 TOP5 | 가설과 알려진 천체의 a/e/i를 비교하는 `tno-source-aei-exploratory-v1` 규칙. 초기 문헌 표본으로 준비하고 가설 입력 변경 시 갱신한다. 설명용 순위이며 전체 궤도 적합도·제9행성 발견/존재확률이 아니다. |
| 별도 문헌 하늘 영역 | `planet_nine_scope.json`과 원100,000 합성 표본. 2018 좌표·survey 조건·표본 분모·셀 면적을 유지한다. 이 조건부 하늘 영역 TOP5는 위의 실제 천체 TOP5와 다른 결과다. |
| 실제 SPHEREx | `datasets.json`·`observation_registry.json`: 10대상·40제품·37무순서쌍/양방향74비교. 원 DATE-AVG/TIMESYS·FLAGS·관측자 예측·source/보정 SHA와 품질 상태를 보존한다. Node는 검증된 빌드 캐시를 제공하며 새 검출/측광 성공으로 표시하지 않는다. |

DEV-027에서 새 원관측·물리 자료를 추가하지 않았고 기존114생성 JSON/74비교의 원핀은 동일하다. 공개 검증은 [v0.17.0](releases/v0.17.0.json)·[DEV-027 검사](qa/dev027_local_verification.json)를 따른다. 삭제된 Sydney에서 사본 없는 후속 근거의 복구까지 보장하지 않으며, 실제 확보/복구 범위는 [OPS-021](qa/ops021_migration_verification.json)에 기록한다.

이번 문서 현행화에서는 아래 외부 URL을 새로 조회하지 않았다. 2026-11-14의 URL/title·본문 대조는 그 시점의 기록으로 남긴다. 은하·외계행성·역사·블랙홀/범용 실험 자료는 현재 활성 의존성에서 제외한다.

## 역사: 초기57개 출처 후보 검토

사용자가 제공한 천체/공식 출처 목록을 별도 후보 inventory로 보존했다. **57개 항목은 태양계 탐색·정보 패널에 쓸 출처 후보이며, 57개의 SPHEREx 관측이나 검증된 궤도 데이터 묶음은 아니다.** 실제 관측 목록 [datasets.json](../data/manifests/datasets.json)과 섞지 않는다. 기능·과학·우선순위는 [AGENTS.md](../AGENTS.md)를 따른다.

기계 목록: [solar_system_source_candidates.json](../data/manifests/solar_system_source_candidates.json). 원문은 Git 제외 내부 폴더에 보존했다. 이 작업은 원본 관측 102파일/최신 공식46파일을 변경하거나 추가하지 않았다.

### 초기 집계와 실제 검사 범위

- 천체57개, 같은 천체 중복0: 항성1·행성8·왜행성5·자연위성41·해왕성 바깥 소천체1·가설 행성1.
- 알려진 천체56개와 미발견 가설 Planet Nine1개를 구분한다. 알려진 천체라는 분류는 이 앱에서 관측/검출/실측했다는 뜻이 아니다.
- 천체 항목의 고유 원URL은28개다. 통합출처7항목을 합치면 고유URL34개다. JPL 위성 물리량 공통표를21천체가, 일반 위성 포털을2천체가 공유한다. 같은 페이지를 여러 천체가 인용했다고 독립 데이터셋 수를 늘리지 않는다.
- 2026-11-14 KST 기준34URL 모두 기본 TLS 검증 GET·HTTP200·문서 title을 확인했다. 목성의 Io/Europa/Ganymede/Callisto 제공URL은 현재 `/jupiter/jupiter-moons/` 경로로 redirect되며 원/최종URL을 모두 기록했다.
- 모든 본문의 심층 검토나 개별 수치 검증을 완료한 것은 아니다. 질량/반지름/궤도 원소/상태벡터의 채택 수치는0개이고, 앱에 구현한 천체도 이 작업에서는0개다. HTTP200은 데이터 정확도·용도 적합성·이미지 권리 확인과 별개다.

### 당시 직접 내용까지 대조한 출처

[NASA Planet X](https://science.nasa.gov/solar-system/planet-x/)는 아직 발견되지 않은 가설임을 명시한다. 이 페이지를 확정 천체의 위치나 존재확률 입력으로 삼지 않는다. 개별 가설과 문헌 조건부 위치 분포를 구분하는 기존 계약을 유지한다.

[NASA Pluto](https://science.nasa.gov/dwarf-planets/pluto/)는 명왕성의 왜행성 분류·설명·탐사 맥락에 사용할 후보 출처다. 해당 페이지는 시각별3D 상태벡터나 SPHEREx 원본 노출이 아니다. Planet X 설명 페이지의 명왕성 재분류 연도 문장(2016)과 Pluto 설명(2006)이 상충하므로 그 문장을 무검토 전사하지 않는다.

[JPL 위성 물리량 표](https://ssd.jpl.nasa.gov/sats/phys_par/)는 GM·평균 반지름·밀도, 오차·참조를 함께 제공한다. 밀도는 GM/반지름에서 파생된 항목이며 n/a·상한도 존재한다. 추후 채택할 때 단위·오차·참조·상한/누락 상태를 같이 가져와야 한다. 이 표만으로 시간에 따른 궤도를 만들지 않는다.

[세드나 SBDB 도구](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=90377)는 JavaScript 화면이다. 정적 HTML title 확인만으로90377의 수치가 검증되지는 않는다. 보강 확인으로 [공식 SBDB API](https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=90377&phys-par=true)를 기본 TLS로 읽어 `90377 Sedna (2003 VB12)`의 식별과 epoch/원소 필드 존재를 확인했다. 반환된 수치를 시뮬레이션에 채택·검산하지는 않았다.

### 초기 사용 계획

1. 단계1–2의 실제 관측→품질→저장/복원 경로를 먼저 완성한다. 이 목록으로 구현 순서를 바꾸지 않는다.
2. 단계3 최소3D의 후보는 태양·8행성·명왕성이다. 검증한 범위에서만 먼저 표시하고, 명왕성 선택을 기존 실제 SPHEREx 노출 ID와 연결한다. 출처 링크·천체 설명은 선택 정보 패널에서 제공한다.
3. 나머지 위성/왜행성/세드나는 검색·설명·확장 카탈로그 후보로 보존한다. 57천체 모두의 궤도/텍스처 구현을 새 필수 기능으로 추가하지 않는다.
4. 실제 움직임을 넣을 천체는 별도 천체력/검증한 궤도 입력을 확보한다. 천체 식별자·중심/관측자·기준계/기준면·epoch/시간계·단위·유효기간·출처/버전을 기록하고 독립 비교한다. 단순 물리량 표와 교육 설명으로 궤도를 임의 생성하지 않는다.
5. 미검증 수치/거리/방향은 채우지 말고 상태를 표시한다. 텍스처/이미지/코드를 가져올 때 개별 이용 조건·크레딧을 확인한다. 출처 페이지 열람은 NASA 로고 사용 허락을 뜻하지 않는다.

### 초기 전체 천체 목록

아래 모든 행의 **초기 inventory 검토 상태**는 **출처URL 확인 / 수치·천체력 미검증 / 앱 사용 전 후보**였다. 현재 사용/검증 상태는 위의 채택 정본을 확인한다. 이 표의 분류·상위 천체는 후보 카탈로그 정리이며 개별 물리량을 검증했다는 표기가 아니다.

| 순번 | 천체 | 분류 | 제공 출처 범위 | 출처 |
| --- | --- | --- | --- | --- |
| 1 | 태양 / Sun | 항성 | individual_body_overview | [공식 링크](https://science.nasa.gov/sun/) |
| 2 | 수성 / Mercury | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/mercury/) |
| 3 | 금성 / Venus | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/venus/) |
| 4 | 지구 / Earth | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/earth/) |
| 5 | 화성 / Mars | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/mars/) |
| 6 | 목성 / Jupiter | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/jupiter/) |
| 7 | 토성 / Saturn | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/saturn/) |
| 8 | 천왕성 / Uranus | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/uranus/) |
| 9 | 해왕성 / Neptune | 행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/neptune/) |
| 10 | 세레스 / Ceres | 왜행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/ceres/) |
| 11 | 명왕성 / Pluto | 왜행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/pluto/) |
| 12 | 하우메아 / Haumea | 왜행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/haumea/) |
| 13 | 마케마케 / Makemake | 왜행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/makemake/) |
| 14 | 에리스 / Eris | 왜행성 | individual_body_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/eris/) |
| 15 | 달 / Moon | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/moon/) |
| 16 | 포보스 / Phobos | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 17 | 데이모스 / Deimos | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 18 | 이오 / Io | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/jupiter/moons/io/) |
| 19 | 유로파 / Europa | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/jupiter/moons/europa/) |
| 20 | 가니메데 / Ganymede | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/jupiter/moons/ganymede/) |
| 21 | 칼리스토 / Callisto | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/jupiter/moons/callisto/) |
| 22 | 아말테아 / Amalthea | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 23 | 히말리아 / Himalia | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 24 | 엘라라 / Elara | 자연위성 | general_satellite_portal | [공식 링크](https://ssd.jpl.nasa.gov/sats/) |
| 25 | 테베 / Thebe | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 26 | 메티스 / Metis | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 27 | 아드라스테아 / Adrastea | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 28 | 타이탄 / Titan | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/saturn/moons/titan/) |
| 29 | 레아 / Rhea | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 30 | 이아페투스 / Iapetus | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 31 | 디오네 / Dione | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 32 | 테티스 / Tethys | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 33 | 엔셀라두스 / Enceladus | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/saturn/moons/enceladus/) |
| 34 | 미마스 / Mimas | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 35 | 히페리온 / Hyperion | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 36 | 포에베 / Phoebe | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 37 | 야누스 / Janus | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 38 | 티타니아 / Titania | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 39 | 오베론 / Oberon | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 40 | 움브리엘 / Umbriel | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 41 | 아리엘 / Ariel | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 42 | 미란다 / Miranda | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/uranus/moons/miranda/) |
| 43 | 트리톤 / Triton | 자연위성 | individual_body_overview | [공식 링크](https://science.nasa.gov/neptune/moons/triton/) |
| 44 | 네레이드 / Nereid | 자연위성 | general_satellite_portal | [공식 링크](https://ssd.jpl.nasa.gov/sats/) |
| 45 | 프로테우스 / Proteus | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 46 | 라리사 / Larissa | 자연위성 | shared_satellite_physical_parameter_table | [공식 링크](https://ssd.jpl.nasa.gov/sats/phys_par/) |
| 47 | 카론 / Charon | 자연위성 | shared_pluto_moons_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/pluto/moons/) |
| 48 | 닉스 / Nix | 자연위성 | shared_pluto_moons_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/pluto/moons/) |
| 49 | 히드라 / Hydra | 자연위성 | shared_pluto_moons_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/pluto/moons/) |
| 50 | 케르베로스 / Kerberos | 자연위성 | shared_pluto_moons_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/pluto/moons/) |
| 51 | 스틱스 / Styx | 자연위성 | shared_pluto_moons_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/pluto/moons/) |
| 52 | 히이아카 / Hiʻiaka | 자연위성 | parent_dwarf_planet_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/haumea/) |
| 53 | 나마카 / Namaka | 자연위성 | parent_dwarf_planet_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/haumea/) |
| 54 | MK 2 / MK 2 | 자연위성 | parent_dwarf_planet_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/makemake/) |
| 55 | 디스노미아 / Dysnomia | 자연위성 | parent_dwarf_planet_overview | [공식 링크](https://science.nasa.gov/dwarf-planets/eris/) |
| 56 | 세드나 / Sedna | 해왕성 바깥 소천체 | javascript_lookup_tool_with_object_fragment | [공식 링크](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=90377) |
| 57 | 제9행성 / Planet Nine | 미발견 가설 | hypothesis_overview | [공식 링크](https://science.nasa.gov/solar-system/planet-x/) |

### 초기 통합 출처

- [NASA 태양계 전체](https://science.nasa.gov/solar-system/)
- [NASA 행성 및 왜행성](https://science.nasa.gov/solar-system/planets/)
- [NASA 위성 전체](https://science.nasa.gov/solar-system/moons/facts/)
- [NASA JPL 천체 데이터베이스](https://ssd.jpl.nasa.gov/)
- [NASA 행성 물리량](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [NASA JPL 위성 물리량](https://ssd.jpl.nasa.gov/sats/phys_par/)
- [한국천문연구원](https://astro.kasi.re.kr/)

추가 자료가 실제 채택되면 Data_Spec의 사용 상태·입력 ID/필드·단위/버전·검사·기능/결과 참조로 연결한다. 초기 후보 목록은 당시 기록으로 보존하고 원문을 읽은 사실과 앱에 사용/검증한 사실을 별도로 표시한다.
