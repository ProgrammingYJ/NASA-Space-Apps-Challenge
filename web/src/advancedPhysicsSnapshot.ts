/** Versioned user PDE states. Validation checks consistency, not authorship or observational truth. */
import {createQuantum,advanceQuantum,quantumDiagnostics,createMaxwell,advanceMaxwell,maxwellDiagnostics,createEuler,advanceEuler,eulerDiagnostics,DEFAULT_QUANTUM,DEFAULT_MAXWELL,DEFAULT_EULER,type QuantumOptions,type MaxwellOptions,type EulerOptions,type QuantumState,type MaxwellState,type EulerState} from './advancedPhysicsMath';
import {advancedPhysicsSources} from './advancedPhysicsSources';

export type AdvancedModel='quantum'|'maxwell'|'euler';
export type AdvancedState=QuantumState|MaxwellState|EulerState;
type RecordValue=Record<string,unknown>;
export interface AdvancedPhysicsSnapshot {
  schema_version:'1.0';kind:'advanced-pde-state';model:AdvancedModel;
  provenance:{quantity_class:'user_numeric_experiment';observational_data:false;coupling:'independent';unit_system:'scaled_dimensionless';equation_sources:string[]};
  state:RecordValue;diagnostics:RecordValue;
}
function record(value:unknown):RecordValue {if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_model_record');return value as RecordValue;}
function keys(value:RecordValue,expected:string[]){if(Object.keys(value).sort().join('|')!==expected.slice().sort().join('|'))throw new Error('incompatible_model_fields');}
function field(value:unknown,length:number){if(!Array.isArray(value)||value.length!==length||value.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e8))throw new Error('invalid_field_array');return new Float64Array(value);}
function counter(value:unknown,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e8||integer&&!Number.isInteger(value))throw new Error('invalid_model_counter');return value;}
function equal(value:unknown,expected:unknown):boolean {
  if(typeof expected==='number')return typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(expected)&&Math.abs(value-expected)<=1e-10*Math.max(1,Math.abs(expected));
  if(Array.isArray(expected))return Array.isArray(value)&&value.length===expected.length&&expected.every((item,i)=>equal(value[i],item));
  return value===expected;
}
export function advancedPhysicsDiagnostics(s:AdvancedState):RecordValue {
  if(s.kind==='schrodinger-cn-1d-v1'){const {probability,...diagnostics}=quantumDiagnostics(s);void probability;return diagnostics;}
  return s.kind==='maxwell-yee-tmz-2d-v1'?maxwellDiagnostics(s):eulerDiagnostics(s);
}
function provenance(model:AdvancedModel):AdvancedPhysicsSnapshot['provenance'] {return {quantity_class:'user_numeric_experiment',observational_data:false,coupling:'independent',unit_system:'scaled_dimensionless',equation_sources:advancedPhysicsSources[model].map(source=>source.url)};}

export function restoreAdvancedPhysicsSnapshot(raw:unknown):{model:AdvancedModel;state:AdvancedState} {
  const value=record(raw);keys(value,['schema_version','kind','model','provenance','state','diagnostics']);
  if(value.schema_version!=='1.0'||value.kind!=='advanced-pde-state'||!['quantum','maxwell','euler'].includes(String(value.model)))throw new Error('incompatible_model_version');
  const model=value.model as AdvancedModel,source=record(value.provenance),expectedSource=provenance(model);keys(source,Object.keys(expectedSource));
  for(const [key,expected] of Object.entries(expectedSource))if(!equal(source[key],expected))throw new Error('incompatible_model_provenance');
  const saved=record(value.state),options=record(saved.options),time=counter(saved.time),steps=counter(saved.steps,true);
  if(steps===0&&time!==0||steps>0&&time===0)throw new Error('inconsistent_model_clock');
  const common=['algorithm_version','options','time','steps'];let state:AdvancedState;
  if(model==='quantum'){
    keys(saved,[...common,'real','imag']);keys(options,Object.keys(DEFAULT_QUANTUM));const base=createQuantum(options as unknown as QuantumOptions);
    if(saved.algorithm_version!==base.kind)throw new Error('incompatible_solver_algorithm');
    base.real=field(saved.real,base.real.length);base.imag=field(saved.imag,base.imag.length);
    if(base.real[0]!==0||base.real.at(-1)!==0||base.imag[0]!==0||base.imag.at(-1)!==0)throw new Error('invalid_dirichlet_boundary');
    if(Math.abs(time-steps*base.dt)>1e-8*Math.max(1,time))throw new Error('inconsistent_model_clock');
    base.time=time;base.steps=steps;const d=quantumDiagnostics(base);if(!(d.norm>1e-12))throw new Error('zero_wavefunction');state=advanceQuantum(base,0);
  }else if(model==='maxwell'){
    keys(saved,[...common,'ez','hx','hy']);keys(options,Object.keys(DEFAULT_MAXWELL));const base=createMaxwell(options as unknown as MaxwellOptions);
    if(saved.algorithm_version!==base.kind)throw new Error('incompatible_solver_algorithm');
    base.ez=field(saved.ez,base.ez.length);base.hx=field(saved.hx,base.hx.length);base.hy=field(saved.hy,base.hy.length);
    if(base.ez.some((x,i)=>base.pec[i]&&x!==0))throw new Error('invalid_pec_boundary');
    if(Math.abs(time-steps*base.dt)>1e-8*Math.max(1,time))throw new Error('inconsistent_model_clock');
    base.time=time;base.steps=steps;state=advanceMaxwell(base,0);
  }else{
    keys(saved,[...common,'u','last_dt','floor_applications','mass_correction','energy_correction']);keys(options,Object.keys(DEFAULT_EULER));const base=createEuler(options as unknown as EulerOptions);
    if(saved.algorithm_version!==base.kind)throw new Error('incompatible_solver_algorithm');
    base.u=field(saved.u,base.u.length);base.time=time;base.steps=steps;base.lastDt=counter(saved.last_dt);base.floorApplications=counter(saved.floor_applications,true);base.massCorrection=counter(saved.mass_correction);base.energyCorrection=counter(saved.energy_correction);
    const d=eulerDiagnostics(base);if(!(d.minDensity>0&&d.minPressure>0))throw new Error('nonpositive_gas');
    if(steps===0&&(base.lastDt!==0||base.floorApplications!==0||base.massCorrection!==0||base.energyCorrection!==0)||steps>0&&(!(base.lastDt>0)||base.lastDt>time*(1+1e-10)))throw new Error('inconsistent_model_clock');
    if(base.floorApplications===0&&(base.massCorrection!==0||base.energyCorrection!==0)||base.floorApplications>0&&base.massCorrection===0&&base.energyCorrection===0)throw new Error('inconsistent_floor_counters');
    state=advanceEuler(base,0);
  }
  const diagnostics=record(value.diagnostics),actual=advancedPhysicsDiagnostics(state);keys(diagnostics,Object.keys(actual));
  for(const [key,expected] of Object.entries(actual))if(!equal(diagnostics[key],expected))throw new Error('inconsistent_model_diagnostics');
  return {model,state};
}

export function createAdvancedPhysicsSnapshot(model:AdvancedModel,state:AdvancedState):AdvancedPhysicsSnapshot {
  const common={algorithm_version:state.kind,options:{...state.options},time:state.time,steps:state.steps};
  const saved=state.kind==='schrodinger-cn-1d-v1'?{...common,real:Array.from(state.real),imag:Array.from(state.imag)}:state.kind==='maxwell-yee-tmz-2d-v1'?{...common,ez:Array.from(state.ez),hx:Array.from(state.hx),hy:Array.from(state.hy)}:{...common,u:Array.from(state.u),last_dt:state.lastDt,floor_applications:state.floorApplications,mass_correction:state.massCorrection,energy_correction:state.energyCorrection};
  const result:AdvancedPhysicsSnapshot={schema_version:'1.0',kind:'advanced-pde-state',model,provenance:provenance(model),state:saved,diagnostics:advancedPhysicsDiagnostics(state)};
  // Do not export a state that the same version cannot restore faithfully.
  restoreAdvancedPhysicsSnapshot(result);return result;
}
