import {describe,it,expect} from 'vitest';
import {SOLAR_SCOPE_FEATURES,isSolarScopeSelection,scopeCopy} from './solarScope';
describe('public Solar System scope',()=>{
  it('does not allow removed object IDs through restored selection',()=>{
    const valid=['sun','earth','pluto','epsilon-indi-b','sedna'];
    expect(isSolarScopeSelection('galaxy-m31',valid)).toBe(false);
    expect(isSolarScopeSelection('sun',valid)).toBe(true);
    expect(isSolarScopeSelection('__proto__',valid)).toBe(false);
    expect(Object.values(SOLAR_SCOPE_FEATURES).every(value=>value===false)).toBe(true);
  });
  it('keeps scientific limits visible in each supported locale',()=>{
    for(const language of ['ko','en','ja','zh-Hant','fr']){
      const copy=scopeCopy(language);
      expect(copy.note).toContain('1000');
      expect(copy.validationNote.length).toBeGreaterThan(25);
    }
    expect(scopeCopy('zh-Hant').actual).toBe('實際觀測');
  });
});
