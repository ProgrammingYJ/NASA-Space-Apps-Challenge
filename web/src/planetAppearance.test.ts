import {describe,it,expect} from 'vitest';
import {displayPole,scaledRingBands,subtractRingGaps,sphereBlocksSun,ringsBlockSun,textureWindow,displayTextureDimensions,detailedAppearanceForSize,ringBandsForDisplay,createBodyAppearance} from './planetAppearance';
import {coverageDisplayMask,bufferedCoverageDisplayMask,coverageTextureRows} from './appearanceCoverage';
describe('sourced appearance geometry',()=>{
  it('buffers only the separate caution mask with periodic longitude and clamped latitude, preserving the seed',()=>{
    const seed=new Uint8Array(25);seed[0]=255;const before=Array.from(seed),result=bufferedCoverageDisplayMask(seed,5,5,1);
    expect(Array.from(result.mask)).toEqual([255,255,0,0,255,255,255,0,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
    expect(result.buffered_marked_pixels).toBe(6);expect(result.radius_source_px).toBe(1);expect(Array.from(seed)).toEqual(before);
    expect(Array.from(bufferedCoverageDisplayMask(seed,5,5,0).mask)).toEqual(before);
    const tiny=bufferedCoverageDisplayMask(new Uint8Array([255,0]),1,2);expect(tiny.buffered_marked_pixels).toBe(2);
    expect(()=>bufferedCoverageDisplayMask(seed,5,5,-1)).toThrow('invalid_coverage_display_buffer');
  });
  it('marks exact RGB zero channels only as display caution while retaining original samples and valid dark/color pixels',()=>{
    const source=new Uint8ClampedArray([1,2,3,255,0,0,0,255,255,0,255,255,255,1,255,255]);
    const before=Array.from(source),result=coverageDisplayMask(source,2,2);
    expect(Array.from(result.mask)).toEqual([0,255,255,0]);expect(result.marked_pixels).toBe(2);
    expect(result.all_rgb_zero_pixels).toBe(1);expect(result.partial_rgb_zero_pixels).toBe(1);expect(result.source_pixels).toBe(4);
    expect(Array.from(source)).toEqual(before);
  });
  it('aligns top-origin decoded caution pixels with the published map on WebGL without changing the source mask',()=>{
    const top=new Uint8Array([0,255,255,0]),bottom=coverageTextureRows(top,2,2);
    expect(Array.from(bottom)).toEqual([255,0,0,255]);expect(Array.from(top)).toEqual([0,255,255,0]);
    expect(()=>coverageDisplayMask(new Uint8Array(4),2,2)).toThrow('invalid_coverage_display_raster');
    expect(()=>coverageTextureRows(top,0,2)).toThrow('invalid_coverage_display_raster');
  });
  it('switches only caution display mode while retaining mesh dimensions and the original-map option',()=>{
    const appearance=createBodyAppearance({objectId:'neptune',displayRadius:1,physicalRadiusKm:24622,fallbackColor:'#4e72b9'});
    const geometry=appearance.surface.geometry,positions=Array.from(geometry.getAttribute('position').array),scale=appearance.surface.scale.toArray();
    expect(appearance.status.coverage_mode).toBe('marked');expect(appearance.status.coverage_overlay).toBe('not_applicable');
    appearance.setCoverageMode('original');expect(appearance.status.coverage_mode).toBe('original');
    appearance.setCoverageMode('marked');expect(appearance.status.coverage_mode).toBe('marked');
    expect(appearance.surface.geometry).toBe(geometry);expect(Array.from(geometry.getAttribute('position').array)).toEqual(positions);expect(appearance.surface.scale.toArray()).toEqual(scale);
    appearance.dispose();
  });
  it('inherits faint system visibility without overriding a sourced band or opacity',()=>{
    const source={visibility:'very_faint',bands_km:[{name:'Galle',inner_km:40900,outer_km:42900},{name:'Explicit',inner_km:53000,outer_km:54000,visibility:'faint',display_opacity:.08}]};
    const bands=scaledRingBands(ringBandsForDisplay(source),24622,1);
    expect(bands[0].opacity).toBeLessThan(.03);expect(bands[1].opacity).toBe(.08);
    expect(source.bands_km[0]).not.toHaveProperty('visibility');
    expect(ringBandsForDisplay(undefined)).toEqual([]);
  });
  it('bounds overview/detail GPU samples without enlarging smaller source images or changing the immutable source crop',()=>{expect(displayTextureDimensions(5400,2700,1024)).toEqual([1024,512]);expect(displayTextureDimensions(9520,4760,4096)).toEqual([4096,2048]);expect(displayTextureDimensions(447,224,1024)).toEqual([447,224]);expect(displayTextureDimensions(1167,875,1024)).toEqual([1024,768]);expect(()=>displayTextureDimensions(0,875,1024)).toThrow('invalid_display_texture_dimensions');const entry={texture_region_px:{x:205,y:175,width:874,height:437},pixel_dimensions:[1167,875] as [number,number]};expect(textureWindow(entry).repeat).toEqual([874/1167,437/875]);expect(entry.pixel_dimensions).toEqual([1167,875]);});
  it('promotes visible unselected surfaces by angular display size and retains detail across the hysteresis band',()=>{expect(detailedAppearanceForSize(200,false,false)).toBe(true);expect(detailedAppearanceForSize(150,false,true)).toBe(true);expect(detailedAppearanceForSize(150,false,false)).toBe(false);expect(detailedAppearanceForSize(120,false,true)).toBe(false);expect(detailedAppearanceForSize(1,true,false)).toBe(true);expect(detailedAppearanceForSize(NaN,false,false)).toBe(false);});
  it('scales ring bands from physical km without filling the measured division',()=>{const bands=scaledRingBands([{inner_km:92000,outer_km:117580},{inner_km:122170,outer_km:136775}],58232,1);expect(bands).toHaveLength(2);expect(bands[0].outer).toBeLessThan(bands[1].inner);expect(bands[0].inner).toBeCloseTo(92000/58232);expect(scaledRingBands([{inner_km:1,outer_km:2}],0,1)).toEqual([]);});
  it('maps an ICRS north pole into the declared ecliptic/display frame',()=>{const pole=displayPole({pole_icrs_deg:{ra:0,dec:90}});expect(pole[0]).toBeCloseTo(0);expect(pole[1]).toBeCloseTo(Math.cos(84381.448/3600*Math.PI/180));expect(pole[2]).toBeCloseTo(-Math.sin(84381.448/3600*Math.PI/180));expect(Math.hypot(...pole)).toBeCloseTo(1);});
  it('puts the planet shadow only on ring points opposite the Sun',()=>{expect(sphereBlocksSun([-2,0,0],[1,0,0],1)).toBe(true);expect(sphereBlocksSun([2,0,0],[1,0,0],1)).toBe(false);expect(sphereBlocksSun([-2,0,2],[1,0,0],1)).toBe(false);});
  it('distinguishes a ray through a ring band from a ray through its division',()=>{const bands=scaledRingBands([{inner_km:1.5,outer_km:2},{inner_km:2.2,outer_km:3}],1,1);expect(ringsBlockSun([0,-1,0],[1.8,1,0],bands)).toBe(true);expect(ringsBlockSun([0,-1,0],[2.1,1,0],bands)).toBe(false);expect(ringsBlockSun([0,1,0],[1.8,1,0],bands)).toBe(false);});
  it('selects only a documented data window from an immutable full PNG with top-origin pixel coordinates',()=>{const window=textureWindow({texture_region_px:{x:205,y:175,width:874,height:437},pixel_dimensions:[1167,875],lat_bounds_deg:[-90,90]});expect(window.offset[0]).toBeCloseTo(205/1167);expect(window.offset[1]).toBeCloseTo(263/875);expect(window.repeat).toEqual([874/1167,437/875]);expect(()=>textureWindow({texture_region_px:{x:1,y:1,width:10,height:10},pixel_dimensions:[5,5]})).toThrow('invalid_texture_region');});
  it('cuts the sourced Encke/Keeler divisions out of A without filling gaps or making the diffuse E envelope opaque',()=>{const bands=[{name:'A',inner_km:122050,outer_km:136770}];const gaps=[{inner_km:133423,outer_km:133745},{inner_km:136487,outer_km:136522}];const cut=subtractRingGaps(bands,gaps);expect(cut.map(band=>[band.inner_km,band.outer_km])).toEqual([[122050,133423],[133745,136487],[136522,136770]]);expect(bands[0].outer_km).toBe(136770);const faint=scaledRingBands([{inner_km:180000,outer_km:480000,visibility:'very_faint'}],58232,1);expect(faint[0].opacity).toBeLessThan(.03);});
});
