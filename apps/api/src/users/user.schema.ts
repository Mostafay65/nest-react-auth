import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Lengths are checked once, by the contract schemas, before anything reaches this
 * layer. They count Unicode code points, so an emoji like 😀 counts once; Mongoose's
 * `maxlength` counts UTF-16 units, so it would turn a valid 50-emoji name into a 500.
 */
@Schema({ collection: 'users', timestamps: true })
export class UserRecord {
  /** Stored lower-cased; the unique index makes sign-up race-safe. */
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  /** argon2id hash. Left out of every query unless explicitly selected. */
  @Prop({ required: true, select: false })
  passwordHash: string;

  createdAt: Date;
  updatedAt: Date;
}

export const UserRecordSchema = SchemaFactory.createForClass(UserRecord);
