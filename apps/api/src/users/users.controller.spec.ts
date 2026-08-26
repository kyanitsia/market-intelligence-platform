import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

describe('UsersController', () => {
  const currentUser: AuthenticatedUser = {
    id: 'user-id',
    email: 'test@example.com',
  };
  const profile = {
    id: 'user-id',
    email: 'test@example.com',
    displayName: 'Ada',
    avatarUrl: 'https://example.com/ada.png',
    defaultCurrency: 'EUR' as const,
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
  };

  let usersService: { findMe: jest.Mock; updateMe: jest.Mock };
  let controller: UsersController;

  beforeEach(() => {
    usersService = {
      findMe: jest.fn().mockResolvedValue(profile),
      updateMe: jest.fn().mockResolvedValue(profile),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('reads the current user profile', async () => {
    await expect(controller.findMe(currentUser)).resolves.toEqual(profile);
    expect(usersService.findMe).toHaveBeenCalledWith('user-id');
  });

  it('updates display name, avatar, and default currency', async () => {
    const dto = {
      displayName: 'Ada',
      avatarUrl: 'https://example.com/ada.png',
      defaultCurrency: 'EUR' as const,
    };

    await expect(controller.updateMe(currentUser, dto)).resolves.toEqual(
      profile,
    );
    expect(usersService.updateMe).toHaveBeenCalledWith('user-id', dto);
  });
});
