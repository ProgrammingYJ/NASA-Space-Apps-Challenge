import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {epsilonBDetailCopy} from './EpsilonBDetailCopy';
import styles from './EpsilonBDetail.module.css';

/** Verified original asset metadata; photoUrl is supplied by the integration. */
export const EPSILON_B_PHOTO={
  originalUrl:'https://storage.noirlab.edu/media/archives/images/large/geminiann04016a.jpg',
  recordUrl:'https://noirlab.edu/public/images/geminiann04016a/',
  sha256:'9398a48e727675900f2776522941cd81e2e3b45ec17c2ed32d59f90dfaccf722',
  bytes:84074,width:447,height:446,date:'2003-08-18',
  credit:'International Gemini Observatory/NOIRLab/NSF/AURA/PHOENIX Image',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
} as const;
const PAPER_URL='https://doi.org/10.3847/1538-3881/ac66d2';

export interface EpsilonBDetailProps {
  language:string;
  onClose:()=>void;
  onObservations:()=>void;
  /** Serve the unchanged 84,074-byte original JPEG from a verified static asset. */
  photoUrl:string;
}

/** Separate detail UI only: no global scene, camera, timeline or evidence mutation. */
export default function EpsilonBDetail({language,onClose,onObservations,photoUrl}:EpsilonBDetailProps){
  const c=epsilonBDetailCopy(language),uid=useId().replace(/:/g,''),dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  const photoImage=useRef<HTMLImageElement>(null);
  const tabs=useRef<Array<HTMLButtonElement|null>>([]),[mode,setMode]=useState<'photo'|'model'>('photo'),[imageState,setImageState]=useState<'loading'|'ready'|'error'>('loading');
  const number=(value:number,digits=7)=>value.toLocaleString(language,{maximumSignificantDigits:digits});
  useEffect(()=>{const image=photoImage.current;setImageState(image?.complete?(image.naturalWidth>0?'ready':'error'):'loading');},[photoUrl]);
  useEffect(()=>{
    const element=dialog.current,previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(!element)return;
    element.showModal();closeButton.current?.focus({preventScroll:true});
    return()=>{if(element.open)element.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  function tabKeys(event:KeyboardEvent<HTMLDivElement>){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?'photo':event.key==='End'?'model':mode==='photo'?'model':'photo';
    setMode(next);tabs.current[next==='photo'?0:1]?.focus();
  }
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-intro`} onCancel={event=>{event.preventDefault();onClose();}} data-testid="epsilon-b-dialog">
    <section data-testid="epsilon-b-detail" data-object-id="epsilon-indi-b" data-scope="outside-1000-au" data-photo-source-sha256={EPSILON_B_PHOTO.sha256} className={styles.detail}>
      <header className={styles.header}><div><small>{c.kind}</small><h2 id={`${uid}-title`}>{c.title}</h2></div><button ref={closeButton} type="button" className={styles.close} onClick={onClose} aria-label={c.close}>×</button></header>
      <p id={`${uid}-intro`} className={styles.intro}>{c.intro}</p>
      <div className={styles.layout}>
        <div className={styles.visual}>
          <div role="tablist" aria-label={c.title} className={styles.tabs} onKeyDown={tabKeys}>
            <button ref={node=>{tabs.current[0]=node;}} id={`${uid}-photo-tab`} role="tab" type="button" aria-selected={mode==='photo'} aria-controls={`${uid}-photo`} tabIndex={mode==='photo'?0:-1} onClick={()=>setMode('photo')} data-testid="epsilon-b-photo-tab">{c.photoTab}</button>
            <button ref={node=>{tabs.current[1]=node;}} id={`${uid}-model-tab`} role="tab" type="button" aria-selected={mode==='model'} aria-controls={`${uid}-model`} tabIndex={mode==='model'?0:-1} onClick={()=>setMode('model')} data-testid="epsilon-b-model-tab">{c.modelTab}</button>
          </div>
          <div role="tabpanel" id={`${uid}-photo`} aria-labelledby={`${uid}-photo-tab`} hidden={mode!=='photo'} tabIndex={0}>
            <figure className={styles.photo} data-testid="epsilon-b-photo" data-image-state={imageState}>
              {imageState==='loading'&&<p role="status">{c.photoLoading}</p>}
              {imageState==='error'&&<p role="alert">{c.photoError}</p>}
              <img ref={photoImage} key={photoUrl} src={photoUrl} alt={c.photoAlt} width={EPSILON_B_PHOTO.width} height={EPSILON_B_PHOTO.height} decoding="async" hidden={imageState==='error'} onLoad={()=>setImageState('ready')} onError={()=>setImageState('error')}/>
              <figcaption><strong>{c.date}: <time dateTime={EPSILON_B_PHOTO.date}>{EPSILON_B_PHOTO.date}</time></strong><span>Gemini South · PHOENIX · {c.band}</span><span>{c.field}</span><p>{c.photoNotice}</p></figcaption>
            </figure>
          </div>
          <div role="tabpanel" id={`${uid}-model`} aria-labelledby={`${uid}-model-tab`} hidden={mode!=='model'} tabIndex={0}>
            <figure className={styles.model} data-testid="epsilon-b-model" data-position-kind="illustrative_unphased" data-tied-to-date="false">
              <svg viewBox="0 0 520 240" role="img" aria-labelledby={`${uid}-model-title ${uid}-model-desc`}>
                <title id={`${uid}-model-title`}>{c.modelAlt}</title><desc id={`${uid}-model-desc`}>{c.modelNotice}</desc>
                <defs><radialGradient id={`${uid}-sphere`} cx="30%" cy="25%" r="75%"><stop offset="0" stopColor="#b9987c"/><stop offset=".45" stopColor="#685448"/><stop offset="1" stopColor="#141925"/></radialGradient></defs>
                <circle cx="135" cy="110" r="64" fill={`url(#${uid}-sphere)`} data-testid="epsilon-b-model-ba" data-display-radius="64"/>
                <circle cx="385" cy="110" r="64" fill={`url(#${uid}-sphere)`} data-testid="epsilon-b-model-bb" data-display-radius="64"/>
                <text x="135" y="205" textAnchor="middle">Ba</text><text x="385" y="205" textAnchor="middle">Bb</text>
              </svg>
              <figcaption><p className={styles.notice}>{c.modelNotice}</p><p>{c.surfaceNote}</p></figcaption>
            </figure>
          </div>
          <p className={styles.credit} data-testid="epsilon-b-photo-credit">{c.credit}: <a href={EPSILON_B_PHOTO.originalUrl} target="_blank" rel="noreferrer">{EPSILON_B_PHOTO.credit}</a><br/><a href={EPSILON_B_PHOTO.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a> · <a href={EPSILON_B_PHOTO.originalUrl} target="_blank" rel="noreferrer">{c.original} ↗</a></p>
        </div>
        <div className={styles.facts}>
          <section className={styles.card} aria-labelledby={`${uid}-facts`}><h3 id={`${uid}-facts`}>{c.facts}</h3><table className={styles.values}><thead><tr><th scope="col" aria-label={c.facts}/><th scope="col">Ba</th><th scope="col">Bb</th></tr></thead><tbody>
            <tr><th scope="row">{c.mass}<small>{c.massUnit}</small></th><td data-testid="epsilon-b-mass-ba">{number(66.92)} ± {number(.36)} M♃</td><td data-testid="epsilon-b-mass-bb">{number(53.25)} ± {number(.29)} M♃</td></tr>
            <tr><th scope="row">{c.temperature}</th><td>{number(1312)} ± {number(13)} K</td><td>{number(972)} ± {number(13)} K</td></tr>
          </tbody></table><p>{c.dynamicalNote}</p><p className={styles.notice}>{c.temperatureNote}</p></section>
          <section className={styles.card}><h3>{c.orbit}</h3><dl className={styles.orbit}><div><dt>{c.semimajor}</dt><dd>{number(2.4058)} ± {number(.004)} au</dd></div><div><dt>{c.eccentricity}</dt><dd>{number(.54042)} ± {number(.00063)}</dd></div><div><dt>{c.period}</dt><dd>{number(11.0197)} ± {number(.0076)} {c.years}</dd></div></dl><p>{c.phaseNote}</p></section>
          <section className={styles.card}><h3>{c.distance}</h3><strong className={styles.distance}>≈ {number(750081)} au</strong><p>{c.distanceNote}</p></section>
        </div>
      </div>
      <details className={styles.sources}><summary>{c.sources}</summary><ul><li><a href={PAPER_URL} target="_blank" rel="noreferrer">{c.paper} ↗</a></li><li><a href={EPSILON_B_PHOTO.recordUrl} target="_blank" rel="noreferrer">{c.imagePage} ↗</a></li></ul><p>{c.sourceBytes}: {number(EPSILON_B_PHOTO.bytes)} {c.bytes} · 447 × 446 px</p><p>{c.sourceHash}: <code>{EPSILON_B_PHOTO.sha256}</code></p></details>
      <footer className={styles.footer}><button type="button" onClick={onClose}>{c.close}</button><button type="button" className={styles.primary} onClick={onObservations} data-testid="epsilon-b-open-observations">{c.observations} ↗</button></footer>
    </section>
  </dialog>,document.body);
}
