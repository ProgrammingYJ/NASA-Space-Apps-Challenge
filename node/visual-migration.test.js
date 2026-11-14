'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {migrateSolarSession} = require('./schema');

test('updated display maps omit only the active visual reference and preserve the original observation envelope',()=>{
  const old = {object_id:'pluto',observation_ids:['S12','S14'],universe_context:{selected_object_id:'pluto',appearance_manifest_sha256:'1'.repeat(64),source_manifest_sha256:'2'.repeat(64),planet_criteria_manifest_sha256:'3'.repeat(64),scene_filter:'confirmed-planets'}};
  const bytes = JSON.stringify(old);
  const migrated = migrateSolarSession(old,{appearance_manifest_sha256:'4'.repeat(64)});
  assert.equal(JSON.stringify(old),bytes);
  assert.equal(migrated.session.universe_context.appearance_manifest_sha256,undefined);
  assert.equal(migrated.session.universe_context.source_manifest_sha256,old.universe_context.source_manifest_sha256);
  assert.equal(migrated.session.universe_context.planet_criteria_manifest_sha256,old.universe_context.planet_criteria_manifest_sha256);
  assert.equal(migrated.session.universe_context.scene_filter,'confirmed-planets');
  assert.deepEqual(migrated.omitted_contexts,[{feature:'appearance',paths:['universe_context.appearance_manifest_sha256'],reason:'visual_sources_updated_observation_preserved'}]);
});
test('a current map or absent trusted current reference does not silently remove provenance',()=>{
  const session={universe_context:{appearance_manifest_sha256:'1'.repeat(64)}};
  for(const value of [{},{appearance_manifest_sha256:'invalid'},{appearance_manifest_sha256:'1'.repeat(64)}]){
    const result=migrateSolarSession(session,value);
    assert.equal(result.session.universe_context.appearance_manifest_sha256,'1'.repeat(64));assert.equal(result.omitted_contexts.length,0);
  }
});
test('only verified display dependency bindings update active context while preserving saved scientific assumptions',()=>{
  const field='mass_scenarios_manifest_sha256', oldSha='5'.repeat(64),newSha='6'.repeat(64);
  const original={universe_context:{[field]:oldSha,mass_scenario:{target_id:'sedna',density_kg_m3:1200,radius_km:498,model_id:'explicit-user-density'}}};
  const serialized=JSON.stringify(original);
  const current={[field]:newSha};
  assert.equal(migrateSolarSession(original,current).session.universe_context[field],oldSha);
  const result=migrateSolarSession(original,current,[{field,from_sha256:oldSha,to_sha256:newSha}]);
  assert.equal(result.session.universe_context[field],newSha);
  assert.deepEqual(result.session.universe_context.mass_scenario,original.universe_context.mass_scenario);
  assert.equal(JSON.stringify(original),serialized);
  assert.equal(result.omitted_contexts[0].reason,'display_dependency_refreshed_scientific_values_identical');
});
