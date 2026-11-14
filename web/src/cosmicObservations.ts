export interface CosmicObservationSource {url:string;label:string;sha256?:string;bytes?:number;local_relative_path?:string;retrieved_utc?:string}
export interface CosmicObservationCase {
  id:string;name:string;source_id:string;
  approx_age_gyr:number|null;
  sample_age_range_gyr:[number,number]|null;
  age_scope:string;
  image_page_url:string;
  instrument:string;
  caption:string;
  source:CosmicObservationSource;
  limitations:string[];
  image:{
    url:string;local_path:string;source_url:string;resolved_source_url:string;
    sha256:string;bytes:number;retrieved_utc:string;pixel_dimensions:[number,number];
    kind:'published_observation_composite';artist_concept:false;bytes_modified_locally:false;
    image_page_source:CosmicObservationSource;
    credit:string;processing:string[];
    license:{label:string;spdx_id:'CC-BY-4.0'|null;url:string;policy_source:CosmicObservationSource;no_asset_specific_copyright_restriction_observed:true;requirements:string[]};
  };
}
export interface CosmicObservationCatalog {
  schema_version:'1.0';algorithm_version:'cosmic-observation-viewer-v1';
  age_unit:string;age_interpolation_available:false;
  objects:CosmicObservationCase[];
  sources:Record<string,CosmicObservationSource>;
  reference_reuse:Record<string,unknown>;
  limitations:string[];source_manifest_sha256:string;
}
export const OBSERVATION_SLIDE_INTERVALS=[3,5,8] as const;
export type ObservationSlideInterval=typeof OBSERVATION_SLIDE_INTERVALS[number];

export type PublishedObservationAge={kind:'approximate';age:number}|{kind:'range';min:number;max:number}|{kind:'unavailable'};
/** Preserve source ranges and unknown ages. Never interpolate or collapse a sample into one epoch. */
export function publishedObservationAge(value:Pick<CosmicObservationCase,'approx_age_gyr'|'sample_age_range_gyr'>):PublishedObservationAge {
  if(value.sample_age_range_gyr!==null){const [min,max]=value.sample_age_range_gyr;return Number.isFinite(min)&&Number.isFinite(max)&&min>=0&&max>=min?{kind:'range',min,max}:{kind:'unavailable'};}
  return value.approx_age_gyr!==null&&Number.isFinite(value.approx_age_gyr)&&value.approx_age_gyr>=0?{kind:'approximate',age:value.approx_age_gyr}:{kind:'unavailable'};
}
