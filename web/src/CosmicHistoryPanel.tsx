import {useTranslation} from 'react-i18next';
import {COSMIC_RATES,historyStage,type CosmicHistory,type CosmicRate} from './cosmicMath';
import styles from './CosmicHistoryPanel.module.css';

export interface CosmicHistoryPanelProps {
  history:CosmicHistory|undefined;
  age:number;
  onSeek:(age:number)=>void;
  onClose:()=>void;
  loading:boolean;
  error:boolean;
  onRetry:()=>void;
}
export interface CosmicTimelineProps {
  history:CosmicHistory|undefined;
  age:number;
  playing:boolean;
  rate:CosmicRate;
  onSeek:(age:number)=>void;
  onToggle:()=>void;
  onRate:(rate:CosmicRate)=>void;
  onExit:()=>void;
}

function ageWithin(age:number,max:number){return Math.max(0,Math.min(max,Number.isFinite(age)?age:0));}

export function CosmicHistoryPanel({history,age,onSeek,onClose,loading,error,onRetry}:CosmicHistoryPanelProps) {
  const {t,i18n}=useTranslation();
  const format=(value:number,digits=6)=>new Intl.NumberFormat(i18n.language,{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  const current=history?historyStage(history,ageWithin(age,history.reference_age_gyr)):undefined;
  return <aside className={styles.panel} data-testid="cosmic-history-panel" aria-label={t('cosmicMilestones')}>
    <button className={styles.close} onClick={onClose} aria-label={t('close')}>×</button>
    <small>{t('cosmicTime')}</small>
    <h1>{t('cosmicMilestones')}</h1>
    {loading&&<p role="status">{t('cosmicLoading')}</p>}
    {error&&<div role="alert"><p>{t('cosmicError')}</p><button onClick={onRetry}>{t('retry')}</button></div>}
    {history&&<>
      <details className={styles.morphology} data-testid="cosmic-morphology-guide">
        <summary>{t('cosmicMorphologyTitle')}</summary>
        <p>{t('cosmicMorphologyNote')}</p>
        <ul className={styles.families}>
          {['clumpy','compact','elongated','small_disk','disturbed_pair'].map(family=><li key={family}>{t(`cosmicFamily_${family}`)}</li>)}
        </ul>
        <p>{t('cosmicMorphologyAssumptions')}</p>
        {history.morphology_reference&&<div data-testid="cosmic-morphology-sources">
          <strong>{t('cosmicMorphologySources')}</strong>
          {history.morphology_reference.examples.map(example=><a key={example.id} href={example.source.url} target="_blank" rel="noreferrer">{example.name}{example.approx_age_gyr!==null?<> · ≈ {new Intl.NumberFormat(i18n.language,{maximumFractionDigits:3}).format(example.approx_age_gyr)} Gyr</>:example.sample_age_range_gyr&&<> · ≈ {example.sample_age_range_gyr.map(age=>new Intl.NumberFormat(i18n.language,{maximumFractionDigits:3}).format(age)).join('–')} Gyr</>} ↗</a>)}
        </div>}
      </details>
      <nav className={styles.milestones} aria-label={t('cosmicMilestones')}>
        {history.stages.map(stage=><button key={stage.stage_id} data-testid={`cosmic-milestone-${stage.stage_id}`} aria-pressed={stage.stage_id===current?.stage_id} onClick={()=>onSeek(stage.age_gyr)}>
          <span>{t(stage.label_key.replaceAll('.','_'))}</span><small>{format(stage.age_gyr)} Gyr</small>
        </button>)}
      </nav>
      {current&&<section className={styles.stage} aria-label={t('cosmicStage')}>
        <small>{t('cosmicStage')}</small>
        <h2 data-testid="cosmic-stage" data-stage-id={current.stage_id}>{t(current.label_key.replaceAll('.','_'))}</h2>
        <p>{t(`history_description_${current.stage_id}`)}</p>
        <a href={current.source.url} target="_blank" rel="noreferrer">{t('source')} · {current.source.label} ↗</a>
        <details><summary>{t('displayAssumptions')}</summary>
          <p>{t('cosmicApproxNote')}</p>
          {current.age_range_gyr&&<p>{format(current.age_range_gyr[0])}–{format(current.age_range_gyr[1])} Gyr</p>}
          <p className={styles.sourceTerm}>{current.timing_status}</p>
          <ul>{[...new Set([...current.limitations,...history.limitations])].map((limitation,index)=><li key={index}>{limitation}</li>)}</ul>
        </details>
      </section>}
      <p className={styles.note}>{t('cosmicVisualNote')}</p>
    </>}
  </aside>;
}

export function CosmicTimeline({history,age,playing,rate,onSeek,onToggle,onRate,onExit}:CosmicTimelineProps) {
  const {t,i18n}=useTranslation();const max=history?.reference_age_gyr??13.8,min=history?.age_range_gyr[0]??0,value=ageWithin(age,max);
  const format=(number:number)=>new Intl.NumberFormat(i18n.language,{minimumFractionDigits:6,maximumFractionDigits:6}).format(number);
  const seek=(next:number)=>{if(Number.isFinite(next))onSeek(Math.max(min,Math.min(max,next)));};
  return <section className={styles.timeline} aria-label={t('cosmicControls')} data-testid="cosmic-timeline">
    <button className={styles.play} data-testid="cosmic-play-toggle" aria-pressed={playing} onClick={onToggle} disabled={!history}><span aria-hidden="true">{playing?'Ⅱ':'▶'}</span>{t(playing?'timelinePause':'timelinePlay')}</button>
    <div className={styles.clock}>
      <label htmlFor="cosmic-age-input">{t('cosmicAge')} · Gyr</label>
      <input id="cosmic-age-input" data-testid="cosmic-age-input" type="number" min={min} max={max} step="0.000001" value={Number(value.toFixed(6))} onChange={event=>seek(event.currentTarget.valueAsNumber)} disabled={!history}/>
      <output data-testid="cosmic-age" data-age-gyr={value.toFixed(9)}>{format(value)} Gyr</output>
      <div>{t('lookbackTime')}: <output data-testid="cosmic-lookback" data-lookback-gyr={(max-value).toFixed(9)}>≈ {format(max-value)} Gyr</output></div>
    </div>
    <label className={styles.rate}>{t('playbackSpeed')}
      <select data-testid="cosmic-rate" value={rate} onChange={event=>onRate(Number(event.target.value) as CosmicRate)} disabled={!history}>
        {COSMIC_RATES.map(option=><option key={option} value={option}>{t('cosmicRate',{millions:option})} · {option} Myr/s</option>)}
      </select>
    </label>
    <div className={styles.scrubber}>
      <input data-testid="cosmic-time-range" type="range" min={min} max={max} step="0.000001" value={value} onChange={event=>seek(Number(event.target.value))} aria-label={`${t('cosmicAge')} (Gyr)`} disabled={!history}/>
      <div><span>{min} Gyr</span><span>≈ {max} Gyr</span></div>
      <p>{value>=max?t('cosmicEnd'):t('cosmicApproxNote')}</p>
    </div>
    <button className={styles.exit} onClick={onExit}>{t('preciseTime')}</button>
  </section>;
}

export default CosmicHistoryPanel;
