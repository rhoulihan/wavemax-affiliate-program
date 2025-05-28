const express = require('express');
const router = express.Router();
const administratorController = require('../controllers/administratorController');
const { authenticate } = require('../middleware/auth');
const { checkRole, checkAdminPermission } = require('../middleware/rbac');

// All routes require authentication and administrator role
router.use(authenticate);
router.use(checkRole(['administrator']));

// Dashboard
router.get('/dashboard', administratorController.getDashboard);

// Operator Management
router.post('/operators', checkAdminPermission(['operator_management']), administratorController.createOperator);
router.get('/operators', administratorController.getOperators);
router.get('/operators/:operatorId', administratorController.getOperatorById);
router.put('/operators/:operatorId', checkAdminPermission(['operator_management']), administratorController.updateOperator);
router.delete('/operators/:operatorId', checkAdminPermission(['operator_management']), administratorController.deactivateOperator);
router.post('/operators/:operatorId/reset-password', checkAdminPermission(['operator_management']), administratorController.resetOperatorPassword);

// Analytics
router.get('/analytics/orders', checkAdminPermission(['view_analytics']), administratorController.getOrderAnalytics);
router.get('/analytics/operators', checkAdminPermission(['view_analytics']), administratorController.getOperatorAnalytics);
router.get('/analytics/affiliates', checkAdminPermission(['view_analytics']), administratorController.getAffiliateAnalytics);

// Reports
router.post('/reports/export', checkAdminPermission(['view_analytics']), administratorController.exportReport);

// System Configuration
router.get('/config', checkAdminPermission(['system_config']), administratorController.getSystemConfig);
router.put('/config', checkAdminPermission(['system_config']), administratorController.updateSystemConfig);

// System Health
router.get('/system/health', administratorController.getSystemHealth);

module.exports = router;