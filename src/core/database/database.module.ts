import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { ENV } from '../../shared/enums/index.js';
import * as Schemas from '../../shared/schemas/index.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>(ENV.DATABASE_URL),
      }),
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
