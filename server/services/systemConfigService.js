// System config + health service
//
// Thin wrapper over the SystemConfig model (used everywhere for runtime
// business values — see CLAUDE.md) plus a best-effort health snapshot for
// the admin dashboard. The health check pings mongo; email/storage checks
// are placeholders the original controller already stubbed out.

const mongoose = require('mongoose');
const SystemConfig = require('../models/SystemConfig');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

async function listConfigurations({ category } = {}) {
  if (category) return SystemConfig.getByCategory(category);
  return SystemConfig.find().sort('category key');
}

async function updateConfiguration({ key, value, adminId, req }) {
  const existing = await SystemConfig.findOne({ key });
  const oldValue = existing ? existing.value : undefined;

  const config = await SystemConfig.setValue(key, value, adminId);

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'UPDATE_SYSTEM_CONFIG',
    userId: adminId,
    userType: 'administrator',
    details: { key, oldValue, newValue: value }
  }, req);

  return config;
}

async function getSystemHealth() {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    components: {
      database: 'healthy',
      email: 'healthy',
      storage: 'healthy'
    },
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  try {
    await mongoose.connection.db.admin().ping();
  } catch (dbError) {
    health.components.database = 'unhealthy';
    health.status = 'degraded';
  }

  // Email and storage checks are placeholders — kept so the response shape
  // stays stable once real probes are wired in.
  return health;
}

module.exports = {
  listConfigurations,
  updateConfiguration,
  getSystemHealth
};
