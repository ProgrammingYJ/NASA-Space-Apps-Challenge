export interface CatalogCoordinate {ra_deg:number;dec_deg:number;frame:string;epoch?:string;source?:{url:string;label?:string};role?:string}
export interface UniverseCatalogObject {object_id:string;parent_id:string|null;galaxy_id:string;name:string;kind:string;coordinate:CatalogCoordinate|null;distance_pc:number|null;distance_status:string;position_kind:string;existing_object_id?:string;catalog_reference?:unknown;source:{url:string;label?:string};limitations:string[];coordinate_role?:string}
export interface UniverseCatalog {algorithm_version:string;source_manifest_sha256:string;objects:UniverseCatalogObject[];galaxies?:unknown[];external_catalogs?:unknown;limitations:string[]}
export function tangentProjection(ra:number,dec:number,centerRa:number,centerDec:number):[number,number]|null {
  if(![ra,dec,centerRa,centerDec].every(Number.isFinite)||Math.abs(dec)>90||Math.abs(centerDec)>90)return null;
  const r=Math.PI/180,d=dec*r,c=centerDec*r,delta=((ra-centerRa+540)%360-180)*r;
  const denominator=Math.sin(c)*Math.sin(d)+Math.cos(c)*Math.cos(d)*Math.cos(delta);
  if(denominator<=.01)return null;
  return [Math.cos(d)*Math.sin(delta)/denominator/r,(Math.cos(c)*Math.sin(d)-Math.sin(c)*Math.cos(d)*Math.cos(delta))/denominator/r];
}
export function catalogPoint(object:UniverseCatalogObject,center?:{ra:number;dec:number}):[number,number]|null {
  const c=object.coordinate;if(!c)return null;
  if(![c.ra_deg,c.dec_deg].every(Number.isFinite)||c.ra_deg<0||c.ra_deg>=360||Math.abs(c.dec_deg)>90)return null;
  return center?tangentProjection(c.ra_deg,c.dec_deg,center.ra,center.dec):[180-c.ra_deg,c.dec_deg];
}
