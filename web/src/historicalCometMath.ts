import {hermite} from './timelineMath';
import type {Vec3} from './sceneMath';
export interface CometKnot {jd_tdb:number;calendar_tdb:string;position_au:Vec3;velocity_au_day:Vec3}
export interface HistoricalComet {object_id:string;name:string;designation:string;default_index:number;frame:string;center:string;time_scale:'TDB';knots:CometKnot[];sources:{url:string;label?:string;sha256?:string}[];limitations:string[]}
export interface HistoricalComets {schema_version:string;algorithm_version:string;source_manifest_sha256?:string;objects:HistoricalComet[];limitations?:string[]}
export function sampleHistoricalComet(comet:HistoricalComet,index:number){
  if(!Number.isFinite(index)||index<0||index>comet.knots.length-1||comet.knots.length<2)throw new Error('outside_comet_source_window');
  const lower=Math.min(Math.floor(index),comet.knots.length-2),a=comet.knots[lower],b=comet.knots[lower+1],u=index-lower;
  const state=hermite(a.position_au,a.velocity_au_day,b.position_au,b.velocity_au_day,u,b.jd_tdb-a.jd_tdb);
  return {...state,jd_tdb:a.jd_tdb+(b.jd_tdb-a.jd_tdb)*u,exact_knot:Number.isInteger(index),source_calendar_tdb:comet.knots[Math.floor(index)].calendar_tdb};
}
export function tdbCalendarLabel(jd:number){
  if(!Number.isFinite(jd))throw new Error('invalid_tdb_julian_date');
  // Gregorian formatting of a TDB calendar coordinate, not conversion to UTC.
  return new Date((jd-2440587.5)*86400000).toISOString().replace('T',' ').slice(0,19)+' TDB';
}
