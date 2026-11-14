import {describe,expect,it} from 'vitest';
import {historyVisualState,seededRandom} from './historySceneMath';

describe('explicitly conceptual history scene',()=>{
  it('clamps the supported age interval without treating invalid input as a physical epoch',()=>{
    expect(historyVisualState(-1).ageGyr).toBe(0);
    expect(historyVisualState(20).ageGyr).toBe(13.8);
    expect(historyVisualState(NaN).ageGyr).toBe(0);
    for(const age of [0,.00038,.01,.1,.28,.5,1,2.5,9.2,13.8]){
      const visual=historyVisualState(age);
      expect(Object.values(visual).every(Number.isFinite)).toBe(true);
      for(const [key,value] of Object.entries(visual))if(key!=='ageGyr')expect(value).toBeGreaterThanOrEqual(0);
    }
  });
  it('keeps an early plasma scene separate from late stellar and solar illustrations',()=>{
    const initial=historyVisualState(0),cmb=historyVisualState(.00038),late=historyVisualState(13.8);
    expect(initial.plasma).toBe(1);expect(initial.stars).toBe(0);expect(initial.solar).toBe(0);
    expect(cmb.lastScattering).toBe(1);expect(cmb.stars).toBe(0);
    expect(late.plasma).toBe(0);expect(late.lastScattering).toBe(0);expect(late.structure).toBe(1);expect(late.solar).toBe(1);
    expect(historyVisualState(.099).stars).toBe(0);expect(historyVisualState(.1).stars).toBeGreaterThan(0);
    expect(historyVisualState(9.199).solar).toBe(0);expect(historyVisualState(9.2).solar).toBeGreaterThan(0);
  });
  it('makes the decorative field reproducible without consuming or changing source data',()=>{
    const a=seededRandom(123),b=seededRandom(123),other=seededRandom(124);
    const first=Array.from({length:20},a);expect(first).toEqual(Array.from({length:20},b));
    expect(first).not.toEqual(Array.from({length:20},other));expect(first.every(value=>value>=0&&value<1)).toBe(true);
  });
});
