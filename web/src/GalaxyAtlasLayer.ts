import * as THREE from 'three';
import {atlasMarkerBuffers,GALAXY_ATLAS_DISPLAY_VERSION,type GalaxyAtlasColumns,type AtlasBuffers} from './galaxyAtlasMath';
import type {Vec3} from './sceneMath';

function markerMaterial(size:number,pixelRatio:number,opacity:number){return new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{pointSize:{value:size},pixelRatio:{value:Math.max(1,Math.min(2,pixelRatio))},markerOpacity:{value:opacity}},vertexShader:'attribute vec3 atlasColor; varying vec3 markerColor; uniform float pointSize; uniform float pixelRatio; void main(){markerColor=atlasColor;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=pointSize*pixelRatio;}',fragmentShader:'varying vec3 markerColor; uniform float markerOpacity; void main(){float r=length(gl_PointCoord-vec2(0.5));float alpha=(1.0-smoothstep(0.29,0.5,r))*markerOpacity;if(alpha<=0.0)discard;gl_FragColor=vec4(markerColor,alpha);}'});}
export interface AtlasPick {object_id:string;distance_pixels:number;tested_candidates:number;candidate_limit_reached:boolean}
/** Two GPU draw calls at most; never creates one Object3D or DOM label per galaxy. */
export class GalaxyAtlasLayer {
  readonly group=new THREE.Group();
  readonly points:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  readonly selected:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  readonly quality:Omit<AtlasBuffers,'ids'|'positions'|'colours'>;
  private readonly ids:string[];
  private readonly indexById:Map<string,number>;
  private readonly picker=new THREE.Raycaster();
  private disposed=false;
  constructor(columns:GalaxyAtlasColumns,options:{excludedIds?:ReadonlySet<string>;pixelRatio?:number}={}){
    const buffers=atlasMarkerBuffers(columns,options.excludedIds);this.ids=buffers.ids;this.indexById=new Map(this.ids.map((id,index)=>[id,index]));
    this.quality={sourceCount:buffers.sourceCount,excludedCount:buffers.excludedCount,invalidCount:buffers.invalidCount,classes:buffers.classes};
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(buffers.positions,3).setUsage(THREE.StaticDrawUsage));geometry.setAttribute('atlasColor',new THREE.BufferAttribute(buffers.colours,3).setUsage(THREE.StaticDrawUsage));geometry.computeBoundingSphere();
    this.points=new THREE.Points(geometry,markerMaterial(2.8,options.pixelRatio??1,.65));this.points.name='source-backed-galaxy-atlas';this.points.userData.representation=GALAXY_ATLAS_DISPLAY_VERSION;
    const selectedGeometry=new THREE.BufferGeometry();selectedGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));selectedGeometry.setAttribute('atlasColor',new THREE.Float32BufferAttribute([1,.91,.65],3));this.selected=new THREE.Points(selectedGeometry,markerMaterial(10,options.pixelRatio??1,.92));this.selected.visible=false;this.selected.frustumCulled=false;
    this.group.name='galaxy-atlas-layer';this.group.add(this.points,this.selected);this.group.userData.sourceCount=buffers.sourceCount;this.group.userData.renderedCount=this.ids.length;
  }
  get count(){return this.ids.length;}
  getPosition(objectId:string):Vec3|null{const index=this.indexById.get(objectId);if(index===undefined)return null;const attribute=this.points.geometry.getAttribute('position');return [attribute.getX(index),attribute.getY(index),attribute.getZ(index)];}
  setVisible(visible:boolean){this.group.visible=visible;}
  setPixelRatio(value:number){for(const points of [this.points,this.selected])points.material.uniforms.pixelRatio.value=Math.max(1,Math.min(2,value));}
  setSelected(objectId:string|null){const point=objectId?this.getPosition(objectId):null;this.selected.visible=point!==null;if(point){const attribute=this.selected.geometry.getAttribute('position');attribute.setXYZ(0,...point);attribute.needsUpdate=true;}this.group.userData.selectedObjectId=point?objectId:null;}
  /** Click-only bounded picking. No catalogue scan is performed on animation frames. */
  pick(camera:THREE.PerspectiveCamera,ndc:THREE.Vector2,viewport:{width:number;height:number},pixelRadius=8):AtlasPick|null{
    if(this.disposed||!this.group.visible||!this.count||viewport.width<=0||viewport.height<=0||!Number.isFinite(pixelRadius)||pixelRadius<=0||pixelRadius>30)return null;
    this.group.updateWorldMatrix(true,true);camera.updateMatrixWorld();
    const sphere=this.points.geometry.boundingSphere;const maximumDistance=camera.position.distanceTo(this.group.position)+(sphere?.radius??0)+(sphere?.center.length()??0);
    this.picker.setFromCamera(ndc,camera);this.picker.near=camera.near;this.picker.far=camera.far;this.picker.params.Points={threshold:Math.max(.05,2*maximumDistance*Math.tan(camera.fov*Math.PI/360)*pixelRadius/viewport.height)};
    const hits=this.picker.intersectObject(this.points,false),limit=Math.min(4096,hits.length);let chosen:AtlasPick|null=null;
    const point=new THREE.Vector3(),attribute=this.points.geometry.getAttribute('position');
    // Hits are depth sorted. Indistinguishable subpixel centres retain the
    // foreground object rather than changing identity through roundoff.
    for(let i=0;i<limit;i++){const index=hits[i].index;if(index===undefined)continue;point.fromBufferAttribute(attribute,index).applyMatrix4(this.points.matrixWorld).project(camera);if(point.z<-1||point.z>1)continue;const distance=Math.hypot((point.x-ndc.x)*viewport.width/2,(point.y-ndc.y)*viewport.height/2);if(distance<=pixelRadius&&(!chosen||distance<chosen.distance_pixels-.05))chosen={object_id:this.ids[index],distance_pixels:distance,tested_candidates:limit,candidate_limit_reached:hits.length>limit};}
    return chosen;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.points.geometry.dispose();this.points.material.dispose();this.selected.geometry.dispose();this.selected.material.dispose();this.group.clear();this.indexById.clear();}
}
