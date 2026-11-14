export type Locale = 'ko' | 'en' | 'ja' | 'zh-Hant' | 'fr';
export type Matrix = (number | null)[][];
export interface Observation { observation_id:string; date_avg:string; wavelength_um:number|null; bandwidth_um:number|null; release:string; detector:string; unit:string }
export interface Frame {
  observation_id: string;
  metadata: {obs_id:string; release:string; detector:string; pipeline_version:string; date_avg:string; timesys:string; observer:string; unit:string; wavelength_um:number|null; bandwidth_um:number|null; epsf:{rows:number;columns:string[];oversampling:number|number[]|{x:number;y:number}|null}; hdus:unknown[]; wcs:{origin:number;ctype:string[];has_sip:boolean}};
  provenance:{id:string;source_url:string;sha256:string;bytes:number;local_relative_path:string;retrieved_utc:string};
  calibration:{id:string;calibration_id:string;source_url:string;sha256:string;bytes:number};
  prediction:{ra_deg:number;dec_deg:number;x:number;y:number;kind:string;source:{ra_deg:number;dec_deg:number;epoch:string;pm_ra_cosdec_mas_yr:number;pm_dec_mas_yr:number;url:string};omitted:string[]};
  cutout:{width:number;height:number;native_origin:{x:number;y:number};array_order:string;IMAGE:Matrix;VARIANCE:Matrix;FLAGS:number[][];ZODI:Matrix};
  quality:{radius_px:number;center:{x:number;y:number};pixel_count:number;clipped_pixel_count:number;image_nonfinite:number;variance_nonfinite:number;variance_nonpositive:number;flag_counts:Record<string,number>;flag_definitions:{name:string;bit:number;value:number;description:string}[];mask_policy_id:string;display:{retained:number;excluded:number;review_required:number};quantitative:{status:string;reason:string}};
}
export interface Comparison { schema_version:string; algorithm_version:string; result_id:string; object_id:string; frames:Frame[]; scientific_status:string; limitations:string[] }
export interface UniverseContext {selected_object_id:string;model_epoch:string;camera?:{position:[number,number,number];target:[number,number,number];representation_version:'solar-display-v1'}|null;panel_open:boolean;source_manifest_sha256?:string;orbit_manifest_sha256?:string;show_orbits?:boolean;timeline_algorithm_version?:'display-hermite-v1';playback_rate_hours_per_second?:1|6|24|72;playback_paused?:true;follow_object_id?:string|null;appearance_manifest_sha256?:string;extended_solar_manifest_sha256?:string;galaxy_manifest_sha256?:string;show_kuiper_belt?:boolean;show_galaxies?:boolean;kuiper_display_version?:'kuiper-region-v1'}
export interface Session { object_id:string;observation_ids:string[];active_frame:'A'|'B';view_mode:'split'|'blink';contrast:number;locale:Locale;universe_context?:UniverseContext }
export interface Job { job_id:string;state:string;result_id?:string|null;error?:{code:string;message_key:string;details?:unknown}|null }
export interface Restored { status:'restored'|'recalculation_required';session?:Session;comparison?:Comparison;judgment?:string;evidence_id?:string;reasons?:string[] }
