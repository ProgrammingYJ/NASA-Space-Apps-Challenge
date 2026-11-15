"""Registered native SPHEREx display only; no downloads, fitting or measured motion.

Registered DEV-025 reader. Existing epsilon/Pluto canonical builders are not
modified or invoked here, and their four ordered pairs are never rebuilt here.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import warnings
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import astropy
import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from erfa import ErfaWarning

from science.spherex import (
    MASK_POLICY_ID,
    _alternate_wcs,
    _bilinear,
    _finite,
    _json_array,
    _provenance,
    _records,
    flag_definitions,
    quality_summary,
    verify_source,
)

ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'data/manifests/datasets.json').is_file())
REGISTRY = ROOT / 'data/manifests/observation_registry.json'
ALGORITHM_VERSION = GENERIC_ALGORITHM = 'spherex-registered-native-v1'
LEGACY_PAIRS = {('S01', 'S02'), ('S02', 'S01'), ('S12', 'S14'), ('S14', 'S12')}
LIMITATIONS = [
    'Native images are not registered; blink is visual inspection only.',
    'A registered sky-direction prediction or reference is not a measured image centroid or verified source association.',
    'No PSF fit, flux, response correction, registered difference or measured motion is calculated.',
    'Equal detector numbers or overlapping nominal wavelength intervals do not validate photometric comparability.',
    'IMAGE is L2 surface brightness in MJy/sr; ZODI is preserved and is not subtracted.',
    'SOURCE and FULLSAMPLE are informational in the display policy; flags overlap and undeclared bits remain reviewable.',
]


def _finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _identifier(value):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,79}', value) is not None


def _detector(value):
    match = re.fullmatch(r'(?:SPHEREx-)?D?([1-6])', str(value).strip(), re.IGNORECASE)
    if not match:
        raise ValueError('invalid_detector')
    return 'D' + match.group(1)


def _load(root=None, registry_path=REGISTRY):
    root = Path(root or ROOT).resolve()
    selected = root / 'data/manifests/observation_registry.json' if Path(registry_path) == REGISTRY else Path(registry_path)
    path = selected.resolve() if selected.is_absolute() else (root / selected).resolve()
    if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size > 16_000_000:
        raise ValueError('registry_missing_or_unsafe')
    raw = path.read_bytes()
    value = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite_registry')))
    if value.get('schema_version') != '1.0' or value.get('algorithm_version') != ALGORITHM_VERSION:
        raise ValueError('unsupported_observation_registry')
    objects, exposures, pairs = value.get('objects'), value.get('exposures'), value.get('pairs')
    if not isinstance(objects, dict) or not isinstance(exposures, dict) or not isinstance(pairs, list):
        raise TypeError('invalid_observation_registry')
    if len(objects) > 1000 or len(exposures) > 10000 or len(pairs) > 100000:
        raise ValueError('observation_registry_too_large')
    for key, obj in objects.items():
        if not _identifier(key) or not isinstance(obj, dict) or obj.get('object_id') != key:
            raise ValueError('invalid_registered_object')
    for key, entry in exposures.items():
        if not _identifier(key) or not isinstance(entry, dict) or entry.get('observation_id') != key or entry.get('object_id') not in objects:
            raise ValueError('invalid_registered_exposure')
        if type(entry.get('enabled')) is not bool:
            raise ValueError('missing_registration_status')
        if not _identifier(entry.get('source_id')) or not _identifier(entry.get('calibration_id')) or not _identifier(entry.get('obs_id')):
            raise ValueError('invalid_registered_source_id')
        if entry.get('release') not in {'DR1','QR3','QR2'} or not isinstance(entry.get('date_avg'),str) or not 1 <= len(entry['date_avg']) <= 64 or str(entry.get('timesys','')).lower() not in {'utc','tt','tdb','tai','tcb','tcg'}:
            raise ValueError('invalid_registered_release_or_time')
        if not isinstance(entry.get('native_shape_yx'),list) or len(entry['native_shape_yx']) != 2 or any(type(n) is not int or not 1 <= n <= 4096 for n in entry['native_shape_yx']):
            raise ValueError('invalid_registered_shape')
        _detector(entry.get('detector'))
    seen = set()
    for pair in pairs:
        if not isinstance(pair, list) or len(pair) != 2 or pair[0] == pair[1] or any(key not in exposures for key in pair):
            raise ValueError('invalid_registered_pair')
        entries = [exposures[key] for key in pair]
        if entries[0]['object_id'] != entries[1]['object_id'] or _detector(entries[0]['detector']) != _detector(entries[1]['detector']):
            raise ValueError('registered_pair_object_or_detector_mismatch')
        # Reprocessed/cutout aliases are not new independent epochs.
        if entries[0].get('obs_id') == entries[1].get('obs_id') or entries[0].get('date_avg') == entries[1].get('date_avg'):
            raise ValueError('duplicate_registered_exposure_epoch')
        canonical = tuple(sorted(pair))
        if canonical in seen:
            raise ValueError('duplicate_registered_pair')
        seen.add(canonical)
    return root, path, value, hashlib.sha256(raw).hexdigest()


def load_registry(root=None, registry_path=REGISTRY):
    """Return authored contents only; no injected paths or computed pseudo-fields."""
    return _load(root, registry_path)[2]


def resolve_registered_pair(observation_ids, registry_path=REGISTRY, *, root=None, object_id=None):
    root, path, registry, registry_sha = _load(root, registry_path)
    if not isinstance(observation_ids, list) or len(observation_ids) != 2 or any(not _identifier(key) for key in observation_ids):
        raise ValueError('unsupported_observation_pair')
    canonical = tuple(sorted(observation_ids))
    if not any(tuple(sorted(pair)) == canonical for pair in registry['pairs']):
        raise ValueError('unsupported_observation_pair')
    entries = [registry['exposures'][key] for key in observation_ids]
    if not all(entry['enabled'] for entry in entries):
        raise ValueError('observation_registration_pending')
    actual_object = entries[0]['object_id']
    if object_id is not None and actual_object != object_id:
        raise ValueError('observation_object_mismatch')
    obj = registry['objects'][actual_object]
    refs = [(entry.get('prediction') or {}).get('source') or (obj.get('astrometry') or {}).get('source') for entry in entries]
    algorithm = 'spherex-native-v1' if set(observation_ids)=={'S01','S02'} else 'pluto-native-v1' if set(observation_ids)=={'S12','S14'} else ALGORITHM_VERSION
    return {'object_id': actual_object, 'observation_ids': observation_ids.copy(),
            'algorithm_version': algorithm, 'registry_sha256': registry_sha,
            'registry_manifest_path': path.relative_to(root).as_posix(), 'registry_manifest_sha256': registry_sha,
            'exposures': entries, 'source_ids': [e['source_id'] for e in entries],
            'calibration_ids': [e['calibration_id'] for e in entries], 'prediction_references': refs}


def registered_flag_definitions(header):
    """Decode declarations actually present; never infer a release's bit table."""
    if any(re.fullmatch(r'MSKN\d{4}', key) for key in header):
        return flag_definitions(header)
    declarations = [(key, header[key]) for key in header if key.startswith('MP_')]
    if not declarations or any(type(bit) is not int or not 0 <= bit < 32 for _, bit in declarations):
        raise ValueError('invalid_legacy_flag_declarations')
    if len({bit for _, bit in declarations}) != len(declarations):
        raise ValueError('duplicate_legacy_flag_bit')
    return sorted([{'name': key[3:], 'bit': bit, 'value': 1 << bit, 'description': str(header.comments[key])}
                   for key, bit in declarations], key=lambda item: item['bit'])


def _pin(record, pin):
    if not isinstance(pin, dict) or record.get('sha256') != pin.get('sha256') or record.get('bytes') != pin.get('bytes'):
        raise ValueError('registered_source_pin_mismatch')
    if pin.get('source_url') is not None and pin['source_url'] != record.get('source_url'):
        raise ValueError('registered_source_url_mismatch')


def _source(source, root):
    if not isinstance(source, dict) or urlparse(source.get('url', '')).scheme != 'https':
        raise ValueError('missing_prediction_source')
    if 'local_relative_path' in source:
        verify_source(root, source)
    return dict(source)


def _coordinate(obj, entry, root):
    date, scale = entry['date_avg'], entry['timesys']
    direct = entry.get('prediction')
    if direct is not None:
        if direct.get('kind') not in {'observer_ephemeris_prediction', 'archive_query_direction_reference', 'fixed_catalogue_direction_reference'}:
            raise ValueError('unsupported_prediction_policy')
        if direct.get('date_avg') != date or direct.get('timesys') != scale:
            raise ValueError('prediction_time_mismatch')
        ra, dec = direct.get('ra_deg'), direct.get('dec_deg')
        source = _source(direct.get('source'), root)
        kind, omitted = direct['kind'], list(direct.get('omitted', []))
        if kind == 'observer_ephemeris_prediction' and obj['object_id'] == 'pluto' and (str(source.get('target_id')) != '999' or str(source.get('observer_id')) != '-163182'):
            raise ValueError('pluto_observer_prediction_mismatch')
        coordinate = None
    else:
        astro = obj.get('astrometry') or {}
        ra, dec = astro.get('ra_deg'), astro.get('dec_deg')
        source = _source(astro.get('source'), root)
        source.update({key: astro[key] for key in ('epoch', 'epoch_time_scale', 'ra_deg', 'dec_deg', 'pm_ra_cosdec_mas_yr', 'pm_dec_mas_yr') if key in astro})
        kind, coordinate = 'fixed_catalogue_direction_reference', None
        omitted = ['observer_parallax', 'radial_velocity', 'full_covariance', 'measured_centroid', 'source_association']
        if astro.get('kind') == 'angular_proper_motion':
            if any(not _finite_number(astro.get(key)) for key in ('ra_deg', 'dec_deg', 'pm_ra_cosdec_mas_yr', 'pm_dec_mas_yr')):
                raise ValueError('invalid_astrometry_inputs')
            if astro.get('epoch_time_scale') not in {'tai','tcb','tcg','tdb','tt','utc'} or not astro.get('epoch'):
                raise ValueError('missing_astrometry_epoch_scale')
            coordinate = SkyCoord(ra=ra*u.deg, dec=dec*u.deg,
                                  pm_ra_cosdec=astro['pm_ra_cosdec_mas_yr']*u.mas/u.yr,
                                  pm_dec=astro['pm_dec_mas_yr']*u.mas/u.yr,
                                  obstime=Time(astro['epoch'], scale=astro['epoch_time_scale']), frame='icrs')
            with warnings.catch_warnings():
                warnings.filterwarnings('ignore', message='ERFA function "pmsafe".*distance overridden', category=ErfaWarning)
                coordinate = coordinate.apply_space_motion(new_obstime=Time(date, scale=scale.lower()))
            ra, dec, kind = float(coordinate.ra.deg), float(coordinate.dec.deg), 'proper_motion_prediction'
        elif astro.get('kind') != 'fixed_icrs':
            raise ValueError('missing_registered_position')
        else:
            if not isinstance(astro.get('epoch'),str) or not astro['epoch']:
                raise ValueError('missing_fixed_catalogue_epoch')
            omitted.append('proper_motion_not_applied')
    if not _finite_number(ra) or not _finite_number(dec) or not 0 <= ra < 360 or not -90 <= dec <= 90:
        raise ValueError('invalid_registered_coordinate')
    source.setdefault('epoch', date)
    source.setdefault('frame', 'ICRS')
    return coordinate if coordinate is not None else SkyCoord(ra*u.deg, dec*u.deg, frame='icrs'), kind, source, omitted


def _proof_tree(entry):
    proof = entry.get('calibration_datalink') or {}
    text, response_sha = proof.get('response_text'), proof.get('response_sha256')
    parsed = urlparse(proof.get('source_url') or '')
    expected_id = f"ivo://irsa.ipac/spherex_{entry['release'].lower()}?{entry['obs_id']}/{_detector(entry['detector'])}"
    if parsed.scheme != 'https' or parsed.netloc != 'irsa.ipac.caltech.edu' or parsed.path != '/datalink/links/spherex' or parse_qs(parsed.query).get('ID') != [expected_id]:
        raise ValueError('datalink_observation_mismatch')
    if not isinstance(text, str) or len(text.encode('utf-8')) > 2_000_000 or hashlib.sha256(text.encode('utf-8')).hexdigest() != response_sha:
        raise ValueError('datalink_response_integrity')
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        raise ValueError('unsupported_datalink_xml')
    tree = ET.fromstring(text)
    if any(node.tag.split('}')[-1]=='INFO' and node.attrib.get('name')=='QUERY_STATUS' and node.attrib.get('value')!='OK' for node in tree.iter()):
        raise ValueError('datalink_query_not_successful')
    return proof,tree,expected_id


def _datalink(entry, calibration):
    proof,tree,expected_id = _proof_tree(entry)
    calibration_url = proof.get('calibration_url')
    parsed_cal = urlparse(calibration_url or '')
    family, detector = entry['calibration_family'], _detector(entry['detector'])
    record_cal = urlparse(calibration.get('source_url',''))
    if not re.fullmatch(r'cal-(?:swcs|wcs)-v\d+-\d{4}-\d{3}',family) or f'/spectral_wcs/{family}/{detector[1:]}/' not in record_cal.path:
        raise ValueError('registered_calibration_family_mismatch')
    if parsed_cal.scheme != 'https' or parsed_cal.netloc != 'irsa.ipac.caltech.edu' or f'/spectral_wcs/{family}/{detector[1:]}/' not in parsed_cal.path:
        raise ValueError('datalink_calibration_mismatch')
    matched = False
    for table in (node for node in tree.iter() if node.tag.split('}')[-1] == 'TABLE'):
        columns = [node.attrib.get('name') for node in table if node.tag.split('}')[-1] == 'FIELD']
        for row in (node for node in table.iter() if node.tag.split('}')[-1] == 'TR'):
            cells = [''.join(node.itertext()).strip() for node in row if node.tag.split('}')[-1] == 'TD']
            values = dict(zip(columns, cells, strict=False))
            if values.get('id') == expected_id and values.get('access_url') == calibration_url and values.get('semantics') == '#calibration' and not values.get('error_message'):
                if values.get('content_length') and int(values['content_length']) != calibration['bytes']:
                    raise ValueError('datalink_calibration_size_mismatch')
                matched = True
    if not matched:
        raise ValueError('datalink_calibration_row_missing')
    return proof


def _unverified_native_only(entry):
    status = entry.get('calibration_verification_status','verified')
    if status == 'verified':
        return False
    if status not in {'unverified_service_error','unverified_archive_metadata_unavailable'}:
        raise ValueError('unsupported_calibration_verification_status')
    reason = entry.get('calibration_unavailable_reason')
    proof = entry.get('calibration_datalink') or {}
    if not isinstance(reason,str) or not 1 <= len(reason) <= 2000:
        raise ValueError('missing_calibration_service_error_reason')
    if status == 'unverified_service_error':
        # An explicit upstream retrieval failure cannot conceal an obtained bad proof.
        if proof.get('response_text') not in (None,'') or proof.get('response_sha256') not in (None,''):
            raise ValueError('cannot_discard_received_datalink_proof')
    else:
        proof,tree,_ = _proof_tree(entry)
        tables = [node for node in tree.iter() if node.tag.split('}')[-1]=='TABLE']
        valid_empty_table = any({'id','access_url','semantics'} <= {child.attrib.get('name') for child in table if child.tag.split('}')[-1]=='FIELD'} and any(child.tag.split('}')[-1]=='TABLEDATA' for child in table.iter()) for table in tables)
        if proof.get('calibration_url') is not None or not valid_empty_table or any(node.tag.split('}')[-1]=='TR' for node in tree.iter()):
            raise ValueError('archive_metadata_unavailable_requires_verified_empty_table')
    return True


def _psf(hdul, release):
    if release in {'DR1', 'QR3'}:
        if 'EPSF' not in hdul or not isinstance(hdul['EPSF'], fits.BinTableHDU):
            raise ValueError('epsf_not_table')
        hdu = hdul['EPSF']
        epsf = {'rows': int(hdu.header['NAXIS2']), 'columns': list(hdu.columns.names),
                'oversampling': {'x': hdu.header.get('OVSMPX'), 'y': hdu.header.get('OVSMPY')},
                'zone_columns': [name for name in ('BINX','BINY','XCENTER','YCENTER','XWIDTH','YWIDTH') if name in hdu.columns.names]}
        return epsf, {'kind': 'effective_psf_table', 'hdu': 'EPSF', 'rows': epsf['rows']}
    if release != 'QR2' or 'PSF' not in hdul or not isinstance(hdul['PSF'], fits.ImageHDU):
        raise ValueError('unsupported_legacy_psf')
    shape = list(hdul['PSF'].shape)
    if shape != [121, 101, 101]:
        raise ValueError('unexpected_legacy_psf_shape')
    return {'rows': None, 'columns': [], 'oversampling': None}, {'kind': 'legacy_psf_cube', 'hdu': 'PSF', 'shape': shape,
            'header_interpretation': 'Original header preserved; no PSF fitting, resampling or unverified historical header correction applied.'}


def _read_registered_frame(root, obj, entry, records, cutout_size):
    record, calibration = records[entry['source_id']], records[entry['calibration_id']]
    _pin(record, entry.get('source'))
    _pin(calibration, entry.get('calibration_source'))
    source_path, cal_path = verify_source(root, record), verify_source(root, calibration)
    family, detector = entry['calibration_family'], _detector(entry['detector'])
    if not re.fullmatch(r'cal-(?:swcs|wcs)-v\d+-\d{4}-\d{3}',family) or f'/spectral_wcs/{family}/{detector[1:]}/' not in urlparse(calibration.get('source_url','')).path:
        raise ValueError('registered_calibration_family_mismatch')
    native_only = _unverified_native_only(entry)
    proof = (entry.get('calibration_datalink') or {}) if native_only else _datalink(entry, calibration)
    coordinate, kind, prediction_source, omitted = _coordinate(obj, entry, root)
    with fits.open(source_path, mode='readonly', memmap=False) as hdul, fits.open(cal_path, mode='readonly', memmap=False) as cal:
        if any(name not in hdul for name in ('IMAGE', 'FLAGS', 'VARIANCE', 'ZODI', 'WCS-WAVE')):
            raise ValueError('missing_required_hdu')
        header = hdul['IMAGE'].header
        if str(header.get('OBSID')).strip() != entry['obs_id'] or _detector(header.get('DETECTOR')) != _detector(entry['detector']) or str(hdul[0].header.get('VERSION')).strip() != entry['pipeline_version']:
            raise ValueError('registered_observation_metadata_mismatch')
        if str(header.get('DATE-AVG')) != entry['date_avg'] or str(header.get('TIMESYS')) != entry['timesys']:
            raise ValueError('registered_observation_time_mismatch')
        for name, unit in [('IMAGE', u.MJy/u.sr), ('VARIANCE', (u.MJy/u.sr)**2), ('ZODI', u.MJy/u.sr)]:
            if u.Unit(hdul[name].header.get('BUNIT')) != unit:
                raise ValueError('unexpected_plane_unit')
        planes = {name: hdul[name].data for name in ('IMAGE', 'FLAGS', 'VARIANCE', 'ZODI')}
        shape = planes['IMAGE'].shape
        if len(shape) != 2 or list(shape) != entry['native_shape_yx'] or any(plane.shape != shape for plane in planes.values()):
            raise ValueError('registered_plane_shape_mismatch')
        if not np.issubdtype(planes['FLAGS'].dtype, np.integer) or planes['FLAGS'].dtype.itemsize > 4:
            raise ValueError('unsupported_flags_dtype')
        epsf, psf = _psf(hdul, entry['release'])
        sky_wcs = WCS(header, fobj=hdul)
        x, y = map(float, sky_wcs.world_to_pixel(coordinate))
        height, width = shape
        if not math.isfinite(x) or not math.isfinite(y) or not 0 <= x < width or not 0 <= y < height:
            raise ValueError('prediction_outside_image')
        detector_x, detector_y = map(float, _alternate_wcs(header, hdul, 'A').all_pix2world(x, y, 0))
        approximate = _alternate_wcs(header, hdul, 'W').all_pix2world(x, y, 0)
        for name in ('CWAVE', 'CBAND'):
            if name not in cal or u.Unit(cal[name].header.get('BUNIT')) != u.um or _detector(cal[name].header.get('DETECTOR')) != _detector(entry['detector']):
                raise ValueError('calibration_unit_or_detector_mismatch')
        if cal['CWAVE'].shape != cal['CBAND'].shape or len(cal['CWAVE'].shape) != 2:
            raise ValueError('calibration_shape_mismatch')
        # Candidate SWCS arrays are never sampled when their observation link is unverified.
        wave = None if native_only else _bilinear(cal['CWAVE'].data, detector_x, detector_y)
        band = None if native_only else _bilinear(cal['CBAND'].data, detector_x, detector_y)
        if wave is not None and wave <= 0:
            wave = None
        if band is not None and band <= 0:
            band = None
        cx, cy, half = int(np.floor(x+.5)), int(np.floor(y+.5)), cutout_size//2
        x0, x1, y0, y1 = max(0,cx-half), min(width,cx+half+1), max(0,cy-half), min(height,cy+half+1)
        cutout = {name: _json_array(plane[y0:y1,x0:x1]) for name, plane in planes.items()}
        cutout.update(width=x1-x0, height=y1-y0, native_origin={'x':x0,'y':y0}, array_order='yx', pixel_origin=0,
                      requested_size=cutout_size, clipped_pixel_count=cutout_size**2-(x1-x0)*(y1-y0), resampling='none', zodi_subtracted=False)
        roundtrip = sky_wcs.world_to_pixel(sky_wcs.pixel_to_world(x,y))
        metadata = {'obs_id':entry['obs_id'], 'release':entry['release'], 'detector':_detector(entry['detector']),
                    'pipeline_version':entry['pipeline_version'], 'date_avg':entry['date_avg'], 'timesys':entry['timesys'],
                    'observer':'SPHEREx', 'observer_id':prediction_source.get('observer_id'), 'observer_source':'IRSA SPHEREx archive product',
                    'unit':str(header['BUNIT']).strip(), 'variance_unit':str(hdul['VARIANCE'].header['BUNIT']).strip(),
                    'wavelength_um':wave, 'bandwidth_um':band, 'wavelength_status':'unverified_calibration_link' if native_only else 'calibrated_sample' if wave is not None and band is not None else 'calibration_sample_unavailable',
                    'wavelength_method':'SWCS not applied: per-observation DataLink association unverified; native display only' if native_only else entry['calibration_family']+' CWAVE/CBAND bilinear at active detector coordinates; alternate sky SIP removed',
                    'spectral_calibration_history':[str(card.value) for card in header.cards if card.keyword=='HISTORY' and '[CALIB] spectral_wcs' in str(card.value)],
                    'approximate_embedded_wcs_wavelength_um':_finite(approximate[0]), 'approximate_embedded_wcs_bandwidth_um':_finite(approximate[1]),
                    'epsf':epsf, 'psf':psf, 'source_extent_kind':record.get('kind'),
                    'hdus':[{'name':hdu.name,'shape':list(hdu.shape) if hasattr(hdu,'shape') else None,'type':type(hdu).__name__} for hdu in hdul],
                    'wcs':{'origin':0,'ctype':list(sky_wcs.wcs.ctype),'has_sip':sky_wcs.sip is not None,
                           'round_trip_error_px':float(np.hypot(float(roundtrip[0])-x,float(roundtrip[1])-y)),
                           'native_shape_yx':[height,width],'alternate_sip_applied':False}}
        return {'observation_id':entry['observation_id'], 'metadata':metadata, 'provenance':_provenance(record),
                'calibration':{**_provenance(calibration),'calibration_id':entry['calibration_family'],
                               'verified':not native_only,'verification_status':entry.get('calibration_verification_status') if native_only else 'verified',
                               'unavailable_reason':entry.get('calibration_unavailable_reason') if native_only else None,
                               'applied_to_wavelength':not native_only,
                               'datalink_source_url':proof.get('source_url'),'datalink_response_sha256':proof.get('response_sha256'),
                               'datalink_calibration_url':proof.get('calibration_url') if not native_only else None},
                'prediction':{'ra_deg':float(coordinate.ra.deg),'dec_deg':float(coordinate.dec.deg),'x':x,'y':y,
                              'detector_x':detector_x,'detector_y':detector_y,'kind':kind,'source':prediction_source,'omitted':omitted},
                'cutout':cutout, 'quality':quality_summary(planes,(x,y),registered_flag_definitions(hdul['FLAGS'].header))}


def list_registered_observations(object_id, registry_path=REGISTRY, *, root=None):
    root, _, registry, _ = _load(root, registry_path)
    if object_id not in registry['objects']:
        return []
    records, obj = _records(root), registry['objects'][object_id]
    result = []
    for entry in registry['exposures'].values():
        if entry['object_id'] != object_id or not entry['enabled']:
            continue
        frame = _read_registered_frame(root,obj,entry,records,9)
        result.append({'id':entry['observation_id'],'observation_id':entry['observation_id'],'object_id':object_id,
                       **{key:frame['metadata'][key] for key in ('obs_id','release','detector','date_avg','timesys','unit','wavelength_um','bandwidth_um')},
                       **{key:frame['provenance'][key] for key in ('sha256','bytes','source_url')},
                       'status':'available','prediction_kind':frame['prediction']['kind'],
                       'quantitative_comparison_validated':False})
    return result


def build_registered_comparison(observation_ids, registry_path=REGISTRY, *, root=None, object_id=None, cutout_size=81):
    if isinstance(observation_ids,list) and all(isinstance(key,str) for key in observation_ids) and tuple(observation_ids) in LEGACY_PAIRS:
        raise ValueError('legacy_comparison_requires_preserved_builder')
    if type(cutout_size) is not int or not 9 <= cutout_size <= 101 or cutout_size % 2 != 1:
        raise ValueError('invalid_cutout_size')
    resolved = resolve_registered_pair(observation_ids,registry_path,root=root,object_id=object_id)
    root, registry_file, registry, registry_sha = _load(root,registry_path)
    if registry_sha != resolved['registry_manifest_sha256']:
        raise ValueError('registry_changed_during_build')
    obj, records = registry['objects'][resolved['object_id']], _records(root)
    frames = [_read_registered_frame(root,obj,entry,records,cutout_size) for entry in resolved['exposures']]
    wave = [frame['metadata']['wavelength_um'] for frame in frames]
    band = [frame['metadata']['bandwidth_um'] for frame in frames]
    overlap = None if any(value is None for value in wave+band) else abs(wave[0]-wave[1]) <= (band[0]+band[1])/2
    wave_warnings = ['response_and_photometric_comparability_not_validated']
    if overlap is False:
        wave_warnings.append('nominal_wavelength_intervals_disjoint')
    if overlap is None:
        wave_warnings.append('calibrated_wavelength_or_bandwidth_unavailable')
    if frames[0]['metadata']['release'] != frames[1]['metadata']['release']:
        wave_warnings.append('different_release_gain_and_processing_not_homogenized')
    native_only = any(not frame['calibration']['verified'] for frame in frames)
    if native_only:
        wave_warnings.append('unverified_calibration_link_native_only')
        wave_warnings.extend(sorted({frame['calibration']['verification_status']+'_native_only' for frame in frames if not frame['calibration']['verified']}))
    limits = LIMITATIONS+list(obj.get('limitations',[]))
    if native_only:
        limits.append('A per-observation DataLink association is unavailable due to an explicit upstream failure or a verified empty archive result. Candidate SWCS files have integrity checks but are not applied; calibrated wavelength/bandwidth are unavailable for affected native display frames.')
    result = {'schema_version':'1.0','algorithm_version':ALGORITHM_VERSION,'object_id':resolved['object_id'],
              'frames':frames,'scientific_status':'association_insufficient','layout':'native_unregistered',
              'mask_policy_id':MASK_POLICY_ID,'limitations':limits,
              'software':{'astropy':astropy.__version__,'numpy':np.__version__},
              'registry_manifest_path':resolved['registry_manifest_path'],'registry_manifest_sha256':resolved['registry_manifest_sha256'],
              'prediction_references':resolved['prediction_references'],
              'prediction_source_refs':[ref for ref in resolved['prediction_references'] if ref and 'local_relative_path' in ref],
              'wavelength_comparison':{'status':'not_validated','nominal_interval_overlap':overlap,'warnings':wave_warnings}}
    # Reject any accidental NaN/Infinity before caller assigns a content-derived ID.
    json.dumps(result,allow_nan=False)
    if hashlib.sha256(registry_file.read_bytes()).hexdigest() != registry_sha:
        raise ValueError('registry_changed_during_build')
    return result
