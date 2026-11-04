import { expect, it, vi } from 'vitest';
import { User } from '../src/models/User.js';
import { env } from '../src/config/env.js';
const mocks = vi.hoisted(() => ({ send: vi.fn(), read: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.read }));
vi.mock('firebase-admin/app', () => ({
  cert: vi.fn(),
  initializeApp: vi.fn(),
}));
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast: mocks.send }),
}));
const alert = {
  id: 'a',
  serverId: 's',
  severity: 'high',
  title: 'SSH brute force',
  plainDescription: 'Attempts from an IP',
};
it('removes invalid tokens, keeps valid tokens, skips empty users and catches failures', async () => {
  env.FIREBASE_SERVICE_ACCOUNT_PATH = '/mock.json';
  mocks.read.mockResolvedValue('{}');
  const { sendAlertPush } = await import('../src/services/pushService.js');
  const user = await User.create({
    name: 'Push User',
    email: 'push@example.com',
    passwordHash: 'unused',
    fcmTokens: ['good', 'bad'],
  });
  mocks.send.mockResolvedValue({
    responses: [
      { success: true },
      { error: { code: 'messaging/registration-token-not-registered' } },
    ],
  });
  await sendAlertPush(user.id, alert);
  expect((await User.findById(user.id))?.fcmTokens).toEqual(['good']);
  mocks.send.mockRejectedValue(new Error('FCM failed'));
  await expect(sendAlertPush(user.id, alert)).resolves.toBeUndefined();
  await User.updateOne({ _id: user.id }, { $set: { fcmTokens: [] } });
  mocks.send.mockClear();
  await sendAlertPush(user.id, alert);
  expect(mocks.send).not.toHaveBeenCalled();
});
