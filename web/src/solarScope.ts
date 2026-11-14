/** Public product scope; retained legacy data remains available to evidence validation. */
export const SOLAR_SCOPE_FEATURES = Object.freeze({
  galaxies: false, galaxyAtlas: false, exoplanets: false, universeCatalog: false,
  cosmicHistory: false, blackHoles: false, observerPhysics: false, physicsLab: false,
});
export const EXPLORATION_RADIUS_AU = 1000;
export function isSolarScopeSelection(id:string, solarObjectIds:Iterable<string>):boolean {
  return new Set(solarObjectIds).has(id);
}
export function scopeCopy(locale:string) {
  const all = {
    ko: {title:'태양계 1000 AU', headline:'태양계 외곽을 탐색하세요', note:'관측된 천체와 제9행성 가설을 비교합니다. 1000 AU는 탐색 기준이며 물리적 벽이 아닙니다. 미발견 천체의 전수 복원을 뜻하지 않습니다.', actual:'실제 관측', hypothesis:'제9행성 가설', evidence:'비교·근거', boundary:'1000 AU 기준선', guide:'거리 압축 · 실제 천체력과 가설 경로 구분', validation:'공식 대상 검증', validationNote:'실제 원본·카탈로그 위치 예측·품질·저장/복원 사례입니다. 영상에서 측정한 이동 검출은 아닙니다.', comets:'역사 속 혜성', open:'가설과 관측 범위 비교'},
    en: {title:'Solar System · 1000 AU', headline:'Explore the outer Solar System', note:'Compare observed objects with a Planet Nine hypothesis. 1000 AU is an exploration reference, not a physical wall or a complete inventory of unknown objects.', actual:'Actual observations', hypothesis:'Planet Nine hypothesis', evidence:'Compare & evidence', boundary:'1000 AU reference', guide:'Compressed distance · ephemerides and hypotheses distinguished', validation:'Official target validation', validationNote:'Validates original images, catalog position predictions, quality and evidence restoration. It does not measure motion in the images.', comets:'Historical comets', open:'Compare a hypothesis with coverage'},
    ja: {title:'太陽系 · 1000 AU', headline:'太陽系の外縁を探索', note:'観測天体と第9惑星の仮説を比較します。1000 AUは探索の目安で、物理的な壁や未知天体の完全な一覧ではありません。', actual:'実際の観測', hypothesis:'第9惑星の仮説', evidence:'比較・根拠', boundary:'1000 AUの基準線', guide:'距離圧縮 · 天体暦と仮説の軌道を区別', validation:'公式対象の検証', validationNote:'元画像・カタログ位置予測・品質・根拠の復元を検証します。画像からの移動検出ではありません。', comets:'歴史上の彗星', open:'仮説と観測範囲を比較'},
    'zh-Hant': {title:'太陽系 · 1000 AU', headline:'探索太陽系外緣', note:'比較觀測天體與第九行星假說。1000 AU是探索參考，並非物理邊界，也不代表未知天體的完整清單。', actual:'實際觀測', hypothesis:'第九行星假說', evidence:'比較與證據', boundary:'1000 AU參考線', guide:'距離壓縮 · 區分星曆與假說軌跡', validation:'官方目標驗證', validationNote:'驗證原始影像、星表位置預測、品質與證據還原，並非從影像量測運動。', comets:'歷史彗星', open:'比較假說與觀測涵蓋範圍'},
    fr: {title:'Système solaire · 1000 UA', headline:'Explorez le Système solaire externe', note:'Comparez les objets observés à une hypothèse de neuvième planète. 1000 UA est un repère, sans paroi physique ni inventaire complet des objets inconnus.', actual:'Observations réelles', hypothesis:'Hypothèse de planète 9', evidence:'Comparaison et preuves', boundary:'Repère de 1000 UA', guide:'Distances comprimées · éphémérides et hypothèses distinctes', validation:'Validation des cibles officielles', validationNote:'Vérifie les images originales, les positions prédites du catalogue, la qualité et la restauration des preuves. Aucun mouvement n’est mesuré dans les images.', comets:'Comètes historiques', open:'Comparer hypothèse et couverture'},
  };
  return all[locale as keyof typeof all]??all.en;
}
