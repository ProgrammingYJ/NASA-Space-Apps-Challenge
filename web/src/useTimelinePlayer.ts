import {useCallback,useEffect,useRef,useState} from 'react';
import {advancePlayback,type Bounds,type PlaybackRate} from './timelineMath';

export function useTimelinePlayer(bounds:Bounds|null,initial:number){
  const [epochMs,setEpochMs]=useState(initial);const [playing,setPlaying]=useState(false);const [rate,setRate]=useState<PlaybackRate>(6);
  const epochRef=useRef(epochMs);const visibleEpochRef=useRef(epochMs);const boundsRef=useRef(bounds);const rateRef=useRef(rate);const playingRef=useRef(playing);
  boundsRef.current=bounds;rateRef.current=rate;playingRef.current=playing;
  const pause=useCallback(()=>{playingRef.current=false;epochRef.current=visibleEpochRef.current;setPlaying(false);},[]);
  const seek=useCallback((value:number)=>{if(!Number.isFinite(value))return;pause();const range=boundsRef.current;const next=range?Math.max(range.start,Math.min(range.end,value)):value;epochRef.current=next;visibleEpochRef.current=next;setEpochMs(next);},[pause]);
  const toggle=useCallback(()=>{if(playingRef.current){pause();return;}const range=boundsRef.current;if(!range)return;if(epochRef.current>=range.end){epochRef.current=range.start;visibleEpochRef.current=range.start;setEpochMs(range.start);}playingRef.current=true;setPlaying(true);},[pause]);
  useEffect(()=>{if(!playing)return;let frame=0;let previous=performance.now();let emitted=previous;
    const tick=(now:number)=>{if(!playingRef.current)return;const range=boundsRef.current;if(!range){pause();return;}const step=advancePlayback(epochRef.current,now-previous,rateRef.current,range);previous=now;epochRef.current=step.epoch;if(now-emitted>=1000/30||step.ended){emitted=now;visibleEpochRef.current=step.epoch;setEpochMs(step.epoch);}if(step.ended){pause();return;}frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,pause]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[pause]);
  return {epochMs,playing,rate,setRate,seek,toggle,pause};
}
