import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import type { Connection } from 'mongoose';

import { CacheHealthIndicator } from './cache.health-indicator.js';
import { InternalUrl } from './health.constants.js';

@Controller(InternalUrl.HEALTH_CHECK)
@ApiTags('Public')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    @InjectConnection() private readonly connection: Connection,
    private readonly cache: CacheHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  readiness() {
    return this.health.check([
      async () =>
        this.mongoose.pingCheck('database', { connection: this.connection }).withTimeout(2_000),
      async () => this.cache.check(),
    ]);
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
    };
  }
}
