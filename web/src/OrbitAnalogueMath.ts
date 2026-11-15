/** A transparent browsing rule for source-epoch elements, not an orbit fit or a probability. */
export const ORBIT_ANALOGUE_RULE='tno-source-aei-exploratory-v1';
export const TNO_ELEMENT_FRAME='heliocentric_IAU76_80_ecliptic_J2000';
export interface AnalogueElements {a_au:number;e:number;i_deg:number;epoch_jd_tdb:number}
export interface AnalogueObject {object_id:string;name:string;spkid?:string;pdes?:string;known_object_id:string|null;orbit:AnalogueElements|null}
export interface AnalogueSource {coordinate_frame?:string;time_scale?:string;source_manifest_sha256:string}
export interface OrbitAnalogue {object:AnalogueObject;relative_a_difference:number;eccentricity_difference:number;inclination_difference_deg:number;score:number}
export interface OrbitAnalogueResult {status:'ready'|'invalid_hypothesis'|'unsupported_source';rows:OrbitAnalogue[];input_count:number;compared_count:number;excluded:{missing_elements:number;invalid_elements:number;invalid_epoch:number}}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
function validElements(value:AnalogueElements){return finite(value.a_au)&&value.a_au>0&&finite(value.e)&&value.e>=0&&value.e<1&&finite(value.i_deg)&&value.i_deg>=0&&value.i_deg<=180;}

/** The independent source epochs are retained. No phase or position is propagated or compared. */
export function rankOrbitAnalogues(hypothesis:AnalogueElements,objects:readonly AnalogueObject[],source:AnalogueSource,limit=10):OrbitAnalogueResult {
  const result:OrbitAnalogueResult={status:'ready',rows:[],input_count:objects.length,compared_count:0,excluded:{missing_elements:0,invalid_elements:0,invalid_epoch:0}};
  if(!validElements(hypothesis)||!finite(hypothesis.epoch_jd_tdb)){result.status='invalid_hypothesis';return result;}
  if(source.coordinate_frame!==TNO_ELEMENT_FRAME||source.time_scale!=='TDB'||!/^[a-f0-9]{64}$/.test(source.source_manifest_sha256)){result.status='unsupported_source';return result;}
  for(const object of objects){
    if(!object.orbit){result.excluded.missing_elements++;continue;}
    if(!validElements(object.orbit)){result.excluded.invalid_elements++;continue;}
    if(!finite(object.orbit.epoch_jd_tdb)){result.excluded.invalid_epoch++;continue;}
    const relative_a_difference=Math.abs(object.orbit.a_au-hypothesis.a_au)/hypothesis.a_au;
    const eccentricity_difference=Math.abs(object.orbit.e-hypothesis.e),inclination_difference_deg=Math.abs(object.orbit.i_deg-hypothesis.i_deg);
    const score=relative_a_difference+eccentricity_difference+inclination_difference_deg/180;
    if(!Number.isFinite(score)){result.excluded.invalid_elements++;continue;}
    result.rows.push({object,relative_a_difference,eccentricity_difference,inclination_difference_deg,score});
  }
  result.compared_count=result.rows.length;
  result.rows.sort((a,b)=>a.score-b.score||(a.object.object_id<b.object.object_id?-1:a.object.object_id>b.object.object_id?1:0));
  result.rows=result.rows.slice(0,Math.max(0,Math.min(10,Number.isFinite(limit)?Math.trunc(limit):10)));
  return result;
}
