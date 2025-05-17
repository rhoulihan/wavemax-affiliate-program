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
 * @access  Private (Admin/Affiliate)
 */
exports.createBag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { customerId, affiliateId } = req.body;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found' });
    }

    // Generate unique barcode
    const barcode = 'WM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Create new bag
    const newBag = new Bag({
      bagId: 'BAG' + Math.floor(100000 + Math.random() * 900000),
      barcode,
      customerId,
      affiliateId,
      status: 'active',
      issueDate: new Date()
    });

    const savedBag = await newBag.save();

    // Update customer with the bag reference
    await Customer.findOneAndUpdate(
      { customerId },
      { $push: { bags: savedBag._id }, $set: { bagBarcode: barcode } }
    );

    res.status(201).json({
      success: true,
      data: savedBag
    });
  } catch (error) {
    console.error('Error creating bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all bags with filtering options
 * @route   GET /api/bags
 * @access  Private (Admin/Affiliate)
 */
exports.getAllBags = async (req, res) => {
  try {
    const { customerId, affiliateId, status } = req.query;
    const filter = {};

    // Apply filters if provided
    if (customerId) filter.customerId = customerId;
    if (affiliateId) filter.affiliateId = affiliateId;
    if (status) filter.status = status;

    // Handle pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const bags = await Bag.find(filter)
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Bag.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: bags.length,
      total,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: page
      },
      data: bags
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
      bag = await Bag.findById(id);
    } else {
      // Try to find by bagId or barcode
      bag = await Bag.findOne({
        $or: [{ bagId: id }, { barcode: id }]
      });
    }

    if (!bag) {
      return res.status(404).json({ success: false, message: 'Bag not found' });
    }

    res.status(200).json({
      success: true,
      data: bag
    });
  } catch (error) {
    console.error('Error getting bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update a bag
 * @route   PUT /api/bags/:id
 * @access  Private (Admin/Affiliate)
 */
exports.updateBag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { status, lastUsed, notes } = req.body;

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

    // Update fields if provided
    if (status) bag.status = status;
    if (lastUsed) bag.lastUsed = lastUsed;
    if (notes) bag.notes = notes;

    // Update the "updatedAt" field
    bag.updatedAt = Date.now();

    const updatedBag = await bag.save();

    // If status was updated to 'lost' or 'damaged', notify affiliate (would be implemented in a real app)
    if (status && (status === 'lost' || status === 'damaged')) {
      // Notification logic would go here
      console.log(`Bag ${bag.bagId} marked as ${status}`);
    }

    res.status(200).json({
      success: true,
      data: updatedBag
    });
  } catch (error) {
    console.error('Error updating bag:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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

    // Soft delete - mark as inactive rather than removing
    bag.status = 'inactive';
    bag.updatedAt = Date.now();
    await bag.save();

    // Alternative: Hard delete if required
    // await Bag.findByIdAndDelete(bag._id);

    res.status(200).json({
      success: true,
      message: 'Bag successfully deactivated',
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
