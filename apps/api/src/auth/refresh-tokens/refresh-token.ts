/** A refresh token as stored: only its hash is persisted, never the token itself. */
export interface StoredRefreshToken {
  id: string;
  /** Every token issued from one sign-in shares a family. Reuse revokes the whole family. */
  familyId: string;
  userId: string;
  expiresAt: Date;
  /** Set when the token is exchanged. A used token presented again means it leaked. */
  usedAt: Date | null;
}

export interface NewRefreshToken {
  familyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** A freshly issued token. `token` is the only copy of the secret and goes into the cookie. */
export interface IssuedRefreshToken {
  token: string;
  userId: string;
  expiresAt: Date;
}
