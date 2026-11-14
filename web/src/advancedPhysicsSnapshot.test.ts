import {describe,it,expect} from 'vitest';
import {createQuantum,advanceQuantum,createMaxwell,advanceMaxwell,createEuler,advanceEuler} from './advancedPhysicsMath';
import {createAdvancedPhysicsSnapshot,restoreAdvancedPhysicsSnapshot,advancedPhysicsDiagnostics,type AdvancedModel,type AdvancedState,type AdvancedPhysicsSnapshot} from './advancedPhysicsSnapshot';

function evolved(model:AdvancedModel):AdvancedState {return model==='quantum'?advanceQuantum(createQuantum({potential:'harmonic'}),23):model==='maxwell'?advanceMaxwell(createMaxwell({dielectricEpsilon:4,obstacleRadius:.1}),17):advanceEuler(createEuler({nx:48,ny:12,initial:'gaussian',boundary:'periodic'}),9);}
function saved(model:AdvancedModel){return JSON.parse(JSON.stringify(createAdvancedPhysicsSnapshot(model,evolved(model)))) as AdvancedPhysicsSnapshot;}
describe('user PDE snapshot contract',()=>{
  it.each(['quantum','maxwell','euler'] as const)('restores %s JSON numerical fields, clock, parameters and derived diagnostics in a fresh state',model=>{
    const before=evolved(model),record=JSON.parse(JSON.stringify(createAdvancedPhysicsSnapshot(model,before))),after=restoreAdvancedPhysicsSnapshot(record).state;
    // JSON represents both signed zeros as 0; their sign carries no model quantity.
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));expect(after).not.toBe(before);expect(advancedPhysicsDiagnostics(after)).toEqual(advancedPhysicsDiagnostics(before));
    expect(record.provenance).toMatchObject({quantity_class:'user_numeric_experiment',observational_data:false,coupling:'independent',unit_system:'scaled_dimensionless'});
    expect(record.provenance.equation_sources.every((url:string)=>url.startsWith('https://'))).toBe(true);
  });
  it('preserves explicit positivity correction amounts and the variable Euler last step',()=>{
    let state=createEuler({nx:16,ny:4,initial:'uniform'});for(let k=0;k<state.u.length;k+=4){state.u[k]=1e-10;state.u[k+1]=0;state.u[k+2]=0;state.u[k+3]=1e-10/(state.options.gamma-1);}
    state=advanceEuler(state,1);expect(state.floorApplications).toBeGreaterThan(0);expect(state.massCorrection).toBeGreaterThan(0);expect(state.energyCorrection).toBeGreaterThan(0);
    const after=restoreAdvancedPhysicsSnapshot(JSON.parse(JSON.stringify(createAdvancedPhysicsSnapshot('euler',state)))).state;
    expect(after).toEqual(state);expect(advancedPhysicsDiagnostics(after)).toEqual(advancedPhysicsDiagnostics(state));
  });
  it('rejects another schema, solver algorithm or model identity instead of silently migrating',()=>{
    const wrongSchema=saved('quantum');(wrongSchema as unknown as {schema_version:string}).schema_version='2.0';expect(()=>restoreAdvancedPhysicsSnapshot(wrongSchema)).toThrow('version');
    const wrongAlgorithm=saved('quantum');wrongAlgorithm.state.algorithm_version='schrodinger-exact-v999';expect(()=>restoreAdvancedPhysicsSnapshot(wrongAlgorithm)).toThrow('algorithm');
    const wrongModel=saved('quantum');wrongModel.model='maxwell';expect(()=>restoreAdvancedPhysicsSnapshot(wrongModel)).toThrow();
    expect(()=>createAdvancedPhysicsSnapshot('euler',createQuantum())).toThrow();
  });
  it('rejects altered equation sources and observational/coupled provenance',()=>{
    const source=saved('maxwell');source.provenance.equation_sources[0]='https://example.com/unknown-source';expect(()=>restoreAdvancedPhysicsSnapshot(source)).toThrow('provenance');
    const observational=saved('euler');(observational.provenance as unknown as {observational_data:boolean}).observational_data=true;expect(()=>restoreAdvancedPhysicsSnapshot(observational)).toThrow('provenance');
    const coupled=saved('quantum');(coupled.provenance as unknown as {coupling:string}).coupling='quantum-gr';expect(()=>restoreAdvancedPhysicsSnapshot(coupled)).toThrow('provenance');
  });
  it('rejects truncated/nonfinite fields and extra or invalid option keys',()=>{
    const truncated=saved('quantum');(truncated.state.real as number[]).pop();expect(()=>restoreAdvancedPhysicsSnapshot(truncated)).toThrow('array');
    const nonfinite=saved('maxwell');(nonfinite.state.hy as number[])[10]=Infinity;expect(()=>restoreAdvancedPhysicsSnapshot(nonfinite)).toThrow('array');
    const unknown=saved('euler');(unknown.state.options as Record<string,unknown>).physical_viscosity=1;expect(()=>restoreAdvancedPhysicsSnapshot(unknown)).toThrow('fields');
    const bad=saved('quantum');(bad.state.options as Record<string,unknown>).points=1e9;expect(()=>restoreAdvancedPhysicsSnapshot(bad)).toThrow('parameters');
  });
  it('rejects Dirichlet/PEC boundary changes and zero quantum probability',()=>{
    const q=saved('quantum');(q.state.real as number[])[0]=1;expect(()=>restoreAdvancedPhysicsSnapshot(q)).toThrow('boundary');
    const m=saved('maxwell');(m.state.ez as number[])[0]=.1;expect(()=>restoreAdvancedPhysicsSnapshot(m)).toThrow('boundary');
    const zero=saved('quantum');(zero.state.real as number[]).fill(0);(zero.state.imag as number[]).fill(0);expect(()=>restoreAdvancedPhysicsSnapshot(zero)).toThrow('zero_wavefunction');
  });
  it('rejects nonpositive density or internal pressure without applying hidden floors',()=>{
    const density=saved('euler');(density.state.u as number[])[0]=0;expect(()=>restoreAdvancedPhysicsSnapshot(density)).toThrow('nonpositive');
    const pressure=saved('euler');(pressure.state.u as number[])[3]=0;expect(()=>restoreAdvancedPhysicsSnapshot(pressure)).toThrow('nonpositive');
  });
  it('rejects inconsistent clocks and correction counters',()=>{
    const clock=saved('quantum');clock.state.time=Number(clock.state.time)+.5;expect(()=>restoreAdvancedPhysicsSnapshot(clock)).toThrow('clock');
    const last=saved('euler');last.state.last_dt=Number(last.state.time)+1;expect(()=>restoreAdvancedPhysicsSnapshot(last)).toThrow('clock');
    const correction=saved('euler');correction.state.floor_applications=0;correction.state.energy_correction=1;expect(()=>restoreAdvancedPhysicsSnapshot(correction)).toThrow('floor');
    const fraction=saved('euler');fraction.state.floor_applications=.5;expect(()=>restoreAdvancedPhysicsSnapshot(fraction)).toThrow('counter');
  });
  it('recalculates diagnostics to reject changed fields or reported energies',()=>{
    const fields=saved('quantum');(fields.state.real as number[])[25]+=.2;expect(()=>restoreAdvancedPhysicsSnapshot(fields)).toThrow('diagnostics');
    const report=saved('maxwell');report.diagnostics.discreteEnergy=Number(report.diagnostics.discreteEnergy)+1;expect(()=>restoreAdvancedPhysicsSnapshot(report)).toThrow('diagnostics');
    const missing=saved('euler');delete missing.diagnostics.minPressure;expect(()=>restoreAdvancedPhysicsSnapshot(missing)).toThrow('fields');
  });
});
