const en={
  intro:'Choose a published search region, try a source sample, then compare its calculated orbit with known objects.',
  workflow:'Hypothesis exploration steps',regionStep:'Choose a region',sampleStep:'Apply a sample',compareStep:'Inspect the path and comparisons',
  condition:'These locations are conditional on Planet Nine existing and the adopted literature model being correct. They are not discovery or existence probabilities.',
  epochNote:'Source coordinates: 2018. The distribution is not propagated to the date shown in the Solar System scene.',
  densityShort:'sr⁻¹ describes sky-position density, not material density.',
  details:'Method, limitations and sources',cell:'Cell',sourceEpoch:'Source epoch',coordinates:'RA / Dec',probability:'Cell n/N',density:'Sky density',
  memberHelp:'Select one alternative literature sample to apply its source inputs and start calculating the hypothetical path automatically.',
  applyingRow:'Applying source row',applied:'The source inputs were applied and the hypothetical path calculation started. This is not a detected planet.',
  activeHypothesis:'Current hypothesis',sourceRow:'Original source row',manualHypothesis:'Edited hypothesis inputs',
  noRegions:'No nonempty cells match these source conditions.',chooseHint:'Open the region to choose a source sample.',headerDetails:'About this workflow',selected:'Selected',
};
type Copy=typeof en;
const ko:Copy={
  intro:'문헌 탐색 영역에서 원표본을 골라 가설 궤도를 계산하고, 알려진 실제 천체와 비교하세요.',
  workflow:'가설 탐색 단계',regionStep:'영역 선택',sampleStep:'표본 적용',compareStep:'경로·대조 확인',
  condition:'제9행성이 존재하고 채택한 문헌 모형이 맞다는 조건의 위치 분포입니다. 발견·존재 확률이 아닙니다.',
  epochNote:'2018년 원자료 좌표입니다. 태양계 화면의 현재 모형 날짜로 전파한 분포가 아닙니다.',
  densityShort:'sr⁻¹은 하늘 위치 밀도이며 물질 밀도가 아닙니다.',
  details:'방법·한계·출처',cell:'셀',sourceEpoch:'원자료 기준시각',coordinates:'RA / Dec',probability:'셀의 n/N',density:'하늘 위치 밀도',
  memberHelp:'서로 대안인 문헌 표본 하나를 선택하면 원자료의 입력값을 적용하고 가설 경로 계산을 자동으로 시작합니다.',
  applyingRow:'원표본 행 적용 중',applied:'원표본 입력을 적용하고 가설 경로 계산을 시작했습니다. 발견된 행성을 뜻하지 않습니다.',
  activeHypothesis:'현재 가설',sourceRow:'원자료 표본 행',manualHypothesis:'수정한 가설 입력',
  noRegions:'이 원자료 조건에 맞는 비어 있지 않은 셀이 없습니다.',chooseHint:'영역을 열어 원표본을 선택하세요.',headerDetails:'이 흐름의 설명',selected:'선택됨',
};
const ja:Copy={
  intro:'文献の探索領域から元標本を選び、仮説軌道を計算して既知の実天体と比較します。',
  workflow:'仮説探索の手順',regionStep:'領域を選択',sampleStep:'標本を適用',compareStep:'経路と比較を確認',
  condition:'第9惑星が存在し、採用した文献モデルが正しいという条件付き位置分布です。発見・存在確率ではありません。',
  epochNote:'2018年の原資料座標です。太陽系画面の現在のモデル日時へ伝播した分布ではありません。',
  densityShort:'sr⁻¹は天空位置密度であり、物質密度ではありません。',
  details:'方法・限界・出典',cell:'セル',sourceEpoch:'原資料の基準時刻',coordinates:'RA / Dec',probability:'セルのn/N',density:'天空位置密度',
  memberHelp:'互いに代替の文献標本を1つ選ぶと、元の入力値を適用し、仮説経路の計算を自動で開始します。',
  applyingRow:'元標本行を適用中',applied:'元標本の入力を適用し、仮説経路の計算を開始しました。検出された惑星ではありません。',
  activeHypothesis:'現在の仮説',sourceRow:'原資料の標本行',manualHypothesis:'編集した仮説入力',
  noRegions:'この原資料条件に一致する空でないセルはありません。',chooseHint:'領域を開いて元標本を選んでください。',headerDetails:'この手順について',selected:'選択中',
};
const zh:Copy={
  intro:'從文獻搜尋區域選取原始樣本，計算假說軌道，再與已知實際天體比較。',
  workflow:'假說探索步驟',regionStep:'選擇區域',sampleStep:'套用樣本',compareStep:'檢視路徑與比較',
  condition:'這是第九行星存在且採用文獻模型正確的條件式位置分布，不是發現或存在機率。',
  epochNote:'使用2018年的原始座標，並未傳播至太陽系畫面目前的模型日期。',
  densityShort:'sr⁻¹表示天空位置密度，不是物質密度。',
  details:'方法、限制與來源',cell:'網格',sourceEpoch:'來源基準時刻',coordinates:'RA / Dec',probability:'網格n/N',density:'天空位置密度',
  memberHelp:'選擇一個互為替代的文獻樣本，即可套用原始輸入值，並自動開始計算假說路徑。',
  applyingRow:'正在套用原始樣本列',applied:'已套用原始輸入並開始計算假說路徑，並不代表已偵測到行星。',
  activeHypothesis:'目前假說',sourceRow:'原始來源樣本列',manualHypothesis:'已編輯的假說輸入',
  noRegions:'沒有符合這些來源條件的非空網格。',chooseHint:'開啟區域以選擇原始樣本。',headerDetails:'關於此流程',selected:'已選取',
};
const fr:Copy={
  intro:'Choisissez une région publiée et un échantillon source, puis comparez son orbite calculée aux objets connus.',
  workflow:'Étapes de l’exploration d’une hypothèse',regionStep:'Choisir une région',sampleStep:'Appliquer un échantillon',compareStep:'Examiner la trajectoire et les comparaisons',
  condition:'Ces positions sont conditionnelles à l’existence de la planète Neuf et à la validité du modèle publié adopté. Ce ne sont pas des probabilités de découverte ou d’existence.',
  epochNote:'Coordonnées sources de 2018, sans propagation à la date du modèle affichée dans la scène du Système solaire.',
  densityShort:'sr⁻¹ désigne une densité de position céleste, pas une densité de matière.',
  details:'Méthode, limites et sources',cell:'Cellule',sourceEpoch:'Époque source',coordinates:'RA / Dec',probability:'n/N de cellule',density:'Densité céleste',
  memberHelp:'Choisissez un échantillon publié parmi les alternatives pour appliquer ses paramètres sources et lancer automatiquement le calcul de la trajectoire hypothétique.',
  applyingRow:'Application de la ligne source',applied:'Les paramètres sources sont appliqués et le calcul de la trajectoire hypothétique a commencé. Il ne s’agit pas d’une planète détectée.',
  activeHypothesis:'Hypothèse actuelle',sourceRow:'Ligne de l’échantillon source',manualHypothesis:'Paramètres hypothétiques modifiés',
  noRegions:'Aucune cellule non vide ne correspond à ces conditions sources.',chooseHint:'Ouvrez la région pour choisir un échantillon source.',headerDetails:'À propos de ce parcours',selected:'Sélectionnée',
};
export function p9StepCopy(language:string):Copy{
  if(language.startsWith('zh-Hant'))return zh;
  return ({en,ko,ja,fr} as Record<string,Copy>)[language.split('-')[0]]??en;
}
