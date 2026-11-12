/** Local Vite can be opened under either loopback name; never trust arbitrary hosts/ports. */
export function requestOriginAllowed(received:string|undefined,configured:string|readonly string[]):boolean {
 if(typeof configured!=='string')return configured.some(origin=>requestOriginAllowed(received,origin));
 if(!received)return false;
 if(received===configured)return true;
 if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configured))return false;
 try {
  const origin=new URL(received);
  return received===origin.origin&&origin.protocol==='http:'&&
   ['localhost','127.0.0.1'].includes(origin.hostname)&&origin.port===new URL(configured).port;
 }catch{return false;}
}
