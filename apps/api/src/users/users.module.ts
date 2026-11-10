import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongooseUsersRepository } from './mongoose-users.repository.js';
import { UserRecord, UserRecordSchema } from './user.schema.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserRecord.name, schema: UserRecordSchema }])],
  controllers: [UsersController],
  providers: [UsersService, { provide: UsersRepository, useClass: MongooseUsersRepository }],
  exports: [UsersService],
})
export class UsersModule {}
