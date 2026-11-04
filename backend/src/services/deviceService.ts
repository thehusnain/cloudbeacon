import { User } from '../models/User.js';

const MAX_DEVICE_TOKENS = 10;

export async function registerDeviceToken(
  userId: string,
  token: string,
): Promise<void> {
  await User.updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } });
  const user = await User.findById(userId).select('fcmTokens').lean();
  if (!user || user.fcmTokens.length <= MAX_DEVICE_TOKENS) return;
  await User.updateOne(
    { _id: userId },
    { $set: { fcmTokens: user.fcmTokens.slice(-MAX_DEVICE_TOKENS) } },
  );
}

export async function deleteDeviceToken(
  userId: string,
  token: string,
): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: token } });
}
