import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    fcmTokens: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const safe: Partial<typeof ret> = { ...ret };
    delete safe.passwordHash;
    return safe;
  },
});

export type UserData = InferSchemaType<typeof userSchema>;
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export const User = model('User', userSchema);

export function toAuthUser(
  user: Pick<UserData, 'name' | 'email'> & { _id: { toString(): string } },
): AuthUser {
  return { id: user._id.toString(), name: user.name, email: user.email };
}
