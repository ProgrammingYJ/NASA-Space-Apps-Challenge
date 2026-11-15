# AWS EC2 생성 안내

> 문서 현행화 정본(2026-11-15): 사용자 보조 PDF 철회에 따라 검증된 **v0.17.3을 현재 운영으로 재활성화했다.** 승인 닉네임·테스터6명/영어 기본값은 유지하며 보조 고지 PDF는 공개 동선에서 제거했다. [철회·복귀 정본](../docs/releases/notice-withdrawal-20261115.json)을 따른다. v0.17.4의 수치·SHA·검증은 철회된 과거 이력이며 현재 배포가 아니다. Git 결과는 정본에서 확인하고 아래 날짜별 기록은 당시 이력으로 보존한다. Git 구현 a55a0e0·철회 d3be874의 main push를 확인했다.

**OPS-021 호스트 구성과 v0.17.0 당시 검증(2026-11-15):** 사용자가 새 호스트 `54.117.136.144`와 DNS A 변경을 승인했다. SSH/IMDS에서 **Ubuntu24.04.5 x86_64·ap-northeast-2·m7i.xlarge·4CPU·16GB RAM·루트 약48GB/여유46GB**를 확인했다. 리전은 IP 주소로 추정하지 않는다. Node24.22.3과nginx1.24 설치·DNS A 확인·Let's Encrypt HTTPS 인증서 발급(만료2027-02-13)은 완료했다. **v0.17.0 당시 Node-only 정확 디렉터리·앱 활성화·정상 health/source·공개 Chrome10개·실제 재시작7024→7175·구판3근거 복원을 확인했다.** 이는 [v0.17.0 기능 검증 스냅샷](../docs/releases/v0.17.0.json)이다. 현재는 보조 PDF 철회 후 v0.17.3을 재활성화했으며 [철회·복귀 정본](../docs/releases/notice-withdrawal-20261115.json)·[FSD31~34](../FSD.md)를 따른다. v0.17.4는 철회된 과거 검증이고 인프라 준비와 앱 운영 검증을 구분한다.

이전 Sydney `16.176.170.4`는 사용자가 이미 종료·삭제했다고 확인했다. 확보된 로컬 OPS-020 불변 tgz13파일(관측 근거4·P9근거3·비교2·jobs4)과 구판 근거3원봉투를 원바이트로 보존·검증해 복구한다. 그 이후 로컬 사본이 없는 최신 근거는 복구를 보장할 수 없다. 새 ZIP은 만들지 않고 파일별 SHA가 있는 새 릴리스 디렉터리로 직접 배포한다. 개인키 내용·경로는 공개 문서나Git에 기록하지 않는다. 앱3002 loopback/nginx80·443, 영속shared 분리와 검증 후 활성화 계약은 유지한다.

아래 생성 표와 ZIP 실행 순서는 **OPS-020 이전 운영 이력**이다. 당시 Ubuntu24.04.5/m7i.xlarge/4vCPU/16GiB/50GiB·ap-southeast-2를 확인했고 실제 배포·프로세스 재시작/복원·DNS/HTTPS·Chrome3흐름·인증서 갱신dry-run을 검사했다. 당시 기록은 [OPS-020 검사](../docs/qa/ops020_migration_verification.json)와 릴리스 외부 보고서를 따르며 새 호스트의 완료 증거로 사용하지 않는다.

| 콘솔 항목 | 선택 |
| --- | --- |
| 리전 | 시드니 ap-southeast-2 (사용자 생성 호스트) |
| 이름 | planet-x-spherex |
| AMI | Canonical Ubuntu Server24.04LTS 일반판,64비트x86(amd64) |
| 인스턴스 | m7i.xlarge,4vCPU/16GiB |
| 구매 | 온디맨드 |
| 스토리지 | 암호화gp350GiB,기본3000IOPS/125MiB/s |
| 네트워크 | 인터넷게이트웨이경로가있는퍼블릭서브넷/퍼블릭IPv4 |
| SSH키 | 사용자관리키페어; 개인키내용을채팅/Git에넣지않음 |
| 인바운드 | 80/443공개,22는사용자공인IP만;3002/MCP포트비공개 |
| 고정주소 | 도메인연결전ElasticIP연결;실제할당/IP비용확인 |

생성후퍼블릭IP·선택AMI/인스턴스사양을확인한다. SSH사용자는ubuntu다. 앱은완결ZIP을새릴리스경로에풀고원SHA/필수자료를검사한뒤nginx→루프백3002와systemd로실행할예정이다. 영속근거는`/srv/planet-x/shared`로분리하고새릴리스가초기화하지않게한다. 최종실행명령/설치스크립트는검증한ZIP과함께전달한다. 기존도메인의DNS/프록시는새서버검증후전환한다.

사양/운영체제선정은현재자료처리·검증용초기여유이며성능이나과학정확도보장이아니다. 실제AWS요금/크레딧적용은사용자콘솔을따른다. GPU/로드밸런서/RDS는현재필수가아니다.

출처: [AWS M7i](https://aws.amazon.com/ec2/instance-types/m7i/),[리전별지원](https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-instance-regions.html),[CanonicalUbuntu](https://ubuntu.com/aws),[gp3](https://docs.aws.amazon.com/ebs/latest/userguide/general-purpose.html),[보안그룹](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).


## 이전 서울 구성의 일주일 예상비 · 168시간 (새 시드니 요금표 아님)

서울 Linux 온디맨드에서 m7i.large는 사용자 콘솔 표시 $0.1239/h로 $20.8152, 선택한 m7i.xlarge는 $0.2478/h로 $41.6304다. gp3 기본 성능50GiB를 7일만 유지하면 약$1.06(월$0.0912/GB,30일 근사), 공인IPv4 1개는 $0.005/h×168=$0.84다. 따라서 각각 약$22.72/$43.53이며 세금·월무료분 초과 송신·선택적 백업/추가서비스는 별도다. xlarge의 기본 운영 예산은 약$50로 안내했다. 크레딧 적용 서비스·만료/세금 처리·기존 계정의 무료 송신 잔여분은 실제 결제 콘솔을 따른다. 디스크/IP를 7일 뒤 계속 보유하면 해당 비용은 계속 발생한다. 사용자가 올린 화면은 Ubuntu26.04/m7i.large였으며 계획은24.04 일반판/x86/m7i.xlarge다.

[EC2 요금](https://aws.amazon.com/ec2/pricing/on-demand/), [EBS 요금](https://aws.amazon.com/ebs/pricing/), [IPv4 요금](https://aws.amazon.com/vpc/pricing/).

## 이전 ZIP 전달 당시 실행 순서

설정 파일은 `deploy/ec2`에 있다. 이 문서만으로 새 ZIP의 실행 검증이 완료됐다는 뜻은 아니다. 최종 ZIP과 외부 검증 보고서의 정확한 식별자를 확인한 뒤 진행한다.

1. SSH로 접속하고 ZIP 자체 SHA256을 개발자가 전달한 값과 대조한다. 새 빈 `/srv/planet-x/releases/릴리스명`에 **전체 ZIP**을 푼다. 이전 릴리스·`/srv/planet-x/shared`는 덮어쓰지 않는다.
2. 새 Ubuntu24.04 amd64 호스트에서 `sudo bash 새릴리스/deploy/ec2/install-host.sh`를 실행한다. nginx·공식 SHA가 고정된 Node24.22.3·전용계정·systemd를 준비한다. 기존 사용자 설정이 다르면 스크립트는 덮어쓰기 전에 중단한다. 이 단계는 앱을 시작하지 않는다.
3. `sudo bash 새릴리스/deploy/ec2/activate-release.sh /srv/planet-x/releases/릴리스명`을 실행한다. ZIP manifest와 원자료 SHA를 먼저 검사하고, 이전 writer를 중지한 뒤 current symlink를 바꾸며, shared/node를 그대로 사용한다. readiness 실패 시 이전 경로와 로그 안내를 남긴다. 기본 앱 포트3002는 loopback이며 nginx80을 통해 접근한다.
4. `curl --fail http://127.0.0.1/health/ready`와 공인IP의 같은 경로·실제 관측/근거 저장·내보내기·새 세션 복원·재시작을 확인한다. `sudo journalctl -u planet-x -n 100 --no-pager`로 로그를 본다.
5. 검증 후 도메인 DNS를 이 EC2의 ElasticIP로 전환한다. DNS 확인 뒤 `sudo apt-get install certbot python3-certbot-nginx`와 `sudo certbot --nginx -d nasaspaceappschallenge.marulee.dev`로 HTTPS를 설정한다. 인증서 이메일 등은 사용자 운영 정보다. SecurityGroup은80/443 공개·SSH22 사용자IP만 허용하고3002를 공개하지 않는다.

원상 복구는 서비스를 중지한 뒤 검증된 이전 릴리스를 current로 다시 연결하고 compatible shared 상태 전체를 사용한다. 새 버전이 상태를 변경했다면 정지 상태의 백업과 스키마 호환을 검토한다. 기존 근거를 삭제해서 ready를 회복하지 않는다. EC2 생성/SSH/DNS/HTTPS 실제 완료는 별도 확인 기록이 필요하다.

실제 EC2 생성/SSH 접속과 사양 확인은 완료했다. 로컬 개인키의 과도한 상속 접근권한을 전용 사용자로 제한한 뒤 접속했으며 개인키 내용을 출력/전송/패키징하지 않았다. 기존 도메인 A는 아직 이전 호스트이며 새 서버 검증 후 전환한다.

OPS-020 당시 운영:정식HTTPS주소·systemd planet-x·/srv/planet-x/current/app.js·/srv/planet-x/shared/node. 재시작은 `sudo systemctl restart planet-x`, 로그는 `sudo journalctl -u planet-x -n 100 --no-pager`. 이미HTTPS가설정된호스트에1회용install-host.sh를다시실행해nginx구성을덮어쓰지않는다. 당시전달은검증한완결ZIP/activate를사용했으며shared·인증서를유지했다. 본설정의원복드릴은실제구EC2버전부재로미수행이었다. OPS-021 신규 전달은 위의 릴리스 디렉터리 방식을 따른다.


## OPS-020 전송 압축과 호스트 이전

새호스트에 같은 원자료/저장근거를 이전하고 정상 HTTPS 인증서를 새로 발급했다. 기존 서버의 앱 writer는중지·자동시작해제하고 원자료/릴리스/shared/백업을 보존했다. EC2 컴퓨트 자체는 중지하지 않았으므로 계정 소유자가 콘솔에서 중지해야 비용이 줄어든다. 새계정의 실제크레딧자격/잔액은 별도로확인해야 한다. [AWS FAQ](https://aws.amazon.com/free/free-tier-faqs/)에따르면신규고객에게초기$100·활동완료추가최대$100이며기존고객의추가계정은대상이아니다.

nginx서버블록은JSON·JavaScript(application/javascript와text/javascript)·CSS·SVG에gzip압축을사용한다. 원응답을압축해제한바이트/SHA는동일하며관측/계산값을변경하지않는다. 대역폭측정은특정회선/시각사례이고일반사용자로드시간보장이아니다. 운영nginx는Certbot이생성한TLS설정을보존한다. 기존HTTPS호스트에는install-host.sh를다시적용하지말고새ZIP을별도release경로에풀어검증한후activate-release.sh만실행한다.
