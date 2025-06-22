const Affiliate = require('../models/Affiliate');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const PaymentExport = require('../models/PaymentExport');
const SystemConfig = require('../models/SystemConfig');
const { formatCurrency } = require('../utils/helpers');
const csv = require('csv-writer').createObjectCsvStringifier;
// W9AuditService removed - W9 management now handled by DocuSign

/**
 * QuickBooks Export Controller
 * Handles generation of QuickBooks-compatible export files for vendor data and payment summaries
 */

/**
 * Export vendors (affiliates with verified W-9s) to QuickBooks format
 */
exports.exportVendors = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    // Get all affiliates with verified W-9s
    const affiliates = await Affiliate.find({
      'w9Information.status': 'verified'
    }).select('affiliateId firstName lastName email w9Information createdAt');

    if (affiliates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No verified vendors found for export'
      });
    }

    // Create export record
    const exportId = `EXP-${Date.now()}`;
    const exportData = {
      type: 'vendor',
      generatedBy: req.user._id || req.user.id,
      filename: `wavemax-vendors-${exportId}.${format}`,
      format: format,
      recordCount: affiliates.length,
      affiliateIds: affiliates.map(a => a.affiliateId),
      exportData: {
        vendors: affiliates.map(affiliate => ({
          affiliateId: affiliate.affiliateId,
          displayName: affiliate.w9Information.quickbooksData?.displayName ||
                                `${affiliate.firstName} ${affiliate.lastName}`,
          taxIdLast4: affiliate.w9Information.taxIdLast4,
          businessName: affiliate.w9Information.businessName,
          email: affiliate.email,
          quickbooksVendorId: affiliate.w9Information.quickbooksVendorId
        }))
      }
    };

    const exportRecord = await PaymentExport.create(exportData);

    if (format === 'csv') {
      // Generate CSV for QuickBooks import
      const csvStringifier = csv({
        header: [
          { id: 'vendorName', title: 'Vendor' },
          { id: 'companyName', title: 'Company' },
          { id: 'displayName', title: 'Display Name as' },
          { id: 'firstName', title: 'First Name' },
          { id: 'lastName', title: 'Last Name' },
          { id: 'email', title: 'Main Email' },
          { id: 'taxId', title: 'Tax ID' },
          { id: 'vendorType', title: 'Vendor Type' },
          { id: 'terms', title: 'Terms' },
          { id: 'trackPayments', title: 'Track payments for 1099' },
          { id: 'accountNumber', title: 'Account No.' }
        ]
      });

      const records = affiliates.map(affiliate => ({
        vendorName: `${affiliate.firstName} ${affiliate.lastName}`,
        companyName: affiliate.w9Information.businessName || '',
        displayName: affiliate.w9Information.quickbooksData?.displayName ||
                           `${affiliate.firstName} ${affiliate.lastName}`,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        email: affiliate.email,
        taxId: `****${affiliate.w9Information.taxIdLast4}`,
        vendorType: affiliate.w9Information.quickbooksData?.vendorType || '1099 Contractor',
        terms: affiliate.w9Information.quickbooksData?.terms || 'Net 15',
        trackPayments: 'Yes',
        accountNumber: affiliate.affiliateId
      }));

      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

      // Audit logging removed - using standard logger instead
      console.log(`QuickBooks vendor export: CSV, ${affiliates.length} records, exportId: ${exportRecord.exportId}`);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wavemax-vendors-${exportRecord.exportId}.csv"`);
      return res.send(csvContent);
    }

    // Audit logging removed - using standard logger instead
    console.log(`QuickBooks vendor export: JSON, ${affiliates.length} records, exportId: ${exportRecord.exportId}`);

    // Return JSON format
    res.json({
      success: true,
      export: exportRecord,
      vendorCount: affiliates.length
    });

  } catch (error) {
    console.error('QuickBooks vendor export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export vendors',
      error: error.message
    });
  }
};

/**
 * Export payment summary for a date range
 */
exports.exportPaymentSummary = async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get orders for the period with valid affiliate commissions
    const orders = await Order.find({
      status: 'complete',
      completedAt: { $gte: start, $lte: end },
      affiliateId: { $exists: true },
      affiliateCommission: { $gt: 0 }
    });
    
    // Manually populate affiliate data
    const affiliateIds = [...new Set(orders.map(o => o.affiliateId))];
    const affiliates = await Affiliate.find({ affiliateId: { $in: affiliateIds } });
    const affiliateMap = {};
    affiliates.forEach(aff => { affiliateMap[aff.affiliateId] = aff; });
    
    // Attach affiliate data to orders
    orders.forEach(order => {
      order.affiliateData = affiliateMap[order.affiliateId];
    });

    // Filter out orders where affiliate doesn't have verified W-9
    const validOrders = orders.filter(order =>
      order.affiliateData &&
            order.affiliateData.w9Information?.status === 'verified'
    );

    if (validOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No payable commissions found for the specified period'
      });
    }

    // Group by affiliate
    const affiliatePayments = {};
    validOrders.forEach(order => {
      const affiliateId = order.affiliateId;
      if (!affiliatePayments[affiliateId]) {
        affiliatePayments[affiliateId] = {
          affiliate: order.affiliateData,
          orders: [],
          totalCommission: 0
        };
      }
      affiliatePayments[affiliateId].orders.push({
        orderId: order.orderId,
        completedAt: order.completedAt,
        orderTotal: order.actualTotal || order.estimatedTotal,
        commission: order.affiliateCommission
      });
      affiliatePayments[affiliateId].totalCommission += order.affiliateCommission;
    });

    // Create export record
    const exportId = `EXP-${Date.now()}`;
    const totalCommissions = Object.values(affiliatePayments).reduce((sum, p) => sum + p.totalCommission, 0);
    const exportData = {
      type: 'payment_summary',
      periodStart: start,
      periodEnd: end,
      generatedBy: req.user._id || req.user.id,
      filename: `wavemax-payment-summary-${exportId}.${format}`,
      format: format,
      affiliateIds: Object.keys(affiliatePayments),
      orderIds: validOrders.map(o => o.orderId),
      totalAmount: totalCommissions,
      recordCount: Object.keys(affiliatePayments).length,
      exportData: {
        payments: Object.values(affiliatePayments).map(payment => ({
          affiliateId: payment.affiliate.affiliateId,
          affiliateName: `${payment.affiliate.firstName} ${payment.affiliate.lastName}`,
          orderCount: payment.orders.length,
          totalCommission: payment.totalCommission,
          orders: payment.orders
        }))
      }
    };

    const exportRecord = await PaymentExport.create(exportData);

    if (format === 'csv') {
      // Generate CSV for QuickBooks bills/payments
      const csvStringifier = csv({
        header: [
          { id: 'date', title: 'Date' },
          { id: 'vendorName', title: 'Vendor' },
          { id: 'accountNumber', title: 'Account Number' },
          { id: 'description', title: 'Description' },
          { id: 'amount', title: 'Amount' },
          { id: 'account', title: 'Expense Account' },
          { id: 'memo', title: 'Memo' }
        ]
      });

      const records = [];
      Object.values(affiliatePayments).forEach(payment => {
        const vendorName = payment.affiliate.w9Information.quickbooksData?.displayName ||
                                 `${payment.affiliate.firstName} ${payment.affiliate.lastName}`;

        records.push({
          date: end.toISOString().split('T')[0],
          vendorName: vendorName,
          accountNumber: payment.affiliate.affiliateId,
          description: `Commission payment for ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
          amount: payment.totalCommission.toFixed(2),
          account: payment.affiliate.w9Information.quickbooksData?.defaultExpenseAccount || 'Commission Expense',
          memo: `${payment.orders.length} orders processed`
        });
      });

      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wavemax-payments-${exportRecord.exportId}.csv"`);
      return res.send(csvContent);
    }

    // Return JSON format
    res.json({
      success: true,
      export: exportRecord,
      summary: {
        periodStart: start,
        periodEnd: end,
        totalAffiliates: Object.keys(affiliatePayments).length,
        totalCommissions: Object.values(affiliatePayments).reduce((sum, p) => sum + p.totalCommission, 0),
        totalOrders: validOrders.length
      }
    });

  } catch (error) {
    console.error('QuickBooks payment export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export payment summary',
      error: error.message
    });
  }
};

/**
 * Export detailed commission report
 */
exports.exportCommissionDetail = async (req, res) => {
  try {
    const { affiliateId, startDate, endDate, format = 'csv' } = req.query;

    if (!affiliateId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Affiliate ID, start date, and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get affiliate
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    if (affiliate.w9Information?.status !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Affiliate does not have a verified W-9 on file'
      });
    }

    // Get orders for this affiliate
    const orders = await Order.find({
      status: 'complete',
      completedAt: { $gte: start, $lte: end },
      affiliateId: affiliate.affiliateId,
      affiliateCommission: { $gt: 0 }
    }).sort({ completedAt: 1 });
    
    // Manually populate customer data
    const customerIds = [...new Set(orders.map(o => o.customerId))];
    const customers = await Customer.find({ customerId: { $in: customerIds } });
    const customerMap = {};
    customers.forEach(cust => { customerMap[cust.customerId] = cust; });
    
    // Attach customer data to orders
    orders.forEach(order => {
      order.customerData = customerMap[order.customerId];
    });

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No commissions found for this affiliate in the specified period'
      });
    }

    // Create export record
    const exportId = `EXP-${Date.now()}`;
    const totalCommission = orders.reduce((sum, order) => sum + order.affiliateCommission, 0);
    const exportData = {
      type: 'commission_detail',
      periodStart: start,
      periodEnd: end,
      generatedBy: req.user._id || req.user.id,
      filename: `wavemax-commission-detail-${exportId}.${format}`,
      format: format,
      affiliateIds: [affiliateId],
      orderIds: orders.map(o => o.orderId),
      totalAmount: totalCommission,
      recordCount: orders.length,
      exportData: {
        affiliate: {
          affiliateId: affiliate.affiliateId,
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          email: affiliate.email
        },
        orders: orders.map(order => ({
          orderId: order.orderId,
          completedAt: order.completedAt,
          customerName: order.customerData ? `${order.customerData.firstName} ${order.customerData.lastName}` : 'Unknown',
          orderTotal: order.actualTotal || order.estimatedTotal,
          commission: order.affiliateCommission,
          commissionRate: 10 // Default commission rate
        })),
        totalCommission: orders.reduce((sum, order) => sum + order.affiliateCommission, 0)
      }
    };

    const exportRecord = await PaymentExport.create(exportData);

    if (format === 'csv') {
      // Generate detailed CSV
      const csvStringifier = csv({
        header: [
          { id: 'orderId', title: 'Order ID' },
          { id: 'date', title: 'Date' },
          { id: 'customer', title: 'Customer' },
          { id: 'orderTotal', title: 'Order Total' },
          { id: 'commissionRate', title: 'Commission Rate' },
          { id: 'commission', title: 'Commission Amount' }
        ]
      });

      const records = orders.map(order => ({
        orderId: order.orderId,
        date: order.completedAt.toISOString().split('T')[0],
        customer: order.customerData ? `${order.customerData.firstName} ${order.customerData.lastName}` : 'Unknown',
        orderTotal: (order.actualTotal || order.estimatedTotal || 0).toFixed(2),
        commissionRate: '10%', // Default commission rate
        commission: order.affiliateCommission.toFixed(2)
      }));

      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wavemax-commission-detail-${affiliateId}-${exportRecord.exportId}.csv"`);
      return res.send(csvContent);
    }

    // Return JSON format
    res.json({
      success: true,
      export: exportRecord
    });

  } catch (error) {
    console.error('QuickBooks commission detail export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export commission detail',
      error: error.message
    });
  }
};

/**
 * Get export history
 */
exports.getExportHistory = async (req, res) => {
  try {
    const { type, limit = 20 } = req.query;

    const query = {};
    if (type) query.type = type;

    const exports = await PaymentExport.find(query)
      .populate('generatedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      exports
    });

  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve export history',
      error: error.message
    });
  }
};