import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from '@nest-react-auth/contracts';

@Schema({ collection: 'users', timestamps: true })
export class UserRecord {
  /** Stored lower-cased; the unique index makes sign-up race-safe. */
  @Prop({ required: true, unique: true, trim: true, lowercase: true, maxlength: EMAIL_MAX_LENGTH })
  email: string;

  @Prop({ required: true, trim: true, maxlength: NAME_MAX_LENGTH })
  name: string;

  /** argon2id hash. Left out of every query unless explicitly selected. */
  @Prop({ required: true, select: false })
  passwordHash: string;

  createdAt: Date;
  updatedAt: Date;
}

export const UserRecordSchema = SchemaFactory.createForClass(UserRecord);
