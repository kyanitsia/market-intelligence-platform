import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { FactoryProvider } from '@nestjs/common';
import postgres = require('postgres');

import * as schema from './schema';
import { DATABASE, type Database } from './database.types';

export const databaseProvider: FactoryProvider<Database> = {
  provide: DATABASE,

  inject: [ConfigService],

  useFactory: (configService: ConfigService) => {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

    const client = postgres(databaseUrl, {
      max: 10,
      prepare: false,
    });

    return drizzle(client, { schema });
  },
};
