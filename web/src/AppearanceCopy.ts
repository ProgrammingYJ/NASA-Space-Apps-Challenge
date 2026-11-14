import type {AppearanceEntry} from './planetAppearance';

const en={
  lighting:'Map lighting',inspection:'Map inspection',solar:'Sun direction',
  inspectionNote:'Neutral display fill helps inspect the published map, including the model night side. This is not measured illumination or a photograph at the model time.',
  solarNote:'Display shading follows the Sun direction. It is not calibrated photometry or a new observation at the model time.',
  rgb:'Published HST OPAL three-filter RGB mosaic. Source contrast enhancement, polar gaps and mosaic seams remain; colored boundaries are not confirmed terrain.',
  monochrome:'Published HST OPAL F467M single-filter atmospheric map. It is monochrome, not a natural-color solid surface. Source gaps and polar seams remain.',
  saturn:'Cassini cloud mosaic from 2011. The original equatorial and polar gaps or ring-obscured areas remain; these are not newly observed dark terrain.',
  pluto:'New Horizons three-filter color mosaic from 2015. Resolution varies, and southern coverage gaps remain. Display lighting does not create new observations.',
  generic:'Published observation map projected on the display globe. Source resolution and coverage remain; this is not a photograph at the model time.',
  unresolved:'No resolved observation map is connected. The display does not create measured surface terrain.',
  lodLoading:'Loading detail; keeping the available map.',lodRetained:'Detail could not load; keeping the previously verified map.',
  sourceMap:'Open published map',
};
const ko:typeof en={
  lighting:'지도 표시 조명',inspection:'지도 보기',solar:'태양 방향',
  inspectionNote:'모형의 밤쪽에서도 공개 지도를 살펴볼 수 있도록 중립 보조광을 사용합니다. 실제 광도나 모형 시각에 촬영한 사진이 아닙니다.',
  solarNote:'태양 방향을 따르는 설명용 음영입니다. 보정된 광도 계산이나 모형 시각의 새 관측이 아닙니다.',
  rgb:'HST OPAL의 공개 3필터 RGB 모자이크입니다. 원본의 대비 강조·극지 결측·접합 흔적을 보존하며, 색이 튀는 경계는 확인된 지형이 아닙니다.',
  monochrome:'HST OPAL F467M 단일 필터 대기 지도입니다. 자연색 고체 표면이 아닌 흑백 자료이며, 원본의 결측·극지 접합 흔적이 남아 있습니다.',
  saturn:'2011년 카시니 구름 모자이크입니다. 원본의 적도·극지 결측과 고리로 가려진 구간을 보존하며, 새로 관측한 검은 지형이 아닙니다.',
  pluto:'2015년 뉴호라이즌스의 3필터 색 모자이크입니다. 위치별 해상도 차이와 남쪽 미관측 영역을 보존합니다. 표시 조명이 새 관측을 만들지는 않습니다.',
  generic:'공개 관측 지도를 모형 구체에 표시합니다. 원본의 해상도·관측 범위를 보존하며, 모형 시각의 새 사진이 아닙니다.',
  unresolved:'연결된 분해 관측 지도가 없습니다. 측정하지 못한 표면 지형을 만들어 채우지 않습니다.',
  lodLoading:'상세 지도 로딩 중 · 현재 지도 유지',lodRetained:'상세 지도 로딩 실패 · 확인된 이전 지도 유지',
  sourceMap:'공개 지도 열기',
};
const ja:typeof en={
  lighting:'地図表示の照明',inspection:'地図を確認',solar:'太陽方向',
  inspectionNote:'模型の夜側でも公開地図を確認できるよう中立的な補助光を使います。実測光度や模型時刻の写真ではありません。',
  solarNote:'太陽方向に従う表示用の陰影です。較正済みの測光や模型時刻の新しい観測ではありません。',
  rgb:'公開HST OPALの3フィルターRGBモザイクです。原資料のコントラスト強調、極域の欠測、接合部を残しています。色の境界は確認済み地形ではありません。',
  monochrome:'公開HST OPAL F467Mの単一フィルター大気地図です。自然色の固体表面ではなく白黒資料で、欠測と極域の接合部が残っています。',
  saturn:'2011年のカッシーニ雲モザイクです。赤道・極域の欠測や環による遮蔽を残しており、新たに観測した暗い地形ではありません。',
  pluto:'2015年のニューホライズンズ3フィルター色モザイクです。場所ごとの解像度差と南側の欠測を残しています。表示照明は新しい観測を作りません。',
  generic:'公開観測地図を表示用の球に投影します。原資料の解像度と観測範囲を保ち、模型時刻の新しい写真ではありません。',
  unresolved:'分解された観測地図は接続されていません。実測した表面地形を生成しません。',
  lodLoading:'詳細を読み込み中・現在の地図を維持',lodRetained:'詳細を読み込めません・確認済みの地図を維持',
  sourceMap:'公開地図を開く',
};
const zh:typeof en={
  lighting:'地圖顯示照明',inspection:'檢視地圖',solar:'太陽方向',
  inspectionNote:'使用中性的顯示補光，讓模型夜側的公開地圖也可檢視。這不是實測亮度或模型時刻拍攝的照片。',
  solarNote:'依太陽方向呈現的說明用陰影，不是經校正的測光或模型時刻的新觀測。',
  rgb:'HST OPAL公開的三濾鏡RGB拼接圖。保留原始對比增強、極區缺測及拼接痕跡；突出的色彩邊界不是已確認的地形。',
  monochrome:'HST OPAL F467M單一濾鏡大氣圖。這是黑白資料，不是自然色固體表面；原始缺測及極區拼接痕跡仍保留。',
  saturn:'2011年卡西尼雲層拼接圖。保留赤道、極區缺測及被環遮蔽的區域，不是新觀測到的黑色地形。',
  pluto:'2015年新視野號三濾鏡彩色拼接圖。保留各地解析度差異及南方缺測。顯示照明不會產生新觀測。',
  generic:'將公開觀測地圖投影於顯示球體，保留原始解析度及觀測範圍；不是模型時刻的新照片。',
  unresolved:'尚未連接可解析的觀測地圖，不會生成實測表面地形。',
  lodLoading:'正在載入細節・保留目前地圖',lodRetained:'無法載入細節・保留已驗證的地圖',
  sourceMap:'開啟公開地圖',
};
const fr:typeof en={
  lighting:'Éclairage de la carte',inspection:'Examiner la carte',solar:'Direction du Soleil',
  inspectionNote:'Un éclairage d’appoint neutre permet d’examiner la carte publiée, même du côté nuit du modèle. Il ne représente ni une luminosité mesurée ni une photo à la date simulée.',
  solarNote:'Cet ombrage explicatif suit la direction du Soleil. Ce n’est ni une photométrie calibrée ni une nouvelle observation à la date simulée.',
  rgb:'Mosaïque RGB publiée par HST OPAL, issue de trois filtres. Le contraste renforcé, les lacunes polaires et les raccords restent visibles ; les frontières colorées ne sont pas des reliefs confirmés.',
  monochrome:'Carte atmosphérique HST OPAL publiée dans le seul filtre F467M. Elle est monochrome, sans surface solide en couleurs naturelles. Les lacunes et raccords polaires sont conservés.',
  saturn:'Mosaïque nuageuse Cassini de 2011. Les lacunes équatoriales, polaires ou masquées par les anneaux sont conservées ; ce ne sont pas de nouveaux terrains sombres observés.',
  pluto:'Mosaïque colorée New Horizons de 2015, issue de trois filtres. La résolution variable et les lacunes australes sont conservées. L’éclairage ne produit aucune nouvelle observation.',
  generic:'Carte d’observation publiée projetée sur le globe d’affichage. La résolution et la couverture originales sont conservées ; ce n’est pas une nouvelle photo à la date simulée.',
  unresolved:'Aucune carte résolue n’est reliée à cet objet. Aucun relief de surface mesuré n’est inventé.',
  lodLoading:'Chargement des détails ; carte actuelle conservée.',lodRetained:'Détails indisponibles ; carte vérifiée précédente conservée.',
  sourceMap:'Ouvrir la carte publiée',
};
export function appearanceCopy(language:string){
  if(language.startsWith('zh-Hant'))return zh;
  return ({en,ko,ja,fr} as Record<string,typeof en>)[language.split('-')[0]]??en;
}
export function appearanceMapNotice(objectId:string,entry:AppearanceEntry|undefined,language:string):string{
  const copy=appearanceCopy(language);
  if(!entry?.texture_url)return copy.unresolved;
  if(objectId==='neptune'||objectId==='uranus')return entry.map_color_type==='published_rgb_composite'?copy.rgb:copy.monochrome;
  if(objectId==='saturn')return copy.saturn;
  if(objectId==='pluto')return copy.pluto;
  return copy.generic;
}
