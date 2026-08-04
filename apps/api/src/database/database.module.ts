import { Global, Module } from '@nestjs/common';

import { databaseProvider } from './database.provider';
import { DATABASE } from './database.types';

@Global()
@Module({
  providers: [databaseProvider],
  exports: [DATABASE],
})
export class DatabaseModule {}