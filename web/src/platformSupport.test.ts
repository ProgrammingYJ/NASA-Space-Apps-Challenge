import {describe,it,expect} from 'vitest';
import {isMobilePlatform} from './platformSupport';

describe('PC-only release platform boundary',()=>{
  it('blocks Android/iPhone/iPad and iPadOS desktop-class identity',()=>{
    for(const identity of [
      {userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'},
      {userAgent:'Mozilla/5.0 (Linux; Android 16; Tablet) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'},
      {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)'},
      {userAgent:'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X)'},
      {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',platform:'MacIntel',maxTouchPoints:5},
      {userAgent:'undisclosed',userAgentData:{mobile:true}},
    ])expect(isMobilePlatform(identity)).toBe(true);
  });
  it('permits desktop browsers and touch PCs regardless of their window width',()=>{
    for(const identity of [
      {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',platform:'Win32',maxTouchPoints:10,userAgentData:{mobile:false}},
      {userAgent:'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',platform:'Linux x86_64'},
      {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',platform:'MacIntel',maxTouchPoints:0},
      {},
    ])expect(isMobilePlatform(identity)).toBe(false);
  });
});
