import { Schema, model } from 'mongoose';
import { EVENT_TYPES } from '../utils/eventSchema.js';

const ruleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    enabled: { type: Boolean, default: true, required: true },
    conditions: {
      threshold: { type: Number, min: 1 },
      windowSeconds: { type: Number, min: 1 },
      groupBy: { type: String, enum: ['sourceIp'] },
    },
    action: { type: String, enum: ['alert', 'block'], required: true },
    scope: { serverId: { type: Schema.Types.ObjectId, ref: 'Server' } },
  },
  { timestamps: true },
);
ruleSchema.index({ 'scope.serverId': 1, type: 1, enabled: 1 });
ruleSchema.index({ updatedAt: -1 });
export const Rule = model('Rule', ruleSchema);
