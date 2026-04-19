// Admin-side operator management service
//
// Everything an administrator does to operator accounts (vs. what operators
// do themselves, which lives in operatorController proper). Includes
// account CRUD, PIN/password resets, deactivation that also unassigns
// in-flight orders, stats updates, and the operators-for-assignment
// dropdown. Also hosts the operator-self-service endpoints the dashboard
// calls (updateOperatorSelf/getOperatorSelf) — same model, thinner
// validation rules.
//
// Typed OperatorAdminError carries HTTP status back to the controller.

const crypto = require('crypto');
const Operator = require('../models/Operator');
const Order = require('../models/Order');
const { fieldFilter, getFilteredData } = require('../utils/fieldFilter');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

class OperatorAdminError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isOperatorAdminError = true;
  }
}

const SHIFT_TIME_FORMAT = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

async function createOperator({ payload, adminId, req }) {
  const { firstName, lastName, email, username, password, shiftStart, shiftEnd } = payload;

  if ((shiftStart && !SHIFT_TIME_FORMAT.test(shiftStart))
      || (shiftEnd && !SHIFT_TIME_FORMAT.test(shiftEnd))) {
    throw new OperatorAdminError(
      'invalid_shift_format',
      'Valid time format (HH:MM) required for shift times'
    );
  }

  const existing = await Operator.findOne({ email: email.toLowerCase() });
  if (existing) throw new OperatorAdminError('duplicate_email', 'Email already exists', 409);

  const operator = new Operator({
    firstName,
    lastName,
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    password,
    shiftStart,
    shiftEnd,
    createdBy: adminId
  });

  await operator.save();
  await emailService.sendOperatorWelcomeEmail(operator, password);

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'CREATE_OPERATOR',
    userId: adminId,
    userType: 'administrator',
    targetId: operator._id,
    targetType: 'operator',
    details: { operatorId: operator.operatorId, email: operator.email }
  }, req);

  return fieldFilter(operator.toObject(), 'administrator');
}

async function listOperators({
  page = 1, limit = 20,
  isActive, active, onShift, search,
  sortBy = 'createdAt', sortOrder = 'desc'
}) {
  const query = {};

  const activeParam = active !== undefined ? active : isActive;
  if (activeParam !== undefined) query.isActive = activeParam === 'true';

  if (search) {
    query.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { operatorId: new RegExp(search, 'i') }
    ];
  }

  // isOnShift is a virtual, so we post-filter in JS rather than in Mongo.
  if (onShift !== undefined) {
    const all = await Operator.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .populate('createdBy', 'firstName lastName');
    const wanted = onShift === 'true';
    const filtered = all.filter(op => op.isOnShift === wanted);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit, 10);
    const operators = filtered.slice(startIndex, endIndex);

    return {
      operators: operators.map(op => fieldFilter(op.toObject(), 'administrator')),
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(filtered.length / limit),
        totalItems: filtered.length,
        itemsPerPage: parseInt(limit, 10)
      }
    };
  }

  const operators = await Operator.find(query)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('createdBy', 'firstName lastName');

  const total = await Operator.countDocuments(query);

  return {
    operators: operators.map(op => fieldFilter(op.toObject(), 'administrator')),
    pagination: {
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit, 10)
    }
  };
}

async function getOperatorById({ operatorId }) {
  const operator = await Operator.findById(operatorId)
    .populate('createdBy', 'firstName lastName');
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  const stats = await Order.aggregate([
    { $match: { assignedOperator: operator._id } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: { $sum: { $cond: [{ $eq: ['$orderProcessingStatus', 'completed'] }, 1, 0] } },
        averageProcessingTime: { $avg: '$processingTimeMinutes' },
        qualityChecksPassed: { $sum: { $cond: [{ $eq: ['$qualityCheckPassed', true] }, 1, 0] } },
        qualityChecksTotal: { $sum: { $cond: [{ $ne: ['$qualityCheckPassed', null] }, 1, 0] } }
      }
    }
  ]);

  return {
    operator: fieldFilter(operator.toObject(), 'administrator'),
    statistics: stats[0] || {
      totalOrders: 0,
      completedOrders: 0,
      averageProcessingTime: 0,
      qualityChecksPassed: 0,
      qualityChecksTotal: 0
    }
  };
}

async function updateOperator({ id, updates, adminId, req }) {
  const existing = await Operator.findById(id);
  if (!existing) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  if (updates.email && updates.email !== existing.email) {
    const emailExists = await Operator.findOne({ email: updates.email, _id: { $ne: id } });
    if (emailExists) throw new OperatorAdminError('duplicate_email', 'Email already exists', 409);
  }

  // Password updates must go through save() to trigger the pre-save hash hook;
  // findByIdAndUpdate with $set would skip the hook and store cleartext.
  if (updates.password) {
    const operator = await Operator.findById(id);
    if (operator) {
      operator.password = updates.password;
      await operator.save();
      delete updates.password;
    }
  }

  delete updates.operatorId;
  delete updates.role;
  delete updates.createdBy;

  const operator = await Operator.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'UPDATE_OPERATOR',
    userId: adminId,
    userType: 'administrator',
    targetId: operator._id,
    targetType: 'operator',
    details: { updates }
  }, req);

  return fieldFilter(operator.toObject(), 'administrator');
}

async function deactivateOperator({ id, adminId, req }) {
  const operator = await Operator.findByIdAndUpdate(
    id,
    { $set: { isActive: false, currentOrderCount: 0 } },
    { new: true }
  );
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  // Release any orders held by the deactivated operator back to the pending queue.
  await Order.updateMany(
    {
      assignedOperator: operator._id,
      orderProcessingStatus: { $in: ['assigned', 'washing', 'drying', 'folding'] }
    },
    {
      $unset: { assignedOperator: 1 },
      $set: { orderProcessingStatus: 'pending' }
    }
  );

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'DEACTIVATE_OPERATOR',
    userId: adminId,
    userType: 'administrator',
    targetId: operator._id,
    targetType: 'operator',
    details: { operatorId: operator.operatorId }
  }, req);
}

async function resetOperatorPassword({ id, adminId, req }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  const newPassword = crypto.randomBytes(8).toString('hex');
  operator.password = newPassword;
  await operator.save();

  await emailService.sendPasswordResetEmail(operator, newPassword);

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'RESET_OPERATOR_PASSWORD',
    userId: adminId,
    userType: 'administrator',
    targetId: operator._id,
    targetType: 'operator',
    details: { operatorId: operator.operatorId }
  }, req);
}

async function updateOperatorStats({ id, processingTime, qualityScore, qualityPassed, totalOrdersProcessed }) {
  if (processingTime !== undefined && processingTime <= 0) {
    throw new OperatorAdminError('invalid_processing_time', 'Processing time must be positive');
  }
  if (qualityScore !== undefined && (qualityScore < 0 || qualityScore > 100)) {
    throw new OperatorAdminError('invalid_quality_score', 'Quality score must be between 0 and 100');
  }

  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  // Rolling average for processing time — keeps a cumulative stat without
  // replaying the full order history on every update.
  if (processingTime !== undefined) {
    const currentTotal = operator.totalOrdersProcessed || 0;
    const currentAvg = operator.averageProcessingTime || 0;
    const newTotal = currentTotal + 1;
    operator.totalOrdersProcessed = newTotal;
    operator.averageProcessingTime = (currentAvg * currentTotal + processingTime) / newTotal;
  }

  // EWMA for quality — weights the latest result at 10%, so scores move
  // noticeably but don't whiplash from a single failure.
  if (qualityPassed !== undefined) {
    const currentScore = operator.qualityScore || 100;
    operator.qualityScore = currentScore * 0.9 + (qualityPassed ? 100 : 0) * 0.1;
  }

  if (qualityScore !== undefined) operator.qualityScore = qualityScore;
  if (totalOrdersProcessed !== undefined) operator.totalOrdersProcessed = totalOrdersProcessed;

  await operator.save();

  return {
    _id: operator._id,
    operatorId: operator.operatorId,
    firstName: operator.firstName,
    lastName: operator.lastName,
    averageProcessingTime: operator.averageProcessingTime,
    qualityScore: operator.qualityScore,
    totalOrdersProcessed: operator.totalOrdersProcessed
  };
}

async function getAvailableOperators({ limit = 20 }) {
  return Operator.find({
    isActive: true,
    currentOrderCount: { $lt: 10 }
  })
    .sort({ currentOrderCount: 1 })
    .limit(parseInt(limit, 10))
    .select('operatorId firstName lastName email currentOrderCount isActive isOnShift shiftStart shiftEnd');
}

async function deleteOperator({ id, adminId }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  const activeOrdersCount = await Order.countDocuments({
    assignedOperator: operator._id,
    orderProcessingStatus: { $nin: ['completed', 'delivered', 'cancelled'] }
  });

  if (activeOrdersCount > 0 || operator.currentOrderCount > 0) {
    throw new OperatorAdminError(
      'has_active_orders',
      'Cannot delete operator with active orders'
    );
  }

  await Operator.findByIdAndDelete(id);

  await logAuditEvent(AuditEvents.ADMIN_DELETE_OPERATOR, adminId, {
    operatorId: operator.operatorId,
    operatorEmail: operator.email
  });
}

async function resetOperatorPin({ id, newPassword, adminId }) {
  if (!newPassword) {
    throw new OperatorAdminError('password_required', 'New password is required');
  }

  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  // save() triggers the pre-save hash hook; also clear any lockout state.
  operator.password = newPassword;
  operator.loginAttempts = 0;
  operator.lockUntil = undefined;
  await operator.save();

  await logAuditEvent(AuditEvents.ADMIN_RESET_OPERATOR_PASSWORD, adminId, {
    operatorId: operator.operatorId,
    operatorEmail: operator.email
  });
}

const SELF_UPDATE_ALLOWED_FIELDS = ['firstName', 'lastName', 'password', 'phone'];

async function updateOperatorSelf({ id, updates }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  const filtered = {};
  for (const field of SELF_UPDATE_ALLOWED_FIELDS) {
    if (updates[field] !== undefined) filtered[field] = updates[field];
  }
  // Belt-and-suspenders: the allowlist already blocks these, but guard
  // in case a future edit grows the list.
  delete filtered.operatorId;
  delete filtered.email;
  delete filtered.isActive;
  delete filtered.permissions;

  Object.assign(operator, filtered);
  const updated = await operator.save();

  return getFilteredData('operator', updated.toObject(), 'operator', { isSelf: true });
}

async function getOperatorSelf({ id }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  return getFilteredData('operator', operator.toObject(), 'operator', { isSelf: true });
}

module.exports = {
  createOperator,
  listOperators,
  getOperatorById,
  updateOperator,
  deactivateOperator,
  resetOperatorPassword,
  updateOperatorStats,
  getAvailableOperators,
  deleteOperator,
  resetOperatorPin,
  updateOperatorSelf,
  getOperatorSelf,
  OperatorAdminError
};
