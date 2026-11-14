import {useEffect,useRef} from 'react';
import {useTranslation} from 'react-i18next';
import styles from './CreditsDialog.module.css';
export default function CreditsDialog({open,onClose}:{open:boolean;onClose:()=>void}){
  const {t}=useTranslation();const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null);
  useEffect(()=>{const element=dialog.current;if(!element)return;if(open){previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;if(!element.open)element.showModal();}else if(element.open){element.close();previous.current?.focus();}},[open]);
  return <dialog ref={dialog} data-testid="credits-dialog" className={styles.dialog} aria-labelledby="credits-title" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{if(event.key!=='Tab')return;const nodes=event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');const first=nodes[0],last=nodes[nodes.length-1];if(!first)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className={styles.content}><header><h1 id="credits-title">{t('creditsTitle')}</h1><button data-testid="credits-close" onClick={onClose} aria-label={t('close')} autoFocus>×</button></header><p>{t('creditsPlaceholder')}</p></div></dialog>;
}
