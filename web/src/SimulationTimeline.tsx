import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {modelDateMs,modelDateParts,parseModelDateDraft,type LongTermModel,type ModelDateDraft} from './longTermMath';
import {SIMULATION_RATES} from './useSimulationClock';
import styles from './SimulationTimeline.module.css';
interface Clock {ms:number;playing:boolean;rate:number;seek:(ms:number)=>boolean;pause:()=>void;toggle:()=>void;setRate:(rate:number)=>void}
const draftFor=(ms:number):ModelDateDraft=>{const date=modelDateParts(ms);return {year:String(date.year),month:String(date.month),day:String(date.day)};};
export default function SimulationTimeline({model,clock,onPrecise,onHistory,error,onRetry}:{model?:LongTermModel;clock:Clock;onPrecise:()=>void;onHistory:()=>void;error:boolean;onRetry:()=>void}){
  const {t}=useTranslation();const [draft,setDraft]=useState(()=>draftFor(clock.ms));const [invalid,setInvalid]=useState(false);const editing=useRef(false);
  useEffect(()=>{if(!editing.current)setDraft(draftFor(clock.ms));},[clock.ms]);
  const min=model?.coverage.min_date,max=model?.coverage.max_date;const bounds=min&&max?{start:modelDateMs(min.year,min.month,min.day),end:modelDateMs(max.year,max.month,max.day)}:null;
  function apply(){editing.current=false;try{const date=parseModelDateDraft(draft),ms=modelDateMs(date.year,date.month,date.day);const applied=clock.seek(ms);setInvalid(!applied);if(applied)setDraft(draftFor(ms));}catch{clock.pause();setInvalid(true);}}
  function change(field:keyof ModelDateDraft,value:string){editing.current=true;clock.pause();setDraft(previous=>({...previous,[field]:value}));setInvalid(false);}
  return <section className={styles.timeline} data-testid="simulation-timeline" aria-label={t('simTitle')}>
    <button data-testid="simulation-play" disabled={!model} aria-pressed={clock.playing} onClick={clock.toggle}>{t(clock.playing?'timelinePause':'timelinePlay')}</button>
    <div><label htmlFor="simulation-year">{t('simTitle')}</label><form className={styles.date} noValidate onSubmit={event=>{event.preventDefault();apply();}} onFocusCapture={()=>{editing.current=true;clock.pause();}} onBlurCapture={event=>{if(event.target instanceof HTMLInputElement)apply();}}>
      <input id="simulation-year" data-testid="simulation-year" aria-label={t('simYear')} type="text" inputMode="numeric" spellCheck={false} disabled={!model} value={draft.year} aria-invalid={invalid} onChange={e=>change('year',e.target.value)}/>
      <input data-testid="simulation-month" aria-label={t('simMonth')} type="number" min="1" max="12" disabled={!model} value={draft.month} aria-invalid={invalid} onChange={e=>change('month',e.target.value)}/>
      <input data-testid="simulation-day" aria-label={t('simDay')} type="number" min="1" max="31" disabled={!model} value={draft.day} aria-invalid={invalid} onChange={e=>change('day',e.target.value)}/>
      <button type="submit" data-testid="simulation-apply" disabled={!model}>{t('simApply')}</button>
    </form><output data-testid="simulation-clock">{modelDateParts(clock.ms).year} / {modelDateParts(clock.ms).month} / {modelDateParts(clock.ms).day} · TDB</output></div>
    <label>{t('playbackSpeed')}<select data-testid="simulation-rate" value={clock.rate} onChange={e=>clock.setRate(Number(e.target.value))}>{SIMULATION_RATES.map(rate=><option key={rate} value={rate}>{rate===72?t('playbackRate',{hours:72}):t('simYearsPerSecond',{years:rate/8766})}</option>)}</select></label>
    <div className={styles.range}><input data-testid="simulation-range" aria-label={t('simTitle')} type="range" min={bounds?.start??clock.ms} max={bounds?.end??clock.ms} step="86400000" value={clock.ms} disabled={!model} onChange={e=>{editing.current=false;clock.seek(Number(e.target.value));setInvalid(false);}}/><div>{min?.year??'…'} — {max?.year??'…'}</div><p>{t('simInputHelp')}</p><p>{t('simNote')} {t('simAccuracyNote')}</p>{invalid&&<p role="alert">{t('simInvalid')}</p>}{error&&<p role="alert">{t('simLoadError')} <button onClick={onRetry}>{t('retry')}</button></p>}</div>
    <div className={styles.links}><button data-testid="simulation-exit" onClick={onPrecise}>{t('preciseTime')}</button><button onClick={onHistory}>{t('bigBangMode')}</button></div>
  </section>;
}
