/** Mirrors AppUser; kept here to avoid a cycle with use-current-user. */
export type HeldUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

/** Last known signed-in user. Survives route changes; only sign-out clears it. */
let held: HeldUser | null = null;

export function holdUser(user: HeldUser | null) {
  held = user;
}

export function heldUser(): HeldUser | null {
  return held;
}
