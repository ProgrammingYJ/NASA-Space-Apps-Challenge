import {useEffect,useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {creditsCopy} from './CreditsCopy';
import releaseMetadata from './generated/releaseMetadata.json';
import styles from './CreditsDialog.module.css';

const repository='https://github.com/ProgrammingYJ/NASA-Space-Apps-Challenge';
const creators=[
  {id:'science',aliases:['yocot']},
  {id:'testers',aliases:['MaruDev_','도롱뇽','yocot','qltjqdl','U_S','x0o5m2s4']},
  {id:'design',aliases:['x0o5m2s4']},
  {id:'backend',aliases:['MaruDev_']},
  {id:'management',aliases:['도롱뇽','qltjqdl']},
  {id:'leader',aliases:['MaruDev_']},
] as const;
interface ReleaseMetadata{version:string;updated_at:string;data_spec_url:string;data_spec_sha256?:string|null;data_spec_source_sha256?:string|null}
const release:ReleaseMetadata=releaseMetadata;
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():undefined;
const pdfHash=hash(release.data_spec_sha256),sourceHash=hash(release.data_spec_source_sha256);
function updatedAt(language:string){
  const date=new Date(release.updated_at);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(date)+' UTC':release.updated_at;
}
export default function CreditsDialog({open,onClose}:{open:boolean;onClose:()=>void}){
  const {t,i18n}=useTranslation(),copy=creditsCopy(i18n.language);const dialog=useRef<HTMLDialogElement>(null),content=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),previous=useRef<HTMLElement|null>(null);
  useEffect(()=>{const element=dialog.current;if(!element)return;if(open){previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;if(!element.open)element.showModal();if(content.current)content.current.scrollTop=0;closeButton.current?.focus({preventScroll:true});}else if(element.open){element.close();previous.current?.focus();}},[open]);
  return <dialog ref={dialog} data-testid="credits-dialog" className={styles.dialog} aria-labelledby="credits-title" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{if(event.key!=='Tab')return;const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],summary,input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(node=>node.getClientRects().length>0);const first=nodes[0],last=nodes[nodes.length-1];if(!first)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={content} className={styles.content} data-testid="credits-content">
      <header className={styles.header}><div><p className={styles.team} data-testid="credits-team" lang="en">2026 SNHS Alpha</p><h1 id="credits-title" data-testid="credits-title">{copy.title}</h1></div><button ref={closeButton} data-testid="credits-close" onClick={onClose} aria-label={t('close')} autoFocus>×</button></header>
      <section className={styles.section} aria-labelledby="credits-creators-title"><h2 id="credits-creators-title">{copy.creators}</h2><dl className={styles.people} data-testid="credits-creators">{creators.map(row=><div key={row.id} data-testid={'credits-role-'+row.id}><dt>{copy[row.id]}</dt><dd>{row.aliases.map(alias=><span key={alias}>{alias}</span>)}</dd></div>)}</dl></section>
      <section className={styles.section} aria-labelledby="credits-thanks-title"><h2 id="credits-thanks-title">{copy.thanks}</h2><p data-testid="credits-advisor"><span lang="ko">김민세</span> · {copy.advisor}</p><dl className={styles.people}><div><dt>{copy.venue}</dt><dd lang="ko" data-testid="credits-venue">송내고교</dd></div></dl></section>
      <section className={styles.section} aria-labelledby="credits-data-title"><h2 id="credits-data-title">{copy.data}</h2><a className={styles.download} data-testid="credits-data-pdf" href={release.data_spec_url} download="PlanetX_Data_Spec.pdf" data-spec-sha256={pdfHash} data-spec-source-sha256={sourceHash}>{copy.download} ↓</a><a className={styles.download} style={{marginTop:12}} data-testid="credits-license-pdf" href="/downloads/PlanetX_Source_License_Notices.pdf" download="PlanetX_Source_License_Notices.pdf">{copy.licenseDownload} ↓</a><p className={styles.note} data-testid="credits-license-note">{copy.licenseNote}</p><p className={styles.note}>{copy.sourceNote}</p>
        {(pdfHash||sourceHash)&&<details className={styles.hashes} data-testid="credits-data-integrity"><summary>{copy.hashes}</summary>{pdfHash&&<p>{copy.pdfHash}<code data-testid="credits-pdf-sha256">{pdfHash}</code></p>}{sourceHash&&<p>{copy.sourceHash}<code data-testid="credits-data-source-sha256">{sourceHash}</code></p>}</details>}
        <ul className={styles.providers}><li><div><a data-testid="credits-provider-nasa" href="https://science.nasa.gov/" target="_blank" rel="noreferrer">NASA</a> / <a data-testid="credits-provider-jpl" href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">JPL</a></div><p>{copy.nasaRole}</p></li><li><a data-testid="credits-provider-irsa" href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noreferrer">IPAC / IRSA / SPHEREx</a><p>{copy.irsaRole}</p></li><li><a data-testid="credits-provider-noirlab" href="https://noirlab.edu/public/images/geminiann04016a/" target="_blank" rel="noreferrer">NOIRLab</a> / <a data-testid="credits-provider-gemini" href="https://www.gemini.edu/" target="_blank" rel="noreferrer">International Gemini Observatory</a><p>{copy.geminiRole}</p><small>International Gemini Observatory/NOIRLab/NSF/AURA/PHOENIX Image</small></li></ul>
      </section>
      <section className={styles.section} aria-labelledby="credits-software-title"><h2 id="credits-software-title">{copy.software}</h2><p className={styles.note}>{copy.aiNote}</p><ul className={styles.links}><li><a data-testid="credits-notices" href={repository+'/blob/main/THIRD_PARTY_NOTICES.md'} target="_blank" rel="noreferrer">{copy.notices} ↗</a></li><li><a data-testid="credits-ai-usage" href={repository+'/blob/main/docs/ai_usage.md'} target="_blank" rel="noreferrer">{copy.aiRecord} ↗</a></li></ul></section>
      <footer className={styles.footer} data-testid="credits-release" data-release-version={release.version} data-release-updated-at={release.updated_at}><dl className={styles.release}><div><dt>{copy.release}</dt><dd>{release.version}</dd></div><div><dt>{copy.updated}</dt><dd><time dateTime={release.updated_at}>{updatedAt(i18n.language)}</time></dd></div></dl><a className={styles.repository} data-testid="credits-repository" href={repository} target="_blank" rel="noreferrer">{copy.repository} ↗<span>ProgrammingYJ/NASA-Space-Apps-Challenge</span></a></footer>
    </div>
  </dialog>;
}
