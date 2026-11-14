import type {Vec3} from './sceneMath';

export const MOON_SIMULATION_ALGORITHM='parent-relative-osculating-kepler-v1' as const;
export const MOON_GM_SOURCE={
  url:'https://ssd.jpl.nasa.gov/astro_par.html',
  source_sha256:'168f48b94ae3a65f31c96f081d08e7ca91ecc9e65678fdc57353821b492b313e',
  local_path:'data/reference/planet-nine/facts/jpl_constants.json',
  units:'km3/s2',au_km:149597870.7,day_s:86400,
  earth_gm_km3_s2:398600.435507,moon_gm_km3_s2:4902.800118,
  convention:'adopted_DE440_planetary_system_GM_for_massless_parent_relative_two_body_approximation',
} as const;
// Existing source transcription. System GM is an adopted approximation for each
// local orbit; this does not measure the selected moon's mass.
export const MOON_PARENT_GM_KM3_S2:Readonly<Record<string,number>>=Object.freeze({
  earth:403503.23562500003,mars:42828.375816,jupiter:126712764.1,
  saturn:37940584.8418,uranus:5794556.4,neptune:6836527.10058,
});
// Earth and Moon entries on the same immutable JPL source page. The existing
// fitted "earth" marker represents EMB, so a geocentric Moon offset is rescaled.
export const EARTH_MOON_OFFSET_SCALE=MOON_GM_SOURCE.earth_gm_km3_s2/(MOON_GM_SOURCE.earth_gm_km3_s2+MOON_GM_SOURCE.moon_gm_km3_s2);
export const moonGmAu3Day2=(gmKm3S2:number)=>gmKm3S2*MOON_GM_SOURCE.day_s**2/MOON_GM_SOURCE.au_km**3;

export interface MoonReferenceState {tdb_jd:number;position_au:Vec3;velocity_au_day:Vec3}
export interface MoonOsculatingModel {
  source_epoch_jd_tdb:number;gm_au3_day2:number;semimajor_axis_au:number;eccentricity:number;
  mean_motion_rad_day:number;period_days:number;mean_anomaly_epoch_rad:number;
  periapsis_direction:Vec3;transverse_direction:Vec3;orbit_points_au:Vec3[];
}
export interface MoonPropagatedState {position_au:Vec3;velocity_au_day:Vec3}
const TAU=2*Math.PI;
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const vector=(value:unknown):value is Vec3=>Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='number'&&Number.isFinite(v));
const wrap=(angle:number)=>((angle+Math.PI)%TAU+TAU)%TAU-Math.PI;
function position(model:Pick<MoonOsculatingModel,'semimajor_axis_au'|'eccentricity'|'periapsis_direction'|'transverse_direction'>,E:number):Vec3{
  const a=model.semimajor_axis_au,e=model.eccentricity,x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);
  return model.periapsis_direction.map((v,i)=>x*v+y*model.transverse_direction[i]) as Vec3;
}

/** Osculating ellipse from a source state in one already verified inertial frame.
 * No Laplace/equatorial mean-element frame or radius-derived mass is substituted.
 */
export function fitMoonOsculatingState(state:MoonReferenceState,gmAu3Day2:number):MoonOsculatingModel|null{
  if(!state||!Number.isFinite(state.tdb_jd)||!vector(state.position_au)||!vector(state.velocity_au_day)||!Number.isFinite(gmAu3Day2)||gmAu3Day2<=0)return null;
  const r=state.position_au,v=state.velocity_au_day,distance=Math.hypot(...r),h=cross(r,v),hLength=Math.hypot(...h);
  if(!(distance>0&&hLength>0))return null;
  const energy=dot(v,v)/2-gmAu3Day2/distance,a=-gmAu3Day2/(2*energy),vxh=cross(v,h);
  const eccentricityVector=vxh.map((component,i)=>component/gmAu3Day2-r[i]/distance) as Vec3;
  const rawE=Math.hypot(...eccentricityVector);
  if(!(Number.isFinite(a)&&a>0&&Number.isFinite(rawE)&&rawE<1&&energy<0))return null;
  const e=rawE<1e-12?0:rawE;
  const p=scale(e===0?r:eccentricityVector,1/(e===0?distance:rawE)),q=cross(scale(h,1/hLength),p);
  const E=Math.atan2(dot(r,q)/(a*Math.sqrt(1-e*e)),dot(r,p)/a+e),n=Math.sqrt(gmAu3Day2/a**3),period=TAU/n;
  if(!(Number.isFinite(n)&&n>0&&Number.isFinite(period)&&period>0&&vector(p)&&vector(q)))return null;
  const model:MoonOsculatingModel={source_epoch_jd_tdb:state.tdb_jd,gm_au3_day2:gmAu3Day2,semimajor_axis_au:a,eccentricity:e,
    mean_motion_rad_day:n,period_days:period,mean_anomaly_epoch_rad:wrap(E-e*Math.sin(E)),periapsis_direction:p,transverse_direction:q,orbit_points_au:[]};
  model.orbit_points_au=Array.from({length:129},(_,i)=>position(model,i===128?0:i*TAU/128));
  return model;
}

/** A nominal massless two-body extrapolation, with no long-term accuracy claim. */
export function propagateMoonOsculating(model:MoonOsculatingModel,jdTdb:number):MoonPropagatedState|null{
  const dt=jdTdb-model.source_epoch_jd_tdb;
  if(!Number.isFinite(jdTdb)||!Number.isFinite(dt)||Math.abs(dt)>Number.MAX_SAFE_INTEGER)return null;
  // Reduce elapsed time before multiplying by mean motion, including at very
  // large dates. Numerical finiteness is not a physical validity interval.
  const M=wrap(model.mean_anomaly_epoch_rad+model.mean_motion_rad_day*(dt%model.period_days));
  let E=M,converged=false;
  for(let i=0;i<40;i++){
    const denominator=1-model.eccentricity*Math.cos(E),change=(E-model.eccentricity*Math.sin(E)-M)/denominator;
    E-=change;if(!Number.isFinite(E))return null;if(Math.abs(change)<1e-13){converged=true;break;}
  }
  if(!converged)return null;
  const p=position(model,E),a=model.semimajor_axis_au,e=model.eccentricity,dEdt=model.mean_motion_rad_day/(1-e*Math.cos(E));
  const x=-a*Math.sin(E)*dEdt,y=a*Math.sqrt(1-e*e)*Math.cos(E)*dEdt;
  const v=model.periapsis_direction.map((component,i)=>x*component+y*model.transverse_direction[i]) as Vec3;
  return vector(p)&&vector(v)?{position_au:p,velocity_au_day:v}:null;
}
