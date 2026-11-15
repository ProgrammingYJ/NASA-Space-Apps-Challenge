const en={
  title:'Credits',creators:'Team contributions',science:'Mathematics / science verification',testers:'Testers',design:'UI/UX',backend:'Backend development',management:'Documentation and schedule management',leader:'Project lead',
  thanks:'Special thanks',advisor:'Club advisor',venue:'Venue support',data:'Data and images',download:'Download the data specification (PDF)',
  licenseDownload:'Download source and license notices (PDF)',licenseNote:'User-provided supplementary notice, including earlier project scope. See the data specification for current sources and conditions.',
  nasaRole:'Planetary data, ephemerides and visual references',irsaRole:'SPHEREx observations and archive access',geminiRole:'Original ε Indi Ba/Bb photograph',
  sourceNote:'The data specification and linked notices list the original sources, credits, usage conditions and scientific limits.',
  software:'Open source and AI disclosure',notices:'Third-party software and data notices',aiRecord:'AI assistance record',
  aiNote:'Codex assisted code, documentation and testing. Original observations are preserved with their source provenance.',
  repository:'GitHub repository',release:'Release',updated:'Updated',hashes:'Published file identifiers',pdfHash:'PDF SHA256',sourceHash:'Data_Spec.md SHA256',
};
type CreditsCopy=typeof en;
const ko:CreditsCopy={
  title:'크레딧',creators:'역할별 팀 기여',science:'수/과학 검산',testers:'테스터',design:'UI/UX',backend:'백엔드 개발',management:'문서 관리 및 일정 관리',leader:'프로젝트 리더',
  thanks:'특별히 감사한 분',advisor:'동아리 담당 선생님',venue:'장소 후원',data:'사용 데이터와 이미지',download:'사용 데이터 명세 PDF 다운로드',
  licenseDownload:'프로젝트 출처·라이선스 고지 PDF 다운로드',licenseNote:'사용자가 제공한 보충 고지서로 이전 프로젝트 범위도 포함합니다. 현재 출처와 사용 조건은 데이터 명세서를 확인하세요.',
  nasaRole:'행성 자료·천체력·외관 참조 자료',irsaRole:'SPHEREx 실제 관측과 아카이브 접근',geminiRole:'ε Indi Ba/Bb 실제 원본 사진',
  sourceNote:'데이터 명세와 연결된 고지에서 원출처·크레딧·사용 조건·과학적 한계를 확인할 수 있습니다.',
  software:'오픈소스·AI 활용 고지',notices:'외부 소프트웨어·데이터 사용 고지',aiRecord:'AI 활용 기록',
  aiNote:'Codex가 코드·문서·테스트 작성을 지원했습니다. 관측 원본은 출처와 함께 보존합니다.',
  repository:'GitHub 저장소',release:'릴리스',updated:'갱신일',hashes:'공개 파일 식별값',pdfHash:'PDF SHA256',sourceHash:'Data_Spec.md SHA256',
};
const ja:CreditsCopy={
  title:'クレジット',creators:'役割別のチーム貢献',science:'数学・科学の検算',testers:'テスター',design:'UI/UX',backend:'バックエンド開発',management:'文書管理・日程管理',leader:'プロジェクトリーダー',
  thanks:'特別な謝辞',advisor:'部活動顧問の先生',venue:'会場提供',data:'使用データと画像',download:'使用データの仕様書PDFをダウンロード',
  licenseDownload:'出典・ライセンス告知PDFをダウンロード',licenseNote:'ユーザー提供の補足告知で、以前のプロジェクト範囲も含みます。現在の出典と利用条件はデータ仕様書をご確認ください。',
  nasaRole:'惑星データ・天体暦・外観の参照資料',irsaRole:'SPHERExの実観測とアーカイブへのアクセス',geminiRole:'ε Indi Ba/Bbの原観測写真',
  sourceNote:'データ仕様書とリンク先の表示に、原出典・クレジット・利用条件・科学的な限界を記録しています。',
  software:'オープンソース・AI利用の表示',notices:'外部ソフトウェア・データの利用表示',aiRecord:'AI支援の記録',
  aiNote:'Codexがコード・文書・テストの作成を支援しました。観測原本は出典情報とともに保存しています。',
  repository:'GitHubリポジトリ',release:'リリース',updated:'更新日時',hashes:'公開ファイルの識別値',pdfHash:'PDF SHA256',sourceHash:'Data_Spec.md SHA256',
};
const zh:CreditsCopy={
  title:'製作名單',creators:'各職責的團隊貢獻',science:'數學／科學驗算',testers:'測試人員',design:'UI/UX',backend:'後端開發',management:'文件與時程管理',leader:'專案負責人',
  thanks:'特別致謝',advisor:'社團指導老師',venue:'場地贊助',data:'使用資料與影像',download:'下載使用資料規格PDF',
  licenseDownload:'下載來源與授權聲明PDF',licenseNote:'這是使用者提供的補充聲明，亦包含先前的專案範圍。目前來源與使用條件請參閱資料規格。',
  nasaRole:'行星資料、星曆與外觀參考',irsaRole:'SPHEREx實際觀測與檔案庫存取',geminiRole:'ε Indi Ba/Bb原始觀測照片',
  sourceNote:'資料規格與連結的聲明列出原始來源、署名、使用條件及科學限制。',
  software:'開放原始碼與AI使用聲明',notices:'第三方軟體與資料使用聲明',aiRecord:'AI協助紀錄',
  aiNote:'Codex協助程式碼、文件與測試撰寫。觀測原始檔連同來源資訊保存。',
  repository:'GitHub儲存庫',release:'版本',updated:'更新時間',hashes:'公開檔案識別值',pdfHash:'PDF SHA256',sourceHash:'Data_Spec.md SHA256',
};
const fr:CreditsCopy={
  title:'Crédits',creators:'Contributions de l’équipe par rôle',science:'Vérification mathématique et scientifique',testers:'Testeurs',design:'UI/UX',backend:'Développement du backend',management:'Gestion documentaire et du calendrier',leader:'Responsable du projet',
  thanks:'Remerciements particuliers',advisor:'Enseignant référent du club',venue:'Mise à disposition des locaux',data:'Données et images utilisées',download:'Télécharger les spécifications des données (PDF)',
  licenseDownload:'Télécharger les mentions des sources et licences (PDF)',licenseNote:'Notice complémentaire fournie par l’utilisateur, incluant un périmètre antérieur du projet. Consultez les spécifications des données pour les sources et conditions actuelles.',
  nasaRole:'Données planétaires, éphémérides et références visuelles',irsaRole:'Observations SPHEREx et accès aux archives',geminiRole:'Photographie originale de ε Indi Ba/Bb',
  sourceNote:'Les spécifications et les notices liées indiquent les sources originales, les crédits, les conditions d’utilisation et les limites scientifiques.',
  software:'Logiciels libres et déclaration d’usage de l’IA',notices:'Notices des logiciels et données tiers',aiRecord:'Registre de l’assistance par IA',
  aiNote:'Codex a aidé à rédiger le code, la documentation et les tests. Les observations originales sont conservées avec leur provenance.',
  repository:'Dépôt GitHub',release:'Version',updated:'Mise à jour',hashes:'Identifiants des fichiers publiés',pdfHash:'SHA256 du PDF',sourceHash:'SHA256 de Data_Spec.md',
};
export function creditsCopy(language:string):CreditsCopy{
  if(language.startsWith('zh-Hant'))return zh;
  return ({en,ko,ja,fr} as Record<string,CreditsCopy>)[language.split('-')[0]]??en;
}
