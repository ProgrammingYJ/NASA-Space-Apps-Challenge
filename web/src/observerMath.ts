import type {Vec3} from './sceneMath';

export const AU_KM=149597870.7;
export const AU_PER_MPC=1e6*648000/Math.PI;
export const OBSERVER_MODEL_VERSION='observer-coordinate-snapshot-v1' as const;
export interface DistanceRedshiftRow {z:number;comoving_distance_mpc:number}
export interface ObserverExperimentState {
  enabled:boolean;
  mode:'catalogue_camera'|'black_hole_local';
  radial_beta:number;
  emitted_wavelength_nm:number;
  cosmological_enabled:boolean;
  gravitational_enabled:boolean;
  emitter_radius_rs:number;
  local_observer_radius_rs:number;
  local_observer_azimuth_rad:number;
}
export const DEFAULT_OBSERVER_STATE:ObserverExperimentState={enabled:false,mode:'catalogue_camera',radial_beta:0,emitted_wavelength_nm:550,cosmological_enabled:true,gravitational_enabled:false,emitter_radius_rs:6,local_observer_radius_rs:20,local_observer_azimuth_rad:0};
const validVector=(v:Vec3)=>v.length===3&&v.every(Number.isFinite);

/** Exact inverse of the project's radial display transform, not measured travel. */
export function inverseDisplayPosition(position:Vec3):Vec3|null {
  if(!validVector(position))return null;
  const displayDistance=Math.hypot(...position);if(displayDistance===0)return [0,0,0];
  const distanceAu=Math.expm1(displayDistance/18);if(!Number.isFinite(distanceAu))return null;
  const factor=distanceAu/displayDistance;
  const result:Vec3=[position[0]*factor,-position[2]*factor,position[1]*factor];
  return validVector(result)?result:null;
}
/** Current spatial slice only; neither a light cone nor a physical trajectory. */
export function observerResidualDistance(sourcePositionAu:Vec3,cameraDisplayPosition:Vec3){
  if(!validVector(sourcePositionAu))return null;
  const observerAu=inverseDisplayPosition(cameraDisplayPosition);if(!observerAu)return null;
  const displacement:Vec3=sourcePositionAu.map((value,i)=>value-observerAu[i]) as Vec3;
  const distanceAu=Math.hypot(...displacement);if(!Number.isFinite(distanceAu))return null;
  return {observer_au:observerAu,residual_au:distanceAu,residual_mpc:distanceAu/AU_PER_MPC};
}
/** Wavelength ratio, receding beta positive. No camera-frame timing is used. */
export function radialDopplerLambdaFactor(beta:number):number|null {
  if(!Number.isFinite(beta)||Math.abs(beta)>=1)return null;
  return Math.sqrt((1+beta)/(1-beta));
}
/** Wavelength ratio for two static Schwarzschild observers; null radius = infinity. */
export function staticSchwarzschildLambdaFactor(emitterRadiusRs:number|null,observerRadiusRs:number|null):number|null {
  const potential=(r:number|null)=>r===null?1:Number.isFinite(r)&&r>1?1-1/r:null;
  const emitter=potential(emitterRadiusRs),observer=potential(observerRadiusRs);
  if(emitter===null||observer===null)return null;
  return Math.sqrt(observer/emitter);
}
/** Monotone interpolation of a provenance-backed model table; no extrapolation. */
export function redshiftForComovingDistance(distanceMpc:number,rows:DistanceRedshiftRow[]):number|null {
  if(!Number.isFinite(distanceMpc)||distanceMpc<0||rows.length<2||rows[0].z!==0||rows[0].comoving_distance_mpc!==0)return null;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];if(!Number.isFinite(row.z)||!Number.isFinite(row.comoving_distance_mpc)||row.z<0||row.comoving_distance_mpc<0)return null;
    if(i&&!(row.z>rows[i-1].z&&row.comoving_distance_mpc>rows[i-1].comoving_distance_mpc))return null;
  }
  if(distanceMpc===0)return 0;
  const last=rows[rows.length-1];if(distanceMpc>last.comoving_distance_mpc)return null;
  let low=0,high=rows.length-1;
  while(high-low>1){const mid=(low+high)>>>1;if(rows[mid].comoving_distance_mpc<distanceMpc)low=mid;else high=mid;}
  const a=rows[low],b=rows[high],fraction=(distanceMpc-a.comoving_distance_mpc)/(b.comoving_distance_mpc-a.comoving_distance_mpc);
  return a.z+(b.z-a.z)*fraction;
}
export function wavelengthForRedshift(emittedNm:number,redshift:number):number|null {
  if(!Number.isFinite(emittedNm)||emittedNm<=0||!Number.isFinite(redshift)||redshift<=-1)return null;
  const result=emittedNm*(1+redshift);return Number.isFinite(result)&&result>0?result:null;
}
/** Independent factor product is an explanatory approximation, not a joint spacetime solution. */
export function modeledWavelength(emittedNm:number,cosmologicalZ:number,beta:number,gravitationalFactor:number){
  const baseline=wavelengthForRedshift(emittedNm,cosmologicalZ),doppler=radialDopplerLambdaFactor(beta);
  if(baseline===null||doppler===null||!Number.isFinite(gravitationalFactor)||gravitationalFactor<=0)return null;
  const wavelengthNm=baseline*doppler*gravitationalFactor;
  if(!Number.isFinite(wavelengthNm)||wavelengthNm<=0)return null;
  return {wavelength_nm:wavelengthNm,lambda_factor:(1+cosmologicalZ)*doppler*gravitationalFactor,cosmological_factor:1+cosmologicalZ,doppler_factor:doppler,gravitational_factor:gravitationalFactor};
}
/** Display-only hue key. It is neither a measured spectrum nor a colorimetric rendering. */
export function wavelengthSwatch(wavelengthNm:number):{band:'outside_visible'|'visible'|'unavailable';color:string}{
  if(!Number.isFinite(wavelengthNm)||wavelengthNm<=0)return {band:'unavailable',color:'#5c6571'};
  if(wavelengthNm<380||wavelengthNm>780)return {band:'outside_visible',color:'#8e91a3'};
  const anchors=[[380,275],[440,240],[490,180],[510,120],[580,60],[620,25],[700,0],[780,0]];
  const end=anchors.findIndex((row,i)=>i>0&&wavelengthNm<=row[0]);const a=anchors[end-1],b=anchors[end],fraction=(wavelengthNm-a[0])/(b[0]-a[0]);
  return {band:'visible',color:'hsl('+(a[1]+(b[1]-a[1])*fraction).toFixed(2)+' 76% 56%)'};
}
