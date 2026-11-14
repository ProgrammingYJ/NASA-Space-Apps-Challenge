import {useCallback,useEffect,useRef,useState} from 'react';
import {advanceCosmicAge,type CosmicRate} from './cosmicMath';
export function useCosmicPlayer(maxAge:number){
  const [age,setAge]=useState(.00038);const [playing,setPlaying]=useState(false);const [rate,setRate]=useState<CosmicRate>(100);
  const state=useRef({age,visible:age,playing,rate,maxAge});state.current.rate=rate;state.current.maxAge=maxAge;
  const pause=useCallback(()=>{state.current.playing=false;state.current.age=state.current.visible;setPlaying(false);},[]);
  const seek=useCallback((value:number)=>{if(!Number.isFinite(value))return;pause();const next=Math.max(0,Math.min(state.current.maxAge,value));state.current.age=next;state.current.visible=next;setAge(next);},[pause]);
  const toggle=useCallback(()=>{if(state.current.playing){pause();return;}if(state.current.age>=state.current.maxAge){state.current.age=0;state.current.visible=0;setAge(0);}state.current.playing=true;setPlaying(true);},[pause]);
  useEffect(()=>{if(!playing)return;let frame=0;let previous=performance.now();let emitted=previous;
    const tick=(now:number)=>{if(!state.current.playing)return;const next=advanceCosmicAge(state.current.age,now-previous,state.current.rate,state.current.maxAge);previous=now;state.current.age=next.age;if(now-emitted>=1000/30||next.ended){emitted=now;state.current.visible=next.age;setAge(next.age);}if(next.ended){pause();return;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,pause]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[pause]);
  return {age,playing,rate,setRate,pause,seek,toggle};
}
