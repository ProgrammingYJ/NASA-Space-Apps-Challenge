import * as THREE from 'three';
import {displayOrbitPoints} from './sceneMath';
import type {Vec3} from './sceneMath';
import {transNeptunianDisplayRows,transNeptunianEpochRows} from './TransNeptunianMath';
import {tnoPickCandidates} from './tnoSelection';
import type {TransNeptunianDisplayPoint,TransNeptunianPoint,TransNeptunianScreenCandidate,TransNeptunianEpochStats} from './TransNeptunianMath';
export type {TransNeptunianPoint} from './TransNeptunianMath';

export interface TransNeptunianLayerOptions {excludedIds?:ReadonlySet<string>;visible?:boolean;pointSize?:number}

/** One GPU Points draw call for identified TNOs plus a selected osculating orbit.
 * Positions are already date-dependent predictions from the catalogue API.
 * Size and color are navigation cues; no unmeasured surface/physical radius is made up.
 */
export class TransNeptunianLayer {
  readonly group=new THREE.Group();
  readonly points:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  private readonly selectedPoint:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  private readonly orbit:THREE.Line<THREE.BufferGeometry,THREE.LineDashedMaterial>;
  private rows:TransNeptunianDisplayPoint[]=[];
  private sourceRows:readonly TransNeptunianPoint[]=[];
  private epochStats:TransNeptunianEpochStats|null=null;
  private byId=new Map<string,TransNeptunianDisplayPoint>();
  private selectedId:string|null=null;
  private excludedIds:ReadonlySet<string>;
  private disposed=false;

  constructor(rows:readonly TransNeptunianPoint[]=[],options:TransNeptunianLayerOptions={}){
    this.excludedIds=options.excludedIds??new Set();
    this.group.name='catalogued-trans-neptunian-objects';this.group.visible=options.visible??true;
    this.points=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x8fc9e8,size:options.pointSize??2.8,sizeAttenuation:false,transparent:true,opacity:.82,depthWrite:false}));
    this.points.name='identified-TNO-markers';this.points.userData.kind='catalogued_tno_navigation_markers';
    this.selectedPoint=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xffc078,size:7,sizeAttenuation:false,transparent:true,opacity:1,depthTest:false,depthWrite:false}));
    this.selectedPoint.visible=false;this.selectedPoint.renderOrder=6;this.selectedPoint.name='selected-TNO-navigation-marker';
    this.orbit=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xffbb73,dashSize:1.2,gapSize:.7,transparent:true,opacity:.85,depthWrite:false}));
    this.orbit.visible=false;this.orbit.name='selected-TNO-osculating-ellipse';
    this.group.add(this.points,this.orbit,this.selectedPoint);this.update(rows);
  }
  get count(){return this.rows.length;}
  get statistics(){return this.epochStats?{...this.epochStats,rendered_count:this.count}:null;}
  get selectedObjectId(){return this.selectedId;}
  update(rows:readonly TransNeptunianPoint[],options:Pick<TransNeptunianLayerOptions,'excludedIds'>={}){
    if(this.disposed)return;
    if(options.excludedIds)this.excludedIds=options.excludedIds;
    this.sourceRows=rows;this.epochStats=null;this.setDisplayRows(rows);
  }
  /** Scene owns the250ms refresh throttle; no network request or time-state mutation. */
  updateEpoch(jdTdb:number):TransNeptunianEpochStats|null{
    if(this.disposed||!Number.isFinite(jdTdb))return null;
    if(this.epochStats?.jd_tdb===jdTdb)return this.epochStats;
    const result=transNeptunianEpochRows(this.sourceRows,jdTdb);this.epochStats=result.stats;this.setDisplayRows(result.rows);return {...result.stats};
  }
  private setDisplayRows(rows:readonly TransNeptunianPoint[]){
    this.rows=transNeptunianDisplayRows(rows,this.excludedIds);this.byId=new Map(this.rows.map(row=>[row.object_id,row]));
    let attribute=this.points.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
    if(!attribute||attribute.count<this.rows.length){attribute=new THREE.BufferAttribute(new Float32Array(Math.max(1,this.rows.length)*3),3);attribute.setUsage(THREE.DynamicDrawUsage);this.points.geometry.setAttribute('position',attribute);}
    this.rows.forEach((row,index)=>{attribute!.setXYZ(index,...row.display_position);});
    attribute.needsUpdate=true;this.points.geometry.setDrawRange(0,this.rows.length);this.points.geometry.computeBoundingSphere();this.points.visible=this.rows.length>0;
    this.updateSelectedPoint();
  }
  setVisible(visible:boolean){this.group.visible=visible;}
  setSelected(objectId:string|null,fullOrbitAu:readonly Vec3[]|null=null){
    if(this.disposed)return;
    this.selectedId=objectId;this.updateSelectedPoint();
    const points=fullOrbitAu?displayOrbitPoints([...fullOrbitAu]):[];
    this.orbit.geometry.dispose();this.orbit.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    this.orbit.visible=Boolean(objectId)&&points.length>=3;if(this.orbit.visible)this.orbit.computeLineDistances();
  }
  private updateSelectedPoint(){
    const value=this.selectedId?this.byId.get(this.selectedId):undefined;this.selectedPoint.visible=Boolean(value);
    if(value){let p=this.selectedPoint.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
      if(!p){p=new THREE.BufferAttribute(new Float32Array(3),3);this.selectedPoint.geometry.setAttribute('position',p);}p.setXYZ(0,...value.display_position);p.needsUpdate=true;this.selectedPoint.geometry.computeBoundingSphere();}
  }
  positionFor(objectId:string):Vec3|null{const row=this.byId.get(objectId);return row?[...row.display_position] as Vec3:null;}
  /** Project only on a click, not each frame. Every visible point within the
   * constant CSS-pixel hit area remains available in the overlap chooser. */
  pickCandidates(camera:THREE.Camera,ndc:THREE.Vector2,width:number,height:number,tolerancePx=9){
    if(this.disposed||!this.group.visible||!this.points.visible||width<=0||height<=0)return [];
    this.group.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);
    const candidates:TransNeptunianScreenCandidate[]=[];
    for(const row of this.rows){
      const point=new THREE.Vector3(...row.display_position).applyMatrix4(this.points.matrixWorld).project(camera);
      candidates.push({object_id:row.object_id,x:(point.x+1)*width/2,y:(1-point.y)*height/2,depth:point.z});}
    return tnoPickCandidates(candidates,(ndc.x+1)*width/2,(1-ndc.y)*height/2,tolerancePx);
  }
  pick(_raycaster:THREE.Raycaster,camera:THREE.Camera,ndc:THREE.Vector2,width:number,height:number,tolerancePx=9):string|null{return this.pickCandidates(camera,ndc,width,height,tolerancePx)[0]?.object_id??null;}
  dispose(){if(this.disposed)return;this.disposed=true;this.points.geometry.dispose();this.points.material.dispose();this.selectedPoint.geometry.dispose();this.selectedPoint.material.dispose();this.orbit.geometry.dispose();this.orbit.material.dispose();this.group.clear();this.rows=[];this.sourceRows=[];this.byId.clear();}
}
