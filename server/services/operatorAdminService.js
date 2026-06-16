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
const { OPEN_STATUSES } = require('../modules/orders/orderStateMachine');
const { fieldFilter } = require('../utils/fieldFilter');
const fieldFilterModule = require('../utils/fieldFilter');
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

  // PR 9: provision the operator scan code (shown once in the create response).
  const SystemConfig = require('../models/SystemConfig');
  const roleCodes = require('../utils/roleCodes');
  const scanCodeLength = await SystemConfig.getValue('operator_scan_code_length', 8);
  let scanCode;
  for (let attempt = 0; attempt < 3; attempt++) {
    scanCode = roleCodes.generateCode(scanCodeLength);
    operator.scanCodeHmac = roleCodes.hmacCode(scanCode);
    operator.scanCodeSetAt = new Date();
    try {
      await operator.save();
      break;
    } catch (err) {
      // E11000 on scanCodeHmac = astronomically rare collision -> regenerate.
      if (err.code === 11000 && err.message.includes('scanCodeHmac') && attempt < 2) continue;
      throw err;
    }
  }
  await emailService.sendOperatorWelcomeEmail(operator, password);

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'CREATE_OPERATOR',
    userId: adminId,
    userType: 'administrator',
    targetId: operator._id,
    targetType: 'operator',
    details: { operatorId: operator.operatorId, email: operator.email }
  }, req);

  return { ...fieldFilter(operator.toObject(), 'administrator'), scanCode };
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

  // Processing-time/quality metrics moved to Cents (external) in Phase 1.
  // Operator statistics now report order counts only.
  const stats = await Order.aggregate([
    { $match: { assignedOperator: operator._id } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] } }
      }
    }
  ]);

  return {
    operator: fieldFilter(operator.toObject(), 'administrator'),
    statistics: stats[0] || {
      totalOrders: 0,
      completedOrders: 0
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

  // Release any in-progress orders held by the deactivated operator.
  await Order.updateMany(
    {
      assignedOperator: operator._id,
      status: { $in: OPEN_STATUSES }
    },
    {
      $unset: { assignedOperator: 1 }
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
    status: { $in: OPEN_STATUSES }
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

async function resetOperatorScanCode({ id, adminId, req }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  const SystemConfig = require('../models/SystemConfig');
  const roleCodes = require('../utils/roleCodes');
  const scanCodeLength = await SystemConfig.getValue('operator_scan_code_length', 8);
  const scanCode = roleCodes.generateCode(scanCodeLength);
  operator.scanCodeHmac = roleCodes.hmacCode(scanCode);
  operator.scanCodeSetAt = new Date();
  await operator.save();

  logAuditEvent(AuditEvents.OPERATOR_SCAN_CODE_RESET, {
    userId: adminId, userType: 'administrator',
    operatorId: operator.operatorId
  }, req);

  return { scanCode, scanCodeSetAt: operator.scanCodeSetAt };
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

  // Reference via module object so tests can stub getFilteredData at runtime.
  return fieldFilterModule.getFilteredData('operator', updated.toObject(), 'operator', { isSelf: true });
}

async function getOperatorSelf({ id }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  return fieldFilterModule.getFilteredData('operator', operator.toObject(), 'operator', { isSelf: true });
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
  resetOperatorScanCode,
  updateOperatorSelf,
  getOperatorSelf,
  OperatorAdminError
};
