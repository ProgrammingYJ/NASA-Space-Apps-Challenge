export interface PlotRect {left:number;top:number;width:number;height:number}
/** Letterbox a physical 2D domain without stretching its x/y lengths. */
export function fitPhysicalDomainRect(box:PlotRect,domainWidth:number,domainHeight:number):PlotRect {
  if(![box.left,box.top,box.width,box.height,domainWidth,domainHeight].every(Number.isFinite)||box.width<=0||box.height<=0||domainWidth<=0||domainHeight<=0)throw new Error('invalid_physical_plot_domain');
  const scale=Math.min(box.width/domainWidth,box.height/domainHeight),width=domainWidth*scale,height=domainHeight*scale;
  return {left:box.left+(box.width-width)/2,top:box.top+(box.height-height)/2,width,height};
}
