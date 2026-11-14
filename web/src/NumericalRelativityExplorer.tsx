import {useEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {request} from './api';
import {numericalRelativityCopy,type NumericalRelativityCopy} from './numericalRelativityCopy';
import {advanceNRReplay,nativeSample,nearestNativeIndex,nrScales,NR_PLAYBACK_RATES,restoreNRSetup,serializeNRSetup,validateNRData,type NumericalRelativityData} from './numericalRelativityMath';
import styles from './NumericalRelativityExplorer.module.css';

export interface NumericalRelativityExplorerProps {visible:boolean;onClose:()=>void;locale:string}
function scientific(value:number){return value===0?'0':value.toExponential(6);}
function number(value:number){return value.toLocaleString('en-US',{maximumSignificantDigits:10,useGrouping:false});}

function WaveformPlot({data,mass,distance,index,copy}:{data:NumericalRelativityData;mass:number;distance:number;index:number;copy:NumericalRelativityCopy}){
  const canvas=useRef<HTMLCanvasElement>(null),cursor=useRef<HTMLCanvasElement>(null);
  const scale=useMemo(()=>nrScales(mass,distance),[mass,distance]);
  const peak=useMemo(()=>{let result=0;for(let i=0;i<data.sample_count;i++)result=Math.max(result,Math.hypot(data.columns.rh22_over_m_real[i],data.columns.rh22_over_m_imag[i]));return Math.max(result,1e-30);},[data]);
  useEffect(()=>{
    const target=canvas.current;if(!target)return;
    const draw=()=>{
      const width=Math.max(280,target.clientWidth),height=Math.max(250,target.clientHeight),dpr=Math.min(devicePixelRatio,2);target.width=Math.round(width*dpr);target.height=Math.round(height*dpr);
      const ctx=target.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);ctx.fillStyle='#050e19';ctx.fillRect(0,0,width,height);
      const left=86,right=width-18,top=28,bottom=height-57,middle=(top+bottom)/2,span=data.time_range_over_m[1]-data.time_range_over_m[0],half=(bottom-top)/2;
      ctx.font='11px system-ui';ctx.lineWidth=1;ctx.textBaseline='middle';
      for(let tick=-2;tick<=2;tick++){
        const y=middle-tick/2*half*.88;ctx.strokeStyle=tick===0?'#5e7b92':'#1d3348';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
        ctx.fillStyle='#a9bed2';ctx.textAlign='right';ctx.fillText((tick/2*peak*scale.strain_per_rh22_over_m).toExponential(2),left-9,y);
      }
      ctx.strokeStyle='#5e7b92';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.stroke();
      ctx.textAlign='center';ctx.fillStyle='#afc7dc';
      for(let tick=0;tick<=4;tick++){
        const fraction=tick/4,x=left+fraction*(right-left),t=data.time_range_over_m[0]+fraction*span;
        ctx.fillText((t*scale.seconds_per_time_over_m).toPrecision(4),x,bottom+17);
      }
      const series:[number[]|null,string,number[]][]=[[data.columns.rh22_over_m_real,'#76d5ee',[]],[data.columns.rh22_over_m_imag,'#ba9ff5',[5,4]],[null,'#f6d08b',[2,3]]];
      for(const [values,color,dash] of series){
        ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.setLineDash(dash);ctx.beginPath();
        for(let i=0;i<data.sample_count;i++){
          const value=values?values[i]:Math.hypot(data.columns.rh22_over_m_real[i],data.columns.rh22_over_m_imag[i]);
          const x=left+(data.columns.time_over_m[i]-data.time_range_over_m[0])/span*(right-left),y=middle-value/peak*half*.88;
          if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
        }ctx.stroke();
      }
      ctx.setLineDash([]);
    };
    draw();const resize=new ResizeObserver(draw);resize.observe(target);return()=>resize.disconnect();
  },[data,peak,scale]);
  useEffect(()=>{
    const target=cursor.current;if(!target)return;
    const draw=()=>{const width=Math.max(280,target.clientWidth),height=Math.max(250,target.clientHeight),dpr=Math.min(devicePixelRatio,2);target.width=Math.round(width*dpr);target.height=Math.round(height*dpr);const ctx=target.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);const left=86,right=width-18,top=28,bottom=height-57,x=left+(data.columns.time_over_m[index]-data.time_range_over_m[0])/(data.time_range_over_m[1]-data.time_range_over_m[0])*(right-left);ctx.strokeStyle='#f3f8ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();};
    draw();const resize=new ResizeObserver(draw);resize.observe(target);return()=>resize.disconnect();
  },[data,index]);
  return <div className={styles.chart} data-testid="nr-plot" data-native-sample-count={data.sample_count} data-mass-scale={mass} data-distance-scale={distance} data-x-range-seconds={data.time_range_over_m.map(t=>t*scale.seconds_per_time_over_m).join(',')} data-strain-scale={scale.strain_per_rh22_over_m} data-waveform-interpolation="none">
    <span className={styles.yAxis}>{copy.yAxis}</span><canvas ref={canvas} role="img" aria-label={copy.plot}/><canvas ref={cursor} className={styles.cursorCanvas} aria-hidden="true"/><span className={styles.xAxis}>{copy.xAxis}</span>
  </div>;
}

export default function NumericalRelativityExplorer({visible,onClose,locale}:NumericalRelativityExplorerProps){
  const copy=numericalRelativityCopy(locale),[mass,setMass]=useState(60),[distance,setDistance]=useState(400),[massText,setMassText]=useState('60'),[distanceText,setDistanceText]=useState('400'),[index,setIndex]=useState(0),[rate,setRate]=useState(1),[playing,setPlaying]=useState(false),[scaleError,setScaleError]=useState(false),[scaleMessage,setScaleMessage]=useState<'invalidScale'|'farFieldError'>('invalidScale'),[importStatus,setImportStatus]=useState<'ok'|'error'|null>(null);
  const progress=useRef<number|null>(null),importGeneration=useRef(0);
  const query=useQuery({queryKey:['numerical-relativity'],queryFn:async({signal})=>validateNRData(await request<unknown>('/physics/numerical-relativity',{signal})),enabled:visible,retry:false,staleTime:Infinity});
  const data=query.data,safeIndex=data?Math.min(index,data.sample_count-1):0;
  const sample=useMemo(()=>data?nativeSample(data,safeIndex,mass,distance):null,[data,safeIndex,mass,distance]);
  useEffect(()=>{if(!visible){setPlaying(false);importGeneration.current++;}},[visible]);
  useEffect(()=>()=>{importGeneration.current++;},[]);
  useEffect(()=>{
    if(!playing||!visible||!data)return;let animation=0,previous=performance.now();progress.current??=data.columns.time_over_m[safeIndex];
    const tick=(now:number)=>{const elapsed=Math.max(0,Math.min(.25,(now-previous)/1000));previous=now;const next=advanceNRReplay(progress.current!,elapsed,rate,mass,data.time_range_over_m[1]);progress.current=next;setIndex(nearestNativeIndex(data.columns.time_over_m,next));if(next>=data.time_range_over_m[1]){setPlaying(false);return;}animation=requestAnimationFrame(tick);};
    animation=requestAnimationFrame(tick);return()=>cancelAnimationFrame(animation);
  },[playing,visible,data,rate,mass]);
  function seek(next:number){if(!data)return;importGeneration.current++;setPlaying(false);setIndex(next);progress.current=data.columns.time_over_m[next];setImportStatus(null);}
  function toggle(){if(!data)return;importGeneration.current++;if(playing){setPlaying(false);return;}if(safeIndex===data.sample_count-1){setIndex(0);progress.current=data.columns.time_over_m[0];}else progress.current=data.columns.time_over_m[safeIndex];setPlaying(true);}
  function updateScale(which:'mass'|'distance',text:string){importGeneration.current++;setPlaying(false);setImportStatus(null);if(which==='mass')setMassText(text);else setDistanceText(text);try{const nextMass=which==='mass'?text:massText,nextDistance=which==='distance'?text:distanceText,m=nextMass.trim()?Number(nextMass):NaN,d=nextDistance.trim()?Number(nextDistance):NaN;nrScales(m,d);setMass(m);setDistance(d);setScaleError(false);}catch(error){setScaleMessage(error instanceof Error&&error.message==='nr_far_field_display_restriction'?'farFieldError':'invalidScale');setScaleError(true);}}
  function save(){if(!data)return;importGeneration.current++;setPlaying(false);const setup=serializeNRSetup(data,{mass,distance,index:safeIndex,rate}),url=URL.createObjectURL(new Blob([JSON.stringify(setup,null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='sxs-bbh-0305-replay-setup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function importSetup(file?:File){if(!file||!data)return;const token=++importGeneration.current;try{if(file.size>65536)throw new Error('nr_setup_too_large');const parsed=JSON.parse(await file.text()),value=restoreNRSetup(parsed,data);if(token!==importGeneration.current)return;setPlaying(false);setMass(value.mass_total_msun);setMassText(String(value.mass_total_msun));setDistance(value.distance_mpc);setDistanceText(String(value.distance_mpc));setIndex(value.sample_index);progress.current=value.time_over_m;setRate(value.playback_rate);setScaleError(false);setImportStatus('ok');}catch{if(token===importGeneration.current)setImportStatus('error');}}
  return <section hidden={!visible} className={styles.explorer} data-testid="nr-explorer" aria-label={copy.title} data-source-sha256={data?.source_manifest_sha256} data-playing={playing} data-sample-index={safeIndex}>
    <header className={styles.header}><div><small>{copy.tab} · SXS</small><h1>{copy.title}</h1></div><button onClick={onClose} data-testid="nr-close">{copy.close}</button><p data-testid="nr-scope">{copy.scope}</p></header>
    {query.isPending&&<p role="status" className={styles.loadState}>{copy.loading}</p>}
    {query.isError&&<div role="alert" className={styles.loadState}>{copy.error}<button onClick={()=>void query.refetch()}>{copy.retry}</button></div>}
    {data&&sample&&<>
      <main className={styles.visual}><h2>{copy.plot}</h2><div className={styles.legend}><span><i className={styles.real}/>{copy.real}</span><span><i className={styles.imag}/>{copy.imag}</span><span><i className={styles.amplitude}/>{copy.amplitude}</span></div>{visible&&<WaveformPlot data={data} mass={mass} distance={distance} index={safeIndex} copy={copy}/>}<p className={styles.units}>{copy.units}</p>
        <div className={styles.readout} role="group" aria-label={copy.sampleValue}><div><span>{copy.nativeTime}</span><output data-testid="nr-native-time">{number(sample.time_over_m)}</output></div><div><span>{copy.physicalTime}</span><output data-testid="nr-time">{scientific(sample.time_s)}</output></div><div><span>{copy.real}</span><output data-testid="nr-real">{scientific(sample.real)}</output></div><div><span>{copy.imag}</span><output data-testid="nr-imag">{scientific(sample.imag)}</output></div><div><span>{copy.amplitude}</span><output data-testid="nr-amplitude">{scientific(sample.amplitude)}</output></div></div>
      </main>
      <aside className={styles.sidebar}><div className={styles.case} data-testid="nr-case">{copy.case}</div><dl className={styles.parameters}><dt>{copy.native}</dt><dd data-testid="nr-sample-count">{data.sample_count.toLocaleString(locale)}</dd><dt>{copy.q}</dt><dd data-testid="nr-mass-ratio">{number(data.reference_parameters.mass_ratio_m1_over_m2)}</dd><dt>{copy.spin1}</dt><dd data-testid="nr-spin-1">{data.reference_parameters.dimensionless_spin1.map(number).join(', ')}</dd><dt>{copy.spin2}</dt><dd data-testid="nr-spin-2">{data.reference_parameters.dimensionless_spin2.map(number).join(', ')}</dd><dt>{copy.eccentricity}</dt><dd>{number(data.reference_parameters.eccentricity)}</dd></dl><p className={styles.fixed} data-testid="nr-fixed-parameters">{copy.fixed}: {copy.fixedNote}</p>
        <label htmlFor="nr-mass-input">{copy.mass}</label><input id="nr-mass-input" data-testid="nr-mass" type="number" min="0" max="1000000000000" step="any" value={massText} onChange={e=>updateScale('mass',e.target.value)}/>
        <label htmlFor="nr-distance-input">{copy.distance}</label><input id="nr-distance-input" data-testid="nr-distance" type="number" min="0" max="1000000000000" step="any" value={distanceText} onChange={e=>updateScale('distance',e.target.value)}/>
        {scaleError&&<p role="alert" className={styles.alert}>{copy[scaleMessage]}</p>}<p data-testid="nr-scaling-note">{copy.scaling}</p><p data-testid="nr-far-field-note">{copy.farField}</p>
        <div className={styles.setup}><button data-testid="nr-save" onClick={save} disabled={scaleError}>{copy.save}</button><label>{copy.load}<input data-testid="nr-import" type="file" accept=".json,application/json" onChange={event=>{void importSetup(event.target.files?.[0]);event.target.value='';}}/></label></div>
        {importStatus&&<p data-testid="nr-import-status" role={importStatus==='error'?'alert':'status'} className={importStatus==='error'?styles.alert:styles.success}>{copy[importStatus==='error'?'restoreError':'restored']}</p>}
        <details className={styles.sources}><summary>{copy.sources}</summary><p>{copy.processing}</p><p>{copy.limits}</p><p>{copy.timeNote}</p><a href={'https://doi.org/'+data.record_doi} target="_blank" rel="noreferrer">{copy.source} ↗</a><a href={data.format_documentation_url} target="_blank" rel="noreferrer">SXS · {copy.sources} ↗</a><a href={data.rights.license_url} target="_blank" rel="noreferrer">{copy.license} ↗</a><p>{data.rights.attribution}</p><dl><dt>{copy.rawHash}</dt><dd><code>{data.data.source_sha256}</code></dd><dt>{copy.derivedHash}</dt><dd><code>{data.data.sha256}</code></dd><dt>{copy.manifestHash}</dt><dd><code>{data.source_manifest_sha256}</code></dd></dl></details>
      </aside>
      <footer className={styles.transport}><div className={styles.controls}><button data-testid="nr-play" aria-pressed={playing} disabled={scaleError} onClick={toggle}>{playing?copy.pause:copy.play}</button><button onClick={()=>seek(0)} data-testid="nr-restart">{copy.restart}</button><button onClick={()=>seek(data.peak_h22_sample_index)} data-testid="nr-peak">{copy.peak}</button><button onClick={()=>seek(Math.max(0,safeIndex-1))} aria-label={copy.previous}>−1</button><button onClick={()=>seek(Math.min(data.sample_count-1,safeIndex+1))} aria-label={copy.next}>+1</button><label>{copy.speed}<select data-testid="nr-rate" value={rate} onChange={event=>{importGeneration.current++;setRate(Number(event.target.value));}}>{NR_PLAYBACK_RATES.map(value=><option key={value} value={value}>{value}×</option>)}</select></label><output data-testid="nr-cursor">{copy.cursor} {safeIndex+1} / {data.sample_count}</output></div><input className={styles.scrub} data-testid="nr-slider" type="range" min="0" max={data.sample_count-1} step="1" value={safeIndex} aria-label={copy.scrub} onChange={event=>seek(Number(event.target.value))}/><p>{copy.rateNote}</p></footer>
    </>}
  </section>;
}
