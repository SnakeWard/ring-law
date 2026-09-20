import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const roots = ['scripts', 'src'];
function discover(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? discover(join(dir,e.name)) : /\.test\.(mjs|ts)$/.test(e.name) ? [join(dir,e.name)] : []);
}
const files=roots.flatMap(discover).sort();
if (!files.length || !files.some(f=>f.startsWith('scripts'))) throw Error('Test discovery found no script tests');
console.log(`Discovered ${files.length} test files (explicit paths; no shell globbing).`);
const run=spawnSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit'});
if(run.error) throw run.error;
process.exit(run.status ?? 1);
