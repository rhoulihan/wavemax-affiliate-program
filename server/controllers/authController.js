// Authentication Controller for WaveMAX Laundry Affiliate Program

const RefreshToken = require('../models/RefreshToken');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const encryptionUtil = require('../utils/encryption');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const { logLoginAttempt, logAuditEvent, AuditEvents } = require('../utils/auditLogger');

/**
 * Generate JWT token
 */
const generateToken = (data, expiresIn = '1h') => {
  return jwt.sign(
    data,
    process.env.JWT_SECRET,
    {
      expiresIn,
      issuer: 'wavemax-api',
      audience: 'wavemax-client'
    }
  );
};

const generateRefreshToken = async (userId, userType, ip, replaceToken = null) => {
  // Create a refresh token that expires in 30 days
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  // Generate a secure random token
  const token = crypto.randomBytes(40).toString('hex');

  // If replacing a token, mark the old one as revoked
  if (replaceToken) {
    const oldToken = await RefreshToken.findOne({ token: replaceToken });
    if (oldToken && !oldToken.revoked) {
      oldToken.revoked = new Date();
      oldToken.revokedByIp = ip;
      oldToken.replacedByToken = token;
      await oldToken.save();
    }
  }

  // Save new token to database
  const refreshToken = new RefreshToken({
    token,
    userId,
    userType,
    expiryDate,
    createdByIp: ip
  });

  await refreshToken.save();

  return token;
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
      logLoginAttempt(false, 'affiliate', username, req, 'User not found');
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
      logLoginAttempt(false, 'affiliate', username, req, 'Invalid password');
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

    // Generate refresh token
    const refreshToken = await generateRefreshToken(
      affiliate._id,
      'affiliate',
      req.ip
    );

    // Log successful login
    logLoginAttempt(true, 'affiliate', username, req);

    res.status(200).json({
      success: true,
      token, // Access token
      refreshToken,
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

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Find the token in the database
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      revoked: null,
      expiryDate: { $gt: new Date() }
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find the user based on the token
    let user;
    if (storedToken.userType === 'affiliate') {
      user = await Affiliate.findById(storedToken.userId);
    } else if (storedToken.userType === 'customer') {
      user = await Customer.findById(storedToken.userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new access token
    const accessToken = generateToken({
      id: user._id,
      ...(storedToken.userType === 'affiliate' && { affiliateId: user.affiliateId }),
      ...(storedToken.userType === 'customer' && { customerId: user.customerId }),
      role: storedToken.userType
    });

    // Generate new refresh token with proper token rotation
    const newRefreshToken = await generateRefreshToken(
      user._id,
      storedToken.userType,
      req.ip,
      refreshToken // Pass the old token for proper rotation
    );

    res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during token refresh'
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
      logLoginAttempt(false, 'affiliate', username, req, 'Invalid password');
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
    console.log('Customer affiliateId:', customer.affiliateId);
    console.log('Found affiliate:', affiliate ? affiliate.affiliateId : 'null');
    console.log('Affiliate delivery fee:', affiliate ? affiliate.deliveryFee : 'null');

    // Generate token
    const token = generateToken({
      id: customer._id,
      customerId: customer.customerId,
      affiliateId: customer.affiliateId,
      role: 'customer'
    });

    const responseData = {
      success: true,
      token,
      customer: {
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        affiliateId: customer.affiliateId,
        affiliate: affiliate ? {
          affiliateId: affiliate.affiliateId,
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          deliveryFee: affiliate.deliveryFee
        } : null
      }
    };
    
    console.log('Sending customer login response:', JSON.stringify(responseData.customer, null, 2));
    res.status(200).json(responseData);
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
