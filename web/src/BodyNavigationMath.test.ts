import {describe,expect,it} from 'vitest';
import {needsBodyPositionMarker,projectedBodyDiameterPx} from './BodyNavigationMath';

describe('fixed screen-space navigation for unresolved native bodies',()=>{
  it('preserves the geometric diameter scaling without enlarging the supplied radius',()=>{
    const radius=.45;
    // A 90-degree, 1000px view covers twice the forward depth vertically.
    expect(projectedBodyDiameterPx(radius,100,1000,90)).toBeCloseTo(4.5,12);
    expect(projectedBodyDiameterPx(radius,10000,1000,90)).toBeCloseTo(.045,12);
    expect(radius).toBe(.45);
    expect(needsBodyPositionMarker(projectedBodyDiameterPx(radius,10000,1000,90))).toBe(true);
    expect(needsBodyPositionMarker(projectedBodyDiameterPx(radius,100,1000,90))).toBe(false);
  });
  it('uses CSS viewport height and positive camera-forward depth, independent of DPR or source units',()=>{
    expect(projectedBodyDiameterPx(1,10,1000,90)).toBeCloseTo(100,12);
    expect(projectedBodyDiameterPx(1,10,500,90)).toBeCloseTo(50,12);
    for(const depth of [0,-1,NaN,Infinity])expect(projectedBodyDiameterPx(1,depth,1000,48)).toBeNull();
    expect(projectedBodyDiameterPx(0,10,1000,48)).toBeNull();
  });
  it('hides near resolved surfaces and changes no state for invalid projections',()=>{
    expect(needsBodyPositionMarker(2.9)).toBe(true);
    expect(needsBodyPositionMarker(3)).toBe(false);
    expect(needsBodyPositionMarker(3.5,true)).toBe(true);
    expect(needsBodyPositionMarker(4,true)).toBe(false);
    for(const invalid of [null,NaN,Infinity,-1])expect(needsBodyPositionMarker(invalid,true)).toBe(false);
  });
});
