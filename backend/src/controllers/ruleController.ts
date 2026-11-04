import type { RequestHandler } from 'express';
import { Rule } from '../models/Rule.js';
import { getRulesVersion } from '../services/alertService.js';
import { AppError } from '../utils/AppError.js';
const protectedPaths = ['/etc/passwd', '/etc/shadow', '/etc/ssh/sshd_config'];
export const listAgentRules: RequestHandler = async (req, res) => {
  if (!req.server)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  const rules = await Rule.find({
    enabled: true,
    $or: [
      { 'scope.serverId': { $exists: false } },
      { 'scope.serverId': null },
      { 'scope.serverId': req.server._id },
    ],
  })
    .sort({ name: 1 })
    .lean();
  res.json({
    rulesVersion: await getRulesVersion(),
    rules: rules.map((rule) => ({
      ruleId: rule._id.toString(),
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      enabled: rule.enabled,
      conditions: rule.conditions ?? {},
      action: rule.action,
    })),
    protectedPaths,
    allowlistIps: [],
  });
};
