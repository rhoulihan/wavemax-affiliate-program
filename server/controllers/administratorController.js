// Administrator Controller for WaveMAX Laundry Affiliate Program
// Handles system configuration, operator management, and analytics

const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const Transaction = require('../models/Transaction');
const { fieldFilter } = require('../utils/fieldFilter');
const emailService = require('../utils/emailService');
const auditLogger = require('../utils/auditLogger');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Operator Management

/**
 * Create a new operator
 */
exports.createOperator = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      workStation, 
      shiftStart, 
      shiftEnd 
    } = req.body;

    // Check if operator already exists
    const existingOperator = await Operator.findOne({ email: email.toLowerCase() });
    if (existingOperator) {
      return res.status(400).json({
        success: false,
        message: 'An operator with this email already exists'
      });
    }

    // Create new operator
    const operator = new Operator({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      workStation,
      shiftStart,
      shiftEnd,
      createdBy: req.user.id
    });

    await operator.save();

    // Send welcome email
    await emailService.sendOperatorWelcomeEmail(operator, password);

    // Log the action
    await auditLogger.log({
      action: 'CREATE_OPERATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { operatorId: operator.operatorId, email: operator.email }
    });

    res.status(201).json({
      success: true,
      message: 'Operator created successfully',
      operator: fieldFilter(operator.toObject(), 'administrator')
    });

  } catch (error) {
    console.error('Error creating operator:', error);
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
      workStation, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (workStation) {
      query.workStation = workStation;
    }
    
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { operatorId: new RegExp(search, 'i') }
      ];
    }

    // Execute query with pagination
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
    const { id } = req.params;

    const operator = await Operator.findById(id)
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

    // Prevent updating sensitive fields
    delete updates.password;
    delete updates.operatorId;
    delete updates.role;
    delete updates.createdBy;

    const operator = await Operator.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Log the action
    await auditLogger.log({
      action: 'UPDATE_OPERATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { updates }
    });

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
    await auditLogger.log({
      action: 'DEACTIVATE_OPERATOR',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { operatorId: operator.operatorId }
    });

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
    await auditLogger.log({
      action: 'RESET_OPERATOR_PASSWORD',
      userId: req.user.id,
      userType: 'administrator',
      targetId: operator._id,
      targetType: 'operator',
      details: { operatorId: operator.operatorId }
    });

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
            { $match: { processingTimeMinutes: { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$processingTimeMinutes' } } }
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
      pendingOrders: await Order.countDocuments({ orderProcessingStatus: 'pending' }),
      processingDelays: await Order.countDocuments({
        orderProcessingStatus: { $in: ['assigned', 'washing', 'drying', 'folding'] },
        processingStarted: { $lte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // 2 hours
      })
    };

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
        systemHealth
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
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat[groupBy] || groupByFormat.day,
              date: '$createdAt'
            }
          },
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$actualTotal' },
          averageOrderValue: { $avg: '$actualTotal' },
          averageProcessingTime: { $avg: '$processingTimeMinutes' },
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
          totalRevenue: analytics.reduce((sum, item) => sum + (item.totalRevenue || 0), 0),
          averageOrderValue: analytics.reduce((sum, item) => sum + (item.averageOrderValue || 0), 0) / analytics.length,
          averageProcessingTime: analytics.reduce((sum, item) => sum + (item.averageProcessingTime || 0), 0) / analytics.length
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
          serviceArea: 1,
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

    // Geographic distribution
    const geographicDistribution = await Affiliate.aggregate([
      {
        $group: {
          _id: '$serviceArea',
          affiliateCount: { $sum: 1 },
          activeAffiliates: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
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
    await auditLogger.log({
      action: 'EXPORT_REPORT',
      userId: req.user.id,
      userType: 'administrator',
      details: { reportType, format, startDate, endDate }
    });

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
    await auditLogger.log({
      action: 'UPDATE_SYSTEM_CONFIG',
      userId: req.user.id,
      userType: 'administrator',
      details: { key, oldValue: config.value, newValue: value }
    });

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
      serviceArea: affiliate.serviceArea,
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