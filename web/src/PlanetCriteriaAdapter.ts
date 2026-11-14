import type {OuterTnoObject} from './OuterTnoPanel';

export interface CriteriaSource {url: string; label?: string}
export type CriterionStatus = 'met' | 'not_met' | 'unknown' | 'not_applicable';
export interface PlanetCriterion {
  id: 'orbits_sun' | 'equilibrium_shape' | 'orbital_dominance';
  status: CriterionStatus;
  basis: string;
  reason_key: string;
  source: CriteriaSource;
}
export interface PlanetCriterionObject {
  object_id: string;
  name: string;
  official_classification: 'planet' | 'dwarf_planet' | 'dwarf_candidate' | 'small_body';
  is_generic_tno?: boolean;
  criteria: PlanetCriterion[];
  orbit: {
    semimajor_axis_au: number | null;
    eccentricity: number | null;
    perihelion_au: number | null;
    aphelion_au: number | null;
    epoch_tdb_jd: number | null;
    source: CriteriaSource;
  };
  mass: {earth_masses: number | null; status: string; source: CriteriaSource | null};
  system_mass?: {earth_masses: number; uncertainty_earth?: number | null; definition: string; source: CriteriaSource};
  clearing: {
    minimum_mass_earth: number | null;
    pi: number | null;
    status: string;
    model_classification: 'meets_model' | 'below_model' | 'unknown';
  };
  limitations: string[];
}
export interface PlanetCriteriaCatalogue {
  schema_version: string;
  algorithm_version: string;
  source_manifest_sha256: string;
  model: {
    id: string;
    coefficient_earth_mass: number;
    semimajor_exponent: number;
    host_mass_solar: number;
    clearing_time_gyr: number;
    hill_zone_factor: number;
    formula: string;
    source: CriteriaSource;
    limitations: string[];
  };
  objects: Record<string, PlanetCriterionObject>;
}

const IAU: CriteriaSource = {
  url: 'https://www.iau.org/IAU/Iau/News/PR2006/iau-2006-general-assembly-resolution-votes.aspx',
  label: 'IAU 2006',
};
function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || (typeof value !== 'number' && typeof value !== 'string')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function outerObjectMatches(id: string, outer?: OuterTnoObject): boolean {
  return Boolean(outer && (outer.object_id === id || outer.known_object_id === id));
}

/** Keep the authored classification and mass definitions of the original17
 * objects. A generic catalogue row must not replace their independently sourced
 * official status or primary-versus-system mass distinction. */
export function resolvePlanetCriteriaObject(
  catalogue: PlanetCriteriaCatalogue | undefined,
  objectId: string,
  outer?: OuterTnoObject,
): PlanetCriterionObject | undefined {
  if (!catalogue) return undefined;
  const original = catalogue.objects[objectId];
  if (original) return original;
  if (!outerObjectMatches(objectId, outer) || !outer) return undefined;
  if (outer.known_object_id && catalogue.objects[outer.known_object_id]) return catalogue.objects[outer.known_object_id];
  return genericTnoCriteria(outer, catalogue.model);
}

/** Source facts plus an explicitly separate circular clearing reference.
 * No physical size, density, mass, shape or official classification is inferred
 * from a point marker, orbital phase or the mere presence of a catalogue row. */
export function genericTnoCriteria(
  outer: OuterTnoObject,
  model: PlanetCriteriaCatalogue['model'],
): PlanetCriterionObject {
  const source: CriteriaSource = {url: outer.source_url, label: 'NASA/JPL SBDB'};
  const fields = outer.source_fields ?? {};
  const a = finite(outer.orbit?.a_au ?? outer.semimajor_axis_au ?? fields.a);
  const rawE = finite(outer.orbit?.e ?? fields.e);
  const e = rawE !== null && rawE >= 0 && rawE < 1 ? rawE : null;
  const semimajor = a !== null && a > 0 ? a : null;
  const epoch = finite(outer.orbit?.epoch_jd_tdb ?? fields.epoch);
  const q = finite(outer.perihelion_au ?? fields.q);
  const Q = finite(outer.aphelion_au ?? fields.ad);
  const row = outer as OuterTnoObject & {catalog_class?: string};
  const solarOrbit = row.catalog_class === 'TNO' || fields.class === 'TNO';
  const candidate = semimajor !== null && Number.isFinite(model.coefficient_earth_mass)
    && model.coefficient_earth_mass > 0 && Number.isFinite(model.semimajor_exponent)
    ? model.coefficient_earth_mass * semimajor ** model.semimajor_exponent : null;
  const minimum = candidate !== null && Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  return {
    object_id: outer.object_id,
    name: outer.name,
    official_classification: 'small_body',
    is_generic_tno: true,
    criteria: [
      {id: 'orbits_sun', status: solarOrbit ? 'met' : 'unknown', basis: 'catalogued_heliocentric_class', reason_key: solarOrbit ? 'r029_solar_orbit' : 'r029_solar_unknown', source},
      {id: 'equilibrium_shape', status: 'unknown', basis: 'shape_not_established_in_adopted_data', reason_key: 'r029_shape_unknown', source: IAU},
      {id: 'orbital_dominance', status: 'unknown', basis: 'mass_and_dynamical_verification_unavailable', reason_key: 'r029_dominance_unknown', source: IAU},
    ],
    orbit: {
      semimajor_axis_au: semimajor,
      eccentricity: e,
      perihelion_au: q,
      aphelion_au: Q,
      epoch_tdb_jd: epoch,
      source,
    },
    // The adopted8341-row SBDB snapshot has no primary-body masses. Its missing
    // values stay missing; a diameter alone cannot supply a measured mass.
    mass: {earth_masses: null, status: 'not_available_in_adopted_snapshot', source: null},
    clearing: {minimum_mass_earth: minimum, pi: null, status: 'reference_only_mass_unavailable', model_classification: 'unknown'},
    limitations: [],
  };
}
