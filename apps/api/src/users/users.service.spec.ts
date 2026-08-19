import { NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';
import type { PublicUser } from '../auth/auth.types';

describe('UsersService', () => {
  const publicUser: PublicUser = {
    id: 'user-id',
    email: 'test@example.com',
    displayName: null,
    avatarUrl: null,
    defaultCurrency: 'USD',
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
  };

  function createDatabase(rows: PublicUser[]) {
    return {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    };
  }

  it('returns the current user profile', async () => {
    const database = createDatabase([publicUser]);
    const service = new UsersService(database as never);

    await expect(service.findMe('user-id')).resolves.toEqual(publicUser);
  });

  it('throws when the user does not exist', async () => {
    const database = createDatabase([]);
    const service = new UsersService(database as never);

    await expect(service.findMe('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
