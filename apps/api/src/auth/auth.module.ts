import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { createJwtOptions } from './jwt.options.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokenCookie } from './refresh-token.cookie.js';
import { MongooseRefreshTokenRepository } from './refresh-tokens/mongoose-refresh-token.repository.js';
import { RefreshTokenRepository } from './refresh-tokens/refresh-token.repository.js';
import {
  RefreshTokenRecord,
  RefreshTokenRecordSchema,
} from './refresh-tokens/refresh-token.schema.js';
import { RefreshTokenService } from './refresh-tokens/refresh-token.service.js';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: RefreshTokenRecord.name, schema: RefreshTokenRecordSchema },
    ]),
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: createJwtOptions }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    PasswordHasher,
    RefreshTokenCookie,
    RefreshTokenService,
    { provide: RefreshTokenRepository, useClass: MongooseRefreshTokenRepository },
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
