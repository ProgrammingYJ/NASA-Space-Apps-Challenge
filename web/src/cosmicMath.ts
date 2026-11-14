export const COSMIC_RATES=[1,10,100,1000] as const;
export type CosmicRate=typeof COSMIC_RATES[number];
export interface CosmicStage {stage_id:string;label_key:string;age_gyr:number;age_range_gyr:[number,number]|null;lookback_gyr:number;timing_status:string;source:{url:string;label:string;sha256:string};limitations:string[]}
export interface CosmicMorphologyExample {id:string;name:string;approx_age_gyr:number|null;sample_age_range_gyr:[number,number]|null;source:{url:string;label:string};observed_features:string[];limitations:string[]}
export interface CosmicMorphologyReference {algorithm_version:string;source_manifest_sha256:string;examples:CosmicMorphologyExample[];limitations:string[]}
export interface CosmicHistory {algorithm_version:string;reference_age_gyr:number;age_range_gyr:[number,number];stages:CosmicStage[];source_manifest_sha256:string;limitations:string[];morphology_reference?:CosmicMorphologyReference}
/** Display time in Gyr since Big Bang; rates are million years per real second. */
export function advanceCosmicAge(age:number,elapsedMs:number,rate:CosmicRate,maxAge:number){
  if(![age,elapsedMs,maxAge].every(Number.isFinite)||maxAge<=0||!COSMIC_RATES.includes(rate))throw new Error('invalid_cosmic_clock');
  const next=Math.min(maxAge,Math.max(0,age)+Math.max(0,Math.min(100,elapsedMs))*rate/1000000);
  return {age:next,ended:next===maxAge};
}
export function historyStage(data:CosmicHistory,age:number){
  if(!Number.isFinite(age)||age<0||age>data.reference_age_gyr)throw new Error('cosmic_age_outside_range');
  return [...data.stages].reverse().find(stage=>age>=stage.age_gyr)??data.stages[0];
}
