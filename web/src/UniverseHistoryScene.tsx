import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {historyVisualState,seededRandom} from './historySceneMath';
import type {Vec3} from './sceneMath';
import styles from './UniverseHistoryScene.module.css';

export interface HistoryCameraState {position:Vec3;target:Vec3;representation_version:'cosmic-concept-v1'}
export interface UniverseHistorySceneProps {
  visible:boolean;
  /** Time since the Big Bang, in Gyr. It is not a lookback time. */
  ageGyr:number;
  stageId?:string;
  controlsLabel?:string;
  conceptualLabel?:string;
  errorLabel?:string;
  onCameraChange?:(camera:HistoryCameraState)=>void;
  onError?:(message:string)=>void;
}
interface HistoryRuntime {renderer:THREE.WebGLRenderer;resume:()=>void;disposed:boolean;frame:number}

function glowTexture():THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d')!;const glow=ctx.createRadialGradient(64,64,0,64,64,64);
  glow.addColorStop(0,'#ffffff');glow.addColorStop(.08,'#e8eaff');glow.addColorStop(.22,'rgba(155,179,255,.35)');glow.addColorStop(1,'rgba(100,130,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}

/** A free-camera conceptual history. No catalogue coordinates or source images are replayed into the past. */
export default function UniverseHistoryScene(props:UniverseHistorySceneProps) {
  const host=useRef<HTMLDivElement>(null),runtime=useRef<HistoryRuntime|null>(null),latest=useRef(props);latest.current=props;
  const [error,setError]=useState(false);
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(cause){setError(true);latest.current.onError?.(cause instanceof Error?cause.message:'webgl_unavailable');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));renderer.setSize(container.clientWidth,Math.max(1,container.clientHeight));renderer.setClearColor('#02040d');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    const canvas=renderer.domElement;canvas.className=styles.canvas;canvas.dataset.testid='history-canvas';canvas.tabIndex=latest.current.visible?0:-1;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',latest.current.controlsLabel??'Conceptual cosmic history. Drag to rotate, wheel to zoom, right drag to pan. W A S D or arrow keys to move.');container.prepend(canvas);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,container.clientWidth/Math.max(1,container.clientHeight),.05,2200);camera.position.set(0,30,115);
    const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=2;controls.maxDistance=650;controls.rotateSpeed=.65;controls.panSpeed=.8;controls.zoomSpeed=.9;controls.screenSpacePanning=true;
    const random=seededRandom(473821),map=glowTexture();
    const world=new THREE.Group();scene.add(world);
    const radiationMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,uniforms:{plasmaWeight:{value:1},cmbWeight:{value:0}},vertexShader:/* glsl */`varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:/* glsl */`
      uniform float plasmaWeight;uniform float cmbWeight;varying vec3 direction;
      void main(){vec3 p=direction*5.0;float field=sin(p.x*2.7+sin(p.z*3.0))*sin(p.y*2.1+cos(p.x*2.0));field=field*.5+.5;float fine=sin(p.x*14.0+p.y*11.0)*sin(p.z*13.0+p.y*7.0)*.5+.5;vec3 hot=mix(vec3(.16,.018,.012),vec3(1.0,.45,.12),field);vec3 fading=mix(vec3(.12,.055,.06),vec3(.48,.24,.11),fine*.12+field*.4);gl_FragColor=vec4(hot*plasmaWeight+fading*cmbWeight,max(plasmaWeight*.72,cmbWeight*.5));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }
    `});
    const radiation=new THREE.Mesh(new THREE.SphereGeometry(1000,48,32),radiationMaterial);radiation.raycast=()=>{};scene.add(radiation);
    const points=(positions:number[],colors:number[],size:number,opacity:number)=>{
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const material=new THREE.PointsMaterial({size,map,vertexColors:true,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});const cloud=new THREE.Points(geometry,material);world.add(cloud);return cloud;
    };
    const plasmaPositions:number[]=[],plasmaColors:number[]=[];
    for(let i=0;i<3600;i++){const phi=random()*Math.PI*2,z=random()*2-1,radius=25+Math.pow(random(),.3)*125,q=Math.sqrt(1-z*z);plasmaPositions.push(radius*q*Math.cos(phi),radius*z,radius*q*Math.sin(phi));const color=new THREE.Color().setHSL(.035+random()*.07,.84,.37+random()*.3);plasmaColors.push(color.r,color.g,color.b);}
    const plasma=points(plasmaPositions,plasmaColors,11,.8);
    const cmb=points(plasmaPositions,plasmaColors,3.1,.6);
    const galaxyPositions:number[]=[],galaxyColors:number[]=[],starPositions:number[]=[],starColors:number[]=[],nodes:THREE.Vector3[]=[];
    // Stable illustrative clusters and filaments. Their count/density have no measured meaning.
    for(let g=0;g<35;g++){
      const node=new THREE.Vector3((random()-.5)*240,(random()-.5)*95,(random()-.5)*170);nodes.push(node);const angle=random()*Math.PI*2,tilt=(random()-.5)*1.1,rotation=new THREE.Euler(tilt,angle,(random()-.5)*.4);const radius=2.2+random()*6.5;
      for(let i=0;i<190;i++){const r=Math.pow(random(),.65)*radius,a=(i%3)*Math.PI*2/3+r*.7+(random()-.5)*.5;const v=new THREE.Vector3(Math.cos(a)*r,(random()-.5)*radius*.12,Math.sin(a)*r).applyEuler(rotation).add(node);galaxyPositions.push(v.x,v.y,v.z);const c=new THREE.Color().setHSL(r/radius>.5?.61:.11,.3,.58+random()*.3);galaxyColors.push(c.r,c.g,c.b);}
      for(let i=0;i<35;i++){starPositions.push(node.x+(random()-.5)*30,node.y+(random()-.5)*20,node.z+(random()-.5)*30);const c=new THREE.Color().setHSL(.1+random()*.55,.2,.6+random()*.35);starColors.push(c.r,c.g,c.b);}
    }
    const galaxies=points(galaxyPositions,galaxyColors,.85,1),stars=points(starPositions,starColors,1.15,.8);
    const filamentPositions:number[]=[];
    for(let i=0;i<nodes.length;i++){const neighbors=nodes.map((node,j)=>({node,j,d:node.distanceToSquared(nodes[i])})).filter(value=>value.j!==i).sort((a,b)=>a.d-b.d).slice(0,2);for(const neighbor of neighbors){filamentPositions.push(...nodes[i].toArray(),...neighbor.node.toArray());}}
    const filaments=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(filamentPositions,3)),new THREE.LineBasicMaterial({color:'#6478c0',transparent:true,opacity:.12,depthWrite:false}));world.add(filaments);
    const solar=new THREE.Group();solar.position.set(15,-5,15);world.add(solar);
    const sun=new THREE.Sprite(new THREE.SpriteMaterial({map,color:'#ffcf83',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sun.scale.set(9,9,1);solar.add(sun);
    const disk=new THREE.Mesh(new THREE.RingGeometry(3.2,10,128),new THREE.MeshBasicMaterial({color:'#ac8f73',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));disk.rotation.x=-Math.PI/2;disk.rotation.z=.3;solar.add(disk);
    const orbitalMarks:number[]=[];for(let i=0;i<8;i++){const r=3.6+i*.82,a=i*2.399;orbitalMarks.push(Math.cos(a)*r,0,Math.sin(a)*r);}
    const planetMarks=points(orbitalMarks,Array.from({length:24},()=>.8),.65,.8);world.remove(planetMarks);solar.add(planetMarks);
    const rt:HistoryRuntime={renderer,disposed:false,frame:0,resume:()=>{}};runtime.current=rt;
    const emit=()=>{container.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(6)).join(',');container.dataset.cameraTarget=controls.target.toArray().map(v=>v.toFixed(6)).join(',');latest.current.onCameraChange?.({position:camera.position.toArray() as Vec3,target:controls.target.toArray() as Vec3,representation_version:'cosmic-concept-v1'});};
    controls.addEventListener('end',emit);const keys=new Set<string>(),moveKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
    const keydown=(event:KeyboardEvent)=>{if(!latest.current.visible||document.activeElement!==canvas||!moveKeys.has(event.code))return;event.preventDefault();keys.add(event.code);};const keyup=(event:KeyboardEvent)=>{if(keys.delete(event.code))emit();};const blur=()=>keys.clear();const focus=()=>canvas.focus({preventScroll:true});
    canvas.addEventListener('pointerdown',focus);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
    const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(container);
    const forward=new THREE.Vector3(),right=new THREE.Vector3(),move=new THREE.Vector3();let previous=performance.now();
    const animate=(now:number)=>{
      if(rt.disposed)return;if(!latest.current.visible){rt.frame=0;keys.clear();return;}rt.frame=requestAnimationFrame(animate);const elapsed=Math.min(.05,(now-previous)/1000);previous=now;
      const state=historyVisualState(latest.current.ageGyr);world.scale.setScalar(state.expansion);radiationMaterial.uniforms.plasmaWeight.value=state.plasma;radiationMaterial.uniforms.cmbWeight.value=state.lastScattering;radiation.visible=state.plasma+state.lastScattering>.001;plasma.material.opacity=.85*state.plasma;plasma.visible=state.plasma>.001;cmb.material.opacity=.7*state.lastScattering;cmb.visible=state.lastScattering>.001;stars.material.opacity=state.stars*.75;galaxies.material.opacity=state.structure;filaments.material.opacity=state.structure*.1;solar.visible=state.solar>.001;(sun.material as THREE.SpriteMaterial).opacity=state.solar;(disk.material as THREE.MeshBasicMaterial).opacity=state.solar*.16;planetMarks.material.opacity=state.solar;
      if(keys.size){camera.getWorldDirection(forward);right.crossVectors(forward,camera.up).normalize();move.set(0,0,0);if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);if(keys.has('KeyA')||keys.has('ArrowLeft'))move.sub(right);if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);if(keys.has('KeyQ'))move.sub(camera.up);if(keys.has('KeyE'))move.add(camera.up);move.normalize().multiplyScalar(elapsed*Math.max(8,camera.position.distanceTo(controls.target))*.6);camera.position.add(move);controls.target.add(move);emit();}
      controls.update();renderer.render(scene,camera);container.dataset.ageGyr=String(state.ageGyr);container.dataset.stageId=latest.current.stageId??'';container.dataset.frameCount=String(Number(container.dataset.frameCount??0)+1);
    };
    rt.resume=()=>{if(rt.disposed||rt.frame||!latest.current.visible)return;previous=performance.now();rt.frame=requestAnimationFrame(animate);};rt.resume();emit();
    return()=>{rt.disposed=true;cancelAnimationFrame(rt.frame);resize.disconnect();controls.dispose();canvas.removeEventListener('pointerdown',focus);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);scene.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Points||child instanceof THREE.LineSegments){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(material=>material.dispose());}else if(child instanceof THREE.Sprite)child.material.dispose();});map.dispose();renderer.dispose();canvas.remove();runtime.current=null;};
  },[]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.renderer.domElement.tabIndex=props.visible?0:-1;if(props.visible)rt.resume();},[props.visible]);
  useEffect(()=>{runtime.current?.renderer.domElement.setAttribute('aria-label',props.controlsLabel??'Conceptual cosmic history');},[props.controlsLabel]);
  return <div ref={host} className={styles.scene} style={props.visible?undefined:{visibility:'hidden'}} aria-hidden={!props.visible} data-testid="history-scene" data-scene-active={String(props.visible)} data-representation="conceptual-history-v1">
    <p className={styles.legend}>{props.conceptualLabel??'Conceptual cosmic history · illustrative structures and sizes · not reconstructed past coordinates or an observation'}</p>
    {error&&<div className={styles.error} role="alert">{props.errorLabel??'3D rendering is unavailable in this browser.'}</div>}
  </div>;
}
