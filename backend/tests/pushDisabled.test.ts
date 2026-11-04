import { expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { sendAlertPush } from '../src/services/pushService.js';
vi.mock('firebase-admin/app', () => ({ cert: vi.fn(), initializeApp: vi.fn() }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: vi.fn() }));
it('is a no-op without credentials and warns only once', async () => {
 env.FIREBASE_SERVICE_ACCOUNT_PATH = '';
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 const alert = { id: 'a', serverId: 's', severity: 'high', title: 'Alert', plainDescription: 'Description' };
 await expect(sendAlertPush('unused', alert)).resolves.toBeUndefined();
 await expect(sendAlertPush('unused', alert)).resolves.toBeUndefined();
 expect(warn).toHaveBeenCalledTimes(1);
 warn.mockRestore();
});
