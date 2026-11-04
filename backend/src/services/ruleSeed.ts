import { Rule } from '../models/Rule.js';

const defaultRules = [
  {
    name: 'SSH brute force',
    type: 'ssh_failed_login',
    severity: 'high',
    enabled: true,
    conditions: { threshold: 5, windowSeconds: 60, groupBy: 'sourceIp' },
    action: 'block',
  },
  {
    name: 'Port scan detected',
    type: 'port_scan',
    severity: 'high',
    enabled: true,
    conditions: {},
    action: 'alert',
  },
  {
    name: 'Sensitive file changed',
    type: 'file_modified',
    severity: 'high',
    enabled: true,
    conditions: {},
    action: 'alert',
  },
  {
    name: 'Permission change',
    type: 'permission_changed',
    severity: 'medium',
    enabled: true,
    conditions: {},
    action: 'alert',
  },
  {
    name: 'Root login',
    type: 'root_login',
    severity: 'high',
    enabled: true,
    conditions: {},
    action: 'alert',
  },
] as const;

export async function seedDefaultRules(): Promise<void> {
  for (const rule of defaultRules) {
    await Rule.updateOne(
      { name: rule.name },
      { $setOnInsert: rule },
      { upsert: true },
    );
  }
}
