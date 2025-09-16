// Administrator Controller for WaveMAX Laundry Affiliate Program
// Handles system configuration, operator management, and analytics

const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const Transaction = require('../models/Transaction');
const BetaRequest = require('../models/BetaRequest');
const { fieldFilter } = require('../utils/fieldFilter');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const { validatePasswordStrength } = require('../utils/passwordValidator');
const { validationResult } = require('express-validator');
const { escapeRegex } = require('../utils/securityUtils');
const crypto = require('crypto');
const mongoose = require('mongoose');
const encryptionUtil = require('../utils/encryption');

// Administrator Management

/**
 * Get all administrators
 */
exports.getAdministrators = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      active,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { adminId: new RegExp(search, 'i') }
      ];
    }

    // Execute query with pagination
    const administrators = await Administrator.find(query)
      .select('-password')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Administrator.countDocuments(query);

    res.json({
      success: true,
      administrators: administrators.map(admin => fieldFilter(admin.toObject(), 'administrator')),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching administrators:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch administrators'
    });
  }
};

/**
 * Get administrator by ID
 */
exports.getAdministratorById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid administrator ID'
      });
    }

    const administrator = await Administrator.findById(id).select('-password');

    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found'
      });
    }

    res.json({
      success: true,
      administrator: fieldFilter(administrator.toObject(), 'administrator')
    });

  } catch (error) {
    console.error('Error fetching administrator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch administrator'
    });
  }
};

/**
 * Create new administrator
 */
exports.createAdministrator = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: errorMessages[0],
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      permissions = []
    } = req.body;

    // Check if email already exists
    const existingAdmin = await Administrator.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Generate admin ID
    const adminCount = await Administrator.countDocuments();
    const adminId = `ADM${String(adminCount + 1).padStart(3, '0')}`;

    // Hash the password
    const { salt, hash } = encryptionUtil.hashPassword(password);

    // Create new administrator
    const administrator = new Administrator({
      adminId,
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordSalt: salt,
      passwordHash: hash,
      permissions,
      createdAt: new Date()
    });

    await administrator.save();

    // Log the action
    logAuditEvent(AuditEvents.ACCOUNT_CREATED, {
      action: 'CREATE_ADMINISTRATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: administrator._id,
      targetType: 'administrator',
      details: { adminId: administrator.adminId, email: administrator.email }
    }, req);

    res.status(201).json({
      success: true,
      message: 'Administrator created successfully',
      administrator: fieldFilter(administrator.toObject(), 'administrator')
    });

  } catch (error) {
    console.error('Error creating administrator:', error);

    // Handle validation errors from model pre-save hooks
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create administrator'
    });
  }
};

/**
 * Update administrator
 */
exports.updateAdministrator = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid administrator ID'
      });
    }

    // Prevent updating certain fields
    delete updates.adminId;
    delete updates.role;
    delete updates.createdAt;

    // Check for self-deactivation
    if (updates.isActive === false && id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    // Check if trying to remove 'all' permission from last super admin
    if (updates.permissions && id === req.user.id) {
      const currentAdmin = await Administrator.findById(id);
      if (currentAdmin && currentAdmin.permissions.includes('all') && !updates.permissions.includes('all')) {
        // Check if this is the last super admin
        const superAdminCount = await Administrator.countDocuments({ 
          permissions: 'all',
          isActive: true 
        });
        if (superAdminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot remove super admin permissions from the last active super administrator'
          });
        }
      }
    }

    // Check email uniqueness if updating email
    if (updates.email) {
      const existingAdmin = await Administrator.findOne({
        email: updates.email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
      updates.email = updates.email.toLowerCase();
    }

    // Hash password if updating
    if (updates.password) {
      const { salt, hash } = encryptionUtil.hashPassword(updates.password);
      updates.passwordSalt = salt;
      updates.passwordHash = hash;
      delete updates.password;
    }

    const administrator = await Administrator.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found'
      });
    }

    // Log the action
    logAuditEvent(AuditEvents.ACCOUNT_UPDATED, {
      action: 'UPDATE_ADMINISTRATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: administrator._id,
      targetType: 'administrator',
      details: { updates }
    }, req);

    res.json({
      success: true,
      message: 'Administrator updated successfully',
      administrator: fieldFilter(administrator.toObject(), 'administrator')
    });

  } catch (error) {
    console.error('Error updating administrator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update administrator'
    });
  }
};

/**
 * Delete administrator
 */
exports.deleteAdministrator = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid administrator ID'
      });
    }

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if this is the last administrator with 'all' permissions
    const adminWithAllPerms = await Administrator.find({
      permissions: 'all',
      _id: { $ne: id }
    });

    if (adminWithAllPerms.length === 0) {
      const targetAdmin = await Administrator.findById(id);
      if (targetAdmin && targetAdmin.permissions.includes('all')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last administrator with full permissions'
        });
      }
    }

    const administrator = await Administrator.findByIdAndDelete(id);

    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found'
      });
    }

    // Log the action
    logAuditEvent(AuditEvents.ACCOUNT_DELETED, {
      action: 'DELETE_ADMINISTRATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: id,
      targetType: 'administrator',
      details: { adminId: administrator.adminId, email: administrator.email }
    }, req);

    res.json({
      success: true,
      message: 'Administrator deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting administrator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete administrator'
    });
  }
};

/**
 * Reset administrator password
 */
exports.resetAdministratorPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid administrator ID'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword, '', '');
    if (!passwordValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    const administrator = await Administrator.findById(id);
    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found'
      });
    }

    // Reset password
    const { salt, hash } = encryptionUtil.hashPassword(newPassword);
    administrator.passwordSalt = salt;
    administrator.passwordHash = hash;
    administrator.loginAttempts = 0;
    administrator.lockUntil = undefined;
    await administrator.save();

    // Log the action
    logAuditEvent(AuditEvents.PASSWORD_RESET_SUCCESS, {
      action: 'RESET_ADMINISTRATOR_PASSWORD',
      userId: req.user.id,
      userType: 'administrator',
      targetId: administrator._id,
      targetType: 'administrator',
      details: { adminId: administrator.adminId }
    }, req);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Error resetting administrator password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset administrator password'
    });
  }
};

/**
 * Change administrator password (for logged-in admin)
 */
exports.changeAdministratorPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const administratorId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Find administrator with password field
    const administrator = await Administrator.findById(administratorId).select('+password');

    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found'
      });
    }

    // Verify current password
    const isPasswordValid = administrator.verifyPassword(currentPassword);

    if (!isPasswordValid) {
      logAuditEvent(AuditEvents.PASSWORD_CHANGE_FAILED, {
        action: 'CHANGE_PASSWORD_FAILED',
        userId: administratorId,
        userType: 'administrator',
        reason: 'Invalid current password'
      }, req);

      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is in history
    if (administrator.isPasswordInHistory && administrator.isPasswordInHistory(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as any of your last 5 passwords'
      });
    }

    // Validate new password strength
    const { validatePasswordStrength } = require('../utils/passwordValidator');
    const validation = validatePasswordStrength(newPassword, {
      username: administrator.email.split('@')[0],
      email: administrator.email
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: validation.errors
      });
    }

    // Update password using the setPassword method (handles hashing and history)
    administrator.setPassword(newPassword);
    administrator.requirePasswordChange = false; // Clear the flag after password change
    await administrator.save();

    // Log the action
    logAuditEvent(AuditEvents.PASSWORD_CHANGE_SUCCESS, {
      action: 'CHANGE_PASSWORD_SUCCESS',
      userId: administratorId,
      userType: 'administrator',
      details: { adminId: administrator.adminId }
    }, req);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing administrator password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

/**
 * Get available permissions
 */
exports.getPermissions = async (req, res) => {
  try {
    const permissions = [
      'all',
      'administrators.read',
      'administrators.create',
      'administrators.update',
      'administrators.delete',
      'operators.manage',
      'operators.read',
      'customers.manage',
      'customers.read',
      'affiliates.manage',
      'affiliates.read',
      'orders.manage',
      'orders.read',
      'reports.view',
      'system.configure',
      'operator_management',
      'view_analytics',
      'system_config'
    ];

    res.json({
      success: true,
      permissions
    });

  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions'
    });
  }
};

// Operator Management

/**
 * Create a new operator
 */
exports.createOperator = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: errorMessages[0],
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      username,
      password,
      shiftStart,
      shiftEnd
    } = req.body;

    // Validate shift time format if provided
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if ((shiftStart && !timeRegex.test(shiftStart)) || (shiftEnd && !timeRegex.test(shiftEnd))) {
      return res.status(400).json({
        success: false,
        message: 'Valid time format (HH:MM) required for shift times'
      });
    }

    // Check if operator already exists
    const existingOperator = await Operator.findOne({ email: email.toLowerCase() });
    if (existingOperator) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create new operator
    const operator = new Operator({
      firstName,
      lastName,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password,
      shiftStart,
      shiftEnd,
      createdBy: req.user.id
    });

    await operator.save();

    // Send welcome email
    await emailService.sendOperatorWelcomeEmail(operator, password);

    // Log the action
    logAuditEvent(AuditEvents.DATA_MODIFICATION, {
      action: 'CREATE_OPERATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { operatorId: operator.operatorId, email: operator.email }
    }, req);

    res.status(201).json({
      success: true,
      message: 'Operator created successfully',
      operator: fieldFilter(operator.toObject(), 'administrator')
    });

  } catch (error) {
    console.error('Error creating operator:', error);

    // Handle validation errors from model pre-save hooks
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create operator'
    });
  }
};

/**
 * Get all operators with pagination and filtering
 */
exports.getOperators = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isActive,
      active, // Support both 'active' and 'isActive' parameters
      onShift,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Handle both 'active' and 'isActive' parameter names
    const activeParam = active !== undefined ? active : isActive;
    if (activeParam !== undefined) {
      query.isActive = activeParam === 'true';
    }


    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { operatorId: new RegExp(search, 'i') }
      ];
    }

    // If onShift filter is requested, we need to handle it specially since it's a virtual
    if (onShift !== undefined) {
      // Get all operators matching base query first
      const allOperators = await Operator.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .populate('createdBy', 'firstName lastName');

      // Filter by onShift status
      const isOnShiftFilter = onShift === 'true';
      const filteredOperators = allOperators.filter(op => op.isOnShift === isOnShiftFilter);

      // Apply pagination to filtered results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const operators = filteredOperators.slice(startIndex, endIndex);

      const total = filteredOperators.length;

      res.json({
        success: true,
        operators: operators.map(op => fieldFilter(op.toObject(), 'administrator')),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
      return;
    }

    // Regular query without onShift filtering
    const operators = await Operator.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'firstName lastName');

    const total = await Operator.countDocuments(query);

    res.json({
      success: true,
      operators: operators.map(op => fieldFilter(op.toObject(), 'administrator')),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operators'
    });
  }
};

/**
 * Get operator details by ID
 */
exports.getOperatorById = async (req, res) => {
  try {
    const { operatorId } = req.params;

    const operator = await Operator.findById(operatorId)
      .populate('createdBy', 'firstName lastName');

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Get operator statistics
    const stats = await Order.aggregate([
      {
        $match: {
          assignedOperator: operator._id
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$orderProcessingStatus', 'completed'] }, 1, 0] }
          },
          averageProcessingTime: { $avg: '$processingTimeMinutes' },
          qualityChecksPassed: {
            $sum: { $cond: [{ $eq: ['$qualityCheckPassed', true] }, 1, 0] }
          },
          qualityChecksTotal: {
            $sum: { $cond: [{ $ne: ['$qualityCheckPassed', null] }, 1, 0] }
          }
        }
      }
    ]);

    const operatorStats = stats[0] || {
      totalOrders: 0,
      completedOrders: 0,
      averageProcessingTime: 0,
      qualityChecksPassed: 0,
      qualityChecksTotal: 0
    };

    res.json({
      success: true,
      operator: fieldFilter(operator.toObject(), 'administrator'),
      statistics: operatorStats
    });

  } catch (error) {
    console.error('Error fetching operator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operator details'
    });
  }
};

/**
 * Update operator details
 */
exports.updateOperator = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if operator exists
    const existingOperator = await Operator.findById(id);
    if (!existingOperator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Check email uniqueness if email is being updated
    if (updates.email && updates.email !== existingOperator.email) {
      const emailExists = await Operator.findOne({
        email: updates.email,
        _id: { $ne: id }
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Handle password update separately if provided
    if (updates.password) {
      const operator = await Operator.findById(id);
      if (operator) {
        operator.password = updates.password;
        await operator.save();
        delete updates.password;
      }
    }

    // Prevent updating sensitive fields
    delete updates.operatorId;
    delete updates.role;
    delete updates.createdBy;

    const operator = await Operator.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Log the action
    logAuditEvent(AuditEvents.DATA_MODIFICATION, {
      action: 'UPDATE_OPERATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { updates }
    }, req);

    res.json({
      success: true,
      message: 'Operator updated successfully',
      operator: fieldFilter(operator.toObject(), 'administrator')
    });

  } catch (error) {
    console.error('Error updating operator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update operator'
    });
  }
};

/**
 * Deactivate operator
 */
exports.deactivateOperator = async (req, res) => {
  try {
    const { id } = req.params;

    const operator = await Operator.findByIdAndUpdate(
      id,
      {
        $set: {
          isActive: false,
          currentOrderCount: 0
        }
      },
      { new: true }
    );

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Unassign any active orders
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

    // Log the action
    logAuditEvent(AuditEvents.DATA_MODIFICATION, {
      action: 'DEACTIVATE_OPERATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { operatorId: operator.operatorId }
    }, req);

    res.json({
      success: true,
      message: 'Operator deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating operator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate operator'
    });
  }
};

/**
 * Reset operator password
 */
exports.resetOperatorPassword = async (req, res) => {
  try {
    const { id } = req.params;

    const operator = await Operator.findById(id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Generate new password
    const newPassword = crypto.randomBytes(8).toString('hex');
    operator.password = newPassword;
    await operator.save();

    // Send password reset email
    await emailService.sendPasswordResetEmail(operator, newPassword);

    // Log the action
    logAuditEvent(AuditEvents.DATA_MODIFICATION, {
      action: 'RESET_OPERATOR_PASSWORD',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { operatorId: operator.operatorId }
    }, req);

    res.json({
      success: true,
      message: 'Password reset successfully. New password sent to operator email.'
    });

  } catch (error) {
    console.error('Error resetting operator password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset operator password'
    });
  }
};

// Analytics & Reporting

/**
 * Get administrator dashboard data
 */
exports.getDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Aggregate order statistics
    const orderStats = await Order.aggregate([
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: today } } },
            { $count: 'count' }
          ],
          thisWeek: [
            { $match: { createdAt: { $gte: thisWeekStart } } },
            { $count: 'count' }
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            { $count: 'count' }
          ],
          statusDistribution: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          processingStatusDistribution: [
            { $group: { _id: '$orderProcessingStatus', count: { $sum: 1 } } }
          ],
          averageProcessingTime: [
            { $match: {
              status: 'complete',
              processingStartedAt: { $exists: true },
              completedAt: { $exists: true }
            } },
            { $project: {
              processingTime: {
                $divide: [
                  { $subtract: ['$completedAt', '$processingStartedAt'] },
                  1000 * 60 // Convert to minutes
                ]
              }
            } },
            { $group: { _id: null, avg: { $avg: '$processingTime' } } }
          ]
        }
      }
    ]);

    // Get operator performance
    const operatorPerformance = await Operator.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'assignedOperator',
          as: 'orders'
        }
      },
      {
        $project: {
          operatorId: 1,
          firstName: 1,
          lastName: 1,
          currentOrderCount: 1,
          totalOrdersProcessed: 1,
          averageProcessingTime: 1,
          qualityScore: 1,
          ordersToday: {
            $size: {
              $filter: {
                input: '$orders',
                cond: { $gte: ['$$this.createdAt', today] }
              }
            }
          }
        }
      },
      { $sort: { totalOrdersProcessed: -1 } },
      { $limit: 10 }
    ]);

    // Get affiliate performance
    const affiliatePerformance = await Affiliate.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'affiliateId',
          foreignField: 'affiliateId',
          as: 'orders'
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'affiliateId',
          foreignField: 'affiliateId',
          as: 'customers'
        }
      },
      {
        $project: {
          affiliateId: 1,
          firstName: 1,
          lastName: 1,
          businessName: 1,
          customerCount: { $size: '$customers' },
          orderCount: { $size: '$orders' },
          monthlyRevenue: {
            $reduce: {
              input: {
                $filter: {
                  input: '$orders',
                  cond: { $gte: ['$$this.createdAt', thisMonthStart] }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.actualTotal', 0] }] }
            }
          }
        }
      },
      { $sort: { monthlyRevenue: -1 } },
      { $limit: 10 }
    ]);

    // System health metrics
    const systemHealth = {
      activeOperators: await Operator.countDocuments({ isActive: true }),
      onShiftOperators: await Operator.findOnShift().then(ops => ops.length),
      activeAffiliates: await Affiliate.countDocuments({ isActive: true }),
      totalCustomers: await Customer.countDocuments(),
      ordersInProgress: await Order.countDocuments({
        status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }
      }),
      completedOrders: await Order.countDocuments({ status: 'complete' }),
      processingDelays: await Order.countDocuments({
        status: 'processing',
        processingStartedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 hours
      })
    };

    // Get recent activity (last 10 activities)
    const recentOrders = await Order.find({})
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    // Get unique affiliate IDs from recent orders
    const affiliateIds = [...new Set(recentOrders.map(o => o.affiliateId).filter(id => id))];

    let formattedActivity = [];

    if (affiliateIds.length > 0) {
      const affiliates = await Affiliate.find({ affiliateId: { $in: affiliateIds } })
        .select('affiliateId firstName lastName businessName')
        .lean();

      // Create a map for quick lookup
      const affiliateMap = new Map(affiliates.map(a => [a.affiliateId, a]));

      formattedActivity = recentOrders.map(order => {
        const affiliate = affiliateMap.get(order.affiliateId);
        return {
          timestamp: order.updatedAt,
          type: 'Order',
          userName: affiliate ?
            `${affiliate.firstName} ${affiliate.lastName}` :
            'Unknown',
          action: `Order ${order.orderId} - Status: ${order.status}`
        };
      });
    }

    res.json({
      success: true,
      dashboard: {
        orderStats: {
          today: orderStats[0].today[0]?.count || 0,
          thisWeek: orderStats[0].thisWeek[0]?.count || 0,
          thisMonth: orderStats[0].thisMonth[0]?.count || 0,
          statusDistribution: orderStats[0].statusDistribution,
          processingStatusDistribution: orderStats[0].processingStatusDistribution,
          averageProcessingTime: orderStats[0].averageProcessingTime[0]?.avg || 0
        },
        operatorPerformance,
        affiliatePerformance,
        systemHealth,
        recentActivity: formattedActivity
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};

/**
 * Get order processing analytics
 */
exports.getOrderAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
      groupBy = 'day' // day, week, month
    } = req.query;

    const groupByFormat = {
      day: '%Y-%m-%d',
      week: '%Y-W%V',
      month: '%Y-%m'
    };

    const analytics = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $addFields: {
          // Calculate completion time in minutes (from processing started to completed)
          completionTimeMinutes: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'complete'] },
                  { $ne: ['$processingStarted', null] },
                  { $ne: ['$processingCompleted', null] }
                ]
              },
              {
                $divide: [
                  { $subtract: ['$processingCompleted', '$processingStarted'] },
                  60000 // Convert milliseconds to minutes
                ]
              },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat[groupBy] || groupByFormat.day,
              date: '$createdAt' // Group by creation date to include all orders
            }
          },
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$actualTotal' },
          averageOrderValue: { $avg: '$actualTotal' },
          averageProcessingTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'complete'] },
                '$completionTimeMinutes',
                null
              ]
            }
          },
          totalWeight: { $sum: '$actualWeight' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Processing time distribution
    const processingTimeDistribution = await Order.aggregate([
      {
        $match: {
          processingTimeMinutes: { $exists: true },
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $bucket: {
          groupBy: '$processingTimeMinutes',
          boundaries: [0, 30, 60, 90, 120, 180, 240, 300],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            orders: { $push: '$orderId' }
          }
        }
      }
    ]);

    res.json({
      success: true,
      analytics: {
        timeline: analytics,
        processingTimeDistribution,
        summary: {
          totalOrders: analytics.reduce((sum, item) => sum + item.totalOrders, 0),
          completedOrders: analytics.reduce((sum, item) => sum + item.completedOrders, 0),
          totalRevenue: analytics.reduce((sum, item) => sum + (item.totalRevenue || 0), 0),
          averageOrderValue: analytics.reduce((sum, item) => sum + (item.averageOrderValue || 0), 0) / analytics.length,
          averageProcessingTime: analytics.reduce((sum, item) => {
            // Only include non-null processing times in the average
            return sum + (item.averageProcessingTime || 0);
          }, 0) / analytics.filter(item => item.averageProcessingTime > 0).length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order analytics'
    });
  }
};

/**
 * Get operator performance analytics
 */
exports.getOperatorAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = req.query;

    const operatorAnalytics = await Operator.aggregate([
      {
        $lookup: {
          from: 'orders',
          let: { operatorId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$assignedOperator', '$$operatorId'] },
                    { $gte: ['$createdAt', new Date(startDate)] },
                    { $lte: ['$createdAt', new Date(endDate)] }
                  ]
                }
              }
            }
          ],
          as: 'periodOrders'
        }
      },
      {
        $project: {
          operatorId: 1,
          firstName: 1,
          lastName: 1,
          workStation: 1,
          isActive: 1,
          metrics: {
            totalOrders: { $size: '$periodOrders' },
            completedOrders: {
              $size: {
                $filter: {
                  input: '$periodOrders',
                  cond: { $eq: ['$$this.orderProcessingStatus', 'completed'] }
                }
              }
            },
            averageProcessingTime: { $avg: '$periodOrders.processingTimeMinutes' },
            qualityChecksPassed: {
              $size: {
                $filter: {
                  input: '$periodOrders',
                  cond: { $eq: ['$$this.qualityCheckPassed', true] }
                }
              }
            },
            totalProcessingTime: { $sum: '$periodOrders.processingTimeMinutes' }
          }
        }
      },
      {
        $addFields: {
          'metrics.completionRate': {
            $cond: [
              { $eq: ['$metrics.totalOrders', 0] },
              0,
              { $divide: ['$metrics.completedOrders', '$metrics.totalOrders'] }
            ]
          },
          'metrics.qualityPassRate': {
            $cond: [
              { $eq: ['$metrics.completedOrders', 0] },
              0,
              { $divide: ['$metrics.qualityChecksPassed', '$metrics.completedOrders'] }
            ]
          }
        }
      },
      { $sort: { 'metrics.totalOrders': -1 } }
    ]);

    // Workstation performance
    const workstationAnalytics = await Order.aggregate([
      {
        $match: {
          assignedOperator: { $exists: true },
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $lookup: {
          from: 'operators',
          localField: 'assignedOperator',
          foreignField: '_id',
          as: 'operator'
        }
      },
      { $unwind: '$operator' },
      {
        $group: {
          _id: '$operator.workStation',
          totalOrders: { $sum: 1 },
          averageProcessingTime: { $avg: '$processingTimeMinutes' },
          totalProcessingTime: { $sum: '$processingTimeMinutes' }
        }
      }
    ]);

    res.json({
      success: true,
      analytics: {
        operators: operatorAnalytics,
        workstations: workstationAnalytics
      }
    });

  } catch (error) {
    console.error('Error fetching operator analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operator analytics'
    });
  }
};

/**
 * Get affiliate performance analytics
 */
exports.getAffiliateAnalytics = async (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = req.query;

    const affiliateAnalytics = await Affiliate.aggregate([
      {
        $lookup: {
          from: 'orders',
          let: { affiliateId: '$affiliateId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$affiliateId', '$$affiliateId'] },
                    { $gte: ['$createdAt', new Date(startDate)] },
                    { $lte: ['$createdAt', new Date(endDate)] }
                  ]
                }
              }
            }
          ],
          as: 'periodOrders'
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'affiliateId',
          foreignField: 'affiliateId',
          as: 'customers'
        }
      },
      {
        $project: {
          affiliateId: 1,
          firstName: 1,
          lastName: 1,
          businessName: 1,
          serviceLatitude: 1,
          serviceLongitude: 1,
          serviceRadius: 1,
          w9Status: '$w9Information.status',
          email: 1,
          metrics: {
            totalCustomers: { $size: '$customers' },
            activeCustomers: {
              $size: {
                $filter: {
                  input: '$customers',
                  cond: { $eq: ['$$this.isActive', true] }
                }
              }
            },
            totalOrders: { $size: '$periodOrders' },
            totalRevenue: { $sum: '$periodOrders.actualTotal' },
            totalCommission: { $sum: '$periodOrders.affiliateCommission' },
            averageOrderValue: { $avg: '$periodOrders.actualTotal' }
          }
        }
      },
      { $sort: { 'metrics.totalRevenue': -1 } }
    ]);

    // Geographic distribution (by city)
    const geographicDistribution = await Affiliate.aggregate([
      {
        $group: {
          _id: '$city',
          affiliateCount: { $sum: 1 },
          activeAffiliates: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          avgServiceRadius: { $avg: '$serviceRadius' }
        }
      },
      { $sort: { affiliateCount: -1 } }
    ]);

    res.json({
      success: true,
      analytics: {
        affiliates: affiliateAnalytics,
        geographicDistribution
      }
    });

  } catch (error) {
    console.error('Error fetching affiliate analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch affiliate analytics'
    });
  }
};

/**
 * Export analytics report
 */
exports.exportReport = async (req, res) => {
  try {
    const {
      reportType = 'orders', // orders, operators, affiliates, comprehensive
      format = 'csv', // csv, excel
      startDate,
      endDate
    } = req.query;

    // Implementation would generate CSV/Excel files
    // For now, returning JSON data that can be converted client-side

    let reportData;

    switch (reportType) {
    case 'orders':
      reportData = await generateOrdersReport(startDate, endDate);
      break;
    case 'operators':
      reportData = await generateOperatorsReport(startDate, endDate);
      break;
    case 'affiliates':
      reportData = await generateAffiliatesReport(startDate, endDate);
      break;
    case 'comprehensive':
      reportData = await generateComprehensiveReport(startDate, endDate);
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    // Log the action
    logAuditEvent(AuditEvents.DATA_MODIFICATION, {
      action: 'EXPORT_REPORT',
      userId: req.user.id,
      userType: 'administrator',
      details: { reportType, format, startDate, endDate }
    }, req);

    res.json({
      success: true,
      report: reportData,
      metadata: {
        reportType,
        generatedAt: new Date(),
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report'
    });
  }
};

/**
 * Get list of affiliates for dropdowns and filters
 */
exports.getAffiliatesList = async (req, res) => {
  try {
    const { search, status, limit = 100 } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { businessName: { $regex: escapedSearch, $options: 'i' } },
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { affiliateId: { $regex: escapedSearch, $options: 'i' } }
      ];
    }
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const affiliates = await Affiliate.find(query)
      .select('affiliateId firstName lastName businessName email isActive serviceArea')
      .limit(parseInt(limit))
      .sort('businessName');
    
    res.json({
      success: true,
      affiliates: affiliates.map(affiliate => ({
        _id: affiliate._id,
        affiliateId: affiliate.affiliateId,
        businessName: affiliate.businessName,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        email: affiliate.email,
        isActive: affiliate.isActive,
        serviceArea: affiliate.serviceArea
      }))
    });
  } catch (error) {
    console.error('Error fetching affiliates list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch affiliates list',
      error: error.message
    });
  }
};

// System Configuration

/**
 * Get system configuration
 */
exports.getSystemConfig = async (req, res) => {
  try {
    const { category } = req.query;

    let configs;
    if (category) {
      configs = await SystemConfig.getByCategory(category);
    } else {
      configs = await SystemConfig.find().sort('category key');
    }

    res.json({
      success: true,
      configurations: configs
    });

  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system configuration'
    });
  }
};

/**
 * Update system configuration
 */
exports.updateSystemConfig = async (req, res) => {
  try {
    const { key, value } = req.body;

    const config = await SystemConfig.setValue(key, value, req.user.id);

    // Log the action
    logAuditEvent(AuditEvents.DATA_MODIFICATION, {
      action: 'UPDATE_SYSTEM_CONFIG',
      userId: req.user.id,
      userType: 'administrator',
      details: { key, oldValue: config.value, newValue: value }
    }, req);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      configuration: config
    });

  } catch (error) {
    console.error('Error updating system config:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update system configuration'
    });
  }
};

/**
 * Get system health status
 */
exports.getSystemHealth = async (req, res) => {
  try {
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

    // Check database connection
    try {
      await mongoose.connection.db.admin().ping();
    } catch (dbError) {
      health.components.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check email service (mock check)
    try {
      // Would implement actual email service check
      health.components.email = 'healthy';
    } catch (emailError) {
      health.components.email = 'unhealthy';
      health.status = 'degraded';
    }

    res.json({
      success: true,
      health
    });

  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check system health',
      health: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
};

// Helper functions for report generation

async function generateOrdersReport(startDate, endDate) {
  const orders = await Order.find({
    createdAt: {
      $gte: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
      $lte: new Date(endDate || Date.now())
    }
  })
    .populate('assignedOperator', 'firstName lastName operatorId')
    .populate('affiliateId', 'firstName lastName businessName')
    .lean();

  return orders.map(order => ({
    orderId: order.orderId,
    customerID: order.customerId,
    affiliateName: order.affiliateId ?
      `${order.affiliateId.firstName} ${order.affiliateId.lastName}` : 'N/A',
    status: order.status,
    processingStatus: order.orderProcessingStatus,
    operator: order.assignedOperator ?
      `${order.assignedOperator.firstName} ${order.assignedOperator.lastName}` : 'Unassigned',
    processingTime: order.processingTimeMinutes || 0,
    actualWeight: order.actualWeight || 0,
    actualTotal: order.actualTotal || 0,
    createdAt: order.createdAt
  }));
}

async function generateOperatorsReport(startDate, endDate) {
  const operators = await Operator.find().lean();

  const operatorReports = [];

  for (const operator of operators) {
    const orderStats = await Order.aggregate([
      {
        $match: {
          assignedOperator: operator._id,
          createdAt: {
            $gte: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lte: new Date(endDate || Date.now())
          }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$orderProcessingStatus', 'completed'] }, 1, 0] }
          },
          averageProcessingTime: { $avg: '$processingTimeMinutes' },
          totalProcessingTime: { $sum: '$processingTimeMinutes' }
        }
      }
    ]);

    operatorReports.push({
      operatorId: operator.operatorId,
      name: `${operator.firstName} ${operator.lastName}`,
      workStation: operator.workStation,
      isActive: operator.isActive,
      totalOrders: orderStats[0]?.totalOrders || 0,
      completedOrders: orderStats[0]?.completedOrders || 0,
      averageProcessingTime: orderStats[0]?.averageProcessingTime || 0,
      totalProcessingTime: orderStats[0]?.totalProcessingTime || 0,
      qualityScore: operator.qualityScore
    });
  }

  return operatorReports;
}

async function generateAffiliatesReport(startDate, endDate) {
  const affiliates = await Affiliate.find().lean();

  const affiliateReports = [];

  for (const affiliate of affiliates) {
    const stats = await Order.aggregate([
      {
        $match: {
          affiliateId: affiliate.affiliateId,
          createdAt: {
            $gte: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lte: new Date(endDate || Date.now())
          }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$actualTotal' },
          totalCommission: { $sum: '$affiliateCommission' }
        }
      }
    ]);

    const customerCount = await Customer.countDocuments({ affiliateId: affiliate.affiliateId });

    affiliateReports.push({
      affiliateId: affiliate.affiliateId,
      name: `${affiliate.firstName} ${affiliate.lastName}`,
      businessName: affiliate.businessName,
      serviceLocation: {
        latitude: affiliate.serviceLatitude,
        longitude: affiliate.serviceLongitude,
        radius: affiliate.serviceRadius
      },
      customerCount,
      totalOrders: stats[0]?.totalOrders || 0,
      totalRevenue: stats[0]?.totalRevenue || 0,
      totalCommission: stats[0]?.totalCommission || 0,
      isActive: affiliate.isActive
    });
  }

  return affiliateReports;
}

async function generateComprehensiveReport(startDate, endDate) {
  const [orders, operators, affiliates] = await Promise.all([
    generateOrdersReport(startDate, endDate),
    generateOperatorsReport(startDate, endDate),
    generateAffiliatesReport(startDate, endDate)
  ]);

  return {
    orders,
    operators,
    affiliates,
    summary: {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.actualTotal, 0),
      activeOperators: operators.filter(op => op.isActive).length,
      activeAffiliates: affiliates.filter(aff => aff.isActive).length
    }
  };
}

/**
 * @desc    Update operator performance statistics
 * @route   PATCH /api/v1/operators/:id/stats
 * @access  Private (Admin with operators.update permission)
 */
exports.updateOperatorStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { processingTime, qualityScore, qualityPassed, totalOrdersProcessed } = req.body;

    // Validate processingTime is positive
    if (processingTime !== undefined && processingTime <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Processing time must be positive'
      });
    }

    // Validate qualityScore is between 0 and 100
    if (qualityScore !== undefined && (qualityScore < 0 || qualityScore > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Quality score must be between 0 and 100'
      });
    }

    // Find and update operator
    const operator = await Operator.findById(id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Handle processing time update (implies a completed order)
    if (processingTime !== undefined) {
      const currentTotal = operator.totalOrdersProcessed || 0;
      const currentAvg = operator.averageProcessingTime || 0;

      // Calculate new running average: (old_avg * old_count + new_time) / new_count
      const newTotal = currentTotal + 1;
      const newAverage = (currentAvg * currentTotal + processingTime) / newTotal;

      operator.totalOrdersProcessed = newTotal;
      operator.averageProcessingTime = newAverage;
    }

    // Handle quality score update
    if (qualityPassed !== undefined) {
      const currentScore = operator.qualityScore || 100;
      // Apply weighted average: old_score * 0.9 + new_result * 0.1
      const newResult = qualityPassed ? 100 : 0;
      operator.qualityScore = currentScore * 0.9 + newResult * 0.1;
    }

    // Allow direct score setting if provided
    if (qualityScore !== undefined) {
      operator.qualityScore = qualityScore;
    }

    // Allow direct total setting if provided
    if (totalOrdersProcessed !== undefined) {
      operator.totalOrdersProcessed = totalOrdersProcessed;
    }

    await operator.save();

    res.status(200).json({
      success: true,
      message: 'Operator statistics updated successfully',
      operator: {
        _id: operator._id,
        operatorId: operator.operatorId,
        firstName: operator.firstName,
        lastName: operator.lastName,
        averageProcessingTime: operator.averageProcessingTime,
        qualityScore: operator.qualityScore,
        totalOrdersProcessed: operator.totalOrdersProcessed
      }
    });
  } catch (error) {
    console.error('Error updating operator stats:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating operator statistics'
    });
  }
};

/**
 * Get available operators for order assignment
 */
exports.getAvailableOperators = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Get all active operators who are not too busy (less than 10 current orders)
    const operators = await Operator.find({
      isActive: true,
      currentOrderCount: { $lt: 10 }
    })
      .sort({ currentOrderCount: 1 })
      .limit(parseInt(limit))
      .select('operatorId firstName lastName email currentOrderCount isActive isOnShift shiftStart shiftEnd');

    res.json({
      success: true,
      operators
    });
  } catch (error) {
    console.error('Error getting available operators:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching available operators'
    });
  }
};

/**
 * Delete operator (hard delete)
 */
exports.deleteOperator = async (req, res) => {
  try {
    const { id } = req.params;

    const operator = await Operator.findById(id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Check if operator has active orders (either in DB or currentOrderCount field)
    const activeOrdersCount = await Order.countDocuments({
      assignedOperator: operator._id,
      orderProcessingStatus: { $nin: ['completed', 'delivered', 'cancelled'] }
    });

    if (activeOrdersCount > 0 || operator.currentOrderCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete operator with active orders'
      });
    }

    // Hard delete the operator
    await Operator.findByIdAndDelete(id);

    // Log audit event
    await logAuditEvent(AuditEvents.ADMIN_DELETE_OPERATOR, req.user.id, {
      operatorId: operator.operatorId,
      operatorEmail: operator.email
    });

    res.json({
      success: true,
      message: 'Operator deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting operator:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the operator'
    });
  }
};

/**
 * Reset operator PIN/password
 */
exports.resetOperatorPin = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    const operator = await Operator.findById(id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Update password and clear login attempts using save() to trigger password hashing
    operator.password = newPassword;
    operator.loginAttempts = 0;
    operator.lockUntil = undefined;
    await operator.save();

    // Log audit event
    await logAuditEvent(AuditEvents.ADMIN_RESET_OPERATOR_PASSWORD, req.user.id, {
      operatorId: operator.operatorId,
      operatorEmail: operator.email
    });

    res.json({
      success: true,
      message: 'PIN reset successfully'
    });
  } catch (error) {
    console.error('Error resetting operator PIN:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting the PIN'
    });
  }
};

/**
 * Allow operators to update their own profile (limited fields)
 */
exports.updateOperatorSelf = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const operator = await Operator.findById(id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Only allow specific fields to be updated by operators themselves
    const allowedFields = ['firstName', 'lastName', 'password', 'phone'];
    const filteredUpdates = {};

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    // Prevent operators from changing critical fields
    delete filteredUpdates.operatorId;
    delete filteredUpdates.email;
    delete filteredUpdates.isActive;
    delete filteredUpdates.permissions;

    // Apply updates
    Object.assign(operator, filteredUpdates);
    const updatedOperator = await operator.save();

    // Filter sensitive fields from response - operator viewing their own profile
    const { getFilteredData } = require('../utils/fieldFilter');
    const responseData = getFilteredData('operator', updatedOperator.toObject(), 'operator', { isSelf: true });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      operator: responseData
    });
  } catch (error) {
    console.error('Error updating operator profile:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the profile'
    });
  }
};

/**
 * Allow operators to view their own profile
 */
exports.getOperatorSelf = async (req, res) => {
  try {
    const { id } = req.params;

    const operator = await Operator.findById(id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Filter sensitive fields from response - operator viewing their own profile
    const { getFilteredData } = require('../utils/fieldFilter');
    const responseData = getFilteredData('operator', operator.toObject(), 'operator', { isSelf: true });

    res.json({
      success: true,
      operator: responseData
    });
  } catch (error) {
    console.error('Error getting operator profile:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the profile'
    });
  }
};

/**
 * Get environment variables (sanitized for display)
 */
exports.getEnvironmentVariables = async (req, res) => {
  try {
    // Define which environment variables to expose
    const allowedVars = [
      // Application
      'NODE_ENV',
      'PORT',
      'BASE_URL',
      'FRONTEND_URL',
      'BACKEND_URL',
      'CORS_ORIGIN',
      'OAUTH_CALLBACK_URI',
      'TRUST_PROXY',
      'COOKIE_SECURE',
      
      // Database
      'MONGODB_URI',
      
      // Security & Authentication
      'JWT_SECRET',
      'SESSION_SECRET',
      'ENCRYPTION_KEY',
      
      // Email
      'EMAIL_PROVIDER',
      'EMAIL_FROM',
      'EMAIL_HOST',
      'EMAIL_PORT',
      'EMAIL_USER',
      'EMAIL_PASS',
      'EMAIL_SECURE',
      
      // DocuSign
      'DOCUSIGN_INTEGRATION_KEY',
      'DOCUSIGN_USER_ID',
      'DOCUSIGN_ACCOUNT_ID',
      'DOCUSIGN_BASE_URL',
      'DOCUSIGN_OAUTH_BASE_URL',
      'DOCUSIGN_CLIENT_SECRET',
      'DOCUSIGN_REDIRECT_URI',
      'DOCUSIGN_PRIVATE_KEY',
      'DOCUSIGN_WEBHOOK_SECRET',
      'DOCUSIGN_W9_TEMPLATE_ID',
      
      // Payment - Paygistix (deprecated - now in paygistix-forms.json)
      
      // AWS (Optional)
      'AWS_S3_BUCKET',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      
      // Stripe (Deprecated but still in env)
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_SECRET_KEY',
      
      // Features
      'SHOW_DOCS',
      'ENABLE_TEST_PAYMENT_FORM',
      'ENABLE_DELETE_DATA_FEATURE',
      'CSRF_PHASE',
      'RELAX_RATE_LIMITING',
      
      // Rate Limiting
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX_REQUESTS',
      'AUTH_RATE_LIMIT_MAX',
      
      // Social Login
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'LINKEDIN_CLIENT_ID',
      'LINKEDIN_CLIENT_SECRET',
      
      // Logging
      'LOG_LEVEL',
      'LOG_DIR',
      
      // Business Configuration
      'BAG_FEE',
      
      // Default Accounts
      'DEFAULT_ADMIN_EMAIL'
    ];

    // Check if user is super-admin (has all permissions or specific super-admin flag)
    const isSuperAdmin = req.user.permissions?.includes('*') || 
                        req.user.isSuperAdmin || 
                        req.user.email === process.env.DEFAULT_ADMIN_EMAIL;

    // Collect environment variables
    const variables = {};
    const sensitiveValues = {};
    
    for (const varName of allowedVars) {
      const value = process.env[varName] || '';
      
      // Check if this is a sensitive variable
      const isSensitive = varName.includes('SECRET') || 
                         varName.includes('PASSWORD') || 
                         varName.includes('KEY') || 
                         varName.includes('TOKEN');
      
      if (isSensitive && isSuperAdmin && value) {
        // Store actual value for super-admins
        sensitiveValues[varName] = value;
        variables[varName] = '••••••••'; // Still mask in main object
      } else {
        variables[varName] = value;
      }
    }

    // Add Paygistix configuration from JSON file
    let paygistixConfig = {};
    try {
      const paygistixForms = require('../config/paygistix-forms.json');
      paygistixConfig = {
        'PAYGISTIX_MERCHANT_ID (from JSON)': paygistixForms.merchantId || 'Not configured',
        'PAYGISTIX_FORM_ID (from JSON)': paygistixForms.form?.formId || 'Not configured',
        'PAYGISTIX_FORM_HASH (from JSON)': isSuperAdmin ? (paygistixForms.form?.formHash || 'Not configured') : '••••••••',
        'PAYGISTIX_CONFIG_SOURCE': 'paygistix-forms.json'
      };
    } catch (error) {
      paygistixConfig = {
        'PAYGISTIX_CONFIG_ERROR': 'Failed to load paygistix-forms.json'
      };
    }

    // Log access for audit
    await logAuditEvent(
      AuditEvents.ADMIN_VIEW_ENV_VARS,
      req.user,
      { 
        action: 'view_environment_variables',
        viewedSensitive: isSuperAdmin && Object.keys(sensitiveValues).length > 0
      },
      req
    );

    res.json({
      success: true,
      variables: { ...variables, ...paygistixConfig },
      sensitiveValues: isSuperAdmin ? sensitiveValues : {},
      isSuperAdmin
    });

  } catch (error) {
    console.error('Error fetching environment variables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch environment variables'
    });
  }
};

/**
 * Reset rate limits for specified criteria
 */
exports.resetRateLimits = async (req, res) => {
  try {
    const { type, ip } = req.body;
    const db = mongoose.connection.db;
    
    if (!db) {
      console.error('Database connection not available');
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    // Build the filter based on provided criteria
    let filter = {};
    
    if (ip) {
      // Escape special regex characters in IP
      const escapedIp = ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.key = new RegExp(escapedIp);
    } else if (type) {
      // Filter by type of rate limit
      filter.key = new RegExp(`^${type}:`);
    }

    // Access the rate_limits collection directly
    const collection = db.collection('rate_limits');
    const result = await collection.deleteMany(filter);

    // Log the action for audit
    await logAuditEvent(
      AuditEvents.ADMIN_RESET_RATE_LIMITS,
      req.user,
      { 
        type,
        ip,
        deletedCount: result.deletedCount
      },
      req
    );

    res.json({
      success: true,
      message: `Reset ${result.deletedCount} rate limit entries`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error resetting rate limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset rate limits',
      error: error.message
    });
  }
};

/**
 * Get all beta requests
 */
exports.getBetaRequests = async (req, res) => {
  try {
    const betaRequests = await BetaRequest.find({})
      .sort('-createdAt')
      .lean();

    res.json({
      success: true,
      betaRequests: betaRequests.map(request => ({
        _id: request._id,
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        phone: request.phone,
        businessName: request.businessName,
        address: request.address,
        city: request.city,
        state: request.state,
        zipCode: request.zipCode,
        message: request.message,
        welcomeEmailSent: request.welcomeEmailSent,
        welcomeEmailSentAt: request.welcomeEmailSentAt,
        welcomeEmailSentBy: request.welcomeEmailSentBy,
        createdAt: request.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching beta requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch beta requests'
    });
  }
};

/**
 * Send welcome email to beta request
 */
exports.sendBetaWelcomeEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const betaRequest = await BetaRequest.findById(id);
    if (!betaRequest) {
      return res.status(404).json({
        success: false,
        message: 'Beta request not found'
      });
    }

    if (betaRequest.welcomeEmailSent) {
      return res.status(400).json({
        success: false,
        message: 'Welcome email has already been sent to this user'
      });
    }

    // Send the welcome email
    await emailService.sendBetaWelcomeEmail(betaRequest);

    // Update the beta request record
    betaRequest.welcomeEmailSent = true;
    betaRequest.welcomeEmailSentAt = new Date();
    betaRequest.welcomeEmailSentBy = req.user.email || req.user.adminId;
    await betaRequest.save();

    // Log the action
    await logAuditEvent(
      AuditEvents.ADMIN_SENT_BETA_WELCOME,
      req.user,
      {
        betaRequestId: betaRequest._id,
        recipientEmail: betaRequest.email,
        recipientName: `${betaRequest.firstName} ${betaRequest.lastName}`
      },
      req
    );

    res.json({
      success: true,
      message: 'Welcome email sent successfully'
    });
  } catch (error) {
    console.error('Error sending beta welcome email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome email'
    });
  }
};

/**
 * Check if an affiliate exists for a given email
 */
exports.checkAffiliateExists = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const affiliate = await Affiliate.findOne({ email: email.toLowerCase() });
    
    res.json({
      success: true,
      exists: !!affiliate
    });
  } catch (error) {
    console.error('Error checking affiliate existence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check affiliate existence'
    });
  }
};

/**
 * Send reminder email to beta request user who hasn't registered
 */
exports.sendBetaReminderEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const betaRequest = await BetaRequest.findById(id);
    if (!betaRequest) {
      return res.status(404).json({
        success: false,
        message: 'Beta request not found'
      });
    }

    if (!betaRequest.welcomeEmailSent) {
      return res.status(400).json({
        success: false,
        message: 'Welcome email must be sent before sending reminders'
      });
    }

    // Check if affiliate already exists
    const affiliate = await Affiliate.findOne({ email: betaRequest.email.toLowerCase() });
    if (affiliate) {
      return res.status(400).json({
        success: false,
        message: 'User has already registered as an affiliate'
      });
    }

    // Send the reminder email
    await emailService.sendBetaReminderEmail(betaRequest);

    // Log the action
    await logAuditEvent(
      AuditEvents.ADMIN_SENT_BETA_REMINDER,
      req.user,
      {
        betaRequestId: betaRequest._id,
        recipientEmail: betaRequest.email,
        recipientName: `${betaRequest.firstName} ${betaRequest.lastName}`
      },
      req
    );

    res.json({
      success: true,
      message: 'Reminder email sent successfully'
    });
  } catch (error) {
    console.error('Error sending beta reminder email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reminder email'
    });
  }
};