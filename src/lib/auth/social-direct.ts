/**
 * Direct Google / X OAuth for this app's Better Auth (not the Grok broker).
 *
 * The broker preview client only accepts `*.grok-sandbox.com` callbacks, so
 * localhost and the public RING LAW hosts must talk to Google and X themselves.
 * Secrets stay server-only — never import this module from client code.
 */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

function pair(idKeys: string[], secretKeys: string[]) {
  const clientId = idKeys.map(env).find(Boolean);
  const clientSecret = secretKeys.map(env).find(Boolean);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** X forbids `localhost` in the callback allowlist. Local always uses 127.0.0.1. */
function twitterRedirectURI(): string {
  return "http://127.0.0.1:8080/api/auth/callback/twitter";
}

export const googleDirect = pair(
  ["GOOGLE_CLIENT_ID"],
  ["GOOGLE_CLIENT_SECRET"],
);

export const twitterDirect = pair(
  ["TWITTER_CLIENT_ID", "X_CLIENT_ID"],
  ["TWITTER_CLIENT_SECRET", "X_CLIENT_SECRET"],
);

export type DirectSocialProviders = {
  google?: {
    clientId: string;
    clientSecret: string;
    prompt: "select_account";
  };
  twitter?: {
    clientId: string;
    clientSecret: string;
    disableDefaultScope: true;
    scope: string[];
    redirectURI?: string;
  };
};

export function directSocialProviders(): DirectSocialProviders | undefined {
  const socialProviders: DirectSocialProviders = {};
  if (googleDirect) {
    socialProviders.google = {
      clientId: googleDirect.clientId,
      clientSecret: googleDirect.clientSecret,
      prompt: "select_account",
    };
  }
  if (twitterDirect) {
    socialProviders.twitter = {
      clientId: twitterDirect.clientId,
      clientSecret: twitterDirect.clientSecret,
      // Skip users.email — X rejects it unless "Request email from users" is on.
      disableDefaultScope: true,
      scope: ["users.read", "tweet.read", "offline.access"],
      // Pin loopback for local X. On Vercel let Better Auth use the request host
      // so the custom domain and *.vercel.app both keep their own session cookie.
      ...(env("VERCEL") === "1" || env("VERCEL_ENV")
        ? {}
        : { redirectURI: twitterRedirectURI() }),
    };
  }
  return Object.keys(socialProviders).length ? socialProviders : undefined;
}

export const DIRECT_SOCIAL_IDS: string[] = [
  ...(googleDirect ? (["google"] as const) : []),
  ...(twitterDirect ? (["twitter"] as const) : []),
];
