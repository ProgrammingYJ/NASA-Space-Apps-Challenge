'use strict';

// Equal-solid-angle RING cells as used by the author's overview_map.pro.
// This ranks a declared conditional synthetic sample, never existence probability.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { normalizeOrbit, constants, failure, finite, record } = require('./planet-nine');
const NSIDE = 32, NPIX = 12 * NSIDE ** 2, AREA = 4 * Math.PI / NPIX;
const VERSION = 'p9-reference-healpix-ring-v1';
const FIELDS = ['index', 'mass', 'a', 'e', 'inc', 'varpi', 'Omega', 'M', 'ra', 'dec', 'R', 'rad', 'albedo', 'V', 'ZTF', 'DES', 'PS1'];
const SUBSETS = Object.freeze({ all: [], ztf: ['ZTF'], ztf_des: ['ZTF', 'DES'], ztf_des_ps1: ['ZTF', 'DES', 'PS1'] });
function nsideCheck(nside) { if (!Number.isSafeInteger(nside) || nside < 1 || nside > 1024 || (nside & (nside - 1)) !== 0) throw failure('invalid_healpix_nside'); }
function wrap(value) { return ((value % 360) + 360) % 360; }
function ang2pixRing(nside, ra, dec) {
  nsideCheck(nside);
  if (!finite(ra, -1e9, 1e9) || !finite(dec, -90, 90)) throw failure('invalid_healpix_coordinate');
  const z = Math.cos((90 - dec) * Math.PI / 180), za = Math.abs(z), tt = wrap(ra) / 90, npix = 12 * nside ** 2, cap = 2 * nside * (nside - 1);
  if (za <= 2 / 3) {
    const jp = Math.floor(nside * (.5 + tt - .75 * z)), jm = Math.floor(nside * (.5 + tt + .75 * z));
    const ring = nside + 1 + jp - jm, shift = 1 - (ring & 1);
    let azimuth = Math.floor((jp + jm - nside + shift + 1) / 2);
    azimuth = ((azimuth % (4 * nside)) + 4 * nside) % (4 * nside);
    return cap + (ring - 1) * 4 * nside + azimuth;
  }
  const fraction = tt - Math.floor(tt), scale = nside * Math.sqrt(3 * (1 - za));
  const jp = Math.floor(fraction * scale), jm = Math.floor((1 - fraction) * scale), ring = jp + jm + 1;
  const azimuth = Math.floor(tt * ring) % (4 * ring);
  return z > 0 ? 2 * ring * (ring - 1) + azimuth : npix - 2 * ring * (ring + 1) + azimuth;
}
function pix2angRing(nside, pixel) {
  nsideCheck(nside); const npix = 12 * nside ** 2, cap = 2 * nside * (nside - 1);
  if (!Number.isSafeInteger(pixel) || pixel < 0 || pixel >= npix) throw failure('invalid_healpix_pixel');
  let z, phi;
  if (pixel < cap) {
    const ip = pixel + 1, ring = Math.floor((1 + Math.sqrt(2 * ip - 1)) / 2), azimuth = ip - 2 * ring * (ring - 1);
    z = 1 - ring ** 2 / (3 * nside ** 2); phi = (azimuth - .5) * Math.PI / (2 * ring);
  } else if (pixel < npix - cap) {
    const ip = pixel - cap, ring = Math.floor(ip / (4 * nside)) + nside, azimuth = ip % (4 * nside) + 1;
    const shift = .5 * (1 + ((ring + nside) & 1)); z = (2 * nside - ring) * 2 / (3 * nside); phi = (azimuth - shift) * Math.PI / (2 * nside);
  } else {
    const ip = npix - pixel, ring = Math.floor((1 + Math.sqrt(2 * ip - 1)) / 2), azimuth = 4 * ring + 1 - (ip - 2 * ring * (ring - 1));
    z = -1 + ring ** 2 / (3 * nside ** 2); phi = (azimuth - .5) * Math.PI / (2 * ring);
  }
  return { ra_deg: wrap(phi * 180 / Math.PI), dec_deg: Math.asin(z) * 180 / Math.PI };
}
function settings(input = {}, extras = []) {
  record(input, ['subset', 'max_reference_distance_au', ...extras]);
  const subset = input.subset === undefined ? 'ztf_des_ps1' : input.subset;
  const distance = input.max_reference_distance_au === undefined ? 1000 : input.max_reference_distance_au;
  if (!Object.hasOwn(SUBSETS, subset) || !(distance === null || finite(distance, 1, 100000))) throw failure('invalid_region_selection');
  return { subset, max_reference_distance_au: distance };
}
function page(input, size) {
  const offset = input.offset === undefined ? 0 : input.offset, limit = input.limit === undefined ? 20 : input.limit;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw failure('invalid_region_page');
  return { offset, limit, next_offset: offset + limit < size ? offset + limit : null };
}
function createRegionCatalog(root) {
  const base = fs.realpathSync(root), target = fs.realpathSync(path.join(base, constants.POPULATION_PATH));
  if (!target.startsWith(base + path.sep)) throw failure('hypothesis_source_unavailable');
  const bytes = fs.readFileSync(target), digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== constants.POPULATION_BYTES || digest !== constants.POPULATION_SHA) throw failure('hypothesis_source_integrity');
  const lines = bytes.toString('utf8').split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#'));
  if (JSON.stringify(lines.shift().split(',').map(s => s.trim())) !== JSON.stringify(FIELDS)) throw failure('hypothesis_source_schema');
  const rows = lines.map((line, index) => {
    const values = line.split(',').map(s => Number(s.trim()));
    if (values.length !== 17 || values.some(n => !Number.isFinite(n)) || values[0] !== index || ![14, 15, 16].every(i => values[i] === 0 || values[i] === 1)) throw failure('hypothesis_source_schema');
    return { values, cell: ang2pixRing(NSIDE, values[8], values[9]) };
  });
  if (rows.length !== 100000) throw failure('hypothesis_source_schema');
  const indices = Buffer.alloc(rows.length * 4); rows.forEach((row, i) => indices.writeUInt32LE(row.cell, i * 4));
  const source = { url: 'https://data.caltech.edu/records/8fjad-x7y61', doi: '10.22002/8fjad-x7y61', version: '3 (2023)',
    model: 'Brown_and_Batygin_2021a_conditional_distribution', path: constants.POPULATION_PATH, sha256: digest, bytes: bytes.length,
    reference_epoch_jd_raw: 2458270, reference_epoch_comment: '1 June 2018', numeric_jd_calendar: '2018-05-31T12:00:00',
    source_time_scale: 'not_independently_verified', source_sky_observer: 'not_independently_verified',
    author_recipe_path: 'data/reference/legacy_public_originals/planet_nine_reference/overview_map.pro',
    coordinate_layer: 'raw_author_reference_ra_dec_not_propagated_to_user_date',
    cell_mapping_uint32le_sha256: crypto.createHash('sha256').update(indices).digest('hex') };
  const cached = new Map();
  function selected(selection) {
    const key = JSON.stringify(selection); if (cached.has(key)) return cached.get(key);
    const flagColumns = SUBSETS[selection.subset].map(name => FIELDS.indexOf(name)), counts = new Uint32Array(NPIX), members = new Map();
    let surveyCount = 0, selectedCount = 0;
    for (const row of rows) if (flagColumns.every(index => row.values[index] === 0)) {
      surveyCount++;
      if (selection.max_reference_distance_au !== null && row.values[10] > selection.max_reference_distance_au) continue;
      selectedCount++; counts[row.cell]++;
      if (!members.has(row.cell)) members.set(row.cell, []); members.get(row.cell).push(row.values[0]);
    }
    const ranking = Array.from(counts.entries()).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([cell, count], index) => {
      const center = pix2angRing(NSIDE, cell);
      return { cell_id: cell, rank: index + 1, count, conditional_probability: count / selectedCount, density_sr_inv: count / (selectedCount * AREA), center_ra_deg: center.ra_deg, center_dec_deg: center.dec_deg };
    });
    const result = { schema_version: '1.0', algorithm_version: VERSION, source, nside: NSIDE, ordering: 'RING', total_cells: NPIX,
      cell_area_sr: AREA, cell_area_deg2: AREA * (180 / Math.PI) ** 2, total_nonempty_cells: ranking.length,
      selection: { ...selection, original_count: rows.length, survey_remaining_count: surveyCount, selected_count: selectedCount,
        normalization_count: selectedCount, survey_remaining_fraction_of_original: surveyCount / rows.length,
        remaining_fraction_of_original: selectedCount / rows.length, distance_remaining_fraction_of_survey: surveyCount ? selectedCount / surveyCount : null,
        survey_flag_definition: flagColumns.length ? flagColumns.map(i => FIELDS[i] + ' == 0').join(' AND ') : 'all synthetic rows',
        distance_definition: 'source_column_R_heliocentric_distance_at_raw_reference_epoch_not_semimajor_axis_or_current_distance' },
      rank_basis: 'conditional_sample_density_descending_then_cell_id_ascending', candidate_role: 'search_region_not_detected_object',
      existence_probability: null, individual_candidate_authenticity_probability: null,
      limitations: [
        'n/N and n/(N*solid_angle) are conditional on the published Planet Nine model, its sampled population, the named synthetic survey flags, and the selected distance filter.',
        'The 100000 synthetic rows are not observed planets, and the integer survey detectability flags are not calibrated likelihoods for a new SPHEREx detection.',
        'Raw author RA/Dec and distance are shown at the declared source epoch. Their source time scale and sky observer are unverified; no probability distribution at a new user date is claimed.',
        'Filtering to 1000 AU changes the denominator. The retained fraction of the original population is reported separately from each normalized sky-cell probability.',
        'Selection biases and competing dynamical explanations are not removed by counting these model samples. Rank is not the probability that a planet exists or will be detected.',
        'Each synthetic row has equal sampling weight; selecting one row does not assign it an independently estimated existence probability or refit the literature population.'
      ] };
    const value = { result, ranking, members }; if (cached.size >= 16) cached.delete(cached.keys().next().value); cached.set(key, value); return value;
  }
  function summary(input) { return selected(settings(input)).result; }
  function regions(input = {}) { const value = selected(settings(input, ['offset', 'limit'])), paging = page(input, value.ranking.length); return { ...value.result, ...paging, rows: value.ranking.slice(paging.offset, paging.offset + paging.limit) }; }
  function members(cell, input = {}) {
    if (!Number.isSafeInteger(cell) || cell < 0 || cell >= NPIX) throw failure('invalid_healpix_pixel');
    const value = selected(settings(input, ['offset', 'limit'])), ids = value.members.get(cell) ?? [], paging = page(input, ids.length);
    return { ...value.result, cell_id: cell, member_count: ids.length, ...paging, rows: ids.slice(paging.offset, paging.offset + paging.limit) };
  }
  function row(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= rows.length) throw failure('invalid_population_row');
    const values = rows[index].values, sourceColumns = Object.fromEntries(FIELDS.map((key, i) => [key, values[i]]));
    const orbit = normalizeOrbit({ a_au: values[2], e: values[3], i_deg: values[4], omega_deg: values[5] - values[6], Omega_deg: values[6], M_deg: values[7], epoch_jd_tdb: 2458270, mass_earth: values[1] });
    return { id: 'caltech-row-' + index, row_index: index, kind: 'synthetic_literature_sample', orbit, source_columns: sourceColumns,
      source_sha256: digest, source, cell_id: rows[index].cell, reference_ra_deg: values[8], reference_dec_deg: values[9], reference_heliocentric_distance_au: values[10],
      author_sky_coordinate_reproduction_verified: false, individual_existence_probability: null };
  }
  return { summary, regions, members, row };
}
module.exports = { createRegionCatalog, ang2pixRing, pix2angRing, constants: Object.freeze({ NSIDE, NPIX, AREA, VERSION }) };
