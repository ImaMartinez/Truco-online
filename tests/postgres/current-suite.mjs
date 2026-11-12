process.env.TEST_CURRENT_SCHEMA='1';
const suite=process.argv[2];if(!['engine','profiles','cpu','online'].includes(suite))throw Error('Choose engine, profiles or cpu');
await import(suite==='engine'?'./run.mjs':`./${suite}.mjs`);
