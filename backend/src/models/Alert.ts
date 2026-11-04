import { Schema, model } from 'mongoose';

const alertSchema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    ruleId: { type: Schema.Types.ObjectId, ref: 'Rule', required: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    title: { type: String, required: true },
    plainDescription: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved'],
      default: 'open',
      required: true,
    },
    eventIds: [{ type: Schema.Types.ObjectId, ref: 'Event' }],
    sourceIp: String,
  },
  { timestamps: true },
);
alertSchema.index({ serverId: 1, status: 1, createdAt: -1 });
alertSchema.index({ serverId: 1, ruleId: 1, sourceIp: 1, createdAt: 1 });
export const Alert = model('Alert', alertSchema);
