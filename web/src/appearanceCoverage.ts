/** Display caution only: a zero RGB channel does not establish missing science data. */
export const COVERAGE_DISPLAY_POLICY='rgb-zero-channel-buffer6-display-caution-v2';
export const COVERAGE_DISPLAY_BUFFER_RADIUS=6;
export const MAX_COVERAGE_PIXELS=4_194_304;
export interface CoverageDisplayMask {
  mask:Uint8Array;
  width:number;
  height:number;
  source_pixels:number;
  marked_pixels:number;
  all_rgb_zero_pixels:number;
  partial_rgb_zero_pixels:number;
}

/** Classify exact decoded RGB8 zeroes without modifying or replacing any source sample.
 * A nonzero but dark/colorful sample is not excluded. Some zero-channel samples
 * may also be valid: this conservative UI overlay is not an archive quality mask.
 */
export function coverageDisplayMask(rgba:Uint8Array|Uint8ClampedArray,width:number,height:number):CoverageDisplayMask {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>MAX_COVERAGE_PIXELS||rgba.length!==width*height*4)throw new Error('invalid_coverage_display_raster');
  const pixels=width*height,mask=new Uint8Array(pixels);
  let allZero=0,partialZero=0;
  for(let index=0;index<pixels;index++){
    const offset=index*4,r=rgba[offset],g=rgba[offset+1],b=rgba[offset+2];
    if(r!==0&&g!==0&&b!==0)continue;
    mask[index]=255;
    if(r===0&&g===0&&b===0)allZero++;else partialZero++;
  }
  return {mask,width,height,source_pixels:pixels,marked_pixels:allZero+partialZero,all_rgb_zero_pixels:allZero,partial_rgb_zero_pixels:partialZero};
}

/** Typed WebGL uploads start at the bottom row; DOM decoded pixels start at the top. */
export function coverageTextureRows(topOrigin:Uint8Array,width:number,height:number):Uint8Array {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>MAX_COVERAGE_PIXELS||topOrigin.length!==width*height)throw new Error('invalid_coverage_display_raster');
  const result=new Uint8Array(topOrigin.length);
  for(let y=0;y<height;y++)result.set(topOrigin.subarray(y*width,(y+1)*width),(height-1-y)*width);
  return result;
}

/** Square display buffer in source pixels, not a scientific boundary/PSF estimate.
 * Longitude wraps; latitude clamps. Two sliding maximum passes keep work O(w*h).
 * The exact-zero seed remains unchanged, and valid adjacent pixels can be covered.
 */
export function bufferedCoverageDisplayMask(seed:Uint8Array,width:number,height:number,radius=COVERAGE_DISPLAY_BUFFER_RADIUS):{mask:Uint8Array;buffered_marked_pixels:number;radius_source_px:number}{
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>MAX_COVERAGE_PIXELS||seed.length!==width*height||!Number.isSafeInteger(radius)||radius<0||radius>32)throw new Error('invalid_coverage_display_buffer');
  const horizontal=new Uint8Array(seed.length),mask=new Uint8Array(seed.length);
  const wrap=(x:number)=>((x%width)+width)%width,clamp=(y:number)=>Math.max(0,Math.min(height-1,y));
  for(let y=0;y<height;y++){
    const row=y*width;let count=0;
    for(let dx=-radius;dx<=radius;dx++)if(seed[row+wrap(dx)]!==0)count++;
    for(let x=0;x<width;x++){
      horizontal[row+x]=count>0?255:0;
      if(seed[row+wrap(x-radius)]!==0)count--;if(seed[row+wrap(x+radius+1)]!==0)count++;
    }
  }
  let marked=0;
  for(let x=0;x<width;x++){
    let count=0;for(let dy=-radius;dy<=radius;dy++)if(horizontal[clamp(dy)*width+x]!==0)count++;
    for(let y=0;y<height;y++){
      if(count>0){mask[y*width+x]=255;marked++;}
      if(horizontal[clamp(y-radius)*width+x]!==0)count--;if(horizontal[clamp(y+radius+1)*width+x]!==0)count++;
    }
  }
  return {mask,buffered_marked_pixels:marked,radius_source_px:radius};
}
