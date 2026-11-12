import {useEffect,useState} from 'react';
import {App} from './App';
import {SupabaseWebApp} from './SupabaseWebApp';
export function EntryApp(){
 const [provider,setProvider]=useState<string|null>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;fetch('/api/health').then(r=>r.json()).then(h=>{if(live)setProvider(h.storage);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[]);
 if(!provider)return <main className="profile-entry"><p role="status">{failed?'No se pudo conectar con el servidor.':'Abriendo la mesa…'}</p>{failed&&<button className="button primary" onClick={()=>window.location.reload()}>Reintentar</button>}</main>;
 return provider==='supabase'?<SupabaseWebApp/>:<App/>;
}
