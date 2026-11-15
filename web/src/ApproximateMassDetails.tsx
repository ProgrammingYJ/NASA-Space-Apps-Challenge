import type {ApproximateMassResult} from './ApproximateMassMath';
import {APPROXIMATE_EARTH_MASS_KG,SIZE_FORMULA_SOURCE} from './ApproximateMassMath';
import {approximateMassCopy} from './ApproximateMassCopy';
import styles from './ApproximateMassDetails.module.css';

export default function ApproximateMassDetails({objectId,value,language,expanded=false}:{objectId:string;value:ApproximateMassResult;language:string;expanded?:boolean}){
  const c=approximateMassCopy(language),number=(v:number)=>v.toLocaleString(language,{maximumSignificantDigits:6}),estimate=(v:number)=>v.toLocaleString(language,{maximumSignificantDigits:3}),scientific=(v:number)=>v.toLocaleString(language,{notation:'scientific',maximumSignificantDigits:3});
  if(value.kind==='measured'||value.kind==='hypothesis')return null;
  const content=value.kind==='unavailable'?<p data-testid="approximate-mass-missing-reason">{c[value.reason??'no_size_or_h']}</p>:<>
    <strong data-testid="approximate-mass-value">≈ {estimate(value.mass_earth!)} M⊕</strong><p data-testid="approximate-mass-kg">≈ {scientific(value.mass_kg!)} kg · {c.estimate}</p>
    <p>{c.note}</p><dl><div><dt>{c.diameter}</dt><dd>{value.diameter_source==='h_albedo'?`≈ ${estimate(value.diameter_km!)}`:number(value.diameter_km!)} km · {c[value.diameter_source!]}</dd></div><div><dt>{c.density}</dt><dd>{number(value.density_kg_m3!)} kg/m³</dd></div>
    {value.absolute_magnitude_h!==null&&<><div><dt>{c.H}</dt><dd>{number(value.absolute_magnitude_h)}</dd></div><div><dt>{c.albedo}</dt><dd>{number(value.albedo!)} · {c[value.albedo_source!]}</dd></div></>}</dl>
    <div data-testid="approximate-mass-formula">{value.diameter_source==='h_albedo'&&<><code>D[km] = 1329 / √pV × 10<sup>−H/5</sup></code><p>{c.band}</p><a data-testid="approximate-mass-formula-source-link" href={SIZE_FORMULA_SOURCE} target="_blank" rel="noreferrer">{c.formula} ↗</a></>}
    <code>M[kg] = (π/6) × ρ[kg/m³] × (D[km] × 1000)³</code></div><p>{c.conversion}: 1 M⊕ = {APPROXIMATE_EARTH_MASS_KG.toLocaleString(language,{notation:'scientific',maximumSignificantDigits:6})} kg</p>
    <p>{c.uncertainty}</p>
  </>;
  const attrs={'data-testid':'approximate-mass-details','data-object-id':objectId,'data-mass-kind':value.kind,'data-size-origin':value.diameter_source??'unavailable','data-algorithm-version':value.algorithm_version,'data-mass-earth':value.mass_earth??'','data-mass-kg':value.mass_kg??'','data-diameter-km':value.diameter_km??'','data-density-kg-m3':value.density_kg_m3??'','data-albedo':value.albedo??'','data-absolute-magnitude':value.absolute_magnitude_h??'','data-source-sha256':value.source_manifest_sha256??''};
  const source=<>{value.source_url&&<a data-testid="approximate-mass-source-link" href={value.source_url} target="_blank" rel="noreferrer">{c.source} ↗</a>}{value.source_manifest_sha256&&<p className={styles.hash}>SHA256 {value.source_manifest_sha256}</p>}</>;
  return expanded?<section {...attrs} className={styles.details}><h3>{value.kind==='unavailable'?c.unavailable:c.title}</h3>{content}{source}</section>:<details {...attrs} className={styles.details}><summary>{c.details} · {value.kind==='unavailable'?c.unavailable:c.estimate}</summary>{content}{source}</details>;
}
