import {timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
/** Forwarded IP is useful for throttling only after authenticating the dedicated ingress. */
export function proxyClientIp(secret:string|undefined,received:string|undefined,forwarded:string|undefined,remote:string|undefined):string|undefined{
 if(!secret)return remote??'unknown';
 if(!received||Buffer.byteLength(received)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(received),Buffer.from(secret)))return;
 const ip=forwarded?.trim();return ip&&isIP(ip)?ip:undefined;
}
