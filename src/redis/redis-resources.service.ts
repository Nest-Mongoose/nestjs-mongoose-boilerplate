import { type Configuration, configuration } from '@/config/configuration.js';
import { CacheMode, RedisMode } from '@/config/environment.js';
import KeyvRedis, { createCluster } from '@keyv/redis';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  type LoggerService,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Cluster as IORedisCluster } from 'ioredis';
import Keyv from 'keyv';

type BullRedisConnection = IORedisCluster | { url: string };

@Injectable()
export class RedisResourcesService implements OnApplicationShutdown {
  readonly cacheStore?: Keyv;
  readonly bullConnection: BullRedisConnection;

  private readonly bullCluster?: IORedisCluster;
  private readonly cacheCluster?: { destroy: () => void };

  constructor(@Inject(configuration.KEY) config: Configuration) {
    const { app, cache, redis } = config;
    const { mode: redisMode, url } = redis;

    if (cache.mode === CacheMode.Redis) {
      const prefix = `{${app.name}}:${app.environment}`;
      const cacheCluster =
        redisMode === RedisMode.Cluster ? this.createCacheCluster(url) : undefined;
      this.cacheCluster = cacheCluster;
      const redisAdapter =
        redisMode === RedisMode.Single
          ? new KeyvRedis(url, { namespace: prefix })
          : new KeyvRedis(cacheCluster!, { namespace: prefix });

      this.cacheStore = new Keyv({
        store: redisAdapter,
        ttl: cache.ttl,
      });
      this.cacheStore.on('error', (error) => Logger.error(error, undefined, 'Cache'));
    }

    if (redisMode === RedisMode.Cluster) {
      this.bullCluster = this.createBullCluster(url);
      this.bullConnection = this.bullCluster;
    } else {
      this.bullConnection = { url };
    }
  }

  async onApplicationShutdown() {
    if (this.bullCluster && this.bullCluster.status !== 'end') {
      await this.withTimeout(this.bullCluster.quit(), 3_000).catch(() => {
        this.bullCluster?.disconnect();
      });
    }
  }

  destroyCacheCluster() {
    this.cacheCluster?.destroy();
  }

  private async withTimeout<T>(operation: Promise<T>, timeout: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Shutdown timed out after ${timeout}ms`)), timeout);
      timer.unref();
    });

    try {
      return await Promise.race([operation, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  private createCacheCluster(url: string) {
    const discoveryUrl = new URL(url);
    const cluster = createCluster({
      rootNodes: [{ url }],
      useReplicas: true,
      defaults: {
        username: discoveryUrl.username ? decodeURIComponent(discoveryUrl.username) : undefined,
        password: discoveryUrl.password ? decodeURIComponent(discoveryUrl.password) : undefined,
        socket: discoveryUrl.protocol === 'rediss:' ? { tls: true } : undefined,
      },
    });
    cluster.on('error', (error) => Logger.error(error, undefined, 'RedisCluster'));
    return cluster;
  }

  private createBullCluster(url: string) {
    const discoveryUrl = new URL(url);
    const cluster = new IORedisCluster(
      [{ host: discoveryUrl.hostname, port: +(discoveryUrl.port || 6379) }],
      {
        redisOptions: {
          username: discoveryUrl.username ? decodeURIComponent(discoveryUrl.username) : undefined,
          password: discoveryUrl.password ? decodeURIComponent(discoveryUrl.password) : undefined,
          tls: discoveryUrl.protocol === 'rediss:' ? {} : undefined,
          maxRetriesPerRequest: null,
        },
      },
    );
    cluster.on('error', (error) => Logger.error(error, undefined, 'BullRedisCluster'));
    return cluster;
  }
}

@Injectable()
export class RuntimeLifecycleService implements OnApplicationShutdown {
  private logger?: LoggerService;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly redisResources: RedisResourcesService,
  ) {}

  setLogger(logger: LoggerService) {
    this.logger = logger;
  }

  async onApplicationShutdown() {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.cache.disconnect(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Cache shutdown timed out')), 3_000);
          timer.unref();
        }),
      ]);
    } catch {
      this.redisResources.destroyCacheCluster();
    } finally {
      clearTimeout(timer);
      const logger = this.logger as
        (LoggerService & { getWinstonLogger?: () => { close: () => void } }) | undefined;
      logger?.getWinstonLogger?.().close();
    }
  }
}
