import {writeFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import * as THREE from 'three';

const vector=(value:string|null)=>{expect(value).toBeTruthy();const parts=value!.split(',').map(Number);expect(parts).toHaveLength(3);expect(parts.every(Number.isFinite)).toBe(true);return new THREE.Vector3(...parts as [number,number,number]);};
async function snapshot(page:Page,id:string){
  const scene=page.getByTestId('universe-scene'),label=page.getByTestId('object-label-'+id),canvas=page.getByTestId('universe-canvas');
  const bounds=await canvas.boundingBox();expect(bounds).toBeTruthy();
  const eye=vector(await scene.getAttribute('data-camera-position')),target=vector(await scene.getAttribute('data-camera-target'));
  const body=vector(await label.getAttribute('data-world-position')),source=vector(await label.getAttribute('data-source-position-au'));
  const sun=new THREE.Vector3(-source.x,-source.z,source.y).normalize(),view=eye.clone().sub(body).normalize();
  return {eye,target,body,sun,view,phase:sun.dot(view),radius:Number(await label.getAttribute('data-display-radius')),physical:Number(await label.getAttribute('data-physical-reference-radius-km')),mesh:Number(await label.getAttribute('data-mesh-world-radius')),bounds:bounds!};
}
async function settle(page:Page){
  let previous='',same=0;
  await expect.poll(async()=>{const now=await page.getByTestId('universe-scene').getAttribute('data-camera-position');same=now===previous?same+1:0;previous=now??'';return same;},{timeout:15000,intervals:[150,150,150]}).toBeGreaterThanOrEqual(3);
}
async function quarterPhase(page:Page,id:string){
  // OrbitControls uses canvas height and rotateSpeed .65 for horizontal drag.
  for(let attempt=0;attempt<3;attempt++){
    const s=await snapshot(page,id);if(Math.abs(s.phase)<.2)return s;
    const horizontal=Math.hypot(s.view.x,s.view.z)*Math.hypot(s.sun.x,s.sun.z);
    expect(horizontal).toBeGreaterThan(.1);
    const theta=Math.atan2(s.view.x,s.view.z),phi=Math.atan2(s.sun.x,s.sun.z);
    const desired=phi+Math.acos(Math.max(-1,Math.min(1,-s.sun.y*s.view.y/horizontal)));
    const delta=((desired-theta+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    const pixels=-delta*s.bounds.height/(2*Math.PI*.65),steps=Math.max(1,Math.ceil(Math.abs(pixels)/(s.bounds.width*.35)));
    for(let n=0;n<steps;n++){
      const x=s.bounds.x+s.bounds.width*.43,y=s.bounds.y+s.bounds.height*.40;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+pixels/steps,y,{steps:12});await page.mouse.up();
    }
    await settle(page);
  }
  const s=await snapshot(page,id);expect(Math.abs(s.phase)).toBeLessThan(.2);return s;
}

test('DEV-023: solar night shading is the default; inspection changes fill while geometry and camera stay fixed',async({page},testInfo)=>{
  test.setTimeout(150000);await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[],records:unknown[]=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/GLSL|WebGL|shader|THREE|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('settings-toggle').click();await expect(page.getByTestId('settings-appearance-lighting')).toHaveValue('solar');await page.getByTestId('outer-tno-toggle').uncheck();await page.getByTestId('settings-toggle').click();
  for(const id of ['earth','neptune']){
    await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
    const label=page.getByTestId('object-label-'+id),lighting=page.getByTestId('appearance-lighting');
    await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:45000});await expect(label).toHaveAttribute('data-appearance-lighting','solar');await expect(lighting).toHaveValue('solar');
    if(id==='neptune')await expect(label).toHaveAttribute('data-appearance-kind','illustration');
    await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','focused');
    const initial=await snapshot(page,id);const initialPath=testInfo.outputPath(id+'-solar-initial.png');await page.screenshot({path:initialPath});await testInfo.attach(id+'-solar-initial.png',{path:initialPath,contentType:'image/png'});
    const quarter=await quarterPhase(page,id),tangent=quarter.sun.clone().addScaledVector(quarter.view,-quarter.phase).normalize();
    const normals=[quarter.view.clone().multiplyScalar(Math.sqrt(1-.55**2)).addScaledVector(tangent,.55).normalize(),quarter.view.clone().multiplyScalar(Math.sqrt(1-.55**2)).addScaledVector(tangent,-.55).normalize()];
    expect(normals[0].dot(quarter.sun)).toBeGreaterThan(.3);expect(normals[1].dot(quarter.sun)).toBeLessThan(-.3);
    const camera=new THREE.PerspectiveCamera(48,quarter.bounds.width/quarter.bounds.height,.025,6000);camera.position.copy(quarter.eye);camera.lookAt(quarter.target);camera.updateMatrixWorld();
    const points=normals.map(normal=>{const projected=quarter.body.clone().addScaledVector(normal,quarter.radius).project(camera);expect(Math.abs(projected.x)).toBeLessThan(1);expect(Math.abs(projected.y)).toBeLessThan(1);return {dot_sun:normal.dot(quarter.sun),x:quarter.bounds.x+(projected.x+1)*quarter.bounds.width/2,y:quarter.bounds.y+(1-projected.y)*quarter.bounds.height/2};});
    for(const mode of ['solar','inspection','solar'] as const){
      await lighting.selectOption(mode);await expect(label).toHaveAttribute('data-appearance-lighting',mode);
      const after=await snapshot(page,id);expect(after.physical).toBe(quarter.physical);expect(after.mesh).toBeCloseTo(quarter.mesh,7);expect(after.eye.distanceTo(quarter.eye)).toBeLessThan(1e-4);expect(after.target.distanceTo(quarter.target)).toBeLessThan(1e-4);
      const name=id+'-'+mode+'-'+records.length+'.png',path=testInfo.outputPath(name);await page.screenshot({path});await testInfo.attach(name,{path,contentType:'image/png'});records.push({id,mode,phase:after.phase,eye:after.eye.toArray(),target:after.target.toArray(),physical:after.physical,mesh:after.mesh,day_night_oracle:points});
    }
    expect(initial.physical).toBe(quarter.physical);await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');await expect(label).toHaveAttribute('data-surface-mesh-scale','1,1,1');
  }
  await page.locator('#universe-search').fill('sun');await page.getByTestId('search-sun').click();await expect(page.getByTestId('object-label-sun')).toHaveAttribute('data-appearance-state',/ready|fallback/);
  const sunPath=testInfo.outputPath('sun-emission.png');await page.screenshot({path:sunPath});await testInfo.attach('sun-emission.png',{path:sunPath,contentType:'image/png'});
  expect(errors).toEqual([]);writeFileSync(testInfo.outputPath('lighting-oracles.json'),JSON.stringify({records,errors}));await testInfo.attach('dev023-lighting-oracles.json',{body:JSON.stringify({records,errors,pixel_radiometry_verified:false,human_image_review_required:'Inspect solar/inspection PNGs at the recorded geometric day/night points; solar night should be black, inspection should reveal it, and the Sun should remain luminous. This test does not claim GPU pixel photometry.',human_image_review_completed:false},null,2),contentType:'application/json'});
});
