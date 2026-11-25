import { type Configuration, configuration } from '@/config/configuration.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import * as Schemas from './schemas/index.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [configuration.KEY],
      useFactory: (config: Configuration) => {
        if (!config.database.url) {
          throw new Error('DATABASE_URL is required');
        }

        return { uri: config.database.url };
      },
    }),
    MongooseModule.forFeature(
      Object.entries(Schemas)
        .filter(([key]) => key.endsWith('Schema'))
        .map(([key, schema]) => ({
          name: key.replace('Schema', ''),
          schema,
        })),
    ),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
