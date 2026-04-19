// Admin dashboard + analytics service
//
// All the heavy aggregation pipelines the admin UI leans on: the dashboard
// overview (counts, status distributions, top operators/affiliates, recent
// activity), plus three drill-down analytics endpoints and the CSV/JSON
// export pipeline. Aggregations here are read-only; no audit logging
// required except on the report export (controller handles that).

const mongoose = require('mongoose');
const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

const GROUP_BY_FORMAT = {
  day: '%Y-%m-%d',
  week: '%Y-W%V',
  month: '%Y-%m'
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function resolveDateRange({ startDate, endDate }) {
  return {
    start: startDate ? new Date(startDate) : new Date(Date.now() - THIRTY_DAYS_MS),
    end: endDate ? new Date(endDate) : new Date()
  };
}

async function getDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const orderStats = await Order.aggregate([
    {
      $facet: {
        today: [{ $match: { createdAt: { $gte: today } } }, { $count: 'count' }],
        thisWeek: [{ $match: { createdAt: { $gte: thisWeekStart } } }, { $count: 'count' }],
        thisMonth: [{ $match: { createdAt: { $gte: thisMonthStart } } }, { $count: 'count' }],
        statusDistribution: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
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
                1000 * 60
              ]
            }
          } },
          { $group: { _id: null, avg: { $avg: '$processingTime' } } }
        ]
      }
    }
  ]);

  const operatorPerformance = await Operator.aggregate([
    { $match: { isActive: true } },
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'assignedOperator', as: 'orders' } },
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

  const affiliatePerformance = await Affiliate.aggregate([
    { $match: { isActive: true } },
    { $lookup: { from: 'orders', localField: 'affiliateId', foreignField: 'affiliateId', as: 'orders' } },
    { $lookup: { from: 'customers', localField: 'affiliateId', foreignField: 'affiliateId', as: 'customers' } },
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

  const systemHealth = {
    activeOperators: await Operator.countDocuments({ isActive: true }),
    onShiftOperators: await Operator.findOnShift().then(ops => ops.length),
    activeAffiliates: await Affiliate.countDocuments({ isActive: true }),
    totalCustomers: await Customer.countDocuments(),
    ordersInProgress: await Order.countDocuments({
      status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }
    }),
    completedOrders: await Order.countDocuments({ status: 'complete' }),
    // Orders stuck in processing for > 24h — surfaces queue backups.
    processingDelays: await Order.countDocuments({
      status: 'processing',
      processingStartedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
  };

  const recentOrders = await Order.find({}).sort({ updatedAt: -1 }).limit(10).lean();
  const affiliateIds = [...new Set(recentOrders.map(o => o.affiliateId).filter(Boolean))];

  let recentActivity = [];
  if (affiliateIds.length > 0) {
    const affiliates = await Affiliate.find({ affiliateId: { $in: affiliateIds } })
      .select('affiliateId firstName lastName businessName')
      .lean();
    const affiliateMap = new Map(affiliates.map(a => [a.affiliateId, a]));

    recentActivity = recentOrders.map(order => {
      const affiliate = affiliateMap.get(order.affiliateId);
      return {
        timestamp: order.updatedAt,
        type: 'Order',
        userName: affiliate ? `${affiliate.firstName} ${affiliate.lastName}` : 'Unknown',
        action: `Order ${order.orderId} - Status: ${order.status}`
      };
    });
  }

  return {
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
    recentActivity
  };
}

async function getOrderAnalytics({ startDate, endDate, groupBy = 'day' }) {
  const { start, end } = resolveDateRange({ startDate, endDate });
  const format = GROUP_BY_FORMAT[groupBy] || GROUP_BY_FORMAT.day;

  const timeline = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $addFields: {
        completionTimeMinutes: {
          $cond: [
            {
              $and: [
                { $eq: ['$status', 'complete'] },
                { $ne: ['$processingStarted', null] },
                { $ne: ['$processingCompleted', null] }
              ]
            },
            { $divide: [{ $subtract: ['$processingCompleted', '$processingStarted'] }, 60000] },
            null
          ]
        }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt' } },
        totalOrders: { $sum: 1 },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        totalRevenue: { $sum: '$actualTotal' },
        averageOrderValue: { $avg: '$actualTotal' },
        averageProcessingTime: {
          $avg: { $cond: [{ $eq: ['$status', 'complete'] }, '$completionTimeMinutes', null] }
        },
        totalWeight: { $sum: '$actualWeight' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const processingTimeDistribution = await Order.aggregate([
    {
      $match: {
        processingTimeMinutes: { $exists: true },
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $bucket: {
        groupBy: '$processingTimeMinutes',
        boundaries: [0, 30, 60, 90, 120, 180, 240, 300],
        default: 'Other',
        output: { count: { $sum: 1 }, orders: { $push: '$orderId' } }
      }
    }
  ]);

  const nonZeroProcessing = timeline.filter(item => item.averageProcessingTime > 0);
  return {
    timeline,
    processingTimeDistribution,
    summary: {
      totalOrders: timeline.reduce((sum, item) => sum + item.totalOrders, 0),
      completedOrders: timeline.reduce((sum, item) => sum + item.completedOrders, 0),
      totalRevenue: timeline.reduce((sum, item) => sum + (item.totalRevenue || 0), 0),
      averageOrderValue: timeline.length
        ? timeline.reduce((sum, item) => sum + (item.averageOrderValue || 0), 0) / timeline.length
        : 0,
      averageProcessingTime: nonZeroProcessing.length
        ? nonZeroProcessing.reduce((sum, item) => sum + (item.averageProcessingTime || 0), 0) / nonZeroProcessing.length
        : 0
    }
  };
}

async function getOperatorAnalytics({ startDate, endDate }) {
  const { start, end } = resolveDateRange({ startDate, endDate });

  const operators = await Operator.aggregate([
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
                  { $gte: ['$createdAt', start] },
                  { $lte: ['$createdAt', end] }
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

  const workstations = await Order.aggregate([
    {
      $match: {
        assignedOperator: { $exists: true },
        createdAt: { $gte: start, $lte: end }
      }
    },
    { $lookup: { from: 'operators', localField: 'assignedOperator', foreignField: '_id', as: 'operator' } },
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

  return { operators, workstations };
}

async function getAffiliateAnalytics({ startDate, endDate }) {
  const { start, end } = resolveDateRange({ startDate, endDate });

  const affiliates = await Affiliate.aggregate([
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
                  { $gte: ['$createdAt', start] },
                  { $lte: ['$createdAt', end] }
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
        w9Status: 1,
        paymentProcessingLocked: 1,
        email: 1,
        metrics: {
          totalCustomers: { $size: '$customers' },
          activeCustomers: {
            $size: {
              $filter: { input: '$customers', cond: { $eq: ['$$this.isActive', true] } }
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

  const geographicDistribution = await Affiliate.aggregate([
    {
      $group: {
        _id: '$city',
        affiliateCount: { $sum: 1 },
        activeAffiliates: { $sum: { $cond: ['$isActive', 1, 0] } },
        avgServiceRadius: { $avg: '$serviceRadius' }
      }
    },
    { $sort: { affiliateCount: -1 } }
  ]);

  return { affiliates, geographicDistribution };
}

async function generateOrdersReport({ startDate, endDate }) {
  const { start, end } = resolveDateRange({ startDate, endDate });
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end } })
    .populate('assignedOperator', 'firstName lastName operatorId')
    .populate('affiliateId', 'firstName lastName businessName')
    .lean();

  return orders.map(order => ({
    orderId: order.orderId,
    customerID: order.customerId,
    affiliateName: order.affiliateId
      ? `${order.affiliateId.firstName} ${order.affiliateId.lastName}`
      : 'N/A',
    status: order.status,
    processingStatus: order.orderProcessingStatus,
    operator: order.assignedOperator
      ? `${order.assignedOperator.firstName} ${order.assignedOperator.lastName}`
      : 'Unassigned',
    processingTime: order.processingTimeMinutes || 0,
    actualWeight: order.actualWeight || 0,
    actualTotal: order.actualTotal || 0,
    createdAt: order.createdAt
  }));
}

async function generateOperatorsReport({ startDate, endDate }) {
  const { start, end } = resolveDateRange({ startDate, endDate });
  const operators = await Operator.find().lean();

  const reports = [];
  for (const operator of operators) {
    const orderStats = await Order.aggregate([
      { $match: { assignedOperator: operator._id, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ['$orderProcessingStatus', 'completed'] }, 1, 0] } },
          averageProcessingTime: { $avg: '$processingTimeMinutes' },
          totalProcessingTime: { $sum: '$processingTimeMinutes' }
        }
      }
    ]);

    reports.push({
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
  return reports;
}

async function generateAffiliatesReport({ startDate, endDate }) {
  const { start, end } = resolveDateRange({ startDate, endDate });
  const affiliates = await Affiliate.find().lean();

  const reports = [];
  for (const affiliate of affiliates) {
    const stats = await Order.aggregate([
      { $match: { affiliateId: affiliate.affiliateId, createdAt: { $gte: start, $lte: end } } },
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

    reports.push({
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
  return reports;
}

async function generateComprehensiveReport({ startDate, endDate }) {
  const [orders, operators, affiliates] = await Promise.all([
    generateOrdersReport({ startDate, endDate }),
    generateOperatorsReport({ startDate, endDate }),
    generateAffiliatesReport({ startDate, endDate })
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

class ReportError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isReportError = true;
  }
}

async function exportReport({ reportType = 'orders', format = 'csv', startDate, endDate, user, req }) {
  const generators = {
    orders: generateOrdersReport,
    operators: generateOperatorsReport,
    affiliates: generateAffiliatesReport,
    comprehensive: generateComprehensiveReport
  };

  const generator = generators[reportType];
  if (!generator) throw new ReportError('invalid_type', 'Invalid report type');

  const report = await generator({ startDate, endDate });

  logAuditEvent(AuditEvents.DATA_MODIFICATION, {
    action: 'EXPORT_REPORT',
    userId: user.id,
    userType: 'administrator',
    details: { reportType, format, startDate, endDate }
  }, req);

  return {
    report,
    metadata: { reportType, generatedAt: new Date(), startDate, endDate }
  };
}

module.exports = {
  getDashboard,
  getOrderAnalytics,
  getOperatorAnalytics,
  getAffiliateAnalytics,
  exportReport,
  ReportError
};
