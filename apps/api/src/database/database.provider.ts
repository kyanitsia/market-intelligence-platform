import type { FactoryProvider } from '@nestjs/common';

import { DatabaseConnection } from './database.connection';
import { DATABASE, type Database } from './database.types';

export const databaseProvider: FactoryProvider<Database> = {
  provide: DATABASE,
  inject: [DatabaseConnection],
  useFactory: (connection: DatabaseConnection) => connection.db,
};
