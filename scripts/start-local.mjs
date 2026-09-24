// Windows working copy: keep dependency files off the external project drive.
// Source remains authoritative in the checkout; this mirror is disposable.
import { cpSync, existsSync, mkdirSync, openSync, statSync, watch, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { readLocalSecrets } from "./local-secrets.mjs";

const source = dirname(dirname(fileURLToPath(import.meta.url)));
const runtime = join(homedir(), ".codex/workspace-deps/tanks-quarry");
mkdirSync(runtime, { recursive: true });
// public/ must be mirrored too: Vite serves the runtime copy, so a clip or skin
// added to the checkout 404s (and briefs fall back to the system voice) without it.
const folders = ["src", "scripts", "server", "migrations", "public"];
const files = [
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "tsconfig.json",
  ".grok/app-env.json",
  "AGENTS.md",
  ".grok/skills/og/SKILL.md",
];
// Copy a file only when it is new or changed, so startup does not recopy all of public/.
function changed(from, to) {
  try {
    const a = statSync(from);
    if (a.isDirectory()) return true;
    const b = statSync(to);
    return a.size !== b.size || a.mtimeMs > b.mtimeMs;
  } catch {
    return true;
  }
}
function sync() {
  for (const name of [...folders, ...files]) {
    if (!existsSync(join(source, name))) continue;
    mkdirSync(dirname(join(runtime, name)), { recursive: true });
    cpSync(join(source, name), join(runtime, name), {
      recursive: true,
      preserveTimestamps: true,
      filter: changed,
    });
  }
}
sync();
if (process.argv.includes("--sync-only")) process.exit(0);
try {
  const response = await fetch("http://127.0.0.1:8080/", {
    signal: AbortSignal.timeout(2000),
  });
  if (response.ok) process.exit(0);
} catch {
  /* Start only when the preview is down. */
}
const log = openSync(join(runtime, "local-preview.log"), "a");
const child = spawn("cmd.exe", ["/d", "/s", "/c", "npm run dev"], {
  cwd: runtime,
  env: { ...process.env, ...readLocalSecrets() },
  stdio: ["ignore", log, log],
  windowsHide: true,
});
writeFileSync(join(runtime, "local-preview.pid"), String(child.pid));
// Copy only the changed file so HMR sees edits made in the authoritative checkout.
const watchers = folders.map((folder) =>
  watch(join(source, folder), { recursive: true }, (_event, name) => {
    if (!name) return;
    const origin = resolve(source, folder, String(name));
    const target = resolve(runtime, folder, String(name));
    if (!origin.startsWith(join(source, folder)) || !target.startsWith(join(runtime, folder)))
      return;
    if (existsSync(origin)) {
      mkdirSync(dirname(target), { recursive: true });
      try {
        cpSync(origin, target, { recursive: true });
      } catch {
        /* Editor may still be saving. */
      }
    }
  }),
);
child.on("exit", (code) => {
  watchers.forEach((w) => w.close());
  process.exit(code ?? 0);
});
