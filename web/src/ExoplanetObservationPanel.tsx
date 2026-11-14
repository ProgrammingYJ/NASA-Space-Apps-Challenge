import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {request} from './api';
import styles from './ExoplanetObservationPanel.module.css';

interface Observation {
  observation_id:string;object_id:string;planet_name:string;image_url:string;
  kind:'processed_direct_imaging';surface_resolved:false;publication_date:string;
  instruments:string[];wavelengths_um:number[];processing:string[];limitations:string[];
  credit:string;sha256:string;bytes:number;
  source:{url:string;label:string};license:{name:string;url:string};
  additional_sources:{url:string;label:string}[];
}
interface Response {object_filter:string;observations:Observation[];source_manifest_sha256:string}

export default function ExoplanetObservationPanel({objectId}:{objectId:string}){
  const {t}=useTranslation();const [expanded,setExpanded]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);const [attempt,setAttempt]=useState(0);
  const viewer=useRef<HTMLDivElement>(null);const preview=useRef<HTMLButtonElement>(null);
  const result=useQuery({queryKey:['exoplanet-observations',objectId],queryFn:({signal})=>request<Response>(`/catalog/exoplanet-observations?object_id=${encodeURIComponent(objectId)}`,{signal}),retry:false,staleTime:Infinity});
  useEffect(()=>{setExpanded(false);setImageFailed(false);setAttempt(0);},[objectId]);
  useEffect(()=>{if(!expanded)return;const previous=preview.current;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);if(event.key==='Tab'){const controls=viewer.current?.querySelectorAll<HTMLElement>('button,a[href]');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);previous?.focus();};},[expanded]);
  const photo=result.data?.object_filter===objectId?result.data.observations[0]:undefined;
  const failure=<p role="alert">{t('exoObservedError')} <button onClick={()=>{setImageFailed(false);setAttempt(value=>value+1);}}>{t('retry')}</button></p>;
  const image=photo&&<img key={`${photo.observation_id}-${attempt}`} data-testid="exoplanet-observation-image" src={`${photo.image_url}${attempt?`?retry=${attempt}`:''}`} alt={t('exoObservedAlt',{name:photo.planet_name})} onError={()=>setImageFailed(true)}/>;
  const attribution=photo&&<><p className={styles.credit}>{photo.credit}</p><p><a href={photo.source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a> · <a href={photo.license.url} target="_blank" rel="noreferrer">{photo.license.name} ↗</a></p></>;
  return <section className={styles.panel} data-testid="exoplanet-observations" data-object-id={objectId}>
    <h3>{t('exoObservedTitle')}</h3>
    {result.isPending&&<p role="status">{t('loading')}</p>}
    {result.isError&&<p role="alert">{t('exoObservedError')} <button onClick={()=>void result.refetch()}>{t('retry')}</button></p>}
    {result.isSuccess&&!photo&&<p data-testid="exoplanet-observation-empty">{t('exoObservedEmpty')}</p>}
    {photo&&<><p className={styles.notice}>{t('exoObservedNote')}</p>
      {imageFailed?failure:<button ref={preview} className={styles.preview} onClick={()=>setExpanded(true)} aria-label={t('exoObservedExpand')}>{image}</button>}
      {attribution}<p>{t('exoObservedPublished')}: {photo.publication_date} · {photo.instruments.join(' / ')}</p>
      <details><summary>{t('exoObservedProcessing')}</summary><p>{t('exoObservedSourceNotes')}</p>{photo.processing.concat(photo.limitations).map(note=><p key={note} lang="en">{note}</p>)}{photo.additional_sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}<p className={styles.hash}>SHA256 {photo.sha256} · {photo.bytes.toLocaleString()} B</p></details>
      {expanded&&createPortal(<div ref={viewer} className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('exoObservedTitle')} data-testid="exoplanet-observation-viewer"><button autoFocus className={styles.close} onClick={()=>setExpanded(false)}>{t('close')} ×</button>{imageFailed?failure:image}<p>{t('exoObservedNote')}</p>{attribution}</div>,document.body)}
    </>}
  </section>;
}
