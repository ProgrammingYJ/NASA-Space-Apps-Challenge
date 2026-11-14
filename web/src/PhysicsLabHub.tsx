import {useEffect,useState} from 'react';
import PhysicsSandbox,{type PhysicsSandboxProps} from './PhysicsSandbox';
import AdvancedPhysicsLab,{type AdvancedModel} from './AdvancedPhysicsLab';
import {advancedPhysicsCopy} from './advancedPhysicsCopy';
import NumericalRelativityExplorer from './NumericalRelativityExplorer';
import {numericalRelativityCopy} from './numericalRelativityCopy';
import styles from './AdvancedPhysicsLab.module.css';
export default function PhysicsLabHub(props:PhysicsSandboxProps){
  const copy=advancedPhysicsCopy(props.locale),nrCopy=numericalRelativityCopy(props.locale);
  const [model,setModel]=useState<'gravity'|'numerical-relativity'|AdvancedModel>('gravity');
  const [advancedModel,setAdvancedModel]=useState<AdvancedModel>('quantum');
  useEffect(()=>{if(props.visible)setModel('gravity');},[props.visible,props.initialBlackHoleId]);
  const advancedVisible=model!=='gravity'&&model!=='numerical-relativity';
  return <section hidden={!props.visible} className={styles.hub} data-testid="physics-lab-hub">
    <nav className={styles.tabs}>{(['gravity','quantum','maxwell','euler','numerical-relativity'] as const).map(value=><button data-testid={'physics-model-'+value} key={value} aria-pressed={model===value} onClick={()=>{setModel(value);if(value!=='gravity'&&value!=='numerical-relativity')setAdvancedModel(value);}}>{value==='numerical-relativity'?nrCopy.tab:copy[value]}</button>)}</nav>
    <div className={styles.content}>
      <div hidden={model!=='gravity'}><PhysicsSandbox {...props} visible={props.visible&&model==='gravity'}/></div>
      <AdvancedPhysicsLab visible={props.visible&&advancedVisible} model={advancedModel} locale={props.locale} onClose={props.onClose}/>
      <NumericalRelativityExplorer visible={props.visible&&model==='numerical-relativity'} locale={props.locale} onClose={props.onClose}/>
    </div>
  </section>;
}
