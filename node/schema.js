'use strict';
const { strict } = require('./storage');
function validator(document) {
  function check(schema, value) {
    if (schema.$ref) return check(schema.$ref.split('/').slice(1).reduce((v, k) => v[k], document), value);
    if (schema.anyOf || schema.oneOf) {
      for (const alternative of schema.anyOf || schema.oneOf) { try { return check(alternative, value); } catch {} }
      throw new Error('invalid_request');
    }
    if ('const' in schema && value !== schema.const || schema.enum && !schema.enum.includes(value)) throw new Error('invalid_request');
    if (schema.type === 'null') { if (value !== null) throw new Error('invalid_request'); return null; }
    if (schema.type === 'object' || schema.properties) {
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('invalid_request');
      const result = {}, props = schema.properties || {};
      for (const key of schema.required || []) if (!(key in value)) throw new Error('invalid_request');
      for (const [key, item] of Object.entries(value)) {
        if (!(key in props)) { if (schema.additionalProperties === false) throw new Error('invalid_request'); result[key] = item; }
        else result[key] = check(props[key], item);
      }
      for (const [key, spec] of Object.entries(props)) if (!(key in value) && 'default' in spec) result[key] = structuredClone(spec.default);
      return result;
    }
    if (schema.type === 'array') {
      if (!Array.isArray(value) || schema.minItems != null && value.length < schema.minItems || schema.maxItems != null && value.length > schema.maxItems) throw new Error('invalid_request');
      return value.map((v, i) => check(schema.prefixItems?.[i] || schema.items || {}, v));
    }
    if (schema.type === 'string') {
      if (typeof value !== 'string' || schema.minLength != null && [...value].length < schema.minLength || schema.maxLength != null && [...value].length > schema.maxLength || schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error('invalid_request');
    } else if (schema.type === 'number' || schema.type === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value) || schema.type === 'integer' && !Number.isInteger(value) || schema.minimum != null && value < schema.minimum || schema.maximum != null && value > schema.maximum || schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum || schema.exclusiveMaximum != null && value >= schema.exclusiveMaximum) throw new Error('invalid_request');
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error('invalid_request');
    return strict(value);
  }
  return (name, value) => check(document.components.schemas[name], value);
}
function omitNullFields(value) {
  if (Array.isArray(value)) return value.map(omitNullFields);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null).map(([k, v]) => [k, omitNullFields(v)]));
  return value;
}
function sessionRules(session) {
  const ids = session.observation_ids, expected = session.object_id === 'epsilon-indi-b' ? ['S01', 'S02'] : ['S12', 'S14'];
  if (ids.length !== 2 || ids[0] === ids[1] || !ids.every(id => expected.includes(id))) throw new Error('invalid_request');
  const c = session.universe_context;
  if (!c) return session;
  if (c.selected_object_id !== session.object_id || c.follow_object_id != null && c.follow_object_id !== session.object_id) throw new Error('invalid_request');
  for (const [field, sha] of [['mass_scenario', 'mass_scenarios_manifest_sha256'], ['observer_experiment', 'observer_physics_manifest_sha256'], ['selected_black_hole_id', 'black_holes_manifest_sha256']]) if (c[field] != null && c[sha] == null) throw new Error('invalid_request');
  if (c.time_preference === 'ephemeris' && c.simulation_context != null || c.time_preference === 'simulation' && c.simulation_context == null) throw new Error('invalid_request');
  const localDistance = c.distance_view?.algorithm_version === 'parent-linear-distance-v1';
  if (c.distance_view) {
    const origin = c.distance_view.origin_object_id;
    if (localDistance ? typeof origin !== 'string' || !origin.trim() || origin.length > 50 : origin != null) throw new Error('invalid_request');
  }
  if (c.camera) { const { position, target } = c.camera, distance = Math.hypot(...position.map((v, i) => v - target[i])), limit = localDistance ? 1e8 : 10000; if (![...position,...target].every(Number.isFinite) || Math.hypot(...position) >= limit || distance < .05 || distance >= limit) throw new Error('invalid_request'); }
  return session;
}
function migrateSolarSession(session, currentVisualHashes = {}, compatibleReferences = []) {
  const migrated = structuredClone(session), context = migrated.universe_context;
  const omitted_contexts = [];
  if (!context) return { session: migrated, omitted_contexts };
  const groups = {
    galaxies: ['galaxy_manifest_sha256', 'show_galaxies'],
    observer_physics: ['observer_physics_manifest_sha256', 'observer_experiment', 'observer_panel_open'],
    black_holes: ['black_holes_manifest_sha256', 'selected_black_hole_id'],
  };
  for (const [feature, keys] of Object.entries(groups)) {
    const paths = keys.filter(key => context[key] !== undefined && context[key] !== null && context[key] !== false).map(key => 'universe_context.' + key);
    keys.forEach(key => { delete context[key]; });
    if (paths.length) omitted_contexts.push({ feature, paths, reason: 'feature_removed_from_1000au_scope' });
  }
  const visualHash = currentVisualHashes.appearance_manifest_sha256;
  if (typeof visualHash === 'string' && /^[a-f0-9]{64}$/.test(visualHash) && context.appearance_manifest_sha256 && context.appearance_manifest_sha256 !== visualHash) {
    delete context.appearance_manifest_sha256;
    omitted_contexts.push({feature:'appearance',paths:['universe_context.appearance_manifest_sha256'],reason:'visual_sources_updated_observation_preserved'});
  }
  for (const item of compatibleReferences) {
    if (!['small_body_appearance_manifest_sha256','mass_scenarios_manifest_sha256'].includes(item.field)
        || !/^[a-f0-9]{64}$/.test(item.from_sha256) || !/^[a-f0-9]{64}$/.test(item.to_sha256)
        || currentVisualHashes[item.field] !== item.to_sha256 || context[item.field] !== item.from_sha256) continue;
    context[item.field] = item.to_sha256;
    omitted_contexts.push({feature:item.field.replace('_manifest_sha256',''),paths:['universe_context.'+item.field],reason:'display_dependency_refreshed_scientific_values_identical'});
  }
  return { session: migrated, omitted_contexts };
}
module.exports = { validator, sessionRules, omitNullFields, migrateSolarSession };
