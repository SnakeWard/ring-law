import { createServerFn } from "@tanstack/react-start";

export const getSocialAuthStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { googleDirect, twitterDirect } = await import(
      "@/lib/auth/social-direct"
    );
    return {
      google: Boolean(googleDirect),
      twitter: Boolean(twitterDirect),
    };
  },
);
