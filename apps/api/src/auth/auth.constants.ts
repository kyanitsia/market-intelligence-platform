export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_DEFAULT_TTL = '15m';
export const REFRESH_TOKEN_DEFAULT_TTL = '30d';

export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'] as const;
export const GOOGLE_OAUTH_PROVIDER = 'google';
export const GOOGLE_LINK_TOKEN_TTL = '10m';
export const GOOGLE_OAUTH_STATE_TTL = '10m';
