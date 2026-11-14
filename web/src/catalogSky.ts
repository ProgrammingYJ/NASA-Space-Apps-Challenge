import {displayDirection,type Vec3} from './sceneMath';
import {icrsToEclipticUnit} from './universeLayers';

export interface CatalogSkyIndex {
  url:string;
  raw_sha256:string;
  objects:{object_id:string;hostname:string;ra_deg:number|null;dec_deg:number|null}[];
}
export interface CatalogSkyStar {
  hostname:string;
  source_object_id:string;
  catalog_ra_deg:number;
  catalog_dec_deg:number;
  display_direction:Vec3;
}
export const CATALOG_SKY_RADIUS=1800;
export const CATALOG_SKY_FRAME_STATUS='catalogue_ra_dec_frame_epoch_not_validated';

/**
 * One marker for each real catalogue host with a usable direction. The first
 * valid row is retained without averaging source coordinates. The fixed display
 * rotation does not validate the catalogue's coordinate frame or epoch, infer a
 * distance, propagate a star, or turn marker colour/size into photometry.
 */
export function catalogSkyDirections(index:CatalogSkyIndex|undefined):CatalogSkyStar[] {
  const seen=new Set<string>();const stars:CatalogSkyStar[]=[];
  for(const row of index?.objects??[]){
    const hostname=row.hostname.trim();
    if(!hostname||seen.has(hostname)||typeof row.ra_deg!=='number'||typeof row.dec_deg!=='number')continue;
    const direction=icrsToEclipticUnit(row.ra_deg,row.dec_deg);if(!direction)continue;
    seen.add(hostname);
    stars.push({hostname,source_object_id:row.object_id,catalog_ra_deg:row.ra_deg,catalog_dec_deg:row.dec_deg,display_direction:displayDirection(direction)});
  }
  return stars;
}
