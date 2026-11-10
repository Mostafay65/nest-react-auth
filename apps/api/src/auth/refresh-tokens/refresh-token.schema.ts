import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ collection: 'refresh_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class RefreshTokenRecord {
  @Prop({ required: true, index: true })
  familyId: string;

  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** SHA-256 of the token. The token itself is never stored. */
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const RefreshTokenRecordSchema = SchemaFactory.createForClass(RefreshTokenRecord);

// MongoDB removes each token once it expires; the TTL monitor runs every 60 seconds.
RefreshTokenRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
