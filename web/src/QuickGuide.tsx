import {useEffect,useRef} from 'react';
import {experienceCopy} from './ExperienceCopy';
import styles from './QuickGuide.module.css';

export default function QuickGuide({open,onClose,language}:{open:boolean;onClose:()=>void;language:string}){
  const copy=experienceCopy(language),dialog=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null),content=useRef<HTMLDivElement>(null),previous=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const element=dialog.current;if(!element)return;
    if(open){previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;if(!element.open)element.showModal();if(content.current)content.current.scrollTop=0;close.current?.focus({preventScroll:true});}
    else if(element.open){element.close();previous.current?.focus({preventScroll:true});}
  },[open]);
  return <dialog ref={dialog} className={styles.dialog} data-testid="quick-guide-dialog" aria-labelledby="quick-guide-title" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(node=>node.getClientRects().length>0);
    const first=nodes[0],last=nodes[nodes.length-1];if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={content} className={styles.content}>
      <header><h1 id="quick-guide-title">{copy.guideTitle}</h1><button ref={close} data-testid="quick-guide-close" onClick={onClose}>{copy.close} ×</button></header>
      <p className={styles.recommended} data-testid="quick-guide-recommended">{copy.recommended}</p><p>{copy.guideIntro}</p>
      <ol data-testid="quick-guide-steps">{copy.guideSteps.map((step,index)=><li key={index}><h2>{step.title}</h2><p>{step.body}</p></li>)}</ol>
      <p className={styles.note} data-testid="quick-guide-display-note">{copy.displayNote}</p>
    </div>
  </dialog>;
}
