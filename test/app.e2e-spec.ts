import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { HealthIndicatorService, MongooseHealthIndicator, TerminusModule } from '@nestjs/terminus';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { vi } from 'vitest';

import { CacheHealthIndicator } from '@/core/healthcheck/cache.health-indicator.js';
import { HealthcheckController } from '@/core/healthcheck/healthcheck.controller.js';

vi.setConfig({ testTimeout: 30000 });

describe('Application (e2e)', () => {
  let app: INestApplication;
  let databaseUp = true;
  let cacheUp = true;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthcheckController],
      providers: [
        { provide: getConnectionToken(), useValue: {} satisfies Partial<Connection> },
        {
          provide: MongooseHealthIndicator,
          inject: [HealthIndicatorService],
          useFactory: (indicator: HealthIndicatorService) => ({
            pingCheck: (_key: string, _options: { connection: Connection }) =>
              indicator.check('database').attempt(async () => {
                if (!databaseUp) {
                  throw new Error('Database unavailable');
                }
              }),
          }),
        },
        {
          provide: CacheHealthIndicator,
          inject: [HealthIndicatorService],
          useFactory: (indicator: HealthIndicatorService) => ({
            check: () =>
              indicator.check('cache').attempt(async () => {
                if (!cacheUp) {
                  throw new Error('Cache unavailable');
                }
              }),
          }),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    databaseUp = true;
    cacheUp = true;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns readiness when dependencies are available', async () => {
    await request(app.getHttpServer()).get('/healthcheck').expect(200);
  });

  it('returns 503 when the database is unavailable', async () => {
    databaseUp = false;
    await request(app.getHttpServer()).get('/healthcheck').expect(503);
  });

  it('returns 503 when the cache is unavailable', async () => {
    cacheUp = false;
    await request(app.getHttpServer()).get('/healthcheck').expect(503);
  });

  it('keeps process-only liveness available', async () => {
    databaseUp = false;
    cacheUp = false;
    await request(app.getHttpServer()).get('/healthcheck/live').expect(200, { status: 'ok' });
  });
});
