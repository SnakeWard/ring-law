import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

async function handle(request: Request): Promise<Response> {
  try {
    return await auth.handler(request);
  } catch (err) {
    console.error("[auth]", err);
    const message = err instanceof Error ? err.message : "auth failed";
    return new Response(JSON.stringify({ message, code: "INTERNAL" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
