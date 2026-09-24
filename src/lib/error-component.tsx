import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-dead" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            window.location.reload();
          }}
          className="min-h-11 rounded-md bg-reticle px-4 text-sm font-medium text-bg"
        >
          Reload
        </button>
        <a
          href="/"
          className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm"
        >
          Back to the garage
        </a>
      </div>
    </main>
  );
}
