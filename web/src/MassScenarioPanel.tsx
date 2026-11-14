import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {request} from './api';
import styles from './MassScenarioPanel.module.css';
import {r029Copy} from './R029Copy';
import {restoredDensityInput,supportsDensityScenario} from './massScenarioDefaults';

interface Source {url:string;label?:string}
export interface MassScenarioInput {target_id:string;density_kg_m3:number;analogue_id:string|null;include_source_ranges:boolean}
export interface AppliedMassScenario {input:MassScenarioInput;source_manifest_sha256:string}
interface Target {name:string;radius_km:number;radius_low_km:number|null;radius_high_km:number|null;radius_definition:string;radius_source:Source;volume_assumption:string}
interface Analogue {object_id:string;name:string;radius_km:number;density_kg_m3:number;density_sigma_kg_m3:number|null;source:Source}
interface Catalogue {source_manifest_sha256:string;model:{density_input_min_kg_m3:number;density_input_max_kg_m3:number;earth_mass_kg:number;earth_mass_source:Source};targets:Record<string,Target>;analogues:Record<string,Analogue>;summary:{conditional_target_count_meets_model_range:number;source_analogue_parameter_corner_envelopes:Record<string,{can_meet_model_within_source_parameter_corners:boolean}>};limitations:string[]}
export interface MassScenarioResult {status:'hypothesis';radius_km:number;density_kg_m3:number;mass_kg:number;mass_earth:number;earth_mass_kg:number;mass_bounds:{low_earth:number;high_earth:number}|null;clearing:{minimum_mass_earth:number;pi:number;model_classification:string;required_density_for_model_kg_m3:number;required_density_exceeds_operating_max:boolean};inputs:MassScenarioInput;source_manifest_sha256:string}

/** One controller supplies compact criteria, the expanded editor and evidence input. */
export function useMassScenarioModel({objectId,saved,onApplied}:{objectId:string;saved?:AppliedMassScenario|null;onApplied?:(value:AppliedMassScenario)=>void}){
  const supported=supportsDensityScenario(objectId);
  const [requested,setRequested]=useState(false);
  const hasSaved=saved?.input.target_id===objectId;
  const active=supported&&(requested||hasSaved);
  const source=useQuery({queryKey:['mass-scenarios'],queryFn:({signal})=>request<Catalogue>('/mass-scenarios',{signal}),enabled:active,retry:false,staleTime:Infinity});
  const [input,setInput]=useState<MassScenarioInput|null>(null);
  const [lastValid,setLastValid]=useState<MassScenarioResult>();
  const [restored,setRestored]=useState(false);
  const lastInit=useRef(''),lastSaved=useRef(''),lastReported=useRef(''),callback=useRef(onApplied);callback.current=onApplied;
  useEffect(()=>{
    if(!source.data?.targets[objectId])return;
    const signature=objectId+source.data.source_manifest_sha256;
    const incoming=saved?JSON.stringify([saved.input,saved.source_manifest_sha256]):'';
    const first=lastInit.current!==signature;
    if(!first&&lastSaved.current===incoming)return;
    lastInit.current=signature;lastSaved.current=incoming;
    const old=restoredDensityInput(objectId,source.data,saved);
    if(old&&incoming!==lastReported.current){setInput(old);setRestored(true);}
    else if(first){setInput(null);setLastValid(undefined);setRestored(false);}
  },[source.data,objectId,saved]);
  const result=useQuery({queryKey:['mass-scenario-result',source.data?.source_manifest_sha256,input],queryFn:({signal})=>request<MassScenarioResult>('/mass-scenarios/calculate',{method:'POST',signal,body:JSON.stringify(input)}),enabled:active&&input?.target_id===objectId&&source.data!==undefined,retry:false,staleTime:Infinity});
  const current=result.data?.source_manifest_sha256===source.data?.source_manifest_sha256&&result.data?.inputs.target_id===objectId?result.data:undefined;
  const value=current??(lastValid?.source_manifest_sha256===source.data?.source_manifest_sha256&&lastValid?.inputs.target_id===objectId?lastValid:undefined);
  useEffect(()=>{if(!current)return;setLastValid(current);const signature=JSON.stringify([current.inputs,current.source_manifest_sha256]);if(lastReported.current===signature)return;lastReported.current=signature;callback.current?.({input:current.inputs,source_manifest_sha256:current.source_manifest_sha256});},[current]);
  return {objectId,supported,source,result,input,setInput:(value:MassScenarioInput|null)=>{setRestored(false);setInput(value);},value,active,restored,request:()=>setRequested(true)};
}
export type MassScenarioModel=ReturnType<typeof useMassScenarioModel>;

export default function MassScenarioPanel({objectId,labels={},model,openRequest=0}:{objectId:string;labels?:Record<string,string>;model:MassScenarioModel;openRequest?:number}){
  const {t,i18n}=useTranslation(),copy=r029Copy(i18n.language);
  const {supported,source,result,input,setInput,value}=model;
  const [draft,setDraft]=useState(String(input?.density_kg_m3??''));
  const [invalid,setInvalid]=useState(false),[onlyMeeting,setOnlyMeeting]=useState(false);
  const [expanded,setExpanded]=useState(false),[includeRanges,setIncludeRanges]=useState(true);
  const densityInput=useRef<HTMLInputElement>(null),focusedRequest=useRef(0);
  const data=source.data,target=data?.targets[objectId];
  useEffect(()=>{if(input){setDraft(String(input.density_kg_m3));setIncludeRanges(input.include_source_ranges);}},[input?.density_kg_m3,input?.include_source_ranges]);
  useEffect(()=>{if(model.restored)setExpanded(true);},[model.restored]);
  useEffect(()=>{if(openRequest>0)setExpanded(true);},[openRequest]);
  useEffect(()=>{
    if(openRequest<=0||focusedRequest.current===openRequest||!expanded||!target||!densityInput.current)return;
    focusedRequest.current=openRequest;
    densityInput.current.focus({preventScroll:true});
    densityInput.current.scrollIntoView({block:'center',behavior:'auto'});
  },[openRequest,expanded,target]);
  if(!supported)return null;
  const number=(value:number)=>value.toLocaleString(i18n.language,{maximumSignificantDigits:6});
  const scientific=(value:number)=>value.toLocaleString(i18n.language,{notation:'scientific',maximumSignificantDigits:6});
  const appliedAnalogue=value?.inputs.analogue_id?data?.analogues[value.inputs.analogue_id]:undefined;
  function apply(){
    if(!data)return;
    const density=Number(draft);
    if(!draft.trim()||!Number.isFinite(density)||density<data.model.density_input_min_kg_m3||density>data.model.density_input_max_kg_m3){setInvalid(true);return;}
    setInvalid(false);
    const analogue=input?.analogue_id&&data.analogues[input.analogue_id]?.density_kg_m3===density?input.analogue_id:null;
    setInput({target_id:objectId,density_kg_m3:density,analogue_id:analogue,include_source_ranges:includeRanges});
  }
  return <details className={styles.panel} data-testid="mass-scenario-panel" data-object-id={objectId} open={expanded} onToggle={event=>{const open=event.currentTarget.open;setExpanded(open);if(open)model.request();}}>
    <summary data-testid="mass-scenario-toggle">{copy.optionalTitle}</summary>
    <h2>{copy.calculateCurrentMass}</h2><p className={styles.notice}>{copy.optionalHelp}</p><p>{t('massScenarioNote')}</p>
    <code className={styles.unitFormula} data-testid="mass-unit-formula">M / M⊕ = ρ[kg/m³] × (4π/3) × (R[km] × 1000)³ / M⊕[kg]</code>
    {model.restored&&<p data-testid="mass-restored-assumption">{copy.restoredAssumption}</p>}
    {model.active&&source.isPending&&<p role="status">{t('massLoading')}</p>}
    {(source.isError||result.isError)&&<p role="alert">{t('massError')} <button onClick={()=>{if(source.isError)void source.refetch();else void result.refetch();}}>{t('retry')}</button></p>}
    {target&&data&&<><form onSubmit={event=>{event.preventDefault();apply();}}>
      <label>{copy.exampleLabel}<select data-testid="mass-analogue" value={input?.analogue_id??''} onChange={event=>{
        const id=event.target.value;
        if(!id){if(input)setInput({...input,analogue_id:null});return;}
        const density=data.analogues[id].density_kg_m3;
        setDraft(String(density));setInvalid(false);setInput({target_id:objectId,analogue_id:id,density_kg_m3:density,include_source_ranges:includeRanges});
      }}><option value="">{copy.chooseExample}</option>{Object.entries(data.analogues).map(([id,analogue])=><option key={id} value={id}>{labels[analogue.object_id]??analogue.name} · {number(analogue.density_kg_m3)} kg/m³</option>)}</select></label>
      <label>{t('massDensity')}<input ref={densityInput} data-testid="mass-density" type="number" min={data.model.density_input_min_kg_m3} max={data.model.density_input_max_kg_m3} step="any" placeholder={copy.densityPlaceholder} value={draft} aria-invalid={invalid} onChange={event=>setDraft(event.target.value)} onBlur={()=>{if(draft.trim()||input)apply();}}/></label><button type="submit">{t('massApply')}</button>
      <label className={styles.checkbox}><input data-testid="mass-include-ranges" type="checkbox" checked={includeRanges} onChange={event=>{const checked=event.target.checked;setIncludeRanges(checked);if(input)setInput({...input,include_source_ranges:checked});}}/>{t('massRanges')}</label>
      {invalid&&<p role="alert">{t('massInvalid')}</p>}
    </form><p data-testid="mass-analogue-explanation">{copy.exampleHelp} <a href="https://science.nasa.gov/saturn/moons/tethys/" target="_blank" rel="noreferrer">NASA · {labels['moon-603']??'Tethys'} ↗</a></p>
    <p className={styles.adoptedInput} data-testid="mass-adopted-radius">{copy.adoptedRadius}: R = {number(target.radius_km)} km <a href={target.radius_source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a>{target.radius_low_km===null&&<> · {t('massBoundUnavailable')}</>}</p>
    <p data-testid="mass-earth-conversion">1 M⊕ = {scientific(data.model.earth_mass_kg)} kg <a href={data.model.earth_mass_source.url} target="_blank" rel="noreferrer">{t('source')} · JPL ↗</a></p>
    {!input&&<p data-testid="mass-no-assumption" className={styles.notice}>{copy.noAssumption}</p>}
    {result.isFetching&&<p role="status">{t('massLoading')}</p>}
    {value&&<div className={styles.result} data-testid="mass-scenario-result" data-status="hypothesis" data-source-sha256={value.source_manifest_sha256}>
      <strong>{copy.currentMassHypothesis}: ≈ <output data-testid="mass-estimate-earth">{number(value.mass_earth)} M⊕</output></strong>
      <p className={styles.kilograms} data-testid="mass-estimate-kg">≈ {scientific(value.mass_kg)} kg</p>
      <p className={styles.appliedInputs} data-testid="mass-applied-inputs">R = {number(value.radius_km)} km · ρ = {number(value.density_kg_m3)} kg/m³</p>
      <p data-testid="mass-density-provenance">{appliedAnalogue?<a href={appliedAnalogue.source.url} target="_blank" rel="noreferrer">{labels[appliedAnalogue.object_id]??appliedAnalogue.name} · {copy.borrowedDensity} ↗</a>:copy.manualDensity}</p>
      {value.mass_bounds&&<p data-testid="mass-parameter-range">{t('massParameterRange')}: {number(value.mass_bounds.low_earth)}–{number(value.mass_bounds.high_earth)} M⊕</p>}
      <p>Π = <output data-testid="mass-scenario-pi">{number(value.clearing.pi)}</output> · {t(`criteria_${value.clearing.model_classification}`)}</p><p>{t('massRequiredDensity')}: {number(value.clearing.required_density_for_model_kg_m3)} kg/m³</p>
      {value.clearing.required_density_exceeds_operating_max&&<p className={styles.notice}>{t('massBeyondInputRange')}</p>}<p>{t('massMeasuredUnchanged')}</p>
    </div>}
    <p className={styles.notice}>{t('massModelWarning')}</p><p>{t('massSurveyScope')}</p><label className={styles.checkbox}><input data-testid="mass-candidate-filter" type="checkbox" checked={onlyMeeting} onChange={event=>setOnlyMeeting(event.target.checked)}/>{t('massCandidateFilter')}</label>
    <p>{t('massConditionalCount',{count:data.summary.conditional_target_count_meets_model_range})}</p>
    <div data-testid="mass-conditional-targets">{Object.entries(data.targets).filter(([id])=>!onlyMeeting||data.summary.source_analogue_parameter_corner_envelopes[id].can_meet_model_within_source_parameter_corners).map(([id,item])=><span key={id} data-target-id={id}>{labels[id]??item.name} </span>)}{onlyMeeting&&data.summary.conditional_target_count_meets_model_range===0&&<p>{t('massEmpty')}</p>}</div>
    <details><summary>{t('massSourceAssumptions')}</summary><p lang="en">{target.radius_definition}</p><p lang="en">{target.volume_assumption}</p>{input?.analogue_id&&<a href={data.analogues[input.analogue_id].source.url} target="_blank" rel="noreferrer">{t('source')} · NASA/JPL ↗</a>}{data.limitations.map((note,index)=><p key={index} lang="en">{note}</p>)}</details>
    </>}
  </details>;
}
