import type {UniverseData,UniverseBody} from './UniverseScene';
import type {Vec3} from './sceneMath';

export interface ModelDate {year:number;month:number;day:number}
export interface ModelDateDraft {year:string;month:string;day:string}
export interface LongTermBody {object_id:string;elements_j2000:number[];rates_per_century:number[];additional_terms:{b:number;c:number;s:number;f:number}}
export interface LongTermModel {
  algorithm_version:'jpl-kepler-long-term-v1';source_manifest_sha256:string;
  coverage:{min_date:ModelDate;max_date:ModelDate};
  tables:{long:{bodies:LongTermBody[]};short:{bodies:LongTermBody[]}};
  source?:{url:string;label:string};limitations:string[];
}
const rad=Math.PI/180;
/** Numeric calendar labels interpreted as TDB by the model, not historical UTC. */
export function modelDateMs(year:number,month=1,day=1){
  if(![year,month,day].every(Number.isInteger)||month<1||month>12||day<1||day>31)throw new Error('invalid_model_date');
  const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('invalid_model_date');
  return date.getTime();
}
export function modelDateParts(ms:number):ModelDate {const d=new Date(ms);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}
export function parseModelDateDraft(draft:ModelDateDraft):ModelDate {
  if(!/^-?\d+$/.test(draft.year)||!/^\d+$/.test(draft.month)||!/^\d+$/.test(draft.day))throw new Error('invalid_model_date');
  const date={year:Number(draft.year),month:Number(draft.month),day:Number(draft.day)};
  if(![date.year,date.month,date.day].every(Number.isSafeInteger))throw new Error('invalid_model_date');
  modelDateMs(date.year,date.month,date.day);
  return date;
}
export function simulationOrbit(body:LongTermBody,ms:number):Vec3[] {
  const T=(2440587.5+ms/86400000-2451545)/36525;
  const [a,e,I,,p,N]=body.elements_j2000.map((v,i)=>v+T*body.rates_per_century[i]);
  const w=(p-N)*rad,n=N*rad,inc=I*rad;
  return Array.from({length:129},(_,i)=>{const E=i*Math.PI*2/128,x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);return [
    (Math.cos(w)*Math.cos(n)-Math.sin(w)*Math.sin(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.cos(n)-Math.cos(w)*Math.sin(n)*Math.cos(inc))*y,
    (Math.cos(w)*Math.sin(n)+Math.sin(w)*Math.cos(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.sin(n)+Math.cos(w)*Math.cos(n)*Math.cos(inc))*y,
    Math.sin(w)*Math.sin(inc)*x+Math.cos(w)*Math.sin(inc)*y] as Vec3;});
}
export function simulationPosition(body:LongTermBody,ms:number):Vec3 {
  if(!Number.isFinite(ms))throw new Error('invalid_model_date');
  const T=(2440587.5+ms/86400000-2451545)/36525;
  const [a,e,I,L,p,N]=body.elements_j2000.map((value,i)=>value+T*body.rates_per_century[i]);
  const {b=0,c=0,s=0,f=0}=body.additional_terms??{};
  if(!(a>0&&e>=0&&e<1))throw new Error('unsupported_model_elements');
  const M=((L-p+b*T*T+c*Math.cos(f*T*rad)+s*Math.sin(f*T*rad)+180)%360+360)%360-180;
  let E=M*rad;for(let i=0;i<30;i++){const change=(E-e*Math.sin(E)-M*rad)/(1-e*Math.cos(E));E-=change;if(Math.abs(change)<1e-13)break;}
  const x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E),w=(p-N)*rad,n=N*rad,inc=I*rad;
  return [(Math.cos(w)*Math.cos(n)-Math.sin(w)*Math.sin(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.cos(n)-Math.cos(w)*Math.sin(n)*Math.cos(inc))*y,
    (Math.cos(w)*Math.sin(n)+Math.sin(w)*Math.cos(n)*Math.cos(inc))*x+(-Math.sin(w)*Math.sin(n)+Math.cos(w)*Math.cos(n)*Math.cos(inc))*y,
    Math.sin(w)*Math.sin(inc)*x+Math.cos(w)*Math.sin(inc)*y];
}
export function simulationScene<T extends UniverseData>(base:T,model:LongTermModel,ms:number):T {
  const min=model.coverage.min_date,max=model.coverage.max_date;
  if(ms<modelDateMs(min.year,min.month,min.day)||ms>modelDateMs(max.year,max.month,max.day))throw new Error('unsupported_model_date');
  const byId=new Map(base.objects.map(b=>[b.object_id,b]));
  const source=model.source??{url:'https://ssd.jpl.nasa.gov/planets/approx_pos.html',label:'JPL approximate planetary positions'};
  const objects:UniverseBody[]=[{...byId.get('sun')!,object_id:'sun',name:'Sun',kind:'solar_system',position_au:[0,0,0],position_kind:'approximate_simulation',source}];
  for(const record of model.tables.long.bodies){
    const id=record.object_id==='earth-moon-barycenter'?'earth':record.object_id;
    const body=byId.get(id);if(!body)continue;
    objects.push({...body,object_id:id,position_au:simulationPosition(record,ms),position_kind:'approximate_simulation',orbit:{kind:'fitted_kepler_simulation_guide',epoch:new Date(ms).toISOString(),points_au:simulationOrbit(record,ms),closed:true,source,limitations:['Fitted Kepler ellipse at the selected simulation epoch; not an integrated past/future trajectory.']},source});
  }
  return {...base,epoch:new Date(ms).toISOString(),coordinate_frame:'mean ecliptic and equinox J2000; heliocentric; approximate simulation',objects,limitations:model.limitations};
}
