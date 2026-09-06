export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface GoogleLinkTokenPayload {
  type: 'google-link';
  email: string;
  googleSub: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface OAuthStatePayload {
  type: 'oauth-state';
  nonce: string;
}

export const ACCOUNT_LINKING_REQUIRED = 'ACCOUNT_LINKING_REQUIRED';
