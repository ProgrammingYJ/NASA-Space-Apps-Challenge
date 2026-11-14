import {describe,expect,it} from 'vitest';
import {kuiperIllustrationPoints} from './universeLayers';

describe('explanatory Kuiper layer',()=>{
  it('keeps seeded explanatory points inside the declared 30–50 AU display annulus',()=>{
    const first=kuiperIllustrationPoints(120),second=kuiperIllustrationPoints(120);expect(first).toEqual(second);
    for(const point of first){const physicalRadius=Math.expm1(Math.hypot(...point)/18);expect(physicalRadius).toBeGreaterThanOrEqual(30);expect(physicalRadius).toBeLessThan(50.01);}
  });
});
