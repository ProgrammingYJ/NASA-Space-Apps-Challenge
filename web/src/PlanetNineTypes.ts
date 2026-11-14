export interface PlanetNineOrbit {
  a_au:number; e:number; i_deg:number; omega_deg:number; Omega_deg:number; M_deg:number; epoch_jd_tdb:number; mass_earth:number;
}
export interface PlanetNinePreset {
  id:string; row_index:number; orbit:PlanetNineOrbit; reference_ra_deg:number; reference_dec_deg:number;
}
export interface PlanetNinePresets {
  schema_version:string; source:{path:string;sha256:string;bytes:number;url:string;epoch_jd_raw:number;epoch_text_raw:string;epoch_discrepancy:unknown};presets:PlanetNinePreset[];limitations:string[];
}
export interface PlanetNinePathPoint {
  jd_tdb:number; position_au:[number,number,number]; ra_deg:number; dec_deg:number; distance_au:number; lighttime_days:number;
}
export interface PlanetNinePrediction {
  algorithm_version:string; orbit:PlanetNineOrbit; period_days:number; path:PlanetNinePathPoint[]; full_orbit_au:[number,number,number][]; coordinate_frame:string; observer:string; assumptions:unknown;
}
export type PlanetNineObserver='earth_moon_barycenter'|'sun';
export interface PlanetNineCoverage {
  [key:string]:unknown;
  status:string;
}
export interface PlanetNineEvidence {
  [key:string]:unknown;
  orbit:PlanetNineOrbit; prediction:PlanetNinePrediction; coverage:PlanetNineCoverage|null; judgment:string; locale:string;
  source:{preset_id:string;source_sha256:string;row_index:number}|null;
  gravity?:{kind:'field'|'integration';result:PlanetNineGravityResult}|null;
  region_context?:{subset:'all'|'ztf'|'ztf_des'|'ztf_des_ps1';max_reference_distance_au:number|null;cell_id:number;row_index:number}|null;
}
export interface PlanetNineEvidenceEnvelope {schema_version:string;kind:string;evidence_id:string;created_at:string;payload:PlanetNineEvidence;payload_sha256:string;limitations:string[]}
export interface PlanetNineRestored {status:'restored'|'recalculation_required';reasons?:string[];evidence:PlanetNineEvidenceEnvelope}
export interface PlanetNineGravityResult {[key:string]:unknown}
