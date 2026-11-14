/** Educational softened Newtonian point-mass experiment, never a GR merger solver. */
export const SANDBOX_VERSION='newtonian-softened-verlet-v1';
export const C_SI=299792458;
// Same JPL adopted constants as /api/v1/black-holes and /observer-physics.
export const SOLAR_GM_KM3_S2=132712440041.27942;
export const AU_KM=149597870.7;
export type Vector3=[number,number,number];
export type SandboxPreset='head-on'|'flyby'|'binary'|'scatter';
export interface SandboxSource {object_id:string;name:string;mass_solar:number;mass_source_sha256:string|null}
export interface SandboxBody {id:string;name:string;mass_solar:number;position:Vector3;velocity:Vector3;source:SandboxSource|null;members:string[];trail:Vector3[]}
export interface SandboxParameters {g_factor:number;softening:number;merge_policy:'none'|'distance';merge_radius:number;step_tau:number;external_acceleration:Vector3;linear_drag:number}
export interface MergeEvent {time_tau:number;members:string[];mass_solar:number;energy_jump:number}
export interface SandboxState {algorithm_version:typeof SANDBOX_VERSION;time_tau:number;mass_unit_solar:number;length_unit_au:number;parameters:SandboxParameters;bodies:SandboxBody[];initial_bodies:SandboxBody[];initial_energy:number;merge_energy_jump:number;events:MergeEvent[];limited:boolean;steps:number}
export interface SandboxSetup {preset:SandboxPreset;separation:number;speed:number;inclination_deg:number;time_scale:number;view:'2d'|'3d'}
export interface SandboxSnapshot {schema_version:'1.0';algorithm_version:typeof SANDBOX_VERSION;saved_utc:string;source_manifest_sha256:string|null;setup:SandboxSetup;camera:{span:number;center:[number,number];angles:[number,number]};state:SandboxState}
export const DEFAULT_PARAMETERS:SandboxParameters={g_factor:1,softening:.02,merge_policy:'distance',merge_radius:.12,step_tau:.025,external_acceleration:[0,0,0],linear_drag:0};
export const DEFAULT_SETUP:SandboxSetup={preset:'binary',separation:8,speed:1,inclination_deg:0,time_scale:4,view:'2d'};
const vector=(x=0,y=0,z=0):Vector3=>[x,y,z];
const add=(a:Vector3,b:Vector3):Vector3=>a.map((x,i)=>x+b[i]) as Vector3;
const scale=(a:Vector3,k:number):Vector3=>a.map(x=>x*k) as Vector3;
const minus=(a:Vector3,b:Vector3):Vector3=>a.map((x,i)=>x-b[i]) as Vector3;
const dot=(a:Vector3,b:Vector3)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const length=(a:Vector3)=>Math.hypot(...a);
const clone=<T>(value:T):T=>structuredClone(value);
function range(value:unknown,min:number,max:number):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;}
function finiteVector(value:unknown):value is Vector3{return Array.isArray(value)&&value.length===3&&value.every(x=>range(x,-1e12,1e12));}
export function validateParameters(value:SandboxParameters):boolean{return Boolean(value)&&range(value.g_factor,0,10)&&range(value.softening,.00001,2)&&['none','distance'].includes(value.merge_policy)&&range(value.merge_radius,.00001,2)&&range(value.step_tau,.00001,.1)&&finiteVector(value.external_acceleration)&&value.external_acceleration.every(x=>range(x,-10,10))&&range(value.linear_drag,0,5);}
export function validateSetup(value:SandboxSetup):boolean{return Boolean(value)&&['head-on','flyby','binary','scatter'].includes(value.preset)&&range(value.separation,2,80)&&range(value.speed,0,5)&&range(value.inclination_deg,-90,90)&&range(value.time_scale,.05,40)&&['2d','3d'].includes(value.view);}
export function schwarzschildRadiusAu(massSolar:number):number{return 2*SOLAR_GM_KM3_S2*massSolar/((C_SI/1000)**2*AU_KM);}
export function physicalUnits(state:Pick<SandboxState,'mass_unit_solar'|'length_unit_au'>){const lengthKm=state.length_unit_au*AU_KM;const seconds=Math.sqrt(lengthKm**3/(SOLAR_GM_KM3_S2*state.mass_unit_solar));return {length_au:state.length_unit_au,time_seconds:seconds,velocity_km_s:lengthKm/seconds};}
export function diagnostics(state:SandboxState){
  const total=state.bodies.reduce((sum,b)=>sum+b.mass_solar,0);const momentum=vector(),center=vector();let kinetic=0,potential=0;
  for(const b of state.bodies){const mass=b.mass_solar/state.mass_unit_solar;kinetic+=.5*mass*dot(b.velocity,b.velocity);potential-=mass*dot(state.parameters.external_acceleration,b.position);for(let k=0;k<3;k++){momentum[k]+=mass*b.velocity[k];center[k]+=b.mass_solar*b.position[k]/total;}}
  for(let i=0;i<state.bodies.length;i++)for(let j=i+1;j<state.bodies.length;j++){const a=state.bodies[i],b=state.bodies[j],r=minus(a.position,b.position);potential-=state.parameters.g_factor*(a.mass_solar/state.mass_unit_solar)*(b.mass_solar/state.mass_unit_solar)/Math.sqrt(dot(r,r)+state.parameters.softening**2);}
  const energy=kinetic+potential,scaleEnergy=Math.max(Math.abs(state.initial_energy),1e-12);
  const maxBeta=Math.max(0,...state.bodies.map(b=>length(b.velocity)*physicalUnits(state).velocity_km_s*1000/C_SI));
  const minimumSeparation=state.bodies.length>1?Math.min(...state.bodies.flatMap((b,i)=>state.bodies.slice(i+1).map(a=>length(minus(a.position,b.position))))):null;
  return {total_mass_solar:total,momentum,center,energy,kinetic,potential,energy_drift:(energy-state.initial_energy-state.merge_energy_jump)/scaleEnergy,max_beta:maxBeta,minimum_separation:minimumSeparation};
}

export function createSandbox(setup:SandboxSetup,specs:{source:SandboxSource;mass_solar?:number}[],parameters:SandboxParameters=DEFAULT_PARAMETERS):SandboxState{
  if(!validateSetup(setup)||!validateParameters(parameters)||specs.length<(setup.preset==='scatter'?3:2))throw new Error('invalid_sandbox_setup');
  const chosen=specs.slice(0,setup.preset==='scatter'?3:2);const masses=chosen.map(item=>item.mass_solar??item.source.mass_solar);
  if(masses.some(mass=>!range(mass,.01,1e12)))throw new Error('invalid_sandbox_mass');
  const total=masses.reduce((sum,m)=>sum+m,0),d=setup.separation;
  const state:SandboxState={algorithm_version:SANDBOX_VERSION,time_tau:0,mass_unit_solar:total,length_unit_au:1000*schwarzschildRadiusAu(total),parameters:clone(parameters),bodies:[],initial_bodies:[],initial_energy:0,merge_energy_jump:0,events:[],limited:false,steps:0};
  const circular=Math.sqrt(parameters.g_factor*d*d/(d*d+parameters.softening**2)**1.5)*setup.speed;
  const angle=setup.inclination_deg*Math.PI/180;
  const rotate=(p:Vector3):Vector3=>[p[0],p[1]*Math.cos(angle)-p[2]*Math.sin(angle),p[1]*Math.sin(angle)+p[2]*Math.cos(angle)];
  for(let i=0;i<chosen.length;i++){
    const side=i===0?-1:1,other=i<2?masses[1-i]/(masses[0]+masses[1]):0;
    let position:Vector3=[side*d*other,0,0],velocity:Vector3=[0,side*circular*other,0];
    if(setup.preset==='head-on')velocity=[-side*circular*.25*other,0,0];
    if(setup.preset==='flyby'){position=[side*d*other,side*d*.35*other,0];velocity=[-side*circular*1.8*other,0,0];}
    if(setup.preset==='scatter'){position=i===0?[-d/2,0,0]:i===1?[d/2,0,0]:[0,d*.8,d*.12];velocity=i===0?[0,circular*.25,0]:i===1?[0,-circular*.25,0]:[circular*.15,0,-circular*.04];}
    const p=rotate(position);state.bodies.push({id:`body-${i+1}`,name:chosen[i].source.name,mass_solar:masses[i],position:p,velocity:rotate(velocity),source:clone(chosen[i].source),members:[`body-${i+1}`],trail:[p.slice() as Vector3]});
  }
  const center=diagnostics(state).center,momentum=diagnostics(state).momentum;
  for(const b of state.bodies){b.position=minus(b.position,center);b.velocity=minus(b.velocity,momentum);b.trail=[b.position.slice() as Vector3];}
  state.initial_bodies=clone(state.bodies);state.initial_energy=diagnostics(state).energy;return state;
}
function accelerations(state:SandboxState):Vector3[]{
  const result=state.bodies.map(()=>state.parameters.external_acceleration.slice() as Vector3);
  for(let i=0;i<state.bodies.length;i++)for(let j=i+1;j<state.bodies.length;j++){
    const a=state.bodies[i],b=state.bodies[j],delta=minus(b.position,a.position);
    const factor=state.parameters.g_factor/(dot(delta,delta)+state.parameters.softening**2)**1.5;
    for(let k=0;k<3;k++){result[i][k]+=factor*b.mass_solar/state.mass_unit_solar*delta[k];result[j][k]-=factor*a.mass_solar/state.mass_unit_solar*delta[k];}
  }
  return result;
}
function crossingDistance(a0:Vector3,b0:Vector3,a1:Vector3,b1:Vector3){const start=minus(a0,b0),change=minus(minus(a1,b1),start),speed=dot(change,change);const u=speed>0?Math.min(1,Math.max(0,-dot(start,change)/speed)):0;return length(add(start,scale(change,u)));}
function mergeContacts(state:SandboxState,previous:Map<string,Vector3>){
  if(state.parameters.merge_policy!=='distance')return;
  let merged=true;
  while(merged){merged=false;outer:for(let i=0;i<state.bodies.length;i++)for(let j=i+1;j<state.bodies.length;j++){
    const a=state.bodies[i],b=state.bodies[j];
    const distance=crossingDistance(previous.get(a.id)??a.position,previous.get(b.id)??b.position,a.position,b.position);
    if(distance>state.parameters.merge_radius)continue;
    const before=diagnostics(state).energy,mass=a.mass_solar+b.mass_solar;
    const body:SandboxBody={id:a.id+'+'+b.id,name:(a.name+' + '+b.name).slice(0,200),mass_solar:mass,position:scale(add(scale(a.position,a.mass_solar),scale(b.position,b.mass_solar)),1/mass),velocity:scale(add(scale(a.velocity,a.mass_solar),scale(b.velocity,b.mass_solar)),1/mass),source:null,members:[...a.members,...b.members],trail:[]};
    body.trail=[body.position.slice() as Vector3];state.bodies.splice(j,1);state.bodies.splice(i,1,body);
    const jump=diagnostics(state).energy-before;state.merge_energy_jump+=jump;state.events.push({time_tau:state.time_tau,members:body.members.slice(),mass_solar:mass,energy_jump:jump});state.events=state.events.slice(-32);merged=true;break outer;
  }}
}
export function advanceSandbox(input:SandboxState,elapsedTau:number,maxSteps=256):SandboxState{
  if(!range(elapsedTau,0,100)||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>4096||!validateParameters(input.parameters))throw new Error('invalid_sandbox_step');
  const state=clone(input);let remaining=elapsedTau,steps=0;
  while(remaining>1e-12&&steps<maxSteps){
    let dt=Math.min(remaining,state.parameters.step_tau);
    if(state.parameters.g_factor>0)for(let i=0;i<state.bodies.length;i++)for(let j=i+1;j<state.bodies.length;j++){const a=state.bodies[i],b=state.bodies[j],r=minus(a.position,b.position);const local=Math.sqrt((dot(r,r)+state.parameters.softening**2)**1.5/(state.parameters.g_factor*(a.mass_solar+b.mass_solar)/state.mass_unit_solar));dt=Math.min(dt,Math.max(1e-7,local*.04));}
    const previous=new Map(state.bodies.map(b=>[b.id,b.position.slice() as Vector3])),a0=accelerations(state);
    const damping=Math.exp(-state.parameters.linear_drag*dt/2);
    for(let i=0;i<state.bodies.length;i++){const b=state.bodies[i];b.velocity=add(scale(b.velocity,damping),scale(a0[i],dt/2));b.position=add(b.position,scale(b.velocity,dt));}
    const a1=accelerations(state);
    for(let i=0;i<state.bodies.length;i++)state.bodies[i].velocity=scale(add(state.bodies[i].velocity,scale(a1[i],dt/2)),damping);
    state.time_tau+=dt;remaining-=dt;steps++;mergeContacts(state,previous);
    if(state.bodies.some(b=>!finiteVector(b.position)||!finiteVector(b.velocity)))throw new Error('nonfinite_sandbox_state');
  }
  for(const b of state.bodies){b.trail.push(b.position.slice() as Vector3);b.trail=b.trail.slice(-240);}
  state.limited=remaining>1e-9;state.steps=steps;return state;
}

function onlyKeys(value:object,keys:string[]){return Object.keys(value).every(key=>keys.includes(key));}
/** Editing the free composer starts a new experiment; source masses remain separate metadata. */
export function rebaseSandbox(input:SandboxState,bodies:SandboxBody[],parameters=input.parameters):SandboxState{
  if(bodies.length<1||bodies.length>12||!validateParameters(parameters)||bodies.some(b=>!range(b.mass_solar,.01,12e12)||!finiteVector(b.position)||!finiteVector(b.velocity))||bodies.reduce((sum,b)=>sum+b.mass_solar,0)>12e12)throw new Error('invalid_sandbox_setup');
  const next=clone(input);next.bodies=clone(bodies).map(b=>({...b,members:[b.id],trail:[b.position.slice() as Vector3]}));next.initial_bodies=clone(next.bodies);next.mass_unit_solar=next.bodies.reduce((sum,b)=>sum+b.mass_solar,0);next.length_unit_au=1000*schwarzschildRadiusAu(next.mass_unit_solar);next.time_tau=0;next.parameters=clone(parameters);next.events=[];next.merge_energy_jump=0;next.limited=false;next.steps=0;next.initial_energy=diagnostics(next).energy;return next;
}
export function parseSandboxSnapshot(text:string):SandboxSnapshot{
  if(text.length>1_000_000)throw new Error('invalid_sandbox_snapshot');
  const data=JSON.parse(text,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw new Error('invalid_sandbox_snapshot');return value;}) as SandboxSnapshot;
  const s=data?.state;
  if(data?.schema_version!=='1.0'||data.algorithm_version!==SANDBOX_VERSION||!s||s.algorithm_version!==SANDBOX_VERSION||!onlyKeys(data,['schema_version','algorithm_version','saved_utc','source_manifest_sha256','setup','camera','state'])||!validateSetup(data.setup)||!validateParameters(s.parameters)||!range(s.time_tau,0,1e12)||!range(s.mass_unit_solar,.01,12e12)||!range(s.length_unit_au,1e-12,1e12)||!Number.isFinite(s.initial_energy)||!Number.isFinite(s.merge_energy_jump)||!Array.isArray(s.bodies)||s.bodies.length<1||s.bodies.length>12||!Array.isArray(s.events)||s.events.length>32||!range(s.steps,0,4096)||typeof s.limited!=='boolean'||typeof data.saved_utc!=='string'||!Number.isFinite(Date.parse(data.saved_utc))||!(data.source_manifest_sha256===null||/^[a-f0-9]{64}$/.test(data.source_manifest_sha256)))throw new Error('invalid_sandbox_snapshot');
  if(!data.camera||!onlyKeys(data.camera,['span','center','angles'])||!range(data.camera.span,.2,1e8)||![data.camera.center,data.camera.angles].every(value=>Array.isArray(value)&&value.length===2&&value.every(x=>range(x,-1e12,1e12))))throw new Error('invalid_sandbox_snapshot');
  if(!onlyKeys(s,['algorithm_version','time_tau','mass_unit_solar','length_unit_au','parameters','bodies','initial_bodies','initial_energy','merge_energy_jump','events','limited','steps'])||!onlyKeys(s.parameters,['g_factor','softening','merge_policy','merge_radius','step_tau','external_acceleration','linear_drag'])||!onlyKeys(data.setup,['preset','separation','speed','inclination_deg','time_scale','view'])||!Array.isArray(s.initial_bodies)||s.initial_bodies.length<1||s.initial_bodies.length>12)throw new Error('invalid_sandbox_snapshot');
  for(const collection of [s.bodies,s.initial_bodies]){const ids=new Set<string>();
  for(const b of collection){if(!b||!onlyKeys(b,['id','name','mass_solar','position','velocity','source','members','trail'])||typeof b.id!=='string'||b.id.length>100||ids.has(b.id)||typeof b.name!=='string'||b.name.length>250||!range(b.mass_solar,.01,12e12)||!finiteVector(b.position)||!finiteVector(b.velocity)||!Array.isArray(b.members)||b.members.length>12||!b.members.every(id=>typeof id==='string'&&id.length<100)||!Array.isArray(b.trail)||b.trail.length>240||!b.trail.every(finiteVector))throw new Error('invalid_sandbox_snapshot');ids.add(b.id);
    if(b.source!==null&&(!b.source||!onlyKeys(b.source,['object_id','name','mass_solar','mass_source_sha256'])||typeof b.source.object_id!=='string'||b.source.object_id.length>150||typeof b.source.name!=='string'||b.source.name.length>200||!range(b.source.mass_solar,.01,1e12)||!(b.source.mass_source_sha256===null||/^[a-f0-9]{64}$/.test(b.source.mass_source_sha256))))throw new Error('invalid_sandbox_snapshot');
  }}
  for(const e of s.events)if(!e||!onlyKeys(e,['time_tau','members','mass_solar','energy_jump'])||!range(e.time_tau,0,s.time_tau)||!range(e.mass_solar,.01,12e12)||!Number.isFinite(e.energy_jump)||!Array.isArray(e.members)||e.members.length>12||!e.members.every(id=>typeof id==='string'&&id.length<100))throw new Error('invalid_sandbox_snapshot');
  const total=s.bodies.reduce((sum,b)=>sum+b.mass_solar,0),initialTotal=s.initial_bodies.reduce((sum,b)=>sum+b.mass_solar,0);if(Math.abs(total-s.mass_unit_solar)>s.mass_unit_solar*1e-10||Math.abs(initialTotal-s.mass_unit_solar)>s.mass_unit_solar*1e-10||Math.abs(s.length_unit_au-1000*schwarzschildRadiusAu(s.mass_unit_solar))>s.length_unit_au*1e-10)throw new Error('invalid_sandbox_snapshot');
  const initialIds=s.initial_bodies.map(body=>body.id).sort(),members=s.bodies.flatMap(body=>body.members).sort();if(JSON.stringify(initialIds)!==JSON.stringify(members))throw new Error('invalid_sandbox_snapshot');
  const initialEnergy=diagnostics({...s,bodies:s.initial_bodies}).energy,eventJump=s.events.reduce((sum,e)=>sum+e.energy_jump,0);if(Math.abs(initialEnergy-s.initial_energy)>Math.max(1,Math.abs(initialEnergy))*1e-9||Math.abs(eventJump-s.merge_energy_jump)>Math.max(1,Math.abs(eventJump))*1e-9)throw new Error('invalid_sandbox_snapshot');
  return clone(data);
}
