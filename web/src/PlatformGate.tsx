import {useEffect,useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {experienceCopy} from './ExperienceCopy';
import {isMobilePlatform} from './platformSupport';
import styles from './PlatformGate.module.css';

const address='https://nasaspaceappschallenge.marulee.dev/';
const locales=[['ko','한국어'],['en','English'],['ja','日本語'],['zh-Hant','繁體中文'],['fr','Français']];
export default function PlatformGate({children}:{children:ReactNode}){
  const {i18n}=useTranslation();const copy=experienceCopy(i18n.language);
  const [blocked]=useState(()=>isMobilePlatform(navigator));
  const [copyStatus,setCopyStatus]=useState<'copied'|'copyFailed'|null>(null);
  useEffect(()=>{if(blocked)document.documentElement.lang=i18n.language;},[blocked,i18n.language]);
  if(!blocked)return children;
  async function copyAddress(){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(address);setCopyStatus('copied');}catch{setCopyStatus('copyFailed');}}
  return <main className={styles.page} data-testid="mobile-platform-gate">
    <section className={styles.card}>
      <header><strong>PLANET X</strong><label>{copy.language}<select data-testid="platform-language" value={i18n.language} onChange={event=>void i18n.changeLanguage(event.target.value)}>{locales.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></header>
      <h1>{copy.mobileTitle}</h1><p>{copy.mobileBody}</p><p className={styles.recommended} data-testid="platform-recommended">{copy.recommended}</p>
      <label>{copy.pcAddress}<code data-testid="platform-address">{address}</code></label>
      <button data-testid="platform-copy-address" onClick={()=>void copyAddress()}>{copy.copyAddress}</button>
      {copyStatus&&<p role="status">{copy[copyStatus]}</p>}
      <nav><a data-testid="platform-data-pdf" href="/downloads/PlanetX_Data_Spec.pdf" download="PlanetX_Data_Spec.pdf">{copy.download}</a><a href="https://github.com/ProgrammingYJ/NASA-Space-Apps-Challenge" target="_blank" rel="noreferrer">{copy.repository} ↗</a></nav>
    </section>
  </main>;
}
