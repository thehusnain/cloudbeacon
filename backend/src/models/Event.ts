import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';
import { EVENT_TYPES } from '../utils/eventSchema.js';

const eventSchema = new Schema(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'Server', required: true },
    eventId: { type: String, required: true, maxlength: 100 },
    type: { type: String, enum: EVENT_TYPES, required: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    sourceIp: String,
    timestamp: { type: Date, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);
eventSchema.index({ serverId: 1, eventId: 1 }, { unique: true });
eventSchema.index({ serverId: 1, timestamp: -1 });
eventSchema.index({ serverId: 1, sourceIp: 1 });
eventSchema.index({ serverId: 1, type: 1, sourceIp: 1, timestamp: -1 });
export type EventDocument = HydratedDocument<
  InferSchemaType<typeof eventSchema>
>;
export const Event = model('Event', eventSchema);
