import { spawnSync, execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
/** @param {string} script */
export function runImageCheck(script) {
  const candidates=process.env.PYTHON ? [process.env.PYTHON] : [
    'python3','python',
    join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),
  ];
  for(const command of candidates) {
    const probe=spawnSync(command,['-c','import numpy; from PIL import Image'],{timeout:10000,windowsHide:true,stdio:'ignore'});
    if(probe.status===0) {execFileSync(command,[script],{stdio:'inherit',windowsHide:true});return;}
  }
  throw Error('No Python with Pillow and NumPy found. Set PYTHON to its executable path.');
}

