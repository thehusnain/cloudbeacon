import { Schema, model } from 'mongoose';
const schema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    title: { type: String, required: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      required: true,
    },
    sourceIps: { type: [String], default: [] },
    startedAt: { type: Date, required: true },
    lastActivityAt: { type: Date, required: true },
    alertIds: [{ type: Schema.Types.ObjectId, ref: 'Alert' }],
    eventIds: [{ type: Schema.Types.ObjectId, ref: 'Event' }],
    summary: String,
  },
  { timestamps: true },
);
schema.index({ serverId: 1, status: 1, lastActivityAt: -1 });
schema.index({ serverId: 1, sourceIps: 1 });
schema.index({ serverId: 1, lastActivityAt: -1 });
export const Incident = model('Incident', schema);
