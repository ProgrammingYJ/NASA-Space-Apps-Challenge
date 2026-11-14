import {describe,it,expect} from 'vitest';
import {tnoDescriptionFacts,type TnoInformation} from './TnoDescription';
import {tnoDescriptionCopy} from './TnoDescriptionCopy';
import type {OuterTnoObject} from './OuterTnoPanel';

function object(changes:Partial<OuterTnoObject>={}):OuterTnoObject{return {
  object_id:'sbdb-54538127',spkid:'54538127',pdes:'2015 FO563',name:'(2015 FO563)',known_object_id:null,
  orbit:null,reference_position_au:null,reference_radius_au:null,semimajor_axis_au:49.47006767861001,perihelion_au:44.50596965183876,aphelion_au:54.43416570538125,
  position_au:null,radius_au:null,within_1000_au:null,position_status:'missing_or_unsupported_elements',full_orbit_au:null,source_url:'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=54538127',source_manifest_sha256:'a'.repeat(64),jd_tdb:2461358.5,
  source_fields:{H:'9.08',per:'127090.2352610529'},physical:{diameter_km:null,mass_kg:null,density_g_cm3:null,rotation_period_h:null},
  quality:{condition_code:'9',data_arc_days:7,observations_used:10,propagated_position_uncertainty:null,one_sigma_elements:{sigma_a:'3844.3'}},...changes
};}
describe('source-bound TNO explanation',()=>{
  it('explains a provisional designation and high uncertainty without making a planet or physical mass',()=>{
    const data=object(),facts=tnoDescriptionFacts(data);
    expect(facts.designation).toBe('2015 FO563');expect(facts.designationType).toBe('provisional_designation');expect(facts.highUncertainty).toBe(true);
    expect(facts.absoluteMagnitude).toBe(9.08);expect(facts.periodYears).toBeCloseTo(127090.2352610529/365.25,10);
    expect(data.physical.mass_kg).toBeNull();expect(data.position_au).toBeNull();
  });
  it('keeps source null and valid zero magnitude distinct',()=>{
    expect(tnoDescriptionFacts(object({source_fields:{H:null}})).absoluteMagnitude).toBeNull();
    expect(tnoDescriptionFacts(object({source_fields:{H:'0'}})).absoluteMagnitude).toBe(0);
    const base=object();expect(tnoDescriptionFacts({...base,quality:{...base.quality,condition_code:null,one_sigma_elements:{sigma_a:null}}}).highUncertainty).toBe(false);
  });
  it('uses exact supplementary A/ classification rather than guessing a comet from its designation',()=>{
    const base=object({pdes:'2018 V3'});
    const info={designation:{value:'2018 V3',type:'asteroid_comet_style',jpl_kind:'au',prefix:'A',iau_name:null},uncertainty:{highly_uncertain_condition:false,sigma_a_at_least_nominal_a:false,sigma_a_au:null,propagated_position_covariance:null,verified_long_term_precision:false},orbit_facts:{period_julian_years:100,period_days:36525,elements_epoch_jd_tdb:2450000.5}} as TnoInformation;
    expect(tnoDescriptionFacts({...base,info}).designationType).toBe('asteroid_comet_style');
    expect(tnoDescriptionCopy('en').asteroidCometStyle).toContain('not a confirmed active comet');
    expect(tnoDescriptionFacts({...base,info}).periodYears).toBe(100);
  });
  it('labels numbered objects separately and provides five-language meaning for the marker and RMS',()=>{
    expect(tnoDescriptionFacts(object({pdes:'90377'})).designationType).toBe('permanent_number');
    expect(tnoDescriptionCopy('ko').rms).toContain('무차원');expect(tnoDescriptionCopy('en').rms).toContain('dimensionless');
    expect(tnoDescriptionCopy('ja').rms).toContain('無次元');expect(tnoDescriptionCopy('zh-Hant').rms).toContain('無因次');expect(tnoDescriptionCopy('fr').rms).toContain('sans dimension');
    for(const locale of ['ko','en','ja','zh-Hant','fr'])expect(tnoDescriptionCopy(locale).marker.length).toBeGreaterThan(20);
  });
});
