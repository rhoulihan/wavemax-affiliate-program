const express = require('express');
const router = express.Router();
const administratorController = require('../controllers/administratorController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');

// All routes require authentication and administrator role
router.use(authenticateToken);
router.use(requireRole('administrator'));

// Dashboard
router.get('/dashboard', administratorController.getDashboard);

// Operator Management
router.post('/operators', requirePermission('operator_management'), administratorController.createOperator);
router.get('/operators', administratorController.getOperators);
router.get('/operators/:operatorId', administratorController.getOperatorDetails);
router.put('/operators/:operatorId', requirePermission('operator_management'), administratorController.updateOperator);
router.delete('/operators/:operatorId', requirePermission('operator_management'), administratorController.deleteOperator);
router.post('/operators/:operatorId/reset-pin', requirePermission('operator_management'), administratorController.resetOperatorPin);
router.post('/operators/:operatorId/toggle-status', requirePermission('operator_management'), administratorController.toggleOperatorStatus);

// Analytics
router.get('/analytics/orders', requirePermission('view_analytics'), administratorController.getOrderAnalytics);
router.get('/analytics/operators', requirePermission('view_analytics'), administratorController.getOperatorAnalytics);
router.get('/analytics/affiliates', requirePermission('view_analytics'), administratorController.getAffiliateAnalytics);

// Reports
router.post('/reports/generate', requirePermission('view_analytics'), administratorController.generateReport);
router.get('/reports/:reportId/download', requirePermission('view_analytics'), administratorController.downloadReport);

// System Configuration
router.get('/config', requirePermission('system_config'), administratorController.getSystemConfig);
router.put('/config', requirePermission('system_config'), administratorController.updateSystemConfig);
router.get('/config/categories', requirePermission('system_config'), administratorController.getConfigCategories);

// System Health
router.get('/system/health', administratorController.getSystemHealth);

module.exports = router;