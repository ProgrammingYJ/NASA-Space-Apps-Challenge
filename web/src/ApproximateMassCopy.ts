const en={
  title:'Approximate current mass · project assumptions',details:'Mass inputs and assumptions',measured:'Adopted measured primary mass',custom:'Your explicit density hypothesis',estimate:'Automatic assumption estimate',unavailable:'Mass estimate unavailable',
  no_size_or_h:'No finite positive physical size or usable absolute magnitude H is available.',stale_object:'The returned object does not match the selected object; its inputs were not used.',nonfinite_result:'The supplied inputs do not yield a finite positive mass; no zero mass is substituted.',
  density:'Project density assumption',diameter:'Equivalent spherical diameter',physical_radius:'Diameter from the sourced physical radius',catalogue_diameter:'Adopted catalogue diameter',h_albedo:'Diameter estimated from H and albedo',H:'Catalogue absolute magnitude H',albedo:'Visual geometric albedo pV',catalogue:'Catalogue input',project_default:'Explicit project default',source:'Input source',formula:'Size relation · NASA/JPL CNEOS',
  note:'This estimate is not a mass measurement. Density 1000 kg/m³ is a project assumption, not a validated density of this object or a copied moon measurement. The spherical model does not establish shape, identity or planet status; the original mass and three criteria remain unchanged.',
  band:'The H input is treated as V-equivalent for this calculation. Its band and calibration have not been independently verified here; albedo 0.1 is a project assumption when no positive source value is supplied.',
  uncertainty:'No confidence interval or propagated error is available. Unknown albedo, density, shape and H calibration can substantially change the estimate.',conversion:'Mass convention',minimum:'Minimum reference mass',current:'Current mass',
};
type Copy=typeof en;
const ko:Copy={
  title:'현재 질량 어림값 · 프로젝트 가정',details:'질량 입력과 가정',measured:'채택한 본체 측정 질량',custom:'명시적으로 선택한 밀도 가정',estimate:'자동 가정 추정',unavailable:'질량 어림값 산출 불가',
  no_size_or_h:'유한한 양의 실제 크기나 사용 가능한 절대등급 H가 없습니다.',stale_object:'응답 천체가 현재 선택과 달라 그 입력을 사용하지 않았습니다.',nonfinite_result:'입력으로 유한한 양의 질량을 계산할 수 없습니다. 질량 0으로 대체하지 않습니다.',
  density:'프로젝트 밀도 가정',diameter:'구형 등가 직경',physical_radius:'출처의 실제 반지름에서 구한 직경',catalogue_diameter:'채택한 카탈로그 직경',h_albedo:'H와 반사율로 추정한 직경',H:'카탈로그 절대등급 H',albedo:'가시광 기하 반사율 pV',catalogue:'카탈로그 입력',project_default:'명시적 프로젝트 기본 가정',source:'입력 출처',formula:'크기 관계식 · NASA/JPL CNEOS',
  note:'측정 질량이 아닌 추정입니다. 밀도 1000 kg/m³는 프로젝트 가정이며 이 천체에서 검증된 밀도나 특정 위성의 측정값이 아닙니다. 구형 모형은 형태·동일 천체 여부·행성 지위를 확정하지 않으며 원 질량과 행성 3요건 판정을 바꾸지 않습니다.',
  band:'이 계산에서는 H를 V 대역 등가값으로 가정합니다. 대역·보정은 여기서 독립 검증하지 않았으며 양의 출처 반사율이 없으면 0.1을 프로젝트 가정으로 사용합니다.',
  uncertainty:'신뢰구간이나 전파 오차는 없습니다. 미확보 반사율·밀도·형태와 H 보정에 따라 추정값이 크게 달라질 수 있습니다.',conversion:'질량 환산 기준',minimum:'참고 최소 질량',current:'현재 질량',
};
const ja:Copy={
  title:'現在質量の概算・プロジェクト仮定',details:'質量の入力と仮定',measured:'採用した本体の測定質量',custom:'明示的に選択した密度仮説',estimate:'自動の仮定に基づく推定',unavailable:'質量を概算できません',
  no_size_or_h:'有限で正の物理サイズ、または利用可能な絶対等級Hがありません。',stale_object:'応答天体が選択と異なるため、その入力を使用していません。',nonfinite_result:'入力から有限で正の質量を計算できません。質量0で置き換えません。',
  density:'プロジェクトの密度仮定',diameter:'等価球の直径',physical_radius:'出典の物理半径から求めた直径',catalogue_diameter:'採用したカタログ直径',h_albedo:'Hとアルベドによる推定直径',H:'カタログ絶対等級H',albedo:'可視幾何アルベドpV',catalogue:'カタログの入力',project_default:'明示的なプロジェクト既定仮定',source:'入力の出典',formula:'サイズの関係式・NASA/JPL CNEOS',
  note:'質量測定ではなく推定です。密度1000 kg/m³はプロジェクトの仮定であり、この天体で検証された密度や特定衛星の測定値ではありません。球形モデルは形状・天体の同一性・惑星の地位を確定せず、元の質量と3要件の判定を変更しません。',
  band:'この計算ではHをVバンド相当と仮定します。バンドと較正はここでは独立検証していません。出典に正のアルベドがない場合は0.1をプロジェクト仮定として用います。',
  uncertainty:'信頼区間や伝播誤差はありません。不明なアルベド・密度・形状とHの較正により推定は大きく変わり得ます。',conversion:'質量換算の規約',minimum:'参考最小質量',current:'現在質量',
};
const zh:Copy={
  title:'目前質量概估・專案假設',details:'質量輸入與假設',measured:'採用的本體實測質量',custom:'明確選用的密度假說',estimate:'自動假設估計',unavailable:'無法估計質量',
  no_size_or_h:'沒有有限的正值實體尺寸或可用的絕對星等H。',stale_object:'回應天體與目前選擇不符，因此未使用其輸入。',nonfinite_result:'輸入無法得到有限的正值質量，不會以質量0取代。',
  density:'專案密度假設',diameter:'等效球體直徑',physical_radius:'由來源實體半徑換算的直徑',catalogue_diameter:'採用的目錄直徑',h_albedo:'由H與反照率估計的直徑',H:'目錄絕對星等H',albedo:'可見光幾何反照率pV',catalogue:'目錄輸入',project_default:'明示的專案預設假設',source:'輸入來源',formula:'尺寸關係式・NASA/JPL CNEOS',
  note:'這是估計，不是質量測量。密度1000 kg/m³是專案假設，並非此天體經驗證的密度或特定衛星的測量值。球體模型不會確認形狀、天體身分或行星地位，原質量與三項條件判定維持不變。',
  band:'本計算將H視為V波段等效值，尚未獨立驗證其波段與校正。若來源沒有正值反照率，則以0.1作為專案假設。',
  uncertainty:'沒有信賴區間或傳播誤差。未知反照率、密度、形狀與H校正可能使估值大幅改變。',conversion:'質量換算慣例',minimum:'參考最低質量',current:'目前質量',
};
const fr:Copy={
  title:'Masse actuelle approximative · hypothèses du projet',details:'Entrées et hypothèses de masse',measured:'Masse mesurée du corps principal adoptée',custom:'Votre hypothèse explicite de densité',estimate:'Estimation automatique sous hypothèses',unavailable:'Estimation de masse indisponible',
  no_size_or_h:'Aucune taille physique finie positive ni magnitude absolue H exploitable n’est disponible.',stale_object:'L’objet reçu ne correspond pas à la sélection ; ses entrées n’ont pas été utilisées.',nonfinite_result:'Les entrées ne donnent pas de masse finie positive. Aucune masse nulle ne remplace la valeur absente.',
  density:'Densité supposée par le projet',diameter:'Diamètre sphérique équivalent',physical_radius:'Diamètre issu du rayon physique sourcé',catalogue_diameter:'Diamètre adopté du catalogue',h_albedo:'Diamètre estimé par H et l’albédo',H:'Magnitude absolue H du catalogue',albedo:'Albédo géométrique visuel pV',catalogue:'Entrée du catalogue',project_default:'Hypothèse explicite par défaut du projet',source:'Source des entrées',formula:'Relation de taille · NASA/JPL CNEOS',
  note:'Il s’agit d’une estimation, pas d’une mesure de masse. La densité 1000 kg/m³ est une hypothèse du projet, ni une densité validée de cet objet ni une mesure copiée d’une lune. Le modèle sphérique n’établit ni forme, identité ni statut planétaire ; la masse source et les trois critères restent inchangés.',
  band:'H est supposé équivalent à la bande V dans ce calcul. Sa bande et son étalonnage ne sont pas vérifiés indépendamment ici. Sans albédo source positif, 0,1 est une hypothèse du projet.',
  uncertainty:'Aucun intervalle de confiance ni erreur propagée n’est disponible. Les inconnues d’albédo, densité, forme et étalonnage de H peuvent fortement modifier cette estimation.',conversion:'Convention de conversion de masse',minimum:'Masse minimale de référence',current:'Masse actuelle',
};
export function approximateMassCopy(language:string):Copy{
  if(language.startsWith('zh-Hant'))return zh;
  return ({en,ko,ja,fr} as Record<string,Copy>)[language.split('-')[0]]??en;
}
