import {describe,expect,it} from 'vitest';
import {restoredDensityInput,type DensityScenarioSource,type SavedDensityScenario} from './massScenarioDefaults';

const source:DensityScenarioSource={source_manifest_sha256:'a'.repeat(64),model:{density_input_min_kg_m3:100,density_input_max_kg_m3:10000},analogues:{tethys:{density_kg_m3:984},rhea:{density_kg_m3:1237.2}}};
const saved:SavedDensityScenario={source_manifest_sha256:source.source_manifest_sha256,input:{target_id:'sedna',density_kg_m3:984,analogue_id:'tethys',include_source_ranges:true}};
describe('explicit density hypotheses',()=>{
  it('applies no default density even when Tethys is present in the source',()=>{
    expect(restoredDensityInput('sedna',source)).toBeNull();
    expect(restoredDensityInput('sedna',source,null)).toBeNull();
  });
  it('restores an exact valid historical moon-density hypothesis without changing it',()=>{
    const restored=restoredDensityInput('sedna',source,saved);
    expect(restored).toEqual(saved.input);expect(restored).not.toBe(saved.input);
  });
  it('restores a custom density without adding a moon or a borrowed uncertainty',()=>{
    const custom={...saved,input:{...saved.input,density_kg_m3:2000,analogue_id:null,include_source_ranges:false}};
    expect(restoredDensityInput('sedna',source,custom)).toEqual(custom.input);
  });
  it('rejects a different target or source and invalid saved density/analogue pairs',()=>{
    expect(restoredDensityInput('eris',source,saved)).toBeNull();
    expect(restoredDensityInput('sedna',source,{...saved,source_manifest_sha256:'b'.repeat(64)})).toBeNull();
    for(const input of [{...saved.input,density_kg_m3:NaN},{...saved.input,density_kg_m3:10001},{...saved.input,analogue_id:'missing'},{...saved.input,density_kg_m3:2000}])expect(restoredDensityInput('sedna',source,{...saved,input})).toBeNull();
  });
});
