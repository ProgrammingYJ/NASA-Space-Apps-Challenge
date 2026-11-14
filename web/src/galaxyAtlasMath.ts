import type {Vec3} from './sceneMath';

export const GALAXY_ATLAS_DISPLAY_VERSION='fk5-j2000-galaxy-catalogue-markers-v1';
export const MAX_ATLAS_MARKERS=100000;
export const AU_PER_MPC=1e6*(648000/Math.PI);
export interface GalaxyAtlasRow {
  object_id:string;name:string;aliases?:string[];pgc_string?:string;
  ra_deg:number;dec_deg:number;distance_mpc:number|null;distance_error_mpc?:number|null;
  morphology_code?:number|null;major_arcmin?:number|null;minor_arcmin?:number|null;position_angle_deg?:number|null;
  existing_object_id?:string|null;coordinate_reference?:string;
}
export interface GalaxyAtlasMetadata {
  schema_version:string;algorithm_version:string;source_manifest_sha256:string;
  source:{url:string;label:string};record_count:number;spatial_count:number;direction_only_count:number;
  paper?:{url:string;count_note?:string};
  coordinate_reference:string;coverage:{kind:string;nominal_paper_horizon_mpc:number;actual_distance_range_mpc:[number,number];records_above_nominal_100_mpc:number;missing_morphology_records:number;selected_date_propagation:boolean};limitations:string[];
}
export interface GalaxyAtlasPage extends GalaxyAtlasMetadata {objects:GalaxyAtlasRow[];next_cursor:string|null;matched_count?:number}
export interface GalaxyAtlasColumns {object_id:string[];ra_deg:number[];dec_deg:number[];distance_mpc:number[];morphology_code?:(number|null)[]}
export interface GalaxyAtlasMarkers extends GalaxyAtlasMetadata {columns:GalaxyAtlasColumns;curated_matches?:Record<string,string>}
export type GalaxyMarkerClass='elliptical'|'lenticular'|'spiral'|'irregular'|'unknown';
/** Fixed FK5 J2000 equatorial-basis rotation for display, not an ICRS realization. */
export function atlasDisplayDirection(raDeg:number,decDeg:number):Vec3|null {
  if(!Number.isFinite(raDeg)||!Number.isFinite(decDeg)||raDeg<0||raDeg>=360||Math.abs(decDeg)>90)return null;
  const ra=raDeg*Math.PI/180,dec=decDeg*Math.PI/180,obliquity=84381.448*Math.PI/(180*3600);
  const x=Math.cos(dec)*Math.cos(ra),y=Math.cos(dec)*Math.sin(ra),z=Math.sin(dec);
  const eclipticY=y*Math.cos(obliquity)+z*Math.sin(obliquity),eclipticZ=-y*Math.sin(obliquity)+z*Math.cos(obliquity);
  return [x,eclipticZ,-eclipticY];
}
/** Same radial compression as the existing solar scene; the output is not Mpc. */
export function atlasDisplayPosition(row:Pick<GalaxyAtlasRow,'ra_deg'|'dec_deg'|'distance_mpc'>):Vec3|null {
  const direction=atlasDisplayDirection(row.ra_deg,row.dec_deg);
  if(!direction||row.distance_mpc===null||!Number.isFinite(row.distance_mpc)||row.distance_mpc<=0)return null;
  const radius=18*Math.log1p(row.distance_mpc*AU_PER_MPC);
  return Number.isFinite(radius)?direction.map(value=>value*radius) as Vec3:null;
}
export function galaxyMarkerClass(code:number|null|undefined):GalaxyMarkerClass {
  if(code===null||code===undefined||!Number.isFinite(code)||code<-6||code>11)return 'unknown';
  if(code<-3)return 'elliptical';if(code<0)return 'lenticular';if(code<10)return 'spiral';return 'irregular';
}
// Display classification colours, never measured galaxy colours or brightness.
export const GALAXY_MARKER_COLOURS:Record<GalaxyMarkerClass,[number,number,number]>={elliptical:[.91,.69,.45],lenticular:[.8,.66,.78],spiral:[.48,.72,.94],irregular:[.58,.83,.69],unknown:[.52,.59,.69]};
export interface AtlasBuffers {ids:string[];positions:Float32Array;colours:Float32Array;sourceCount:number;excludedCount:number;invalidCount:number;classes:Record<GalaxyMarkerClass,number>}
export function atlasMarkerBuffers(columns:GalaxyAtlasColumns,excluded:ReadonlySet<string>=new Set()):AtlasBuffers {
  const count=columns.object_id.length;
  if(count>MAX_ATLAS_MARKERS||![columns.ra_deg,columns.dec_deg,columns.distance_mpc].every(values=>values.length===count)||(columns.morphology_code&&columns.morphology_code.length!==count))throw new Error('invalid_atlas_columns');
  const seen=new Set<string>(),ids:string[]=[],positions:number[]=[],colours:number[]=[];
  const classes:Record<GalaxyMarkerClass,number>={elliptical:0,lenticular:0,spiral:0,irregular:0,unknown:0};let excludedCount=0,invalidCount=0;
  for(let index=0;index<count;index++){
    const id=columns.object_id[index];
    if(typeof id!=='string'||!/^gwgc-pgc-[0-9]+$/.test(id)||seen.has(id)){invalidCount++;continue;}seen.add(id);
    if(excluded.has(id)){excludedCount++;continue;}
    const position=atlasDisplayPosition({ra_deg:columns.ra_deg[index],dec_deg:columns.dec_deg[index],distance_mpc:columns.distance_mpc[index]});
    if(!position){invalidCount++;continue;}
    const kind=galaxyMarkerClass(columns.morphology_code?.[index]);ids.push(id);positions.push(...position);colours.push(...GALAXY_MARKER_COLOURS[kind]);classes[kind]++;
  }
  return {ids,positions:new Float32Array(positions),colours:new Float32Array(colours),sourceCount:count,excludedCount,invalidCount,classes};
}
