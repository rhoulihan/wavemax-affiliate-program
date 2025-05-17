// Authentication Controller for WaveMAX Laundry Affiliate Program

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const encryptionUtil = require('../utils/encryption');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

/**
 * Generate JWT token
 */
const generateToken = (data, expiresIn = '7d') => {
  return jwt.sign(
    data,
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Affiliate login controller
 */
exports.affiliateLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find affiliate by username
    const affiliate = await Affiliate.findOne({ username });
    
    if (!affiliate) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Verify password
    const isPasswordValid = encryptionUtil.verifyPassword(
      password,
      affiliate.passwordSalt,
      affiliate.passwordHash
    );
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Update last login
    affiliate.lastLogin = new Date();
    await affiliate.save();
    
    // Generate token
    const token = generateToken({
      id: affiliate._id,
      affiliateId: affiliate.affiliateId,
      role: 'affiliate'
    });
    
    res.status(200).json({
      success: true,
      token,
      affiliate: {
        affiliateId: affiliate.affiliateId,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        email: affiliate.email
      }
    });
  } catch (error) {
    console.error('Affiliate login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

/**
 * Customer login controller
 */
exports.customerLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find customer by username
    const customer = await Customer.findOne({ username });
    
    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Verify password
    const isPasswordValid = encryptionUtil.verifyPassword(
      password,
      customer.passwordSalt,
      customer.passwordHash
    );
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Update last login
    customer.lastLogin = new Date();
    await customer.save();
    
    // Find affiliate
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    
    // Generate token
    const token = generateToken({
      id: customer._id,
      customerId: customer.customerId,
      affiliateId: customer.affiliateId,
      role: 'customer'
    });
    
    res.status(200).json({
      success: true,
      token,
      customer: {
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        affiliate: affiliate ? {
          affiliateId: affiliate.affiliateId,
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          deliveryFee: affiliate.deliveryFee
        } : null
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

/**
 * Request password reset
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email, userType } = req.body;
    
    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Email and user type are required'
      });
    }
    
    // Find user based on user type
    let user;
    if (userType === 'affiliate') {
      user = await Affiliate.findOne({ email });
    } else if (userType === 'customer') {
      user = await Customer.findOne({ email });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    // Store token and expiry (in a real implementation, these would be fields on the user models)
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();
    
    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&type=${userType}`;
    
    // Use the emailService to send the reset email
    if (userType === 'affiliate') {
      // Send affiliate password reset email
      await emailService.sendAffiliatePasswordResetEmail(user, resetUrl);
    } else {
      // Send customer password reset email
      await emailService.sendCustomerPasswordResetEmail(user, resetUrl);
    }
    
    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request'
    });
  }
};

/**
 * Reset password with token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, userType, password } = req.body;
    
    if (!token || !userType || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token, user type, and new password are required'
      });
    }
    
    // Find user based on reset token
    let user;
    if (userType === 'affiliate') {
      user = await Affiliate.findOne({ 
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }
      });
    } else if (userType === 'customer') {
      user = await Customer.findOne({ 
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Hash new password
    const { salt, hash } = encryptionUtil.hashPassword(password);
    
    // Update password
    user.passwordSalt = salt;
    user.passwordHash = hash;
    
    // Clear reset token fields
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password'
    });
  }
};

/**
 * Verify JWT token
 */
exports.verifyToken = async (req, res) => {
  try {
    // The auth middleware has already validated the token
    // and added the user data to req.user
    
    // Return user data from token
    res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        role: req.user.role,
        ...(req.user.affiliateId && { affiliateId: req.user.affiliateId }),
        ...(req.user.customerId && { customerId: req.user.customerId })
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during token verification'
    });
  }
};

module.exports = exports;