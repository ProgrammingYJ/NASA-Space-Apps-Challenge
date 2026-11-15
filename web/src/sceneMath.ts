export type Vec3 = [number, number, number];
/** Camera transport stays v1; these fields declare how its numeric coordinates are interpreted. */
export interface DistanceView {algorithm_version:'solar-overview-common-v2'|'parent-linear-distance-v1'|'legacy-expanded-v1';origin_object_id?:string|null}
export const LOCAL_DISTANCE_SCALE=10000;
export interface CameraState {
  position: Vec3;
  target: Vec3;
  representation_version: 'solar-display-v1';
}

export const REPRESENTATION_VERSION = 'solar-display-v1';
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (v: Vec3, factor: number): Vec3 => [v[0] * factor, v[1] * factor, v[2] * factor];
export const magnitude = (v: Vec3) => Math.hypot(...v);
export function normalized(v: Vec3): Vec3 {
  const length = magnitude(v);
  return length > 1e-12 ? scale(v, 1 / length) : [0, 0.3713906763541037, 0.9284766908852594];
}

/** Radial display compression preserves direction; the output is not AU. */
export function displayPosition(positionAu: Vec3): Vec3 {
  const distanceAu = magnitude(positionAu);
  if (distanceAu === 0) return [0, 0, 0];
  const factor = 18 * Math.log1p(distanceAu) / distanceAu;
  return [positionAu[0] * factor, positionAu[2] * factor, -positionAu[1] * factor];
}

export function displayDirection(eclipticUnit: Vec3): Vec3 {
  return normalized([eclipticUnit[0], eclipticUnit[2], -eclipticUnit[1]]);
}

/** Transform every supplied guide vertex; nonlinear radial compression is not an ellipse transform. */
export function displayOrbitPoints(pointsAu: Vec3[]): Vec3[] {
  if(pointsAu.length<3||pointsAu.some(point=>!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)))return [];
  return pointsAu.map(displayPosition);
}

/** Parent-centered moon distances are expanded separately from heliocentric compression. */
export function displayMoonOffset(relativeAu:Vec3,parentRadiusKm:number|null,parentDisplayRadius:number):Vec3|null{
  if(!relativeAu.every(Number.isFinite)||(parentRadiusKm!==null&&(!Number.isFinite(parentRadiusKm)||parentRadiusKm<=0))||!Number.isFinite(parentDisplayRadius)||parentDisplayRadius<=0)return null;
  const radiusAu=magnitude(relativeAu);if(radiusAu===0)return [0,0,0];
  // Unknown physical radii stay unknown: 0.0001 AU is only a display reference.
  const referenceAu=parentRadiusKm===null?.0001:parentRadiusKm/149597870.7;
  const radiusInParentRadii=radiusAu/referenceAu;
  const distance=parentDisplayRadius*(1.8+1.35*Math.log1p(radiusInParentRadii));
  return scale(displayDirection(relativeAu),distance);
}

export interface DisplayBodyInput {object_id:string;kind:string;parent_id?:string;position_au?:Vec3;parent_relative_position_au?:Vec3;radius_km?:number|null}
const finiteVector=(value:unknown):value is Vec3=>Array.isArray(value)&&value.length===3&&value.every(component=>typeof component==='number'&&Number.isFinite(component));
function validDistanceView(view:DistanceView):boolean{
  if(view.algorithm_version==='parent-linear-distance-v1')return typeof view.origin_object_id==='string'&&view.origin_object_id.trim().length>0&&view.origin_object_id.length<=50;
  return (view.algorithm_version==='legacy-expanded-v1'||view.algorithm_version==='solar-overview-common-v2')&&view.origin_object_id==null;
}

/** Resolve source positions before any display mapping; a supplied parent-relative state takes precedence. */
export function bodySourcePositions(bodies:DisplayBodyInput[]):Map<string,Vec3>{
  const byId=new Map(bodies.map(body=>[body.object_id,body])),result=new Map<string,Vec3>(),visiting=new Set<string>();
  const locate=(id:string):Vec3|null=>{
    const previous=result.get(id);if(previous)return previous;const body=byId.get(id);if(!body||body.kind==='direction'||visiting.has(id))return null;
    visiting.add(id);let position:Vec3|null=null;
    if(body.kind==='moon'&&body.parent_id&&finiteVector(body.parent_relative_position_au)){
      const parent=locate(body.parent_id);if(parent)position=add(parent,body.parent_relative_position_au);
    }
    if(!position&&finiteVector(body.position_au))position=[...body.position_au];
    visiting.delete(id);if(position)result.set(id,position);return position;
  };
  bodies.forEach(body=>locate(body.object_id));return result;
}

/** One common mapper for every source position in a view. Local coordinates are linear, never AU-labelled display values. */
export function distanceViewPosition(positionAu:Vec3,view?:DistanceView,originAu?:Vec3):Vec3|null{
  if(!finiteVector(positionAu)||(view&&!validDistanceView(view)))return null;
  if(!view||view.algorithm_version==='legacy-expanded-v1'||view.algorithm_version==='solar-overview-common-v2')return displayPosition(positionAu);
  if(view.algorithm_version!=='parent-linear-distance-v1'||!view.origin_object_id||!finiteVector(originAu))return null;
  const relative=subtract(positionAu,originAu);
  const position:Vec3=[relative[0]*LOCAL_DISTANCE_SCALE,relative[2]*LOCAL_DISTANCE_SCALE,-relative[1]*LOCAL_DISTANCE_SCALE];
  return finiteVector(position)?position:null;
}

/** Every guide vertex uses exactly the same mapper and source origin as body centres. */
export function distanceViewOrbitPoints(pointsAu:Vec3[],view?:DistanceView,originAu?:Vec3):Vec3[]{
  if(pointsAu.length<3||pointsAu.some(point=>!finiteVector(point)))return [];
  const output=pointsAu.map(point=>distanceViewPosition(point,view,originAu));
  return output.every((point):point is Vec3=>point!==null)?output:[];
}

export function bodyDisplayPositions(bodies:DisplayBodyInput[],view?:DistanceView):Map<string,Vec3>{
  if(view&&view.algorithm_version!=='legacy-expanded-v1'){
    const source=bodySourcePositions(bodies),result=new Map<string,Vec3>();
    const origin=view.algorithm_version==='parent-linear-distance-v1'?source.get(view.origin_object_id??''):undefined;
    for(const [id,position]of source){const mapped=distanceViewPosition(position,view,origin);if(mapped)result.set(id,mapped);}
    return result;
  }
  const byId=new Map(bodies.map(body=>[body.object_id,body]));const result=new Map<string,Vec3>();const visiting=new Set<string>();
  const locate=(id:string):Vec3|null=>{
    const previous=result.get(id);if(previous)return previous;const body=byId.get(id);if(!body||visiting.has(id))return null;visiting.add(id);
    let position:Vec3|null=null;
    if(body.kind==='moon'&&body.parent_id){const parent=byId.get(body.parent_id);const parentPosition=locate(body.parent_id);const relative=body.parent_relative_position_au??(body.position_au&&parent?.position_au?subtract(body.position_au,parent.position_au):undefined);if(parent&&parentPosition&&relative){const offset=displayMoonOffset(relative,parent.radius_km??null,displayRadius(parent.radius_km??0,parent.object_id==='sun'));if(offset)position=add(parentPosition,offset);}}
    else if(body.kind!=='direction'&&body.position_au&&body.position_au.every(Number.isFinite))position=displayPosition(body.position_au);
    visiting.delete(id);if(position)result.set(id,position);return position;
  };
  bodies.forEach(body=>locate(body.object_id));return result;
}

/** Deliberately exaggerated for navigation, independent of distance compression. */
export function displayRadius(radiusKm: number, isSun = false): number {
  if (isSun) return 2.65;
  return Math.min(1.65, Math.max(0.32, 0.4 + 0.43 * Math.log1p(Math.max(0, radiusKm) / 6371)));
}

/** Fixed navigation marker radius. Selection and texture LOD never change a moon's geometry. */
export function displayMoonRadius(radiusKm:number|null):number {
  const knownRadius=radiusKm!==null&&Number.isFinite(radiusKm)&&radiusKm>0?radiusKm:0;
  return Math.max(.035,Math.min(.22,knownRadius/10000+.035));
}

export function focusDistance(radius: number, verticalFovDeg: number, aspect: number,minimumDistance=2.5): number {
  const limitingHalfFov = Math.atan(Math.tan(verticalFovDeg * Math.PI / 360) * Math.min(1, Math.max(0.2, aspect)));
  return Math.max(radius * 3.5, radius / Math.sin(limitingHalfFov) * 1.8, minimumDistance);
}

/** Minimum centre distance keeps the near plane outside the displayed bound. */
export function surfaceClearanceDistance(radius:number,nearPlane=.025):number {
  const safeRadius=Number.isFinite(radius)&&radius>0?radius:0;
  const safeNear=Number.isFinite(nearPlane)&&nearPlane>0?nearPlane:.025;
  return Math.max(.08,safeRadius*1.5,safeRadius+safeNear*3);
}

export interface FocusTransition {
  from: CameraState;
  to: CameraState;
  startedAt: number;
  duration: number;
  objectId: string;
  directionOnly?: boolean;
  sphericalCameraOffset?:boolean;
}

export interface NavigationMotion {
  camera:CameraState;
  transition:FocusTransition|null;
  followedObjectId:string|null;
}

/** Update navigation for a moving body using renderer coordinates, without creating a focus request. */
export function advanceNavigationForBody(
  navigation:NavigationMotion,
  objectId:string,
  previous:Vec3,
  current:Vec3,
  directionOnly=false,
):NavigationMotion {
  const moveCamera=(camera:CameraState):CameraState=>{
    if(directionOnly){const distance=magnitude(subtract(camera.target,camera.position));return {...camera,position:[...camera.position],target:add(camera.position,scale(normalized(current),distance))};}
    const delta=subtract(current,previous);return {...camera,position:add(camera.position,delta),target:add(camera.target,delta)};
  };
  if(navigation.transition?.objectId===objectId){return {...navigation,transition:{...navigation.transition,to:moveCamera(navigation.transition.to)}};}
  if(navigation.followedObjectId!==objectId)return navigation;
  return {...navigation,camera:moveCamera(navigation.camera)};
}

export function makeFocus(
  current: CameraState,
  objectId: string,
  center: Vec3,
  radius: number,
  fov: number,
  aspect: number,
  startedAt: number,
  reducedMotion: boolean,
  directionOnly = false,
  minimumDistance = 2.5,
): FocusTransition {
  const offset = normalized(subtract(current.position, current.target));
  const target = directionOnly ? add(current.position, scale(displayDirection(center), 80)) : center;
  const position = directionOnly ? [...current.position] as Vec3 : add(center, scale(offset, focusDistance(radius, fov, aspect,minimumDistance)));
  const travel = magnitude(subtract(current.position, position));
  return {
    from: { ...current, position: [...current.position], target: [...current.target] },
    to: { position, target, representation_version: REPRESENTATION_VERSION },
    startedAt,
    duration: reducedMotion ? 0 : directionOnly ? 1100 : Math.min(1500, Math.max(650, 550 + travel * 5)),
    objectId,
    directionOnly,
  };
}

function sphericalDirection(a:Vec3,b:Vec3,fraction:number):Vec3 {
  a=normalized(a);b=normalized(b);const dot=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
  const cross=(u:Vec3,v:Vec3):Vec3=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  let axis=cross(a,b);if(magnitude(axis)<1e-8)axis=cross(a,Math.abs(a[0])<.9?[1,0,0]:[0,1,0]);axis=normalized(axis);
  const angle=Math.acos(dot)*fraction;
  return add(scale(a,Math.cos(angle)),scale(cross(axis,a),Math.sin(angle)));
}

export function sampleFocus(transition: FocusTransition, time: number): {camera: CameraState; done: boolean} {
  const raw = transition.duration === 0 ? 1 : Math.max(0, Math.min(1, (time - transition.startedAt) / transition.duration));
  if (raw === 1) return {camera:{...transition.to,position:[...transition.to.position],target:[...transition.to.target]},done:true};
  if (raw === 0) return {camera:{...transition.from,position:[...transition.from.position],target:[...transition.from.target]},done:false};
  const eased = raw * raw * raw * (raw * (raw * 6 - 15) + 10);
  const lerp = (a: Vec3, b: Vec3): Vec3 => add(a, scale(subtract(b, a), eased));
  let target=lerp(transition.from.target,transition.to.target);
  let position=lerp(transition.from.position,transition.to.position);
  if(transition.directionOnly){
    const from=subtract(transition.from.target,transition.from.position);const to=subtract(transition.to.target,transition.to.position);
    const direction=sphericalDirection(from,to,eased);
    const distance=Math.max(.05,magnitude(from)+(magnitude(to)-magnitude(from))*eased);
    target=add(position,scale(direction,distance));
  }else if(transition.sphericalCameraOffset){
    const from=subtract(transition.from.position,transition.from.target),to=subtract(transition.to.position,transition.to.target);
    const distance=Math.max(.05,magnitude(from)+(magnitude(to)-magnitude(from))*eased);
    position=add(target,scale(sphericalDirection(from,to,eased),distance));
  }
  return {
    camera: { position, target, representation_version: REPRESENTATION_VERSION },
    done: raw === 1,
  };
}

export function validCamera(value: CameraState | null | undefined,view?:DistanceView): value is CameraState {
  if (!value || value.representation_version !== REPRESENTATION_VERSION) return false;
  if (!Array.isArray(value.position) || !Array.isArray(value.target) || value.position.length!==3 || value.target.length!==3) return false;
  if (![...value.position, ...value.target].every(Number.isFinite)) return false;
  if(view&&!validDistanceView(view))return false;
  const local=view?.algorithm_version==='parent-linear-distance-v1';
  if(local&&!view.origin_object_id)return false;
  const limit=local?1e8:10000;
  const distance = magnitude(subtract(value.position, value.target));
  return distance >= 0.05 && distance < limit && magnitude(value.position) < limit;
}
