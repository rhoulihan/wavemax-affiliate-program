const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operatorController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// All routes require authentication and operator role
router.use(authenticate);
router.use(checkRole(['operator']));

// Dashboard
router.get('/dashboard', operatorController.getDashboard);

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

module.exports = router;