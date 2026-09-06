import { ConflictException } from '@nestjs/common';

import { ACCOUNT_LINKING_REQUIRED } from '../google/google-oauth.types';

export class AccountLinkingRequiredException extends ConflictException {
  constructor(linkToken: string) {
    super({
      statusCode: 409,
      code: ACCOUNT_LINKING_REQUIRED,
      message:
        'An account with this email already exists. Confirm linking to continue.',
      linkToken,
    });
  }
}
