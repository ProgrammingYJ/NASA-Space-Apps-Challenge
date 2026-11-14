import {describe,it,expect} from 'vitest';
import {fitMoonOsculatingState,propagateMoonOsculating,moonGmAu3Day2,MOON_GM_SOURCE,MOON_PARENT_GM_KM3_S2,EARTH_MOON_OFFSET_SCALE} from './moonKepler';
import type {Vec3} from './sceneMath';

// Original saved Horizons Titan parent-relative state at the first UTC knot.
// Its runtime reader separately converts the label to this TDB JD.
const titan={tdb_jd:2461357.500800726,
  position_au:[.000240211872651548,-.007213669767532534,.003695603884869861] as Vec3,
  velocity_au_day:[.003223765759439939,.00003512534319663326,-.0003387797465696696] as Vec3};
const dot=(a:Vec3,b:Vec3)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
const angularMomentum=(r:Vec3,v:Vec3)=>Math.hypot(r[1]*v[2]-r[2]*v[1],r[2]*v[0]-r[0]*v[2],r[0]*v[1]-r[1]*v[0]);

describe('source-state osculating Moon approximation',()=>{
  it('retains the source GM units and the Earth-to-EMB conversion without inferring a moon mass',()=>{
    expect(MOON_GM_SOURCE.units).toBe('km3/s2');expect(MOON_GM_SOURCE.au_km).toBe(149597870.7);expect(MOON_GM_SOURCE.day_s).toBe(86400);
    expect(moonGmAu3Day2(1)).toBeCloseTo(86400**2/149597870.7**3,26);
    expect(MOON_PARENT_GM_KM3_S2.saturn).toBe(37940584.8418);
    expect(EARTH_MOON_OFFSET_SCALE).toBe(398600.435507/403503.23562500003);
  });
  it('reconstructs the independently saved source position and velocity at the exact TDB epoch',()=>{
    const model=fitMoonOsculatingState(titan,moonGmAu3Day2(MOON_PARENT_GM_KM3_S2.saturn))!;
    expect(model).not.toBeNull();expect(model.source_epoch_jd_tdb).toBe(2461357.500800726);
    expect(model.source_epoch_jd_tdb).not.toBe(2461357.5);
    const state=propagateMoonOsculating(model,titan.tdb_jd)!;
    state.position_au.forEach((value,i)=>expect(value).toBeCloseTo(titan.position_au[i],14));
    state.velocity_au_day.forEach((value,i)=>expect(value).toBeCloseTo(titan.velocity_au_day[i],14));
    expect(model.semimajor_axis_au*149597870.7).toBeCloseTo(1221944.1479069525,5);
    expect(model.eccentricity).toBeCloseTo(.028743821040130756,13);
    expect(model.orbit_points_au).toHaveLength(129);expect(model.orbit_points_au[0]).toEqual(model.orbit_points_au[128]);
  });
  it('matches the source velocity through a short central difference and conserves two-body invariants',()=>{
    const mu=moonGmAu3Day2(MOON_PARENT_GM_KM3_S2.saturn),model=fitMoonOsculatingState(titan,mu)!;
    const beforeJd=titan.tdb_jd-.001,afterJd=titan.tdb_jd+.001;
    const before=propagateMoonOsculating(model,beforeJd)!,after=propagateMoonOsculating(model,afterJd)!;
    const derivative=after.position_au.map((value,i)=>(value-before.position_au[i])/(afterJd-beforeJd));
    derivative.forEach((value,i)=>expect(Math.abs(value-titan.velocity_au_day[i])).toBeLessThan(3e-10));
    const energy=dot(titan.velocity_au_day,titan.velocity_au_day)/2-mu/Math.hypot(...titan.position_au),h=angularMomentum(titan.position_au,titan.velocity_au_day);
    for(const fraction of [.1,.25,.7,1]){
      const state=propagateMoonOsculating(model,titan.tdb_jd+fraction*model.period_days)!;
      const nextEnergy=dot(state.velocity_au_day,state.velocity_au_day)/2-mu/Math.hypot(...state.position_au);
      expect(Math.abs((nextEnergy-energy)/energy)).toBeLessThan(1e-12);
      expect(Math.abs((angularMomentum(state.position_au,state.velocity_au_day)-h)/h)).toBeLessThan(1e-12);
    }
  });
  it('preserves an analytic retrograde circular orbit without assuming a prograde plane',()=>{
    const model=fitMoonOsculatingState({tdb_jd:2451545,position_au:[2,0,0],velocity_au_day:[0,-Math.sqrt(.5),0]},1)!;
    expect(model.eccentricity).toBe(0);
    const state=propagateMoonOsculating(model,2451545+model.period_days/4)!;
    expect(state.position_au[0]).toBeCloseTo(0,8);expect(state.position_au[1]).toBeCloseTo(-2,8);expect(state.position_au[2]).toBe(0);
  });
  it('keeps million-year phase arithmetic finite while rejecting nonfinite or unsafe dates',()=>{
    const model=fitMoonOsculatingState(titan,moonGmAu3Day2(MOON_PARENT_GM_KM3_S2.saturn))!;
    for(const years of [-1000000,1000000]){
      const state=propagateMoonOsculating(model,titan.tdb_jd+years*365.25);
      expect(state).not.toBeNull();expect(state!.position_au.every(Number.isFinite)).toBe(true);expect(state!.velocity_au_day.every(Number.isFinite)).toBe(true);
    }
    for(const date of [NaN,Infinity,-Infinity,Number.MAX_VALUE])expect(propagateMoonOsculating(model,date)).toBeNull();
  });
  it('rejects missing, degenerate or unbound source states instead of fabricating a replacement',()=>{
    for(const mu of [0,-1,NaN,Infinity])expect(fitMoonOsculatingState(titan,mu)).toBeNull();
    expect(fitMoonOsculatingState({...titan,position_au:[0,0,0]},1)).toBeNull();
    expect(fitMoonOsculatingState({...titan,velocity_au_day:[0,0,0]},1)).toBeNull();
    expect(fitMoonOsculatingState({...titan,position_au:[NaN,1,1]},1)).toBeNull();
    expect(fitMoonOsculatingState({tdb_jd:2451545,position_au:[1,0,0],velocity_au_day:[0,2,0]},1)).toBeNull();
  });
});
