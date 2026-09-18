import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { EmailAuthForm } from "@/components/email-auth-form";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { isPending } = useCurrentUserState();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
        <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">
          RING LAW
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted">
          Your silver, XP, and researched hulls follow this account. Gate
          viewers are already signed in.
        </p>
        {isPending ? (
          <div className="h-11 w-full animate-pulse rounded-md bg-raised" />
        ) : authEnabled ? (
          <div className="flex flex-col gap-3">
            <EmailAuthForm />
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
              Google / X
            </p>
            <p className="text-xs text-subtle">
              Email works on this host. Google/X need the broker callback
              registered for this domain.
            </p>
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="min-h-11 w-full rounded-md border border-line bg-bg px-4 text-sm hover:border-reticle"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <SignedIn>
          <div className="space-y-3 border-t border-line pt-4">
            <UserButton />
            <Link
              to="/"
              className="inline-flex min-h-11 items-center text-sm text-reticle"
            >
              Back to the yard
            </Link>
          </div>
        </SignedIn>
      </div>
    </main>
  );
}
