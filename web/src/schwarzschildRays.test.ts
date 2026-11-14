import {it,expect} from 'vitest';
import {traceSchwarzschildNullRay,traceStaticObserverRay,schwarzschildShadowHalfAngle,CRITICAL_IMPACT_RS,PHOTON_SPHERE_RS} from './schwarzschildRays';
it('separates capture and scattering at the analytic critical impact parameter without tracing through a static horizon',()=>{
  expect(PHOTON_SPHERE_RS).toBe(1.5);expect(CRITICAL_IMPACT_RS).toBeCloseTo(Math.sqrt(27)/2,14);
  const captured=traceSchwarzschildNullRay(CRITICAL_IMPACT_RS*.99),escaped=traceSchwarzschildNullRay(CRITICAL_IMPACT_RS*1.01);
  expect(captured.status).toBe('captured');expect(escaped.status).toBe('escaped');expect(escaped.closest_radius_rs).toBeGreaterThan(1.5);
  expect(captured.max_invariant_error).toBeLessThan(1e-8);expect(escaped.max_invariant_error).toBeLessThan(1e-8);
  expect(escaped.points.every(point=>point.every(Number.isFinite))).toBe(true);
});
it('launches rays from the actual local static observer and recovers the analytic exterior escape-cone boundary',()=>{
  const radius=20,criticalAngle=Math.asin(CRITICAL_IMPACT_RS*Math.sqrt(1-1/radius)/radius);
  const captured=traceStaticObserverRay(radius,criticalAngle*.9),escaped=traceStaticObserverRay(radius,criticalAngle*1.1);
  expect(captured.points[0]).toEqual([radius,0]);expect(escaped.points[0]).toEqual([radius,0]);expect(captured.status).toBe('captured');expect(escaped.status).toBe('escaped');expect(escaped.deflection_rad).toBeNull();
  expect(traceStaticObserverRay(1.2,Math.PI/2).status).toBe('captured');expect(traceStaticObserverRay(1.2,Math.PI).status).toBe('escaped');
  const orbit=traceStaticObserverRay(1.5,Math.PI/2);expect(orbit.status).toBe('truncated');expect(orbit.closest_radius_rs).toBeCloseTo(1.5,10);
  expect(()=>traceStaticObserverRay(1,0)).toThrow();
  expect(schwarzschildShadowHalfAngle(1.5)).toBeCloseTo(Math.PI/2,12);expect(schwarzschildShadowHalfAngle(1.2)!).toBeGreaterThan(Math.PI/2);expect(schwarzschildShadowHalfAngle(1000)!).toBeLessThan(.003);expect(schwarzschildShadowHalfAngle(1)).toBeNull();
});
it('recovers the independent weak-field light deflection 4GM/(bc²)=2Rs/b and mirror symmetry',()=>{
  const weak=traceSchwarzschildNullRay(1000,{plotRadius:2000});expect(weak.status).toBe('escaped');expect(weak.deflection_rad!/(2/1000)).toBeCloseTo(1,2);
  const positive=traceSchwarzschildNullRay(4),negative=traceSchwarzschildNullRay(-4);
  expect(negative.status).toBe(positive.status);expect(negative.points.length).toBe(positive.points.length);
  for(let i=0;i<positive.points.length;i++){expect(negative.points[i][0]).toBe(positive.points[i][0]);expect(negative.points[i][1]).toBe(-positive.points[i][1]);}
});
