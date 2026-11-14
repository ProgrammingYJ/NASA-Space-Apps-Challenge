import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {displayDirection, displayPosition, displayRadius, displayOrbitPoints, makeFocus, sampleFocus, validCamera, type CameraState, type FocusTransition, type Vec3} from './sceneMath';
import styles from './UniverseScene.module.css';

export type {CameraState} from './sceneMath';
export interface OrbitGuide {
  kind:'osculating_kepler_guide';
  epoch:string;
  points_au:Vec3[];
  source:{url:string;label?:string;sha256?:string;response_sha256?:string};
  epoch_tdb_jd?:number;
  closed?:boolean;
  center?:string;
  coordinate_frame?:string;
  units?:string;
  elements?:{a_au:number;e:number;inclination_deg:number;node_deg:number;argument_periapsis_deg:number;true_anomaly_deg:number};
  limitations?:string[];
}
export interface UniverseBody {
  object_id: string;
  name: string;
  kind: 'solar_system' | 'direction';
  position_au?: Vec3;
  radius_km?: number;
  direction_ecliptic?: Vec3;
  direction_ecliptic_unit?: Vec3;
  direction_icrs_deg?: {ra:number;dec:number};
  distance_au?: number | null;
  color?: string;
  body_class?: string;
  source?: {url:string;label:string};
  radius_source?: {url:string;definition:string;uncertainty_km:number|null};
  orbit?: OrbitGuide;
}
export interface UniverseData {
  epoch: string;
  coordinate_frame: string;
  objects: UniverseBody[];
  available_epochs?: string[];
  source?: {url:string;label:string};
  limitations?: string[];
}
export interface UniverseSceneProps {
  data: UniverseData | null;
  selectedObjectId: string | null;
  selectionSequence?: number;
  overviewSequence?: number;
  showOrbits?: boolean;
  onSelect: (objectId:string) => void;
  onCameraChange?: (camera:CameraState) => void;
  restoredCamera?: CameraState | null;
  restoreSequence?: number;
  labels?: Record<string,string>;
  controlsLabel?: string;
  representationLabel?: string;
  directionLabel?: string;
  errorLabel?: string;
  onError?: (message:string) => void;
}

interface BodyView {body:UniverseBody;group:THREE.Group;radius:number;position:THREE.Vector3;direction:THREE.Vector3|null;label:HTMLButtonElement}
interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  bodies: Map<string,BodyView>;
  orbits: Map<string,THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>>;
  focus: FocusTransition | null;
  mode: 'overview' | 'focusing' | 'focused' | 'manual' | 'restored';
  focusedId: string | null;
  lastEmit: number;
  disposed: boolean;
  animationId: number;
  applyCamera: (value:CameraState) => void;
  cameraState: () => CameraState;
  emit: () => void;
}

const COLORS: Record<string,string> = {sun:'#ffd283',mercury:'#a8a096',venus:'#e7bd85',earth:'#5a9bd7',mars:'#bd6e4e',jupiter:'#c6a38a',saturn:'#d9c191',uranus:'#8dcbcf',neptune:'#4e72b9',pluto:'#bca18d'};
const INITIAL:CameraState = {position:[0,95,150],target:[0,0,0],representation_version:'solar-display-v1'};

function disposeObject(object:THREE.Object3D) {
  object.traverse(child => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line || child instanceof THREE.Sprite) {
      if ('geometry' in child) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
        material.dispose();
      });
    }
  });
}

function makeGlow(color:string, size:number):THREE.Sprite {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,color);gradient.addColorStop(.17,color);gradient.addColorStop(.4,'rgba(245,157,69,0.12)');gradient.addColorStop(1,'rgba(245,157,69,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));
  sprite.scale.set(size,size,1);return sprite;
}

function addDecorativeStars(scene:THREE.Scene) {
  // This deterministic field is illustrative scenery, not an astronomical catalog.
  let seed=918273;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const vertices:number[]=[];
  for(let i=0;i<1400;i++){
    const z=2*random()-1;const angle=random()*Math.PI*2;const circle=Math.sqrt(1-z*z);const radius=1000+random()*1500;
    vertices.push(circle*Math.cos(angle)*radius,z*radius,circle*Math.sin(angle)*radius);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:'#adbed8',size:1.05,sizeAttenuation:false,transparent:true,opacity:.48,depthWrite:false})));
}

export default function UniverseScene(props:UniverseSceneProps) {
  const host=useRef<HTMLDivElement>(null);
  const labelsLayer=useRef<HTMLDivElement>(null);
  const runtime=useRef<Runtime|null>(null);
  const latest=useRef(props);latest.current=props;
  const appliedRestore=useRef<{sequence:number;selectionSequence:number;objectId:string|null}|null>(null);
  const appliedOverview=useRef(0);
  const [error,setError]=useState(false);

  useEffect(()=>{
    const container=host.current;if(!container)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}
    catch(e){setError(true);latest.current.onError?.(e instanceof Error?e.message:'webgl_unavailable');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));renderer.setSize(container.clientWidth,container.clientHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    renderer.setClearColor('#040810',1);
    renderer.domElement.className=styles.canvas;renderer.domElement.dataset.testid='universe-canvas';renderer.domElement.tabIndex=0;
    renderer.domElement.setAttribute('role','application');renderer.domElement.setAttribute('aria-label',latest.current.controlsLabel??'3D universe: drag to rotate, wheel to zoom, right drag to pan; W A S D or arrow keys to move.');
    container.prepend(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.AmbientLight('#a1b7d8',.18));scene.add(new THREE.PointLight('#ffe5bd',480,0,2));
    // Artistic fill makes the exaggerated globes legible; this is not a radiative model.
    scene.add(new THREE.HemisphereLight('#dce8fa','#101827',.85));
    const fill=new THREE.DirectionalLight('#fff2df',1.8);fill.position.set(-35,45,70);scene.add(fill);
    addDecorativeStars(scene);
    const camera=new THREE.PerspectiveCamera(48,container.clientWidth/Math.max(1,container.clientHeight),.025,6000);camera.position.fromArray(INITIAL.position);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.fromArray(INITIAL.target);controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.65;controls.zoomSpeed=.85;controls.panSpeed=.7;controls.minDistance=.2;controls.maxDistance=1100;controls.screenSpacePanning=true;controls.update();
    const rt:Runtime={renderer,scene,camera,controls,bodies:new Map(),orbits:new Map(),focus:null,mode:'overview',focusedId:null,lastEmit:0,disposed:false,animationId:0,
      cameraState:()=>({position:camera.position.toArray() as Vec3,target:controls.target.toArray() as Vec3,representation_version:'solar-display-v1'}),
      applyCamera:value=>{camera.position.fromArray(value.position);controls.target.fromArray(value.target);controls.update();},
      emit:()=>{latest.current.onCameraChange?.(rt.cameraState());container.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(5)).join(',');container.dataset.cameraTarget=controls.target.toArray().map(n=>n.toFixed(5)).join(',');container.dataset.cameraMode=rt.mode;container.dataset.focusedObject=rt.focusedId??'';},
    };
    runtime.current=rt;
    const cancelFocus=()=>{rt.focus=null;rt.mode='manual';rt.focusedId=null;controls.enableDamping=true;rt.emit();};
    const onControlChange=()=>{if(performance.now()-rt.lastEmit>150){rt.lastEmit=performance.now();rt.emit();}};
    controls.addEventListener('start',cancelFocus);controls.addEventListener('change',onControlChange);controls.addEventListener('end',rt.emit);
    const keys=new Set<string>();const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
    const onKeyDown=(event:KeyboardEvent)=>{if(document.activeElement!==renderer.domElement||!movementKeys.has(event.code))return;event.preventDefault();cancelFocus();keys.add(event.code);};
    const onKeyUp=(event:KeyboardEvent)=>{if(keys.delete(event.code))rt.emit();};
    const onBlur=()=>{keys.clear();rt.emit();};
    window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);window.addEventListener('blur',onBlur);
    let pointer:{x:number;y:number;id:number}|null=null;
    const pointerDown=(event:PointerEvent)=>{pointer={x:event.clientX,y:event.clientY,id:event.pointerId};renderer.domElement.focus({preventScroll:true});cancelFocus();};
    const pointerUp=(event:PointerEvent)=>{
      if(!pointer||event.pointerId!==pointer.id)return;
      const down=pointer;pointer=null;if(event.button!==0||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;
      const bounds=renderer.domElement.getBoundingClientRect();const position=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
      const raycaster=new THREE.Raycaster();raycaster.setFromCamera(position,camera);
      const groups=[...rt.bodies.values()].map(view=>view.group);
      const intersections=raycaster.intersectObjects(groups,true);
      const actual=intersections.find(hit=>typeof hit.object.userData.objectId==='string');
      if(actual)latest.current.onSelect(actual.object.userData.objectId as string);
    };
    const wheel=()=>cancelFocus();
    renderer.domElement.addEventListener('pointerdown',pointerDown,{capture:true});renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('wheel',wheel,{capture:true,passive:true});
    const resize=new ResizeObserver(()=>{const w=container.clientWidth;const h=container.clientHeight;if(w===0||h===0)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(container);
    let previous=performance.now();
    const forward=new THREE.Vector3();const right=new THREE.Vector3();const move=new THREE.Vector3();const projection=new THREE.Vector3();const clearance=new THREE.Vector3();
    const animate=(now:number)=>{
      if(rt.disposed)return;rt.animationId=requestAnimationFrame(animate);
      const elapsed=Math.min(.05,(now-previous)/1000);previous=now;
      if(rt.focus){const sampled=sampleFocus(rt.focus,now);camera.position.fromArray(sampled.camera.position);controls.target.fromArray(sampled.camera.target);if(sampled.done){rt.focusedId=rt.focus.objectId||null;rt.mode=rt.focus.objectId?'focused':'overview';rt.focus=null;controls.enableDamping=true;rt.emit();}}
      if(keys.size){camera.getWorldDirection(forward);right.crossVectors(forward,camera.up).normalize();move.set(0,0,0);if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))move.sub(right);if(keys.has('KeyE'))move.add(camera.up);if(keys.has('KeyQ'))move.sub(camera.up);const distance=Math.max(3,camera.position.distanceTo(controls.target));move.normalize().multiplyScalar(elapsed*distance*.6);camera.position.add(move);controls.target.add(move);}
      controls.update();
      // Keep the free camera outside the exaggerated visible surfaces.
      for(const view of rt.bodies.values()){
        if(view.direction)continue;
        clearance.copy(camera.position).sub(view.group.position);const distance=clearance.length();const minimum=view.radius*1.08;
        if(distance<minimum){if(distance<1e-8)clearance.set(0,0,1);else clearance.divideScalar(distance);clearance.multiplyScalar(minimum-distance);camera.position.add(clearance);controls.target.add(clearance);}
      }
      const w=container.clientWidth;const h=container.clientHeight;
      const occupied:{left:number;top:number;right:number;bottom:number}[]=[];
      const ordered=[...rt.bodies.entries()].sort(([a],[b])=>Number(b===latest.current.selectedObjectId)-Number(a===latest.current.selectedObjectId));
      for(const [id,view] of ordered){
        if(view.direction){view.group.position.copy(camera.position).addScaledVector(view.direction,300);view.group.quaternion.copy(camera.quaternion);}
        const world=view.group.position;projection.copy(world).project(camera);
        const visible=projection.z>-1&&projection.z<1&&projection.x>-.96&&projection.x<.96&&projection.y>-.93&&projection.y<.93;
        view.label.hidden=!visible;
        if(visible){
          const x=(projection.x+1)*w/2;const originY=(-projection.y+1)*h/2;const width=view.label.offsetWidth||90;const height=view.label.offsetHeight||28;
          let y=originY+(view.direction?-height-12:12);
          for(const offset of [0,24,-48,48,-72]){const testY=y+offset;const box={left:x-width/2-3,top:testY-3,right:x+width/2+3,bottom:testY+height+3};if(!occupied.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top)){y=testY;occupied.push(box);break;}}
          view.label.style.transform=`translate(${x}px,${y}px) translateX(-50%)`;view.label.dataset.selected=String(id===latest.current.selectedObjectId);
        }
      }
      renderer.render(scene,camera);
    };
    rt.animationId=requestAnimationFrame(animate);rt.emit();
    return()=>{
      rt.disposed=true;cancelAnimationFrame(rt.animationId);resize.disconnect();controls.dispose();
      window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);
      renderer.domElement.removeEventListener('pointerdown',pointerDown,true);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('wheel',wheel,true);
      disposeObject(scene);renderer.dispose();renderer.domElement.remove();rt.bodies.forEach(view=>view.label.remove());runtime.current=null;
    };
  },[]);

  useEffect(()=>{
    const rt=runtime.current;const layer=labelsLayer.current;if(!rt||!layer||!props.data)return;
    const retained=new Set(props.data.objects.map(body=>body.object_id));
    for(const [id,view] of rt.bodies){if(!retained.has(id)){rt.scene.remove(view.group);disposeObject(view.group);view.label.remove();rt.bodies.delete(id);}}
    for(const body of props.data.objects){
      const sourceDirection=body.direction_ecliptic??body.direction_ecliptic_unit;
      if(body.kind==='solar_system'&&!body.position_au)continue;
      if(body.kind==='direction'&&!sourceDirection)continue;
      const position=new THREE.Vector3().fromArray(body.kind==='direction'?displayDirection(sourceDirection!):displayPosition(body.position_au!));
      const radius=body.kind==='direction'?1.05:displayRadius(body.radius_km??0,body.object_id==='sun');
      let view=rt.bodies.get(body.object_id);
      if(!view){
        const group=new THREE.Group();group.name=body.object_id;
        if(body.kind==='direction'){
          const circle=new THREE.Mesh(new THREE.RingGeometry(.85,1.05,48),new THREE.MeshBasicMaterial({color:'#b9dcff',transparent:true,opacity:.8,depthTest:false,depthWrite:false}));circle.userData.objectId=body.object_id;group.add(circle);
          const dot=new THREE.Mesh(new THREE.CircleGeometry(.2,16),new THREE.MeshBasicMaterial({color:'#e4f0ff',depthTest:false,depthWrite:false}));dot.userData.objectId=body.object_id;group.add(dot);
        }else{
          const color=body.color??COLORS[body.object_id]??'#9eabbc';
          const material=body.object_id==='sun'?new THREE.MeshBasicMaterial({color:'#ffce80'}):new THREE.MeshStandardMaterial({color,roughness:.95,metalness:0,emissive:new THREE.Color(color),emissiveIntensity:.035});
          const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),material);sphere.userData.objectId=body.object_id;group.add(sphere);
          if(body.object_id==='sun')group.add(makeGlow('rgba(255,199,122,0.8)',radius*7));
        }
        const label=document.createElement('button');label.className=styles.bodyLabel;label.type='button';label.dataset.testid=`object-label-${body.object_id}`;label.addEventListener('click',event=>{event.stopPropagation();latest.current.onSelect(body.object_id);});layer.append(label);
        view={body,group,radius,position,direction:body.kind==='direction'?position.clone():null,label};rt.bodies.set(body.object_id,view);rt.scene.add(group);
      }
      view.body=body;view.position.copy(position);view.direction=body.kind==='direction'?position.clone():null;
      if(body.kind==='solar_system')view.group.position.copy(position);
      const name=props.labels?.[body.object_id]??body.name;view.label.textContent=body.kind==='direction'?`${name} · ${props.directionLabel??'direction'}`:name;view.label.setAttribute('aria-label',name);
      view.label.setAttribute('aria-pressed',String(props.selectedObjectId===body.object_id));
    }
  },[props.data,props.labels,props.directionLabel,props.selectedObjectId]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    if(props.data){
      const guides=props.data.objects.filter(body=>body.kind==='solar_system'&&body.object_id!=='sun'&&body.orbit?.kind==='osculating_kepler_guide');
      const retained=new Set(guides.map(body=>body.object_id));
      for(const [id,line] of rt.orbits){if(!retained.has(id)){rt.scene.remove(line);disposeObject(line);rt.orbits.delete(id);}}
      for(const body of guides){
        const guide=body.orbit!;let line=rt.orbits.get(body.object_id);
        if(line?.userData.pointsReference!==guide.points_au){
          const vertices=displayOrbitPoints(guide.points_au);
          if(vertices.length===0){if(line){rt.scene.remove(line);disposeObject(line);rt.orbits.delete(body.object_id);}continue;}
          const geometry=new THREE.BufferGeometry().setFromPoints(vertices.map(vertex=>new THREE.Vector3().fromArray(vertex)));
          if(line){line.geometry.dispose();line.geometry=geometry;}
          else{line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#718cad',transparent:true,opacity:.22,depthWrite:false}));line.name=`orbit-guide-${body.object_id}`;rt.orbits.set(body.object_id,line);rt.scene.add(line);}
          line.userData.pointsReference=guide.points_au;line.userData.epoch=guide.epoch;
        }
      }
    }
    const visible=props.showOrbits!==false;
    for(const [id,line] of rt.orbits){line.visible=visible;line.material.opacity=id===props.selectedObjectId ? .58 : .22;line.material.color.set(id===props.selectedObjectId?'#b3ccec':'#718cad');}
    if(host.current){host.current.dataset.orbitCount=String(visible?rt.orbits.size:0);host.current.dataset.orbitIds=visible?[...rt.orbits.keys()].join(','):'';host.current.dataset.orbitKind='osculating_kepler_guide';}
  },[props.data,props.showOrbits,props.selectedObjectId]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    const overviewSequence=props.overviewSequence??0;
    if(appliedOverview.current!==overviewSequence){appliedOverview.current=overviewSequence;rt.focus={from:rt.cameraState(),to:{...INITIAL,position:[...INITIAL.position],target:[...INITIAL.target]},startedAt:performance.now(),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000,objectId:''};rt.mode='focusing';rt.focusedId=null;rt.controls.enableDamping=false;rt.controls.minDistance=.2;rt.emit();return;}
    const restoreSequence=props.restoreSequence??0;
    if(props.restoredCamera&&validCamera(props.restoredCamera)&&appliedRestore.current?.sequence!==restoreSequence){appliedRestore.current={sequence:restoreSequence,selectionSequence:props.selectionSequence??0,objectId:props.selectedObjectId};rt.focus=null;rt.mode='restored';rt.focusedId=props.selectedObjectId;rt.controls.enableDamping=false;rt.controls.minDistance=.05;rt.applyCamera(props.restoredCamera);rt.controls.enableDamping=true;rt.emit();return;}
    if(props.restoredCamera&&appliedRestore.current?.sequence===restoreSequence&&appliedRestore.current.selectionSequence===(props.selectionSequence??0)&&appliedRestore.current.objectId===props.selectedObjectId)return;
    const view=props.selectedObjectId?rt.bodies.get(props.selectedObjectId):null;if(!view){if(rt.focus?.objectId||rt.focusedId){rt.focus=null;rt.mode='manual';rt.focusedId=null;rt.controls.enableDamping=true;rt.emit();}return;}
    rt.controls.enableDamping=false;rt.controls.update();
    const current=rt.cameraState();const center=view.direction?(view.body.direction_ecliptic??view.body.direction_ecliptic_unit)!:view.position.toArray() as Vec3;
    rt.focus=makeFocus(current,view.body.object_id,center,view.radius,rt.camera.fov,rt.camera.aspect,performance.now(),window.matchMedia('(prefers-reduced-motion: reduce)').matches,Boolean(view.direction));
    rt.focusedId=view.body.object_id;rt.mode='focusing';rt.controls.minDistance=view.direction?0.2:view.radius*1.2;rt.emit();
  },[props.data,props.selectedObjectId,props.selectionSequence,props.overviewSequence,props.restoredCamera,props.restoreSequence]);

  useEffect(()=>{runtime.current?.renderer.domElement.setAttribute('aria-label',props.controlsLabel??'3D universe');},[props.controlsLabel]);

  return <div ref={host} className={styles.scene} data-testid="universe-scene" data-selected-object={props.selectedObjectId??''}>
    <div ref={labelsLayer} className={styles.labels} aria-label={props.controlsLabel}/>
    <div className={styles.representation}>{props.representationLabel??'Distance compressed · radii enlarged · artistic appearance · illustrative starfield'}</div>
    {error&&<div className={styles.error} role="alert"><p>{props.errorLabel??'3D rendering is unavailable in this browser.'}</p><div>{props.data?.objects.map(body=><button key={body.object_id} onClick={()=>props.onSelect(body.object_id)}>{props.labels?.[body.object_id]??body.name}</button>)}</div></div>}
  </div>;
}
