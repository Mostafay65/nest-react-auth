import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import type { NewRefreshToken, StoredRefreshToken } from './refresh-token.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';
import { RefreshTokenRecord } from './refresh-token.schema.js';

@Injectable()
export class MongooseRefreshTokenRepository implements RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshTokenRecord.name) private readonly tokens: Model<RefreshTokenRecord>,
  ) {}

  async create(token: NewRefreshToken): Promise<void> {
    await this.tokens.create({ ...token, userId: new Types.ObjectId(token.userId) });
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const record = await this.tokens.findOne({ tokenHash }).lean().exec();
    if (!record) return null;
    return {
      id: record._id.toString(),
      familyId: record.familyId,
      userId: record.userId.toString(),
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
    };
  }

  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    const result = await this.tokens
      .updateOne({ _id: id, usedAt: null }, { $set: { usedAt } })
      .exec();
    return result.modifiedCount === 1;
  }

  async deleteFamily(familyId: string): Promise<void> {
    await this.tokens.deleteMany({ familyId }).exec();
  }
}
