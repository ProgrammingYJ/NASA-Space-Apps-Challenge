import type {UniverseCatalogObject} from './universeCatalogMath';
export interface ConfirmedPlanetIndex {planet_count:number;host_count:number;url:string;objects:{object_id:string;name:string;hostname:string;ra_deg:number|null;dec_deg:number|null}[]}
export interface ExtragalacticReview {objects:never[];confirmed_objects:never[];reviewed_unconfirmed_evidence:{object_id:string;name:string;status:string;confirmed:false;source:{url:string;label:string}}[];sources:Record<string,{url:string;label?:string}>;source_manifest_sha256:string;coverage:unknown}
/** Existing published NASA listing; no candidate is promoted or assigned depth. */
export function confirmedPlanetRows(index:ConfirmedPlanetIndex|undefined):UniverseCatalogObject[] {
  return (index?.objects??[]).map(p=>({
    object_id:p.object_id,parent_id:p.hostname,galaxy_id:'galaxy-milky-way',name:p.name,kind:'exoplanet',
    coordinate:typeof p.ra_deg==='number'&&typeof p.dec_deg==='number'&&Number.isFinite(p.ra_deg)&&Number.isFinite(p.dec_deg)&&p.ra_deg>=0&&p.ra_deg<360&&Math.abs(p.dec_deg)<=90?{ra_deg:p.ra_deg,dec_deg:p.dec_deg,frame:'NASA catalogue RA/Dec',epoch:'epoch/frame realization not validated',role:'host_catalog_direction_reference'}:null,
    distance_pc:null,distance_status:'not_validated',position_kind:'existing_confirmed_catalog_reference',existing_object_id:p.object_id,
    source:{url:'https://science.nasa.gov/exoplanets/',label:'NASA Science exoplanet catalogue'},
    limitations:['The existing NASA published catalogue lists this planet. Its direction is the unresolved host reference, not an independently resolved planet position. No distance, surface map, or measured current orbit is created here.'],
  }));
}
