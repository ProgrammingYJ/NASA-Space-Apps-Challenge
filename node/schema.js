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
  if (c.camera) { const { position, target } = c.camera, distance = Math.hypot(...position.map((v, i) => v - target[i])); if (Math.hypot(...position) >= 10000 || distance < .05 || distance >= 10000) throw new Error('invalid_request'); }
  return session;
}
module.exports = { validator, sessionRules, omitNullFields };
