import {displayPosition} from './sceneMath';
import type {Vec3} from './sceneMath';

export interface TransNeptunianPoint {
  object_id:string;
  name:string;
  known_object_id:string|null;
  position_au?:Vec3|null;
  reference_position_au?:Vec3|null;
  orbit?:TransNeptunianOrbit|null;
  radius_au?:number|null;
  within_1000_au?:boolean|null;
  position_status?:string;
  long_range_extrapolation?:boolean;
  epoch_offset_days?:number|null;
}
export interface TransNeptunianOrbit {a_au:number;e:number;i_deg:number;omega_deg:number;Omega_deg:number;M_deg:number;epoch_jd_tdb:number}
export interface TransNeptunianEpochStats {jd_tdb:number;catalogue_count:number;plotted_count:number;unavailable_count:number;outside_1000_au_count:number;extrapolated_count:number;extrapolated_plotted_count:number}
const SOLAR_MU=1.32712440041279419e20*86400**2/149597870700**3;
export const TNO_ALGORITHM_VERSION='jpl-sbdb-tno-two-body-v2';
export const TNO_SUPPORTED_MIN_JD=625697.5,TNO_SUPPORTED_MAX_JD=2816787.5,TNO_EXTRAPOLATION_WARNING_DAYS=36525;
/** Same declared solar Kepler equation as the Node catalogue, not a fresh ephemeris. */
export function transNeptunianPosition(orbit:TransNeptunianOrbit,jd:number):Vec3|null {
  if(!Number.isFinite(jd)||jd<TNO_SUPPORTED_MIN_JD||jd>TNO_SUPPORTED_MAX_JD||Object.values(orbit).some(value=>!Number.isFinite(value))||orbit.a_au<=0||orbit.e<0||orbit.e>=1)return null;
  const a=orbit.a_au,e=orbit.e,mean=((orbit.M_deg*Math.PI/180+Math.sqrt(SOLAR_MU/a**3)*(jd-orbit.epoch_jd_tdb)+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  let E=mean,low=-Math.PI,high=Math.PI;
  for(let i=0;i<80;i++){const residual=E-e*Math.sin(E)-mean;if(Math.abs(residual)<2e-15)break;if(residual>0)high=E;else low=E;const next=E-residual/(1-e*Math.cos(E));E=next>low&&next<high?next:(low+high)/2;}
  if(Math.abs(E-e*Math.sin(E)-mean)>1e-12)return null;
  const x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e**2)*Math.sin(E),w=orbit.omega_deg*Math.PI/180,O=orbit.Omega_deg*Math.PI/180,I=orbit.i_deg*Math.PI/180;
  const p:Vec3=[(Math.cos(w)*Math.cos(O)-Math.sin(w)*Math.sin(O)*Math.cos(I))*x+(-Math.sin(w)*Math.cos(O)-Math.cos(w)*Math.sin(O)*Math.cos(I))*y,
    (Math.cos(w)*Math.sin(O)+Math.sin(w)*Math.cos(O)*Math.cos(I))*x+(-Math.sin(w)*Math.sin(O)+Math.cos(w)*Math.cos(O)*Math.cos(I))*y,
    Math.sin(w)*Math.sin(I)*x+Math.cos(w)*Math.sin(I)*y];
  return p.every(Number.isFinite)?p:null;
}
export function transNeptunianEpochRows(rows:readonly TransNeptunianPoint[],jd:number):{rows:TransNeptunianPoint[];stats:TransNeptunianEpochStats}{
  const result:TransNeptunianPoint[]=[],stats:TransNeptunianEpochStats={jd_tdb:jd,catalogue_count:rows.length,plotted_count:0,unavailable_count:0,outside_1000_au_count:0,extrapolated_count:0,extrapolated_plotted_count:0};
  for(const row of rows){const p=row.orbit?transNeptunianPosition(row.orbit,jd):null;if(!p){stats.unavailable_count++;continue;}
    const offset=jd-row.orbit!.epoch_jd_tdb,extrapolated=Math.abs(offset)>TNO_EXTRAPOLATION_WARNING_DAYS;
    if(extrapolated)stats.extrapolated_count++;
    const radius=Math.hypot(...p);if(radius>1000){stats.outside_1000_au_count++;continue;}
    if(extrapolated)stats.extrapolated_plotted_count++;
    stats.plotted_count++;result.push({...row,position_au:p,radius_au:radius,within_1000_au:true,position_status:extrapolated?'unvalidated_kepler_extrapolation':'osculating_two_body_prediction',long_range_extrapolation:extrapolated,epoch_offset_days:offset});}
  return {rows:result,stats};
}
export interface TransNeptunianDisplayPoint {object_id:string;name:string;position_au:Vec3;display_position:Vec3}

/** Each plotted vertex is one identified source row, never a decorative belt particle. */
export function transNeptunianDisplayRows(rows:readonly TransNeptunianPoint[],excludedIds:ReadonlySet<string>=new Set()):TransNeptunianDisplayPoint[] {
  const seen=new Set<string>();
  return rows.flatMap(row=>{
    const position=row.position_au===undefined?row.reference_position_au:row.position_au;
    if(!row.object_id||seen.has(row.object_id)||excludedIds.has(row.object_id)||(row.known_object_id!==null&&excludedIds.has(row.known_object_id))
      ||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return [];
    const radius=Math.hypot(...position);
    if(radius>1000||radius<=0)return [];
    seen.add(row.object_id);
    return [{object_id:row.object_id,name:row.name,position_au:[...position] as Vec3,display_position:displayPosition(position)}];
  });
}

export interface TransNeptunianScreenCandidate {object_id:string;x:number;y:number;depth:number}
/** Fixed screen-space tolerance avoids treating marker size as physical body radius. */
export function nearestTransNeptunianCandidate(candidates:readonly TransNeptunianScreenCandidate[],x:number,y:number,tolerancePx=7):string|null {
  if(![x,y,tolerancePx].every(Number.isFinite)||tolerancePx<=0)return null;
  let best:TransNeptunianScreenCandidate|null=null,bestDistance=tolerancePx*tolerancePx;
  for(const candidate of candidates){
    if(![candidate.x,candidate.y,candidate.depth].every(Number.isFinite)||candidate.depth< -1||candidate.depth>1)continue;
    const distance=(candidate.x-x)**2+(candidate.y-y)**2;
    if(distance<bestDistance||(distance===bestDistance&&(!best||candidate.depth<best.depth||(candidate.depth===best.depth&&candidate.object_id<best.object_id)))){best=candidate;bestDistance=distance;}
  }
  return best?.object_id??null;
}
