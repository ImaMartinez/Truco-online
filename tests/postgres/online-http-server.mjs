import {createSupabaseApp,supabaseWebConfiguration} from '../../backend/src/supabase-app.ts';
import {CpuWorker,cpuConfiguration} from '../../backend/src/cpu/worker.ts';
const cpu=new CpuWorker(cpuConfiguration());const app=createSupabaseApp(supabaseWebConfiguration(),cpu);
const server=app.listen(4220,'127.0.0.1',()=>{cpu.start();console.log('READY');});
process.on('SIGTERM',()=>server.close(()=>cpu.close().then(()=>process.exit())));
