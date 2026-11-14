import sourceCatalog from '../../data/manifests/extended_solar.json?raw';
import {describe,expect,it} from 'vitest';
import {localizedObjectName,normalizeObjectSearch,objectNameAliases,objectNameInfo,type NameableObject} from './objectNames';
import type {Locale} from './types';

const catalog=JSON.parse(sourceCatalog) as {objects:NameableObject[]};
const objects=catalog.objects.map(({object_id,name,kind,parent_id})=>Object.freeze({object_id,name,kind,parent_id}));
const locales:Locale[]=['ko','en','ja','zh-Hant','fr'];
const find=(name:string)=>{const object=objects.find(object=>object.name===name);if(!object)throw new Error(`Missing source object: ${name}`);return object;};

describe('display-only names for the complete sourced satellite and dwarf catalog',()=>{
  it('covers all 468 moons and 8 minor bodies without changing their scientific identities',()=>{
    expect(objects).toHaveLength(476);
    expect(objects.filter(object=>object.kind==='moon')).toHaveLength(468);
    const before=JSON.stringify(objects);
    for(const object of objects)for(const locale of locales){
      const result=objectNameInfo(object,locale);
      expect(result.canonicalName).toBe(object.name);
      expect(result.label.trim().length).toBeGreaterThan(0);
      expect(result.method,`${object.object_id}/${locale}`).not.toBe('untranslated');
      if(locale==='en')expect(result.label).toBe(object.name);
      if(!/^S\/\d{4}\s/.test(object.name)&&object.name!=='MK 2'&&['ko','ja','zh-Hant'].includes(locale))expect(result.label).not.toBe(object.name);
    }
    expect(JSON.stringify(objects)).toBe(before);
  });

  it('retains every international provisional designation and localizes only its parent context',()=>{
    const provisional=objects.filter(object=>/^S\/\d{4}\s/.test(object.name)||object.name==='MK 2');
    expect(provisional).toHaveLength(293);
    for(const object of provisional)for(const locale of locales){
      expect(objectNameInfo(object,locale).method).toBe('international_designation');
      expect(localizedObjectName(object,locale).startsWith(object.name)).toBe(true);
      if(locale!=='en')expect(localizedObjectName(object,locale)).toContain(' · ');
    }
    expect(localizedObjectName(find('MK 2'),'ko')).toBe('MK 2 · 마케마케 위성');
    expect(localizedObjectName(find('MK 2'),'fr')).toBe('MK 2 · satellite de Makémaké');
  });

  it('uses verified local forms and correct parent-specific Chinese satellite numbers',()=>{
    const expected:[string,Locale,string][]=[['Io','ko','이오'],['Europa','fr','Europe'],['Ganymede','fr','Ganymède'],['Enceladus','ko','엔켈라두스'],['Enceladus','ja','エンケラドス'],['Enceladus','zh-Hant','土衛二'],['Titan','zh-Hant','土衛六'],['Ariel','zh-Hant','天衛一'],['Triton','zh-Hant','海衛一'],['Charon','zh-Hant','冥衛一'],['Ersa','zh-Hant','木衛七十一'],['Geirrod','zh-Hant','土衛六十六'],['Ceres','zh-Hant','穀神星']];
    for(const [name,locale,label] of expected)expect(localizedObjectName(find(name),locale)).toBe(label);
    expect(objectNameInfo(find('Ariel'),'ja').method).toBe('documented_local_name');
    expect(objectNameInfo(find('Geirrod'),'ko').method).toBe('project_transliteration');
    expect(objectNameInfo(find('Titan'),'fr').method).toBe('preserved_proper_name');
    expect(objectNameInfo({object_id:'future-unknown',name:'New Name',kind:'moon'},'ko').method).toBe('untranslated');
  });

  it('finds source names, IDs, accented French and local variants after switching locale',()=>{
    const matches=(name:string,query:string)=>normalizeObjectSearch(objectNameAliases(find(name)).join(' ')).includes(normalizeObjectSearch(query));
    for(const query of ['Enceladus','moon-602','엔셀라두스','エンケラドゥス','土衛二','Encelade'])expect(matches('Enceladus',query)).toBe(true);
    expect(matches('Epimetheus','epimethee')).toBe(true);
    expect(matches('Janus','야누스')).toBe(true);
    expect(matches("Hi'iaka",'hiiaka')).toBe(true);
  });
});
