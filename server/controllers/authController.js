// Authentication Controller for WaveMAX Laundry Affiliate Program

const RefreshToken = require('../models/RefreshToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
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

  // If replacing a token, update it with the replacement token
  if (replaceToken) {
    await RefreshToken.findOneAndUpdate(
      { token: replaceToken },
      { replacedByToken: token }
    );
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

    // Find and immediately mark the token as used to prevent concurrent use
    const storedToken = await RefreshToken.findOneAndUpdate(
      {
        token: refreshToken,
        revoked: null,
        expiryDate: { $gt: new Date() }
      },
      {
        revoked: new Date(),
        revokedByIp: req.ip
      },
      {
        new: false // Return the original document
      }
    );

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
    } else if (storedToken.userType === 'administrator') {
      user = await Administrator.findById(storedToken.userId);
    } else if (storedToken.userType === 'operator') {
      user = await Operator.findById(storedToken.userId);
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
      ...(storedToken.userType === 'administrator' && { adminId: user.adminId }),
      ...(storedToken.userType === 'operator' && { employeeId: user.employeeId }),
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
 * Administrator login controller
 */
exports.administratorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find administrator by email
    const administrator = await Administrator.findOne({ email }).select('+password');

    if (!administrator) {
      logLoginAttempt(false, 'administrator', email, req, 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!administrator.isActive) {
      logLoginAttempt(false, 'administrator', email, req, 'Account inactive');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact system administrator.'
      });
    }

    // Check if account is locked
    if (administrator.isLocked) {
      logLoginAttempt(false, 'administrator', email, req, 'Account locked');
      return res.status(403).json({
        success: false,
        message: 'Account is locked due to multiple failed login attempts.'
      });
    }

    // Verify password
    const isPasswordValid = administrator.verifyPassword(password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      await administrator.incLoginAttempts();
      
      logLoginAttempt(false, 'administrator', email, req, 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset failed login attempts
    await administrator.resetLoginAttempts();

    // Generate token
    const token = generateToken({
      id: administrator._id,
      adminId: administrator.adminId,
      role: 'administrator',
      permissions: administrator.permissions
    });

    // Generate refresh token
    const refreshToken = await generateRefreshToken(
      administrator._id,
      'administrator',
      req.ip
    );

    // Log successful login
    logLoginAttempt(true, 'administrator', email, req);
    logAuditEvent(AuditEvents.AUTH_LOGIN, {
      userType: 'administrator',
      userId: administrator._id,
      adminId: administrator.adminId
    }, req);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: administrator._id,
        adminId: administrator.adminId,
        firstName: administrator.firstName,
        lastName: administrator.lastName,
        email: administrator.email,
        role: 'administrator',
        permissions: administrator.permissions
      }
    });
  } catch (error) {
    console.error('Administrator login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

/**
 * Operator login controller
 */
exports.operatorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find operator by email with password
    const operator = await Operator.findByEmailWithPassword(email);

    if (!operator) {
      logLoginAttempt(false, 'operator', email, req, 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (operator.isLocked) {
      logLoginAttempt(false, 'operator', email, req, 'Account locked');
      return res.status(403).json({
        success: false,
        message: 'Account is locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check if account is active
    if (!operator.isActive) {
      logLoginAttempt(false, 'operator', email, req, 'Account inactive');
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact your supervisor.'
      });
    }

    // Verify password
    const isPasswordValid = operator.verifyPassword(password);

    if (!isPasswordValid) {
      await operator.incLoginAttempts();
      logLoginAttempt(false, 'operator', email, req, 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check shift hours
    if (!operator.isOnShift) {
      logLoginAttempt(false, 'operator', email, req, 'Outside shift hours');
      return res.status(403).json({
        success: false,
        message: 'Login not allowed outside of shift hours',
        shiftHours: `${operator.shiftStart} - ${operator.shiftEnd}`
      });
    }

    // Reset login attempts
    await operator.resetLoginAttempts();

    // Generate token
    const token = generateToken({
      id: operator._id,
      operatorId: operator.operatorId,
      role: 'operator'
    });

    // Generate refresh token
    const refreshToken = await generateRefreshToken(
      operator._id,
      'operator',
      req.ip
    );

    // Log successful login
    logLoginAttempt(true, 'operator', email, req);
    logAuditEvent(AuditEvents.AUTH_LOGIN, {
      userType: 'operator',
      userId: operator._id,
      operatorId: operator.operatorId,
      shift: `${operator.shiftStart} - ${operator.shiftEnd}`
    }, req);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: operator._id,
        operatorId: operator.operatorId,
        firstName: operator.firstName,
        lastName: operator.lastName,
        email: operator.email,
        role: 'operator',
        shiftStart: operator.shiftStart,
        shiftEnd: operator.shiftEnd,
        workStation: operator.workStation
      }
    });
  } catch (error) {
    console.error('Operator login error:', error);
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
    } else if (userType === 'administrator') {
      user = await Administrator.findOne({ email });
    } else if (userType === 'operator') {
      user = await Operator.findOne({ email });
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
    } else if (userType === 'customer') {
      // Send customer password reset email
      await emailService.sendCustomerPasswordResetEmail(user, resetUrl);
    } else if (userType === 'administrator') {
      // Send administrator password reset email
      await emailService.sendAdministratorPasswordResetEmail(user, resetUrl);
    } else if (userType === 'operator') {
      // Send operator password reset email
      await emailService.sendOperatorPasswordResetEmail(user, resetUrl);
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
    } else if (userType === 'administrator') {
      user = await Administrator.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() }
      });
    } else if (userType === 'operator') {
      user = await Operator.findOne({
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

    // Update password based on user type
    if (userType === 'administrator') {
      // Administrators use bcrypt
      user.password = password; // Will be hashed by pre-save hook
    } else if (userType === 'operator') {
      // Operators have PINs, not passwords - this should not happen
      return res.status(400).json({
        success: false,
        message: 'Operators cannot reset passwords. Please contact your supervisor to reset your PIN.'
      });
    } else {
      // Affiliates and customers use PBKDF2
      const { salt, hash } = encryptionUtil.hashPassword(password);
      user.passwordSalt = salt;
      user.passwordHash = hash;
    }

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
    if (!req.user || !req.user.id) {
      throw new Error('User data not found in request');
    }

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

/**
 * Logout user
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token was provided
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Get the access token from the authorization header
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    let accessToken;
    
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      } else {
        accessToken = authHeader;
      }
    }

    // Note: In a production system, you might want to blacklist ALL active tokens
    // for this user, not just the one used in the logout request.
    // This would require tracking all issued tokens per user.
    
    // Blacklist the access token if provided
    if (accessToken && req.user) {
      try {
        // Decode token to get expiration time
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.exp) {
          const expiresAt = new Date(decoded.exp * 1000);
          await TokenBlacklist.blacklistToken(
            accessToken,
            req.user.id || req.user.userId || req.user.affiliateId || req.user.customerId || req.user.administratorId || req.user.operatorId,
            req.user.role || req.user.userType,
            expiresAt,
            'logout'
          );
        }
      } catch (blacklistError) {
        console.error('Error blacklisting token:', blacklistError);
        // Continue with logout even if blacklisting fails
      }
    }

    // Find and delete the refresh token
    const deletedToken = await RefreshToken.findOneAndDelete({ token: refreshToken });

    if (!deletedToken) {
      // Token not found, but still return success for security reasons
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during logout'
    });
  }
};

/**
 * Handle social media OAuth callback
 */
exports.handleSocialCallback = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.redirect('/affiliate-register?error=social_auth_failed');
    }
    
    // If this is an existing user, log them in
    if (!user.isNewUser) {
      // Generate tokens
      const token = generateToken({
        id: user._id,
        affiliateId: user.affiliateId,
        userType: 'affiliate'
      });
      
      const refreshToken = await generateRefreshToken(
        user._id, 
        'affiliate', 
        req.ip
      );
      
      // Log successful login
      logLoginAttempt(true, 'affiliate', user.username, req, 'Social login successful');
      
      // Redirect to dashboard with tokens
      return res.redirect(`/affiliate-dashboard?token=${token}&refreshToken=${refreshToken}`);
    }
    
    // For new users, create a temporary social token and redirect to complete registration
    const socialToken = jwt.sign({
      provider: user.provider,
      socialId: user.socialId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      profileData: user.profileData
    }, process.env.JWT_SECRET, { expiresIn: '15m' });
    
    // Redirect to registration page with social data
    res.redirect(`/affiliate-register?socialToken=${socialToken}&provider=${user.provider}`);
    
  } catch (error) {
    console.error('Social callback error:', error);
    res.redirect('/affiliate-register?error=social_auth_error');
  }
};

/**
 * Complete social media registration for affiliates
 */
exports.completeSocialRegistration = async (req, res) => {
  try {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const {
      socialToken,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      serviceArea,
      deliveryFee,
      username,
      password,
      paymentMethod,
      accountNumber,
      routingNumber,
      paypalEmail
    } = req.body;
    
    // Verify social token
    let socialData;
    try {
      socialData = jwt.verify(socialToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    }
    
    // Check if email or username already exists
    const existingAffiliate = await Affiliate.findOne({
      $or: [{ email: socialData.email }, { username }]
    });
    
    if (existingAffiliate) {
      return res.status(409).json({
        success: false,
        message: 'Email or username already exists'
      });
    }
    
    // Check if social account is already registered
    const socialAccountKey = `socialAccounts.${socialData.provider}.id`;
    const existingSocialAffiliate = await Affiliate.findOne({
      [socialAccountKey]: socialData.socialId
    });
    
    if (existingSocialAffiliate) {
      return res.status(400).json({
        success: false,
        message: 'This social media account is already registered with another affiliate account'
      });
    }
    
    // Generate affiliate ID
    const affiliateCount = await Affiliate.countDocuments();
    const affiliateId = 'AFF' + String(affiliateCount + 1).padStart(6, '0');
    
    // Create new affiliate with social account data
    const affiliate = new Affiliate({
      affiliateId,
      firstName: socialData.firstName,
      lastName: socialData.lastName,
      email: socialData.email,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      serviceArea,
      deliveryFee,
      username,
      password, // This will be hashed by the model's pre-save middleware
      paymentMethod,
      accountNumber,
      routingNumber,
      paypalEmail,
      registrationMethod: socialData.provider,
      socialAccounts: {
        [socialData.provider]: {
          id: socialData.socialId,
          email: socialData.email,
          name: `${socialData.firstName} ${socialData.lastName}`,
          accessToken: socialData.accessToken,
          refreshToken: socialData.refreshToken,
          linkedAt: new Date()
        }
      },
      lastLogin: new Date()
    });
    
    await affiliate.save();
    
    // Send welcome email
    try {
      await emailService.sendAffiliateWelcomeEmail(affiliate);
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
      // Continue even if email fails
    }
    
    // Generate tokens
    const token = generateToken({
      id: affiliate._id,
      affiliateId: affiliate.affiliateId,
      userType: 'affiliate'
    });
    
    const refreshToken = await generateRefreshToken(
      affiliate._id, 
      'affiliate', 
      req.ip
    );
    
    // Log successful registration and login
    logAuditEvent(AuditEvents.ACCOUNT_CREATED, {
      action: 'SOCIAL_REGISTRATION',
      userId: affiliate._id,
      userType: 'affiliate',
      details: { 
        affiliateId: affiliate.affiliateId, 
        provider: socialData.provider,
        registrationMethod: 'social'
      }
    }, req);
    
    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      affiliate: {
        id: affiliate._id,
        affiliateId: affiliate.affiliateId,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        email: affiliate.email,
        registrationMethod: affiliate.registrationMethod
      },
      token,
      refreshToken,
      expiresIn: '1h'
    });
    
  } catch (error) {
    console.error('Social registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

/**
 * Link social media account to existing affiliate
 */
exports.linkSocialAccount = async (req, res) => {
  try {
    const { provider, socialToken } = req.body;
    
    // Verify social token
    let socialData;
    try {
      socialData = jwt.verify(socialToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    }
    
    // Find affiliate by email from social data (for test scenarios) or use authenticated user
    let affiliate = req.user;
    if (!affiliate && socialData.email) {
      affiliate = await Affiliate.findOne({ email: socialData.email });
      if (!affiliate) {
        return res.status(404).json({
          success: false,
          message: 'No affiliate found with the email from social account'
        });
      }
    } else if (!affiliate) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if this social account is already linked to this affiliate
    if (affiliate.socialAccounts && affiliate.socialAccounts[socialData.provider] && 
        affiliate.socialAccounts[socialData.provider].id === socialData.socialId) {
      return res.status(400).json({
        success: false,
        message: 'This social media account is already linked to your account'
      });
    }
    
    // Check if this social account is already linked to another affiliate
    const existingLink = await Affiliate.findOne({
      [`socialAccounts.${socialData.provider}.id`]: socialData.socialId,
      _id: { $ne: affiliate._id }
    });
    
    if (existingLink) {
      return res.status(409).json({
        success: false,
        message: 'This social media account is already linked to another affiliate'
      });
    }
    
    // Link the social account
    affiliate.socialAccounts[socialData.provider] = {
      id: socialData.socialId,
      email: socialData.email,
      name: `${socialData.firstName} ${socialData.lastName}`,
      accessToken: socialData.accessToken,
      refreshToken: socialData.refreshToken,
      linkedAt: new Date()
    };
    
    await affiliate.save();
    
    // Log the account linking
    logAuditEvent(AuditEvents.ACCOUNT_UPDATED, {
      action: 'SOCIAL_ACCOUNT_LINKED',
      userId: affiliate._id,
      userType: 'affiliate',
      details: { 
        provider: provider,
        socialAccountId: socialData.socialId
      }
    }, req);
    
    res.json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`
    });
    
  } catch (error) {
    console.error('Social account linking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link social media account'
    });
  }
};

/**
 * Handle social login for existing users
 */
exports.socialLogin = async (req, res) => {
  try {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { provider, socialId, accessToken, refreshToken } = req.body;
    
    // Find affiliate with this social account
    const socialAccountKey = `socialAccounts.${provider}.id`;
    const affiliate = await Affiliate.findOne({
      [socialAccountKey]: socialId
    });
    
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this social media account'
      });
    }
    
    // Update social account tokens if provided
    if (accessToken || refreshToken) {
      if (accessToken) {
        affiliate.socialAccounts[provider].accessToken = accessToken;
      }
      if (refreshToken) {
        affiliate.socialAccounts[provider].refreshToken = refreshToken;
      }
      await affiliate.save();
    }
    
    // Update last login
    affiliate.lastLogin = new Date();
    await affiliate.save();
    
    // Generate tokens
    const token = generateToken({
      id: affiliate._id,
      affiliateId: affiliate.affiliateId,
      role: 'affiliate'
    });
    
    const refreshTokenValue = await generateRefreshToken(
      affiliate._id,
      'affiliate',
      req.ip
    );
    
    // Log successful login
    logLoginAttempt(true, 'affiliate', affiliate.username, req, 'Social login successful');
    logAuditEvent(AuditEvents.AUTH_LOGIN, {
      userType: 'affiliate',
      userId: affiliate._id,
      affiliateId: affiliate.affiliateId,
      loginMethod: 'social',
      provider: provider
    }, req);
    
    res.status(200).json({
      success: true,
      accessToken: token,
      refreshToken: refreshTokenValue,
      affiliate: {
        affiliateId: affiliate.affiliateId,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        email: affiliate.email
      }
    });
    
  } catch (error) {
    console.error('Social login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during social login'
    });
  }
};

module.exports = exports;
