import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AccessTokenGuard } from './auth/access-token.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter.js';
import { RATE_LIMITS } from './common/http/api.constants.js';
import { createLoggerOptions } from './common/logging/logger.options.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Tests set every variable themselves and never read a developer's local .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    LoggerModule.forRootAsync({ inject: [ConfigService], useFactory: createLoggerOptions }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ...RATE_LIMITS.default }] }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Guards run in this order: rate limit first, then authentication.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
