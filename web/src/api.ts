export class ApiError extends Error { constructor(public code:string, public requestId?:string){super(code)} }
export async function request<T>(path:string, options:RequestInit={}):Promise<T> {
  let response:Response;
  try { response = await fetch(`/api/v1${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}}); }
  catch { throw new ApiError('network'); }
  if(!response.ok){const body=await response.json().catch(()=>({})); const e=body.error??body;throw new ApiError(e.code??`http_${response.status}`,e.request_id);}
  return response.json() as Promise<T>;
}
export function download(url:string){const a=document.createElement('a');a.href=url;a.download='';a.click();}
