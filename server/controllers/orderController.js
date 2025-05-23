// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Bag = require('../models/Bag');
const Transaction = require('../models/Transaction');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Order Controllers
// ============================================================================

/**
 * Create a new order
 */
exports.createOrder = async (req, res) => {
  try {
    const {
      customerId,
      affiliateId,
      pickupDate,
      pickupTime,
      specialPickupInstructions,
      estimatedSize,
      serviceNotes,
      deliveryDate,
      deliveryTime,
      specialDeliveryInstructions
    } = req.body;
    
    // Verify customer exists
    const customer = await Customer.findOne({ customerId });
    
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }
    
    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });
    
    if (!affiliate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid affiliate ID'
      });
    }
    
    // Check authorization (admin, affiliate, or customer self)
    const isAuthorized = 
      req.user.role === 'admin' || 
      req.user.customerId === customerId || 
      (req.user.role === 'affiliate' && req.user.affiliateId === affiliateId);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Create new order
    const newOrder = new Order({
      customerId,
      affiliateId,
      pickupDate,
      pickupTime,
      specialPickupInstructions,
      estimatedSize,
      serviceNotes,
      deliveryDate,
      deliveryTime,
      specialDeliveryInstructions,
      deliveryFee: affiliate.deliveryFee,
      status: 'scheduled'
    });
    
    await newOrder.save();
    
    // Send notification emails (don't let email failures stop the order)
    try {
      await emailService.sendCustomerOrderConfirmationEmail(customer, newOrder, affiliate);
      await emailService.sendAffiliateNewOrderEmail(affiliate, customer, newOrder);
    } catch (emailError) {
      console.error('Failed to send notification emails:', emailError);
      // Continue with the response even if emails fail
    }
    
    res.status(201).json({
      success: true,
      orderId: newOrder.orderId,
      estimatedTotal: newOrder.estimatedTotal,
      message: 'Pickup scheduled successfully!'
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while scheduling the pickup'
    });
  }
};

/**
 * Get order details
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Find order
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization (admin, associated affiliate, or customer)
    const isAuthorized = 
      req.user.role === 'admin' || 
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId) ||
      (req.user.role === 'customer' && req.user.customerId === order.customerId);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Get customer details
    const customer = await Customer.findOne({ customerId: order.customerId });
    
    // Get affiliate details
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
    
    res.status(200).json({
      success: true,
      order: {
        orderId: order.orderId,
        customerId: order.customerId,
        customer: customer ? {
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone,
          email: customer.email,
          address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`
        } : null,
        affiliateId: order.affiliateId,
        affiliate: affiliate ? {
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          phone: affiliate.phone,
          email: affiliate.email
        } : null,
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        specialPickupInstructions: order.specialPickupInstructions,
        estimatedSize: order.estimatedSize,
        serviceNotes: order.serviceNotes,
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        specialDeliveryInstructions: order.specialDeliveryInstructions,
        status: order.status,
        baseRate: order.baseRate,
        deliveryFee: order.deliveryFee,
        actualWeight: order.actualWeight,
        bagIDs: order.bagIDs,
        washInstructions: order.washInstructions,
        estimatedTotal: order.estimatedTotal,
        actualTotal: order.actualTotal,
        affiliateCommission: order.affiliateCommission,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        pickedUpAt: order.pickedUpAt,
        processedAt: order.processedAt,
        readyForDeliveryAt: order.readyForDeliveryAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving order details'
    });
  }
};

/**
 * Update order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, actualWeight } = req.body;
    
    // Find order
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization (admin or associated affiliate)
    const isAuthorized = 
      req.user.role === 'admin' || 
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Check for valid status transition
    const validTransitions = {
      scheduled: ['picked_up', 'cancelled'],
      picked_up: ['processing', 'cancelled'],
      processing: ['ready_for_delivery'],
      ready_for_delivery: ['delivered'],
      delivered: [],
      cancelled: []
    };
    
    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`
      });
    }
    
    // Update order status
    order.status = status;
    
    // If the order is being marked as processing, update actual weight
    if (status === 'processing' && actualWeight) {
      order.actualWeight = parseFloat(actualWeight);
    }
    
    await order.save();
    
    // Find customer and affiliate
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
    
    // Send status update email to customer
    if (customer && ['picked_up', 'processing', 'ready_for_delivery', 'delivered'].includes(status)) {
      await emailService.sendOrderStatusUpdateEmail(customer, order, status);
      
      // If order is delivered, also notify affiliate of commission
      if (status === 'delivered' && affiliate) {
        await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
      }
    }
    
    res.status(200).json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      actualWeight: order.actualWeight,
      actualTotal: order.actualTotal,
      affiliateCommission: order.affiliateCommission,
      message: 'Order status updated successfully!'
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the order status'
    });
  }
};

/**
 * Cancel order
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Find order
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if order can be cancelled
    if (!['scheduled', 'picked_up'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Orders in ${order.status} status cannot be cancelled`
      });
    }
    
    // Check authorization (admin, associated affiliate, or customer)
    const isAuthorized = 
      req.user.role === 'admin' || 
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId) ||
      (req.user.role === 'customer' && req.user.customerId === order.customerId);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Update order status
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    
    // Find customer and affiliate
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
    
    // Send cancellation emails
    if (customer) {
      await emailService.sendOrderCancellationEmail(customer, order);
    }
    
    if (affiliate) {
      await emailService.sendAffiliateOrderCancellationEmail(affiliate, order, customer);
    }
    
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the order'
    });
  }
};

module.exports = exports;