import { Schema, model } from 'mongoose';

const enrollmentKeySchema = new Schema({
  serverId: {
    type: Schema.Types.ObjectId,
    ref: 'Server',
    required: true,
    index: true,
  },
  keyHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});
enrollmentKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
enrollmentKeySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const safe: Partial<typeof ret> = { ...ret };
    delete safe.keyHash;
    return safe;
  },
});

export const EnrollmentKey = model('EnrollmentKey', enrollmentKeySchema);
