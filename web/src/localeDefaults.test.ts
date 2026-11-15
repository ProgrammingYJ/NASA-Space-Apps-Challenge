import {describe,expect,it} from 'vitest';
import i18n from './i18n';
import {initialSession,useWorkbench} from './store';
import type {Comparison,Session} from './types';

describe('English initial language and explicit user language',()=>{
  it('starts in English and returns a fresh session to English after a language choice',async()=>{
    expect(initialSession.locale).toBe('en');expect(i18n.language).toBe('en');
    useWorkbench.getState().patch({locale:'ko'});await i18n.changeLanguage('ko');
    expect(useWorkbench.getState().session.locale).toBe('ko');
    useWorkbench.getState().reset();
    expect(useWorkbench.getState().session.locale).toBe('en');
    await i18n.changeLanguage('en');
  });
  it('preserves a saved explicit locale when evidence is restored',()=>{
    const session:Session={...initialSession,locale:'fr'};
    const comparison={object_id:session.object_id,frames:[]} as unknown as Comparison;
    useWorkbench.getState().restore(session,comparison,'saved-language-state',null);
    expect(useWorkbench.getState().session.locale).toBe('fr');
    useWorkbench.getState().reset();
  });
});
