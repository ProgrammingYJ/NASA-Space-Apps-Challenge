import {useCallback,useEffect,useRef,useState} from 'react';
import {modelDateMs} from './longTermMath';
export const SIMULATION_RATES=[72,8766,87660,876600] as const;
export function useSimulationClock(active:boolean,bounds:{start:number;end:number}|null){
  const [ms,setMs]=useState(()=>modelDateMs(2026,11,14));const [playing,setPlaying]=useState(false);const [rate,setRate]=useState(8766);
  const current=useRef(ms),visible=useRef(ms),running=useRef(playing),rateRef=useRef(rate),boundsRef=useRef(bounds);rateRef.current=rate;boundsRef.current=bounds;
  const pause=useCallback(()=>{running.current=false;current.current=visible.current;setPlaying(false);},[]);
  const seek=useCallback((next:number)=>{pause();const b=boundsRef.current;if(!Number.isFinite(next)||!b||next<b.start||next>b.end)return false;current.current=next;visible.current=next;setMs(next);return true;},[pause]);
  useEffect(()=>{if(!active)pause();},[active,pause]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[pause]);
  useEffect(()=>{if(!playing||!active||!bounds)return;let frame=0,last=performance.now(),emitted=last;const tick=(now:number)=>{if(!running.current)return;const range=boundsRef.current;if(!range)return;const elapsed=Math.min(100,Math.max(0,now-last));last=now;current.current=Math.min(range.end,current.current+elapsed*rateRef.current*3600);if(now-emitted>=1000/30||current.current>=range.end){emitted=now;visible.current=current.current;setMs(current.current);}if(current.current>=range.end){pause();return;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[playing,active,bounds,pause]);
  const toggle=useCallback(()=>{if(running.current){pause();return;}if(!boundsRef.current)return;if(current.current>=boundsRef.current.end){current.current=boundsRef.current.start;visible.current=current.current;setMs(current.current);}running.current=true;setPlaying(true);},[pause]);
  return {ms,playing,rate,pause,seek,toggle,setRate};
}
