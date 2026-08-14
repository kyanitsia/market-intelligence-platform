import { ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns ok when the database responds', async () => {
    const database = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const service = new HealthService(database as never);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('throws when the database is down', async () => {
    const database = {
      execute: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const service = new HealthService(database as never);

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
