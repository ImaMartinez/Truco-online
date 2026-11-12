/** Bind locally during development; require the real persistent stack in production. */
export function runtimeConfiguration(env=process.env){
 const production=env.NODE_ENV==='production';
 const port=Number(env.PORT??(production?8080:4000));
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT debe ser un entero entre 1 y 65535.');
 const host=env.BIND_HOST??(production?'0.0.0.0':'127.0.0.1');
 if(!['0.0.0.0','127.0.0.1','::'].includes(host))throw Error('BIND_HOST no válido.');
 if(production&&(env.ARENA_STORAGE!=='supabase'||!env.CPU_DB_PASSWORD))throw Error('Producción requiere Supabase y el worker CPU persistente configurados.');
 return {production,port,host};
}
