import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.types';
import type { HealthResponse } from './health.types';

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.database.execute(sql`select 1`);

      return {
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
