import {useCallback,useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {OBSERVATION_SLIDE_INTERVALS,publishedObservationAge,type CosmicObservationCatalog,type CosmicObservationCase,type ObservationSlideInterval} from './cosmicObservations';
import styles from './CosmicObservationViewer.module.css';

export interface CosmicObservationViewerProps {
  visible:boolean;catalog:CosmicObservationCatalog|undefined;loading:boolean;error:boolean;pauseSequence:number;
  onRetry:()=>void;onExit:()=>void;
}
const COPY={
  cosmicObsTitle:'Observed early universe',
  cosmicObsIntro:'Published observation images and their cited approximate ages. No reconstructed 3D scene or inferred intermediate frames.',
  cosmicObsCases:'Observation cases',cosmicObsCounter:'Case {{index}} of {{total}}',
  cosmicObsApproxAge:'Approximate cosmic age',cosmicObsAgeRange:'Published sample age range',cosmicObsAgeUnknown:'No single published age',
  cosmicObsAgeNote:'Ages are published source estimates for the named target or sample, not every foreground/background object, and are separate from image acquisition dates.',
  cosmicObsPublished:'Published processed observation',cosmicObsInstrument:'Instrument',cosmicObsCredit:'Credit',cosmicObsLicense:'Image license',
  cosmicObsImageSource:'Published image page',cosmicObsOriginal:'Original image file',cosmicObsImageAlt:'Published observation of {{name}}',
  cosmicObsImageError:'The published image could not be loaded.',cosmicObsError:'Observation cases could not be loaded.',cosmicObsDetails:'Image processing and source limits',
  cosmicObsOrder:'Observation case order',cosmicObsInterval:'Slide interval',cosmicObsIntervalOption:'{{seconds}} seconds per image',
  cosmicObsSlideNote:'Play advances observation cases only. It does not show physical evolution.',cosmicObsEnd:'Last observation case. Play restarts from the first.',
};
const NOTES:Record<string,string>={
  cosmic_gems_clusters:'Strong gravitational lensing reveals compact star clusters. The enlarged region contains distinct lensed galaxies; these are not a measured 3D outline or one galaxy repeated.',
  firefly_sparkle_assembly:'Lensing magnifies clumps of star formation and nearby companions. Their future merger path or final shape is not measured by this image.',
  ceers_projected_shapes:'These cutouts show different observed galaxies from a sample spanning approximately 0.6–6 Gyr after the Big Bang. They are not frames of one galaxy evolving.',
  rebels25_rotating_disc:'ALMA observations show gas emission and velocity-map colors. This is not an optical photograph of a resolved galaxy surface.',
  zs7_ongoing_merger:'The observations support an ongoing galaxy merger. They are not a recording of a future black-hole coalescence.',
};

export default function CosmicObservationViewer(props:CosmicObservationViewerProps){
  const {t,i18n}=useTranslation();const copy=(key:keyof typeof COPY,values:Record<string,string|number>={})=>t(key,{defaultValue:COPY[key],...values});
  const objects=props.catalog?.objects??[];
  const [selectedId,setSelectedId]=useState<string|null>(null),[playing,setPlaying]=useState(false),[interval,setInterval]=useState<ObservationSlideInterval>(5);
  const [loadedKey,setLoadedKey]=useState<string|null>(null),[failedKey,setFailedKey]=useState<string|null>(null),[imageAttempt,setImageAttempt]=useState(0);
  const tabs=useRef<(HTMLButtonElement|null)[]>([]);const playRef=useRef(false);
  const currentIndex=Math.max(0,objects.findIndex(value=>value.id===selectedId)),current=objects[currentIndex];
  const imageKey=current?`${current.id}:${current.image.sha256}:${current.image.url}:${imageAttempt}`:'';
  const latest=useRef({visible:props.visible,pauseSequence:props.pauseSequence,imageKey,index:currentIndex,catalog:props.catalog?.source_manifest_sha256});latest.current={visible:props.visible,pauseSequence:props.pauseSequence,imageKey,index:currentIndex,catalog:props.catalog?.source_manifest_sha256};
  const pause=useCallback(()=>{playRef.current=false;setPlaying(false);},[]);
  useEffect(()=>{pause();},[props.visible,props.pauseSequence,props.catalog?.source_manifest_sha256,pause]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[pause]);
  const imageReady=Boolean(current&&loadedKey===imageKey),imageFailed=Boolean(current&&failedKey===imageKey);
  useEffect(()=>{
    if(!playing||!props.visible||!imageReady||!current||objects.length<2)return;
    const captured={...latest.current};const timer=window.setTimeout(()=>{
      if(!playRef.current||!latest.current.visible||document.hidden||latest.current.pauseSequence!==captured.pauseSequence||latest.current.imageKey!==captured.imageKey||latest.current.catalog!==captured.catalog)return;
      const next=currentIndex+1;if(next>=objects.length){pause();return;}setSelectedId(objects[next].id);if(next===objects.length-1)pause();
    },interval*1000);return()=>window.clearTimeout(timer);
  },[playing,props.visible,props.pauseSequence,current,currentIndex,objects.length,imageKey,imageReady,interval,pause]);
  const choose=(index:number,focus=false)=>{if(!objects[index])return;pause();setSelectedId(objects[index].id);if(focus)tabs.current[index]?.focus();};
  const toggle=()=>{if(playRef.current){pause();return;}if(objects.length<2)return;if(currentIndex===objects.length-1)setSelectedId(objects[0].id);playRef.current=true;setPlaying(true);};
  const retry=()=>{pause();setLoadedKey(null);setFailedKey(null);setImageAttempt(value=>value+1);props.onRetry();};
  const age=current?publishedObservationAge(current):{kind:'unavailable' as const};
  const number=(value:number)=>new Intl.NumberFormat(i18n.language,{maximumFractionDigits:6}).format(value);
  const tabAge=(item:CosmicObservationCase)=>{const sourceAge=publishedObservationAge(item);return sourceAge.kind==='range'?`${number(sourceAge.min)}–${number(sourceAge.max)} Gyr`:sourceAge.kind==='approximate'?`≈ ${number(sourceAge.age)} Gyr`:copy('cosmicObsAgeUnknown');};
  return <section className={styles.viewer} style={props.visible?undefined:{visibility:'hidden'}} aria-hidden={!props.visible} data-testid="cosmic-observation-viewer" data-selected-case={current?.id??''} data-case-index={currentIndex}>
    <header className={styles.heading}><div><h1>{copy('cosmicObsTitle')}</h1><p>{copy('cosmicObsIntro')}</p></div><button data-testid="cosmic-observation-exit" onClick={()=>{pause();props.onExit();}}>{t('preciseTime')}</button></header>
    <div className={styles.caseTabs} role="tablist" aria-label={copy('cosmicObsCases')}>
      {objects.map((item,index)=><button key={item.id} ref={node=>{tabs.current[index]=node;}} id={`cosmic-case-${item.id}`} role="tab" aria-selected={current?.id===item.id} aria-controls="cosmic-observation-panel" tabIndex={props.visible&&current?.id===item.id?0:-1} data-testid={`cosmic-observation-case-${item.id}`} onClick={()=>choose(index)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%objects.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+objects.length)%objects.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=objects.length-1;else return;event.preventDefault();choose(next,true);}}><span>{String(index+1).padStart(2,'0')}</span><strong>{item.name}</strong><small>{tabAge(item)}</small></button>)}
    </div>
    {current?<div id="cosmic-observation-panel" className={styles.body} role="tabpanel" aria-labelledby={`cosmic-case-${current.id}`}>
      <figure className={styles.figure}>
        <div className={styles.imageArea} aria-busy={!imageReady&&!imageFailed}>
          <img key={imageKey} src={current.image.url} width={current.image.pixel_dimensions[0]} height={current.image.pixel_dimensions[1]} alt={copy('cosmicObsImageAlt',{name:current.name})} decoding="async" style={{visibility:props.visible&&imageReady?'visible':'hidden'}} data-testid="cosmic-observation-image" data-case-id={current.id} data-image-sha256={current.image.sha256} onLoad={()=>{if(latest.current.imageKey===imageKey){setLoadedKey(imageKey);setFailedKey(null);}}} onError={()=>{if(latest.current.imageKey===imageKey){setFailedKey(imageKey);pause();}}}/>
          {!imageReady&&<div className={styles.imageStatus} role={imageFailed?'alert':'status'}>{imageFailed?<><p>{copy('cosmicObsImageError')}</p><button onClick={retry}>{t('retry')}</button></>:t('loading')}</div>}
        </div>
        <figcaption><p data-testid="cosmic-observation-credit"><strong>{copy('cosmicObsCredit')}: </strong>{current.image.credit}</p><p data-testid="cosmic-observation-license"><strong>{copy('cosmicObsLicense')}: </strong><a href={current.image.license.url} target="_blank" rel="noreferrer" onClick={pause}>{current.image.license.label} ↗</a></p><div><a href={current.image_page_url} target="_blank" rel="noreferrer" onClick={pause}>{copy('cosmicObsImageSource')} ↗</a><a href={current.image.source_url} target="_blank" rel="noreferrer" onClick={pause}>{copy('cosmicObsOriginal')} ↗</a></div></figcaption>
      </figure>
      <aside className={styles.info}><small>{copy('cosmicObsPublished')}</small><h2 data-testid="cosmic-observation-name">{current.name}</h2>
        <dl><div><dt>{age.kind==='range'?copy('cosmicObsAgeRange'):copy('cosmicObsApproxAge')}</dt><dd>{age.kind==='range'?<output data-testid="cosmic-observation-age-range" data-age-min={age.min} data-age-max={age.max}>{number(age.min)}–{number(age.max)} Gyr</output>:age.kind==='approximate'?<output data-testid="cosmic-observation-age" data-age-gyr={age.age}>≈ {number(age.age)} Gyr</output>:copy('cosmicObsAgeUnknown')}</dd></div><div><dt>{copy('cosmicObsInstrument')}</dt><dd>{current.instrument}</dd></div></dl>
        <p className={styles.ageNote}>{copy('cosmicObsAgeNote')}</p><p data-testid="cosmic-observation-note" className={styles.note}>{t(`cosmicObs_note_${current.id}`,{defaultValue:NOTES[current.id]??current.caption})}</p>
        <a data-testid="cosmic-observation-source" href={current.source.url} target="_blank" rel="noreferrer" onClick={pause}>{t('source')} · {current.source.label} ↗</a>
        <details data-testid="cosmic-observation-details" onToggle={event=>{if(event.currentTarget.open)pause();}}><summary>{copy('cosmicObsDetails')}</summary><p>{current.caption}</p><p>{current.age_scope}</p>{current.image.processing.map((value,index)=><p key={`processing-${index}`}>{value}</p>)}{[...current.limitations,...(props.catalog?.limitations??[]),...current.image.license.requirements].map((value,index)=><p key={`limit-${index}`}>{value}</p>)}<p>{current.image.pixel_dimensions.join(' × ')} px · {number(current.image.bytes)} B</p><code>SHA256 {current.image.sha256}</code></details>
      </aside>
    </div>:<div className={styles.empty} role={props.error?'alert':'status'}>{props.error?<><p>{copy('cosmicObsError')}</p><button onClick={props.onRetry}>{t('retry')}</button></>:t('loading')}</div>}
    <footer className={styles.timeline} aria-label={copy('cosmicObsOrder')}>
      <button className={styles.play} data-testid="cosmic-observation-play-toggle" aria-pressed={playing} disabled={!objects.length||(!playing&&!imageReady)} onClick={toggle}><span aria-hidden="true">{playing?'Ⅱ':'▶'}</span>{t(playing?'timelinePause':'timelinePlay')}</button>
      <label className={styles.interval}>{copy('cosmicObsInterval')}<select data-testid="cosmic-observation-interval" value={interval} disabled={!objects.length} onChange={event=>{pause();setInterval(Number(event.target.value) as ObservationSlideInterval);}}>{OBSERVATION_SLIDE_INTERVALS.map(seconds=><option value={seconds} key={seconds}>{copy('cosmicObsIntervalOption',{seconds})}</option>)}</select></label>
      <div className={styles.order}><label htmlFor="cosmic-observation-index-range">{copy('cosmicObsOrder')}</label><input id="cosmic-observation-index-range" data-testid="cosmic-observation-index-range" type="range" min="0" max={Math.max(0,objects.length-1)} step="1" value={currentIndex} disabled={!objects.length} onChange={event=>choose(Number(event.target.value))}/><div><output data-testid="cosmic-observation-counter" data-index={currentIndex}>{copy('cosmicObsCounter',{index:objects.length?currentIndex+1:0,total:objects.length})}</output><span>{currentIndex===objects.length-1&&objects.length>0?copy('cosmicObsEnd'):copy('cosmicObsSlideNote')}</span></div></div>
    </footer>
  </section>;
}
