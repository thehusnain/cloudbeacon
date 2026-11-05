import { Schema, model } from 'mongoose';

const commandSchema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    type: { type: String, enum: ['block_ip', 'unblock_ip'], required: true },
    payload: {
      ip: { type: String, required: true },
      durationSeconds: { type: Number, min: 1 },
    },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'done', 'failed'],
      default: 'pending',
      required: true,
    },
    deliveredAt: Date,
    completedAt: Date,
    resultMessage: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, enum: ['manual', 'rule'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
commandSchema.index({ serverId: 1, status: 1, createdAt: 1 });
commandSchema.index(
  { serverId: 1, type: 1, 'payload.ip': 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'block_ip', status: 'pending' },
  },
);
commandSchema.index({ serverId: 1, createdAt: -1 });
commandSchema.index({ serverId: 1, status: 1, deliveredAt: 1 });
export const Command = model('Command', commandSchema);
