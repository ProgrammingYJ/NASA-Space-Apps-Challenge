import {it,expect} from 'vitest';
import {displayPosition} from './sceneMath';
import {inverseDisplayPosition,observerResidualDistance,radialDopplerLambdaFactor,staticSchwarzschildLambdaFactor,redshiftForComovingDistance,wavelengthForRedshift,modeledWavelength,wavelengthSwatch,AU_PER_MPC} from './observerMath';
it('inverts declared axes and radial compression without inventing physical velocity or missing source depth',()=>{
  for(const vector of [[0,0,0],[1,0,0],[2,-4,6],[AU_PER_MPC,2*AU_PER_MPC,-3*AU_PER_MPC]] as [number,number,number][]){const restored=inverseDisplayPosition(displayPosition(vector))!;for(let i=0;i<3;i++)expect(restored[i]/(vector[i]||1)).toBeCloseTo(vector[i]?1:0,11);}
  expect(inverseDisplayPosition([Infinity,0,0])).toBeNull();expect(inverseDisplayPosition([20000,0,0])).toBeNull();
  const source:[number,number,number]=[AU_PER_MPC,0,0];
  expect(observerResidualDistance(source,[0,0,0])!.residual_mpc).toBeCloseTo(1,12);
  expect(observerResidualDistance(source,displayPosition([AU_PER_MPC*.75,0,0]))!.residual_mpc).toBeCloseTo(.25,11);
  expect(observerResidualDistance(source,displayPosition(source))!.residual_mpc).toBeLessThan(1e-12);
});
it('uses wavelength Doppler sign and static gravitational ratios with strict horizon domains',()=>{
  expect(radialDopplerLambdaFactor(.6)).toBe(2);expect(radialDopplerLambdaFactor(-.6)).toBe(.5);expect(radialDopplerLambdaFactor(0)).toBe(1);
  expect(radialDopplerLambdaFactor(1)).toBeNull();expect(radialDopplerLambdaFactor(-1)).toBeNull();
  expect(staticSchwarzschildLambdaFactor(2,null)).toBeCloseTo(Math.sqrt(2),14);
  expect(staticSchwarzschildLambdaFactor(null,2)).toBeCloseTo(Math.SQRT1_2,14);
  expect(staticSchwarzschildLambdaFactor(6,6)).toBe(1);expect(staticSchwarzschildLambdaFactor(1,20)).toBeNull();expect(staticSchwarzschildLambdaFactor(6,.5)).toBeNull();
});
it('interpolates only a valid monotone distance table and keeps observed negative z distinct from FLRW reference',()=>{
  const rows=[{z:0,comoving_distance_mpc:0},{z:1,comoving_distance_mpc:100},{z:2,comoving_distance_mpc:150}];
  expect(redshiftForComovingDistance(0,rows)).toBe(0);expect(redshiftForComovingDistance(50,rows)).toBe(.5);expect(redshiftForComovingDistance(125,rows)).toBe(1.5);expect(redshiftForComovingDistance(151,rows)).toBeNull();
  expect(redshiftForComovingDistance(1,[rows[0],rows[2],rows[1]])).toBeNull();
  expect(wavelengthForRedshift(500,-.01)).toBe(495);expect(wavelengthForRedshift(500,-1)).toBeNull();
  expect(modeledWavelength(500,1,.6,Math.SQRT1_2)!.wavelength_nm).toBeCloseTo(2000*Math.SQRT1_2);
  expect(wavelengthSwatch(1000).band).toBe('outside_visible');expect(wavelengthSwatch(100).band).toBe('outside_visible');expect(wavelengthSwatch(1e9).band).toBe('outside_visible');expect(wavelengthSwatch(.001).band).toBe('outside_visible');expect(wavelengthSwatch(550).band).toBe('visible');
});
