import type {UniverseData,UniverseBody,OrbitGuide} from './UniverseScene';
import type {Vec3} from './sceneMath';
import type {ExtendedObject,ExtendedCatalog} from './extendedMath';
import {EARTH_MOON_OFFSET_SCALE,fitMoonOsculatingState,propagateMoonOsculating,MOON_SIMULATION_ALGORITHM,MOON_GM_SOURCE,MOON_PARENT_GM_KM3_S2,moonGmAu3Day2,type MoonOsculatingModel} from './moonKepler';
import {transNeptunianPosition,TNO_ALGORITHM_VERSION,TNO_SUPPORTED_MIN_JD,TNO_SUPPORTED_MAX_JD,TNO_EXTRAPOLATION_WARNING_DAYS,type TransNeptunianOrbit} from './TransNeptunianMath';
import type {OuterTnoCatalog} from './OuterTnoPanel';

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
export type SimulationTnoCatalogue=OuterTnoCatalog&{coordinate_frame?:string;time_scale?:string;position_unit?:string};
export interface NativeTnoSimulationMetadata {
  algorithm_version:typeof TNO_ALGORITHM_VERSION;source_object_id:string;source_spkid:string;known_object_id:string;
  source_manifest_sha256:string;source_snapshot_sha256:string;source_epoch_jd_tdb:number;jd_tdb:number;epoch_offset_days:number;
  coordinate_frame:'heliocentric_IAU76_80_ecliptic_J2000';time_scale:'TDB';
  status:'osculating_two_body_prediction'|'unvalidated_kepler_extrapolation';long_range_extrapolation:boolean;
  propagated_position_uncertainty:null;new_classification:null;long_term_accuracy_verified:false;
}
export interface SimulationNativeTnoSummary {
  algorithm_version:typeof TNO_ALGORITHM_VERSION;status:'source_catalogue_missing'|'invalid_source_contract'|'unvalidated_approximation';
  source_manifest_sha256:string|null;source_snapshot_sha256:string|null;jd_tdb:number;added_count:number;
  omitted:{object_id:string;source_object_id:string;reason:'missing_native_metadata'|'identity_mismatch'|'missing_or_invalid_elements'|'invalid_target_phase'}[];
  assumptions:string[];
}
export interface SimulationSceneOptions {sourceUniverse?:UniverseData;extendedCatalogue?:Pick<ExtendedCatalog,'objects'|'source_manifest_sha256'>;outerTnoCatalogue?:SimulationTnoCatalogue}
export interface CeresSimulationMetadata {
  algorithm_version:typeof MOON_SIMULATION_ALGORITHM;object_id:'ceres';status:'unvalidated_two_body_extrapolation';
  source_manifest_sha256:string;source_response_sha256:string;source_epoch_jd_tdb:number;source_epoch_utc_label:string;jd_tdb:number;
  position_reference:'sun_body_center';gm_m3_s2:number;gm_au3_day2:number;gm_source:{url:string;source_sha256:string;units:'m3/s2'};
  long_range_extrapolation:boolean;long_term_accuracy_verified:false;propagated_position_uncertainty:null;new_classification:null;
}
export interface SimulationCeresSummary {status:'source_catalogue_missing'|'source_record_missing'|'missing_native_metadata'|'invalid_source_contract'|'missing_or_unbound_source_state'|'invalid_target_phase'|'unvalidated_approximation';added_count:number;metadata:CeresSimulationMetadata|null;assumptions:string[]}
export type SimulationSceneResult<T extends UniverseData>=T&{moon_simulation:SimulationMoonSummary;native_tno_simulation:SimulationNativeTnoSummary;ceres_simulation:SimulationCeresSummary};
export function simulationMoonMetadata(body:UniverseBody|undefined):MoonSimulationMetadata|undefined{return (body as SimulatedMoonBody|undefined)?.moon_simulation;}

const NATIVE_TNO_SPK:Readonly<Record<string,string>>={quaoar:'20050000',sedna:'20090377',orcus:'20090482',pluto:'20134340',haumea:'20136108',eris:'20136199',makemake:'20136472',gonggong:'20225088'};
const TNO_ASSUMPTIONS=[
  'Known native TNOs missing from the eight-planet fit use the same source-pinned JPL SBDB heliocentric J2000 elements and solar two-body propagation as the catalogue layer, at the selected TDB calendar label.',
  'These are nominal osculating Kepler predictions, not validated past reconstructions, future ephemerides, measured positions or many-body integrations. Beyond 100 Julian years from the element epoch the state is explicitly marked unvalidated_kepler_extrapolation; closer states also lack verified propagated uncertainty.',
  'Only exact authored native-ID/SPK matches retain their existing native metadata and physical-radius sources. Missing or invalid elements remain unavailable; a reference-date position or the solar origin never replaces them. Native objects and the eight planetary fits are not duplicated.',
];
const CERES_SOURCE_SHA='6851c4fd5c5389db14ca85944dd7a93c676fa3181a726845af13e3dfd0852d82';
const SOLAR_GM_M3_S2=1.32712440041279419e20,SOLAR_GM_AU3_DAY2=SOLAR_GM_M3_S2*86400**2/149597870700**3;
const CERES_ASSUMPTIONS=[
  'Ceres uses its exact saved JPL Horizons 1; geometric Sun-centred J2000 ecliptic position/velocity and the adopted JPL solar GM in the existing parent-relative two-body solver. Its numeric source TDB JD is retained separately from the UTC acquisition label.',
  'This nominal massless solar osculating ellipse is an unvalidated past/future extrapolation. Planetary perturbations, nongravitational forces, covariance propagation and orbital evolution are not integrated. Native radii and their sources remain unchanged.',
];
const preparedCeresModels=new WeakMap<ExtendedObject,MoonOsculatingModel|null>();
function appendCeres(objects:UniverseBody[],nativeMetadata:Map<string,UniverseBody>,catalogue:SimulationSceneOptions['extendedCatalogue'],jd:number):SimulationCeresSummary{
  const summary:SimulationCeresSummary={status:catalogue?'source_record_missing':'source_catalogue_missing',added_count:0,metadata:null,assumptions:CERES_ASSUMPTIONS};
  if(!catalogue||objects.some(body=>body.object_id==='ceres'))return summary;
  const matches=catalogue.objects.filter(record=>record.object_id==='ceres');if(matches.length!==1)return summary;
  const record=matches[0],native=nativeMetadata.get('ceres');
  if(!native||native.kind!=='dwarf_planet'||(native.parent_id!==undefined&&native.parent_id!=='sun')){summary.status='missing_native_metadata';return summary;}
  const raw=record as ExtendedObject&{horizons_id?:string;position_reference?:string};
  try{
    const url=new URL(record.source?.url??''),value=(key:string)=>url.searchParams.get(key)?.replace(/^'|'$/g,'');
    if(record.kind!=='dwarf_planet'||record.parent_id!=='sun'||record.status!=='available'||raw.horizons_id!=='1;'||raw.position_reference!=='parent_body_center'
      ||record.source?.sha256!==CERES_SOURCE_SHA||!/^[a-f0-9]{64}$/.test(catalogue.source_manifest_sha256)
      ||url.protocol!=='https:'||url.hostname!=='ssd.jpl.nasa.gov'||url.pathname!=='/api/horizons.api'
      ||value('COMMAND')!=='1;'||value('CENTER')!=='500@10'||value('EPHEM_TYPE')!=='VECTORS'||value('REF_PLANE')!=='ECLIPTIC'
      ||value('REF_SYSTEM')!=='ICRF'||value('OUT_UNITS')!=='AU-D'||value('VEC_CORR')!=='NONE'||value('TIME_TYPE')!=='UT'){
      summary.status='invalid_source_contract';return summary;
    }
  }catch{summary.status='invalid_source_contract';return summary;}
  const knot=record.knots?.[0];
  if(!knot||!Number.isFinite(Date.parse(knot.epoch))||!Number.isFinite(knot.tdb_jd)||knot.tdb_jd<TNO_SUPPORTED_MIN_JD||knot.tdb_jd>TNO_SUPPORTED_MAX_JD){summary.status='missing_or_unbound_source_state';return summary;}
  let model=preparedCeresModels.get(record);
  if(model===undefined){model=fitMoonOsculatingState(knot,SOLAR_GM_AU3_DAY2);preparedCeresModels.set(record,model);}
  if(!model){summary.status='missing_or_unbound_source_state';return summary;}
  const state=propagateMoonOsculating(model,jd);if(!state){summary.status='invalid_target_phase';return summary;}
  const metadata:CeresSimulationMetadata={algorithm_version:MOON_SIMULATION_ALGORITHM,object_id:'ceres',status:'unvalidated_two_body_extrapolation',
    source_manifest_sha256:catalogue.source_manifest_sha256,source_response_sha256:CERES_SOURCE_SHA,source_epoch_jd_tdb:knot.tdb_jd,source_epoch_utc_label:knot.epoch,jd_tdb:jd,
    position_reference:'sun_body_center',gm_m3_s2:SOLAR_GM_M3_S2,gm_au3_day2:SOLAR_GM_AU3_DAY2,gm_source:{url:MOON_GM_SOURCE.url,source_sha256:MOON_GM_SOURCE.source_sha256,units:'m3/s2'},
    long_range_extrapolation:Math.abs(jd-knot.tdb_jd)>TNO_EXTRAPOLATION_WARNING_DAYS,long_term_accuracy_verified:false,propagated_position_uncertainty:null,new_classification:null};
  const source={url:record.source!.url,label:'Saved JPL Ceres solar state · unvalidated two-body extrapolation',sha256:CERES_SOURCE_SHA};
  const body:UniverseBody&{ceres_simulation:CeresSimulationMetadata}={...native,position_au:state.position_au,position_kind:'osculating_kepler_extrapolation',distance_au:Math.hypot(...state.position_au),source,
    orbit:{kind:'fitted_kepler_simulation_guide',epoch:knot.epoch,epoch_tdb_jd:knot.tdb_jd,points_au:model.orbit_points_au,closed:true,center:'sun',coordinate_frame:'Ecliptic of J2000.0',units:'au',source,limitations:CERES_ASSUMPTIONS},ceres_simulation:metadata};
  objects.push(body);summary.status='unvalidated_approximation';summary.added_count=1;summary.metadata=metadata;return summary;
}
function validTnoCatalogue(catalogue:SimulationTnoCatalogue){
  try{
    const url=new URL(catalogue.source.url);
    return catalogue.algorithm_version===TNO_ALGORITHM_VERSION&&catalogue.coordinate_frame==='heliocentric_IAU76_80_ecliptic_J2000'
      &&catalogue.time_scale==='TDB'&&catalogue.position_unit==='au'&&Array.isArray(catalogue.objects)
      &&Number.isFinite(catalogue.reference_jd_tdb)&&catalogue.reference_jd_tdb>=TNO_SUPPORTED_MIN_JD&&catalogue.reference_jd_tdb<=TNO_SUPPORTED_MAX_JD
      &&/^[a-f0-9]{64}$/.test(catalogue.source_manifest_sha256)&&/^[a-f0-9]{64}$/.test(catalogue.source.sha256)
      &&url.protocol==='https:'&&url.hostname==='ssd-api.jpl.nasa.gov'&&url.pathname==='/sbdb_query.api'&&url.searchParams.get('sb-class')==='TNO';
  }catch{return false;}
}
function validTnoOrbit(orbit:TransNeptunianOrbit|null|undefined):orbit is TransNeptunianOrbit{
  return Boolean(orbit&&(['a_au','e','i_deg','omega_deg','Omega_deg','M_deg','epoch_jd_tdb'] as const).every(key=>typeof orbit[key]==='number'&&Number.isFinite(orbit[key]))
    &&orbit.a_au>0&&orbit.a_au<=1e9&&orbit.e>=0&&orbit.e<1&&orbit.i_deg>=0&&orbit.i_deg<=180
    &&[orbit.omega_deg,orbit.Omega_deg,orbit.M_deg].every(value=>Math.abs(value)<=1e9)&&orbit.epoch_jd_tdb>=TNO_SUPPORTED_MIN_JD&&orbit.epoch_jd_tdb<=TNO_SUPPORTED_MAX_JD);
}
const tnoGuideCache=new WeakMap<TransNeptunianOrbit,{signature:string;points:Vec3[]}>();
function tnoGuidePoints(orbit:TransNeptunianOrbit):Vec3[]{
  const signature=JSON.stringify(orbit),cached=tnoGuideCache.get(orbit);if(cached?.signature===signature)return cached.points;
  const points:Vec3[]=[];
  for(let index=0;index<128;index++){
    const point=transNeptunianPosition({...orbit,M_deg:index*360/128},orbit.epoch_jd_tdb);if(!point)return [];points.push(point);
  }
  points.push([...points[0]]);tnoGuideCache.set(orbit,{signature,points});return points;
}

/** Append only missing, exactly identified native bodies; source coordinates and radii are never fabricated. */
function appendNativeTnos(objects:UniverseBody[],metadata:Map<string,UniverseBody>,catalogue:SimulationTnoCatalogue|undefined,jd:number):SimulationNativeTnoSummary{
  const summary:SimulationNativeTnoSummary={algorithm_version:TNO_ALGORITHM_VERSION,status:catalogue?'invalid_source_contract':'source_catalogue_missing',
    source_manifest_sha256:null,source_snapshot_sha256:null,jd_tdb:jd,added_count:0,omitted:[],assumptions:TNO_ASSUMPTIONS};
  if(!catalogue||!validTnoCatalogue(catalogue))return summary;
  summary.status='unvalidated_approximation';summary.source_manifest_sha256=catalogue.source_manifest_sha256;summary.source_snapshot_sha256=catalogue.source.sha256;
  const existing=new Set(objects.map(body=>body.object_id));
  for(const row of catalogue.objects){
    const id=row.known_object_id;if(!id||existing.has(id))continue;
    const omit=(reason:SimulationNativeTnoSummary['omitted'][number]['reason'])=>summary.omitted.push({object_id:id,source_object_id:row.object_id,reason});
    if(!Object.hasOwn(NATIVE_TNO_SPK,id)||row.spkid!==NATIVE_TNO_SPK[id]||row.object_id!==`sbdb-${row.spkid}`){omit('identity_mismatch');continue;}
    const body=metadata.get(id);if(!body||!(['dwarf_planet','dwarf_candidate'].includes(body.kind)||(id==='pluto'&&body.kind==='solar_system'))||(body.parent_id!==undefined&&body.parent_id!=='sun')){omit('missing_native_metadata');continue;}
    if(!validTnoOrbit(row.orbit)){omit('missing_or_invalid_elements');continue;}
    const position=transNeptunianPosition(row.orbit,jd),points=tnoGuidePoints(row.orbit);
    if(!position||!position.every(Number.isFinite)||points.length!==129){omit('invalid_target_phase');continue;}
    const offset=jd-row.orbit.epoch_jd_tdb,extrapolated=Math.abs(offset)>TNO_EXTRAPOLATION_WARNING_DAYS;
    const simulation:NativeTnoSimulationMetadata={algorithm_version:TNO_ALGORITHM_VERSION,source_object_id:row.object_id,source_spkid:row.spkid,known_object_id:id,
      source_manifest_sha256:catalogue.source_manifest_sha256,source_snapshot_sha256:catalogue.source.sha256,source_epoch_jd_tdb:row.orbit.epoch_jd_tdb,jd_tdb:jd,epoch_offset_days:offset,
      coordinate_frame:'heliocentric_IAU76_80_ecliptic_J2000',time_scale:'TDB',status:extrapolated?'unvalidated_kepler_extrapolation':'osculating_two_body_prediction',long_range_extrapolation:extrapolated,
      propagated_position_uncertainty:null,new_classification:null,long_term_accuracy_verified:false};
    const source={url:catalogue.source.url,label:'JPL SBDB source elements · unvalidated solar Kepler extrapolation',sha256:catalogue.source.sha256};
    const added:UniverseBody&{native_tno_simulation:NativeTnoSimulationMetadata}={...body,position_au:position,distance_au:Math.hypot(...position),position_kind:simulation.status,source,
      orbit:{kind:'osculating_kepler_guide',epoch:new Date((row.orbit.epoch_jd_tdb-2440587.5)*86400000).toISOString(),epoch_tdb_jd:row.orbit.epoch_jd_tdb,
        points_au:points,closed:true,center:'sun',coordinate_frame:simulation.coordinate_frame,units:'au',source,limitations:TNO_ASSUMPTIONS},native_tno_simulation:simulation};
    objects.push(added);existing.add(id);summary.added_count++;
  }
  return summary;
}

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
  const jd=2440587.5+ms/86400000,nativeTnoSummary=appendNativeTnos(objects,byId,options.outerTnoCatalogue,jd),ceresSummary=appendCeres(objects,byId,options.extendedCatalogue,jd);
  const moonSummary:SimulationMoonSummary={algorithm_version:MOON_SIMULATION_ALGORITHM,status:options.extendedCatalogue?'unvalidated_approximation':'source_catalogue_missing',
    source_manifest_sha256:options.extendedCatalogue?.source_manifest_sha256??null,source_moon_count:0,added_count:0,omitted:[],gm_source:MOON_GM_SOURCE,assumptions:MOON_ASSUMPTIONS};
  const parents=new Map(objects.map(body=>[body.object_id,body])),seen=new Set<string>();
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
    limitations:[...model.limitations,...(options.extendedCatalogue?MOON_ASSUMPTIONS:[]),...(nativeTnoSummary.added_count?TNO_ASSUMPTIONS:[]),...(ceresSummary.added_count?CERES_ASSUMPTIONS:[])],moon_simulation:moonSummary,native_tno_simulation:nativeTnoSummary,ceres_simulation:ceresSummary};
}
