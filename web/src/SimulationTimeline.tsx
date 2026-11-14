import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {modelDateMs,modelDateParts,type LongTermModel} from './longTermMath';
import {SIMULATION_RATES} from './useSimulationClock';
import styles from './SimulationTimeline.module.css';
interface Clock {ms:number;playing:boolean;rate:number;seek:(ms:number)=>boolean;pause:()=>void;toggle:()=>void;setRate:(rate:number)=>void}
export default function SimulationTimeline({model,clock,onPrecise,onHistory,error,onRetry}:{model?:LongTermModel;clock:Clock;onPrecise:()=>void;onHistory:()=>void;error:boolean;onRetry:()=>void}){
  const {t}=useTranslation();const [parts,setParts]=useState(modelDateParts(clock.ms));const [invalid,setInvalid]=useState(false);
  useEffect(()=>{setParts(modelDateParts(clock.ms));},[clock.ms]);
  const min=model?.coverage.min_date,max=model?.coverage.max_date;const bounds=min&&max?{start:modelDateMs(min.year,min.month,min.day),end:modelDateMs(max.year,max.month,max.day)}:null;
  function apply(){try{setInvalid(!clock.seek(modelDateMs(parts.year,parts.month,parts.day)));}catch{setInvalid(true);}}
  return <section className={styles.timeline} data-testid="simulation-timeline" aria-label={t('simTitle')}>
    <button data-testid="simulation-play" disabled={!model} aria-pressed={clock.playing} onClick={clock.toggle}>{t(clock.playing?'timelinePause':'timelinePlay')}</button>
    <div><label htmlFor="simulation-year">{t('simTitle')}</label><div className={styles.date}><input id="simulation-year" data-testid="simulation-year" aria-label={t('simYear')} type="number" min={min?.year} max={max?.year} value={parts.year} onChange={e=>{clock.pause();setParts(p=>({...p,year:Number(e.target.value)}));}}/><input aria-label={t('simMonth')} type="number" min="1" max="12" value={parts.month} onChange={e=>{clock.pause();setParts(p=>({...p,month:Number(e.target.value)}));}}/><input aria-label={t('simDay')} type="number" min="1" max="31" value={parts.day} onChange={e=>{clock.pause();setParts(p=>({...p,day:Number(e.target.value)}));}}/><button data-testid="simulation-apply" disabled={!model} onClick={apply}>{t('simApply')}</button></div><output data-testid="simulation-clock">{modelDateParts(clock.ms).year} / {modelDateParts(clock.ms).month} / {modelDateParts(clock.ms).day} · TDB</output></div>
    <label>{t('playbackSpeed')}<select data-testid="simulation-rate" value={clock.rate} onChange={e=>clock.setRate(Number(e.target.value))}>{SIMULATION_RATES.map(rate=><option key={rate} value={rate}>{rate===72?t('playbackRate',{hours:72}):t('simYearsPerSecond',{years:rate/8766})}</option>)}</select></label>
    <div className={styles.range}><input data-testid="simulation-range" aria-label={t('simTitle')} type="range" min={bounds?.start??clock.ms} max={bounds?.end??clock.ms} step="86400000" value={clock.ms} disabled={!model} onChange={e=>{clock.seek(Number(e.target.value));setInvalid(false);}}/><div>{min?.year??'…'} — {max?.year??'…'}</div><p>{t('simNote')} {t('simAccuracyNote')}</p>{invalid&&<p role="alert">{t('simInvalid')}</p>}{error&&<p role="alert">{t('simLoadError')} <button onClick={onRetry}>{t('retry')}</button></p>}</div>
    <div className={styles.links}><button data-testid="simulation-exit" onClick={onPrecise}>{t('preciseTime')}</button><button onClick={onHistory}>{t('bigBangMode')}</button></div>
  </section>;
}
