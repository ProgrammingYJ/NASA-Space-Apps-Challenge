import {useEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {request} from './api';
import {displayPosition,type Vec3} from './sceneMath';
import {sampleHistoricalComet,tdbCalendarLabel,type HistoricalComets,type HistoricalComet} from './historicalCometMath';
import {cometCopy,cometSessionCopy,cometName} from './historicalCometCopy';
import styles from './HistoricalCometExplorer.module.css';

function CometScene({comet,index,tail,note}:{comet:HistoricalComet;index:number;tail:boolean;note:string}){
  const host=useRef<HTMLDivElement>(null),update=useRef<((p:Vec3,tail:boolean)=>void)|null>(null);const [failed,setFailed]=useState(false);
  const sample=useMemo(()=>sampleHistoricalComet(comet,index),[comet,index]);
  useEffect(()=>{
    const element=host.current;if(!element)return;let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setFailed(true);return;}
    renderer.setClearColor('#040810');renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));element.prepend(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.02,3000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.8;controls.maxDistance=900;
    const points=comet.knots.map(k=>new THREE.Vector3().fromArray(displayPosition(k.position_au))),extent=Math.max(12,...points.map(p=>p.length()));
    camera.position.set(extent*.8,extent*.9,extent*1.2);controls.target.set(0,0,0);controls.update();
    const orbit=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#678b9e',transparent:true,opacity:.7}));scene.add(orbit);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(.7,24,16),new THREE.MeshBasicMaterial({color:'#ffd782'}));scene.add(sun);
    const nucleus=new THREE.Mesh(new THREE.SphereGeometry(.24,20,12),new THREE.MeshBasicMaterial({color:'#b9f0ed'}));scene.add(nucleus);
    const tailLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#9ed6e6',transparent:true,opacity:.6}));scene.add(tailLine);
    update.current=(p,show)=>{const v=new THREE.Vector3().fromArray(displayPosition(p));nucleus.position.copy(v);tailLine.visible=show;tailLine.geometry.setFromPoints([v,v.clone().add(v.clone().normalize().multiplyScalar(4))]);element.dataset.sourcePositionAu=p.join(',');};
    update.current(sampleHistoricalComet(comet,comet.default_index).position,tail);
    const resize=new ResizeObserver(()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(element);
    let animation=0;const animate=()=>{animation=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};animate();
    return()=>{cancelAnimationFrame(animation);resize.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(material=>material.dispose());}});renderer.dispose();renderer.domElement.remove();update.current=null;};
  },[comet]);
  useEffect(()=>{update.current?.(sample.position,tail);},[sample,tail]);
  return <div ref={host} className={styles.scene} data-testid="historical-comet-scene" data-object-id={comet.object_id} data-jd-tdb={sample.jd_tdb} data-tail-representation="schematic_antisolar_direction_only"><div className={styles.sceneNote}>{failed?'WebGL unavailable · '+note:note}</div></div>;
}

export default function HistoricalCometExplorer({visible,onClose,locale}:{visible:boolean;onClose:()=>void;locale:string}){
  const copy=cometCopy(locale),sessionCopy=cometSessionCopy(locale),[id,setId]=useState('comet-halley'),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[tail,setTail]=useState(false),[importFailed,setImportFailed]=useState(false);
  const restoredIndex=useRef<number|null>(null);
  const data=useQuery({queryKey:['historical-comets'],queryFn:({signal})=>request<HistoricalComets>('/catalog/comets',{signal}),enabled:visible,retry:false,staleTime:Infinity});
  const comet=data.data?.objects.find(o=>o.object_id===id)??data.data?.objects[0];
  useEffect(()=>{if(comet){setIndex(restoredIndex.current??comet.default_index);restoredIndex.current=null;setPlaying(false);}},[comet]);
  useEffect(()=>{if(!visible)setPlaying(false);},[visible]);
  useEffect(()=>{if(!playing||!visible||!comet)return;let animation=0,previous=performance.now();const tick=(now:number)=>{const dt=Math.min(100,now-previous)/1000;previous=now;setIndex(value=>{const next=Math.min(comet.knots.length-1,value+dt*speed);if(next===comet.knots.length-1)setPlaying(false);return next;});animation=requestAnimationFrame(tick);};animation=requestAnimationFrame(tick);return()=>cancelAnimationFrame(animation);},[playing,visible,comet,speed]);
  const safeIndex=comet?Math.max(0,Math.min(index,comet.knots.length-1)):0;
  const sample=comet?sampleHistoricalComet(comet,safeIndex):null;
  function saveSetup(){if(!data.data?.source_manifest_sha256||!comet||!sample)return;const snapshot={schema_version:'1.0',kind:'historical-comet-view',algorithm_version:data.data.algorithm_version,source_manifest_sha256:data.data.source_manifest_sha256,object_id:comet.object_id,sample_index:safeIndex,jd_tdb:sample.jd_tdb,speed,tail};const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=comet.object_id+'-setup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function importSetup(file?:File){if(!file)return;try{if(file.size>65536||!data.data?.source_manifest_sha256)throw new Error('invalid');const value=JSON.parse(await file.text());const source=data.data.objects.find(o=>o.object_id===value.object_id);if(!value||value.schema_version!=='1.0'||value.kind!=='historical-comet-view'||value.algorithm_version!==data.data.algorithm_version||value.source_manifest_sha256!==data.data.source_manifest_sha256||!source||!Number.isFinite(value.sample_index)||value.sample_index<0||value.sample_index>source.knots.length-1||sampleHistoricalComet(source,value.sample_index).jd_tdb!==value.jd_tdb||![1,3,10].includes(value.speed)||typeof value.tail!=='boolean')throw new Error('invalid');setPlaying(false);if(source.object_id!==comet?.object_id)restoredIndex.current=value.sample_index;setId(source.object_id);setIndex(value.sample_index);setSpeed(value.speed);setTail(value.tail);setImportFailed(false);}catch{setImportFailed(true);}}
  return <section hidden={!visible} className={styles.explorer} data-testid="historical-comet-explorer" aria-label={copy.title}>
    <header className={styles.header}><h1>{copy.title}</h1><button onClick={onClose} data-testid="historical-comet-close">{copy.close}</button></header>
    {visible&&comet?<CometScene key={comet.object_id} comet={comet} index={safeIndex} tail={tail} note={copy.display}/>:<div className={styles.scene}/>}
    <aside className={styles.sidebar}><label htmlFor="historical-comet-select">{copy.choose}</label><select id="historical-comet-select" data-testid="historical-comet-select" value={comet?.object_id??id} onChange={e=>{setPlaying(false);setId(e.target.value);}}>{data.data?.objects.map(o=><option key={o.object_id} value={o.object_id}>{o.designation} · {cometName(o.object_id,locale,o.name)}</option>)}</select><button data-testid="historical-comet-save" disabled={!sample} onClick={saveSetup}>{sessionCopy.save}</button><label>{sessionCopy.load}<input data-testid="historical-comet-import" type="file" accept=".json,application/json" onChange={event=>{void importSetup(event.target.files?.[0]);event.target.value='';}}/></label>{importFailed&&<p role="alert">{sessionCopy.error}</p>}
      {comet&&sample&&<><h2>{comet.designation}</h2><span className={styles.badge}>{copy.frame}</span><p>{copy.boundary}</p><dl><dt>{copy.time}</dt><dd data-testid="historical-comet-time">{tdbCalendarLabel(sample.jd_tdb)}</dd><dt>{copy.position}</dt><dd data-testid="historical-comet-position">{sample.position.map(v=>v.toFixed(7)).join(', ')}</dd><dt>{copy.distance}</dt><dd>{Math.hypot(...sample.position).toFixed(6)} au</dd></dl><p data-testid="historical-comet-sampling">{sample.exact_knot?copy.exact:copy.interpolated}</p><p>{copy.method}</p><label><input type="checkbox" data-testid="historical-comet-tail" checked={tail} onChange={e=>setTail(e.target.checked)}/>{copy.tail}</label><p className={styles.tailNote}>{copy.tailNote}</p><p>{copy.noSurface}</p><details><summary>{copy.assumptions}</summary>{comet.sources.map((s,i)=><a href={s.url} key={i} target="_blank" rel="noreferrer">{s.label??copy.source} ↗</a>)}{comet.limitations.map((s,i)=><p key={i}>{s}</p>)}</details></>}
    </aside>
    <footer className={styles.timeline}><button data-testid="historical-comet-play" disabled={!comet} onClick={()=>{if(comet&&index>=comet.knots.length-1)setIndex(0);setPlaying(value=>!value);}}>{playing?copy.pause:copy.play}</button><button disabled={!comet} onClick={()=>{setPlaying(false);if(comet)setIndex(comet.default_index);}}>{copy.reset}</button><label>{copy.speed} <select data-testid="historical-comet-speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,3,10].map(s=><option key={s} value={s}>{s} {copy.day}</option>)}</select></label><time>{sample?tdbCalendarLabel(sample.jd_tdb):'—'}</time><input aria-label={copy.time} data-testid="historical-comet-slider" type="range" min={0} max={Math.max(1,(comet?.knots.length??2)-1)} step={.01} value={safeIndex} disabled={!comet} onChange={e=>{setPlaying(false);setIndex(Number(e.target.value));}}/></footer>
    {data.isFetching&&<div role="status" className={styles.status}>{copy.loading}</div>}{data.isError&&<div role="alert" className={styles.status}>{copy.error} <button onClick={()=>void data.refetch()}>{copy.retry}</button></div>}{!data.isFetching&&!data.isError&&!comet&&<div className={styles.status}>{copy.missing}</div>}
  </section>;
}
