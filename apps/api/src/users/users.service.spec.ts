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

  function createDatabase(options: {
    selectRows: PublicUser[];
    updateRows?: PublicUser[];
  }) {
    return {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(options.selectRows),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest
              .fn()
              .mockResolvedValue(options.updateRows ?? options.selectRows),
          }),
        }),
      }),
    };
  }

  it('returns the current user profile', async () => {
    const database = createDatabase({ selectRows: [publicUser] });
    const service = new UsersService(database as never);

    await expect(service.findMe('user-id')).resolves.toEqual(publicUser);
  });

  it('throws when the user does not exist', async () => {
    const database = createDatabase({ selectRows: [] });
    const service = new UsersService(database as never);

    await expect(service.findMe('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates display name, avatar, and default currency', async () => {
    const updated = {
      ...publicUser,
      displayName: 'Ada',
      avatarUrl: 'https://example.com/ada.png',
      defaultCurrency: 'EUR' as const,
    };
    const database = createDatabase({
      selectRows: [publicUser],
      updateRows: [updated],
    });
    const service = new UsersService(database as never);

    await expect(
      service.updateMe('user-id', {
        displayName: 'Ada',
        avatarUrl: 'https://example.com/ada.png',
        defaultCurrency: 'EUR',
      }),
    ).resolves.toEqual(updated);
  });

  it('clears optional profile fields when they are blank', async () => {
    const updated = { ...publicUser, displayName: null, avatarUrl: null };
    const database = createDatabase({
      selectRows: [publicUser],
      updateRows: [updated],
    });
    const set = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([updated]),
      }),
    });

    database.update.mockReturnValue({ set });

    const service = new UsersService(database as never);

    await service.updateMe('user-id', {
      displayName: '  ',
      avatarUrl: '',
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: null,
        avatarUrl: null,
      }),
    );
  });
});
