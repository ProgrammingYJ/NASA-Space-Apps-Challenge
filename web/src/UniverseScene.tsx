import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {displayDirection, displayRadius, displayMoonRadius, displayOrbitPoints, displayMoonOffset, bodyDisplayPositions, advanceNavigationForBody, makeFocus, makeGalaxyFocus, sampleFocus, validCamera, type CameraState, type FocusTransition, type Vec3} from './sceneMath';
import {createBodyAppearance,scaledRingBands,type AppearanceManifest,type AppearanceStatus,type AppearanceEntry,type RingEntry,type BodyAppearance} from './planetAppearance';
import {createKuiperIllustration,galaxyPositionAu,icrsToEclipticUnit,type GalaxyData,type GalaxyObject} from './universeLayers';
import {createGalaxyAppearance,galaxyDisplayProfile} from './galaxyAppearance';
import {smallBodyAxes,smallBodyRingRadii} from './smallBodyAppearance';
import {CATALOG_SKY_RADIUS,CATALOG_SKY_FRAME_STATUS,type CatalogSkyStar} from './catalogSky';
import styles from './UniverseScene.module.css';

export type {CameraState} from './sceneMath';
export type {GalaxyData,GalaxyObject} from './universeLayers';
export interface OrbitGuide {
  kind:'osculating_kepler_guide'|'sampled_ephemeris_trace'|'fitted_kepler_simulation_guide';
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
  kind: 'solar_system' | 'direction'|'moon'|'dwarf_planet'|'dwarf_candidate'|'galaxy';
  parent_id?:string;
  parent_relative_position_au?:Vec3;
  position_au?: Vec3;
  radius_km?: number|null;
  direction_ecliptic?: Vec3;
  direction_ecliptic_unit?: Vec3;
  direction_icrs_deg?: {ra:number;dec:number};
  distance_au?: number | null;
  color?: string;
  body_class?: string;
  position_kind?:string;
  source?: {url:string;label:string};
  radius_source?: {url:string;definition:string;uncertainty_km:number|null};
  orbit?: OrbitGuide;
  galaxy_morphology?:GalaxyObject['morphology'];
  galaxy_appearance?:GalaxyObject['appearance'];
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
  active?:boolean;
  observerMode?:boolean;
  data: UniverseData | null;
  selectedObjectId: string | null;
  selectionSequence?: number;
  overviewSequence?: number;
  showOrbits?: boolean;
  showKuiperBelt?:boolean;
  galaxies?:GalaxyData|null;
  skyStars?:CatalogSkyStar[];
  skySourceUrl?:string;
  skySourceSha256?:string;
  skyNote?:string;
  appearance?:AppearanceManifest|null;
  onAppearanceStatus?:(status:AppearanceStatus)=>void;
  frameSelectedSystem?:boolean;
  onSelect: (objectId:string) => void;
  onCameraChange?: (camera:CameraState) => void;
  onFollowChange?: (objectId:string|null) => void;
  restoredCamera?: CameraState | null;
  restoredFollowObjectId?:string|null;
  restoreSequence?: number;
  labels?: Record<string,string>;
  controlsLabel?: string;
  representationLabel?: string;
  directionLabel?: string;
  errorLabel?: string;
  onError?: (message:string) => void;
}

interface BodyView {body:UniverseBody;group:THREE.Group;radius:number;framingRadius:number;position:THREE.Vector3;direction:THREE.Vector3|null;label:HTMLButtonElement;appearance:BodyAppearance|null;appearanceEntry:AppearanceEntry|undefined;ringEntry:RingEntry|undefined;fallback:THREE.Mesh|null}
interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  bodies: Map<string,BodyView>;
  orbits: Map<string,THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>>;
  kuiper:THREE.Group;
  skyStars:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  focus: FocusTransition | null;
  mode: 'overview' | 'focusing' | 'focused' | 'manual' | 'restored';
  focusedId: string | null;
  followedId: string | null;
  focusRequest: {objectId:string|null;sequence:number;system:boolean}|null;
  restoredRequest:{sequence:number;selectionSequence:number;objectId:string|null}|null;
  lastFollowEmitted:string|null|undefined;
  motionTick:number;
  lastEmit: number;
  disposed: boolean;
  animationId: number;
  pausedAt:number|null;
  resume:()=>void;
  applyCamera: (value:CameraState) => void;
  cameraState: () => CameraState;
  emit: () => void;
}

const COLORS: Record<string,string> = {sun:'#ffd283',mercury:'#a8a096',venus:'#e7bd85',earth:'#5a9bd7',mars:'#bd6e4e',jupiter:'#c6a38a',saturn:'#d9c191',uranus:'#8dcbcf',neptune:'#4e72b9',pluto:'#bca18d'};
const INITIAL:CameraState = {position:[0,95,150],target:[0,0,0],representation_version:'solar-display-v1'};

const directionOnlyBody=(body:UniverseBody)=>body.kind==='direction'||(body.kind==='galaxy'&&!body.position_au);

function galaxyBodies(data:GalaxyData|null|undefined):UniverseBody[] {
  return (data?.objects??[]).flatMap(galaxy=>{
    const direction=icrsToEclipticUnit(galaxy.direction_icrs_deg.ra,galaxy.direction_icrs_deg.dec);if(!direction)return [];
    const position=galaxyPositionAu(galaxy);
    return [{object_id:galaxy.object_id,name:galaxy.name,kind:'galaxy' as const,direction_icrs_deg:galaxy.direction_icrs_deg,direction_ecliptic:direction,position_au:position??undefined,distance_au:position?Math.hypot(...position):null,galaxy_morphology:galaxy.morphology,galaxy_appearance:galaxy.appearance,source:galaxy.source,position_kind:position?'catalog_direction_distance_estimate':'catalog_direction_unknown_distance'}];
  });
}

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

function createCatalogSky() {
  // Uniform marker styling and sphere radius are display choices, not measured
  // stellar brightness, physical depth, or a substitute for a missing catalogue.
  const stars=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:'#adbed8',size:1.05,sizeAttenuation:false,transparent:true,opacity:.48,depthWrite:false}));
  stars.name='nasa-catalog-host-directions';stars.userData.representation='catalog_host_directions';
  stars.frustumCulled=false;stars.raycast=()=>{};
  return stars;
}

export default function UniverseScene(props:UniverseSceneProps) {
  const host=useRef<HTMLDivElement>(null);
  const labelsLayer=useRef<HTMLDivElement>(null);
  const runtime=useRef<Runtime|null>(null);
  const latest=useRef(props);latest.current=props;
  const sceneObjects=useMemo(()=>[...(props.data?.objects??[]),...galaxyBodies(props.galaxies)],[props.data,props.galaxies]);
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
    const skyStars=createCatalogSky();scene.add(skyStars);
    const kuiper=createKuiperIllustration();kuiper.visible=latest.current.showKuiperBelt!==false;scene.add(kuiper);
    const camera=new THREE.PerspectiveCamera(48,container.clientWidth/Math.max(1,container.clientHeight),.025,6000);camera.position.fromArray(INITIAL.position);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.fromArray(INITIAL.target);controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.65;controls.zoomSpeed=.85;controls.panSpeed=.7;controls.minDistance=.2;controls.maxDistance=1100;controls.screenSpacePanning=true;controls.update();
    const rt:Runtime={renderer,scene,camera,controls,bodies:new Map(),orbits:new Map(),kuiper,skyStars,focus:null,mode:'overview',focusedId:null,followedId:null,focusRequest:null,restoredRequest:null,lastFollowEmitted:undefined,motionTick:0,lastEmit:0,disposed:false,animationId:0,pausedAt:null,resume:()=>{},
      cameraState:()=>({position:camera.position.toArray() as Vec3,target:controls.target.toArray() as Vec3,representation_version:'solar-display-v1'}),
      applyCamera:value=>{camera.position.fromArray(value.position);controls.target.fromArray(value.target);controls.update();},
      emit:()=>{latest.current.onCameraChange?.(rt.cameraState());if(rt.lastFollowEmitted!==rt.followedId){rt.lastFollowEmitted=rt.followedId;latest.current.onFollowChange?.(rt.followedId);}container.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(5)).join(',');container.dataset.cameraTarget=controls.target.toArray().map(n=>n.toFixed(5)).join(',');container.dataset.controlsMinDistance=String(controls.minDistance);container.dataset.cameraMode=rt.mode;container.dataset.focusedObject=rt.focusedId??'';container.dataset.followObject=rt.followedId??'';container.dataset.focusStartedAt=rt.focus?String(rt.focus.startedAt):'';},
    };
    runtime.current=rt;
    const cancelFocus=()=>{rt.focus=null;rt.mode='manual';rt.focusedId=null;rt.followedId=null;controls.enableDamping=true;rt.emit();};
    const onControlChange=()=>{if(performance.now()-rt.lastEmit>150){rt.lastEmit=performance.now();rt.emit();}};
    controls.addEventListener('start',cancelFocus);controls.addEventListener('change',onControlChange);controls.addEventListener('end',rt.emit);
    const keys=new Set<string>();const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
    const onKeyDown=(event:KeyboardEvent)=>{if(latest.current.active===false||document.activeElement!==renderer.domElement||!movementKeys.has(event.code))return;event.preventDefault();cancelFocus();keys.add(event.code);};
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
    const forward=new THREE.Vector3();const right=new THREE.Vector3();const move=new THREE.Vector3();const projection=new THREE.Vector3();const clearance=new THREE.Vector3();const sunlight=new THREE.Vector3();const previousEye=camera.position.clone();
    const animate=(now:number)=>{
      if(rt.disposed)return;if(latest.current.active===false){rt.animationId=0;rt.pausedAt=now;keys.clear();return;}rt.animationId=requestAnimationFrame(animate);
      const elapsed=Math.min(.05,(now-previous)/1000);previous=now;
      if(rt.focus){const sampled=sampleFocus(rt.focus,now);camera.position.fromArray(sampled.camera.position);controls.target.fromArray(sampled.camera.target);if(sampled.done){rt.focusedId=rt.focus.objectId||null;rt.followedId=rt.focus.objectId||null;rt.mode=rt.focus.objectId?'focused':'overview';rt.focus=null;controls.enableDamping=true;rt.emit();}}
      if(keys.size){camera.getWorldDirection(forward);right.crossVectors(forward,camera.up).normalize();move.set(0,0,0);if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))move.sub(right);if(keys.has('KeyE'))move.add(camera.up);if(keys.has('KeyQ'))move.sub(camera.up);const distance=Math.max(3,camera.position.distanceTo(controls.target));move.normalize().multiplyScalar(elapsed*distance*.6);camera.position.add(move);controls.target.add(move);}
      controls.update();
      // Keep the free camera outside the exaggerated visible surfaces.
      for(const view of rt.bodies.values()){
        if(latest.current.observerMode||view.direction)continue;
        if(rt.mode==='manual'&&camera.position.distanceToSquared(previousEye)<1e-12)continue;
        clearance.copy(camera.position).sub(view.group.position);const distance=clearance.length();const minimum=view.radius*1.08;
        if(distance<minimum){if(distance<1e-8)clearance.set(0,0,1);else clearance.divideScalar(distance);clearance.multiplyScalar(minimum-distance);camera.position.add(clearance);controls.target.add(clearance);}
      }
      previousEye.copy(camera.position);
      const w=container.clientWidth;const h=container.clientHeight;
      const epochMs=Date.parse(latest.current.data?.epoch??'2026-11-14T00:00:00Z');
      const selectedBody=latest.current.selectedObjectId?rt.bodies.get(latest.current.selectedObjectId)?.body:null;const selectedParent=selectedBody?.kind==='moon'?selectedBody.parent_id:latest.current.selectedObjectId;
      const occupied:{left:number;top:number;right:number;bottom:number}[]=[];
      const ordered=[...rt.bodies.entries()].sort(([a],[b])=>Number(b===latest.current.selectedObjectId)-Number(a===latest.current.selectedObjectId));
      for(const [id,view] of ordered){
        if(view.appearance&&view.body.position_au){const p=view.body.position_au;sunlight.set(-p[0],-p[2],p[1]).normalize();view.appearance.update(epochMs,sunlight);}
        if(view.direction){view.group.position.copy(camera.position).addScaledVector(view.direction,300);view.group.quaternion.copy(camera.quaternion);}
        const world=view.group.position;projection.copy(world).project(camera);
        const lodVisible=view.body.kind!=='moon'||id===latest.current.selectedObjectId||(view.body.parent_id===selectedParent&&view.label.dataset.majorMoon==='true');
        const visible=lodVisible&&projection.z>-1&&projection.z<1&&projection.x>-.96&&projection.x<.96&&projection.y>-.93&&projection.y<.93;
        if(view.label.hidden===visible)view.label.hidden=!visible;
        if(visible){
          const x=(projection.x+1)*w/2;const originY=(-projection.y+1)*h/2;const width=view.label.offsetWidth||90;const height=view.label.offsetHeight||28;
          let y=originY+(view.direction?-height-12:12);
          for(const offset of [0,24,-48,48,-72]){const testY=y+offset;const box={left:x-width/2-3,top:testY-3,right:x+width/2+3,bottom:testY+height+3};if(!occupied.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top)){y=testY;occupied.push(box);break;}}
          view.label.style.transform=`translate(${x}px,${y}px) translateX(-50%)`;view.label.dataset.selected=String(id===latest.current.selectedObjectId);
        }
      }
      // Translate the reference sphere with the eye, retaining fixed sky
      // directions when the free camera pans; never create a stellar parallax.
      if(!skyStars.position.equals(camera.position)||!container.dataset.skyCenter){skyStars.position.copy(camera.position);container.dataset.skyCenter=camera.position.toArray().map(n=>n.toFixed(5)).join(',');}
      renderer.render(scene,camera);
    };
    rt.resume=()=>{if(rt.disposed||rt.animationId!==0||latest.current.active===false)return;const now=performance.now();if(rt.pausedAt!==null&&rt.focus)rt.focus.startedAt+=now-rt.pausedAt;rt.pausedAt=null;previous=now;rt.animationId=requestAnimationFrame(animate);};
    rt.animationId=requestAnimationFrame(animate);rt.emit();
    return()=>{
      rt.disposed=true;cancelAnimationFrame(rt.animationId);resize.disconnect();controls.dispose();
      window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);
      renderer.domElement.removeEventListener('pointerdown',pointerDown,true);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('wheel',wheel,true);
      rt.bodies.forEach(view=>{if(view.appearance){view.group.remove(view.appearance.group);view.appearance.dispose();}view.label.remove();});disposeObject(scene);renderer.dispose();renderer.domElement.remove();runtime.current=null;
    };
  },[]);

  useEffect(()=>{
    const rt=runtime.current;const layer=labelsLayer.current;if(!rt||!layer)return;
    const locations=bodyDisplayPositions(sceneObjects);
    const selectedTextureBody=sceneObjects.find(body=>body.object_id===props.selectedObjectId);const selectedTextureParent=selectedTextureBody?.kind==='moon'?selectedTextureBody.parent_id:null;
    const retained=new Set(sceneObjects.filter(body=>directionOnlyBody(body)?(body.direction_ecliptic??body.direction_ecliptic_unit):locations.has(body.object_id)).map(body=>body.object_id));
    for(const [id,view] of rt.bodies){if(!retained.has(id)){rt.scene.remove(view.group);if(view.appearance){view.group.remove(view.appearance.group);view.appearance.dispose();}disposeObject(view.group);view.label.remove();rt.bodies.delete(id);}}
    const majorMoons=new Set<string>();const parents=new Set(sceneObjects.filter(body=>body.kind==='moon').map(body=>body.parent_id));for(const parent of parents){sceneObjects.filter(body=>body.kind==='moon'&&body.parent_id===parent).sort((a,b)=>(b.radius_km??0)-(a.radius_km??0)).slice(0,12).forEach(body=>majorMoons.add(body.object_id));}
    for(const body of sceneObjects){
      const sourceDirection=body.direction_ecliptic??body.direction_ecliptic_unit;
      const directionOnly=directionOnlyBody(body);
      if(!directionOnly&&!locations.has(body.object_id))continue;
      if(directionOnly&&!sourceDirection)continue;
      const position=new THREE.Vector3().fromArray(directionOnly?displayDirection(sourceDirection!):locations.get(body.object_id)!);
      const sourceAppearance=props.appearance?.objects[body.object_id];const displayReferenceRadius=sourceAppearance?.physical_profile?.reference_radius_km??body.radius_km??0;
      const galaxyInput=body.kind==='galaxy'?{object_id:body.object_id,morphology:body.galaxy_morphology,appearance:body.galaxy_appearance,direction_icrs_deg:body.direction_icrs_deg!}:null;
      const profile=galaxyInput?galaxyDisplayProfile(galaxyInput):null;
      const radius=directionOnly?1.05:profile?profile.radius:body.kind==='moon'?displayMoonRadius(body.radius_km??null):displayRadius(displayReferenceRadius,body.object_id==='sun');
      let view=rt.bodies.get(body.object_id);
      if(view&&(rt.focus?.objectId===body.object_id||rt.followedId===body.object_id)){
        const updated=advanceNavigationForBody({camera:rt.cameraState(),transition:rt.focus,followedObjectId:rt.followedId},body.object_id,view.position.toArray() as Vec3,position.toArray() as Vec3,directionOnly);
        rt.focus=updated.transition;
        if(updated.camera.position!==undefined){rt.camera.position.fromArray(updated.camera.position);rt.controls.target.fromArray(updated.camera.target);}
        rt.emit();
      }
      if(!view){
        const group=new THREE.Group();group.name=body.object_id;
        if(directionOnly){
          const circle=new THREE.Mesh(new THREE.RingGeometry(.85,1.05,48),new THREE.MeshBasicMaterial({color:'#b9dcff',transparent:true,opacity:.8,depthTest:false,depthWrite:false}));circle.userData.objectId=body.object_id;group.add(circle);
          const dot=new THREE.Mesh(new THREE.CircleGeometry(.2,16),new THREE.MeshBasicMaterial({color:'#e4f0ff',depthTest:false,depthWrite:false}));dot.userData.objectId=body.object_id;group.add(dot);
        }else if(body.kind!=='galaxy'){
          const color=body.color??COLORS[body.object_id]??'#9eabbc';
          const material=body.object_id==='sun'?new THREE.MeshBasicMaterial({color:'#ffce80'}):new THREE.MeshStandardMaterial({color,roughness:.95,metalness:0,emissive:new THREE.Color(color),emissiveIntensity:.035});
          const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,body.kind==='moon'?12:48,body.kind==='moon'?8:32),material);sphere.userData.objectId=body.object_id;group.add(sphere);
          if(body.object_id==='sun')group.add(makeGlow('rgba(255,199,122,0.8)',radius*7));
        }
        const label=document.createElement('button');label.className=styles.bodyLabel;label.type='button';label.dataset.testid=`object-label-${body.object_id}`;label.addEventListener('click',event=>{event.stopPropagation();latest.current.onSelect(body.object_id);});layer.append(label);
        view={body,group,radius,framingRadius:radius,position,direction:directionOnly?position.clone():null,label,appearance:null,appearanceEntry:undefined,ringEntry:undefined,fallback:group.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh??null};rt.bodies.set(body.object_id,view);rt.scene.add(group);
      }
      if(view.radius!==radius&&view.fallback){view.fallback.geometry.dispose();view.fallback.geometry=new THREE.SphereGeometry(radius,body.kind==='moon'?12:48,body.kind==='moon'?8:32);}
      const previousFramingRadius=view.framingRadius;view.radius=radius;view.framingRadius=radius;
      if(galaxyInput&&!directionOnly){
        let shape=view.group.children.find(child=>child.userData.galaxyProfile);
        if(shape&&view.group.userData.galaxySpec!==body.galaxy_appearance){view.group.remove(shape);disposeObject(shape);shape=undefined;}
        if(!shape){view.group.add(createGalaxyAppearance(galaxyInput));view.group.userData.galaxySpec=body.galaxy_appearance;}
      }
      const appearanceEntry=body.object_id===props.selectedObjectId||body.object_id===selectedTextureParent||sourceAppearance?.physical_profile?sourceAppearance:undefined;const ringEntry=props.appearance?.rings[body.object_id];const smallProfile=appearanceEntry?.physical_profile;const physicalReference=smallProfile?.reference_radius_km??body.radius_km??0;
      const wantsAppearance=!directionOnly&&body.kind!=='galaxy'&&Boolean(props.appearance)&&(body.kind!=='moon'||body.object_id===props.selectedObjectId);
      if(view.appearance&&(!wantsAppearance||view.appearanceEntry!==appearanceEntry||view.ringEntry!==ringEntry)){view.group.remove(view.appearance.group);view.appearance.dispose();view.appearance=null;}
      if(wantsAppearance&&!view.appearance){if(view.fallback){view.group.remove(view.fallback);disposeObject(view.fallback);view.fallback=null;}const activeView=view;view.appearance=createBodyAppearance({objectId:body.object_id,displayRadius:radius,physicalRadiusKm:physicalReference,fallbackColor:body.color??COLORS[body.object_id]??'#a7a19b',appearance:appearanceEntry,rings:ringEntry,anisotropy:rt.renderer.capabilities.getMaxAnisotropy(),onStatus:status=>{activeView.label.dataset.appearanceState=status.state;activeView.label.dataset.appearanceKind=status.kind;latest.current.onAppearanceStatus?.(status);}});view.group.add(view.appearance.group);view.appearanceEntry=appearanceEntry;view.ringEntry=ringEntry;}
      if(!wantsAppearance&&!view.fallback&&!directionOnly&&body.kind!=='galaxy'){const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),new THREE.MeshStandardMaterial({color:body.color??COLORS[body.object_id]??'#9a9690',roughness:1}));mesh.userData.objectId=body.object_id;view.group.add(mesh);view.fallback=mesh;}
      const bands=scaledRingBands(ringEntry?.bands_km??[],physicalReference,radius).filter(band=>band.opacity>=.08);if(bands.length)view.framingRadius=Math.max(radius,...bands.map(band=>band.outer));
      view.framingRadius=Math.max(view.framingRadius,...smallBodyAxes(smallProfile).map(axis=>axis*radius),...smallBodyRingRadii(smallProfile,physicalReference,radius));
      if(Math.abs(previousFramingRadius-view.framingRadius)>1e-6&&props.selectedObjectId===body.object_id&&(rt.followedId===body.object_id||rt.focus?.objectId===body.object_id))rt.focusRequest=null;
      view.body=body;view.position.copy(position);view.direction=directionOnly?position.clone():null;
      if(!directionOnly)view.group.position.copy(position);
      const name=props.labels?.[body.object_id]??body.name;const text=directionOnly?`${name} · ${props.directionLabel??'direction'}`:name;if(view.label.textContent!==text)view.label.textContent=text;if(view.label.getAttribute('aria-label')!==name)view.label.setAttribute('aria-label',name);
      view.label.setAttribute('aria-pressed',String(props.selectedObjectId===body.object_id));
      view.label.tabIndex=props.active===false?-1:0;view.label.dataset.majorMoon=String(majorMoons.has(body.object_id));
      view.label.dataset.worldPosition=position.toArray().map(value=>value.toFixed(9)).join(',');
      view.label.dataset.sourcePositionAu=body.position_au?.map(value=>value.toFixed(12)).join(',')??'';
      view.label.dataset.positionKind=body.position_kind??body.kind;
      view.label.dataset.surfaceRepresentation=appearanceEntry?.texture_url?'published_map':smallProfile?'literature_constraints_unresolved':'neutral_unresolved_body';view.label.dataset.shapeAxes=smallBodyAxes(smallProfile).join(',');view.label.dataset.ringCenterRadiiKm=smallProfile?.rings.map(ring=>ring.center_radius_km).join(',')??'';view.label.dataset.profileColor=smallProfile?.color_hex??'';view.label.dataset.displayRadius=String(view.radius);view.label.dataset.framingRadius=String(view.framingRadius);view.label.dataset.physicalReferenceRadiusKm=String(physicalReference);
      const surfaceMesh=view.appearance?.surface??view.fallback;
      view.label.dataset.bodyGroupScale=view.group.scale.toArray().join(',');
      if(surfaceMesh){if(!surfaceMesh.geometry.boundingSphere)surfaceMesh.geometry.computeBoundingSphere();const geometryRadius=surfaceMesh.geometry.boundingSphere?.radius;const worldScale=surfaceMesh.getWorldScale(new THREE.Vector3());view.label.dataset.meshGeometryRadius=geometryRadius===undefined?'':String(geometryRadius);view.label.dataset.meshWorldRadius=geometryRadius===undefined?'':String(geometryRadius*Math.max(...worldScale.toArray()));view.label.dataset.surfaceMeshScale=surfaceMesh.scale.toArray().join(',');}
      if(profile){view.label.dataset.representation='source_informed_morphology_with_illustrative_detail';view.label.dataset.galaxyRenderer=profile.renderer;view.label.dataset.armCount=String(profile.modeledArms);view.label.dataset.companionCount=String(profile.companions);view.label.dataset.dustLaneCount=String(profile.dustLanes);view.label.dataset.asymmetry=String(profile.asymmetric);view.label.dataset.axisRatio=String(profile.projectedAxisRatio);view.label.dataset.inclinationDeg=String(profile.inclinationDeg);view.label.dataset.orientationAssumed=String(profile.inclinationAssumed||profile.positionAngleAssumed);}
    }
    if(props.frameSelectedSystem&&props.selectedObjectId){const parent=rt.bodies.get(props.selectedObjectId);if(parent){for(const view of rt.bodies.values()){if(view.body.kind==='moon'&&view.body.parent_id===props.selectedObjectId)parent.framingRadius=Math.max(parent.framingRadius,parent.position.distanceTo(view.position)+view.radius);}}}
    for(const view of rt.bodies.values())view.label.dataset.framingRadius=String(view.framingRadius);
    rt.motionTick++;if(host.current){host.current.dataset.modelEpoch=props.data?.epoch??'';host.current.dataset.motionTick=String(rt.motionTick);const ids=sceneObjects.filter(body=>body.kind==='galaxy'&&rt.bodies.has(body.object_id)).map(body=>body.object_id);host.current.dataset.galaxyCount=String(ids.length);host.current.dataset.galaxyIds=ids.join(',');}
  },[sceneObjects,props.data,props.labels,props.directionLabel,props.selectedObjectId,props.appearance,props.frameSelectedSystem,props.active]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    if(!props.data){for(const line of rt.orbits.values()){rt.scene.remove(line);disposeObject(line);}rt.orbits.clear();}
    if(props.data){
      const guides=props.data.objects.filter(body=>body.kind!=='direction'&&body.object_id!=='sun'&&body.orbit&&rt.bodies.has(body.object_id));
      const retained=new Set(guides.map(body=>body.object_id));
      for(const [id,line] of rt.orbits){if(!retained.has(id)){rt.scene.remove(line);disposeObject(line);rt.orbits.delete(id);}}
      for(const body of guides){
        const guide=body.orbit!;let line=rt.orbits.get(body.object_id);
        if(line?.userData.pointsReference!==guide.points_au){
          const parent=body.kind==='moon'&&body.parent_id?rt.bodies.get(body.parent_id):null;
          const vertices=body.kind==='moon'&&parent?guide.points_au.map(point=>displayMoonOffset(point,parent.body.radius_km??null,parent.radius)).filter((point):point is Vec3=>point!==null):displayOrbitPoints(guide.points_au);
          if(vertices.length===0){if(line){rt.scene.remove(line);disposeObject(line);rt.orbits.delete(body.object_id);}continue;}
          const geometry=new THREE.BufferGeometry().setFromPoints(vertices.map(vertex=>new THREE.Vector3().fromArray(vertex)));
          if(line){line.geometry.dispose();line.geometry=geometry;}
          else{line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#718cad',transparent:true,opacity:.22,depthWrite:false}));line.name=`orbit-guide-${body.object_id}`;rt.orbits.set(body.object_id,line);rt.scene.add(line);}
          line.userData.pointsReference=guide.points_au;line.userData.epoch=guide.epoch;line.userData.kind=guide.kind;line.userData.parentId=body.kind==='moon'?body.parent_id:null;
        }
        if(line&&body.kind==='moon'&&body.parent_id){const parent=rt.bodies.get(body.parent_id);if(parent)line.position.copy(parent.position);}
      }
    }
    const visible=props.showOrbits!==false;
    const selected=props.selectedObjectId?rt.bodies.get(props.selectedObjectId)?.body:null;const selectedParent=selected?.kind==='moon'?selected.parent_id:props.selectedObjectId;
    for(const [id,line] of rt.orbits){line.visible=visible&&(!line.userData.parentId||line.userData.parentId===selectedParent);line.material.opacity=id===props.selectedObjectId ? .58 : line.userData.parentId ? .055 : .22;line.material.color.set(id===props.selectedObjectId?'#b3ccec':'#718cad');}
    const visibleGuides=[...rt.orbits.entries()].filter(([,line])=>line.visible&&line.userData.kind==='osculating_kepler_guide').map(([id])=>id);const visibleTraces=[...rt.orbits.entries()].filter(([,line])=>line.visible&&line.userData.kind==='sampled_ephemeris_trace').map(([id])=>id);
    if(host.current){host.current.dataset.orbitCount=String(visibleGuides.length);host.current.dataset.orbitIds=visibleGuides.join(',');host.current.dataset.orbitKind='osculating_kepler_guide';host.current.dataset.traceCount=String(visibleTraces.length);host.current.dataset.traceIds=visibleTraces.join(',');}
  },[props.data,props.showOrbits,props.selectedObjectId]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    const sequence=props.selectionSequence??0;
    const system=props.frameSelectedSystem??false;
    const overviewSequence=props.overviewSequence??0;
    if(appliedOverview.current!==overviewSequence){appliedOverview.current=overviewSequence;rt.focusRequest={objectId:props.selectedObjectId,sequence,system};rt.followedId=null;rt.focus={from:rt.cameraState(),to:{...INITIAL,position:[...INITIAL.position],target:[...INITIAL.target]},startedAt:performance.now(),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000,objectId:''};rt.mode='focusing';rt.focusedId=null;rt.controls.enableDamping=false;rt.controls.minDistance=.2;rt.emit();return;}
    const restoreSequence=props.restoreSequence??0;
    if(props.restoredCamera&&validCamera(props.restoredCamera)&&rt.restoredRequest?.sequence!==restoreSequence){rt.restoredRequest={sequence:restoreSequence,selectionSequence:sequence,objectId:props.selectedObjectId};rt.focusRequest={objectId:props.selectedObjectId,sequence,system};rt.followedId=props.restoredFollowObjectId===props.selectedObjectId?props.selectedObjectId:null;rt.focus=null;rt.mode='restored';rt.focusedId=props.selectedObjectId;rt.controls.enableDamping=false;rt.controls.minDistance=.05;rt.applyCamera(props.restoredCamera);rt.controls.enableDamping=true;rt.emit();return;}
    if(rt.focusRequest?.objectId===props.selectedObjectId&&rt.focusRequest.sequence===sequence&&rt.focusRequest.system===system)return;
    const view=props.selectedObjectId?rt.bodies.get(props.selectedObjectId):null;if(!view){if(rt.focus?.objectId||rt.focusedId||rt.followedId){rt.focus=null;rt.mode='manual';rt.focusedId=null;rt.followedId=null;rt.controls.enableDamping=true;rt.emit();}if(!props.selectedObjectId)rt.focusRequest={objectId:null,sequence,system};return;}
    rt.controls.enableDamping=false;rt.controls.update();
    const current=rt.cameraState();const center=view.direction?(view.body.direction_ecliptic??view.body.direction_ecliptic_unit)!:view.position.toArray() as Vec3;
    rt.focusRequest={objectId:props.selectedObjectId,sequence,system};rt.followedId=view.body.object_id;
    rt.focus=view.body.kind==='galaxy'&&!view.direction?makeGalaxyFocus(current,view.body.object_id,center,view.framingRadius,rt.camera.fov,rt.camera.aspect,performance.now(),window.matchMedia('(prefers-reduced-motion: reduce)').matches):makeFocus(current,view.body.object_id,center,view.framingRadius,rt.camera.fov,rt.camera.aspect,performance.now(),window.matchMedia('(prefers-reduced-motion: reduce)').matches,Boolean(view.direction),view.body.kind==='moon'?.05:2.5);
    rt.focusedId=view.body.object_id;rt.mode='focusing';rt.controls.minDistance=props.observerMode?.05:view.direction?0.2:Math.max(.05,view.radius*1.2);rt.emit();
  },[props.data,props.galaxies,props.selectedObjectId,props.selectionSequence,props.overviewSequence,props.restoredCamera,props.restoredFollowObjectId,props.restoreSequence,props.frameSelectedSystem,props.appearance]);

  useEffect(()=>{const rt=runtime.current;if(rt){const view=props.selectedObjectId?rt.bodies.get(props.selectedObjectId):undefined;rt.controls.minDistance=props.observerMode?.05:view&&!view.direction?Math.max(.05,view.radius*1.2):.2;rt.emit();}},[props.observerMode,props.selectedObjectId]);
  useEffect(()=>{runtime.current?.renderer.domElement.setAttribute('aria-label',props.controlsLabel??'3D universe');},[props.controlsLabel]);
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    const vertices=(props.skyStars??[]).flatMap(star=>star.display_direction.map(value=>value*CATALOG_SKY_RADIUS));
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    rt.skyStars.geometry.dispose();rt.skyStars.geometry=geometry;rt.skyStars.position.copy(rt.camera.position);
    rt.skyStars.userData.sourceUrl=props.skySourceUrl??null;rt.skyStars.userData.sourceSha256=props.skySourceSha256??null;
  },[props.skyStars,props.skySourceUrl,props.skySourceSha256]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.kuiper.visible=props.showKuiperBelt!==false;if(host.current){host.current.dataset.kuiperVisible=String(rt.kuiper.visible);host.current.dataset.kuiperRepresentation='seeded_illustrative_annulus_not_individual_positions_counts_or_density';host.current.dataset.kuiperInnerAu='30';host.current.dataset.kuiperOuterAu='50';}},[props.showKuiperBelt]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;const active=props.active!==false;rt.renderer.domElement.tabIndex=active?0:-1;if(host.current)host.current.dataset.sceneActive=String(active);if(active)rt.resume();},[props.active]);

  return <div ref={host} className={styles.scene} style={props.active===false?{visibility:'hidden'}:undefined} aria-hidden={props.active===false?true:undefined} data-testid="universe-scene" data-observer-mode={String(Boolean(props.observerMode))} data-selected-object={props.selectedObjectId??''} data-sky-star-count={props.skyStars?.length??0} data-sky-representation="catalog_host_directions" data-sky-state={props.skyStars?.length?'available':'empty'} data-sky-frame-status={CATALOG_SKY_FRAME_STATUS} data-sky-source-url={props.skySourceUrl??''} data-sky-source-sha256={props.skySourceSha256??''}>
    <div ref={labelsLayer} className={styles.labels} aria-label={props.controlsLabel}/>
    <div className={styles.representation}>{props.representationLabel??'Distance compressed · radii enlarged · artistic appearance'}{props.skyNote&&<span data-testid="catalog-sky-note">{props.skyNote} {props.skySourceUrl&&<a href={props.skySourceUrl} target="_blank" rel="noreferrer" style={{pointerEvents:'auto',color:'inherit'}}>NASA ↗</a>}</span>}</div>
    {error&&<div className={styles.error} role="alert"><p>{props.errorLabel??'3D rendering is unavailable in this browser.'}</p><div>{sceneObjects.map(body=><button key={body.object_id} onClick={()=>props.onSelect(body.object_id)}>{props.labels?.[body.object_id]??body.name}</button>)}</div></div>}
  </div>;
}
