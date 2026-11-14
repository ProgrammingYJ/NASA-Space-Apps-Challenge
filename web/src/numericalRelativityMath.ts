export const NR_ALGORITHM='sxs-nrar-h22-native-replay-v1';
export const NR_OBJECT_ID='sxs-bbh-0305-lev6-n2-com-v1';
export const NR_DATASET='Extrapolated_N2.dir/Y_l2_m2.dat';
export const NR_PLAYBACK_RATES=[.1,.25,.5,1,2,4] as const;
export const C_M_S=299792458;
export const GM_SUN_NOMINAL=1.3271244e20;
export const MPC_M=648000/Math.PI*149597870700*1e6;
export const NR_TIME_PER_MSUN=GM_SUN_NOMINAL/C_M_S**3;
export const NR_LENGTH_PER_MSUN=GM_SUN_NOMINAL/C_M_S**2;
// Conservative operating restriction for displaying an asymptotic waveform.
// This chosen ratio is not a physical transition or an accuracy/error bound.
export const NR_MIN_DISTANCE_OVER_GM_C2=1e6;
const SHA=/^[a-f0-9]{64}$/;

export interface NumericalRelativityData {
  schema_version:string;algorithm_version:string;object_id:string;name:string;
  source_manifest_sha256:string;record_doi:string;record_version:string;dataset:string;
  sample_count:number;time_range_over_m:[number,number];peak_h22_sample_index:number;peak_h22_time_over_m:number;
  ell:number;m:number;spin_weight:number;resolution:string;extrapolation_order:number;
  center_of_mass_corrected:boolean;gravitational_memory_added:boolean;
  live_gr_solver:boolean;observed_detector_data:boolean;arbitrary_mass_ratio_or_spin_interpolation:boolean;
  reference_parameters:{mass_ratio_m1_over_m2:number;dimensionless_spin1:number[];dimensionless_spin2:number[];eccentricity:number;number_of_orbits:number;remnant_mass_code_units:number;remnant_dimensionless_spin:number[]};
  scaling:{seconds_per_solar_mass:number;metres_per_solar_mass:number;mpc_m:number};
  data:{sha256:string;source_sha256:string;downsampling:boolean;phase_rotation:boolean;time_shift:boolean;normalization_change:boolean};
  sources:{url:string;sha256:string;bytes:number;path:string}[];
  rights:{spdx:string;license_url:string;attribution:string};
  format_documentation_url:string;limitations:string[];
  columns:{time_over_m:number[];rh22_over_m_real:number[];rh22_over_m_imag:number[]};
}
export interface NRSetup {
  schema_version:'1.0';kind:'numerical-relativity-replay';algorithm_version:typeof NR_ALGORITHM;
  source_manifest_sha256:string;derived_sha256:string;raw_sha256:string;object_id:typeof NR_OBJECT_ID;
  mass_total_msun:number;distance_mpc:number;sample_index:number;time_over_m:number;
  playback_rate:number;playback_paused:true;
}

function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('nr_invalid_object');return value as Record<string,unknown>;}
function vector(value:unknown,length?:number):number[]{if(!Array.isArray(value)||(length!==undefined&&value.length!==length)||value.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('nr_invalid_numeric_array');return value as number[];}
function positive(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>0;}
function sha(value:unknown){return typeof value==='string'&&SHA.test(value);}
export function validateNRData(value:unknown):NumericalRelativityData {
  const v=record(value),columns=record(v.columns),data=record(v.data),parameters=record(v.reference_parameters),scaling=record(v.scaling),rights=record(v.rights);
  if(v.schema_version!=='1.0'||v.algorithm_version!==NR_ALGORITHM||v.object_id!==NR_OBJECT_ID||v.dataset!==NR_DATASET||v.record_doi!=='10.5281/zenodo.1215528')throw new Error('nr_source_version_mismatch');
  if(!sha(v.source_manifest_sha256)||!sha(data.sha256)||!sha(data.source_sha256))throw new Error('nr_missing_source_identity');
  if(v.ell!==2||v.m!==2||v.spin_weight!==-2||v.extrapolation_order!==2||v.resolution!=='Lev6'||v.center_of_mass_corrected!==true||v.gravitational_memory_added!==false)throw new Error('nr_unsupported_mode');
  if(v.live_gr_solver!==false||v.observed_detector_data!==false||v.arbitrary_mass_ratio_or_spin_interpolation!==false||data.downsampling!==false||data.phase_rotation!==false||data.time_shift!==false||data.normalization_change!==false)throw new Error('nr_unsupported_processing');
  if(rights.spdx!=='CC-BY-4.0')throw new Error('nr_license_mismatch');
  const t=vector(columns.time_over_m),real=vector(columns.rh22_over_m_real),imag=vector(columns.rh22_over_m_imag);
  if(!Number.isInteger(v.sample_count)||t.length!==v.sample_count||t.length<2||t.length>1e6||real.length!==t.length||imag.length!==t.length)throw new Error('nr_sample_count_mismatch');
  let maximum=-Infinity,maximumIndex=0;for(let i=0;i<t.length;i++){if(i&&t[i]<=t[i-1])throw new Error('nr_nonmonotonic_native_time');const amplitude=Math.hypot(real[i],imag[i]);if(amplitude>maximum){maximum=amplitude;maximumIndex=i;}}
  const range=vector(v.time_range_over_m,2),peak=v.peak_h22_sample_index;
  if(range[0]!==t[0]||range[1]!==t.at(-1)||typeof peak!=='number'||!Number.isInteger(peak)||peak<0||peak>=t.length||v.peak_h22_time_over_m!==t[peak]||peak!==maximumIndex)throw new Error('nr_time_metadata_mismatch');
  if(!positive(parameters.mass_ratio_m1_over_m2)||parameters.mass_ratio_m1_over_m2<1)throw new Error('nr_invalid_mass_ratio');
  for(const key of ['dimensionless_spin1','dimensionless_spin2','remnant_dimensionless_spin'])if(Math.hypot(...vector(parameters[key],3))>1.000001)throw new Error('nr_invalid_spin');
  if(typeof parameters.eccentricity!=='number'||!Number.isFinite(parameters.eccentricity)||parameters.eccentricity<0||parameters.eccentricity>=1||!positive(parameters.number_of_orbits)||!positive(parameters.remnant_mass_code_units))throw new Error('nr_invalid_reference_parameters');
  for(const [key,expected] of [['seconds_per_solar_mass',NR_TIME_PER_MSUN],['metres_per_solar_mass',NR_LENGTH_PER_MSUN],['mpc_m',MPC_M]] as const)if(typeof scaling[key]!=='number'||!Number.isFinite(scaling[key])||Math.abs((scaling[key] as number)/expected-1)>1e-13)throw new Error('nr_scaling_constants_mismatch');
  if(!Array.isArray(v.sources)||!v.sources.length||v.sources.some(s=>{const x=record(s);return !sha(x.sha256)||!positive(x.bytes)||typeof x.url!=='string'||!x.url.startsWith('https://');})||record(v.sources[0]).sha256!==data.source_sha256)throw new Error('nr_raw_source_mismatch');
  if(typeof v.name!=='string'||typeof rights.attribution!=='string'||typeof rights.license_url!=='string'||typeof v.format_documentation_url!=='string'||!Array.isArray(v.limitations)||v.limitations.some(x=>typeof x!=='string'))throw new Error('nr_missing_source_description');
  return value as NumericalRelativityData;
}

export function nrScales(mass_total_msun:number,distance_mpc:number){
  if(!positive(mass_total_msun)||mass_total_msun>1e12||!positive(distance_mpc)||distance_mpc>1e12)throw new Error('nr_invalid_scale');
  const minimumDistanceMpc=NR_MIN_DISTANCE_OVER_GM_C2*NR_LENGTH_PER_MSUN*mass_total_msun/MPC_M;
  if(distance_mpc<minimumDistanceMpc)throw new Error('nr_far_field_display_restriction');
  const time=NR_TIME_PER_MSUN*mass_total_msun,strain=NR_LENGTH_PER_MSUN*mass_total_msun/(distance_mpc*MPC_M);
  if(!Number.isFinite(time)||!Number.isFinite(strain)||time===0||strain===0)throw new Error('nr_invalid_scale');
  return {seconds_per_time_over_m:time,strain_per_rh22_over_m:strain};
}
export function nativeSample(data:NumericalRelativityData,index:number,mass:number,distance:number){
  if(!Number.isInteger(index)||index<0||index>=data.sample_count)throw new Error('nr_invalid_sample_index');
  const scale=nrScales(mass,distance),t=data.columns.time_over_m[index],real=data.columns.rh22_over_m_real[index],imag=data.columns.rh22_over_m_imag[index];
  return {index,time_over_m:t,time_s:t*scale.seconds_per_time_over_m,real:real*scale.strain_per_rh22_over_m,imag:imag*scale.strain_per_rh22_over_m,amplitude:Math.hypot(real,imag)*scale.strain_per_rh22_over_m};
}
export function nearestNativeIndex(times:readonly number[],target:number){
  if(!times.length||!Number.isFinite(target))throw new Error('nr_invalid_seek');
  if(target<=times[0])return 0;if(target>=times[times.length-1])return times.length-1;
  let low=0,high=times.length-1;while(high-low>1){const middle=(low+high)>>1;if(times[middle]<=target)low=middle;else high=middle;}
  return target-times[low]<=times[high]-target?low:high;
}
export function advanceNRReplay(currentTimeOverM:number,elapsedSeconds:number,rate:number,mass:number,endTimeOverM:number){
  if(!Number.isFinite(currentTimeOverM)||!Number.isFinite(endTimeOverM)||!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!NR_PLAYBACK_RATES.includes(rate as typeof NR_PLAYBACK_RATES[number]))throw new Error('nr_invalid_playback');
  return Math.min(endTimeOverM,currentTimeOverM+elapsedSeconds*rate/nrScales(mass,1).seconds_per_time_over_m);
}
export function serializeNRSetup(data:NumericalRelativityData,options:{mass:number;distance:number;index:number;rate:number}):NRSetup{
  const {mass,distance,index,rate}=options;nrScales(mass,distance);const sample=nativeSample(data,index,mass,distance);
  if(!NR_PLAYBACK_RATES.includes(rate as typeof NR_PLAYBACK_RATES[number]))throw new Error('nr_invalid_playback');
  return {schema_version:'1.0',kind:'numerical-relativity-replay',algorithm_version:NR_ALGORITHM,source_manifest_sha256:data.source_manifest_sha256,derived_sha256:data.data.sha256,raw_sha256:data.data.source_sha256,object_id:NR_OBJECT_ID,mass_total_msun:mass,distance_mpc:distance,sample_index:index,time_over_m:sample.time_over_m,playback_rate:rate,playback_paused:true};
}
export function restoreNRSetup(value:unknown,data:NumericalRelativityData):NRSetup{
  const v=record(value);
  const keys=['schema_version','kind','algorithm_version','source_manifest_sha256','derived_sha256','raw_sha256','object_id','mass_total_msun','distance_mpc','sample_index','time_over_m','playback_rate','playback_paused'];
  if(Object.keys(v).length!==keys.length||Object.keys(v).some(key=>!keys.includes(key)))throw new Error('nr_invalid_setup_fields');
  if(v.schema_version!=='1.0'||v.kind!=='numerical-relativity-replay'||v.algorithm_version!==data.algorithm_version||v.object_id!==data.object_id||v.source_manifest_sha256!==data.source_manifest_sha256||v.derived_sha256!==data.data.sha256||v.raw_sha256!==data.data.source_sha256||v.playback_paused!==true)throw new Error('nr_setup_source_mismatch');
  if(typeof v.mass_total_msun!=='number'||typeof v.distance_mpc!=='number'||typeof v.sample_index!=='number'||typeof v.playback_rate!=='number')throw new Error('nr_invalid_setup');
  const checked=serializeNRSetup(data,{mass:v.mass_total_msun,distance:v.distance_mpc,index:v.sample_index,rate:v.playback_rate});
  if(v.time_over_m!==checked.time_over_m)throw new Error('nr_setup_time_mismatch');
  return checked;
}
