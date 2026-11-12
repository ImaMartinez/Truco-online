import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,use:{...base.use,baseURL:'http://127.0.0.1:5473'},webServer:[
 {command:'node node_modules/tsx/dist/cli.mjs backend/src/server.ts',env:{ARENA_STORAGE:'memory',PORT:'4300'},url:'http://127.0.0.1:4300/api/health',reuseExistingServer:false},
 {command:'node node_modules/vite/bin/vite.js frontend --config frontend/vite.config.ts --port 5473',env:{API_PROXY_TARGET:'http://127.0.0.1:4300'},url:'http://127.0.0.1:5473/api/health',reuseExistingServer:false}
]});
