import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres = require('postgres');

import * as schema from './schema';
import type { Database } from './database.types';

@Injectable()
export class DatabaseConnection implements OnModuleDestroy {
  private readonly client: ReturnType<typeof postgres>;
  readonly db: Database;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

    this.client = postgres(databaseUrl, {
      max: 10,
      prepare: false,
    });

    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}
