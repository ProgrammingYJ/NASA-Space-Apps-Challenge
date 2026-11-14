import {describe,it,expect} from 'vitest';
import {advancePlaybackClock} from './advancedPhysicsPlayback';
import {createQuantum,advanceQuantum,createMaxwell,advanceMaxwell,createEuler,advanceEuler} from './advancedPhysicsMath';
describe('requestAnimationFrame clock versus effect initialization',()=>{
  it('accepts a first frame at or before effect start without a negative solver call',()=>{
    for(const now of [99.25,100]){const budget=advancePlaybackClock({lastMs:100,debt:0},now,400,100);expect(budget.steps).toBe(0);expect(budget.lastMs).toBe(100);expect(budget.debt).toBe(0);expect(advanceQuantum(createQuantum(),budget.steps).steps).toBe(0);expect(advanceMaxwell(createMaxwell(),budget.steps).steps).toBe(0);expect(advanceEuler(createEuler(),budget.steps).steps).toBe(0);}
  });
  it('accumulates elapsed wall time once across duplicate or out-of-order frames',()=>{
    let clock={lastMs:100,debt:0},steps=0;for(const now of [99.5,100,108,108,107,116,125,150,200,250,300,350,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100]){const next=advancePlaybackClock(clock,now,120,100);expect(next.steps).toBeGreaterThanOrEqual(0);steps+=next.steps;clock=next;}expect(steps).toBe(120);expect(clock.lastMs).toBe(1100);expect(clock.debt).toBeCloseTo(0,10);
  });
  it('caps a delayed frame and a costly solver batch while retaining fractional work',()=>{
    const stalled=advancePlaybackClock({lastMs:0,debt:0},5000,400,3);expect(stalled.steps).toBe(3);expect(stalled.debt).toBe(37);const tiny=advancePlaybackClock({lastMs:0,debt:0},10,20,3);expect(tiny.steps).toBe(0);const later=advancePlaybackClock(tiny,50,20,3);expect(later.steps).toBe(1);expect(later.debt).toBeCloseTo(0,12);
  });
});
