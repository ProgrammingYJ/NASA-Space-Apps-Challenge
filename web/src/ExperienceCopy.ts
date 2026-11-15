const en={
  mobileTitle:'Open Planet X on a computer',
  mobileBody:'The interactive explorer is available on a PC. Mobile devices and tablets are not supported in this release.',
  recommended:'Recommended: Google Chrome on a PC',
  pcAddress:'Open this address on your computer',
  copyAddress:'Copy website address',copied:'Website address copied.',copyFailed:'Select and copy the address above.',
  language:'Language',download:'Download the data specification',repository:'View the public source repository',
  guideTitle:'Quick guide',openGuide:'Quick guide',close:'Close guide',
  guideIntro:'Explore real catalogued objects, compare a stated hypothesis, and keep the evidence behind your assessment.',
  guideSteps:[
    {title:'1. Find and select an object',body:'Search by name or select an object in the scene. The camera moves toward it. Drag to orbit, scroll to zoom, and right-drag to pan. Use the Solar System overview to return.'},
    {title:'2. Inspect actual observations',body:'Open Actual observations for linked targets, choose the A/B exposures and inspect Quality. Acquisition dates belong to the original files; changing the scene date does not create new images.'},
    {title:'3. Choose a hypothesis sample',body:'In Planet Nine, a literature search region contains alternative source samples. Choose one to calculate its hypothetical path. Orbit view folds the panel; Reopen hypothesis panel brings back the same work.'},
    {title:'4. Compare the actual-object TOP 5',body:'Known objects are ranked by differences in semimajor axis, eccentricity and inclination from the selected hypothesis. Similarity is not Planet Nine discovery probability or a verdict that an object is a planet. Changing the hypothesis can change this ranking.'},
    {title:'5. Save and restore your evidence',body:'Write your assessment and save, then export JSON. Actual-observation evidence and Planet Nine hypothesis evidence are separate records. Import the matching JSON and check the restored object, original dates, result/evidence ID and assessment before continuing.'},
  ],
  displayNote:'Scene distances may be compressed and globe radii enlarged for display. Past/future positions can be approximations. Read the stated source, time range and limitations; coverage alone is not a detection.',
};
type Copy=typeof en;
const ko:Copy={
  mobileTitle:'PC에서 Planet X를 열어주세요',
  mobileBody:'우주 탐색은 PC 환경에서 이용할 수 있습니다. 이번 릴리스에서는 휴대전화와 태블릿 접속을 지원하지 않습니다.',
  recommended:'권장 환경: PC의 Google Chrome',pcAddress:'PC에서 아래 주소로 접속하세요',copyAddress:'사이트 주소 복사',copied:'사이트 주소를 복사했습니다.',copyFailed:'위 주소를 선택해 복사해주세요.',language:'언어',download:'데이터 명세서 다운로드',repository:'공개 소스 저장소 보기',
  guideTitle:'간단한 사용 가이드',openGuide:'사용 가이드',close:'가이드 닫기',
  guideIntro:'관측된 천체와 명시한 가설을 비교하고, 판단의 근거를 저장하는 방법입니다.',
  guideSteps:[
    {title:'1. 천체 찾기와 선택',body:'이름을 검색하거나 화면의 천체를 선택하면 카메라가 접근합니다. 드래그는 회전, 휠은 확대·축소, 오른쪽 드래그는 이동입니다. 태양계 전체 보기로 돌아올 수 있습니다.'},
    {title:'2. 실제 관측과 품질 확인',body:'연결 자료가 있는 천체에서 실제 관측을 열고 A/B 노출을 선택한 뒤 품질을 확인하세요. 촬영 날짜는 원본 파일의 시각이며, 모형 날짜를 바꿔도 새 사진이 생기지 않습니다.'},
    {title:'3. 가설 표본 선택',body:'제9행성의 문헌 탐색 영역에는 서로 대안인 원표본이 있습니다. 하나를 고르면 가설 경로를 계산합니다. 가설 궤도 보기는 패널만 접으며, 가설 패널 다시 열기로 같은 작업에 돌아옵니다.'},
    {title:'4. 실제 천체 유사도 TOP 5 비교',body:'선택한 가설과 반장축·이심률·궤도 경사각의 차이가 작은 알려진 천체를 비교합니다. 유사도는 제9행성 발견 확률이나 행성 판정이 아닙니다. 가설을 바꾸면 순위도 달라질 수 있습니다.'},
    {title:'5. 근거 저장과 복원',body:'판단을 적고 저장한 뒤 JSON으로 내보내세요. 실제 관측 근거와 제9행성 가설 근거는 별도 기록입니다. 해당 JSON을 가져온 뒤 천체·원촬영 날짜·결과/근거 ID·판단이 복원됐는지 확인하세요.'},
  ],
  displayNote:'장면의 거리는 압축되고 구체 반지름은 확대될 수 있습니다. 과거·미래 위치는 근사일 수 있으므로 출처·지원 시각·한계를 확인하세요. 촬영범위 중첩만으로 검출을 확정하지 않습니다.',
};
const ja:Copy={
  mobileTitle:'PCでPlanet Xを開いてください',mobileBody:'対話型の宇宙探索はPC向けです。このリリースでは携帯電話とタブレットに対応していません。',recommended:'推奨環境：PCのGoogle Chrome',pcAddress:'PCで次のアドレスを開いてください',copyAddress:'サイトのアドレスをコピー',copied:'アドレスをコピーしました。',copyFailed:'上のアドレスを選択してコピーしてください。',language:'言語',download:'データ仕様書をダウンロード',repository:'公開ソースを見る',guideTitle:'簡単な使い方',openGuide:'使い方',close:'ガイドを閉じる',guideIntro:'実際の天体と明示した仮説を比較し、判断の根拠を保存します。',
  guideSteps:[
    {title:'1. 天体を探して選択',body:'名前で検索するか画面の天体を選ぶとカメラが近づきます。ドラッグで回転、ホイールで拡大縮小、右ドラッグで移動します。太陽系全体表示に戻れます。'},
    {title:'2. 実観測と品質を確認',body:'資料が接続された天体の実観測を開き、A/B露光と品質を確認します。撮影日は原ファイルの時刻です。モデルの日付を変えても新しい写真は生じません。'},
    {title:'3. 仮説標本を選択',body:'第9惑星の文献探索領域には互いに代替的な原標本があります。1つ選ぶと仮説経路を計算します。軌道表示ではパネルだけを折りたたみ、再表示で同じ作業に戻れます。'},
    {title:'4. 既知天体の類似度TOP 5を比較',body:'仮説との長半径・離心率・軌道傾斜角の差で既知天体を並べます。類似度は第9惑星の発見確率や惑星判定ではありません。仮説を変えると順位も変わり得ます。'},
    {title:'5. 根拠を保存・復元',body:'判断を書いて保存し、JSONを書き出します。実観測と第9惑星の仮説は別の記録です。対応するJSONを読み込み、天体・原撮影日時・結果/根拠ID・判断の復元を確認してください。'},
  ],displayNote:'表示距離は圧縮、球体半径は拡大される場合があります。過去・未来の位置は近似の場合があるため、出典・対応時刻・限界を確認してください。撮影範囲の重なりだけでは検出を確定できません。',
};
const zh:Copy={
  mobileTitle:'請在PC上開啟Planet X',mobileBody:'互動宇宙探索僅供PC使用。本版本不支援手機及平板裝置。',recommended:'建議環境：PC上的Google Chrome',pcAddress:'請在PC開啟下列網址',copyAddress:'複製網站網址',copied:'已複製網站網址。',copyFailed:'請選取並複製上方網址。',language:'語言',download:'下載資料規格書',repository:'查看公開原始碼',guideTitle:'簡易使用指南',openGuide:'使用指南',close:'關閉指南',guideIntro:'比較實際天體與明示假說，並儲存支持判斷的證據。',
  guideSteps:[
    {title:'1. 尋找及選取天體',body:'搜尋名稱或選取畫面上的天體，攝影機就會靠近。拖曳旋轉、滾輪縮放、右鍵拖曳平移。可返回太陽系全景。'},
    {title:'2. 檢查實際觀測與品質',body:'對已連結資料的天體開啟實際觀測，選取A/B曝光並檢查品質。拍攝日期來自原始檔案；變更模型日期不會產生新照片。'},
    {title:'3. 選取假說樣本',body:'第九行星文獻搜尋區域內是互為替代的原始樣本。選取一個即可計算假說路徑。查看軌道時僅收合面板，可重新開啟並回到相同工作。'},
    {title:'4. 比較實際天體相似度TOP 5',body:'依已知天體與假說的半長軸、離心率及軌道傾角差異排序。相似度不是第九行星發現機率或行星資格判定。變更假說可能改變排序。'},
    {title:'5. 儲存及還原證據',body:'寫下判斷後儲存並匯出JSON。實際觀測與第九行星假說使用不同記錄。匯入對應JSON後，請確認天體、原拍攝日期、結果/證據ID及判斷已還原。'},
  ],displayNote:'場景距離可能經壓縮，球體半徑可能放大。過去及未來位置可能是近似值，請查看來源、支援時間及限制。拍攝範圍重疊本身不等於檢出。',
};
const fr:Copy={
  mobileTitle:'Ouvrez Planet X sur un ordinateur',mobileBody:'L’exploration interactive est réservée aux PC. Les téléphones et tablettes ne sont pas pris en charge dans cette version.',recommended:'Environnement recommandé : Google Chrome sur PC',pcAddress:'Ouvrez cette adresse sur votre ordinateur',copyAddress:'Copier l’adresse du site',copied:'Adresse du site copiée.',copyFailed:'Sélectionnez puis copiez l’adresse ci-dessus.',language:'Langue',download:'Télécharger la spécification des données',repository:'Voir le dépôt source public',guideTitle:'Guide rapide',openGuide:'Guide rapide',close:'Fermer le guide',guideIntro:'Comparez les objets répertoriés à une hypothèse explicite et conservez les preuves de votre analyse.',
  guideSteps:[
    {title:'1. Rechercher et sélectionner un objet',body:'Recherchez son nom ou sélectionnez-le dans la scène pour déplacer la caméra. Glissez pour tourner, utilisez la molette pour zoomer et glissez avec le bouton droit pour déplacer la vue. Revenez par la vue générale du Système solaire.'},
    {title:'2. Examiner les observations réelles',body:'Pour un objet disposant de données liées, ouvrez les observations, choisissez les poses A/B puis vérifiez leur qualité. Les dates sont celles des fichiers originaux ; changer la date du modèle ne crée pas de nouvelle image.'},
    {title:'3. Choisir un échantillon hypothétique',body:'Les régions de recherche publiées contiennent des échantillons alternatifs. Choisissez-en un pour calculer sa trajectoire hypothétique. La vue de l’orbite replie seulement le panneau ; rouvrez-le pour retrouver le même travail.'},
    {title:'4. Comparer le TOP 5 des objets réels similaires',body:'Les objets connus sont classés par leurs écarts de demi-grand axe, d’excentricité et d’inclinaison avec l’hypothèse. Cette similarité n’est ni une probabilité de découverte de la planète Neuf, ni une décision de classification. Le classement peut changer avec l’hypothèse.'},
    {title:'5. Enregistrer et restaurer les preuves',body:'Rédigez votre analyse, enregistrez-la puis exportez le JSON. Les observations réelles et les hypothèses de la planète Neuf sont des dossiers distincts. Importez le JSON correspondant et vérifiez l’objet, les dates originales, les identifiants de résultat/preuve et votre analyse.'},
  ],displayNote:'Les distances affichées peuvent être comprimées et les rayons des globes agrandis. Les positions passées ou futures peuvent être approximatives : consultez les sources, les dates couvertes et les limites. Une couverture commune ne prouve pas une détection.',
};
export const experienceCopy=(language:string):Copy=>({ko,en,ja,'zh-Hant':zh,fr}[language]??en);
