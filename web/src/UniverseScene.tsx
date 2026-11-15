import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {createFallbackSolarMaterial,setFallbackLighting,updateFallbackSun} from './fallbackSolarMaterial';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {displayDirection, displayPosition, surfaceClearanceDistance, displayRadius, displayMoonRadius, displayOrbitPoints, displayMoonOffset, bodyDisplayPositions, bodySourcePositions, distanceViewOrbitPoints, LOCAL_DISTANCE_SCALE, advanceNavigationForBody, makeFocus, sampleFocus, validCamera, type DistanceView, type CameraState, type FocusTransition, type Vec3} from './sceneMath';
import {createBodyAppearance,scaledRingBands,ringBandsForDisplay,OVERVIEW_TEXTURE_SIZE,DETAIL_TEXTURE_SIZE,detailedAppearanceForSize,type AppearanceManifest,type AppearanceStatus,type AppearanceEntry,type RingEntry,type BodyAppearance} from './planetAppearance';
import {createKuiperIllustration} from './universeLayers';
import {smallBodyAxes,smallBodyRingRadii} from './smallBodyAppearance';
import {TransNeptunianLayer} from './TransNeptunianLayer';
import type {OuterTnoCatalog,OuterTnoObject} from './OuterTnoPanel';
import type {TransNeptunianEpochStats} from './TransNeptunianMath';
import {renderingBudget,type RenderPreset,type LightingMode} from './sceneView';
import {needsBodyPositionMarker,projectedBodyDiameterPx} from './BodyNavigationMath';
import {tnoPickCandidates} from './tnoSelection';
import styles from './UniverseScene.module.css';

export type {CameraState} from './sceneMath';
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
  kind: 'solar_system' | 'direction'|'moon'|'dwarf_planet'|'dwarf_candidate';
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
  distanceView?:DistanceView;
  renderPreset?:RenderPreset;
  lightingMode?:LightingMode;
  coverageMode?:'representative'|'marked'|'original';
  outerTnoCatalog?:OuterTnoCatalog;
  outerTnoEpochJd?:number;
  outerTnoSelected?:OuterTnoObject;
  showOuterTno?:boolean;
  onOuterTnoStats?:(statistics:TransNeptunianEpochStats)=>void;
  active?:boolean;
  data: UniverseData | null;
  selectedObjectId: string | null;
  selectionSequence?: number;
  overviewSequence?: number;
  showOrbits?: boolean;
  showKuiperBelt?:boolean;
  showExplorationBoundary?:boolean;
  hypothesisOrbitAu?:Vec3[];
  appearance?:AppearanceManifest|null;
  onAppearanceStatus?:(status:AppearanceStatus)=>void;
  frameSelectedSystem?:boolean;
  onSelect: (objectId:string) => void;
  onTnoPick?:(objectIds:string[])=>void;
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
  positionMarkerLabel?:string;
  onError?: (message:string) => void;
}

interface BodyView {pendingAppearance?:BodyAppearance|null;pendingEntry?:AppearanceEntry;pendingRings?:RingEntry;pendingTextureSize?:number;failedLodKey?:string|null;failedLodSequence?:number;body:UniverseBody;group:THREE.Group;radius:number;framingRadius:number;position:THREE.Vector3;direction:THREE.Vector3|null;label:HTMLButtonElement;marker:HTMLButtonElement;markerVisible:boolean;appearance:BodyAppearance|null;appearanceEntry:AppearanceEntry|undefined;ringEntry:RingEntry|undefined;textureSize?:number;fallback:THREE.Mesh|null}
interface Runtime {
  distanceFrameKey:string;
  tno:TransNeptunianLayer|null;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  bodies: Map<string,BodyView>;
  orbits: Map<string,THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>>;
  kuiper:THREE.Group;
  focus: FocusTransition | null;
  mode: 'overview' | 'focusing' | 'focused' | 'manual' | 'restored';
  focusedId: string | null;
  followedId: string | null;
  focusRequest: {objectId:string|null;sequence:number;system:boolean;representation?:string}|null;
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
const INITIAL:CameraState = {position:[0,165,310],target:[0,0,0],representation_version:'solar-display-v1'};

const directionOnlyBody=(body:UniverseBody)=>body.kind==='direction';
const localDistanceView=(view:DistanceView|undefined)=>view?.algorithm_version==='parent-linear-distance-v1';
const distanceFrameKey=(view:DistanceView|undefined)=>`${view?.algorithm_version??'legacy-expanded-v1'}:${localDistanceView(view)?view?.origin_object_id??'':''}`;


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

function updateMeshData(view:BodyView){
  const surface=view.appearance?.surface??view.fallback;
  view.label.dataset.bodyGroupScale=view.group.scale.toArray().join(',');
  if(surface){if(!surface.geometry.boundingSphere)surface.geometry.computeBoundingSphere();const geometryRadius=surface.geometry.boundingSphere?.radius;const scale=surface.getWorldScale(new THREE.Vector3());view.label.dataset.meshGeometryRadius=geometryRadius===undefined?'':String(geometryRadius);view.label.dataset.meshWorldRadius=geometryRadius===undefined?'':String(geometryRadius*Math.max(...scale.toArray()));view.label.dataset.surfaceMeshScale=surface.scale.toArray().join(',');}
}

/** Camera LOD changes only GPU map samples; object radii and physical data stay fixed. */
function refreshBodyAppearances(rt:Runtime,props:UniverseSceneProps){
  for(const view of rt.bodies.values())if(view.fallback?.material instanceof THREE.MeshStandardMaterial)setFallbackLighting(view.fallback.material,props.lightingMode??'solar');
  const manifest=props.appearance;if(!manifest)return;
  rt.camera.updateMatrixWorld();
  const projection=new THREE.Vector3();const height=rt.renderer.domElement.clientHeight;
  const emitStatus=(view:BodyView,status:AppearanceStatus)=>{view.label.dataset.appearanceState=status.state;view.label.dataset.appearanceKind=status.kind;view.label.dataset.displayTextureDimensions=status.display_texture_dimensions?.join(',')??'';view.label.dataset.appearanceLighting=status.lighting_mode??props.lightingMode??'solar';view.label.dataset.coverageMode=status.coverage_mode??props.coverageMode??'marked';view.label.dataset.coverageOverlay=status.coverage_overlay??'not_applicable';view.label.dataset.lodState=status.lod_state??'ready';props.onAppearanceStatus?.(status);};
  const cancelPending=(view:BodyView)=>{const pending=view.pendingAppearance;view.pendingAppearance=null;pending?.dispose();view.pendingEntry=undefined;view.pendingRings=undefined;view.pendingTextureSize=undefined;};
  const candidates=[...rt.bodies.values()].map(view=>{
    projection.copy(view.group.position).project(rt.camera);
    const inFrame=projection.z>-1&&projection.z<1&&Math.abs(projection.x)<1.15&&Math.abs(projection.y)<1.15;
    const distance=Math.max(view.radius,rt.camera.position.distanceTo(view.group.position));
    const pixels=inFrame?view.radius*height/(distance*Math.tan(rt.camera.fov*Math.PI/360)):0;
    return {view,source:manifest.objects[view.body.object_id],pixels,selected:view.body.object_id===props.selectedObjectId};
  });
  const nearbyMoons=new Set(candidates.filter(item=>item.view.body.kind==='moon'&&item.source?.texture_url&&(item.selected||item.pixels>=6)).sort((a,b)=>Number(b.selected)-Number(a.selected)||b.pixels-a.pixels).slice(0,8).map(item=>item.view.body.object_id));
  const detailed=new Set(candidates.filter(item=>item.source?.texture_url&&(item.view.body.kind!=='moon'||nearbyMoons.has(item.view.body.object_id))&&detailedAppearanceForSize(item.pixels,item.selected,(item.view.textureSize??0)>OVERVIEW_TEXTURE_SIZE)).sort((a,b)=>Number(b.selected)-Number(a.selected)||b.pixels-a.pixels).slice(0,2).map(item=>item.view.body.object_id));
  for(const {view,source,pixels,selected} of candidates){
    const id=view.body.object_id;
    const useSource=Boolean(source?.physical_profile||source?.texture_url&&(view.body.kind!=='moon'||nearbyMoons.has(id)));
    const entry=useSource?source:undefined,rings=manifest.rings[id];
    const textureSize=entry?.texture_url?Math.min(rt.renderer.capabilities.maxTextureSize,detailed.has(id)?DETAIL_TEXTURE_SIZE:OVERVIEW_TEXTURE_SIZE,entry.texture_region_px?Math.max(entry.texture_region_px.width,entry.texture_region_px.height):Math.max(...(entry.pixel_dimensions??[DETAIL_TEXTURE_SIZE,DETAIL_TEXTURE_SIZE]))):undefined;
    const wanted=!view.direction&&(view.body.kind!=='moon'||selected||nearbyMoons.has(id));
    const lodKey=`${entry?.texture_url??''}:${textureSize??0}`;
    if(view.failedLodKey&&(view.failedLodKey!==lodKey||selected&&view.failedLodSequence!==(props.selectionSequence??0)))view.failedLodKey=null;
    if(view.pendingAppearance&&(!wanted||view.pendingEntry!==entry||view.pendingRings!==rings||view.pendingTextureSize!==textureSize))cancelPending(view);
    view.appearance?.setLightingMode(props.lightingMode??'solar');view.pendingAppearance?.setLightingMode(props.lightingMode??'solar');view.appearance?.setCoverageMode(props.coverageMode??'marked');view.pendingAppearance?.setCoverageMode(props.coverageMode??'marked');
    const create=(onStatus:(status:AppearanceStatus)=>void)=>createBodyAppearance({objectId:id,displayRadius:view.radius,physicalRadiusKm:source?.physical_profile?.reference_radius_km??view.body.radius_km??0,fallbackColor:view.body.color??COLORS[id]??'#a7a19b',appearance:entry,rings,anisotropy:Math.min(8,rt.renderer.capabilities.getMaxAnisotropy()),textureMaxDimension:textureSize,texturePriority:selected,lightingMode:props.lightingMode??'solar',coverageMode:props.coverageMode??'marked',onStatus});
    const changed=view.appearanceEntry!==entry||view.ringEntry!==rings||view.textureSize!==textureSize;
    if(view.appearance&&changed&&wanted&&view.appearance.status.state==='ready'&&view.appearanceEntry?.texture_url&&view.appearanceEntry.texture_url===entry?.texture_url&&view.ringEntry===rings){
      if(!view.pendingAppearance&&view.failedLodKey!==lodKey){
        let created:BodyAppearance|null=null;
        const pending=create(status=>{
          const replacement=created;if(!replacement||rt.disposed||rt.bodies.get(id)!==view)return;
          if(view.appearance===replacement){emitStatus(view,{...status,lod_state:'ready'});return;}
          if(view.pendingAppearance!==replacement)return;
          if(status.state==='ready'){
            const old=view.appearance;view.group.add(replacement.group);view.appearance=replacement;view.appearanceEntry=entry;view.ringEntry=rings;view.textureSize=textureSize;view.pendingAppearance=null;view.failedLodKey=null;
            if(old){view.group.remove(old.group);old.dispose();}updateMeshData(view);emitStatus(view,{...status,lod_state:'ready'});
          }else if(status.state==='fallback'||status.state==='failed'){
            cancelPending(view);view.failedLodKey=lodKey;view.failedLodSequence=props.selectionSequence??0;if(view.appearance)emitStatus(view,{...view.appearance.status,lod_state:'retained_after_error'});
          }
        });
        created=pending;
        view.pendingAppearance=pending;view.pendingEntry=entry;view.pendingRings=rings;view.pendingTextureSize=textureSize;
        emitStatus(view,{...view.appearance.status,lod_state:'loading'});
      }
      view.label.dataset.requestedTextureMaxDimension=String(textureSize??'');continue;
    }
    if(view.appearance&&(!wanted||changed)){view.group.remove(view.appearance.group);view.appearance.dispose();view.appearance=null;}
    if(wanted&&!view.appearance){
      if(view.fallback){view.group.remove(view.fallback);disposeObject(view.fallback);view.fallback=null;}
      view.appearance=create(status=>emitStatus(view,status));view.group.add(view.appearance.group);emitStatus(view,view.appearance.status);
    }
    if(!wanted&&!view.fallback&&!view.direction){const mesh=new THREE.Mesh(new THREE.SphereGeometry(view.radius,12,8),new THREE.MeshStandardMaterial({color:view.body.color??COLORS[id]??'#9a9690',roughness:1}));mesh.userData.objectId=id;view.group.add(mesh);view.fallback=mesh;}
    view.appearanceEntry=entry;view.ringEntry=rings;view.textureSize=textureSize;
    view.label.dataset.surfaceRepresentation=entry?.texture_url?'published_map':source?.physical_profile?'literature_constraints_unresolved':'neutral_unresolved_body';
    view.label.dataset.textureLod=textureSize===undefined?'none':detailed.has(id)?'detail':'overview';view.label.dataset.textureMaxDimension=textureSize===undefined?'':String(textureSize);view.label.dataset.projectedDiameterPx=pixels.toFixed(2);updateMeshData(view);
  }
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


const moonGuideBounds=new WeakMap<Vec3[],number>();
function moonGuideExtent(body:UniverseBody,parent:BodyView,distanceView?:DistanceView){
  const points=body.orbit?.points_au;if(!points?.length)return null;
  let bound=moonGuideBounds.get(points);if(bound===undefined){bound=Math.max(...points.map(point=>Math.hypot(...point)));moonGuideBounds.set(points,bound);}
  if(localDistanceView(distanceView))return bound*LOCAL_DISTANCE_SCALE;
  const offset=displayMoonOffset([bound,0,0],parent.body.radius_km??null,parent.radius);
  return offset?Math.hypot(...offset):null;
}

export default function UniverseScene(props:UniverseSceneProps) {
  const host=useRef<HTMLDivElement>(null);
  const labelsLayer=useRef<HTMLDivElement>(null);
  const markersLayer=useRef<HTMLDivElement>(null);
  const markerLegend=useRef<HTMLDivElement>(null);
  const runtime=useRef<Runtime|null>(null);
  const latest=useRef(props);latest.current=props;
  const sceneObjects=useMemo(()=>props.data?.objects??[],[props.data]);
  const sourcePositions=useMemo(()=>bodySourcePositions(sceneObjects),[sceneObjects]);
  const local=localDistanceView(props.distanceView),frameKey=distanceFrameKey(props.distanceView);
  const originAu=local?sourcePositions.get(props.distanceView?.origin_object_id??''):undefined;
  const appliedOverview=useRef(0);
  const [error,setError]=useState(false);
  const bodyIdentity=sceneObjects.map(body=>body.object_id).join(',');

  useEffect(()=>{
    const container=host.current;if(!container)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});}
    catch(e){setError(true);latest.current.onError?.(e instanceof Error?e.message:'webgl_unavailable');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,renderingBudget(latest.current.renderPreset??'balanced').dpr));renderer.setSize(container.clientWidth,container.clientHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    renderer.setClearColor('#040810',1);
    renderer.domElement.className=styles.canvas;renderer.domElement.dataset.testid='universe-canvas';renderer.domElement.tabIndex=0;
    renderer.domElement.setAttribute('role','application');renderer.domElement.setAttribute('aria-label',latest.current.controlsLabel??'3D universe: drag to rotate, wheel to zoom, right drag to pan; W A S D or arrow keys to move.');
    container.prepend(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.AmbientLight('#a1b7d8',.18));scene.add(new THREE.PointLight('#ffe5bd',480,0,2));
    // Artistic fill makes the exaggerated globes legible; this is not a radiative model.
    scene.add(new THREE.HemisphereLight('#dce8fa','#101827',.85));
    const fill=new THREE.DirectionalLight('#fff2df',1.8);fill.position.set(-35,45,70);scene.add(fill);
    const kuiper=createKuiperIllustration();kuiper.visible=!localDistanceView(latest.current.distanceView)&&latest.current.showKuiperBelt!==false;scene.add(kuiper);
    const camera=new THREE.PerspectiveCamera(48,container.clientWidth/Math.max(1,container.clientHeight),.025,localDistanceView(latest.current.distanceView)?1e8:6000);camera.position.fromArray(INITIAL.position);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.fromArray(INITIAL.target);controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.65;controls.zoomSpeed=.85;controls.panSpeed=.7;controls.minDistance=.2;controls.maxDistance=localDistanceView(latest.current.distanceView)?1e7:1100;controls.screenSpacePanning=true;controls.update();
    const rt:Runtime={distanceFrameKey:distanceFrameKey(latest.current.distanceView),tno:null,renderer,scene,camera,controls,bodies:new Map(),orbits:new Map(),kuiper,focus:null,mode:'overview',focusedId:null,followedId:null,focusRequest:null,restoredRequest:null,lastFollowEmitted:undefined,motionTick:0,lastEmit:0,disposed:false,animationId:0,pausedAt:null,resume:()=>{},
      cameraState:()=>({position:camera.position.toArray() as Vec3,target:controls.target.toArray() as Vec3,representation_version:'solar-display-v1'}),
      applyCamera:value=>{camera.position.fromArray(value.position);controls.target.fromArray(value.target);controls.update();},
      emit:()=>{latest.current.onCameraChange?.(rt.cameraState());if(rt.lastFollowEmitted!==rt.followedId){rt.lastFollowEmitted=rt.followedId;latest.current.onFollowChange?.(rt.followedId);}container.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(9)).join(',');container.dataset.cameraTarget=controls.target.toArray().map(n=>n.toFixed(9)).join(',');container.dataset.controlsMinDistance=String(controls.minDistance);container.dataset.cameraFar=String(camera.far);container.dataset.controlsMaxDistance=String(controls.maxDistance);container.dataset.cameraMode=rt.mode;container.dataset.focusedObject=rt.focusedId??'';container.dataset.followObject=rt.followedId??'';container.dataset.focusStartedAt=rt.focus?String(rt.focus.startedAt):'';},
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
      const groups=[...rt.bodies.values()].filter(view=>view.group.visible).map(view=>view.group);
      const intersections=raycaster.intersectObjects(groups,true);
      const actual=intersections.find(hit=>typeof hit.object.userData.objectId==='string');
      if(actual){latest.current.onSelect(actual.object.userData.objectId as string);return;}
      // A subpixel mesh cannot be reliably raycast. Pick its separately labelled
      // navigation glyph by a CSS-pixel hit radius; never enlarge its geometry.
      camera.updateMatrixWorld();
      const native=[...rt.bodies.values()].filter(view=>view.markerVisible).map(view=>{
        const point=view.group.position.clone().project(camera);
        return {object_id:view.body.object_id,x:(point.x+1)*bounds.width/2,y:(1-point.y)*bounds.height/2,depth:point.z};
      });
      const nativeHits=tnoPickCandidates(native,event.clientX-bounds.left,event.clientY-bounds.top,9);
      if(nativeHits.length){latest.current.onSelect(nativeHits[0].object_id);return;}
      const candidates=rt.tno?.pickCandidates(camera,position,bounds.width,bounds.height)??[];
      if(candidates.length===1)latest.current.onSelect(candidates[0].object_id);
      else if(candidates.length>1)latest.current.onTnoPick?.(candidates.map(value=>value.object_id));
    };
    const wheel=()=>cancelFocus();
    // Labels and fixed-pixel position buttons are siblings of the WebGL
    // canvas. Forward only their wheel input to OrbitControls so a label
    // moving underneath a stationary pointer cannot interrupt a zoom gesture.
    const navigationOverlays=[labelsLayer.current,markersLayer.current].filter((layer):layer is HTMLDivElement=>layer!==null);
    const overlayWheel=(event:WheelEvent)=>{
      if(event.target===renderer.domElement||!(event.target instanceof Node)||!navigationOverlays.some(layer=>layer.contains(event.target as Node)))return;
      event.preventDefault();event.stopPropagation();
      renderer.domElement.dispatchEvent(new WheelEvent('wheel',{
        bubbles:true,cancelable:true,composed:true,view:window,detail:event.detail,
        deltaX:event.deltaX,deltaY:event.deltaY,deltaZ:event.deltaZ,deltaMode:event.deltaMode,
        clientX:event.clientX,clientY:event.clientY,screenX:event.screenX,screenY:event.screenY,
        ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey,
        button:event.button,buttons:event.buttons,
      }));
    };
    navigationOverlays.forEach(layer=>layer.addEventListener('wheel',overlayWheel,{capture:true,passive:false}));
    renderer.domElement.addEventListener('pointerdown',pointerDown,{capture:true});renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('wheel',wheel,{capture:true,passive:true});
    const resize=new ResizeObserver(()=>{const w=container.clientWidth;const h=container.clientHeight;if(w===0||h===0)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(container);
    let previous=performance.now(),lastRendered=-Infinity,lastAppearanceRefresh=-Infinity,lastTnoRefresh=-Infinity,lastTnoEpoch=NaN;let followedTnoPosition:Vec3|null=null;
    const forward=new THREE.Vector3();const right=new THREE.Vector3();const move=new THREE.Vector3();const projection=new THREE.Vector3();const cameraSpace=new THREE.Vector3();const clearance=new THREE.Vector3();const sunlight=new THREE.Vector3();const previousEye=camera.position.clone();
    const animate=(now:number)=>{
      if(rt.disposed)return;if(latest.current.active===false||document.hidden){rt.animationId=0;rt.pausedAt=now;keys.clear();return;}rt.animationId=requestAnimationFrame(animate);if(rt.distanceFrameKey!==distanceFrameKey(latest.current.distanceView))return;const budget=renderingBudget(latest.current.renderPreset??'balanced');if(now-lastRendered<1000/budget.fps-.5)return;lastRendered=now;container.dataset.renderFpsLimit=String(budget.fps);container.dataset.renderDprLimit=String(budget.dpr);
      const elapsed=Math.min(.05,(now-previous)/1000);previous=now;if(localDistanceView(latest.current.distanceView))followedTnoPosition=null;if(rt.tno&&!localDistanceView(latest.current.distanceView)&&now-lastTnoRefresh>=250&&latest.current.outerTnoEpochJd!==lastTnoEpoch){lastTnoRefresh=now;lastTnoEpoch=latest.current.outerTnoEpochJd??NaN;const stats=rt.tno.updateEpoch(lastTnoEpoch);if(stats){latest.current.onOuterTnoStats?.(stats);container.dataset.outerTnoJd=String(stats.jd_tdb);container.dataset.outerTnoExtrapolated=String(stats.extrapolated_count);container.dataset.outerTnoPlotted=String(stats.plotted_count);container.dataset.outerTnoUnavailable=String(stats.unavailable_count);container.dataset.outerTnoOutside=String(stats.outside_1000_au_count);}const selected=latest.current.selectedObjectId;const next=selected&&!rt.bodies.has(selected)&&latest.current.outerTnoSelected?rt.tno.positionFor(latest.current.outerTnoSelected.object_id):null;if(next&&followedTnoPosition&&rt.followedId===selected){const state=advanceNavigationForBody({camera:rt.cameraState(),transition:rt.focus,followedObjectId:rt.followedId},selected!,followedTnoPosition,next);rt.focus=state.transition;camera.position.fromArray(state.camera.position);controls.target.fromArray(state.camera.target);}followedTnoPosition=next;}
      if(rt.focus){const sampled=sampleFocus(rt.focus,now);camera.position.fromArray(sampled.camera.position);controls.target.fromArray(sampled.camera.target);if(sampled.done){rt.focusedId=rt.focus.objectId||null;rt.followedId=rt.focus.objectId||null;rt.mode=rt.focus.objectId?'focused':'overview';rt.focus=null;controls.enableDamping=true;rt.emit();}}
      if(keys.size){camera.getWorldDirection(forward);right.crossVectors(forward,camera.up).normalize();move.set(0,0,0);if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))move.sub(right);if(keys.has('KeyE'))move.add(camera.up);if(keys.has('KeyQ'))move.sub(camera.up);const distance=Math.max(3,camera.position.distanceTo(controls.target));move.normalize().multiplyScalar(elapsed*distance*.6);camera.position.add(move);controls.target.add(move);}
      controls.update();
      camera.updateMatrixWorld();
      // Keep the free camera outside the exaggerated visible surfaces.
      for(const view of rt.bodies.values()){
        if(view.direction||!view.group.visible)continue;
        if(rt.mode==='manual'&&camera.position.distanceToSquared(previousEye)<1e-12)continue;
        clearance.copy(camera.position).sub(view.group.position);const distance=clearance.length();const minimum=surfaceClearanceDistance(view.radius,camera.near);
        if(distance<minimum){if(distance<1e-8)clearance.set(0,0,1);else clearance.divideScalar(distance);clearance.multiplyScalar(minimum-distance);camera.position.add(clearance);controls.target.add(clearance);}
      }
      previousEye.copy(camera.position);
      if(now-lastAppearanceRefresh>=250){refreshBodyAppearances(rt,latest.current);lastAppearanceRefresh=now;}
      const w=container.clientWidth;const h=container.clientHeight;
      const epochMs=Date.parse(latest.current.data?.epoch??'2026-11-14T00:00:00Z');
      const selectedBody=latest.current.selectedObjectId?rt.bodies.get(latest.current.selectedObjectId)?.body:null;const selectedParent=selectedBody?.kind==='moon'?selectedBody.parent_id:latest.current.selectedObjectId;
      const occupied:{left:number;top:number;right:number;bottom:number}[]=[];
      let visibleMarkers=0;
      const ordered=[...rt.bodies.entries()].sort(([a],[b])=>Number(b===latest.current.selectedObjectId)-Number(a===latest.current.selectedObjectId));
      for(const [id,view] of ordered){
        if(view.body.position_au){const p=view.body.position_au;sunlight.set(-p[0],-p[2],p[1]).normalize();view.appearance?.update(epochMs,sunlight);if(view.fallback?.material instanceof THREE.MeshStandardMaterial)updateFallbackSun(view.fallback.material,sunlight);}
        if(view.direction){view.group.position.copy(camera.position).addScaledVector(view.direction,300);view.group.quaternion.copy(camera.quaternion);}
        const world=view.group.position;projection.copy(world).project(camera);
        const lodVisible=view.body.kind!=='moon'||id===latest.current.selectedObjectId||(view.body.parent_id===selectedParent&&view.label.dataset.majorMoon==='true');
        const visible=view.group.visible&&lodVisible&&projection.z>-1&&projection.z<1&&projection.x>-.96&&projection.x<.96&&projection.y>-.93&&projection.y<.93;
        cameraSpace.copy(world).applyMatrix4(camera.matrixWorldInverse);
        const diameter=view.direction?null:projectedBodyDiameterPx(view.radius,-cameraSpace.z,h,camera.fov);
        view.label.dataset.projectedDiameterPx=diameter===null?'':diameter.toFixed(6);
        view.markerVisible=visible&&!view.direction&&needsBodyPositionMarker(diameter,view.markerVisible);
        view.marker.hidden=!view.markerVisible;view.label.dataset.positionMarkerVisible=String(view.markerVisible);
        view.marker.dataset.projectedBodyDiameterPx=diameter===null?'':diameter.toFixed(6);
        if(view.markerVisible){
          visibleMarkers++;const markerX=(projection.x+1)*w/2,markerY=(1-projection.y)*h/2;
          view.marker.style.transform=`translate(${markerX}px,${markerY}px) translate(-50%,-50%)`;
          view.marker.dataset.screenX=String(markerX);view.marker.dataset.screenY=String(markerY);
          view.marker.dataset.selected=String(id===latest.current.selectedObjectId);
          view.marker.style.zIndex=id===latest.current.selectedObjectId?'2':'1';
          view.marker.setAttribute('aria-pressed',String(id===latest.current.selectedObjectId));
        }
        if(view.label.hidden===visible)view.label.hidden=!visible;
        if(visible){
          const x=(projection.x+1)*w/2;const originY=(-projection.y+1)*h/2;const width=view.label.offsetWidth||90;const height=view.label.offsetHeight||28;
          let y=originY+(view.direction?-height-12:12);
          for(const offset of [0,24,-48,48,-72]){const testY=y+offset;const box={left:x-width/2-3,top:testY-3,right:x+width/2+3,bottom:testY+height+3};if(!occupied.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top)){y=testY;occupied.push(box);break;}}
          view.label.style.transform=`translate(${x}px,${y}px) translateX(-50%)`;view.label.dataset.selected=String(id===latest.current.selectedObjectId);
        }
      }
      container.dataset.nativePositionMarkers=String(visibleMarkers);
      if(markerLegend.current)markerLegend.current.hidden=visibleMarkers===0;
      // Translate the reference sphere with the eye, retaining fixed sky
      // directions when the free camera pans; never create a stellar parallax.
      renderer.render(scene,camera);
    };
    rt.resume=()=>{if(rt.disposed||rt.animationId!==0||latest.current.active===false||document.hidden)return;const now=performance.now();if(rt.pausedAt!==null&&rt.focus)rt.focus.startedAt+=now-rt.pausedAt;rt.pausedAt=null;previous=now;rt.animationId=requestAnimationFrame(animate);};
    const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(rt.animationId);rt.animationId=0;rt.pausedAt=performance.now();keys.clear();}else rt.resume();};document.addEventListener('visibilitychange',onVisibility);
    rt.animationId=requestAnimationFrame(animate);rt.emit();
    return()=>{
      rt.disposed=true;document.removeEventListener('visibilitychange',onVisibility);cancelAnimationFrame(rt.animationId);resize.disconnect();controls.dispose();
      window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);
      navigationOverlays.forEach(layer=>layer.removeEventListener('wheel',overlayWheel,true));
      renderer.domElement.removeEventListener('pointerdown',pointerDown,true);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('wheel',wheel,true);
      if(rt.tno){scene.remove(rt.tno.group);rt.tno.dispose();rt.tno=null;}rt.bodies.forEach(view=>{view.pendingAppearance?.dispose();if(view.appearance){view.group.remove(view.appearance.group);view.appearance.dispose();}view.label.remove();view.marker.remove();});disposeObject(scene);renderer.dispose();renderer.domElement.remove();runtime.current=null;
    };
  },[]);

  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.renderer.setPixelRatio(Math.min(window.devicePixelRatio,renderingBudget(props.renderPreset??'balanced').dpr));const container=host.current;if(container)rt.renderer.setSize(container.clientWidth,container.clientHeight);},[props.renderPreset]);
  useEffect(()=>{const rt=runtime.current;if(rt)refreshBodyAppearances(rt,props);},[props.renderPreset,props.lightingMode,props.coverageMode]);

  useEffect(()=>{
    const rt=runtime.current;const layer=labelsLayer.current;const markerLayer=markersLayer.current;if(!rt||!layer||!markerLayer)return;
    const frameChanged=rt.distanceFrameKey!==frameKey;
    if(frameChanged){
      rt.distanceFrameKey=frameKey;rt.focus=null;rt.focusRequest=null;rt.followedId=null;rt.focusedId=null;rt.mode='manual';
      rt.controls.enableDamping=false;rt.controls.minDistance=.2;rt.camera.position.fromArray(local?[0,20,40]:INITIAL.position);rt.controls.target.set(0,0,0);rt.controls.update();rt.controls.enableDamping=true;
    }
    rt.camera.far=local?1e8:6000;rt.camera.updateProjectionMatrix();rt.controls.maxDistance=local?1e7:1100;
    const locations=bodyDisplayPositions(sceneObjects,props.distanceView);
    const retained=new Set(sceneObjects.filter(body=>directionOnlyBody(body)?!local&&(body.direction_ecliptic??body.direction_ecliptic_unit):locations.has(body.object_id)).map(body=>body.object_id));
    for(const [id,view] of rt.bodies){if(!retained.has(id)){view.pendingAppearance?.dispose();rt.scene.remove(view.group);if(view.appearance){view.group.remove(view.appearance.group);view.appearance.dispose();}disposeObject(view.group);view.label.remove();view.marker.remove();rt.bodies.delete(id);}}
    const previousFraming=new Map([...rt.bodies].map(([id,view])=>[id,view.framingRadius]));
    const majorMoons=new Set<string>();const parents=new Set(sceneObjects.filter(body=>body.kind==='moon').map(body=>body.parent_id));for(const parent of parents){sceneObjects.filter(body=>body.kind==='moon'&&body.parent_id===parent).sort((a,b)=>(b.radius_km??0)-(a.radius_km??0)).slice(0,12).forEach(body=>majorMoons.add(body.object_id));}
    for(const body of sceneObjects){
      const sourceDirection=body.direction_ecliptic??body.direction_ecliptic_unit;
      const directionOnly=directionOnlyBody(body);
      if(local&&directionOnly)continue;
      if(!directionOnly&&!locations.has(body.object_id))continue;
      if(directionOnly&&!sourceDirection)continue;
      const position=new THREE.Vector3().fromArray(directionOnly?displayDirection(sourceDirection!):locations.get(body.object_id)!);
      const sourceAppearance=props.appearance?.objects[body.object_id];const displayReferenceRadius=sourceAppearance?.physical_profile?.reference_radius_km??body.radius_km??0;
      const radius=directionOnly?1.05:body.kind==='moon'?displayMoonRadius(body.radius_km??null):displayRadius(displayReferenceRadius,body.object_id==='sun');
      let view=rt.bodies.get(body.object_id);
      if(!frameChanged&&view&&(rt.focus?.objectId===body.object_id||rt.followedId===body.object_id)){
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
        }else{
          const color=body.color??COLORS[body.object_id]??'#9eabbc';
          const material=body.object_id==='sun'?new THREE.MeshBasicMaterial({color:'#ffce80'}):createFallbackSolarMaterial(color,latest.current.lightingMode??'solar');
          const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,body.kind==='moon'?12:48,body.kind==='moon'?8:32),material);sphere.userData.objectId=body.object_id;group.add(sphere);
          if(body.object_id==='sun')group.add(makeGlow('rgba(255,199,122,0.8)',radius*7));
        }
        const label=document.createElement('button');label.className=styles.bodyLabel;label.type='button';label.dataset.testid=`object-label-${body.object_id}`;label.addEventListener('click',event=>{event.stopPropagation();latest.current.onSelect(body.object_id);});layer.append(label);
        const marker=document.createElement('button');marker.className=styles.positionMarker;marker.type='button';marker.hidden=true;marker.dataset.testid=`object-position-marker-${body.object_id}`;marker.dataset.objectId=body.object_id;marker.dataset.kind='source_centre_navigation_marker';marker.addEventListener('click',event=>{event.stopPropagation();latest.current.onSelect(body.object_id);});markerLayer.append(marker);
        view={body,group,radius,framingRadius:radius,position,direction:directionOnly?position.clone():null,label,marker,markerVisible:false,appearance:null,appearanceEntry:undefined,ringEntry:undefined,fallback:group.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh??null};rt.bodies.set(body.object_id,view);rt.scene.add(group);
      }
      if(view.radius!==radius&&view.fallback){view.fallback.geometry.dispose();view.fallback.geometry=new THREE.SphereGeometry(radius,body.kind==='moon'?12:48,body.kind==='moon'?8:32);}
      view.radius=radius;view.framingRadius=radius;
      const ringEntry=props.appearance?.rings[body.object_id];const smallProfile=sourceAppearance?.physical_profile;const physicalReference=smallProfile?.reference_radius_km??body.radius_km??0;
      const bands=scaledRingBands(ringBandsForDisplay(ringEntry),physicalReference,radius).filter(band=>band.opacity>=.08);if(bands.length)view.framingRadius=Math.max(radius,...bands.map(band=>band.outer));
      view.framingRadius=Math.max(view.framingRadius,...smallBodyAxes(smallProfile).map(axis=>axis*radius),...smallBodyRingRadii(smallProfile,physicalReference,radius));
      view.body=body;view.position.copy(position);view.direction=directionOnly?position.clone():null;
      if(!directionOnly)view.group.position.copy(position);
      const name=props.labels?.[body.object_id]??body.name;const text=directionOnly?`${name} · ${props.directionLabel??'direction'}`:name;if(view.label.textContent!==text)view.label.textContent=text;if(view.label.getAttribute('aria-label')!==name)view.label.setAttribute('aria-label',name);
      const markerDescription=`${name} · ${props.positionMarkerLabel??'Position marker · not actual size or brightness'}`;
      view.marker.setAttribute('aria-label',markerDescription);view.marker.title=markerDescription;view.marker.tabIndex=props.active===false?-1:0;
      view.label.setAttribute('aria-pressed',String(props.selectedObjectId===body.object_id));
      view.label.dataset.kind=body.kind;view.label.dataset.parentId=body.parent_id??'';view.label.tabIndex=props.active===false?-1:0;view.label.dataset.majorMoon=String(majorMoons.has(body.object_id));
      view.label.dataset.worldPosition=position.toArray().map(value=>value.toFixed(9)).join(',');
      view.label.dataset.sourcePositionAu=sourcePositions.get(body.object_id)?.map(value=>value.toFixed(15)).join(',')??'';
      view.label.dataset.positionKind=body.position_kind??body.kind;
      view.label.dataset.shapeAxes=smallBodyAxes(smallProfile).join(',');view.label.dataset.ringCenterRadiiKm=smallProfile?.rings.map(ring=>ring.center_radius_km).join(',')??'';view.label.dataset.profileColor=smallProfile?.color_hex??'';view.label.dataset.displayRadius=String(view.radius);view.label.dataset.framingRadius=String(view.framingRadius);view.label.dataset.physicalReferenceRadiusKm=String(physicalReference);updateMeshData(view);
    }
    // In a common overview an enlarged moon can overlap its parent's enlarged
    // navigation globe. Hide that globe rather than moving it to a false orbit.
    // The source catalogue/list still offers selection into the linear view.
    for(const view of rt.bodies.values()){
      const parent=view.body.kind==='moon'&&view.body.parent_id?rt.bodies.get(view.body.parent_id):undefined;
      const overlaps=props.distanceView?.algorithm_version==='solar-overview-common-v2'&&parent!==undefined&&view.position.distanceTo(parent.position)<parent.radius+view.radius;
      view.group.visible=!overlaps;view.label.dataset.distanceOccluded=String(overlaps);if(overlaps)view.label.hidden=true;
    }
    refreshBodyAppearances(rt,props);
    if(props.frameSelectedSystem&&props.selectedObjectId){const parent=rt.bodies.get(props.selectedObjectId);if(parent){for(const view of rt.bodies.values()){if(view.body.kind==='moon'&&view.body.parent_id===props.selectedObjectId)parent.framingRadius=Math.max(parent.framingRadius,(moonGuideExtent(view.body,parent,props.distanceView)??parent.position.distanceTo(view.position))+view.radius);}}}
    for(const [id,view] of rt.bodies){view.label.dataset.framingRadius=String(view.framingRadius);const before=previousFraming.get(id);if(before!==undefined&&Math.abs(before-view.framingRadius)>1e-6&&props.selectedObjectId===id&&(rt.followedId===id||rt.focus?.objectId===id))rt.focusRequest=null;}
    rt.motionTick++;if(host.current){host.current.dataset.modelEpoch=props.data?.epoch??'';host.current.dataset.motionTick=String(rt.motionTick);host.current.dataset.distanceOriginSourceAu=originAu?.map(value=>value.toFixed(15)).join(',')??'';}if(frameChanged)rt.emit();
  },[sceneObjects,props.data,props.labels,props.directionLabel,props.positionMarkerLabel,props.selectedObjectId,props.appearance,props.frameSelectedSystem,props.active,frameKey,originAu]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    if(!props.data){for(const line of rt.orbits.values()){rt.scene.remove(line);disposeObject(line);}rt.orbits.clear();}
    if(props.data){
      const guides=props.data.objects.filter(body=>body.kind!=='direction'&&body.object_id!=='sun'&&body.orbit&&rt.bodies.has(body.object_id)&&!(props.distanceView?.algorithm_version==='solar-overview-common-v2'&&body.kind==='moon'));
      const retained=new Set(guides.map(body=>body.object_id));
      for(const [id,line] of rt.orbits){if(!retained.has(id)){rt.scene.remove(line);disposeObject(line);rt.orbits.delete(id);}}
      for(const body of guides){
        const guide=body.orbit!;let line=rt.orbits.get(body.object_id);
        if(line?.userData.pointsReference!==guide.points_au||line?.userData.distanceFrame!==frameKey||(local&&body.kind!=='moon'&&line?.userData.originReference!==originAu)){
          const parent=body.kind==='moon'&&body.parent_id?rt.bodies.get(body.parent_id):null;
          // Local linearity permits an exact parent translation for relative
          // Moon vertices; no satellite-specific distance expansion is used.
          const vertices=body.kind==='moon'&&parent?(local?distanceViewOrbitPoints(guide.points_au,props.distanceView,[0,0,0]):guide.points_au.map(point=>displayMoonOffset(point,parent.body.radius_km??null,parent.radius)).filter((point):point is Vec3=>point!==null)):distanceViewOrbitPoints(guide.points_au,props.distanceView,originAu);
          if(vertices.length===0){if(line){rt.scene.remove(line);disposeObject(line);rt.orbits.delete(body.object_id);}continue;}
          const geometry=new THREE.BufferGeometry().setFromPoints(vertices.map(vertex=>new THREE.Vector3().fromArray(vertex)));
          if(line){line.geometry.dispose();line.geometry=geometry;}
          else{line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#718cad',transparent:true,opacity:.22,depthWrite:false}));line.name=`orbit-guide-${body.object_id}`;rt.orbits.set(body.object_id,line);rt.scene.add(line);}
          line.userData.pointsReference=guide.points_au;line.userData.distanceFrame=frameKey;line.userData.originReference=originAu;line.userData.epoch=guide.epoch;line.userData.kind=guide.kind;line.userData.parentId=body.kind==='moon'?body.parent_id:null;
        }
        if(line){if(body.kind==='moon'&&body.parent_id){const parent=rt.bodies.get(body.parent_id);if(parent)line.position.copy(parent.position);}else line.position.set(0,0,0);}
      }
    }
    const visible=props.showOrbits!==false;
    const selected=props.selectedObjectId?rt.bodies.get(props.selectedObjectId)?.body:null;const selectedParent=selected?.kind==='moon'?selected.parent_id:props.selectedObjectId;
    for(const [id,line] of rt.orbits){line.visible=visible&&(!line.userData.parentId||line.userData.parentId===selectedParent);line.material.opacity=id===props.selectedObjectId ? .58 : line.userData.parentId ? .055 : .22;line.material.color.set(id===props.selectedObjectId?'#b3ccec':'#718cad');}
    const visibleGuides=[...rt.orbits.entries()].filter(([,line])=>line.visible&&line.userData.kind==='osculating_kepler_guide').map(([id])=>id);const visibleTraces=[...rt.orbits.entries()].filter(([,line])=>line.visible&&line.userData.kind==='sampled_ephemeris_trace').map(([id])=>id);
    if(host.current){host.current.dataset.orbitCount=String(visibleGuides.length);host.current.dataset.orbitIds=visibleGuides.join(',');host.current.dataset.orbitKind='osculating_kepler_guide';host.current.dataset.traceCount=String(visibleTraces.length);host.current.dataset.traceIds=visibleTraces.join(',');}
  },[props.data,props.showOrbits,props.selectedObjectId,frameKey,originAu]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    const sequence=props.selectionSequence??0;
    const system=props.frameSelectedSystem??false;
    const representation=frameKey+':'+(props.selectedObjectId&&rt.bodies.has(props.selectedObjectId)?'native':!local&&props.outerTnoSelected?.position_au?`tno:${props.outerTnoSelected.object_id}`:'unavailable');
    const overviewSequence=props.overviewSequence??0;
    if(appliedOverview.current!==overviewSequence){appliedOverview.current=overviewSequence;rt.focusRequest={objectId:props.selectedObjectId,sequence,system,representation};rt.followedId=null;rt.focus={from:rt.cameraState(),to:{...INITIAL,position:INITIAL.position.map(value=>value*Math.max(1,1/rt.camera.aspect)) as Vec3,target:[...INITIAL.target]},startedAt:performance.now(),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000,objectId:''};rt.mode='focusing';rt.focusedId=null;rt.controls.enableDamping=false;rt.controls.minDistance=.2;rt.emit();return;}
    const restoreSequence=props.restoreSequence??0;
    if(props.restoredCamera&&validCamera(props.restoredCamera,props.distanceView)&&rt.restoredRequest?.sequence!==restoreSequence){rt.restoredRequest={sequence:restoreSequence,selectionSequence:sequence,objectId:props.selectedObjectId};rt.focusRequest={objectId:props.selectedObjectId,sequence,system,representation};rt.followedId=props.restoredFollowObjectId===props.selectedObjectId?props.selectedObjectId:null;rt.focus=null;rt.mode='restored';rt.focusedId=props.selectedObjectId;rt.controls.enableDamping=false;rt.controls.minDistance=surfaceClearanceDistance(rt.bodies.get(props.selectedObjectId??'')?.framingRadius??0,rt.camera.near);rt.applyCamera(props.restoredCamera);rt.controls.enableDamping=true;rt.emit();return;}
    if(rt.focusRequest?.objectId===props.selectedObjectId&&rt.focusRequest.sequence===sequence&&rt.focusRequest.system===system&&rt.focusRequest.representation===representation)return;
    const view=props.selectedObjectId?rt.bodies.get(props.selectedObjectId):null;if(!local&&!view&&props.selectedObjectId&&props.outerTnoSelected?.position_au){const center=rt.tno?.positionFor(props.outerTnoSelected.object_id)??displayPosition(props.outerTnoSelected.position_au);rt.focusRequest={objectId:props.selectedObjectId,sequence,system,representation};rt.focus=makeFocus(rt.cameraState(),props.selectedObjectId,center,.3,rt.camera.fov,rt.camera.aspect,performance.now(),window.matchMedia('(prefers-reduced-motion: reduce)').matches,false,2.5);rt.followedId=props.selectedObjectId;rt.focusedId=props.selectedObjectId;rt.mode='focusing';rt.controls.minDistance=.2;rt.emit();return;}if(!view){if(rt.focus?.objectId||rt.focusedId||rt.followedId){rt.focus=null;rt.mode='manual';rt.focusedId=null;rt.followedId=null;rt.controls.enableDamping=true;rt.emit();}if(!props.selectedObjectId)rt.focusRequest={objectId:null,sequence,system,representation};return;}
    rt.controls.enableDamping=false;rt.controls.update();
    const current=rt.cameraState();const center=view.direction?(view.body.direction_ecliptic??view.body.direction_ecliptic_unit)!:view.position.toArray() as Vec3;
    rt.focusRequest={objectId:props.selectedObjectId,sequence,system,representation};rt.followedId=view.body.object_id;
    rt.focus=makeFocus(current,view.body.object_id,center,view.framingRadius,rt.camera.fov,rt.camera.aspect,performance.now(),window.matchMedia('(prefers-reduced-motion: reduce)').matches,Boolean(view.direction),view.body.kind==='moon'?.05:2.5);
    rt.focusedId=view.body.object_id;rt.mode='focusing';rt.controls.minDistance=view.direction?.2:surfaceClearanceDistance(view.framingRadius,rt.camera.near);rt.emit();
  },[props.data,props.selectedObjectId,props.selectionSequence,props.overviewSequence,props.restoredCamera,props.restoredFollowObjectId,props.restoreSequence,props.frameSelectedSystem,props.appearance,props.outerTnoSelected,frameKey]);

  useEffect(()=>{
    const rt=runtime.current;if(rt){const view=props.selectedObjectId?rt.bodies.get(props.selectedObjectId):undefined;rt.controls.minDistance=view&&!view.direction?surfaceClearanceDistance(view.framingRadius,rt.camera.near):.2;rt.emit();}
  },[props.selectedObjectId]);
  useEffect(()=>{runtime.current?.renderer.domElement.setAttribute('aria-label',props.controlsLabel??'3D Solar System');},[props.controlsLabel]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.kuiper.visible=!local&&props.showKuiperBelt!==false;if(host.current){host.current.dataset.kuiperVisible=String(rt.kuiper.visible);host.current.dataset.kuiperRepresentation='seeded_illustrative_annulus_not_individual_positions_counts_or_density';host.current.dataset.kuiperInnerAu='30';host.current.dataset.kuiperOuterAu='50';}},[props.showKuiperBelt,local]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;const active=props.active!==false;rt.renderer.domElement.tabIndex=active?0:-1;if(host.current)host.current.dataset.sceneActive=String(active);if(active)rt.resume();},[props.active]);

  useEffect(()=>{
    const rt=runtime.current;if(!rt||!props.outerTnoCatalog)return;
    const layer=new TransNeptunianLayer(props.outerTnoCatalog.objects,{excludedIds:new Set(rt.bodies.keys()),visible:!localDistanceView(latest.current.distanceView)&&props.showOuterTno!==false});
    rt.tno=layer;rt.scene.add(layer.group);const statistics=layer.updateEpoch(props.outerTnoEpochJd??props.outerTnoCatalog.reference_jd_tdb);if(statistics)latest.current.onOuterTnoStats?.(statistics);
    if(host.current){host.current.dataset.outerTnoCatalogue=String(props.outerTnoCatalog.objects.length);host.current.dataset.outerTnoRendered=String(layer.count);}
    return()=>{rt.scene.remove(layer.group);layer.dispose();if(rt.tno===layer)rt.tno=null;};
  },[props.outerTnoCatalog]);
  useEffect(()=>{const rt=runtime.current;if(!rt?.tno||!props.outerTnoCatalog)return;rt.tno.update(props.outerTnoCatalog.objects,{excludedIds:new Set(rt.bodies.keys())});rt.tno.updateEpoch(props.outerTnoEpochJd??props.outerTnoCatalog.reference_jd_tdb);},[bodyIdentity,props.outerTnoCatalog]);
  useEffect(()=>{const rt=runtime.current;if(!rt?.tno)return;rt.tno.setVisible(!local&&props.showOuterTno!==false);if(host.current)host.current.dataset.outerTnoVisible=String(!local&&props.showOuterTno!==false);},[props.showOuterTno,props.outerTnoCatalog,local]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;const identified=Boolean(props.outerTnoCatalog)&&props.showOuterTno!==false;rt.kuiper.traverse(object=>{if(object instanceof THREE.Points)object.visible=!identified;});if(host.current)host.current.dataset.decorativeKuiperPoints=local||identified||props.showKuiperBelt===false?'0':'650';},[props.showOuterTno,props.outerTnoCatalog,props.showKuiperBelt,local]);
  useEffect(()=>{const rt=runtime.current;if(!rt?.tno)return;const detail=props.outerTnoSelected,id=props.selectedObjectId;const selected=!local&&detail&&detail.position_au&&id&&(detail.object_id===id||detail.known_object_id===id)?detail:null;rt.tno.setSelected(selected?.object_id??null,selected?.full_orbit_au??null);if(host.current){host.current.dataset.outerTnoSelected=selected?.object_id??'';host.current.dataset.outerTnoOrbitPoints=String(selected?.full_orbit_au?.length??0);}if(!selected&&id&&!rt.bodies.has(id)&&(rt.followedId===id||rt.focus?.objectId===id)){rt.focus=null;rt.followedId=null;rt.focusedId=null;rt.focusRequest=null;rt.mode='manual';rt.emit();}},[props.outerTnoSelected,props.selectedObjectId,bodyIdentity,props.outerTnoCatalog,local]);

  // The reference sphere is a visual guide, never a force cutoff or clipping wall.
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    const group=new THREE.Group();group.name='solar-scope-reference';
    if(props.showExplorationBoundary&&!local){
      const radius=18*Math.log1p(1000);
      for(let plane=0;plane<3;plane++){
        const vertices=Array.from({length:257},(_,index)=>{
          const angle=index/256*Math.PI*2,a=radius*Math.cos(angle),b=radius*Math.sin(angle);
          return new THREE.Vector3(...(plane===0?[a,0,b]:plane===1?[a,b,0]:[0,a,b]) as [number,number,number]);
        });
        const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineDashedMaterial({color:'#738caa',transparent:true,opacity:.2,dashSize:1.2,gapSize:1.5,depthWrite:false}));
        line.computeLineDistances();group.add(line);
      }
    }
    const points=props.hypothesisOrbitAu&&!local?displayOrbitPoints(props.hypothesisOrbitAu):[];
    if(points.length){
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(point=>new THREE.Vector3(...point))),new THREE.LineDashedMaterial({color:'#ffd58e',transparent:true,opacity:.85,dashSize:1.2,gapSize:.8,depthWrite:false}));
      line.name='planet-nine-hypothesis-guide';line.computeLineDistances();group.add(line);
    }
    rt.scene.add(group);
    return()=>{rt.scene.remove(group);disposeObject(group);};
  },[props.showExplorationBoundary,props.hypothesisOrbitAu,local]);

  return <div ref={host} className={styles.scene} style={props.active===false?{visibility:'hidden'}:undefined} aria-hidden={props.active===false?true:undefined} data-testid="universe-scene" data-distance-algorithm={props.distanceView?.algorithm_version??'legacy-expanded-v1'} data-distance-origin-object-id={local?props.distanceView?.origin_object_id??'':''} data-distance-scale-per-au={local?LOCAL_DISTANCE_SCALE:undefined} data-distance-origin-available={String(!local||Boolean(originAu))} data-exploration-radius-au={1000} data-exploration-boundary={String(Boolean(props.showExplorationBoundary)&&!local)} data-hypothesis-orbit-points={local?0:props.hypothesisOrbitAu?.length??0} data-selected-object={props.selectedObjectId??''}>
    <div ref={markersLayer} className={styles.markers}/>
    <div ref={labelsLayer} className={styles.labels} aria-label={props.controlsLabel}/>
    <div ref={markerLegend} hidden className={styles.positionMarkerLegend} data-testid="native-position-marker-legend">{props.positionMarkerLabel??'Position marker · not actual size or brightness'}</div>
    <div className={styles.representation}>{props.representationLabel??'Distance compressed · radii enlarged · artistic appearance'}</div>
    {error&&<div className={styles.error} role="alert"><p>{props.errorLabel??'3D rendering is unavailable in this browser.'}</p><div>{sceneObjects.map(body=><button key={body.object_id} onClick={()=>props.onSelect(body.object_id)}>{props.labels?.[body.object_id]??body.name}</button>)}</div></div>}
  </div>;
}
