import { User } from '../models/User.js';

const MAX_DEVICE_TOKENS = 10;

export async function registerDeviceToken(
  userId: string,
  token: string,
): Promise<void> {
  await User.updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } });
  // Trim the current array atomically instead of overwriting a stale snapshot.
  await User.updateOne(
    { _id: userId },
    {
      $push: { fcmTokens: { $each: [], $slice: -MAX_DEVICE_TOKENS } },
    },
  );
}

export async function deleteDeviceToken(
  userId: string,
  token: string,
): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: token } });
}
