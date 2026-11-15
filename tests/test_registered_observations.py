"""Synthetic FITS pipeline tests, not observational validation; run on EC2."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
from urllib.parse import quote

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS

HERE = Path(__file__).resolve().parent
if (HERE/'registered_observations.py').is_file():
    SPEC = importlib.util.spec_from_file_location('staged_registered_observations',HERE/'registered_observations.py')
    reader = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(reader)
else:
    from science import registered_observations as reader


def _record(root,path,identifier,url,kind):
    raw = path.read_bytes()
    return {'id':identifier,'local_relative_path':path.relative_to(root).as_posix(),'source_url':url,
            'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'kind':kind,'retrieved_utc':'2026-11-15T00:00:00Z'}


@pytest.fixture
def registered(tmp_path):
    root = tmp_path
    (root/'data/raw').mkdir(parents=True)
    (root/'data/calibration').mkdir()
    (root/'data/manifests').mkdir()
    records, exposures = [], {}
    for index,release in enumerate(['QR2','QR3'],1):
        family = 'cal-wcs-v4-2025-254' if release=='QR2' else 'cal-swcs-v5-2026-191'
        cal_id = f'C0{index}'
        cal_url = f'https://irsa.ipac.caltech.edu/ibe/data/spherex/{release.lower()}/spectral_wcs/{family}/6/spectral_wcs_D6_spx_{family}.fits'
        cal_path = root/f'data/calibration/{cal_id}.fits'
        cal_hdus = [fits.PrimaryHDU()]
        for name,value in [('CWAVE',4.8 if release=='QR2' else 4.5),('CBAND',.04)]:
            hdu = fits.ImageHDU(np.full((9,9),value,dtype=np.float32),name=name)
            hdu.header['BUNIT']='um';hdu.header['DETECTOR']=6 if release=='QR2' else '6'
            cal_hdus.append(hdu)
        fits.HDUList(cal_hdus).writeto(cal_path)
        cal_record = _record(root,cal_path,cal_id,cal_url,'calibration');records.append(cal_record)
        source_id,selection = f'F0{index}',f'T0{index}'
        obs_id = f'2025W01_1A_000{index}_1'
        date = f'2025-01-0{index}T00:00:00.000'
        version = '6.4+psffix1' if release=='QR2' else '7.0.5'
        primary = fits.PrimaryHDU();primary.header['VERSION']=version
        wcs=WCS(naxis=2);wcs.wcs.crval=[10,20];wcs.wcs.crpix=[5,5];wcs.wcs.cdelt=[-.001,.001];wcs.wcs.ctype=['RA---TAN','DEC--TAN']
        header=wcs.to_header();header['OBSID']=obs_id;header['DETECTOR']=6
        header['DATE-AVG']=date;header['TIMESYS']='UTC'
        for key in ['A','W']:
            header[f'WCSAXES{key}']=2
            for axis in [1,2]:
                header[f'CTYPE{axis}{key}']='LINEAR';header[f'CRPIX{axis}{key}']=1
                header[f'CUNIT{axis}{key}']='pixel' if key=='A' else 'um'
                header[f'CDELT{axis}{key}']=1 if key=='A' else .00001
                header[f'CRVAL{axis}{key}']=0 if key=='A' else (4.8 if axis==1 else .04)
        hdus=[primary]
        for name in ['IMAGE','FLAGS','VARIANCE','ZODI']:
            array=np.full((9,9),1,dtype=np.int32 if name=='FLAGS' else np.float32)
            if name=='IMAGE':array[0,0]=np.nan
            if name=='FLAGS':array[:]=1<<21;array[4,4]|=1
            hdu=fits.ImageHDU(array,header=header.copy(),name=name)
            hdu.header['BUNIT']='' if name=='FLAGS' else 'MJy2 / sr2' if name=='VARIANCE' else 'MJy / sr'
            if name=='FLAGS':
                if release=='QR2':hdu.header['MP_TRANSIENT']=(0,'Transient');hdu.header['MP_SOURCE']=(21,'Known source informational')
                else:
                    hdu.header['MSKN0000']='TRANSIENT';hdu.header['MSKM0000']=1
                    hdu.header['MSKN0021']='SOURCE';hdu.header['MSKM0021']=1<<21
            hdus.append(hdu)
        if release=='QR2':hdus.append(fits.ImageHDU(np.zeros((121,101,101),dtype=np.float32),name='PSF'))
        else:
            epsf=fits.BinTableHDU.from_columns([fits.Column(name='PIXELS',format='E',array=[1.,2.])],name='EPSF')
            epsf.header['OVSMPX']=5;epsf.header['OVSMPY']=5;hdus.append(epsf)
        hdus.append(fits.BinTableHDU.from_columns([fits.Column(name='VALUES',format='2E',array=[[4.8,.04]])],name='WCS-WAVE'))
        source_path=root/f'data/raw/{source_id}.fits';fits.HDUList(hdus).writeto(source_path)
        source_url=f'https://irsa.ipac.caltech.edu/ibe/data/spherex/{release.lower()}/level2/{obs_id}D6.fits'
        source=_record(root,source_path,source_id,source_url,'archive_cutout');records.append(source)
        ivo=f'ivo://irsa.ipac/spherex_{release.lower()}?{obs_id}/D6'
        xml=f'<VOTABLE><RESOURCE><TABLE><FIELD name="id"/><FIELD name="access_url"/><FIELD name="semantics"/><FIELD name="content_length"/><DATA><TABLEDATA><TR><TD>{ivo}</TD><TD>{cal_url}</TD><TD>#calibration</TD><TD>{cal_record["bytes"]}</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>'
        exposures[selection]={'observation_id':selection,'object_id':'fixture-star','source_id':source_id,
            'source':{k:source[k] for k in ['sha256','bytes','source_url']},'calibration_id':cal_id,
            'calibration_source':{k:cal_record[k] for k in ['sha256','bytes','source_url']},
            'release':release,'obs_id':obs_id,'detector':'D6','pipeline_version':version,
            'date_avg':date,'timesys':'UTC','native_shape_yx':[9,9],'calibration_family':family,
            'calibration_datalink':{'source_url':'https://irsa.ipac.caltech.edu/datalink/links/spherex?ID='+quote(ivo,safe=''),
                'response_text':xml,'response_sha256':hashlib.sha256(xml.encode()).hexdigest(),'calibration_url':cal_url},'enabled':True}
    registry={'schema_version':'1.0','algorithm_version':reader.ALGORITHM_VERSION,
        'objects':{'fixture-star':{'object_id':'fixture-star','name':'Synthetic test only','astrometry':{
            'kind':'fixed_icrs','ra_deg':10.,'dec_deg':20.,'epoch':'J2000','epoch_time_scale':'tt',
            'source':{'url':'https://example.org/synthetic-test-only'}}}},'exposures':exposures,'pairs':[['T01','T02']]}
    path=root/'data/manifests/observation_registry.json'
    path.write_text(json.dumps(registry),encoding='utf-8')
    (root/'data/manifests/datasets.json').write_text(json.dumps({'files':records}),encoding='utf-8')
    return root,path,registry,records


def _save(path,value):
    path.write_text(json.dumps(value),encoding='utf-8')


def test_bit_zero_is_a_declared_transient_not_missing_and_names_are_preserved():
    header=fits.Header();header['MP_TRANSIENT']=(0,'native comment');header['MP_SOURCE']=(21,'informational')
    flags=reader.registered_flag_definitions(header)
    assert flags==[{'name':'TRANSIENT','bit':0,'value':1,'description':'native comment'},
                   {'name':'SOURCE','bit':21,'value':2097152,'description':'informational'}]
    header['MP_ALIAS']=0
    with pytest.raises(ValueError,match='duplicate_legacy_flag_bit'):reader.registered_flag_definitions(header)
    header['MP_ALIAS']=32
    with pytest.raises(ValueError,match='invalid_legacy_flag_declarations'):reader.registered_flag_definitions(header)


def test_actual_synthetic_native_pipeline_preserves_planes_and_tags_psf_formats(registered):
    root,path,_,records=registered
    before={r['id']:hashlib.sha256((root/r['local_relative_path']).read_bytes()).hexdigest() for r in records}
    result=reader.build_registered_comparison(['T01','T02'],path,root=root,object_id='fixture-star')
    assert 'result_id' not in result
    assert result['scientific_status']=='association_insufficient'
    assert result['layout']=='native_unregistered'
    assert result['registry_manifest_sha256']==hashlib.sha256(path.read_bytes()).hexdigest()
    a,b=result['frames']
    assert [a['observation_id'],b['observation_id']]==['T01','T02']
    assert [a['provenance']['id'],b['provenance']['id']]==['F01','F02']
    assert a['metadata']['epsf']['rows'] is None
    assert a['metadata']['psf']['kind']=='legacy_psf_cube'
    assert a['metadata']['psf']['shape']==[121,101,101]
    assert b['metadata']['epsf']['rows']==2
    assert b['metadata']['psf']['kind']=='effective_psf_table'
    assert a['cutout']['IMAGE'][0][0] is None
    assert a['cutout']['FLAGS'][4][4]==(1<<21)+1
    assert a['cutout']['VARIANCE'][4][4]==1
    assert a['cutout']['ZODI'][4][4]==1
    assert a['cutout']['zodi_subtracted'] is False
    assert a['cutout']['resampling']=='none'
    assert a['cutout']['width']==a['cutout']['height']==9
    assert a['quality']['flag_counts']['TRANSIENT']==1
    assert a['quality']['quantitative']['status']=='not_validated'
    assert result['wavelength_comparison']['status']=='not_validated'
    assert result['wavelength_comparison']['nominal_interval_overlap'] is False
    assert 'different_release_gain_and_processing_not_homogenized' in result['wavelength_comparison']['warnings']
    assert before=={r['id']:hashlib.sha256((root/r['local_relative_path']).read_bytes()).hexdigest() for r in records}


def test_resolver_preserves_reverse_order_and_source_ids_without_editing_registry(registered):
    root,path,_,_=registered;before=path.read_bytes()
    result=reader.resolve_registered_pair(['T02','T01'],path,root=root)
    assert result['observation_ids']==['T02','T01']
    assert result['source_ids']==['F02','F01']
    assert result['calibration_ids']==['C02','C01']
    assert path.read_bytes()==before
    with pytest.raises(ValueError,match='observation_object_mismatch'):reader.resolve_registered_pair(['T01','T02'],path,root=root,object_id='wrong')
    with pytest.raises(ValueError,match='unsupported_observation_pair'):reader.resolve_registered_pair(['T01','T01'],path,root=root)


def test_legacy_four_orders_are_never_recomputed_even_without_a_registry():
    for pair in [('S01','S02'),('S02','S01'),('S12','S14'),('S14','S12')]:
        with pytest.raises(ValueError,match='legacy_comparison_requires_preserved_builder'):
            reader.build_registered_comparison(list(pair),Path('missing-registry.json'))


def test_pending_and_same_epoch_or_cross_detector_pairs_fail_closed(registered):
    root,path,registry,_=registered
    registry['exposures']['T02']['enabled']=False;_save(path,registry)
    with pytest.raises(ValueError,match='registration_pending'):reader.resolve_registered_pair(['T01','T02'],path,root=root)
    registry['exposures']['T02']['enabled']=True
    registry['exposures']['T02']['date_avg']=registry['exposures']['T01']['date_avg'];_save(path,registry)
    with pytest.raises(ValueError,match='duplicate_registered_exposure_epoch'):reader.load_registry(root,path)
    registry['exposures']['T02']['date_avg']='2025-01-02T00:00:00.000';registry['exposures']['T02']['detector']='D1';_save(path,registry)
    with pytest.raises(ValueError,match='object_or_detector_mismatch'):reader.load_registry(root,path)


def test_source_hash_tampering_is_rejected_before_fits_parsing(registered):
    root,path,_,records=registered
    source=next(r for r in records if r['id']=='F01');raw_path=root/source['local_relative_path']
    raw=raw_path.read_bytes();raw_path.write_bytes(b'X'+raw[1:])
    with pytest.raises(ValueError,match='source_hash_mismatch'):reader.build_registered_comparison(['T01','T02'],path,root=root)


def test_datalink_proof_is_bound_to_observation_and_calibration(registered):
    root,path,registry,_=registered
    proof=registry['exposures']['T01']['calibration_datalink'];proof['response_text']+=' '
    _save(path,registry)
    with pytest.raises(ValueError,match='datalink_response_integrity'):reader.build_registered_comparison(['T01','T02'],path,root=root)
    proof['response_sha256']=hashlib.sha256(proof['response_text'].encode()).hexdigest()
    proof['calibration_url']=proof['calibration_url'].replace('/6/','/1/');_save(path,registry)
    with pytest.raises(ValueError,match='datalink_calibration_mismatch'):reader.build_registered_comparison(['T01','T02'],path,root=root)


def test_lists_include_registered_legacy_selection_ids_but_do_not_build_legacy_results(registered):
    root,path,registry,_=registered
    registry['exposures']={new:{**entry,'observation_id':new} for new,entry in zip(['S01','S02'],registry['exposures'].values(),strict=True)}
    registry['pairs']=[['S01','S02']];_save(path,registry)
    assert reader.resolve_registered_pair(['S01','S02'],path,root=root)['object_id']=='fixture-star'
    assert reader.resolve_registered_pair(['S01','S02'],path,root=root)['algorithm_version']=='spherex-native-v1'
    rows=reader.list_registered_observations('fixture-star',path,root=root)
    assert [r['observation_id'] for r in rows]==['S01','S02']
    assert all(r['quantitative_comparison_validated'] is False for r in rows)
    with pytest.raises(ValueError,match='legacy_comparison_requires_preserved_builder'):reader.build_registered_comparison(['S01','S02'],path,root=root)


def test_explicit_upstream_failure_keeps_native_quality_but_never_samples_candidate_swcs(registered,monkeypatch):
    root,path,registry,_=registered
    entry=registry['exposures']['T01']
    entry['calibration_verification_status']='unverified_service_error'
    entry['calibration_unavailable_reason']='IRSA DataLink upstream 502 retrieval failed.'
    entry['calibration_datalink']['response_text']=None
    entry['calibration_datalink']['response_sha256']=None
    _save(path,registry)
    sampled=[];original=reader._bilinear
    def tracked(*args):sampled.append(1);return original(*args)
    monkeypatch.setattr(reader,'_bilinear',tracked)
    result=reader.build_registered_comparison(['T01','T02'],path,root=root)
    first=result['frames'][0]
    assert len(sampled)==2  # CWAVE/CBAND only for verified T02, never candidate T01.
    assert first['metadata']['wavelength_um'] is None
    assert first['metadata']['bandwidth_um'] is None
    assert first['metadata']['wavelength_status']=='unverified_calibration_link'
    assert first['calibration']['verified'] is False
    assert first['calibration']['verification_status']=='unverified_service_error'
    assert first['calibration']['applied_to_wavelength'] is False
    assert first['quality']['flag_counts']['TRANSIENT']==1
    assert first['cutout']['FLAGS'][4][4]==(1<<21)+1
    assert result['wavelength_comparison']['nominal_interval_overlap'] is None
    assert 'unverified_service_error_native_only' in result['wavelength_comparison']['warnings']


def test_received_datalink_proof_cannot_be_hidden_as_a_retrieval_failure(registered):
    root,path,registry,_=registered
    entry=registry['exposures']['T01']
    entry['calibration_verification_status']='unverified_service_error'
    entry['calibration_unavailable_reason']='Claimed 502, but a proof was actually supplied.'
    _save(path,registry)
    with pytest.raises(ValueError,match='cannot_discard_received_datalink_proof'):
        reader.build_registered_comparison(['T01','T02'],path,root=root)


def test_verified_zero_row_archive_response_is_preserved_without_calibration_sampling(registered):
    root,path,registry,_=registered
    entry=registry['exposures']['T01']
    entry['calibration_verification_status']='unverified_archive_metadata_unavailable'
    entry['calibration_unavailable_reason']='QR2 archive request returned a valid empty result table.'
    proof=entry['calibration_datalink']
    proof['response_text']='<VOTABLE><RESOURCE><INFO name="QUERY_STATUS" value="OK"/><TABLE><FIELD name="id"/><FIELD name="access_url"/><FIELD name="semantics"/><DATA><TABLEDATA/></DATA></TABLE></RESOURCE></VOTABLE>'
    proof['response_sha256']=hashlib.sha256(proof['response_text'].encode()).hexdigest()
    proof['calibration_url']=None;_save(path,registry)
    result=reader.build_registered_comparison(['T01','T02'],path,root=root)
    assert result['frames'][0]['calibration']['verified'] is False
    assert result['frames'][0]['calibration']['verification_status']=='unverified_archive_metadata_unavailable'
    assert result['frames'][0]['calibration']['datalink_response_sha256']==proof['response_sha256']
    assert result['frames'][0]['metadata']['wavelength_um'] is None
    assert result['frames'][0]['quality']['flag_counts']['TRANSIENT']==1


def test_nonempty_received_rows_cannot_masquerade_as_unavailable_archive_metadata(registered):
    root,path,registry,_=registered
    entry=registry['exposures']['T01']
    entry['calibration_verification_status']='unverified_archive_metadata_unavailable'
    entry['calibration_unavailable_reason']='Wrong claim: a nonempty row exists.'
    entry['calibration_datalink']['calibration_url']=None;_save(path,registry)
    with pytest.raises(ValueError,match='archive_metadata_unavailable_requires_verified_empty_table'):
        reader.build_registered_comparison(['T01','T02'],path,root=root)


def test_zero_angular_motion_retains_direction_and_records_omitted_effects(registered):
    root,path,registry,_=registered
    astro=registry['objects']['fixture-star']['astrometry']
    astro.update(kind='angular_proper_motion',pm_ra_cosdec_mas_yr=0.,pm_dec_mas_yr=0.)
    _save(path,registry)
    result=reader.build_registered_comparison(['T01','T02'],path,root=root)
    for frame in result['frames']:
        assert frame['prediction']['kind']=='proper_motion_prediction'
        assert frame['prediction']['ra_deg']==pytest.approx(10.,abs=1e-10)
        assert frame['prediction']['dec_deg']==pytest.approx(20.,abs=1e-10)
        assert frame['prediction']['source']['epoch']=='J2000'
        assert 'observer_parallax' in frame['prediction']['omitted']
        assert 'full_covariance' in frame['prediction']['omitted']
