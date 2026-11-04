import { readFile } from 'node:fs/promises';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

let messaging: Promise<Messaging | undefined> | undefined;
function getClient() {
  messaging ??= (async () => {
    try {
      if (!env.FIREBASE_SERVICE_ACCOUNT_PATH)
        throw new Error('missing credentials');
      const account = JSON.parse(
        await readFile(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'),
      );
      return getMessaging(
        initializeApp({ credential: cert(account) }, 'cloud-beacon-push'),
      );
    } catch {
      console.warn(
        'Push notifications disabled: Firebase service account is missing, unreadable or invalid',
      );
      return undefined;
    }
  })();
  return messaging;
}

export async function sendAlertPush(
  userId: string,
  alert: {
    id: string;
    serverId: string;
    severity: string;
    title: string;
    plainDescription: string;
  },
): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    const user = await User.findById(userId).select('fcmTokens').lean();
    const tokens = user?.fcmTokens ?? [];
    if (!tokens.length) return;
    const response = await client.sendEachForMulticast({
      tokens,
      notification: {
        title: `${alert.severity.toUpperCase()} alert: ${alert.title}`,
        body:
          alert.plainDescription.length > 120
            ? `${alert.plainDescription.slice(0, 117)}...`
            : alert.plainDescription,
      },
      data: {
        alertId: alert.id,
        serverId: String(alert.serverId),
        severity: alert.severity,
      },
    });
    const invalid = tokens.filter((_, index) =>
      [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ].includes(response.responses[index]?.error?.code ?? ''),
    );
    if (invalid.length)
      await User.updateOne(
        { _id: userId },
        { $pull: { fcmTokens: { $in: invalid } } },
      );
  } catch {
    console.error('Alert push notification failed');
  }
}
