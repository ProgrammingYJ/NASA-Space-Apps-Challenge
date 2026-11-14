import {useCallback,useEffect,useRef,useState} from 'react';
import {advanceModelTime,type ModelTimeRate,MODEL_TIME_RATES} from './modelTime';
import type {Bounds} from './timelineMath';
export function useModelTime(active:boolean,bounds:Bounds|null,initial:number){
  const [ms,setMs]=useState(initial),[playing,setPlaying]=useState(false),[rate,setRateValue]=useState<ModelTimeRate>(6);
  const current=useRef(ms),visible=useRef(ms),running=useRef(playing),range=useRef(bounds),rateRef=useRef(rate);range.current=bounds;rateRef.current=rate;
  const pause=useCallback(()=>{running.current=false;current.current=visible.current;setPlaying(false);},[]);
  const seek=useCallback((next:number)=>{pause();const b=range.current;if(!Number.isFinite(next)||!b||next<b.start||next>b.end)return false;current.current=next;visible.current=next;setMs(next);return true;},[pause]);
  const setRate=useCallback((next:number)=>{if(MODEL_TIME_RATES.includes(next as ModelTimeRate))setRateValue(next as ModelTimeRate);},[]);
  const toggle=useCallback(()=>{if(running.current){pause();return;}const b=range.current;if(!b)return;if(current.current>=b.end){current.current=b.start;visible.current=b.start;setMs(b.start);}running.current=true;setPlaying(true);},[pause]);
  useEffect(()=>{if(!active)pause();},[active,pause]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[pause]);
  useEffect(()=>{if(!playing||!active||!bounds)return;let frame=0,last=performance.now(),emitted=last;const tick=(now:number)=>{if(!running.current)return;const b=range.current;if(!b){pause();return;}const step=advanceModelTime(current.current,now-last,rateRef.current,b);last=now;current.current=step.ms;if(now-emitted>=1000/30||step.ended){emitted=now;visible.current=step.ms;setMs(step.ms);}if(step.ended){pause();return;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[playing,active,bounds,pause]);
  return {ms,playing,rate,seek,pause,toggle,setRate};
}
