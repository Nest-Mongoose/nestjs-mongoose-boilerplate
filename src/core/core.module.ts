import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisClusterStore, redisStore } from 'cache-manager-redis-yet';

import { Configuration } from '@/shared/config';
import { CACHE_TYPE, ENV, FLOW, QUEUE, REDIS_MODE } from '@/shared/enums';

import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { UploadModule } from './upload/upload.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [Configuration] }),
    DatabaseModule,
    UploadModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const cacheMode = configService.get(ENV.CACHE_MODE);
        const prefix = `{\`${configService.get(ENV.APP_NAME)}\`}:${configService.get(ENV.APP_ENV)}`;
        const redisMode = configService.get(ENV.REDIS_MODE);
        const url = configService.get(ENV.REDIS_URL);
        const ttl = +configService.get(ENV.CACHE_TTL);

        const result =
          cacheMode === CACHE_TYPE.REDIS
            ? {
                store:
                  redisMode === REDIS_MODE.SINGLE
                    ? await redisStore({
                        url,
                        keyPrefix: prefix,
                      })
                    : await redisClusterStore({
                        rootNodes: [{ url }],
                        useReplicas: true,
                        keyPrefix: prefix,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      } as any),
                ttl,
              }
            : {
                ttl,
              };

        return result;
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const prefix = `{\`${configService.get(ENV.APP_NAME)}\`}:${configService.get(ENV.APP_ENV)}`;
        const url = configService.get(ENV.REDIS_URL);

        return {
          connection: { url },
          defaultJobOptions: {
            removeOnComplete: {
              age: 3600,
              count: 100,
            },
            removeOnFail: {
              age: 3600,
              count: 100,
            },
            attempts: 3,
          },
          prefix,
        };
      },
    }),
    QueueModule.register({
      queues: Object.values(QUEUE),
      flows: Object.values(FLOW),
    }),
  ],

  providers: [Logger, ConfigService],
  exports: [ConfigService, DatabaseModule, UploadModule, QueueModule, Logger, CacheModule],
})
export class CoreModule {}
