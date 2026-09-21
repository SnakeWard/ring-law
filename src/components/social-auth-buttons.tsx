import { useEffect, useRef, useState } from "react";
import { SOCIAL_SIGN_IN_PROVIDERS, signIn } from "@/lib/auth/client";
import { getSocialAuthStatus } from "@/lib/social-auth-status";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.7 10.3 22 2h-2.2l-6.4 7.2L8.3 2H2l7.7 11.1L2 22h2.2l6.7-7.6L15.7 22H22l-7.3-11.7Zm-2.4 2.7-.8-1.1L5.1 3.5h2.7l4.2 6 0.8 1.1 6.9 9.8h-2.7l-4.7-6.7Z"
      />
    </svg>
  );
}

function providerMark(id: string) {
  if (id === "google") return <GoogleMark />;
  if (id === "twitter") return <XMark />;
  return null;
}

export function SocialAuthButtons({
  callbackURL = "/",
}: {
  callbackURL?: string;
}) {
  const [ready, setReady] = useState<{ google: boolean; twitter: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const resumedX = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getSocialAuthStatus()
      .then((status) => {
        if (!cancelled) setReady(status);
      })
      .catch(() => {
        if (!cancelled) setReady({ google: false, twitter: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || resumedX.current) return;
    if (window.location.hostname === "localhost") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("xsignin") !== "1") return;
    resumedX.current = true;
    url.searchParams.delete("xsignin");
    window.history.replaceState({}, "", url);
    void start("twitter");
    // start is stable enough for a one-shot resume after the 127.0.0.1 bounce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(providerId: "google" | "twitter") {
    setError("");
    setBusy(providerId);
    try {
      await signIn(providerId, { callbackURL, errorCallbackURL: callbackURL });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Sign-in failed";
      setError(
        /provider not found|not found/i.test(raw)
          ? "Google and X are not configured on this host yet. Add the OAuth client id and secret, then restart."
          : raw,
      );
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {SOCIAL_SIGN_IN_PROVIDERS.map((p) => {
        const configured =
          ready == null ? true : p.providerId === "google" ? ready.google : ready.twitter;
        return (
          <button
            key={p.providerId}
            type="button"
            disabled={busy !== null || ready === null || !configured}
            onClick={() => void start(p.providerId)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-bg px-4 text-sm hover:border-reticle disabled:opacity-40"
          >
            {providerMark(p.providerId)}
            {busy === p.providerId
              ? "Opening…"
              : `Continue with ${p.label}`}
          </button>
        );
      })}
      {ready && !ready.google && !ready.twitter ? (
        <p className="text-xs text-subtle">
          Google and X need OAuth clients for this host. Email still works.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
