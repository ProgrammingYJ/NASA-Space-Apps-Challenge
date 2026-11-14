import type {PlanetNineCoverage,PlanetNineEvidence,PlanetNineGravityResult,PlanetNineObserver,PlanetNineOrbit,PlanetNinePrediction,PlanetNinePresets,PlanetNineRestored} from './PlanetNineTypes';
const base='/api/v1/planet-nine';
export class PlanetNineAPIError extends Error {readonly code:string;constructor(code:string){super(code);this.code=code;}}
async function request<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
  const data:unknown=await response.json();
  if(!response.ok){const record=data&&typeof data==='object'?data as Record<string,unknown>:{};const detail=record.error&&typeof record.error==='object'?record.error as Record<string,unknown>:record;throw new PlanetNineAPIError(typeof detail.code==='string'?detail.code:`HTTP_${response.status}`);}
  return data as T;
}
export const planetNineClient={
  presets:(signal?:AbortSignal)=>request<PlanetNinePresets>('/presets',undefined,signal),
  predict:(input:{orbit:PlanetNineOrbit;start_jd_tdb:number;end_jd_tdb:number;samples:number;observer:PlanetNineObserver},signal?:AbortSignal)=>request<PlanetNinePrediction>('/predict',input,signal),
  coverage:(input:{orbit:PlanetNineOrbit;start_date:string;end_date:string},signal?:AbortSignal)=>request<PlanetNineCoverage>('/coverage',input,signal),
  gravityField:(input:{position_au:[number,number,number];jd_tdb:number;hypothesis?:PlanetNineOrbit;include_planets?:boolean},signal?:AbortSignal)=>request<PlanetNineGravityResult>('/gravity-field',input,signal),
  integrate:(input:{orbit:PlanetNineOrbit;start_jd_tdb:number;duration_days:number;step_days:number;include_planets:boolean;include_solar_gr_1pn:boolean},signal?:AbortSignal)=>request<PlanetNineGravityResult>('/integrate',input,signal),
  save:(input:PlanetNineEvidence,signal?:AbortSignal)=>request<Record<string,unknown>>('/evidence',input,signal),
  export:(id:string,signal?:AbortSignal)=>request<unknown>('/evidence/'+encodeURIComponent(id)+'/export',undefined,signal),
  import:(data:unknown,signal?:AbortSignal)=>request<PlanetNineRestored>('/evidence/import',data,signal),
};
