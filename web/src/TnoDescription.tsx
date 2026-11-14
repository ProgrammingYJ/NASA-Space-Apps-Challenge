import {useTranslation} from 'react-i18next';
import type {OuterTnoObject} from './OuterTnoPanel';
import {tnoDescriptionCopy} from './TnoDescriptionCopy';
import styles from './UniverseShell.module.css';

export type TnoDesignationType='permanent_number'|'provisional_designation'|'asteroid_comet_style'|'catalogue_designation';
export interface TnoInformation {
  schema_version:'1.0';algorithm_version:'jpl-tno-factual-description-v1';object_id:string;
  record_kind:'observed_catalogue_small_body';prose_origin:'source_bound_factual_summary_not_official_encyclopaedic_prose';
  designation:{value:string;type:TnoDesignationType;iau_name:string|null;jpl_kind:'an'|'au'|'cn'|'cu';prefix:string|null};
  orbit_class:{code:'TNO';definition:'semimajor_axis_au_greater_than_30_1';iau_planet_status_inferred:false};
  orbit_facts:{period_days:number|null;period_julian_years:number|null;elements_epoch_jd_tdb:number|null};
  observations:{first_used:string|null;last_used:string|null;arc_days:number|null;count:number|null;condition_code:string|null;normalized_rms:number|null;normalized_rms_unit:'dimensionless';dates_are_discovery_dates:false};
  uncertainty:{highly_uncertain_condition:boolean;sigma_a_au:number|null;sigma_a_at_least_nominal_a:boolean|null;propagated_position_covariance:null;verified_long_term_precision:false};
  reported_in_this_snapshot:{diameter:boolean;mass:boolean;density:boolean;rotation_period:boolean};
  marker:{kind:'calculated_navigation_marker';resolved_photo:false;physical_radius:false;measured_brightness:false};
  provenance:{url:string;sha256:string;bytes:number;received_at_utc:string;api_version:string;snapshot_manifest_sha256:string;matching_policy:string};
  references:{id:'sbdb_fields'|'orbit_class'|'designation';url:string}[];
}
function finite(value:unknown){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;}
export function tnoDescriptionFacts(data:OuterTnoObject){
  const designation=data.info?.designation.value??data.pdes??data.name;
  const fallbackType:TnoDesignationType=/^[0-9]+$/.test(designation)?'permanent_number':/^[0-9]{4} [A-Z]{2}[0-9]*$/.test(designation)?'provisional_designation':'catalogue_designation';
  const a=finite(data.semimajor_axis_au),sigma=finite(data.quality.one_sigma_elements?.sigma_a),period=finite(data.source_fields?.per);
  return {designation,designationType:data.info?.designation.type??fallbackType,
    highUncertainty:data.info?data.info.uncertainty.highly_uncertain_condition||data.info.uncertainty.sigma_a_at_least_nominal_a===true:data.quality.condition_code==='9'||(a!==null&&sigma!==null&&sigma>=a),
    absoluteMagnitude:finite(data.source_fields?.H),periodYears:data.info?.orbit_facts.period_julian_years??(period===null?null:period/365.25)};
}
export function TnoDescription({data}:{data:OuterTnoObject}){
  const {i18n}=useTranslation(),copy=tnoDescriptionCopy(i18n.language),facts=tnoDescriptionFacts(data);
  const number=(value:number|null)=>value===null?copy.unknown:value.toLocaleString(i18n.language,{maximumSignificantDigits:6});
  const designationText={permanent_number:copy.numbered,provisional_designation:copy.provisional,asteroid_comet_style:copy.asteroidCometStyle,catalogue_designation:copy.otherDesignation}[facts.designationType];
  return <section className={styles.appearanceInfo} data-testid="tno-description">
    <strong>{copy.title}</strong><p data-testid="outer-tno-classification">{copy.smallBody} · {copy.className}</p><p>{copy.classNote}</p>
    <p data-testid="tno-designation-explanation"><code>{facts.designation}</code> · {designationText}</p>
    <p data-testid="tno-marker-explanation">{copy.marker}</p>
    {facts.highUncertainty&&<p className={styles.mapNotice} role="status" data-testid="tno-high-uncertainty"><strong>{copy.highUncertainty}</strong><br/>{copy.uncertainty}</p>}
    <details><summary>{copy.sourceDetails}</summary><p>{copy.factualSummary}</p><p>{copy.snapshotScope}</p><p>{copy.conditionScale}</p><p>{copy.observations}: {data.quality.first_observation??copy.unknown} → {data.quality.last_observation??copy.unknown}</p><p>{copy.notDiscovery}</p>
      <p>{copy.period}: {number(facts.periodYears)} {copy.julianYears}</p><p>{copy.absoluteMagnitude}: {number(facts.absoluteMagnitude)}</p><p>{copy.absoluteMagnitudeNote}</p>
      {data.info?<><p>{copy.identitySource}: <a href={data.info.provenance.url} target="_blank" rel="noreferrer">JPL SBDB Query ↗</a></p><p>{copy.received}: {data.info.provenance.received_at_utc}</p><code>SHA256 {data.info.provenance.sha256}</code></>:<p>{copy.sourceNotAvailable}</p>}
      <p><a href="https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html" target="_blank" rel="noreferrer">{copy.sourceFields} ↗</a> · <a href="https://ssd-api.jpl.nasa.gov/doc/sbdb_filter.html" target="_blank" rel="noreferrer">{copy.sourceClass} ↗</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/designations/" target="_blank" rel="noreferrer">{copy.sourceDesignation} ↗</a></p>
    </details>
  </section>;
}
