export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  familyId: string;
  type: 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  defaultCurrency: 'USD' | 'EUR';
  createdAt: Date;
}

export interface AuthenticationResult {
  accessToken: string;
  user: PublicUser;
}

export interface RefreshResult {
  authentication: AuthenticationResult;
  refreshToken: string;
}
