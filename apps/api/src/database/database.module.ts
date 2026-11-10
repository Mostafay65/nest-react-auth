import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { Env } from '../config/env.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        // Defence in depth: request bodies are already validated as plain
        // strings, but this also neutralises `{ "$ne": null }`-style operator
        // injection in any query filter built later.
        mongoose.set('sanitizeFilter', true);
        return {
          uri: config.get('MONGODB_URI', { infer: true }),
          serverSelectionTimeoutMS: 5_000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
