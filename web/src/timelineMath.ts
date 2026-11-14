import type {UniverseData} from './UniverseScene';
import type {Vec3} from './sceneMath';

export const TIMELINE_ALGORITHM='display-hermite-v1' as const;
export const PLAYBACK_RATES=[1,6,24,72] as const;
export type PlaybackRate=typeof PLAYBACK_RATES[number];
export interface TimelineKnot {epoch:string;tdb_jd:number;states:Record<string,{position_au:Vec3;velocity_au_day:Vec3}>;directions:Record<string,{direction_ecliptic:Vec3;direction_icrs_deg:{ra:number;dec:number}}>}
export interface TimelineData {schema_version:string;algorithm_version:typeof TIMELINE_ALGORITHM;start_epoch:string;end_epoch:string;default_epoch:string;guide_reference_epoch:string;source_manifest_sha256:string;timeline_validation_sha256:string|null;knots:TimelineKnot[];limitations:string[]}
export interface Bounds {start:number;end:number}

export function epochText(ms:number){return new Date(ms).toISOString();}
export function timelineBounds(data:TimelineData):Bounds {return {start:Date.parse(data.start_epoch),end:Date.parse(data.end_epoch)};}
export function advancePlayback(epoch:number,elapsedMs:number,rate:PlaybackRate,bounds:Bounds){
  if(![epoch,elapsedMs,bounds.start,bounds.end].every(Number.isFinite)||bounds.end<=bounds.start||!PLAYBACK_RATES.includes(rate))throw new Error('invalid_playback_clock');
  const next=Math.min(bounds.end,Math.max(bounds.start,epoch)+Math.max(0,Math.min(100,elapsedMs))*rate*3600);
  return {epoch:next,ended:next===bounds.end};
}
export function hermite(p0:Vec3,v0:Vec3,p1:Vec3,v1:Vec3,u:number,days:number):{position:Vec3;velocity:Vec3}{
  if(!Number.isFinite(u)||u<0||u>1||!Number.isFinite(days)||days<=0||![...p0,...v0,...p1,...v1].every(Number.isFinite))throw new Error('invalid_interpolation');
  if(u===0)return {position:[...p0],velocity:[...v0]};if(u===1)return {position:[...p1],velocity:[...v1]};
  const position=p0.map((p,i)=>(2*u**3-3*u**2+1)*p+(u**3-2*u**2+u)*days*v0[i]+(-2*u**3+3*u**2)*p1[i]+(u**3-u**2)*days*v1[i]) as Vec3;
  const velocity=p0.map((p,i)=>(6*u*u-6*u)/days*p+(3*u*u-4*u+1)*v0[i]+(-6*u*u+6*u)/days*p1[i]+(3*u*u-2*u)*v1[i]) as Vec3;
  return {position,velocity};
}
export function timelineScene<T extends UniverseData>(base:T,data:TimelineData,epoch:number):T{
  const bounds=timelineBounds(data);if(!Number.isFinite(epoch)||epoch<bounds.start||epoch>bounds.end||data.algorithm_version!==TIMELINE_ALGORITHM)throw new Error('unsupported_model_epoch');
  const exact=data.knots.find(k=>Date.parse(k.epoch)===epoch);
  let index=data.knots.findIndex((k,i)=>i<data.knots.length-1&&epoch>=Date.parse(k.epoch)&&epoch<=Date.parse(data.knots[i+1].epoch));
  if(index<0)index=data.knots.length-2;
  const a=data.knots[index],b=data.knots[index+1];
  // UTC clock → linearly mapped TDB interval; avoids subtracting large JD values
  // every frame. Python parity tests bound this display-time approximation.
  const fraction=(epoch-Date.parse(a.epoch))/(Date.parse(b.epoch)-Date.parse(a.epoch));
  const days=b.tdb_jd-a.tdb_jd;
  const interpolation={method:'cubic_hermite',algorithm_version:TIMELINE_ALGORITHM,time_coordinate:'TDB',source_epochs:[a.epoch,b.epoch],fraction};
  return {...base,epoch:epochText(epoch),guide_reference_epoch:data.guide_reference_epoch,timeline_algorithm_version:TIMELINE_ALGORITHM,
    position_sampling:exact?'source_exact':'display_interpolation',
    interpolation:exact?null:interpolation,
    objects:base.objects.map(body=>{
      if(body.kind==='solar_system'&&body.object_id!=='sun'){
        const p=exact?.states[body.object_id];const av=a.states[body.object_id],bv=b.states[body.object_id];
        if(!av||!bv)throw new Error('missing_timeline_body');
        const state=p?{position:p.position_au,velocity:p.velocity_au_day}:hermite(av.position_au,av.velocity_au_day,bv.position_au,bv.velocity_au_day,fraction,days);
        return {...body,position_au:state.position,velocity_au_day:state.velocity,position_epoch_utc:epochText(epoch),position_kind:exact?'geometric_ephemeris_sample':'interpolated_ephemeris',interpolation:exact?null:interpolation};
      }
      if(body.kind==='direction'){
        const av=a.directions[body.object_id],bv=b.directions[body.object_id];const ev=exact?.directions[body.object_id];if(!av||!bv)return body;
        const direction=ev?.direction_ecliptic??av.direction_ecliptic.map((v,i)=>v+(bv.direction_ecliptic[i]-v)*fraction) as Vec3;
        const norm=Math.hypot(...direction);const delta=((bv.direction_icrs_deg.ra-av.direction_icrs_deg.ra+540)%360)-180;
        return {...body,direction_ecliptic:ev?direction:direction.map(v=>v/norm) as Vec3,direction_icrs_deg:ev?.direction_icrs_deg??{ra:(av.direction_icrs_deg.ra+delta*fraction+360)%360,dec:av.direction_icrs_deg.dec+(bv.direction_icrs_deg.dec-av.direction_icrs_deg.dec)*fraction},direction_epoch_utc:epochText(epoch),position_kind:exact?'catalog_proper_motion_direction':'interpolated_catalog_direction'};
      }
      return body;
    })} as T;
}
