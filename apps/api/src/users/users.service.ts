import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import { users } from '../database/schema';
import type { PublicUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findMe(userId: string): Promise<PublicUser> {
    const [user] = await this.database
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        defaultCurrency: users.defaultCurrency,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
