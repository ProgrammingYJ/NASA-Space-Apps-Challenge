import type {UniverseData,UniverseBody,OrbitGuide} from './UniverseScene';
import type {Vec3} from './sceneMath';
import type {ExtendedObject,ExtendedCatalog} from './extendedMath';
import {EARTH_MOON_OFFSET_SCALE,fitMoonOsculatingState,propagateMoonOsculating,MOON_SIMULATION_ALGORITHM,MOON_GM_SOURCE,MOON_PARENT_GM_KM3_S2,moonGmAu3Day2,type MoonOsculatingModel} from './moonKepler';

export interface MoonSimulationMetadata {
  algorithm_version:typeof MOON_SIMULATION_ALGORITHM;status:'unvalidated_two_body_extrapolation';
  source_epoch_jd_tdb:number;source_epoch_utc_label:string;source_response_sha256:string;
  source_position_reference:'parent_body_center';position_reference:'parent_body_center'|'earth_moon_barycenter';
  gm_km3_s2:number;gm_au3_day2:number;gm_source:typeof MOON_GM_SOURCE;display_offset_scale:number;
  semimajor_axis_au:number;eccentricity:number;period_days:number;
  propagated_position_uncertainty:null;new_classification:null;long_term_accuracy_verified:false;
}
export interface SimulatedMoonBody extends UniverseBody {moon_algorithm_version:typeof MOON_SIMULATION_ALGORITHM;moon_simulation:MoonSimulationMetadata}
export interface SimulationMoonSummary {
  algorithm_version:typeof MOON_SIMULATION_ALGORITHM;status:'source_catalogue_missing'|'unvalidated_approximation';
  source_manifest_sha256:string|null;source_moon_count:number;added_count:number;
  omitted:{object_id:string;parent_id:string;reason:'source_unavailable'|'missing_parent'|'invalid_source_frame_or_center'|'missing_or_unbound_source_state'|'invalid_target_phase'}[];
  gm_source:typeof MOON_GM_SOURCE;assumptions:string[];
}
export interface SimulationSceneOptions {sourceUniverse?:UniverseData;extendedCatalogue?:Pick<ExtendedCatalog,'objects'|'source_manifest_sha256'>}
export type SimulationSceneResult<T extends UniverseData>=T&{moon_simulation:SimulationMoonSummary};
export function simulationMoonMetadata(body:UniverseBody|undefined):MoonSimulationMetadata|undefined{return (body as SimulatedMoonBody|undefined)?.moon_simulation;}

const MOON_ASSUMPTIONS=[
  'Saved parent-relative geometric r/v in J2000 ecliptic coordinates defines an osculating bound ellipse; selected-date phases are unvalidated two-body extrapolations, not precision past or future ephemerides.',
  'The eight fitted planetary parents are prescribed. Moon models are independent massless particles using an adopted planetary-system GM; mutual perturbations, planetary J2, tides, resonances and orbital evolution are not integrated.',
  'The fitted Earth marker remains the Earth-Moon barycenter. Its geocentric Moon vector is converted to an EMB-relative offset with the source Earth/(Earth+Moon) GM ratio; no precise Earth-center reconstruction is claimed.',
  'Missing source vectors, invalid frames, unbound ellipses and absent parents remain unavailable. No source-epoch position, radius-derived mass or another moon orbit fills a missing position.',
];
interface PreparedMoonModel {model:MoonOsculatingModel;guide:OrbitGuide;metadata:MoonSimulationMetadata}
const preparedMoonModels=new WeakMap<ExtendedObject,PreparedMoonModel|null>();
const centerIds:Record<string,string>={earth:'399',mars:'499',jupiter:'599',saturn:'699',uranus:'799',neptune:'899'};
function verifiedMoonSource(record:ExtendedObject){
  try{
    const url=new URL(record.source?.url??'');const value=(key:string)=>url.searchParams.get(key)?.replace(/^'|'$/g,'');
    return url.protocol==='https:'&&url.hostname==='ssd.jpl.nasa.gov'&&url.pathname==='/api/horizons.api'
      &&value('EPHEM_TYPE')==='VECTORS'&&value('REF_PLANE')==='ECLIPTIC'&&value('REF_SYSTEM')==='ICRF'
      &&value('OUT_UNITS')==='AU-D'&&value('VEC_CORR')==='NONE'&&value('CENTER')===`500@${centerIds[record.parent_id]}`
      &&/^[a-f0-9]{64}$/.test(record.source?.sha256??'');
  }catch{return false;}
}
function prepareMoonModel(record:ExtendedObject):PreparedMoonModel|null{
  if(preparedMoonModels.has(record))return preparedMoonModels.get(record)!;
  const gm=MOON_PARENT_GM_KM3_S2[record.parent_id],knot=record.knots?.[0];
  const model=knot&&gm?fitMoonOsculatingState(knot,moonGmAu3Day2(gm)):null;
  if(!model){preparedMoonModels.set(record,null);return null;}
  const offsetScale=record.parent_id==='earth'?EARTH_MOON_OFFSET_SCALE:1;
  const metadata:MoonSimulationMetadata={algorithm_version:MOON_SIMULATION_ALGORITHM,status:'unvalidated_two_body_extrapolation',
    source_epoch_jd_tdb:knot!.tdb_jd,source_epoch_utc_label:knot!.epoch,source_response_sha256:record.source!.sha256,
    source_position_reference:'parent_body_center',position_reference:record.parent_id==='earth'?'earth_moon_barycenter':'parent_body_center',
    gm_km3_s2:gm,gm_au3_day2:model.gm_au3_day2,gm_source:MOON_GM_SOURCE,display_offset_scale:offsetScale,
    semimajor_axis_au:model.semimajor_axis_au,eccentricity:model.eccentricity,period_days:model.period_days,
    propagated_position_uncertainty:null,new_classification:null,long_term_accuracy_verified:false};
  const guide:OrbitGuide={kind:'fitted_kepler_simulation_guide',epoch:knot!.epoch,epoch_tdb_jd:knot!.tdb_jd,
    points_au:offsetScale===1?model.orbit_points_au:model.orbit_points_au.map(point=>point.map(value=>value*offsetScale) as Vec3),
    closed:true,center:record.parent_id,coordinate_frame:'Ecliptic of J2000.0',units:'au',
    source:{url:record.source!.url,label:'Saved JPL state · source-epoch osculating Moon ellipse',sha256:record.source!.sha256},limitations:MOON_ASSUMPTIONS};
  const result={model,guide,metadata};preparedMoonModels.set(record,result);return result;
}

export interface ModelDate {year:number;month:number;day:number}
export interface ModelDateDraft {year:string;month:string;day:string}
export interface LongTermBody {object_id:string;elements_j2000:number[];rates_per_century:number[];additional_terms:{b:number;c:number;s:number;f:number}}
export interface LongTermModel {
  algorithm_version:'jpl-kepler-long-term-v1';source_manifest_sha256:string;
  coverage:{min_date:ModelDate;max_date:ModelDate};
  tables:{long:{bodies:LongTermBody[]};short:{bodies:LongTermBody[]}};
  source?:{url:string;label:string};limitations:string[];
}
const rad=Math.PI/180;
/** Numeric calendar labels interpreted as TDB by the model, not historical UTC. */
export function modelDateMs(year:number,month=1,day=1){
  if(![year,month,day].every(Number.isInteger)||month<1||month>12||day<1||day>31)throw new Error('invalid_model_date');
  const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('invalid_model_date');
  return date.getTime();
}
export function modelDateParts(ms:number):ModelDate {const d=new Date(ms);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}
export function parseModelDateDraft(draft:ModelDateDraft):ModelDate {
  if(!/^-?\d+$/.test(draft.year)||!/^\d+$/.test(draft.month)||!/^\d+$/.test(draft.day))throw new Error('invalid_model_date');
  const date={year:Number(draft.year),month:Number(draft.month),day:Number(draft.day)};
  if(![date.year,date.month,date.day].every(Number.isSafeInteger))throw new Error('invalid_model_date');
  modelDateMs(date.year,date.month,date.day);
  return date;
}
export function simulationOrbit(body:LongTermBody,ms:number):Vec3[] {
  const T=(2440587.5+ms/86400000-2451545)/36525;
  const [a,e,I,,p,N]=body.elements_j2000.map((v,i)=>v+T*body.rates_per_century[i]);
  const w=(p-N)*rad,n=N*rad,inc=I*rad;
  return Array.from({length:129},(_,i)=>{const E=i*Math.PI*2/128,x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);return [
    (Math.cos(w)*Math.cos(n)-Math.sin(w)*Math.sin(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.cos(n)-Math.cos(w)*Math.sin(n)*Math.cos(inc))*y,
    (Math.cos(w)*Math.sin(n)+Math.sin(w)*Math.cos(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.sin(n)+Math.cos(w)*Math.cos(n)*Math.cos(inc))*y,
    Math.sin(w)*Math.sin(inc)*x+Math.cos(w)*Math.sin(inc)*y] as Vec3;});
}
export function simulationPosition(body:LongTermBody,ms:number):Vec3 {
  if(!Number.isFinite(ms))throw new Error('invalid_model_date');
  const T=(2440587.5+ms/86400000-2451545)/36525;
  const [a,e,I,L,p,N]=body.elements_j2000.map((value,i)=>value+T*body.rates_per_century[i]);
  const {b=0,c=0,s=0,f=0}=body.additional_terms??{};
  if(!(a>0&&e>=0&&e<1))throw new Error('unsupported_model_elements');
  const M=((L-p+b*T*T+c*Math.cos(f*T*rad)+s*Math.sin(f*T*rad)+180)%360+360)%360-180;
  let E=M*rad;for(let i=0;i<30;i++){const change=(E-e*Math.sin(E)-M*rad)/(1-e*Math.cos(E));E-=change;if(Math.abs(change)<1e-13)break;}
  const x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E),w=(p-N)*rad,n=N*rad,inc=I*rad;
  return [(Math.cos(w)*Math.cos(n)-Math.sin(w)*Math.sin(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.cos(n)-Math.cos(w)*Math.sin(n)*Math.cos(inc))*y,
    (Math.cos(w)*Math.sin(n)+Math.sin(w)*Math.cos(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.sin(n)+Math.cos(w)*Math.cos(n)*Math.cos(inc))*y,
    Math.sin(w)*Math.sin(inc)*x+Math.cos(w)*Math.sin(inc)*y];
}
export function simulationScene<T extends UniverseData>(base:T,model:LongTermModel,ms:number,options:SimulationSceneOptions={}):SimulationSceneResult<T> {
  const min=model.coverage.min_date,max=model.coverage.max_date;
  if(ms<modelDateMs(min.year,min.month,min.day)||ms>modelDateMs(max.year,max.month,max.day))throw new Error('unsupported_model_date');
  const byId=new Map([...base.objects,...(options.sourceUniverse?.objects??[])].map(b=>[b.object_id,b]));
  const source=model.source??{url:'https://ssd.jpl.nasa.gov/planets/approx_pos.html',label:'JPL approximate planetary positions'};
  const objects:UniverseBody[]=[{...byId.get('sun')!,object_id:'sun',name:'Sun',kind:'solar_system',position_au:[0,0,0],position_kind:'approximate_simulation',source}];
  for(const record of model.tables.long.bodies){
    const id=record.object_id==='earth-moon-barycenter'?'earth':record.object_id;
    const body=byId.get(id);if(!body)continue;
    objects.push({...body,object_id:id,position_au:simulationPosition(record,ms),position_kind:'approximate_simulation',orbit:{kind:'fitted_kepler_simulation_guide',epoch:new Date(ms).toISOString(),points_au:simulationOrbit(record,ms),closed:true,source,limitations:['Fitted Kepler ellipse at the selected simulation epoch; not an integrated past/future trajectory.']},source});
  }
  const moonSummary:SimulationMoonSummary={algorithm_version:MOON_SIMULATION_ALGORITHM,status:options.extendedCatalogue?'unvalidated_approximation':'source_catalogue_missing',
    source_manifest_sha256:options.extendedCatalogue?.source_manifest_sha256??null,source_moon_count:0,added_count:0,omitted:[],gm_source:MOON_GM_SOURCE,assumptions:MOON_ASSUMPTIONS};
  const parents=new Map(objects.map(body=>[body.object_id,body])),seen=new Set<string>(),jd=2440587.5+ms/86400000;
  for(const record of options.extendedCatalogue?.objects??[]){
    if(record.kind!=='moon'||seen.has(record.object_id))continue;seen.add(record.object_id);moonSummary.source_moon_count++;
    const omit=(reason:SimulationMoonSummary['omitted'][number]['reason'])=>moonSummary.omitted.push({object_id:record.object_id,parent_id:record.parent_id,reason});
    const parent=parents.get(record.parent_id);
    if(!parent?.position_au||!MOON_PARENT_GM_KM3_S2[record.parent_id]){omit('missing_parent');continue;}
    if(record.status!=='available'){omit('source_unavailable');continue;}
    if(!verifiedMoonSource(record)){omit('invalid_source_frame_or_center');continue;}
    const prepared=prepareMoonModel(record);if(!prepared){omit('missing_or_unbound_source_state');continue;}
    const state=propagateMoonOsculating(prepared.model,jd);if(!state){omit('invalid_target_phase');continue;}
    const relative=state.position_au.map(value=>value*prepared.metadata.display_offset_scale) as Vec3,existing=byId.get(record.object_id);
    const body:SimulatedMoonBody={...existing,object_id:record.object_id,name:record.name,kind:'moon',parent_id:record.parent_id,
      position_au:parent.position_au.map((value,i)=>value+relative[i]) as Vec3,parent_relative_position_au:relative,
      radius_km:existing?.radius_km??record.radius_km,position_kind:'osculating_kepler_extrapolation',orbit:prepared.guide,
      source:{url:record.source!.url,label:'JPL saved parent-relative state + adopted system GM · unvalidated two-body extrapolation'},
      moon_algorithm_version:MOON_SIMULATION_ALGORITHM,moon_simulation:prepared.metadata};
    if(!body.radius_source&&record.radius_source)body.radius_source={...record.radius_source,url:record.radius_source.source_url};
    objects.push(body);moonSummary.added_count++;
  }
  return {...base,epoch:new Date(ms).toISOString(),coordinate_frame:'mean ecliptic and equinox J2000; heliocentric; approximate simulation',objects,
    limitations:[...model.limitations,...(options.extendedCatalogue?MOON_ASSUMPTIONS:[])],moon_simulation:moonSummary};
}
