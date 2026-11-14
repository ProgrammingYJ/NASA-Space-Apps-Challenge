import {describe,expect,it} from 'vitest';
import {galaxyPositionAu,icrsToEclipticUnit,kuiperIllustrationPoints} from './universeLayers';
import {displayPosition} from './sceneMath';

describe('source galaxy coordinates and explanatory Kuiper layer',()=>{
  it('uses a proper J2000 rotation and preserves the supplied distance estimate',()=>{
    expect(icrsToEclipticUnit(0,0)).toEqual([1,0,0]);
    const pole=icrsToEclipticUnit(90,0)!;expect(pole[1]).toBeCloseTo(.9174820621,9);expect(pole[2]).toBeCloseTo(-.3977771559,9);
    const position=galaxyPositionAu({direction_icrs_deg:{ra:10.6847,dec:41.269},distance_mpc:.78})!;
    expect(Math.hypot(...position)).toBeCloseTo(.78e6*648000/Math.PI,2);
    expect(Math.hypot(...displayPosition(position))).toBeGreaterThan(450);
    expect(Math.hypot(...displayPosition(position))).toBeLessThan(600);
  });
  it('keeps unknown distance as direction only instead of inventing a physical location',()=>{
    expect(galaxyPositionAu({direction_icrs_deg:{ra:10,dec:40},distance_mpc:null})).toBeNull();
    expect(galaxyPositionAu({direction_icrs_deg:{ra:10,dec:40},distance_mpc:0})).toBeNull();
    expect(icrsToEclipticUnit(360,0)).toBeNull();expect(icrsToEclipticUnit(20,91)).toBeNull();
  });
  it('keeps seeded explanatory points inside the declared 30–50 AU display annulus',()=>{
    const first=kuiperIllustrationPoints(120),second=kuiperIllustrationPoints(120);expect(first).toEqual(second);
    for(const point of first){const physicalRadius=Math.expm1(Math.hypot(...point)/18);expect(physicalRadius).toBeGreaterThanOrEqual(30);expect(physicalRadius).toBeLessThan(50.01);}
  });
});
