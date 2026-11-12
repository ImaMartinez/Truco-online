// Test-owned HTTP process, actual Auth/RPC/limited SQL worker. Never serves mocked data.
import {createSupabaseApp,supabaseWebConfiguration} from '../../backend/src/supabase-app.ts';
import {CpuWorker,cpuConfiguration} from '../../backend/src/cpu/worker.ts';
const cpu=new CpuWorker(cpuConfiguration());
const app=createSupabaseApp(supabaseWebConfiguration(),cpu);
const server=app.listen(4210,'127.0.0.1',()=>{if(process.env.TEST_WORKER_START!=='no')cpu.start();console.log('READY');});
process.on('SIGTERM',()=>server.close(()=>cpu.close().then(()=>process.exit())));
