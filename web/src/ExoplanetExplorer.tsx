import {useEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {request} from './api';
import styles from './ExoplanetExplorer.module.css';

interface CatalogObject {object_id:string;name:string;hostname:string;ra_deg:number|null;dec_deg:number|null;radius_earth:number|null;appearance_class:string;discovery_year:number|null}
interface Catalog {catalog_version:string;retrieved_utc:string;planet_count:number;host_count:number;raw_sha256:string;objects:CatalogObject[];limitations:string[]}
interface SystemPlanet {object_id:string;name:string;semimajor_axis_au:number|null;period_days:number|null;radius_earth:number|null;eccentricity?:number|null;appearance_class?:string}
interface Detail {object_id:string;name:string;hostname:string;parameters:Record<string,unknown>&{nasa?:{url:string;description:string;radius_display:string|null;mass_display:string|null;radius_estimated:boolean;appearance_class:string;star_acf:Record<string,unknown>}};source_url:string;retrieved_utc:string;surface_status:string;system_planets:SystemPlanet[];limitations:string[]}
interface Props {visible:boolean;epochMs:number;onClose:()=>void}
interface PlanetMesh {mesh:THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>;record:SystemPlanet;radius:number;phase:number;orbitRadius:number;last:THREE.Vector3}
interface Runtime {renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;controls:OrbitControls;group:THREE.Group;planets:Map<string,PlanetMesh>;labels:Map<string,HTMLButtonElement>;points:THREE.Points|null;pointIds:string[];selected:string|null;follow:string|null;focus:{from:THREE.Vector3;fromTarget:THREE.Vector3;to:THREE.Vector3;target:THREE.Vector3;started:number}|null}
const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
const seed=(id:string)=>Array.from(id).reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,7)/4294967296;

/** Artistic GLSL surface; the catalog has no resolved geographic maps. */
function material(kind:string,id:string){
  const gas=/giant|neptune/i.test(kind);const neptune=/neptune/i.test(kind);const superEarth=/super/i.test(kind);
  const a=new THREE.Color(gas?neptune?'#3b7088':'#b28b69':superEarth?'#6b5145':'#76726d');
  const b=new THREE.Color(gas?neptune?'#acd0cd':'#e7cfad':superEarth?'#b3a18b':'#c7c0ae');
  const result=new THREE.MeshStandardMaterial({color:'white',roughness:gas?.84:.97,metalness:0});
  result.onBeforeCompile=shader=>{
    shader.uniforms.surfaceA={value:a};shader.uniforms.surfaceB={value:b};shader.uniforms.surfaceSeed={value:seed(id)*100};shader.uniforms.gasSurface={value:gas?1:0};
    shader.vertexShader='varying vec3 terrainPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n terrainPosition=normalize(position);');
    shader.fragmentShader=`varying vec3 terrainPosition;
      uniform vec3 surfaceA;uniform vec3 surfaceB;uniform float surfaceSeed;uniform float gasSurface;
      float terrainHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float terrainNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(terrainHash(i),terrainHash(i+vec3(1,0,0)),f.x),mix(terrainHash(i+vec3(0,1,0)),terrainHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(terrainHash(i+vec3(0,0,1)),terrainHash(i+vec3(1,0,1)),f.x),mix(terrainHash(i+vec3(0,1,1)),terrainHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float terrainFbm(vec3 p){float n=0.,w=.5;for(int i=0;i<5;i++){n+=w*terrainNoise(p);p=p*2.03+vec3(1.7);w*=.5;}return n;}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 tp=normalize(terrainPosition);float n=terrainFbm(tp*13.+surfaceSeed);
      float cloud=.5+.5*sin(tp.y*43.+terrainFbm(tp*7.+surfaceSeed)*9.);
      float terrain=smoothstep(.25,.8,n)+.14*terrainNoise(tp*180.);
      float pattern=mix(terrain,.17+.7*cloud+.15*n,gasSurface);
      diffuseColor.rgb*=mix(surfaceA,surfaceB,clamp(pattern,0.,1.));`);
  };
  result.customProgramCacheKey=()=>`illustrative-exoplanet-v1-${kind}-${id}`;
  return result;
}
function release(group:THREE.Object3D){group.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line||child instanceof THREE.Points){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach((m:THREE.Material)=>m.dispose());}});}
function orbitPosition(item:PlanetMesh,epoch:number){
  const days=(epoch-Date.parse('2026-11-14T00:00:00Z'))/86400000;
  const period=item.record.period_days;const mean=item.phase+(period&&period>0?days/period*Math.PI*2:0);
  const eccentricity=item.record.eccentricity;const e=typeof eccentricity==='number'&&eccentricity>=0&&eccentricity<.98?eccentricity:0;
  let anomaly=mean;for(let i=0;i<12;i++)anomaly-=(anomaly-e*Math.sin(anomaly)-mean)/(1-e*Math.cos(anomaly));
  return new THREE.Vector3(item.orbitRadius*(Math.cos(anomaly)-e),0,item.orbitRadius*Math.sqrt(1-e*e)*Math.sin(anomaly));
}

export default function ExoplanetExplorer({visible,epochMs,onClose}:Props){
  const {t}=useTranslation();const [search,setSearch]=useState('');const [page,setPage]=useState(0);const [selected,setSelected]=useState<string|null>(null);const [skySequence,setSkySequence]=useState(0);const [error,setError]=useState(false);
  const host=useRef<HTMLDivElement>(null);const runtime=useRef<Runtime|null>(null);const latest=useRef({visible,epochMs});latest.current={visible,epochMs};const selectRef=useRef(setSelected);selectRef.current=setSelected;
  const catalog=useQuery({queryKey:['exoplanet-catalog'],queryFn:({signal})=>request<Catalog>('/catalog/exoplanets',{signal}),enabled:visible,retry:false,staleTime:Infinity});
  const detail=useQuery({queryKey:['exoplanet',selected],queryFn:({signal})=>request<Detail>(`/catalog/exoplanets/${selected}`,{signal}),enabled:visible&&selected!==null,retry:false,staleTime:Infinity});
  const filtered=useMemo(()=>catalog.data?.objects.filter(row=>`${row.name} ${row.hostname}`.toLowerCase().includes(search.toLowerCase()))??[],[catalog.data,search]);
  const rows=filtered.slice(page*70,(page+1)*70);
  const detailValue=detail.data?.object_id===selected?detail.data:null;
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{setError(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor('#02060d');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    renderer.domElement.tabIndex=0;renderer.domElement.dataset.testid='exoplanet-canvas';renderer.domElement.setAttribute('aria-label',t('exoCanvas'));
    element.appendChild(renderer.domElement);const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(45,1,.01,10000);camera.position.set(0,55,120);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.1;controls.minDistance=.5;controls.maxDistance=1500;
    const group=new THREE.Group();scene.add(group);scene.add(new THREE.HemisphereLight('#8facd3','#070707',.45));const light=new THREE.PointLight('#fff1d7',65,0,0);light.position.set(0,0,0);scene.add(light);
    const rt:Runtime={renderer,scene,camera,controls,group,planets:new Map(),labels:new Map(),points:null,pointIds:[],selected:null,follow:null,focus:null};runtime.current=rt;
    const manual=()=>{rt.focus=null;rt.follow=null;};controls.addEventListener('start',manual);
    const keys=new Set<string>();const keydown=(event:KeyboardEvent)=>{if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(event.key.toLowerCase())){event.preventDefault();keys.add(event.key.toLowerCase());manual();}};const keyup=(event:KeyboardEvent)=>keys.delete(event.key.toLowerCase());
    renderer.domElement.addEventListener('keydown',keydown);renderer.domElement.addEventListener('keyup',keyup);renderer.domElement.addEventListener('blur',()=>keys.clear());
    let down:{x:number;y:number}|null=null;const pointerdown=(event:PointerEvent)=>{down={x:event.clientX,y:event.clientY};};
    const pointerup=(event:PointerEvent)=>{if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.params.Points.threshold=1.1;ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
      if(rt.points){const hit=ray.intersectObject(rt.points)[0];if(hit?.index!==undefined)selectRef.current(rt.pointIds[hit.index]);}else{const hit=ray.intersectObjects([...rt.planets.values()].map(p=>p.mesh))[0];if(hit)selectRef.current(hit.object.userData.objectId);}};
    renderer.domElement.addEventListener('pointerdown',pointerdown);renderer.domElement.addEventListener('pointerup',pointerup);
    const resize=()=>{const rect=element.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(element);resize();
    let frame=0;let previous=performance.now();const tick=(now:number)=>{frame=requestAnimationFrame(tick);const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!latest.current.visible)return;
      for(const item of rt.planets.values()){const next=orbitPosition(item,latest.current.epochMs);const delta=next.clone().sub(item.mesh.position);item.mesh.position.copy(next);item.mesh.rotation.y=(latest.current.epochMs/86400000+seed(item.record.object_id))*Math.PI*2;
        if(rt.follow===item.record.object_id&&!rt.focus){camera.position.add(delta);controls.target.add(delta);}if(rt.focus&&rt.selected===item.record.object_id){rt.focus.to.add(delta);rt.focus.target.add(delta);}item.last.copy(next);}
      if(rt.focus){const u=Math.min(1,(now-rt.focus.started)/1000);const eased=u*u*(3-2*u);camera.position.lerpVectors(rt.focus.from,rt.focus.to,eased);controls.target.lerpVectors(rt.focus.fromTarget,rt.focus.target,eased);if(u===1){rt.focus=null;rt.follow=rt.selected;}}
      if(keys.size){const forward=camera.getWorldDirection(new THREE.Vector3());const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();const motion=new THREE.Vector3();const speed=Math.max(1,camera.position.distanceTo(controls.target)*.7)*dt;if(keys.has('w')||keys.has('arrowup'))motion.add(forward);if(keys.has('s')||keys.has('arrowdown'))motion.sub(forward);if(keys.has('d')||keys.has('arrowright'))motion.add(right);if(keys.has('a')||keys.has('arrowleft'))motion.sub(right);if(keys.has('e'))motion.y++;if(keys.has('q'))motion.y--;if(motion.lengthSq()>0){motion.normalize().multiplyScalar(speed);camera.position.add(motion);controls.target.add(motion);}}
      controls.update();renderer.render(scene,camera);element.dataset.selectedObject=rt.selected??'';element.dataset.modelEpoch=new Date(latest.current.epochMs).toISOString();element.dataset.surfaceStatus=rt.selected?'unresolved_illustration':'catalog_direction_layer';
      for(const [id,label]of rt.labels){const item=rt.planets.get(id)!;const p=item.mesh.position.clone().project(camera);label.style.display=p.z<1&&Math.abs(p.x)<1.2&&Math.abs(p.y)<1.2?'block':'none';label.style.left=`${(p.x+1)*.5*element.clientWidth}px`;label.style.top=`${(1-p.y)*.5*element.clientHeight}px`;label.setAttribute('aria-pressed',String(rt.selected===id));}
    };frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();release(group);renderer.dispose();renderer.domElement.remove();rt.labels.forEach(label=>label.remove());runtime.current=null;};
  // The scene survives catalog, selection, locale and model-time updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    const rt=runtime.current;const element=host.current;if(!rt||!element||!catalog.data)return;
    if(selected&&!detailValue)return;
    release(rt.group);rt.group.clear();rt.planets.clear();rt.labels.forEach(label=>label.remove());rt.labels.clear();rt.points=null;rt.focus=null;rt.follow=null;rt.selected=selected;
    if(!selected){const hosts=new Set<string>();const points:number[]=[];rt.pointIds=[];for(const row of catalog.data.objects){if(row.ra_deg===null||row.dec_deg===null||hosts.has(row.hostname))continue;hosts.add(row.hostname);const ra=row.ra_deg*Math.PI/180,dec=row.dec_deg*Math.PI/180;points.push(90*Math.cos(dec)*Math.cos(ra),90*Math.sin(dec),-90*Math.cos(dec)*Math.sin(ra));rt.pointIds.push(row.object_id);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));rt.points=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#9bbdeb',size:.35,sizeAttenuation:true,transparent:true,opacity:.9}));rt.group.add(rt.points);rt.camera.position.set(0,55,120);rt.controls.target.set(0,0,0);return;}
    if(!detailValue)return;
    const star=new THREE.Mesh(new THREE.SphereGeometry(.75,48,32),new THREE.MeshBasicMaterial({color:'#ffe4ac'}));rt.group.add(star);
    const planets=[...detailValue.system_planets].sort((a,b)=>(a.semimajor_axis_au??Infinity)-(b.semimajor_axis_au??Infinity));
    let previousOrbit=0;let previousRadius=.75;
    planets.forEach((record,index)=>{const radius=.22+.27*Math.log1p(Math.max(0,record.radius_earth??1));const geometry=new THREE.SphereGeometry(radius,80,56);const summary=catalog.data!.objects.find(row=>row.object_id===record.object_id);const mesh=new THREE.Mesh(geometry,material(summary?.appearance_class??'Unknown',record.object_id));mesh.userData.objectId=record.object_id;rt.group.add(mesh);
      const sourceEccentricity=record.eccentricity;const displayEccentricity=typeof sourceEccentricity==='number'&&sourceEccentricity>=0&&sourceEccentricity<.98?sourceEccentricity:0;
      const proposed=record.semimajor_axis_au&&record.semimajor_axis_au>0?3+6*Math.log1p(record.semimajor_axis_au):4+index*3;
      // Explicit display spacing prevents enlarged bodies from intersecting.
      // These renderer distances are never exported as physical orbital values.
      const orbitRadius=Math.max(proposed,previousOrbit+2.5*(previousRadius+radius)+.8,(1.35+radius)/(1-displayEccentricity));previousOrbit=orbitRadius;previousRadius=radius;
      const item:PlanetMesh={mesh,record,radius,phase:seed(record.object_id)*Math.PI*2,orbitRadius,last:new THREE.Vector3()};mesh.position.copy(orbitPosition(item,latest.current.epochMs));item.last.copy(mesh.position);rt.planets.set(record.object_id,item);
      const vertices:THREE.Vector3[]=[];const eccentricity=record.eccentricity;const e=typeof eccentricity==='number'&&eccentricity>=0&&eccentricity<.98?eccentricity:0;for(let i=0;i<=160;i++){const angle=i/160*Math.PI*2;vertices.push(new THREE.Vector3(orbitRadius*(Math.cos(angle)-e),0,orbitRadius*Math.sqrt(1-e*e)*Math.sin(angle)));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:'#6a85a9',transparent:true,opacity:.25}));rt.group.add(line);
      const label=document.createElement('button');label.className=styles.planetLabel;label.textContent=record.name;label.dataset.testid=`exo-label-${record.object_id}`;label.onclick=()=>selectRef.current(record.object_id);element.appendChild(label);rt.labels.set(record.object_id,label);});
    const item=rt.planets.get(selected);if(item){const target=item.mesh.position.clone();const direction=rt.camera.position.clone().sub(rt.controls.target).normalize();if(direction.lengthSq()===0)direction.set(0,.3,1);direction.set(direction.x*.45,(Math.sign(direction.y)||1)*.85,direction.z*.45).normalize();rt.focus={from:rt.camera.position.clone(),fromTarget:rt.controls.target.clone(),to:target.clone().addScaledVector(direction,Math.max(2.2,item.radius*5.5)),target,started:window.matchMedia('(prefers-reduced-motion: reduce)').matches?performance.now()-1000:performance.now()};}
  },[catalog.data,detailValue,selected,skySequence]);

  const source=detailValue?.parameters.nasa;const values=detailValue?.parameters;
  return <section className={styles.explorer} hidden={!visible} data-testid="exoplanet-explorer" aria-label={t('exoTitle')}>
    <div ref={host} className={styles.canvas} data-testid="exoplanet-scene"/>
    <aside className={styles.catalog}><small>NASA · {t('exoCatalog')}</small><h1>{t('exoTitle')}</h1><p>{catalog.data?t('exoCount',{count:catalog.data.planet_count,hosts:catalog.data.host_count}):t('loading')}</p><label htmlFor="exo-search">{t('findObject')}</label><input id="exo-search" type="search" value={search} placeholder="TRAPPIST-1, Proxima, WASP-4…" onChange={event=>{setSearch(event.target.value);setPage(0);}}/>
      <div className={styles.list} role="listbox" aria-label={t('exoCatalog')}>{rows.map(row=><button key={row.object_id} role="option" aria-selected={selected===row.object_id} data-testid={`catalog-${row.object_id}`} onClick={()=>setSelected(row.object_id)}><strong>{row.name}</strong><span>{row.appearance_class} · {row.hostname}</span></button>)}</div>
      <div className={styles.pagination}><button disabled={page===0} onClick={()=>setPage(v=>v-1)} aria-label={t('exoPrevious')}>←</button><span>{filtered.length?(page*70+1).toLocaleString():0}–{Math.min((page+1)*70,filtered.length).toLocaleString()} / {filtered.length.toLocaleString()}</span><button disabled={(page+1)*70>=filtered.length} onClick={()=>setPage(v=>v+1)} aria-label={t('exoNext')}>→</button></div>
      <button onClick={()=>{setSelected(null);setSkySequence(v=>v+1);}}>{t('exoSky')}</button><button onClick={onClose}>{t('exoReturnSolar')}</button>
    </aside>
    {detailValue&&<aside className={styles.detail} data-testid="exoplanet-detail"><small>{t('exoIllustration')}</small><h2>{detailValue.name}</h2><p>{source?.description}</p><dl><div><dt>{t('exoHost')}</dt><dd>{detailValue.hostname}</dd></div><div><dt>{t('exoRadius')}</dt><dd>{source?.radius_display??'—'}</dd></div><div><dt>{t('exoMass')}</dt><dd>{source?.mass_display??'—'}</dd></div><div><dt>{t('exoPeriod')}</dt><dd>{numeric(values?.pl_orbper)?.toLocaleString(undefined,{maximumSignificantDigits:12})??'—'} d</dd></div><div><dt>{t('exoSemimajor')}</dt><dd>{numeric(values?.pl_orbsmax)?.toLocaleString(undefined,{maximumSignificantDigits:12})??'—'} au</dd></div><div><dt>{t('exoDiscovery')}</dt><dd>{String(values?.disc_year??'—')} · {String(values?.discoverymethod??'—')}</dd></div></dl><p className={styles.note}>{t('exoSurfaceNote')}</p><p className={styles.note}>{t('exoOrbitNote')}</p><a href={source?.url??detailValue.source_url} target="_blank" rel="noreferrer">{t('source')} · NASA ↗</a><a href={`https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(detailValue.name)}`} target="_blank" rel="noreferrer">{t('exoPapers')} ↗</a><details><summary>{t('displayAssumptions')}</summary><p>{t('exoScaleNote')}</p><p>{detailValue.retrieved_utc}</p>{detailValue.limitations.map(note=><p key={note}>{note}</p>)}</details></aside>}
    {!selected&&<div className={styles.skyNote}><h2>{t('exoSky')}</h2><p>{t('exoSkyNote')}</p></div>}
    {(catalog.isError||detail.isError||error)&&<div className={styles.error} role="alert">{t('exoLoadError')}<button onClick={()=>{if(catalog.isError)void catalog.refetch();if(detail.isError)void detail.refetch();}}>{t('retry')}</button></div>}
    {detail.isFetching&&<div className={styles.loading} role="status">{t('loading')}</div>}
    <div className={styles.caption}>{t('universeControls')} · {t('exoIllustration')}</div>
  </section>;
}
