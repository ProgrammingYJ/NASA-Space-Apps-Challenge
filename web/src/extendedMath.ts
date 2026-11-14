import {hermite} from './timelineMath';
import {add,type Vec3} from './sceneMath';
import type {UniverseBody,UniverseData,OrbitGuide} from './UniverseScene';

export interface ExtendedKnot {epoch:string;tdb_jd:number;position_au:Vec3;velocity_au_day:Vec3}
export interface ExtendedObject {object_id:string;name:string;kind:'moon'|'dwarf_planet'|'dwarf_candidate';parent_id:string;status:string;radius_km:number|null;radius_source?:{value_km:number;uncertainty_km:number|null;source_url:string;definition:string}|null;period_days?:number|null;reason?:string;catalog_source_url?:string;source?:{url:string;sha256:string};knots?:ExtendedKnot[];cadence_minutes?:number}
export interface ExtendedCatalog {objects:ExtendedObject[];summary:Record<string,unknown>;source_manifest_sha256:string;start_epoch:string;end_epoch:string;limitations:string[]}
export interface PreparedObject {record:ExtendedObject;trace:OrbitGuide}

export function prepareExtended(data:ExtendedCatalog|undefined):PreparedObject[]{
  return (data?.objects??[]).filter(obj=>obj.status==='available'&&(obj.knots?.length??0)>=2).map(record=>({record,trace:{kind:'sampled_ephemeris_trace',epoch:record.knots![0].epoch,points_au:record.knots!.map(k=>k.position_au),closed:false,center:record.parent_id,coordinate_frame:'Ecliptic of J2000.0',units:'au',source:{url:record.source?.url??'https://ssd.jpl.nasa.gov/horizons/',label:'JPL geometric ephemeris samples · 72-hour interval',sha256:record.source?.sha256},limitations:['Sampled predicted interval, not a complete orbit or observed trajectory.']}}));
}
export function extendedPosition(record:ExtendedObject,epoch:number):Vec3{
  const knots=record.knots;if(!knots||knots.length<2||!Number.isFinite(epoch))throw new Error('missing_extended_samples');
  const start=Date.parse(knots[0].epoch),end=Date.parse(knots.at(-1)!.epoch);if(epoch<start||epoch>end)throw new Error('extended_epoch_outside_range');
  const step=Date.parse(knots[1].epoch)-start;if(step<=0)throw new Error('invalid_extended_interval');
  const index=Math.min(knots.length-2,Math.max(0,Math.floor((epoch-start)/step)));const a=knots[index],b=knots[index+1];
  const fraction=(epoch-Date.parse(a.epoch))/(Date.parse(b.epoch)-Date.parse(a.epoch));
  return hermite(a.position_au,a.velocity_au_day,b.position_au,b.velocity_au_day,fraction,b.tdb_jd-a.tdb_jd).position;
}
export function composeExtended<T extends UniverseData>(base:T,prepared:PreparedObject[],epoch:number):T{
  const objects=[...base.objects];
  for(const {record,trace} of prepared){
    const relative=extendedPosition(record,epoch);const parent=objects.find(obj=>obj.object_id===record.parent_id);
    if(record.parent_id!=='sun'&&!parent?.position_au)continue;
    const source={url:record.source?.url??record.catalog_source_url??'https://ssd.jpl.nasa.gov/sats/',label:'JPL Horizons · parent-relative geometric ephemeris'};
    const body:UniverseBody={object_id:record.object_id,name:record.name,kind:record.kind,parent_id:record.parent_id,position_au:record.parent_id==='sun'?relative:add(parent!.position_au!,relative),parent_relative_position_au:record.kind==='moon'?relative:undefined,radius_km:record.radius_km??undefined,position_kind:'interpolated_ephemeris',source,orbit:trace};
    // Radius units/uncertainties retain their original source contract.
    if(record.radius_source)body.radius_source={...record.radius_source,url:record.radius_source.source_url};
    objects.push(body);
  }
  return {...base,objects};
}
