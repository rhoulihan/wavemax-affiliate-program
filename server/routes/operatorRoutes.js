const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operatorController');
const administratorController = require('../controllers/administratorController');
const { authenticate } = require('../middleware/auth');
const { checkRole, checkAdminPermission } = require('../middleware/rbac');
const { body } = require('express-validator');
const { customPasswordValidator } = require('../utils/passwordValidator');

// All routes require authentication
router.use(authenticate);

// CRUD routes for administrators to manage operators
router.get('/available', checkRole(['administrator']), checkAdminPermission(['operators.read']), administratorController.getAvailableOperators);
router.get('/', checkRole(['administrator']), checkAdminPermission(['operators.read']), administratorController.getOperators);
router.post('/', checkRole(['administrator']), checkAdminPermission(['operators.create']), [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').custom(customPasswordValidator())
], administratorController.createOperator);
router.get('/:id', authenticate, async (req, res, next) => {
  // Allow operators to view their own profile
  if (req.user.role === 'operator' && req.user.id === req.params.id) {
    return administratorController.getOperatorSelf(req, res);
  }
  // Otherwise require admin permissions
  checkRole(['administrator'])(req, res, () => {
    checkAdminPermission(['operators.read'])(req, res, () => {
      administratorController.getOperatorById(req, res);
    });
  });
});
router.patch('/:id', authenticate, async (req, res, next) => {
  // Allow operators to update their own profile with limited fields
  if (req.user.role === 'operator' && req.user.id === req.params.id) {
    // Call a special self-update method for operators
    return administratorController.updateOperatorSelf(req, res);
  }
  // Otherwise require admin permissions
  checkRole(['administrator'])(req, res, () => {
    checkAdminPermission(['operators.update'])(req, res, () => {
      administratorController.updateOperator(req, res);
    });
  });
});
router.delete('/:id', checkRole(['administrator']), checkAdminPermission(['operators.delete']), administratorController.deleteOperator);
router.post('/:id/reset-password', checkRole(['administrator']), checkAdminPermission(['operators.update']), administratorController.resetOperatorPassword);
router.post('/:id/reset-pin', checkRole(['administrator']), checkAdminPermission(['operators.update']), administratorController.resetOperatorPin);
router.patch('/:id/stats', checkRole(['administrator']), checkAdminPermission(['operators.update']), administratorController.updateOperatorStats);

// Operator-specific routes (require operator role)
router.use(checkRole(['operator']));

// Order Management
router.get('/orders/queue', operatorController.getOrderQueue);
router.post('/orders/:orderId/claim', operatorController.claimOrder);
router.put('/orders/:orderId/status', operatorController.updateOrderStatus);
router.post('/orders/:orderId/quality-check', operatorController.performQualityCheck);
router.get('/orders/mine', operatorController.getMyOrders);

// Workstation Management
router.get('/workstations/status', operatorController.getWorkstationStatus);
router.post('/shift/status', operatorController.updateShiftStatus);

// Performance
router.get('/performance', operatorController.getPerformanceStats);

// Customer Information
router.get('/customers/:customerId', operatorController.getCustomerDetails);
router.post('/customers/:customerId/notes', operatorController.addCustomerNote);

// Scanner Interface Routes
router.post('/scan-customer', operatorController.scanCustomer);
router.post('/scan-bag', operatorController.scanBag);
router.post('/orders/:orderId/receive', operatorController.receiveOrder);
router.post('/orders/:orderId/process-bag', operatorController.markBagProcessed);
router.post('/orders/:orderId/ready', operatorController.markOrderReady); // Deprecated
router.post('/confirm-pickup', operatorController.confirmPickup);
router.get('/stats/today', operatorController.getTodayStats);

module.exports = router;