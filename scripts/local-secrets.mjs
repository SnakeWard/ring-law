/**
 * Optional local OAuth / auth secrets from the user home directory.
 * Never commit these. Workspace `.env` files are not used.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

const SECRETS_DIR = join(homedir(), ".grok", "secrets");

const CANDIDATES = [
  join(SECRETS_DIR, "tanks-oauth.json"),
  join(SECRETS_DIR, "ring-law.json"),
];

const ALLOWED = new Set([
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TWITTER_CLIENT_ID",
  "TWITTER_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DATABASE_URL",
]);

function fromFlat(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!ALLOWED.has(key) || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    env[key] = trimmed;
  }
  return env;
}

function fromGoogleDownload(parsed) {
  const web = parsed && typeof parsed === "object" ? parsed.web : null;
  if (!web || typeof web !== "object") return {};
  const env = {};
  if (typeof web.client_id === "string" && web.client_id.trim()) {
    env.GOOGLE_CLIENT_ID = web.client_id.trim();
  }
  if (typeof web.client_secret === "string" && web.client_secret.trim()) {
    env.GOOGLE_CLIENT_SECRET = web.client_secret.trim();
  }
  return env;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function readLocalSecrets() {
  const env = {};
  try {
    for (const name of readdirSync(SECRETS_DIR)) {
      if (!name.startsWith("client_secret_") || !name.endsWith(".json")) continue;
      Object.assign(env, fromGoogleDownload(readJson(join(SECRETS_DIR, name))));
    }
  } catch {
    /* secrets dir missing */
  }
  for (const path of CANDIDATES) {
    Object.assign(env, fromFlat(readJson(path)));
  }
  return env;
}
