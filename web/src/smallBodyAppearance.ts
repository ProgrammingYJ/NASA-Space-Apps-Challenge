import type {AppearanceManifest,AppearanceSource} from './planetAppearance';
import type {Vec3} from './sceneMath';
export interface SmallBodyProfile {
  color_hex:string|null;color_evidence:string;shape_axis_ratios:Vec3|null;shape_status:string;
  reference_radius_km:number|null;reference_radius_definition?:string;
  reference_radius_source?:AppearanceSource|null;reference_radius_uncertainty_km?:{minus_km:number;plus_km:number}|null;
  rings:{center_radius_km:number;width_km:number|null;pole_j2000_deg?:{ra:number;dec:number};source:AppearanceSource;limitations?:string[]}[];
  source:AppearanceSource;limitations:string[];surface_resolved:boolean;
  render_profile_enabled?:boolean;preserve_existing_map?:boolean;
}
export interface SmallBodyAppearance {algorithm_version:string;profiles:Record<string,SmallBodyProfile>;source_manifest_sha256:string}
/** a,b,c -> renderer x,z,y, retaining equivalent volume of the display sphere. */
export function smallBodyAxes(profile:SmallBodyProfile|undefined):Vec3{
  const axes=profile?.shape_axis_ratios;if(!axes||axes.some(value=>!Number.isFinite(value)||value<=0))return [1,1,1];
  const unit=Math.cbrt(axes[0]*axes[1]*axes[2]);return [axes[0]/unit,axes[2]/unit,axes[1]/unit];
}
/** Center guides only: source ring width and optical depth are not drawn. */
export function smallBodyRingRadii(profile:SmallBodyProfile|undefined,physicalRadiusKm:number,displayRadius:number):number[]{
  if(!profile||!Number.isFinite(physicalRadiusKm)||physicalRadiusKm<=0||displayRadius<=0)return [];
  return profile.rings.filter(ring=>Number.isFinite(ring.center_radius_km)&&ring.center_radius_km>physicalRadiusKm).map(ring=>ring.center_radius_km/physicalRadiusKm*displayRadius);
}
export function mergeSmallBodyAppearance(base:AppearanceManifest|undefined,data:SmallBodyAppearance|undefined):AppearanceManifest|undefined{
  if(!base||!data)return base;const objects={...base.objects};
  for(const [id,profile] of Object.entries(data.profiles)){
    if(profile.render_profile_enabled===false||profile.preserve_existing_map||objects[id]?.texture_url)continue;
    objects[id]={texture_url:null,kind:'literature_constrained',source:profile.source,credit:'Published observational constraints; display palette and unmeasured attitude are illustrative.',limitations:[...profile.limitations,...profile.rings.flatMap(ring=>ring.limitations??[])],physical_profile:profile};
    if(id==='haumea'&&profile.shape_axis_ratios&&profile.rings[0]?.pole_j2000_deg){
      const ring=profile.rings[0];objects[id].body_orientation={kind:'published_coplanar_ring_equator_model_assumed_phase',pole_icrs_deg:ring.pole_j2000_deg,source:ring.source,rotation_phase_verified:false};
      objects[id].limitations.push('Haumea short axis follows the paper’s coplanar ring/equator model at the static J2000 pole. Rotational phase, current attitude and precession are not propagated.');
    }
  }
  return {...base,objects};
}
