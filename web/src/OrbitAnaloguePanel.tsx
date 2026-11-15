import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {request} from './api';
import type {OuterTnoCatalog} from './OuterTnoPanel';
import type {PlanetNineOrbit} from './PlanetNineTypes';
import {rankOrbitAnalogues,ORBIT_ANALOGUE_RULE,type AnalogueSource} from './OrbitAnalogueMath';
import {orbitAnalogueCopy} from './OrbitAnalogueCopy';
import styles from './OrbitAnaloguePanel.module.css';
type Catalogue=OuterTnoCatalog&AnalogueSource;
export interface OrbitAnaloguePanelProps {language:string;orbit:PlanetNineOrbit;active?:boolean;onInspectKnownObject?:(objectId:string)=>void;selectedKnownObjectId?:string|null}

export default function OrbitAnaloguePanel({language,orbit,active=true,onInspectKnownObject,selectedKnownObjectId}:OrbitAnaloguePanelProps){
  const c=orbitAnalogueCopy(language),number=(value:number,digits=6)=>Number.isFinite(value)?value.toLocaleString(language,{maximumSignificantDigits:digits}):'—';
  const [method,setMethod]=useState<'catalogue'|'unidentified'>('catalogue');
  // App keeps this same immutable source query mounted. A second observer shares
  // both its in-flight request and its cached data; hiding this panel cannot
  // cancel the App observer's request or start a second 5 MB transfer.
  const source=useQuery({queryKey:['outer-tno-catalog'],queryFn:({signal})=>request<Catalogue>('/catalog/outer-tno',{signal}),enabled:active,retry:false,retryOnMount:false,staleTime:Infinity});
  const catalogue=source.data&&typeof source.data==='object'&&Array.isArray(source.data.objects)?source.data:null;
  const loading=source.isFetching&&!catalogue,error=source.isError||(source.data!=null&&!catalogue);
  const [clickedObject,setClickedObject]=useState<string|null>(null),currentObject=selectedKnownObjectId===undefined?clickedObject:selectedKnownObjectId;
  function inspect(objectId:string){setClickedObject(objectId);onInspectKnownObject?.(objectId);}
  const result=useMemo(()=>catalogue?rankOrbitAnalogues(orbit,catalogue.objects,catalogue,5):null,[catalogue,orbit.a_au,orbit.e,orbit.i_deg,orbit.epoch_jd_tdb]);
  const excluded=result?Object.values(result.excluded).reduce((sum,value)=>sum+value,0):0;
  return <section className={styles.panel} data-testid="p9-orbit-analogues" data-algorithm={ORBIT_ANALOGUE_RULE} data-display-limit="5" aria-labelledby="p9-orbit-analogue-title">
    <h2 id="p9-orbit-analogue-title">{c.title}</h2><p>{c.intro}</p>
    <details data-testid="p9-analogue-explanation"><summary>{c.explanationTitle}</summary><p>{c.explanation}</p><p>{c.repeated}</p><p>{c.next}</p></details>
    <label className={styles.method}>{c.methodLabel}<select data-testid="p9-analogue-method" value={method} onChange={event=>setMethod(event.target.value as typeof method)}><option value="catalogue">{c.catalogueMethod}</option><option value="unidentified">{c.unidentifiedMethod}</option></select></label>
    {method==='unidentified'?<div role="status" data-testid="p9-future-unidentified-sources"><h3>{c.futureTitle}</h3><p>{c.futureNote}</p><p>{c.futureSteps}</p><button data-testid="p9-analogue-return-catalogue" onClick={()=>setMethod('catalogue')}>{c.returnCatalogue}</button></div>:<>
    <p className={styles.note}>{c.knownNote}</p>
    <p data-testid="p9-analogue-target-epoch">{c.targetEpoch}: JD {number(orbit.epoch_jd_tdb,12)} · TDB · a {number(orbit.a_au)} au · e {number(orbit.e)} · i {number(orbit.i_deg)}°</p>
    {loading&&<p role="status">{c.loading}</p>}{error&&<p role="alert">{c.error} <button data-testid="p9-analogue-retry" disabled={source.isFetching} onClick={()=>void source.refetch({cancelRefetch:false})}>{c.retry}</button></p>}
    {result?.status==='invalid_hypothesis'&&<p role="alert">{c.invalidTarget}</p>}{result?.status==='unsupported_source'&&<p role="alert">{c.unsupportedFrame}</p>}
    {result?.status==='ready'&&<>
      <p data-testid="p9-analogue-count">{c.count}: {number(result.compared_count)} / {number(result.input_count)} · {c.excluded}: {number(excluded)}</p>
      <p data-testid="p9-analogue-exclusions">{c.missingElements}: {result.excluded.missing_elements} · {c.invalidElements}: {result.excluded.invalid_elements} · {c.invalidEpoch}: {result.excluded.invalid_epoch}</p>
      {result.rows.length===0?<p>{c.noRows}</p>:<div className={styles.tableWrap} role="region" aria-label={c.title} tabIndex={0}><table data-testid="p9-orbit-analogue-table" role="table"><thead><tr><th>{c.rank}</th><th>{c.object}</th><th>a (au)<br/>{c.relativeA}</th><th>e<br/>{c.deltaE}</th><th>i (°)<br/>{c.deltaI}</th><th>{c.score}</th><th>{c.epoch}</th><th>{c.inspect}</th></tr></thead><tbody>{result.rows.map((row,index)=>{const selected=currentObject===row.object.object_id||Boolean(row.object.known_object_id&&currentObject===row.object.known_object_id);return <tr key={row.object.object_id} data-testid={`p9-orbit-analogue-${index+1}`} data-object-id={row.object.object_id} data-spkid={row.object.spkid??''} data-selected={String(selected)}>
        <td className={styles.rank}><span className={styles.cellLabel}>{c.rank}</span><strong>#{index+1}</strong></td><th className={styles.object} scope="row"><button className={styles.name} disabled={!onInspectKnownObject} data-testid={`p9-analogue-name-${index+1}`} aria-current={selected?'true':undefined} onClick={()=>inspect(row.object.object_id)}>{row.object.name}</button><small>{row.object.object_id}<br/>SPK {row.object.spkid??'—'} · {row.object.pdes??'—'}</small></th>
        <td><span className={styles.cellLabel}>a (au)</span>{number(row.object.orbit!.a_au)}<small>|Δa|/aₕ = {number(row.relative_a_difference*100,4)}%</small></td><td><span className={styles.cellLabel}>e</span>{number(row.object.orbit!.e)}<small>|Δe| = {number(row.eccentricity_difference,4)}</small></td><td><span className={styles.cellLabel}>i (°)</span>{number(row.object.orbit!.i_deg)}°<small>|Δi| = {number(row.inclination_difference_deg,4)}°</small></td><td><span className={styles.cellLabel}>{c.score}</span>{number(row.score,5)}</td><td className={styles.epoch}><span className={styles.cellLabel}>{c.epoch}</span>JD {number(row.object.orbit!.epoch_jd_tdb,12)}<small>TDB</small></td>
        <td className={styles.actions}><button disabled={!onInspectKnownObject} data-testid={`p9-inspect-analogue-${index+1}`} onClick={()=>inspect(row.object.object_id)}>{c.inspect}</button><a href={`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(row.object.spkid??row.object.object_id)}`} target="_blank" rel="noreferrer">JPL SBDB ↗</a></td>
      </tr>;})}</tbody></table></div>}
    </>}
    <details><summary>{c.method}</summary><p><code>S = |a − aₕ| / aₕ + |e − eₕ| + |i − iₕ| / 180</code></p><p>a: au · i: ° · h: {c.targetEpoch}</p><p>{c.limitation}</p>{catalogue&&<><p>{c.source}: JPL SBDB · {catalogue.coordinate_frame} · {catalogue.time_scale}</p><p><a href="https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html" target="_blank" rel="noreferrer">JPL SBDB · {c.source} ↗</a></p><code className={styles.hash}>SHA256 {catalogue.source_manifest_sha256}</code></>}</details>
    </>}
  </section>;
}
