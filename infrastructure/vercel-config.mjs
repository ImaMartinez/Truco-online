/** Native routing configuration: proxy secret is resolved by Vercel, never embedded in JS. */
export function makeVercelConfig(env){
 const value=env.API_BACKEND_ORIGIN;
 let origin;try{origin=new URL(value);}catch{throw Error('Definí API_BACKEND_ORIGIN con la URL HTTPS real del backend.');}
 if(origin.protocol!=='https:'||origin.origin!==value||origin.username||origin.password||/^(localhost|127\.|\[::1\])/.test(origin.hostname)||/\.(local|internal|invalid)$/.test(origin.hostname))throw Error('API_BACKEND_ORIGIN debe ser un origen HTTPS público exacto.');
 return {
  framework:'vite',
  installCommand:'npm ci --workspace frontend --include-workspace-root=false',
  buildCommand:'npm run catalog:check && npm run build --workspace frontend',
  outputDirectory:'frontend/dist',
  routes:[
   {src:'^/api(?:/(.*))?$',dest:`${origin.origin}/api/$1`,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'},transforms:[{type:'request.headers',op:'set',target:{key:'x-arena-proxy-key'},args:'$API_PROXY_SECRET',env:['API_PROXY_SECRET']}]},
   {handle:'filesystem'},
   {src:'^/.*$',dest:'/index.html',headers:{'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}}
  ]
 };
}
