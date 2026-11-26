import {spawnSync} from 'node:child_process';
for(const [file,extra] of [['scripts-build.mjs',{}],['tests/backend.test.mjs',{}],['tests/backend.test.mjs',{TEST_D1_STORAGE:'1'}],['tests/storage.test.mjs',{}],['tests/runtime.test.mjs',{}],['tests/migration.test.mjs',{}]]){
  const result=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,...extra}});
  if(result.status!==0)process.exit(result.status||1);
}
