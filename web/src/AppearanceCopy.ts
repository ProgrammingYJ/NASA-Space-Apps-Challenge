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
  coverage:'Map caution overlay',marked:'Mark zero-channel areas',original:'Published map without overlay',
  markedNote:'Diagonal gray hatching is a display aid for exact zero RGB channels, including black fill, and declared unmapped areas. Zero channels can also be valid data: this is not a scientific quality or missing-data mask. A six-source-pixel display buffer also covers adjacent pixels, which may be valid, to distinguish color seams. It adds no observed terrain; other mosaic artifacts may remain.',
  originalNote:'The published map is shown without the caution overlay. Black fill and bright color seams remain as published; they are not confirmed atmospheric features. The original image is unchanged in both modes.',
  overlayUnavailable:'The caution overlay could not be prepared. The published map remains available; its black fill and color seams are still visible.',
  overlayLoading:'Preparing the display caution overlay.',
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
  coverage:'지도 표시 주의 영역',marked:'0채널 영역 표시',original:'표시 보조 없는 공개 지도',
  markedNote:'회색 사선은 검은 채움을 포함해 RGB 채널값이 정확히 0인 곳과 명시된 지도 밖을 구별하는 표시 보조입니다. 0채널도 유효한 자료일 수 있으며 과학적 품질·미관측 판정 마스크가 아닙니다. 색 접합을 구별하려 원본 6픽셀 주변까지 표시하며 유효한 인접 픽셀도 가릴 수 있습니다. 관측 지형을 만들지 않으며 다른 접합 흔적은 남을 수 있습니다.',
  originalNote:'표시 보조 없이 공개 지도를 보여줍니다. 원본의 검은 채움·강한 색 접합은 남으며 확인된 대기 구조가 아닙니다. 두 모드 모두 원본 이미지는 바꾸지 않습니다.',
  overlayUnavailable:'표시 보조를 준비하지 못했습니다. 공개 지도는 그대로 볼 수 있으며 원본의 검은 채움·색 접합이 보입니다.',
  overlayLoading:'표시 주의 영역을 준비하고 있습니다.',
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
  coverage:'地図の注意表示',marked:'ゼロチャンネル領域を表示',original:'注意表示なしの公開地図',
  markedNote:'灰色の斜線は、黒い塗りを含むRGB値が厳密に0のチャンネルと、明示された地図範囲外を区別する表示補助です。0のチャンネルにも有効なデータが含まれ得ます。色の接合部を区別するため原画像の6ピクセル分を周囲に追加し、有効な隣接ピクセルも覆う場合があります。科学的な品質・欠測判定マスクではなく、観測地形を生成しません。他の接合痕跡は残る場合があります。',
  originalNote:'注意表示なしで公開地図を示します。原資料の黒い塗りや強い色の接合部は、確認済みの大気構造ではありません。どちらのモードも原画像は変更しません。',
  overlayUnavailable:'注意表示を準備できませんでした。公開地図は利用でき、元の黒い塗りや色の接合部も表示されます。',
  overlayLoading:'表示上の注意領域を準備しています。',
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
  coverage:'地圖注意區域顯示',marked:'標示零通道區域',original:'不加標示的公開地圖',
  markedNote:'灰色斜線是顯示輔助，用來區分含黑色填補在內、RGB通道值恰為0的區域，以及已明示的地圖範圍外。零通道也可能是有效資料；這不是科學品質或缺測判定遮罩。為區分彩色接縫，另向周圍擴大原圖6像素，也可能遮住有效的相鄰像素。不會生成觀測地形，其他拼接痕跡可能仍存在。',
  originalNote:'不加注意區域標示，顯示公開地圖。原圖的黑色填補及強烈色彩接縫不是已確認的大氣結構。兩種模式都不更改原始影像。',
  overlayUnavailable:'無法準備注意區域標示。公開地圖仍可檢視，原圖的黑色填補及色彩接縫仍會顯示。',
  overlayLoading:'正在準備顯示注意區域。',
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
  coverage:'Repères de prudence sur la carte',marked:'Signaler les canaux nuls',original:'Carte publiée sans repères',
  markedNote:'Les hachures grises signalent les canaux RGB exactement nuls, dont les plages noires, et les zones explicitement hors carte. Un canal nul peut être valide : ce repère visuel n’est ni un masque scientifique de qualité ni une preuve de données manquantes. Une marge de six pixels de l’image source couvre aussi des pixels voisins éventuellement valides pour distinguer les raccords colorés. Aucun terrain observé n’est créé ; d’autres raccords peuvent rester visibles.',
  originalNote:'La carte publiée est montrée sans repères. Les plages noires et raccords très colorés restent tels que publiés, sans constituer des structures atmosphériques confirmées. L’image originale reste inchangée dans les deux modes.',
  overlayUnavailable:'Les repères n’ont pas pu être préparés. La carte publiée reste accessible, avec ses plages noires et ses raccords colorés.',
  overlayLoading:'Préparation des repères visuels de prudence.',
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
