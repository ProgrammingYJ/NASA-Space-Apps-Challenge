import type {OuterTnoObject} from './OuterTnoPanel';
import {outerObjectMatches} from './PlanetCriteriaAdapter';

export const APPROXIMATE_MASS_ALGORITHM='source-size-or-H-albedo-density-mass-v1';
export const SIZE_FORMULA_SOURCE='https://cneos.jpl.nasa.gov/tools/ast_size_est.html';
export const APPROXIMATE_EARTH_MASS_KG=5.97217e24;
export const PROJECT_DEFAULT_DENSITY_KG_M3=1000;
export const PROJECT_DEFAULT_ALBEDO=.1;
export interface ExplicitMassValue {mass_earth:number;mass_kg:number;density_kg_m3:number;radius_km:number;inputs:{target_id:string}}
export interface ApproximateMassInput {
  objectId:string;measuredPrimaryMassEarth?:number|null;measuredSourceUrl?:string|null;
  explicitMass?:ExplicitMassValue;radiusKm?:number;radiusSourceUrl?:string;outerObject?:OuterTnoObject;
}
export interface ApproximateMassResult {
  kind:'measured'|'hypothesis'|'estimate'|'unavailable';
  algorithm_version:typeof APPROXIMATE_MASS_ALGORITHM;
  mass_earth:number|null;mass_kg:number|null;diameter_km:number|null;density_kg_m3:number|null;
  diameter_source:'physical_radius'|'catalogue_diameter'|'h_albedo'|null;
  absolute_magnitude_h:number|null;albedo:number|null;albedo_source:'catalogue'|'project_default'|null;
  source_url:string|null;source_manifest_sha256:string|null;
  reason:'no_size_or_h'|'stale_object'|'nonfinite_result'|null;
}
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;
/** Empty/whitespace/null/hex/booleans never become a magnitude or albedo of zero. */
export function finiteSourceNumber(value:unknown):number|null{
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value.trim()))return null;
  const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;
}

/** Keep catalogue/IAU/clearing values unchanged; this is a separate display result. */
export function approximateMass(input:ApproximateMassInput):ApproximateMassResult{
  const result:ApproximateMassResult={kind:'unavailable',algorithm_version:APPROXIMATE_MASS_ALGORITHM,mass_earth:null,mass_kg:null,diameter_km:null,density_kg_m3:null,diameter_source:null,absolute_magnitude_h:null,albedo:null,albedo_source:null,source_url:null,source_manifest_sha256:null,reason:'no_size_or_h'};
  if(positive(input.measuredPrimaryMassEarth)){
    const kg=input.measuredPrimaryMassEarth*APPROXIMATE_EARTH_MASS_KG;
    if(!positive(kg))return {...result,reason:'nonfinite_result'};
    return {...result,kind:'measured',mass_earth:input.measuredPrimaryMassEarth,mass_kg:kg,source_url:input.measuredSourceUrl??null,reason:null};
  }
  const explicit=input.explicitMass;
  if(explicit?.inputs.target_id===input.objectId&&positive(explicit.mass_earth)&&positive(explicit.mass_kg)&&positive(explicit.density_kg_m3)&&positive(explicit.radius_km)&&positive(explicit.radius_km*2))return {...result,kind:'hypothesis',mass_earth:explicit.mass_earth,mass_kg:explicit.mass_kg,diameter_km:explicit.radius_km*2,density_kg_m3:explicit.density_kg_m3,diameter_source:'physical_radius',source_url:input.radiusSourceUrl??null,reason:null};
  const outer=outerObjectMatches(input.objectId,input.outerObject)?input.outerObject:undefined;
  if(outer){result.source_url=outer.source_url;result.source_manifest_sha256=outer.source_manifest_sha256;}
  let diameter:number|null=null;
  if(positive(input.radiusKm)){diameter=input.radiusKm*2;result.diameter_source='physical_radius';result.source_url=input.radiusSourceUrl??null;result.source_manifest_sha256=null;}
  else if(positive(outer?.physical.diameter_km)){diameter=outer.physical.diameter_km;result.diameter_source='catalogue_diameter';}
  else if(outer){
    const H=finiteSourceNumber(outer.source_fields?.H);
    if(H!==null){
      const sourceAlbedo=finiteSourceNumber(outer.source_fields?.albedo),albedo=sourceAlbedo!==null&&sourceAlbedo>0?sourceAlbedo:PROJECT_DEFAULT_ALBEDO;
      diameter=1329/Math.sqrt(albedo)*10**(-H/5);result.diameter_source='h_albedo';result.absolute_magnitude_h=H;result.albedo=albedo;result.albedo_source=sourceAlbedo!==null&&sourceAlbedo>0?'catalogue':'project_default';
    }
  }
  if(diameter===null)return {...result,reason:input.outerObject&&!outer?'stale_object':'no_size_or_h'};
  const kg=Math.PI/6*PROJECT_DEFAULT_DENSITY_KG_M3*(diameter*1000)**3,earth=kg/APPROXIMATE_EARTH_MASS_KG;
  if(!positive(diameter)||!positive(kg)||!positive(earth))return {...result,reason:'nonfinite_result'};
  return {...result,kind:'estimate',mass_earth:earth,mass_kg:kg,diameter_km:diameter,density_kg_m3:PROJECT_DEFAULT_DENSITY_KG_M3,reason:null};
}
