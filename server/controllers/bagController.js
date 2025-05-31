// WaveMAX Laundry Affiliate Program
// Bag Controller

const Bag = require('../models/Bag');
const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * @desc    Create a new laundry bag
 * @route   POST /api/bags
 * @access  Private (Customer/Affiliate/Admin)
 */
exports.createBag = async (req, res) => {
  try {
    const { tagNumber, type, weight, notes, specialInstructions, customerId } = req.body;

    // Validate required fields
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bag type is required' 
      });
    }

    let customer, affiliate;

    // Handle different user roles
    if (req.user.role === 'customer') {
      // Customer creating their own bag
      customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    } else if (req.user.role === 'affiliate') {
      // Affiliate creating bag for customer
      if (!customerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID is required' 
        });
      }
      customer = await Customer.findOne({ customerId });
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      // Verify affiliate owns this customer
      const customerAffiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
      if (!customerAffiliate || customerAffiliate._id.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only create bags for your own customers' 
        });
      }
      affiliate = customerAffiliate;
    } else if (req.user.role === 'administrator') {
      // Admin can create bag for any customer
      if (!customerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Customer ID is required' 
        });
      }
      customer = await Customer.findOne({ customerId });
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    }

    // Create new bag
    const newBag = new Bag({
      tagNumber,
      type,
      weight,
      notes,
      specialInstructions,
      customer: customer._id,
      affiliate: affiliate._id
    });

    const savedBag = await newBag.save();

    res.status(201).json({
      success: true,
      message: 'Bag created successfully',
      bag: savedBag
    });
  } catch (error) {
    console.error('Error creating bag:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      const hasInvalidType = messages.some(msg => msg.includes('is not a valid enum value for path `type`'));
      return res.status(400).json({
        success: false,
        message: hasInvalidType ? 'Invalid bag type' : messages.join(', ')
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bag with this barcode already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating bag',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all bags with filtering options
 * @route   GET /api/bags
 * @access  Private (Customer/Admin/Affiliate)
 */
exports.getAllBags = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    const filter = {};

    // Apply role-based filtering
    if (req.user.role === 'customer') {
      // Customers can only see their own bags
      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      filter.customer = customer._id;
    } else if (req.user.role === 'affiliate') {
      // Affiliates can see bags from their customers
      filter.affiliate = req.user.id;
    }
    // Admins can see all bags (no filter needed)

    // Apply additional filters
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Handle pagination
    const skip = (page - 1) * limit;

    const bags = await Bag.find(filter)
      .populate('customer', 'customerId firstName lastName')
      .populate('affiliate', 'affiliateId firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit * 1);

    const total = await Bag.countDocuments(filter);

    res.status(200).json({
      success: true,
      bags: bags,
      pagination: {
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        totalItems: total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting bags:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get a bag by ID
 * @route   GET /api/bags/:id
 * @access  Private (Admin/Affiliate/Customer)
 */
exports.getBagById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID is valid ObjectId or bagId
    let bag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bag = await Bag.findById(id)
        .populate('customer', 'customerId firstName lastName email')
        .populate('affiliate', 'affiliateId firstName lastName email');
    } else {
      // Try to find by bagId
      bag = await Bag.findOne({ bagId: id })
        .populate('customer', 'customerId firstName lastName email')
        .populate('affiliate', 'affiliateId firstName lastName email');
    }

    if (!bag) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bag not found' 
      });
    }

    // Check authorization
    if (req.user.role === 'customer') {
      const customer = await Customer.findById(req.user.id);
      if (!customer || bag.customer._id.toString() !== customer._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only view your own bags' 
        });
      }
    } else if (req.user.role === 'affiliate') {
      if (bag.affiliate._id.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only view bags from your customers' 
        });
      }
    }
    // Admins can view all bags

    res.status(200).json({
      success: true,
      bag: bag
    });
  } catch (error) {
    console.error('Error getting bag:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bag details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update a bag
 * @route   PATCH /api/bags/:id
 * @access  Private (Admin/Affiliate/Operator)
 */
exports.updateBag = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find bag by ID
    let bag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bag = await Bag.findById(id)
        .populate('customer')
        .populate('affiliate');
    } else {
      bag = await Bag.findOne({ bagId: id })
        .populate('customer')
        .populate('affiliate');
    }

    if (!bag) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bag not found' 
      });
    }

    // Check authorization
    if (req.user.role === 'affiliate') {
      if (bag.affiliate._id.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only update bags from your customers' 
        });
      }
    } else if (req.user.role === 'operator') {
      // Operators can update bag status
      const allowedUpdates = ['status', 'notes'];
      const requestedUpdates = Object.keys(updates);
      const isAllowed = requestedUpdates.every(update => allowedUpdates.includes(update));
      if (!isAllowed) {
        return res.status(403).json({ 
          success: false, 
          message: 'Operators can only update status and notes' 
        });
      }
    } else if (req.user.role === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Customers cannot update bags' 
      });
    }

    // Don't allow updating bagId
    delete updates.bagId;

    // Validate status transitions
    if (updates.status && bag.status !== updates.status) {
      const validTransitions = {
        'pending': ['pickedUp', 'processing', 'ready', 'delivered', 'lost'],
        'pickedUp': ['processing', 'ready', 'delivered', 'lost'],
        'processing': ['ready', 'delivered', 'lost'],
        'ready': ['delivered', 'lost'],
        'delivered': [],
        'lost': []
      };

      if (!validTransitions[bag.status].includes(updates.status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid status transition from ${bag.status} to ${updates.status}` 
        });
      }

      // Set timestamp and operator based on status change
      switch (updates.status) {
        case 'pickedUp':
          updates.pickedUpAt = new Date();
          break;
        case 'processing':
          updates.processedAt = new Date();
          updates.processingStartedAt = new Date();
          if (req.user.role === 'operator') {
            updates.processedBy = req.user.id;
          }
          break;
        case 'ready':
          updates.readyAt = new Date();
          break;
        case 'delivered':
          updates.deliveredAt = new Date();
          break;
      }
    }

    // Apply updates
    Object.assign(bag, updates);
    const updatedBag = await bag.save();

    res.status(200).json({
      success: true,
      message: 'Bag updated successfully',
      bag: updatedBag
    });
  } catch (error) {
    console.error('Error updating bag:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bag',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete a bag (soft delete)
 * @route   DELETE /api/bags/:id
 * @access  Private (Admin)
 */
exports.deleteBag = async (req, res) => {
  try {
    const { id } = req.params;

    // Find bag by ID or barcode
    let bag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bag = await Bag.findById(id);
    } else {
      bag = await Bag.findOne({
        $or: [{ bagId: id }, { barcode: id }]
      });
    }

    if (!bag) {
      return res.status(404).json({ success: false, message: 'Bag not found' });
    }

    // Check if bag is delivered - cannot delete delivered bags
    if (bag.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete delivered bags'
      });
    }

    // Hard delete the bag
    await Bag.findByIdAndDelete(bag._id);

    res.status(200).json({
      success: true,
      message: 'Bag deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('Error deleting bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get bag by barcode
 * @route   GET /api/bags/barcode/:barcode
 * @access  Private (Affiliate/Admin)
 */
exports.getBagByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    const bag = await Bag.findOne({ barcode })
      .populate('customer', 'customerId firstName lastName email')
      .populate('affiliate', 'affiliateId firstName lastName');

    if (!bag) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bag not found' 
      });
    }

    // Check authorization
    if (req.user.role === 'affiliate') {
      if (bag.affiliate._id.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only view bags from your customers' 
        });
      }
    }
    // Admins can view all bags

    res.status(200).json({
      success: true,
      bag: bag
    });
  } catch (error) {
    console.error('Error getting bag by barcode:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bag details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Report a bag as lost or damaged
 * @route   PATCH /api/bags/:id/report
 * @access  Private (Customer/Affiliate)
 */
exports.reportBag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { status, reportReason } = req.body;

    if (!status || !['lost', 'damaged'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "lost" or "damaged"'
      });
    }

    // Find bag
    let bag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bag = await Bag.findById(id);
    } else {
      bag = await Bag.findOne({
        $or: [{ bagId: id }, { barcode: id }]
      });
    }

    if (!bag) {
      return res.status(404).json({ success: false, message: 'Bag not found' });
    }

    // Update bag status
    bag.status = status;
    bag.reportReason = reportReason || `Bag reported as ${status}`;
    bag.reportedAt = Date.now();
    bag.updatedAt = Date.now();

    const updatedBag = await bag.save();

    // In a real implementation, we would also send notifications to the affiliate
    // and possibly trigger a workflow to issue a replacement bag

    res.status(200).json({
      success: true,
      message: `Bag successfully reported as ${status}`,
      data: updatedBag
    });
  } catch (error) {
    console.error('Error reporting bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Report a bag as lost
 * @route   POST /api/bags/:id/report-lost
 * @access  Private (Customer/Affiliate)
 */
exports.reportLostBag = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate required fields
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    // Find bag
    let bag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bag = await Bag.findById(id)
        .populate('customer', 'customerId firstName lastName email')
        .populate('affiliate', 'affiliateId firstName lastName');
    } else {
      bag = await Bag.findOne({
        $or: [{ bagId: id }, { barcode: id }]
      })
        .populate('customer', 'customerId firstName lastName email')
        .populate('affiliate', 'affiliateId firstName lastName');
    }

    if (!bag) {
      return res.status(404).json({ success: false, message: 'Bag not found' });
    }

    // Check if bag is already delivered - cannot report delivered bags as lost
    if (bag.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot report delivered bag as lost'
      });
    }

    // Check authorization
    if (req.user.role === 'customer') {
      const customer = await Customer.findById(req.user.id);
      if (!customer || bag.customer._id.toString() !== customer._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only report your own bags as lost'
        });
      }
    } else if (req.user.role === 'affiliate') {
      if (bag.affiliate._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only report bags from your customers as lost'
        });
      }
    }

    // Determine the model type for the reporter
    let reportedByModel;
    switch (req.user.role) {
      case 'customer':
        reportedByModel = 'Customer';
        break;
      case 'affiliate':
        reportedByModel = 'Affiliate';
        break;
      case 'administrator':
        reportedByModel = 'Administrator';
        break;
      default:
        reportedByModel = 'Customer';
    }

    // Update bag status to lost
    bag.status = 'lost';
    bag.lostDetails = {
      reportedAt: new Date(),
      reportedBy: req.user.id,
      reportedByModel: reportedByModel,
      reason: reason
    };
    bag.updatedAt = Date.now();

    const updatedBag = await bag.save();

    res.status(200).json({
      success: true,
      message: 'Bag successfully reported as lost',
      bag: updatedBag
    });
  } catch (error) {
    console.error('Error reporting lost bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Issue a replacement bag
 * @route   POST /api/bags/:id/replace
 * @access  Private (Admin/Affiliate)
 */
exports.replaceBag = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find the bag to be replaced
    let oldBag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      oldBag = await Bag.findById(id);
    } else {
      oldBag = await Bag.findOne({
        $or: [{ bagId: id }, { barcode: id }]
      });
    }

    if (!oldBag) {
      return res.status(404).json({ success: false, message: 'Bag not found' });
    }

    // Generate new barcode
    const barcode = 'WM-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Create new replacement bag
    const newBag = new Bag({
      bagId: 'BAG' + Math.floor(100000 + Math.random() * 900000),
      barcode,
      customerId: oldBag.customerId,
      affiliateId: oldBag.affiliateId,
      status: 'active',
      issueDate: new Date(),
      notes: `Replacement for ${oldBag.bagId}. Reason: ${reason || 'Replacement requested'}`
    });

    const savedBag = await newBag.save();

    // Update old bag as replaced
    oldBag.status = 'replaced';
    oldBag.replacementBagId = savedBag.bagId;
    oldBag.updatedAt = Date.now();
    await oldBag.save();

    // Update customer with the new bag reference
    await Customer.findOneAndUpdate(
      { customerId: oldBag.customerId },
      { $push: { bags: savedBag._id }, $set: { bagBarcode: barcode } }
    );

    res.status(201).json({
      success: true,
      message: 'Replacement bag issued successfully',
      data: {
        oldBag,
        newBag: savedBag
      }
    });
  } catch (error) {
    console.error('Error replacing bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get bag usage history
 * @route   GET /api/bags/:id/history
 * @access  Private (Admin/Affiliate/Customer)
 */
exports.getBagHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Find bag
    let bag;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bag = await Bag.findById(id);
    } else {
      bag = await Bag.findOne({
        $or: [{ bagId: id }, { barcode: id }]
      });
    }

    if (!bag) {
      return res.status(404).json({ success: false, message: 'Bag not found' });
    }

    // Get all orders that used this bag
    // Note: This would require an Order model which references bags
    // For this example, I'll assume a hypothetical Order model structure
    const Order = require('../models/Order');
    const orders = await Order.find({ bagId: bag.bagId })
      .sort({ createdAt: -1 })
      .select('orderId createdAt status actualWeight pickupDate deliveryDate');

    res.status(200).json({
      success: true,
      data: {
        bag,
        usageHistory: orders
      }
    });
  } catch (error) {
    console.error('Error getting bag history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Search bags by tag number
 * @route   GET /api/bags/search
 * @access  Private (Affiliate/Operator/Admin)
 */
exports.searchBags = async (req, res) => {
  try {
    const { tagNumber } = req.query;

    if (!tagNumber) {
      return res.status(400).json({
        success: false,
        message: 'Tag number is required'
      });
    }

    // Build search filter with role-based access control
    const filter = {
      tagNumber: { $regex: tagNumber, $options: 'i' }
    };

    // Apply role-based filtering
    if (req.user.role === 'affiliate') {
      // Affiliates can only see bags from their customers
      filter.affiliate = req.user.id;
    }
    // Operators and Admins can see all bags (no additional filter needed)

    // Search bags by tag number (partial match)
    const bags = await Bag.find(filter)
    .populate('customer', 'firstName lastName email customerId')
    .populate('affiliate', 'firstName lastName affiliateId')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      bags
    });
  } catch (error) {
    console.error('Error searching bags:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
