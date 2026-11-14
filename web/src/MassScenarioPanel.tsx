import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {request} from './api';
import styles from './MassScenarioPanel.module.css';

interface Source {url:string;label?:string}
export interface MassScenarioInput {target_id:string;density_kg_m3:number;analogue_id:string|null;include_source_ranges:boolean}
export interface AppliedMassScenario {input:MassScenarioInput;source_manifest_sha256:string}
interface Target {name:string;radius_km:number;radius_low_km:number|null;radius_high_km:number|null;radius_definition:string;radius_source:Source;volume_assumption:string}
interface Analogue {object_id:string;name:string;radius_km:number;density_kg_m3:number;density_sigma_kg_m3:number|null;source:Source}
interface Catalogue {source_manifest_sha256:string;model:{density_input_min_kg_m3:number;density_input_max_kg_m3:number};targets:Record<string,Target>;analogues:Record<string,Analogue>;summary:{conditional_target_count_meets_model_range:number;source_analogue_parameter_corner_envelopes:Record<string,{can_meet_model_within_source_parameter_corners:boolean}>};limitations:string[]}
interface Result {status:'hypothesis';radius_km:number;density_kg_m3:number;mass_kg:number;mass_earth:number;mass_bounds:{low_earth:number;high_earth:number}|null;clearing:{minimum_mass_earth:number;pi:number;model_classification:string;required_density_for_model_kg_m3:number;required_density_exceeds_operating_max:boolean};inputs:MassScenarioInput;source_manifest_sha256:string}
const ids=new Set(['sedna','eris','makemake','quaoar','orcus','gonggong']);

export default function MassScenarioPanel({objectId,labels={},saved,onApplied}:{objectId:string;labels?:Record<string,string>;saved?:AppliedMassScenario|null;onApplied?:(value:AppliedMassScenario)=>void}){
  const {t,i18n}=useTranslation();const supported=ids.has(objectId);
  const source=useQuery({queryKey:['mass-scenarios'],queryFn:({signal})=>request<Catalogue>('/mass-scenarios',{signal}),enabled:supported,retry:false,staleTime:Infinity});
  const [input,setInput]=useState<MassScenarioInput|null>(null);const [draft,setDraft]=useState('');const [invalid,setInvalid]=useState(false);const [onlyMeeting,setOnlyMeeting]=useState(false);
  const lastInit=useRef(''),lastReported=useRef(''),callback=useRef(onApplied);callback.current=onApplied;
  useEffect(()=>{if(!source.data?.targets[objectId])return;const signature=objectId+source.data.source_manifest_sha256;if(lastInit.current===signature)return;lastInit.current=signature;
    const old=saved?.input.target_id===objectId&&saved.source_manifest_sha256===source.data.source_manifest_sha256?saved.input:null;
    const chosen=old??{target_id:objectId,density_kg_m3:source.data.analogues.tethys.density_kg_m3,analogue_id:'tethys',include_source_ranges:true};setInput({...chosen,analogue_id:chosen.analogue_id??null});setDraft(String(chosen.density_kg_m3));setInvalid(false);
  },[source.data,objectId,saved]);
  const result=useQuery({queryKey:['mass-scenario-result',source.data?.source_manifest_sha256,input],queryFn:({signal})=>request<Result>('/mass-scenarios/calculate',{method:'POST',signal,body:JSON.stringify(input)}),enabled:supported&&input!==null&&source.data!==undefined,retry:false,staleTime:Infinity});
  const value=result.data?.source_manifest_sha256===source.data?.source_manifest_sha256&&result.data?.inputs.target_id===objectId?result.data:undefined;
  useEffect(()=>{if(!value)return;const signature=JSON.stringify([value.inputs,value.source_manifest_sha256]);if(lastReported.current===signature)return;lastReported.current=signature;callback.current?.({input:value.inputs,source_manifest_sha256:value.source_manifest_sha256});},[value]);
  if(!supported)return null;
  const data=source.data,target=data?.targets[objectId];const number=(value:number)=>value.toLocaleString(i18n.language,{maximumSignificantDigits:6});
  function apply(){const density=Number(draft);if(!draft.trim()||!Number.isFinite(density)||density<100||density>10000){setInvalid(true);return;}setInvalid(false);setInput(previous=>({target_id:objectId,density_kg_m3:density,analogue_id:previous?.analogue_id&&data?.analogues[previous.analogue_id].density_kg_m3===density?previous.analogue_id:null,include_source_ranges:previous?.include_source_ranges??true}));}
  return <section className={styles.panel} data-testid="mass-scenario-panel" data-object-id={objectId}>
    <h2>{t('massScenarioTitle')}</h2><p className={styles.notice}>{t('massScenarioNote')}</p><code>M = ρ · (4π/3) · R³</code>
    {source.isPending&&<p role="status">{t('massLoading')}</p>}
    {(source.isError||result.isError)&&<p role="alert">{t('massError')} <button onClick={()=>{if(source.isError)void source.refetch();else void result.refetch();}}>{t('retry')}</button></p>}
    {target&&data&&input&&<><form onSubmit={event=>{event.preventDefault();apply();}}>
      <label>{t('massAnalogue')}<select data-testid="mass-analogue" value={input.analogue_id??''} onChange={event=>{const id=event.target.value;if(!id)return;const density=data.analogues[id].density_kg_m3;setDraft(String(density));setInvalid(false);setInput({...input,analogue_id:id,density_kg_m3:density});}}><option value="">{t('massCustom')}</option>{Object.entries(data.analogues).map(([id,analogue])=><option key={id} value={id}>{labels[analogue.object_id]??analogue.name} · {number(analogue.density_kg_m3)} kg/m³</option>)}</select></label>
      <label>{t('massDensity')}<input data-testid="mass-density" type="number" min="100" max="10000" step="any" value={draft} aria-invalid={invalid} onChange={event=>setDraft(event.target.value)} onBlur={apply}/></label><button type="submit">{t('massApply')}</button>
      <label className={styles.checkbox}><input data-testid="mass-include-ranges" type="checkbox" checked={input.include_source_ranges} onChange={event=>{const checked=event.target.checked;setInput(previous=>previous?{...previous,include_source_ranges:checked}:previous);}}/>{t('massRanges')}</label>
      {invalid&&<p role="alert">{t('massInvalid')}</p>}
    </form><p>{t('massRadius')}: {number(target.radius_km)} km <a href={target.radius_source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a>{target.radius_low_km===null&&<> · {t('massBoundUnavailable')}</>}</p>
    {result.isFetching&&<p role="status">{t('massLoading')}</p>}
    {value&&<div className={styles.result} data-testid="mass-scenario-result" data-status="hypothesis" data-source-sha256={value.source_manifest_sha256}>
      <strong>{t('massEstimate')}: <output data-testid="mass-estimate-earth">{number(value.mass_earth)} M⊕</output> · {number(value.mass_kg)} kg</strong>
      {value.mass_bounds&&<p data-testid="mass-parameter-range">{t('massParameterRange')}: {number(value.mass_bounds.low_earth)}–{number(value.mass_bounds.high_earth)} M⊕</p>}
      <p>Π = <output data-testid="mass-scenario-pi">{number(value.clearing.pi)}</output> · {t(`criteria_${value.clearing.model_classification}`)}</p><p>{t('massRequiredDensity')}: {number(value.clearing.required_density_for_model_kg_m3)} kg/m³</p>
      {value.clearing.required_density_exceeds_operating_max&&<p className={styles.notice}>{t('massBeyondInputRange')}</p>}<p>{t('massMeasuredUnchanged')}</p>
    </div>}
    <p className={styles.notice}>{t('massModelWarning')}</p><p>{t('massSurveyScope')}</p><label className={styles.checkbox}><input data-testid="mass-candidate-filter" type="checkbox" checked={onlyMeeting} onChange={event=>setOnlyMeeting(event.target.checked)}/>{t('massCandidateFilter')}</label>
    <p>{t('massConditionalCount',{count:data.summary.conditional_target_count_meets_model_range})}</p>
    <div data-testid="mass-conditional-targets">{Object.entries(data.targets).filter(([id])=>!onlyMeeting||data.summary.source_analogue_parameter_corner_envelopes[id].can_meet_model_within_source_parameter_corners).map(([id,item])=><span key={id} data-target-id={id}>{labels[id]??item.name} </span>)}{onlyMeeting&&data.summary.conditional_target_count_meets_model_range===0&&<p>{t('massEmpty')}</p>}</div>
    <details><summary>{t('massSourceAssumptions')}</summary><p lang="en">{target.radius_definition}</p><p lang="en">{target.volume_assumption}</p>{input.analogue_id&&<a href={data.analogues[input.analogue_id].source.url} target="_blank" rel="noreferrer">{t('source')} · NASA/JPL ↗</a>}{data.limitations.map((note,index)=><p key={index} lang="en">{note}</p>)}</details>
    </>}
  </section>;
}
