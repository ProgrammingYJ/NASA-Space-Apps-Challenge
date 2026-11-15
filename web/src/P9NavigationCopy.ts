const en={collapse:'Collapse hypothesis panel',reopen:'Reopen hypothesis panel'};
type Copy=typeof en;
const translations:Record<string,Copy>={
  en,
  ko:{collapse:'가설 패널 접기',reopen:'가설 패널 다시 열기'},
  ja:{collapse:'仮説パネルを折りたたむ',reopen:'仮説パネルを再表示'},
  'zh-Hant':{collapse:'收合假設面板',reopen:'重新開啟假設面板'},
  fr:{collapse:'Replier le panneau d’hypothèse',reopen:'Rouvrir le panneau d’hypothèse'},
};
export const p9NavigationCopy=(language:string):Copy=>translations[language]??en;
