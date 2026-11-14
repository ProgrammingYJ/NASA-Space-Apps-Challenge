import type {Locale} from './types';

export const OBJECT_NAME_DISPLAY_VERSION='localized-object-names-v1';
export interface NameableObject {object_id:string;name:string;kind?:string;parent_id?:string}
export type ObjectNameMethod='international_name'|'documented_local_name'|'project_transliteration'|'numbered_satellite_convention'|'preserved_proper_name'|'international_designation'|'untranslated';
export interface ObjectNameInfo {label:string;canonicalName:string;method:ObjectNameMethod;references:string[]}
export const OBJECT_NAME_REFERENCES={
  iau:'https://www.iau.org/common/Uploaded%20files/PublicNamingofPlanetsandPlanetarySatellites.pdf',
  jpl:'https://ssd.jpl.nasa.gov/sats/discovery.html',
  kasiJupiter:'https://astro.kasi.re.kr/learning/pageView/5149',
  kasiSaturn:'https://astro.kasi.re.kr/learning/pageView/5155',
  kasiAlmanac:'https://astro.kasi.re.kr/file/astro_almanac_pdf/20260325110341610.pdf',
  japaneseMuseum:'https://www.kahaku.go.jp/exhibitions/vm/resource/tenmon/space/data/01satellite.html',
  naoDwarfs:'https://4d2u.nao.ac.jp/wp-content/uploads/mitaka/manual/mitaka_manual_J.pdf',
  naoQuaoar:'https://www.nao.ac.jp/contents/news/science/2026/20260505-prc-detail.pdf',
  taipei:'https://tam.gov.taipei/News_Content.aspx?n=B64052C7930D4913&s=12C099F39C50D2F0&sms=2CF1F5E2E0B96411',
  taipeiDwarfs:'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=59bccaf8-255b-4843-a4cb-d6516056ce78',
  cnes:'https://cnes.fr/dossiers/lunes-systeme-solaire',
  imcce:'https://promenade.imcce.fr/fr/pages4/443.html',
  imcceJupiter:'https://promenade.imcce.fr/fr/pages5/59.html',
  imcceSaturn:'https://promenade.imcce.fr/fr/pages6/651.html',
  frenchDwarfs:'https://lira.observatoiredeparis.psl.eu/Planetes-naines-le-tour-des-mini-mondes',
};

// International source names are never rewritten. This dictionary is display-only.
const ROWS:[string,string,string,string?][]=[
  ['Moon','달','月','Lune'],['Phobos','포보스','フォボス'],['Deimos','데이모스','ダイモス','Déimos'],
  ['Io','이오','イオ'],['Europa','유로파','エウロパ','Europe'],['Ganymede','가니메데','ガニメデ','Ganymède'],['Callisto','칼리스토','カリスト'],
  ['Mimas','미마스','ミマス'],['Enceladus','엔켈라두스','エンケラドゥス','Encelade'],['Tethys','테티스','テティス','Téthys'],['Dione','디오네','ディオネ','Dioné'],['Rhea','레아','レア','Rhéa'],['Titan','타이탄','タイタン'],['Hyperion','히페리온','ヒペリオン','Hypérion'],['Iapetus','이아페투스','イアペトゥス','Japet'],['Phoebe','포에베','フェーベ','Phœbé'],
  ['Amalthea','아말테아','','Amalthée'],['Himalia','히말리아',''],['Elara','엘라라','','Élara'],['Pasiphae','파시파에','','Pasiphaé'],['Sinope','시노페','','Sinopé'],['Lysithea','리시테아','','Lysithée'],['Carme','카르메','','Carmé'],['Ananke','아난케','','Ananké'],['Leda','레다','','Léda'],['Thebe','테베','','Thébé'],['Adrastea','아드라스테아','','Adrastée'],['Metis','메티스','','Métis'],
  ['Callirrhoe','칼리로에','','Callirrhoé'],['Themisto','테미스토',''],['Megaclite','메가클리테','','Mégaclité'],['Taygete','타이게테','','Taygété'],['Chaldene','칼데네','','Chaldéné'],['Harpalyke','하르팔리케','','Harpalyké'],['Kalyke','칼리케','','Calycé'],['Iocaste','이오카스테','','Jocaste'],['Erinome','에리노메','','Érinomé'],['Isonoe','이소노에','','Isonoé'],['Praxidike','프락시디케','','Praxidyké'],['Autonoe','아우토노에','','Autonoé'],['Thyone','티오네','','Thyoné'],['Hermippe','헤르미페','','Hermippé'],['Aitne','아이트네','','Aitné'],['Eurydome','에우리도메','','Eurydomé'],['Euanthe','에우안테','','Éuanthé'],['Euporie','에우포리에','','Euporie'],['Orthosie','오르토시에',''],['Sponde','스폰데','','Spondé'],['Kale','칼레','','Calé'],['Pasithee','파시테에','','Pasithée'],['Hegemone','헤게모네','','Hégémone'],['Mneme','므네메','','Mnémé'],['Aoede','아오에데','','Aoédé'],['Thelxinoe','텔크시노에','','Thelxinoé'],['Arche','아르케','','Arché'],['Kallichore','칼리코레','','Callichore'],['Helike','헬리케','','Hélicé'],['Carpo','카르포',''],['Eukelade','에우켈라데','','Eukéladé'],['Cyllene','킬레네','','Cyllène'],['Kore','코레','','Coré'],['Herse','헤르세','','Hersé'],['Dia','디아',''],
  ['Eirene','에이레네','エイレーネ'],
  ['Philophrosyne','필로프로시네','フィロフロシュネ'],['Eupheme','에우페메','エウフェメ'],['Valetudo','발레투도','ウァレトゥド'],['Pandia','판디아','パンディア'],['Ersa','에르사','エルサ'],
  ['Janus','아누스','','Janus'],['Epimetheus','에피메테우스','','Épiméthée'],['Helene','헬레네','','Hélène'],['Telesto','텔레스토','','Télesto'],['Calypso','칼립소',''],['Atlas','아틀라스',''],['Prometheus','프로메테우스','','Prométhée'],['Pandora','판도라','','Pandore'],['Pan','판',''],
  ['Ymir','이미르',''],['Paaliaq','팔리아크',''],['Tarvos','타르보스',''],['Ijiraq','이지라크',''],['Suttungr','수퉁그르',''],['Kiviuq','키비우크',''],['Mundilfari','문딜파리',''],['Albiorix','알비오릭스',''],['Skathi','스카티',''],['Erriapus','에리아포스',''],['Siarnaq','시아르나크',''],['Thrymr','트림르',''],['Narvi','나르비',''],['Methone','메토네','','Méthone'],['Pallene','팔레네','','Pallène'],['Polydeuces','폴리데우케스',''],['Daphnis','다프니스',''],['Aegir','에기르',''],['Bebhionn','베비온',''],['Bergelmir','베르겔미르',''],['Bestla','베스틀라',''],['Farbauti','파르바우티',''],['Fenrir','펜리르',''],['Fornjot','포르뇨트',''],['Hati','하티',''],['Hyrrokkin','히로킨',''],['Kari','카리',''],['Loge','로게',''],['Skoll','스콜',''],['Surtur','수르트',''],['Anthe','안테',''],['Jarnsaxa','야른삭사',''],['Greip','그레이프',''],['Tarqeq','타르케크',''],['Aegaeon','아이게온',''],
  ['Gridr','그리드르','グリーズ'],['Angrboda','앙그르보다','アングルボザ'],['Skrymir','스크리미르','スクリューミル'],['Gerd','게르드','ゲルズ'],['Eggther','에그테르','エッグテル'],['Beli','벨리','ベリ'],['Gunnlod','군뢰드','グンロズ'],['Thiazzi','티아지','シャチ'],['Alvaldi','알발디','アルヴァルディ'],['Geirrod','게이로드','ゲイルロズ'],
  ['Ariel','아리엘',''],['Umbriel','움브리엘',''],['Titania','티타니아',''],['Oberon','오베론','','Obéron'],['Miranda','미란다',''],['Cordelia','코델리아',''],['Ophelia','오필리아','','Ophélie'],['Bianca','비앙카',''],['Cressida','크레시다',''],['Desdemona','데스데모나','','Desdémone'],['Juliet','줄리엣','','Juliette'],['Portia','포샤',''],['Rosalind','로잘린드',''],['Belinda','벨린다',''],['Puck','퍽',''],['Caliban','칼리반',''],['Sycorax','시코락스',''],['Prospero','프로스페로','','Prospéro'],['Setebos','세테보스','','Sétébos'],['Stephano','스테파노','','Stéphano'],['Trinculo','트린쿨로',''],['Francisco','프란시스코',''],['Margaret','마거릿',''],['Ferdinand','페르디난드',''],['Perdita','페르디타',''],['Mab','마브',''],['Cupid','큐피드',''],
  ['Triton','트리톤',''],['Nereid','네레이드','','Néréide'],['Naiad','나이아드','','Naïade'],['Thalassa','탈라사',''],['Despina','데스피나',''],['Galatea','갈라테아','','Galatée'],['Larissa','라리사',''],['Proteus','프로테우스','','Protée'],['Halimede','할리메데',''],['Psamathe','프사마테',''],['Sao','사오',''],['Laomedeia','라오메데이아',''],['Neso','네소',''],['Hippocamp','히포캄프','ヒッポカンプ'],
  ['Charon','카론','カロン'],['Nix','닉스','ニクス'],['Hydra','히드라','ヒドラ'],['Kerberos','케르베로스','ケルベロス'],['Styx','스틱스','ステュクス'],
  ["Hi'iaka",'히이아카','ヒイアカ'],['Namaka','나마카','ナマカ'],['Dysnomia','디스노미아','ディスノミア'],['Weywot','웨이워트','ウェイウォット'],['Vanth','반트','ヴァンス'],['Xiangliu','상류','シャンリュウ'],
  ['Ceres','세레스','ケレス','Cérès'],['Haumea','하우메아','ハウメア','Hauméa'],['Makemake','마케마케','マケマケ','Makémaké'],['Eris','에리스','エリス','Éris'],['Sedna','세드나','セドナ'],['Quaoar','콰오아','クワオアー'],['Orcus','오르쿠스','オルクス'],['Gonggong','공공','ゴンゴン'],
];
// Names transcribed from the museum table, matched by planet and Roman satellite number.
const documentedJa:Record<string,string>={
  "Moon": "月",
  "Phobos": "フォボス",
  "Deimos": "ダイモス",
  "Io": "イオ",
  "Europa": "エウロパ",
  "Ganymede": "ガニメデ",
  "Callisto": "カリスト",
  "Amalthea": "アマルテア",
  "Himalia": "ヒマリア",
  "Elara": "エララ",
  "Pasiphae": "パシファエ",
  "Sinope": "シノーペ",
  "Lysithea": "リシテア",
  "Carme": "カルメ",
  "Ananke": "アナンケ",
  "Leda": "レダ",
  "Thebe": "テーベ",
  "Adrastea": "アドラステア",
  "Metis": "メティス",
  "Callirrhoe": "カリロエ",
  "Themisto": "テミスト",
  "Megaclite": "メガクリテ",
  "Taygete": "タイゲテ",
  "Chaldene": "カルデネ",
  "Harpalyke": "ハルパリケ",
  "Kalyke": "カリケ",
  "Iocaste": "イオカステ",
  "Erinome": "エリノーメ",
  "Isonoe": "イソノエ",
  "Praxidike": "プラクシディーケ",
  "Autonoe": "アウトノエ",
  "Thyone": "チオネ",
  "Hermippe": "ヘルミッペ",
  "Aitne": "アイトネ",
  "Eurydome": "エウリドメ",
  "Euanthe": "エウアンテ",
  "Euporie": "エウポリエ",
  "Orthosie": "オーソシエ",
  "Sponde": "スポンデ",
  "Kale": "カレ",
  "Pasithee": "パシテー",
  "Hegemone": "ヘゲモネ",
  "Mneme": "ムネメ",
  "Aoede": "アオエデ",
  "Thelxinoe": "テルクシノエ",
  "Arche": "アルケ",
  "Kallichore": "カリコレ",
  "Helike": "ヘリケ",
  "Carpo": "カルポ",
  "Eukelade": "エウケラデ",
  "Cyllene": "キレーネ",
  "Kore": "コレ",
  "Herse": "ヘルセ",
  "Dia": "ディア",
  "Mimas": "ミマス",
  "Enceladus": "エンケラドス",
  "Tethys": "テチス",
  "Dione": "ディオーネ",
  "Rhea": "レア",
  "Titan": "タイタン",
  "Hyperion": "ヒュペリオン",
  "Iapetus": "イアペタス",
  "Phoebe": "フェーベ",
  "Janus": "ヤーヌス",
  "Epimetheus": "エピメテウス",
  "Helene": "ヘレーネ",
  "Telesto": "テレスト",
  "Calypso": "カリプソ",
  "Atlas": "アトラス",
  "Prometheus": "プロメテウス",
  "Pandora": "パンドラ",
  "Pan": "パン",
  "Ymir": "イミール",
  "Paaliaq": "パーリアック",
  "Tarvos": "タルボス",
  "Ijiraq": "イジラック",
  "Suttungr": "スットング",
  "Kiviuq": "キビウック",
  "Mundilfari": "ムンディルファリ",
  "Albiorix": "アルビオリックス",
  "Skathi": "スカチ",
  "Erriapus": "エッリアポ",
  "Siarnaq": "シアルナック",
  "Thrymr": "トリム",
  "Narvi": "ナルビ",
  "Methone": "メトネ",
  "Pallene": "パレネ",
  "Polydeuces": "ポリデウケス",
  "Daphnis": "ダフニス",
  "Aegir": "アエギル",
  "Bebhionn": "ベブヒオン",
  "Bergelmir": "ベルゲルミル",
  "Bestla": "ベストラ",
  "Farbauti": "ファルバウチ",
  "Fenrir": "フェンリル",
  "Fornjot": "フォルニョット",
  "Hati": "ハチ",
  "Hyrrokkin": "ヒュロッキン",
  "Kari": "カリ",
  "Loge": "ロゲ",
  "Skoll": "スコル",
  "Surtur": "スルツール",
  "Anthe": "アンテ",
  "Jarnsaxa": "ヤルンサクサ",
  "Greip": "グレイプ",
  "Tarqeq": "タルケック",
  "Aegaeon": "エーゲオン",
  "Ariel": "アリエル",
  "Umbriel": "ウンブリエル",
  "Titania": "チタニア",
  "Oberon": "オベロン",
  "Miranda": "ミランダ",
  "Cordelia": "コーデリア",
  "Ophelia": "オフェーリア",
  "Bianca": "ビアンカ",
  "Cressida": "クレシダ",
  "Desdemona": "デズデモーナ",
  "Juliet": "ジュリエット",
  "Portia": "ポーシャ",
  "Rosalind": "ロザリンド",
  "Belinda": "ベリンダ",
  "Puck": "パック",
  "Caliban": "キャリバン",
  "Sycorax": "シコラックス",
  "Prospero": "プロスペロ",
  "Setebos": "セテボス",
  "Stephano": "ステファーノ",
  "Trinculo": "トリンキュロ",
  "Francisco": "フランシスコ",
  "Margaret": "マルガレット",
  "Ferdinand": "フェルディナンド",
  "Perdita": "ペルディタ",
  "Mab": "マブ",
  "Cupid": "キューピッド",
  "Triton": "トリトン",
  "Nereid": "ネレイド",
  "Naiad": "ナイアド",
  "Thalassa": "タラッサ",
  "Despina": "デスピナ",
  "Galatea": "ガラテア",
  "Larissa": "ラリッサ",
  "Proteus": "プロテウス",
  "Halimede": "ハリメデ",
  "Psamathe": "プサマテ",
  "Sao": "サオ",
  "Laomedeia": "ラオメデイア",
  "Neso": "ネソ"
};
const byCanonical=new Map(ROWS.map(([name,ko,ja,fr])=>[name,{ko,ja:documentedJa[name]??ja,fr:fr||name}]));
const specialHant:Record<string,string>={Moon:'月球',Ceres:'穀神星',Haumea:'妊神星',Makemake:'鳥神星',Eris:'鬩神星',Sedna:'賽德娜',Quaoar:'創神星',Orcus:'亡神星',Gonggong:'共工星',"Hi'iaka":'希亞卡',Namaka:'納瑪卡',Dysnomia:'迪絲諾美亞',Weywot:'韋沃特',Vanth:'萬特',Xiangliu:'相柳'};
const hantDocumented=new Set(['Moon','Ceres','Haumea','Makemake','Eris']);
const parentNames:Record<string,Record<Locale,string>>={
  earth:{ko:'지구',en:'Earth',ja:'地球','zh-Hant':'地球',fr:'Terre'},mars:{ko:'화성',en:'Mars',ja:'火星','zh-Hant':'火星',fr:'Mars'},jupiter:{ko:'목성',en:'Jupiter',ja:'木星','zh-Hant':'木星',fr:'Jupiter'},saturn:{ko:'토성',en:'Saturn',ja:'土星','zh-Hant':'土星',fr:'Saturne'},uranus:{ko:'천왕성',en:'Uranus',ja:'天王星','zh-Hant':'天王星',fr:'Uranus'},neptune:{ko:'해왕성',en:'Neptune',ja:'海王星','zh-Hant':'海王星',fr:'Neptune'},pluto:{ko:'명왕성',en:'Pluto',ja:'冥王星','zh-Hant':'冥王星',fr:'Pluton'},
  makemake:{ko:'마케마케',en:'Makemake',ja:'マケマケ','zh-Hant':'鳥神星',fr:'Makémaké'},
};
const koDocumented=new Set(['Moon','Phobos','Deimos','Io','Europa','Ganymede','Callisto','Mimas','Enceladus','Tethys','Dione','Rhea','Titan','Hyperion','Iapetus','Phoebe']);
const jaDwarfsDocumented=new Set(['Ceres','Haumea','Makemake','Eris','Sedna','Quaoar']);
const frDocumented=new Set(['Moon','Europa','Ganymede','Enceladus','Hyperion','Iapetus','Leda','Thebe','Epimetheus','Helene','Prometheus','Pandora','Telesto','Methone','Pallene','Tethys','Dione','Ceres','Haumea','Makemake','Eris']);

function chineseNumber(value:number):string {const digits='〇一二三四五六七八九';return value<10?digits[value]:value<20?`十${value%10?digits[value%10]:''}`:`${digits[Math.floor(value/10)]}十${value%10?digits[value%10]:''}`;}
function numberedHant(object:NameableObject):string|null {
  const limits:Record<string,[number,number,string]>={mars:[400,2,'火衛'],jupiter:[500,72,'木衛'],saturn:[600,66,'土衛'],uranus:[700,27,'天衛'],neptune:[800,14,'海衛'],pluto:[900,5,'冥衛']};
  const entry=limits[object.parent_id??''],match=/^moon-(\d+)$/.exec(object.object_id);if(!entry||!match)return null;
  const number=Number(match[1])-entry[0];return number>=1&&number<=entry[1]?`${entry[2]}${chineseNumber(number)}`:null;
}
function designationLabel(object:NameableObject,locale:Locale):string {
  const parent=parentNames[object.parent_id??'']?.[locale];if(locale==='en')return object.name;
  const kind=locale==='ko'?'위성':locale==='ja'?'衛星':locale==='zh-Hant'?'衛星':'satellite';
  return parent?`${object.name} · ${locale==='ja'?`${parent}の${kind}`:locale==='fr'?`${kind} de ${parent}`:`${parent}${locale==='ko'?' ':''}${kind}`}`:object.name;
}

export function objectNameInfo(object:NameableObject,locale:Locale):ObjectNameInfo {
  const base={canonicalName:object.name,references:[OBJECT_NAME_REFERENCES.iau,OBJECT_NAME_REFERENCES.jpl]};
  if(/^S\/\d{4}\s/.test(object.name)||object.name==='MK 2')return {...base,label:designationLabel(object,locale),method:'international_designation'};
  if(locale==='en')return {...base,label:object.name,method:'international_name'};
  if(locale==='zh-Hant'){
    const special=specialHant[object.name],label=special??numberedHant(object);
    if(label)return {...base,label,method:special?(hantDocumented.has(object.name)?'documented_local_name':'project_transliteration'):'numbered_satellite_convention',references:[...base.references,OBJECT_NAME_REFERENCES.taipei,...(hantDocumented.has(object.name)?[OBJECT_NAME_REFERENCES.taipeiDwarfs]:[])]};
  }
  const row=byCanonical.get(object.name);
  if(row){
    const label=locale==='ko'?row.ko:locale==='ja'?row.ja:locale==='fr'?row.fr:undefined;
    if(label){
      const documented=locale==='ko'?koDocumented.has(object.name):locale==='ja'?(object.name in documentedJa||jaDwarfsDocumented.has(object.name)):frDocumented.has(object.name);
      const references=locale==='ko'?[OBJECT_NAME_REFERENCES.kasiAlmanac,OBJECT_NAME_REFERENCES.kasiJupiter,OBJECT_NAME_REFERENCES.kasiSaturn]:locale==='ja'?[object.name in documentedJa?OBJECT_NAME_REFERENCES.japaneseMuseum:object.name==='Quaoar'?OBJECT_NAME_REFERENCES.naoQuaoar:OBJECT_NAME_REFERENCES.naoDwarfs]:[OBJECT_NAME_REFERENCES.cnes,OBJECT_NAME_REFERENCES.imcce,OBJECT_NAME_REFERENCES.imcceJupiter,OBJECT_NAME_REFERENCES.imcceSaturn,OBJECT_NAME_REFERENCES.frenchDwarfs];
      return {...base,label,method:label===object.name?'preserved_proper_name':documented?'documented_local_name':'project_transliteration',references:[...base.references,...(documented?references:[])]};
    }
  }
  return {...base,label:object.name,method:'untranslated'};
}
export function localizedObjectName(object:NameableObject,locale:Locale):string{return objectNameInfo(object,locale).label;}
const additionalAliases:Record<string,string[]>={Enceladus:['엔셀라두스','엔세라두스','엔젤라두스','エンケラドゥス'],Janus:['야누스'],Ceres:['케레스'],Charon:['샤론','凱倫'],Quaoar:['콰오어','クァオアー'],"Hi'iaka":['히이아카','히아카']};
export function objectNameAliases(object:NameableObject):string[]{return [...new Set([object.object_id,object.name,...(['ko','en','ja','zh-Hant','fr'] as Locale[]).map(locale=>localizedObjectName(object,locale)),...(additionalAliases[object.name]??[])])];}
export function normalizeObjectSearch(value:string):string{return value.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[\s’'ʻ‘`\-_\/().·]+/gu,'').toLowerCase();}
