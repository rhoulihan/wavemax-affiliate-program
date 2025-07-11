const express = require('express');
const router = express.Router();
const administratorController = require('../controllers/administratorController');
const { authenticate } = require('../middleware/auth');
const { checkRole, checkAdminPermission } = require('../middleware/rbac');
const { body } = require('express-validator');
const { customPasswordValidator } = require('../utils/passwordValidator');

// All routes require authentication and administrator role
router.use(authenticate);
router.use(checkRole(['administrator']));

// Dashboard (must come before /:id routes)
router.get('/dashboard', administratorController.getDashboard);

// Operator Management (must come before /:id routes)
router.post('/operators', checkAdminPermission(['operator_management']), [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').custom(customPasswordValidator())
], administratorController.createOperator);
router.get('/operators', administratorController.getOperators);
router.get('/operators/:operatorId', administratorController.getOperatorById);
router.put('/operators/:operatorId', checkAdminPermission(['operator_management']), administratorController.updateOperator);
router.delete('/operators/:operatorId', checkAdminPermission(['operator_management']), administratorController.deactivateOperator);
router.post('/operators/:operatorId/reset-password', checkAdminPermission(['operator_management']), administratorController.resetOperatorPassword);

// Affiliates list (for dropdowns, filters, etc.)
router.get('/affiliates', checkAdminPermission(['view_analytics']), administratorController.getAffiliatesList);

// Analytics (must come before /:id routes)
router.get('/analytics/orders', checkAdminPermission(['view_analytics']), administratorController.getOrderAnalytics);
router.get('/analytics/operators', checkAdminPermission(['view_analytics']), administratorController.getOperatorAnalytics);
router.get('/analytics/affiliates', checkAdminPermission(['view_analytics']), administratorController.getAffiliateAnalytics);

// Reports
router.post('/reports/export', checkAdminPermission(['view_analytics']), administratorController.exportReport);

// System Configuration
router.get('/config', checkAdminPermission(['system_config']), administratorController.getSystemConfig);
router.put('/config', checkAdminPermission(['system_config']), administratorController.updateSystemConfig);

// Environment Variables
router.get('/env-variables', checkAdminPermission(['system_config']), administratorController.getEnvironmentVariables);

// System Health
router.get('/system/health', administratorController.getSystemHealth);

// Administrator CRUD routes (these have :id params so must come after specific routes)
router.get('/', checkAdminPermission(['administrators.read']), administratorController.getAdministrators);
router.get('/permissions', administratorController.getPermissions);
router.post('/', checkAdminPermission(['administrators.create']), [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').custom(customPasswordValidator())
], administratorController.createAdministrator);

// Change password route (for logged-in admin changing their own password)
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').custom(customPasswordValidator())
], administratorController.changeAdministratorPassword);

/**
 * @route   POST /api/administrators/reset-rate-limits
 * @desc    Reset rate limiting counters
 * @access  Private - Administrator only
 */
router.post('/reset-rate-limits', checkAdminPermission(['system.manage']), async (req, res) => {
  try {
    const { type, ip } = req.body;
    
    // Get the rate_limits collection
    const db = require('mongoose').connection.db;
    const collection = db.collection('rate_limits');
    
    // Build filter
    let filter = {};
    
    if (type) {
      filter.key = new RegExp(type, 'i');
    }
    
    if (ip) {
      filter.key = new RegExp(ip.replace(/\./g, '\\.'));
    }
    
    // Delete matching records
    const result = await collection.deleteMany(filter);
    
    res.json({
      success: true,
      message: `Reset ${result.deletedCount} rate limit records`,
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    console.error('Error resetting rate limits:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting rate limits'
    });
  }
});

// Administrator routes with :id parameter (MUST BE LAST)
router.get('/:id', checkAdminPermission(['administrators.read']), administratorController.getAdministratorById);
router.patch('/:id', checkAdminPermission(['administrators.update']), administratorController.updateAdministrator);
router.delete('/:id', checkAdminPermission(['administrators.delete']), administratorController.deleteAdministrator);
router.post('/:id/reset-password', checkAdminPermission(['administrators.update']), administratorController.resetAdministratorPassword);


module.exports = router;