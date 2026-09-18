import type { ReactNode } from "react";
import { useCurrentUserState } from "./use-current-user";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`).
 * Keeps Better Auth `useSession()` subscribed on every route so editor → yard
 * does not flash the sign-in card.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useCurrentUserState();
  return <>{children}</>;
}
