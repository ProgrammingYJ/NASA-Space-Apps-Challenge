'use strict';
// Project only a bounded requested page inside the source-verifying worker.
// All scientific values and the identity crosswalk come from the Python export.
const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').replace(/(?<=[a-z])0+(?=[0-9])/g, '');
function object(catalogue, row) {
  const record = Object.fromEntries(catalogue.columns.map((column, index) => [column, row[index]]));
  const native = record.distance_native_mpc, id = 'gwgc-pgc-' + row[0];
  const distance = native !== null && native > 0 ? native : null;
  return { ...record, object_id: id, name: row[1], aliases: [row[1], 'PGC ' + row[0], ...(catalogue.curated_aliases?.[id] || [])], kind: 'galaxy',
    source_catalogue_id: 'VII/267/gwgc', coordinate_reference: 'FK5 J2000 catalogue reference', distance_mpc: distance,
    distance_status: distance === null ? 'unavailable_direction_only' : 'catalogue_estimate',
    morphology: record.morphology_code === null ? null : 'GWGC numerical T=' + record.morphology_code,
    existing_object_id: catalogue.curated_matches[id] || null, surface_resolved: false, individual_stars_or_planets_inferred: false,
    source: { url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/267', label: 'GWGC / CDS VII/267' } };
}
function atlasSelection(catalogue, selection) {
  const { columns, rows, curated_matches, curated_aliases, ...meta } = catalogue;
  if (selection.id !== undefined) {
    if (typeof selection.id !== 'string' || !/^gwgc-pgc-[1-9][0-9]{0,6}$/.test(selection.id)) throw new Error('invalid_galaxy_atlas_selection');
    const row = rows.find(item => 'gwgc-pgc-' + item[0] === selection.id);
    return row ? { ...object(catalogue, row), source_manifest_sha256: meta.source_manifest_sha256 } : null;
  }
  const query = selection.query ?? '', cursor = selection.cursor ?? null, limit = selection.limit ?? 50;
  if (typeof query !== 'string' || query.length > 200 || !Number.isInteger(limit) || limit < 1 || limit > 200 || cursor !== null && (typeof cursor !== 'string' || !/^(?:0|[1-9][0-9]{0,6})$/.test(cursor))) throw new Error('invalid_galaxy_atlas_selection');
  const needle = normalize(query), offset = Number(cursor || 0);
  const matched = needle ? rows.filter(row => ['gwgc-pgc-' + row[0], row[1], 'PGC ' + row[0], ...(curated_aliases?.['gwgc-pgc-' + row[0]] || [])].some(alias => normalize(alias).includes(needle))) : rows;
  if (offset > matched.length) throw new Error('invalid_galaxy_atlas_selection');
  const end = Math.min(offset + limit, matched.length);
  return { ...meta, query, matched_count: matched.length, objects: matched.slice(offset, end).map(row => object(catalogue, row)), next_cursor: end < matched.length ? String(end) : null };
}
module.exports = { atlasSelection };
