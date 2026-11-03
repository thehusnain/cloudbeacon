import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
} from 'mongoose';

const serverSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    hostname: String,
    os: String,
    ip: String,
    agentVersion: String,
    status: {
      type: String,
      enum: ['pending', 'online', 'offline'],
      default: 'pending',
      required: true,
    },
    lastHeartbeat: { type: Date, default: null },
    agentTokenHash: { type: String, select: false, index: true },
  },
  { timestamps: true },
);

serverSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const safe: Partial<typeof ret> = { ...ret };
    delete safe.agentTokenHash;
    return safe;
  },
});

export type ServerDocument = HydratedDocument<
  InferSchemaType<typeof serverSchema>
>;
export const Server = model('Server', serverSchema);

export function toPublicServer(server: ServerDocument) {
  return {
    id: server.id as string,
    owner: server.owner.toString(),
    name: server.name,
    hostname: server.hostname,
    os: server.os,
    ip: server.ip,
    agentVersion: server.agentVersion,
    status: server.status,
    lastHeartbeat: server.lastHeartbeat,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  };
}
