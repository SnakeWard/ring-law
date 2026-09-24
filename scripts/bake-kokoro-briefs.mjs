#!/usr/bin/env node
/**
 * Bake Kokoro voice briefs (KOKORO_LAW: British male) for info cards that have
 * no recorded clip, so players never download the model for them.
 *
 *   npm run bake:briefs                 # every brief with no clip on disk
 *   npm run bake:briefs -- --only hummel,su-122
 *   npm run bake:briefs -- --force --only m12-gmc   # re-bake an existing one
 *   npm run bake:briefs -- --voice bm_lewis         # try another British male
 *   npm run bake:briefs -- --dry                    # list what would be baked
 *
 * First run downloads the Kokoro model (~90 MB) from Hugging Face and caches it.
 * Writes public/audio/briefs/<id>.mp3 and records artillery ids in
 * src/schema/kokoro-baked.ts so the game plays the file instead of the browser voice.
 * Never touches the existing recorded briefs unless --force names them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const { BRIEFS, KOKORO_LAW, spokenBrief } = await import(pathToFileURL(join(root, "src/schema/audio.ts")).href);
const bakedFile = join(root, "src/schema/kokoro-baked.ts");
const { KOKORO_BAKED } = await import(pathToFileURL(join(root, "src/schema/kokoro-baked.ts")).href);

const only = value("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const force = flag("force");
const voice = value("voice") ?? KOKORO_LAW.voice;
const clipPath = (id) => join(root, "public/audio/briefs", `${id}.mp3`);

const targets = BRIEFS.filter((b) => {
  if (only && !only.includes(b.hullId)) return false;
  const onDisk = existsSync(clipPath(b.hullId));
  if (force && only) return true;
  // Unbaked = no clip declared, or a declared clip missing from disk.
  return !onDisk && (!b.src || !existsSync(join(root, "public", b.src)));
});

// Clips already on disk for no-clip briefs (e.g. baked on another machine): just register them.
const alreadyOnDisk = BRIEFS.filter(
  (b) => !b.src && existsSync(clipPath(b.hullId)) && !KOKORO_BAKED.includes(b.hullId) && !targets.includes(b),
).map((b) => b.hullId);

if (!targets.length && !alreadyOnDisk.length) {
  console.log("Nothing to bake: every brief already has a clip.");
  process.exit(0);
}
console.log(`Kokoro ${KOKORO_LAW.modelId} · voice ${voice} · ${targets.length} brief(s):`);
for (const b of targets) console.log(`  - ${b.hullId}  ${b.title}`);
if (flag("dry") || !targets.length) {
  if (alreadyOnDisk.length && !flag("dry")) registerBaked(alreadyOnDisk);
  process.exit(0);
}

const { KokoroTTS } = await import("kokoro-js");
const { Mp3Encoder } = await import("@breezystack/lamejs");

console.log("Loading model (first run downloads ~90 MB)…");
const tts = await KokoroTTS.from_pretrained(KOKORO_LAW.modelId, {
  dtype: KOKORO_LAW.dtype,
  device: "cpu",
});

function toMp3(chunks, rate) {
  const gap = Math.round(rate * KOKORO_LAW.gapS);
  const total = chunks.reduce((n, c) => n + c.length + gap, 0);
  const pcm = new Int16Array(total);
  let at = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      const s = Math.max(-1, Math.min(1, c[i]));
      pcm[at++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    at += gap;
  }
  const enc = new Mp3Encoder(1, rate, 96);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152 * 16) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + 1152 * 16));
    if (out.length) parts.push(Buffer.from(out));
  }
  const tail = enc.flush();
  if (tail.length) parts.push(Buffer.from(tail));
  return { mp3: Buffer.concat(parts), seconds: total / rate };
}

function registerBaked(ids) {
  const list = [...new Set([...KOKORO_BAKED, ...ids])].sort();
  if (list.length === KOKORO_BAKED.length) return;
  const src = readFileSync(bakedFile, "utf8").replace(
    /export const KOKORO_BAKED: readonly string\[\] = \[[^\]]*\];/,
    `export const KOKORO_BAKED: readonly string[] = [\n${list.map((id) => `  "${id}",`).join("\n")}\n];`,
  );
  writeFileSync(bakedFile, src);
  console.log(`Updated src/schema/kokoro-baked.ts (${list.length} baked).`);
}

mkdirSync(join(root, "public/audio/briefs"), { recursive: true });
const newlyBaked = [...alreadyOnDisk];
for (const b of targets) {
  const t0 = Date.now();
  const chunks = [];
  let rate = KOKORO_LAW.sampleRate;
  // Stream sentence by sentence: Kokoro caps a single pass at ~510 tokens.
  for await (const part of tts.stream(spokenBrief(b.script), { voice, speed: KOKORO_LAW.speed })) {
    if (!part.audio?.audio?.length) continue;
    chunks.push(part.audio.audio);
    rate = part.audio.sampling_rate;
  }
  if (!chunks.length) {
    console.error(`  ✗ ${b.hullId}: Kokoro returned no audio`);
    process.exitCode = 1;
    continue;
  }
  const { mp3, seconds } = toMp3(chunks, rate);
  writeFileSync(clipPath(b.hullId), mp3);
  if (!b.src) newlyBaked.push(b.hullId);
  console.log(
    `  ✓ ${b.hullId}.mp3  ${seconds.toFixed(1)} s  ${(mp3.length / 1024).toFixed(0)} KB  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

registerBaked(newlyBaked);
console.log("Done. Restart the dev server to pick up the new clips.");
