import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isObjectIdOrHexString, type Model, mongo, type Types } from 'mongoose';
import type { NewUser, User, UserWithPassword } from './user.js';
import { UserRecord } from './user.schema.js';
import { EmailAlreadyRegisteredError } from './users.errors.js';
import { UsersRepository } from './users.repository.js';

type StoredUser = Pick<UserRecord, 'email' | 'name' | 'createdAt'> & { _id: Types.ObjectId };

const DUPLICATE_KEY = 11_000;

@Injectable()
export class MongooseUsersRepository implements UsersRepository {
  constructor(@InjectModel(UserRecord.name) private readonly users: Model<UserRecord>) {}

  async create(user: NewUser): Promise<User> {
    try {
      return toUser(await this.users.create(user));
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    if (!isObjectIdOrHexString(id)) return null;
    const record = await this.users.findById(id).lean().exec();
    return record ? toUser(record) : null;
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const record = await this.users.findOne({ email }).select('+passwordHash').lean().exec();
    return record ? { ...toUser(record), passwordHash: record.passwordHash } : null;
  }
}

const toUser = (record: StoredUser): User => ({
  id: record._id.toString(),
  email: record.email,
  name: record.name,
  createdAt: record.createdAt,
});
