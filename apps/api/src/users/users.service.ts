import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { PublicUser } from '../auth/auth.types';
import { DATABASE, type Database } from '../database/database.types';
import { users } from '../database/schema';
import type { UpdateMeDto } from './dto/update-me.dto';

const publicUserColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  defaultCurrency: users.defaultCurrency,
  createdAt: users.createdAt,
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findMe(userId: string): Promise<PublicUser> {
    const [user] = await this.database
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<PublicUser> {
    await this.findMe(userId);

    const [updated] = await this.database
      .update(users)
      .set({
        ...(dto.displayName !== undefined
          ? { displayName: this.normalizeOptionalText(dto.displayName) }
          : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: this.normalizeOptionalText(dto.avatarUrl) }
          : {}),
        ...(dto.defaultCurrency !== undefined
          ? { defaultCurrency: dto.defaultCurrency }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning(publicUserColumns);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }

  private normalizeOptionalText(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }
}
