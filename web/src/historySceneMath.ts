/** Visual blending parameters only: these are not reconstructed cosmic densities. */
export interface HistoryVisualState {
  ageGyr:number;
  plasma:number;
  lastScattering:number;
  structure:number;
  stars:number;
  solar:number;
  expansion:number;
}

const smooth=(start:number,end:number,value:number)=>{
  const x=Math.max(0,Math.min(1,(value-start)/(end-start)));
  return x*x*(3-2*x);
};

export function historyVisualState(inputAgeGyr:number):HistoryVisualState {
  const ageGyr=Number.isFinite(inputAgeGyr)?Math.max(0,Math.min(13.8,inputAgeGyr)):0;
  // Fades intentionally overlap. Milestone anchors belong to the sourced UI,
  // while these broad blends make the separately labelled conceptual scene.
  const plasma=1-smooth(0.0001,0.0006,ageGyr);
  const lastScattering=smooth(0.00015,0.00038,ageGyr)*(1-smooth(0.0006,0.02,ageGyr));
  // A faint cue is visible on an anchor itself; nothing appears before it.
  const stars=ageGyr<0.1?0:.12+.88*smooth(0.1,0.5,ageGyr);
  const structure=ageGyr<0.28?0:.12+.88*smooth(0.28,2.5,ageGyr);
  const solar=ageGyr<9.2?0:.2+.8*smooth(9.2,9.6,ageGyr);
  const expansion=.42+.58*smooth(0,Math.log1p(13.8),Math.log1p(ageGyr));
  return {ageGyr,plasma,lastScattering,structure,stars,solar,expansion};
}

/** Deterministic illustration, deliberately unrelated to a measured catalogue. */
export function seededRandom(seed:number):()=>number {
  let value=seed>>>0;
  return ()=>{value=(1664525*value+1013904223)>>>0;return value/4294967296;};
}
