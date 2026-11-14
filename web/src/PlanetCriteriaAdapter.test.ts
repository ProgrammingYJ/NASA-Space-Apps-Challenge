import {describe,expect,it} from 'vitest';
import {genericTnoCriteria,resolvePlanetCriteriaObject,type PlanetCriteriaCatalogue,type PlanetCriterionObject} from './PlanetCriteriaAdapter';
import type {OuterTnoObject} from './OuterTnoPanel';
import {r029Copy} from './R029Copy';

const source={url:'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=54538127'};
const model:PlanetCriteriaCatalogue['model']={id:'margot-solar-10gyr-v1',coefficient_earth_mass:.001239,semimajor_exponent:9/8,host_mass_solar:1,clearing_time_gyr:10,hill_zone_factor:2*Math.sqrt(3),formula:'m_clear/M_earth = 0.001239 (a/au)^(9/8)',source:{url:'https://arxiv.org/html/2407.07590v1'},limitations:[]};
function row(overrides:Partial<OuterTnoObject>={}):OuterTnoObject{
  return {object_id:'sbdb-54538127',name:'(2015 FO563)',known_object_id:null,source_url:source.url,source_manifest_sha256:'a'.repeat(64),position_au:[40,0,0],radius_au:40,within_1000_au:true,position_status:'osculating_two_body_prediction',full_orbit_au:null,jd_tdb:2461358.5,reference_position_au:[40,0,0],reference_radius_au:40,semimajor_axis_au:16,perihelion_au:12,aphelion_au:20,orbit:{a_au:16,e:.25,i_deg:1,omega_deg:2,Omega_deg:3,M_deg:4,epoch_jd_tdb:2457102.5},physical:{diameter_km:null,mass_kg:null,density_g_cm3:null,rotation_period_h:null},quality:{condition_code:'9',data_arc_days:7,observations_used:10,propagated_position_uncertainty:null},source_fields:{class:'TNO',a:'16',e:'.25',epoch:'2457102.5',q:'12',ad:'20',ma:'4'},...overrides};
}
const catalogue=(objects:Record<string,PlanetCriterionObject>={}):PlanetCriteriaCatalogue=>({schema_version:'1.0',algorithm_version:'iau-margot-criteria-v1',source_manifest_sha256:'b'.repeat(64),model,objects});

describe('source-backed generic TNO criteria',()=>{
  it('uses source semimajor axis rather than current distance and keeps mass and two unverified criteria unknown',()=>{
    const object=genericTnoCriteria(row({physical:{diameter_km:1000,mass_kg:null,density_g_cm3:null,rotation_period_h:null}}),model);
    // a=16 gives a^(9/8)=16 sqrt(2), independently of the displayed r=40.
    expect(object.clearing.minimum_mass_earth).toBeCloseTo(.001239*16*Math.SQRT2,14);
    expect(object.mass.earth_masses).toBeNull();expect(object.clearing.pi).toBeNull();
    expect(object.official_classification).toBe('small_body');
    expect(object.criteria.map(c=>c.status)).toEqual(['met','unknown','unknown']);
    expect(object.criteria[0].source.url).toBe(source.url);
  });
  it('missing mean anomaly prevents a position but does not negate the catalogued solar orbit or erase zero eccentricity',()=>{
    const data=row({orbit:null,semimajor_axis_au:46,perihelion_au:46,aphelion_au:46,position_au:null,radius_au:null,within_1000_au:null,source_fields:{class:'TNO',a:'46',e:'0',epoch:'2457102.5',ma:null}});
    const object=genericTnoCriteria(data,model);
    expect(object.criteria[0].status).toBe('met');expect(object.orbit.eccentricity).toBe(0);
    expect(object.orbit.epoch_tdb_jd).toBe(2457102.5);expect(object.clearing.minimum_mass_earth).toBeGreaterThan(0);
  });
  it('keeps absent or invalid source elements null instead of zero or a copied orbit',()=>{
    const object=genericTnoCriteria(row({orbit:null,semimajor_axis_au:null,perihelion_au:null,aphelion_au:null,source_fields:{a:'',e:'-1',epoch:null}}),model);
    expect(object.orbit.semimajor_axis_au).toBeNull();expect(object.orbit.eccentricity).toBeNull();expect(object.orbit.epoch_tdb_jd).toBeNull();
    expect(object.clearing.minimum_mass_earth).toBeNull();expect(object.criteria[0].status).toBe('unknown');
  });
  it('preserves an authored native classification and primary/system mass distinction even through an SBDB alias',()=>{
    const authored:PlanetCriterionObject={...genericTnoCriteria(row(),model),object_id:'sedna',name:'Sedna',official_classification:'dwarf_candidate',is_generic_tno:false,system_mass:{earth_masses:.0001,definition:'combined_primary_satellite_system',source}};
    const data=row({known_object_id:'sedna'}),native=catalogue({sedna:authored});
    expect(resolvePlanetCriteriaObject(native,'sedna',data)).toBe(authored);
    expect(resolvePlanetCriteriaObject(native,data.object_id,data)).toBe(authored);
    expect(authored.mass.earth_masses).toBeNull();expect(authored.clearing.pi).toBeNull();
  });
  it('does not reuse a late object response for a different selection',()=>{
    expect(resolvePlanetCriteriaObject(catalogue(),'sbdb-111',row())).toBeUndefined();
  });
  it('provides all scoped explanations in every supported language',()=>{
    const keys=Object.keys(r029Copy('en')).sort();
    for(const locale of ['ko','en','ja','zh-Hant','fr']){
      const copy=r029Copy(locale);expect(Object.keys(copy).sort()).toEqual(keys);
      for(const value of Object.values(copy))expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
