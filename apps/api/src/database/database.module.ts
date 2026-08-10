import { Global, Module } from '@nestjs/common';

import { DatabaseConnection } from './database.connection';
import { databaseProvider } from './database.provider';
import { DATABASE } from './database.types';

@Global()
@Module({
  providers: [DatabaseConnection, databaseProvider],
  exports: [DATABASE],
})
export class DatabaseModule {}
