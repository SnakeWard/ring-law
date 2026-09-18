import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";

function localOriginOk(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".grok-sandbox.com")
  );
}

export function EmailAuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!emailAndPasswordEnabled) return null;

  const originOk = localOriginOk();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim(),
            })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? "Sign-in failed");
        setBusy(false);
        return;
      }
      await authClient.getSession();
      onDone?.();
      if (typeof window !== "undefined") window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-2" onSubmit={(e) => void submit(e)}>
      {!originOk && (
        <p className="text-sm text-warn">
          Open the yard at{" "}
          <span className="font-mono">http://127.0.0.1:8080</span> — this host
          is not a trusted origin.
        </p>
      )}
      {mode === "up" && (
        <input
          type="text"
          autoComplete="nickname"
          placeholder="Callsign"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm"
        />
      )}
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm"
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete={mode === "up" ? "new-password" : "current-password"}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm"
      />
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !originOk}
        className="min-h-11 w-full rounded-md bg-reticle px-4 text-sm font-medium text-bg disabled:opacity-40"
      >
        {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
      </button>
      <button
        type="button"
        className="w-full text-center font-mono text-[11px] text-muted hover:text-fg"
        onClick={() => setMode(mode === "up" ? "in" : "up")}
      >
        {mode === "up" ? "Already have an account" : "Need an account"}
      </button>
    </form>
  );
}
