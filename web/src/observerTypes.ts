import type {Vec3} from './sceneMath';
import {icrsToEclipticUnit} from './universeLayers';
import {AU_PER_MPC,type DistanceRedshiftRow} from './observerMath';
export interface PhysicsSource {url:string;label?:string;data_provider?:string;sha256?:string}
export interface ObservedRedshift {object_id:string;measured_redshift:number|null;redshift_uncertainty:number|null;reference_frame_status?:string;status:string;source:PhysicsSource;limitations?:string[]}
export interface ObserverPhysicsData {
  schema_version:string;algorithm_version:string;source_manifest_sha256:string;
  source_redshifts:Record<string,ObservedRedshift>;
  cosmology:{id:string;h0_km_s_mpc:number;omega_m:number;omega_lambda:number;redshift_domain:[number,number];inverse_distance_table:DistanceRedshiftRow[];source:PhysicsSource;interpolation_check?:{maximum_midpoint_relative_redshift_error:number;scope:string};limitations:string[]};
  limitations:string[];
}
export interface BlackHoleRecord {
  object_id:string;name:string;kind:string;galaxy_id:string;existing_universe_object_id:string|null;
  mass_solar:number|null;mass_uncertainty_solar:number|null;mass_source:PhysicsSource|null;
  distance_pc:number|null;distance_uncertainty_pc:number|null;distance_source:PhysicsSource|null;
  coordinate:{ra_deg:number;dec_deg:number;frame:string;epoch:string|null}|null;
  coordinate_role:string;source:PhysicsSource;spin_dimensionless:number|null;
  nonrotating_model:{schwarzschild_radius_km:number;photon_sphere_radius_km:number;distant_shadow_impact_radius_km:number;spin_assumed:0;model:string}|null;
  image:{url:string;credit:string;license:string;license_url:string;observation_year:number;kind:string;image_page_source:PhysicsSource}|null;
  limitations:string[];
}
export interface BlackHoleCatalogue {schema_version:string;algorithm_version:string;source_manifest_sha256:string;objects:Record<string,BlackHoleRecord>;limitations:string[]}
export interface ObserverSource {
  object_id:string;name:string;position_au:Vec3|null;position_status:string;
  cosmology_role:'extragalactic_reference'|'bound_system'|'unknown';
  observed_redshift_id?:string;source?:PhysicsSource;black_hole?:BlackHoleRecord;
}
/** Adopted catalogue direction/distance only; no proper-motion or centroid reconstruction. */
export function blackHoleObserverSource(record:BlackHoleRecord):ObserverSource {
  const c=record.coordinate,distance=record.distance_pc;
  const direction=c?.frame==='ICRS'?icrsToEclipticUnit(c.ra_deg,c.dec_deg):null;
  const position=direction&&distance!==null&&Number.isFinite(distance)&&distance>0?direction.map(value=>value*distance*AU_PER_MPC/1e6) as Vec3:null;
  return {object_id:record.object_id,name:record.name,position_au:position,position_status:record.coordinate_role,cosmology_role:record.galaxy_id==='galaxy-milky-way'?'bound_system':'extragalactic_reference',observed_redshift_id:record.galaxy_id,source:record.source,black_hole:record};
}
