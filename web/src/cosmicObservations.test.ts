import {describe,expect,it} from 'vitest';
import {publishedObservationAge} from './cosmicObservations';
describe('published observation ages',()=>{
  it('keeps the CEERS sample range rather than inventing a single observation age',()=>{
    expect(publishedObservationAge({approx_age_gyr:null,sample_age_range_gyr:[.6,6]})).toEqual({kind:'range',min:.6,max:6});
    expect(publishedObservationAge({approx_age_gyr:3.3,sample_age_range_gyr:[.6,6]})).toEqual({kind:'range',min:.6,max:6});
  });
  it('preserves an approximate source age and leaves missing or malformed values unavailable',()=>{
    expect(publishedObservationAge({approx_age_gyr:.46,sample_age_range_gyr:null})).toEqual({kind:'approximate',age:.46});
    expect(publishedObservationAge({approx_age_gyr:null,sample_age_range_gyr:null})).toEqual({kind:'unavailable'});
    expect(publishedObservationAge({approx_age_gyr:NaN,sample_age_range_gyr:null})).toEqual({kind:'unavailable'});
    expect(publishedObservationAge({approx_age_gyr:.6,sample_age_range_gyr:[6,.6]})).toEqual({kind:'unavailable'});
  });
});
