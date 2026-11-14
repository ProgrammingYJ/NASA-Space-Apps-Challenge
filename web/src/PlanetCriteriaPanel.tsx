import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import MassScenarioPanel,{useMassScenarioModel,type AppliedMassScenario} from './MassScenarioPanel';
import styles from './PlanetCriteriaPanel.module.css';

import type {OuterTnoObject} from './OuterTnoPanel';
import {outerObjectMatches,resolvePlanetCriteriaObject} from './PlanetCriteriaAdapter';
import type {PlanetCriterion,PlanetCriterionObject,PlanetCriteriaCatalogue} from './PlanetCriteriaAdapter';
import {r029Copy} from './R029Copy';
import {canOpenDensityCalculator} from './massScenarioDefaults';
export type {PlanetCriterionObject,PlanetCriteriaCatalogue} from './PlanetCriteriaAdapter';

const supported=new Set(['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','ceres','haumea','makemake','eris','sedna','quaoar','orcus','gonggong']);
export const hasPlanetCriteria=(id:string)=>supported.has(id);

function OrbitDiagram({object}:{object:PlanetCriterionObject}){
  const {t,i18n}=useTranslation(),copy=r029Copy(i18n.language);const {semimajor_axis_au:a,eccentricity:e,perihelion_au:q,aphelion_au:Q}=object.orbit;
  if(typeof a!=='number'||!Number.isFinite(a)||a<=0||typeof e!=='number'||!Number.isFinite(e)||e<0||e>=1)return <p className={styles.notice} data-testid="criteria-orbit-unavailable">{copy.noEllipse}</p>;
  const rx=220,ry=rx*Math.sqrt(1-e*e),sun=-rx*e;
  const format=(value:number|null)=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString(i18n.language,{maximumSignificantDigits:5}):t('unknown');
  return <figure className={styles.orbit} data-testid="criteria-orbit-diagram" data-semimajor-au={a} data-eccentricity={e} data-sun-focus-x={sun}>
    <svg viewBox="-280 -255 560 525" role="img" aria-label={t('criteriaOrbitDiagram')}>
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill="none" stroke="#90bada" strokeWidth="2"/>
      <line x1="-240" y1="0" x2="240" y2="0" stroke="#3a526b" strokeDasharray="4 5"/>
      <circle cx={sun} cy="0" r="6" fill="#ffda85"/><text x={sun} y="-16" textAnchor="middle" fill="#ffda85">{t('criteriaSun')}</text>
      <circle cx="0" cy="0" r="3" fill="#b5c5d9"/><text x="0" y="21" textAnchor="middle">{t('criteriaCenter')}</text>
      <path d={`M0 33 V43 H${rx} V33`} fill="none" stroke="#ffb181" strokeWidth="2"/><text x={rx/2} y="65" textAnchor="middle" fill="#ffb181">a = {format(a)} au</text>
      <line x1={-rx} y1="-55" x2={sun} y2="-55" stroke="#96d4c4"/><text x={(-rx+sun)/2} y="-68" textAnchor="middle" fill="#96d4c4">q</text>
      <line x1={sun} y1="-100" x2={rx} y2="-100" stroke="#9ea6df"/><text x={(sun+rx)/2} y="-113" textAnchor="middle" fill="#b9bff1">Q</text>
    </svg>
    <figcaption>{t('criteriaOrbitDiagram')}<br/>{t('criteriaSemimajorNote')}</figcaption>
    <dl><div><dt>{t('criteriaPerihelion')}</dt><dd>{format(q)} au</dd></div><div><dt>{t('criteriaAphelion')}</dt><dd>{format(Q)} au</dd></div></dl>
  </figure>;
}

export default function PlanetCriteriaPanel({objectId,name,catalogue,loading,error,onRetry,labels,massScenario,onMassScenarioChange,outerObject}:{objectId:string;name:string;catalogue?:PlanetCriteriaCatalogue;loading:boolean;error:boolean;onRetry:()=>void;labels?:Record<string,string>;massScenario?:AppliedMassScenario|null;onMassScenarioChange?:(value:AppliedMassScenario)=>void;outerObject?:OuterTnoObject}){
  const {t,i18n}=useTranslation(),copy=r029Copy(i18n.language);
  const [expanded,setExpanded]=useState(false),dialog=useRef<HTMLDivElement>(null);
  const [massEditorRequest,setMassEditorRequest]=useState(0),opener=useRef<HTMLElement|null>(null);
  const object=resolvePlanetCriteriaObject(catalogue,objectId,outerObject);
  const applicable=hasPlanetCriteria(objectId)||outerObjectMatches(objectId,outerObject);
  const generic=object?.is_generic_tno===true;
  const modelObjectId=object?.object_id??objectId;
  const massModel=useMassScenarioModel({objectId:modelObjectId,saved:massScenario,onApplied:onMassScenarioChange});
  useEffect(()=>{setExpanded(false);setMassEditorRequest(0);},[objectId]);
  useEffect(()=>{
    if(!expanded)return;
    const previous=opener.current??document.querySelector<HTMLElement>('[data-testid="open-planet-criteria"]');
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setExpanded(false);}
      if(event.key==='Tab'){
        const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],summary,input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')??[]).filter(element=>element.getClientRects().length>0);
        if(!items.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('keydown',key);previous?.focus();};
  },[expanded]);
  const number=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString(i18n.language,{maximumSignificantDigits:5}):t('unknown');
  const assumed=object?.mass.earth_masses===null&&massModel.value&&Number.isFinite(massModel.value.mass_earth)?massModel.value:undefined;
  const massLine=object?assumed?t('criteriaMinimumMassHypothesis',{minimum:number(object.clearing.minimum_mass_earth),current:number(assumed.mass_earth)}):t('criteriaMinimumMass',{minimum:number(object.clearing.minimum_mass_earth),current:object.mass.earth_masses===null?t('criteriaMassUnknown'):`${number(object.mass.earth_masses)} M⊕`}):'';
  const massNote=assumed?t('criteriaMassAssumption',{density:number(assumed.density_kg_m3)}):null;
  const canCalculate=canOpenDensityCalculator(modelObjectId,object?.mass.earth_masses);
  function openCriteria(launcher:HTMLElement,focusDensity=false){
    opener.current=launcher;
    setMassEditorRequest(value=>focusDensity?value+1:0);
    if(focusDensity)massModel.request();
    setExpanded(true);
  }
  function reason(row:PlanetCriterion){
    if(!generic)return t(`criteriaReason_${row.reason_key}`);
    return row.reason_key==='r029_solar_orbit'?copy.solarOrbit:row.reason_key==='r029_solar_unknown'?copy.solarUnknown:row.reason_key==='r029_shape_unknown'?copy.shapeUnknown:copy.dominanceUnknown;
  }
  function rows(full:boolean){return object?.criteria.map(row=><div key={row.id} className={styles.criterion} data-testid={`criterion-${row.id}`} data-status={row.status}>
    <div><strong>{t(`criteria_${row.id}`)}</strong><span className={styles.badge} data-status={row.status}>{row.status==='met'?'✓':row.status==='not_met'?'×':'—'} {t(`criteriaStatus_${row.status}`)}</span></div>
    {row.id==='orbital_dominance'&&<><p className={styles.mass} data-testid="criteria-minimum-mass" data-current-mass-kind={assumed?'hypothesis':object.mass.earth_masses===null?'unavailable':'measured'} data-current-mass-earth={assumed?.mass_earth??object.mass.earth_masses??''} data-applied-density={assumed?.density_kg_m3??''}>{massLine}</p>{massNote&&<p className={styles.notice} data-testid="criteria-mass-assumption">{massNote}</p>}<p className={styles.modelLabel}>{t('criteriaModelLabel')} · {t('criteriaEarthMassUnit')}</p>{object.system_mass&&<p data-testid="criteria-system-mass">{t('criteriaSystemMass',{mass:number(object.system_mass.earth_masses)})}<br/>{t('criteriaSystemMassNote')}{full&&<a href={object.system_mass.source.url} target="_blank" rel="noreferrer"> {t('source')} ↗</a>}</p>}</>}
    {full&&<p>{reason(row)} <a href={row.source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a></p>}
  </div>);}
  return <section className={styles.card} data-testid="planet-criteria-card" data-object-id={objectId} data-generic-tno={generic}>
    <h2>{t('criteriaTitle')}</h2>
    {!applicable?<p data-testid="criteria-not-applicable">{t('criteriaNotApplicable')}</p>:error?<p role="alert">{t('criteriaError')} <button onClick={onRetry}>{t('retry')}</button></p>:loading||!object?<p role="status">{t('loading')}</p>:<>
      {rows(false)}
      {canCalculate&&<button className={styles.massAction} data-testid="open-mass-calculator" aria-haspopup="dialog" onClick={event=>openCriteria(event.currentTarget,true)}>{copy.calculateCurrentMass} ↗</button>}
      {object.mass.earth_masses===null&&massModel.active&&(massModel.source.isError||massModel.result.isError)&&<p role="alert" data-testid="criteria-mass-error">{t('massError')} <button onClick={()=>{if(massModel.source.isError)void massModel.source.refetch();else void massModel.result.refetch();}}>{t('retry')}</button></p>}
      {!assumed&&massModel.active&&(massModel.source.isFetching||massModel.result.isFetching)&&<p role="status">{t('massLoading')}</p>}
      <button data-testid="open-planet-criteria" aria-haspopup="dialog" onClick={event=>openCriteria(event.currentTarget)}>{t('criteriaExpand')} ↗</button>
    </>}
    {expanded&&object&&catalogue&&createPortal(<div className={styles.backdrop}><div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="planet-criteria-title" data-testid="planet-criteria-dialog" data-object-id={objectId} data-generic-tno={generic}>
      <header><div><small>{generic?copy.catalogueClass:t('criteriaClassLabel')} · <span data-testid="criteria-official-class">{generic?copy.smallBody:t(`criteriaClass_${object.official_classification}`)}</span></small><h1 id="planet-criteria-title">{name} · {t('criteriaTitle')}</h1></div><button autoFocus onClick={()=>setExpanded(false)}>{t('close')} ×</button></header>
      <div className={styles.body}><section>
        {modelObjectId==='pluto'&&<p data-testid="pluto-classification-lesson" className={styles.notice}>{t('criteriaPlutoLesson')} <a href="https://www.iau.org/IAU/Iau/News/PR2006/iau-2006-general-assembly-resolution-votes.aspx" target="_blank" rel="noreferrer">IAU 2006 ↗</a></p>}
        {rows(true)}
        {generic&&<section className={styles.calculation} data-testid="criteria-mass-availability"><h2>{t('outerTnoMass')}</h2><p>{outerObject?.physical.diameter_km==null?copy.massSizeMissing:copy.massDensityMissing}</p><p>{copy.sourceModelNote}</p><a href={object.orbit.source.url} target="_blank" rel="noreferrer">JPL SBDB ↗</a></section>}
        <MassScenarioPanel key={modelObjectId} objectId={modelObjectId} labels={labels} model={massModel} openRequest={massEditorRequest}/>
        <p className={styles.notice}>{t('criteriaDefinitionNote')}</p>
        <section className={styles.calculation} data-testid="criteria-clearing-model"><h2>{t('criteriaModelLabel')}</h2><p className={styles.mass}>{massLine}</p>{massNote&&<p className={styles.notice}>{massNote}</p>}<code>m_clear ≈ {catalogue.model.coefficient_earth_mass} (a / au)<sup>9/8</sup> M⊕</code><p>{t('criteriaModelNote')}</p><p className={styles.notice}>{t('criteriaEccentricNote',{eccentricity:number(object.orbit.eccentricity)})}</p>
          <dl><div><dt>{t('criteriaSemimajor')}</dt><dd data-testid="criteria-semimajor">{number(object.orbit.semimajor_axis_au)} au</dd></div><div><dt>{t('criteriaPi')}</dt><dd data-testid="criteria-pi">{object.clearing.pi===null?t('criteriaMassUnknown'):number(object.clearing.pi)} · {t(`criteria_${object.clearing.model_classification==='unknown'?'model_unknown':object.clearing.model_classification}`)}</dd></div><div><dt>{t('criteriaElementsEpoch')}</dt><dd>JD {object.orbit.epoch_tdb_jd===null?t('unknown'):String(object.orbit.epoch_tdb_jd)} TDB <a href={object.orbit.source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a></dd></div></dl>
          {object.mass.source&&<a href={object.mass.source.url} target="_blank" rel="noreferrer">{t('source')} · {object.mass.source.label??'JPL'} ↗</a>}<p><a href={catalogue.model.source.url} target="_blank" rel="noreferrer">{catalogue.model.source.label??'Margot'} ↗</a></p>
        </section><details><summary>{t('displayAssumptions')}</summary>{generic&&<p>{copy.sourceModelNote}</p>}{[...catalogue.model.limitations,...object.limitations].map((note,index)=><p key={index} lang="en">{note}</p>)}<p className={styles.hash}>SHA256 {catalogue.source_manifest_sha256}</p></details>
      </section><OrbitDiagram object={object}/></div>
    </div></div>,document.body)}
  </section>;
}
