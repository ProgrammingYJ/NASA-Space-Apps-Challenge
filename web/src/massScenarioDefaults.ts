export interface DensityScenarioInput {
  target_id: string;
  density_kg_m3: number;
  analogue_id: string | null;
  include_source_ranges: boolean;
}
export interface SavedDensityScenario {input: DensityScenarioInput; source_manifest_sha256: string}
export interface DensityScenarioSource {
  source_manifest_sha256: string;
  model: {density_input_min_kg_m3: number; density_input_max_kg_m3: number};
  analogues: Record<string, {density_kg_m3: number}>;
}

const densityTargets = new Set(['sedna', 'eris', 'makemake', 'quaoar', 'orcus', 'gonggong']);
export const supportsDensityScenario = (objectId: string): boolean => densityTargets.has(objectId);

/** Keep a sourced primary mass ahead of a density hypothesis. A system mass
 * does not qualify as a primary mass; an unloaded record does not qualify as
 * a known missing mass. Generic catalogue bodies have no implicit inputs. */
export const canOpenDensityCalculator = (objectId: string, primaryMassEarth: number | null | undefined): boolean =>
  supportsDensityScenario(objectId) && primaryMassEarth === null;

/** No new assumption is selected by default. An exact, valid saved assumption
 * is restored without replacing it with another moon or a new density. */
export function restoredDensityInput(
  objectId: string,
  source: DensityScenarioSource,
  saved?: SavedDensityScenario | null,
): DensityScenarioInput | null {
  if (!saved || saved.source_manifest_sha256 !== source.source_manifest_sha256 || saved.input.target_id !== objectId) return null;
  const input = saved.input;
  if (!Number.isFinite(input.density_kg_m3)
    || input.density_kg_m3 < source.model.density_input_min_kg_m3
    || input.density_kg_m3 > source.model.density_input_max_kg_m3
    || typeof input.include_source_ranges !== 'boolean') return null;
  const analogueId = input.analogue_id ?? null;
  if (analogueId !== null && source.analogues[analogueId]?.density_kg_m3 !== input.density_kg_m3) return null;
  return {...input, analogue_id: analogueId};
}
