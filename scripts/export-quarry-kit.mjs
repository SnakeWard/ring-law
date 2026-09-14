// Run with Node's TypeScript stripping enabled. No third-party tool or API required.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateQuarry, quarryToTiled, validateQuarry, QUARRY_COMPLEXITIES, QUARRY_ASSETS } from '../src/schema/quarry-generator.ts';
const out = new URL('../public/quarry-layouts/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const complexity of QUARRY_COMPLEXITIES) {
  const layout = generateQuarry(complexity);
  if (!validateQuarry(layout).valid) throw Error(`Invalid ${complexity} layout`);
  writeFileSync(new URL(`${complexity}.tmj`, out), JSON.stringify(quarryToTiled(layout), null, 2));
  writeFileSync(new URL(`${complexity}.json`, out), JSON.stringify(layout, null, 2));
}
writeFileSync(new URL('asset-kit.json', out), JSON.stringify({ version: 1, units: 'meters', source: 'In-project procedural Canvas artwork; no external assets or API calls', assets: QUARRY_ASSETS }, null, 2));
console.log(`Exported three validated layouts and reusable footprints to ${fileURLToPath(out)}`);
