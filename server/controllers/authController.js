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
const logger = require('../utils/logger');
const { logLoginAttempt, logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const { sanitizeInput } = require('../middleware/sanitization');

const identityAvailabilityService = require('../services/identityAvailabilityService');
const passwordResetService = require('../services/passwordResetService');
const authTokenService = require('../services/authTokenService');

// Wrapper for crypto.randomBytes to allow mocking in tests
// This allows us to mock just this function without affecting the entire crypto module
const cryptoWrapper = {
  randomBytes: (size) => crypto.randomBytes(size)
};

/**
 * Escape special regex characters to prevent ReDoS attacks
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// JWT + refresh-token helpers live in authTokenService; these thin wrappers
// preserve the original in-module signatures so the login flows below don't
// have to change.
const generateToken = authTokenService.generateToken;
const generateRefreshToken = (userId, userType, ip, replaceToken = null) =>
  authTokenService.generateRefreshToken({ userId, userType, ip, replaceToken, cryptoWrapper });

/**
 * Affiliate login controller
 */
exports.affiliateLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find affiliate by username (case-insensitive)
    const affiliate = await Affiliate.findOne({
      username: { $regex: new RegExp('^' + escapeRegex(username) + '$', 'i') }
    });

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
        email: affiliate.email,
        registrationMethod: affiliate.registrationMethod
      }
    });
  } catch (error) {
    logger.error('Affiliate login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const tokens = await authTokenService.refreshAccessToken({
      refreshToken: req.body.refreshToken,
      ip: req.ip,
      cryptoWrapper
    });
    res.status(200).json({ success: true, ...tokens });
  } catch (err) {
    if (err.isAuthTokenError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Refresh token error:', err);
    res.status(500).json({ success: false, message: 'An error occurred during token refresh' });
  }
};

/**
 * Administrator login controller
 */
exports.administratorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find administrator by email
    const administrator = await Administrator.findOne({ email });

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

    // Check if password change is required
    if (administrator.requirePasswordChange) {
      // Generate a limited token that only allows password change
      const token = generateToken({
        id: administrator._id,
        adminId: administrator.adminId,
        role: 'administrator',
        permissions: ['change_password_required'],
        requirePasswordChange: true
      });

      // Don't generate refresh token for password change required
      return res.status(200).json({
        success: true,
        token,
        requirePasswordChange: true,
        message: 'Password change required for first login',
        user: {
          id: administrator._id,
          adminId: administrator.adminId,
          email: administrator.email,
          requirePasswordChange: true
        }
      });
    }

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
    logger.error('Administrator login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

/**
 * Operator login controller
 */
/**
 * Operator auto-login from store IP
 */
exports.operatorAutoLogin = async (req, res) => {
  try {
    // Get client IP address - handle proxy headers
    let clientIp;
    const forwardedFor = req.headers['x-forwarded-for'];
    
    if (forwardedFor) {
      // Take the first IP if there are multiple (client, proxy1, proxy2, ...)
      clientIp = forwardedFor.split(',')[0].trim();
    } else {
      clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    }
    
    const cleanIp = clientIp.replace(/^::ffff:/, ''); // Remove IPv6 prefix if present
    
    logger.info('Auto-login attempt from IP:', cleanIp);
    
    // Check if request is from store IP using storeIPs configuration
    const storeIPs = require('../config/storeIPs');
    logger.info('Whitelisted IPs:', storeIPs.whitelistedIPs);
    logger.info('Whitelisted Ranges:', storeIPs.whitelistedRanges);
    
    if (!storeIPs.isWhitelisted(cleanIp)) {
      logger.info('Auto-login denied - IP not whitelisted:', cleanIp);
      return res.status(403).json({
        success: false,
        message: 'Auto-login not allowed from this location'
      });
    }
    
    // Find default operator
    const defaultOperatorId = process.env.DEFAULT_OPERATOR_ID || 'OP001';
    const operator = await Operator.findOne({ operatorId: defaultOperatorId });
    
    if (!operator) {
      logger.error('Default operator not found:', defaultOperatorId);
      return res.status(404).json({
        success: false,
        message: 'Default operator not configured'
      });
    }
    
    // Check if operator is active
    if (!operator.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Default operator account is inactive'
      });
    }
    
    // Reset login attempts
    await operator.resetLoginAttempts();
    
    // Generate token
    const token = generateToken({
      id: operator._id,
      operatorId: operator.operatorId,
      email: operator.email,
      name: operator.name,
      permissions: operator.permissions,
      role: 'operator'
    });
    
    // Generate refresh token
    const refreshToken = await generateRefreshToken(
      operator._id,
      'operator',
      cleanIp
    );
    
    // Update last login
    operator.lastLogin = new Date();
    await operator.save();
    
    // Log successful auto-login
    logLoginAttempt(true, 'operator', operator.email, req, 'Auto-login from store IP');
    
    // Prepare response with redirect to scan-a-bag
    res.json({
      success: true,
      message: 'Auto-login successful',
      token,
      refreshToken: refreshToken.token,
      operator: {
        id: operator._id,
        operatorId: operator.operatorId,
        email: operator.email,
        name: operator.name,
        permissions: operator.permissions
      },
      redirect: '/operator-scan' // Direct to operator scan page
    });
    
  } catch (error) {
    logger.error('Operator auto-login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during auto-login'
    });
  }
};

exports.operatorLogin = async (req, res) => {
  try {
    const { pinCode } = req.body;

    // Validate PIN code is provided
    if (!pinCode) {
      return res.status(400).json({
        success: false,
        message: 'PIN code is required'
      });
    }

    // Check if PIN matches the configured operator PIN
    const configuredPin = process.env.OPERATOR_PIN;
    if (!configuredPin) {
      logger.error('OPERATOR_PIN not configured in environment');
      return res.status(500).json({
        success: false,
        message: 'System configuration error'
      });
    }

    // Verify PIN code
    if (pinCode !== configuredPin) {
      logLoginAttempt(false, 'operator', 'PIN', req, 'Invalid PIN');
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN code'
      });
    }

    // Find default operator for PIN-based login
    const defaultOperatorId = process.env.DEFAULT_OPERATOR_ID || 'OP001';
    const operator = await Operator.findOne({ operatorId: defaultOperatorId });

    if (!operator) {
      logger.error('Default operator not found:', defaultOperatorId);
      return res.status(404).json({
        success: false,
        message: 'Default operator not configured'
      });
    }

    // Check if account is active
    if (!operator.isActive) {
      logLoginAttempt(false, 'operator', defaultOperatorId, req, 'Account inactive');
      return res.status(403).json({
        success: false,
        message: 'Operator account is inactive. Please contact your supervisor.'
      });
    }

    // Check shift hours
    if (!operator.isOnShift) {
      logLoginAttempt(false, 'operator', defaultOperatorId, req, 'Outside shift hours');
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
    logLoginAttempt(true, 'operator', operator.operatorId, req);
    logAuditEvent(AuditEvents.AUTH_LOGIN, {
      userType: 'operator',
      userId: operator._id,
      operatorId: operator.operatorId,
      shift: `${operator.shiftStart} - ${operator.shiftEnd}`,
      loginMethod: 'PIN'
    }, req);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      operator: {
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
    logger.error('Operator login error:', error);
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
    const { username, emailOrUsername, password } = req.body;

    // Support both the old 'username' field and new 'emailOrUsername' field
    const loginIdentifier = emailOrUsername || username;

    if (!loginIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Username or email is required'
      });
    }

    // Find customer by username or email (case-insensitive)
    const customer = await Customer.findOne({
      $or: [
        { username: { $regex: new RegExp('^' + escapeRegex(loginIdentifier) + '$', 'i') } },
        { email: loginIdentifier.toLowerCase() }
      ]
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      });
    }

    // Verify password
    const isPasswordValid = encryptionUtil.verifyPassword(
      password,
      customer.passwordSalt,
      customer.passwordHash
    );

    if (!isPasswordValid) {
      logLoginAttempt(false, 'customer', loginIdentifier, req, 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      });
    }

    // Update last login
    customer.lastLogin = new Date();
    await customer.save();

    // Find affiliate
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    logger.info('Customer affiliateId:', customer.affiliateId);
    logger.info('Found affiliate:', affiliate ? affiliate.affiliateId : 'null');
    logger.info('Affiliate fees:', affiliate ? `min: ${affiliate.minimumDeliveryFee}, per-bag: ${affiliate.perBagDeliveryFee}` : 'null');

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
        numberOfBags: customer.numberOfBags || 1,
        wdfCredit: customer.wdfCredit || 0,
        affiliate: affiliate ? {
          affiliateId: affiliate.affiliateId,
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          minimumDeliveryFee: affiliate.minimumDeliveryFee,
          perBagDeliveryFee: affiliate.perBagDeliveryFee
        } : null
      }
    };

    logger.info('Sending customer login response:', JSON.stringify(responseData.customer, null, 2));
    res.status(200).json(responseData);
  } catch (error) {
    logger.error('Customer login error:', error);
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
    await passwordResetService.forgotPassword({
      email: req.body.email,
      userType: req.body.userType,
      cryptoWrapper
    });
    res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch (err) {
    if (err.isPasswordResetError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Forgot password error:', err);
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
    await passwordResetService.resetPassword({
      token: req.body.token,
      userType: req.body.userType,
      password: req.body.password
    });
    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    if (err.isPasswordResetError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Reset password error:', err);
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
    const payload = authTokenService.describeVerifiedUser(req.user);
    res.status(200).json({ success: true, ...payload });
  } catch (err) {
    if (err.isAuthTokenError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Token verification error:', err);
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
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    let accessToken;
    if (authHeader) {
      accessToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    }

    await authTokenService.logout({
      refreshToken: req.body.refreshToken,
      accessToken,
      user: req.user
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'An error occurred during logout' });
  }
};

/**
 * Handle social media OAuth callback
 */
exports.handleSocialCallback = async (req, res) => {
  logger.info('[OAuth] handleSocialCallback called with:', {
    user: req.user ? 'exists' : 'null',
    query: req.query,
    headers: req.headers,
    state: req.query.state,
    stateStartsWithCustomer: req.query.state && req.query.state.startsWith('customer')
  });
  try {
    const user = req.user;

    // Check if this is a customer OAuth request (state starts with 'customer_')
    const isCustomerRequest = req.query.state && req.query.state.startsWith('customer');

    logger.info('[OAuth] Customer request check:', { 
      state: req.query.state, 
      isCustomerRequest,
      willDelegate: isCustomerRequest 
    });

    if (isCustomerRequest) {
      // This is a customer OAuth request, delegate to customer handler
      logger.info('[OAuth] Delegating to handleCustomerSocialCallback');
      return exports.handleCustomerSocialCallback(req, res);
    }

    // Extract sessionId from state parameter for database storage
    // State parameter now contains just the sessionId (or null for non-popup requests)
    const sessionId = req.query.state && req.query.state.startsWith('oauth_')
      ? req.query.state
      : null;

    logger.info('OAuth Callback State Parameter Debug:', {
      state: req.query.state,
      sessionId: sessionId,
      allParams: req.query
    });

    if (!user) {
      // Check if this is a popup request (for embedded contexts)
      const isPopup = req.query.popup === 'true' ||
                     sessionId !== null ||  // If we have a sessionId, it's a popup request
                     req.headers.referer?.includes('accounts.google.com') ||
                     req.headers.referer?.includes('facebook.com') ||
                     req.headers.referer?.includes('linkedin.com');

      if (isPopup) {
        const message = {
          type: 'social-auth-error',
          message: 'Social authentication failed'
        };

        // Store in database if sessionId is provided
        if (sessionId) {
          try {
            const OAuthSession = require('../models/OAuthSession');
            await OAuthSession.createSession(sessionId, message);
          } catch (dbError) {
            logger.error('Error storing OAuth session:', dbError);
          }
        }

        // Redirect to OAuth success page with message as parameter
        const messageParam = encodeURIComponent(JSON.stringify(message));
        return res.redirect(`/oauth-success.html?message=${messageParam}`);
      }

      return res.redirect('/affiliate-register-embed.html?error=social_auth_failed');
    }

    // Check if this is a popup request (for embedded contexts)
    const isPopup = req.query.popup === 'true' ||
                   sessionId !== null ||  // If we have a sessionId, it's a popup request
                   req.headers.referer?.includes('accounts.google.com') ||
                   req.headers.referer?.includes('facebook.com') ||
                   req.headers.referer?.includes('linkedin.com');

    logger.info('OAuth Callback Debug:', {
      popup: req.query.popup,
      state: req.query.state,
      referer: req.headers.referer,
      isPopup,
      userIsNew: user?.isNewUser
    });

    // If this is an existing user, log them in
    if (!user.isNewUser) {
      // Generate tokens
      const token = generateToken({
        id: user._id,
        affiliateId: user.affiliateId,
        role: 'affiliate'
      });

      const refreshToken = await generateRefreshToken(
        user._id,
        'affiliate',
        req.ip
      );

      // Log successful login
      logLoginAttempt(true, 'affiliate', user.username, req, 'Social login successful');

      if (isPopup) {
        const message = {
          type: 'social-auth-login',
          token: token,
          refreshToken: refreshToken,
          affiliate: {
            affiliateId: user.affiliateId,
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            businessName: user.businessName,
            registrationMethod: user.registrationMethod
          }
        };

        // Store in database if sessionId is provided
        if (sessionId) {
          try {
            const OAuthSession = require('../models/OAuthSession');
            await OAuthSession.createSession(sessionId, message);
          } catch (dbError) {
            logger.error('Error storing OAuth session:', dbError);
          }
        }

        // Redirect to OAuth success page with message as parameter
        const messageParam = encodeURIComponent(JSON.stringify(message));
        return res.redirect(`/oauth-success.html?message=${messageParam}`);
      }

      // Redirect to dashboard with tokens
      return res.redirect(`/affiliate-dashboard-embed.html?token=${token}&refreshToken=${refreshToken}`);
    }

    // Handle case where social account already exists as a customer
    if (user.isExistingCustomer) {
      const message = {
        type: 'social-auth-account-conflict',
        message: 'This social media account is already associated with a customer account. Would you like to login as a customer instead?',
        provider: user.provider,
        accountType: 'customer',
        customerData: {
          firstName: user.customer.firstName,
          lastName: user.customer.lastName,
          email: user.customer.email
        }
      };

      if (isPopup) {
        // Store in database if sessionId is provided
        if (sessionId) {
          try {
            const OAuthSession = require('../models/OAuthSession');
            await OAuthSession.createSession(sessionId, message);
          } catch (dbError) {
            logger.error('Error storing OAuth session:', dbError);
          }
        }

        // Redirect to OAuth success page with message as parameter
        const messageParam = encodeURIComponent(JSON.stringify(message));
        return res.redirect(`/oauth-success.html?message=${messageParam}`);
      }

      return res.redirect('/affiliate-register-embed.html?error=account_exists_as_customer');
    }

    // For new users, create a temporary social token and redirect to complete registration
    const socialToken = jwt.sign({
      provider: user.provider,
      socialId: user.socialId,
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      displayName: user.displayName || '',
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      profileData: user.profileData
    }, process.env.JWT_SECRET, { expiresIn: '15m' });

    if (isPopup) {
      const message = {
        type: 'social-auth-success',
        socialToken: socialToken,
        provider: user.provider
      };

      // Store in database if sessionId is provided
      if (sessionId) {
        try {
          const OAuthSession = require('../models/OAuthSession');
          await OAuthSession.createSession(sessionId, message);
        } catch (dbError) {
          logger.error('Error storing OAuth session:', dbError);
        }
      }

      // Redirect to OAuth success page with message as parameter (consistent with other cases)
      const messageParam = encodeURIComponent(JSON.stringify(message));
      return res.redirect(`/oauth-success.html?message=${messageParam}`);

      // OLD CODE - replaced with redirect above for consistency
      /*return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Complete</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f0f0f0;
            }
            .message {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .success {
              color: #22c55e;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="message">
            <div class="success">✓</div>
            <h2>Authentication Successful!</h2>
            <p>This window should close automatically.<br>If not, you can close it manually.</p>
            <p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
              <button onclick="window.close()" style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close Window
              </button>
            </p>
          </div>
          <script>
            logger.info('Popup script executing for social-auth-success');
            try {
              // Try multiple approaches to communicate with parent
              const message = ${JSON.stringify(message)};
              
              logger.info('Attempting to send message:', message);
              logger.info('window.opener:', window.opener);
              logger.info('window.parent:', window.parent);
              
              if (window.opener && !window.opener.closed) {
                logger.info('Using window.opener.postMessage');
                window.opener.postMessage(message, '*');
              } else if (window.parent && window.parent !== window) {
                logger.info('Using window.parent.postMessage');
                window.parent.postMessage(message, '*');
              } else {
                logger.info('Using localStorage fallback');
                // Store in localStorage as fallback
                localStorage.setItem('socialAuthResult', JSON.stringify(message));
                logger.info('Stored in localStorage:', localStorage.getItem('socialAuthResult'));
              }
              
              // Try multiple methods to close the window
              logger.info('Attempting to close window...');
              
              // Method 1: Direct close
              window.close();
              
              // Method 2: Blur and close
              window.blur();
              window.close();
              
              // Method 3: Clear opener and close
              if (window.opener) {
                window.opener = null;
                window.close();
              }
              
              // Method 4: Self-navigation and close
              window.open('', '_self', '');
              window.close();
              
              // Method 5: Force close with about:blank
              window.open('about:blank', '_self');
              window.close();
              
              // Method 6: Multiple timeout attempts
              setTimeout(() => {
                logger.info('First timeout close attempt');
                window.close();
              }, 100);
              
              setTimeout(() => {
                logger.info('Second timeout close attempt');
                window.opener = null;
                window.close();
              }, 300);
              
              setTimeout(() => {
                logger.info('Final timeout close attempt');
                window.open('', '_self').close();
              }, 500);
              
            } catch (e) {
              logger.error('Error in popup communication:', e);
              window.close();
            }
          </script>
        </body>
        </html>
      `);*/
    }

    // Redirect to registration page with social data
    res.redirect(`/affiliate-register-embed.html?socialToken=${socialToken}&provider=${user.provider}`);

  } catch (error) {
    logger.error('Social callback error:', error);

    // Check if this is a popup request
    const isPopup = req.query.popup === 'true' ||
                   req.query.state === 'popup=true' ||
                   req.headers.referer?.includes('accounts.google.com') ||
                   req.headers.referer?.includes('facebook.com') ||
                   req.headers.referer?.includes('linkedin.com');

    if (isPopup) {
      return res.send(`
        <script>
          try {
            // Try multiple approaches to communicate with parent
            const message = {
              type: 'social-auth-error',
              message: 'An error occurred during social authentication'
            };
            
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(message, '*');
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(message, '*');
            } else {
              // Store in localStorage as fallback
              localStorage.setItem('socialAuthResult', JSON.stringify(message));
            }
            
            // Try multiple methods to close the window
            window.close();
            window.blur();
            window.close();
            if (window.opener) {
              window.opener = null;
              window.close();
            }
            window.open('', '_self', '');
            window.close();
            setTimeout(() => window.close(), 100);
            setTimeout(() => {
              window.opener = null;
              window.close();
            }, 300);
            setTimeout(() => {
              window.open('', '_self').close();
            }, 500);
          } catch (e) {
            logger.error('Error in popup communication:', e);
            window.close();
          }
        </script>
      `);
    }

    res.redirect('/affiliate-register-embed.html?error=social_auth_error');
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
      serviceLatitude,
      serviceLongitude,
      serviceRadius,
      minimumDeliveryFee,
      perBagDeliveryFee,
      username,
      password,
      paymentMethod,
      accountNumber,
      routingNumber,
      paypalEmail,
      languagePreference
    } = req.body;

    // Verify social token
    let socialData;
    try {
      socialData = jwt.verify(socialToken, process.env.JWT_SECRET);
      // Sanitize social data to prevent XSS attacks
      socialData = sanitizeInput(socialData);

      // Validate that required fields are not empty after sanitization
      if (!socialData.firstName || !socialData.lastName || !socialData.email) {
        return res.status(400).json({
          success: false,
          message: 'Invalid social profile data'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    }

    // For OAuth users, username and password are not required - OAuth provides authentication
    // Generate username from social data for account identification
    const baseUsername = (socialData.firstName + socialData.lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
    let generatedUsername = baseUsername;
    let counter = 1;

    // Check for uniqueness and append number if needed
    while (await Affiliate.findOne({ username: generatedUsername })) {
      generatedUsername = `${baseUsername}${counter}`;
      counter++;
    }

    // Generate a secure random password for backup login (not exposed to user)
    const generatedPassword = cryptoWrapper.randomBytes(32).toString('hex') + 'A1!'; // Ensures password requirements

    // Check if email or username already exists (now using generatedUsername)
    const existingAffiliate = await Affiliate.findOne({
      $or: [{ email: socialData.email }, { username: generatedUsername }]
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

    // Create new affiliate with social account data
    // affiliateId will be auto-generated by the model using UUID
    const affiliate = new Affiliate({
      firstName: socialData.firstName,
      lastName: socialData.lastName,
      email: socialData.email,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      serviceLatitude,
      serviceLongitude,
      serviceRadius,
      minimumDeliveryFee: minimumDeliveryFee || 25,
      perBagDeliveryFee: perBagDeliveryFee || 5,
      username: generatedUsername,
      password: generatedPassword, // This will be hashed by the model's pre-save middleware
      paymentMethod,
      accountNumber,
      routingNumber,
      paypalEmail,
      languagePreference: languagePreference || 'en',
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
      logger.error('Welcome email error:', emailError);
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
      message: 'Social registration completed successfully',
      affiliateId: affiliate.affiliateId,
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
    logger.error('Social registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

/**
 * Poll for OAuth session result
 */
exports.pollOAuthSession = async (req, res) => {
  logger.info('[OAuth] pollOAuthSession called for sessionId:', req.params.sessionId);
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const OAuthSession = require('../models/OAuthSession');
    const sessionResult = await OAuthSession.consumeSession(sessionId);

    logger.info('OAuth Session Polling Debug:', {
      sessionId,
      sessionResult: sessionResult ? 'found' : 'not found',
      resultData: sessionResult
    });

    if (!sessionResult) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    // Return the complete session result which includes the type field
    const response = {
      success: true,
      result: sessionResult
    };

    logger.info('Sending OAuth response:', response);
    res.json(response);

  } catch (error) {
    logger.error('OAuth session polling error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while polling OAuth session'
    });
  }
};

/**
 * Handle social media OAuth callback for customers
 */
exports.handleCustomerSocialCallback = async (req, res) => {
  logger.info('[handleCustomerSocialCallback] Called with:', {
    user: req.user ? 'exists' : 'null',
    userType: req.user?.isExistingAffiliate ? 'existing-affiliate' : req.user?.isNewUser ? 'new-user' : 'existing-customer',
    query: req.query,
    url: req.url,
    originalUrl: req.originalUrl
  });

  // Debug mode - return JSON instead of redirecting
  if (req.query.debug === 'true') {
    return res.json({
      debug: true,
      user: req.user,
      isExistingAffiliate: req.user?.isExistingAffiliate,
      query: req.query,
      headers: req.headers
    });
  }

  try {
    const user = req.user;

    // Extract sessionId from state parameter for database storage
    // State format: 'customer_oauth_1234...' or 'customer' or 'oauth_1234...'
    let sessionId = null;
    if (req.query.state) {
      // Handle different state formats
      if (req.query.state.includes('oauth_')) {
        // Extract the oauth_xxx part regardless of prefix
        const match = req.query.state.match(/(oauth_[a-zA-Z0-9_]+)/);
        sessionId = match ? match[1] : null;
      }
    }

    logger.info('Customer OAuth Callback State Parameter Debug:', {
      state: req.query.state,
      sessionId: sessionId,
      allParams: req.query
    });

    if (!user) {
      logger.info('[handleCustomerSocialCallback] User is null, handling error case');
      // Check if this is a popup request (for embedded contexts)
      const isPopup = req.query.popup === 'true' ||
                     sessionId !== null ||
                     req.headers.referer?.includes('accounts.google.com') ||
                     req.headers.referer?.includes('facebook.com') ||
                     req.headers.referer?.includes('linkedin.com');

      if (isPopup) {
        const message = {
          type: 'social-auth-error',
          message: 'Social authentication failed'
        };

        // Store in database if sessionId is provided
        if (sessionId) {
          try {
            const OAuthSession = require('../models/OAuthSession');
            await OAuthSession.createSession(sessionId, message);
          } catch (dbError) {
            logger.error('Error storing Customer OAuth session:', dbError);
          }
        }

        // Redirect to OAuth success page with message as parameter
        const messageParam = encodeURIComponent(JSON.stringify(message));
        return res.redirect(`/oauth-success.html?message=${messageParam}`);
      }

      // Always handle OAuth errors as popup to prevent redirect issues
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px;
              background-color: #f5f5f5;
            }
            .error { 
              color: #dc3545; 
              font-size: 24px; 
              margin-bottom: 20px;
            }
            .message {
              color: #666;
              margin-bottom: 30px;
            }
            button { 
              padding: 10px 20px; 
              font-size: 16px; 
              cursor: pointer;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 5px;
            }
            button:hover {
              background-color: #0056b3;
            }
          </style>
        </head>
        <body>
          <div class="error">✗ Authentication Failed</div>
          <p class="message">Social authentication failed. Please try again or use a different login method.</p>
          <button onclick="window.close()">Close Window</button>
          <script>
            try {
              const message = {
                type: 'social-auth-error',
                message: 'Social authentication failed'
              };
              
              // Send error message to parent
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage(message, '*');
              }
              
              if (window.parent && window.parent !== window) {
                window.parent.postMessage(message, '*');
              }
              
              // Also store in localStorage as fallback
              localStorage.setItem('socialAuthResult', JSON.stringify(message));
              
              // Close window after delay
              setTimeout(() => {
                window.close();
                if (!window.closed) {
                  window.open('', '_self', '');
                  window.close();
                }
              }, 5000);
            } catch (e) {
              logger.error('Error in popup communication:', e);
            }
          </script>
        </body>
        </html>
      `);
    }

    // Check if this is a popup request (for embedded contexts)
    const isPopup = req.query.popup === 'true' ||
                   sessionId !== null ||
                   req.headers.referer?.includes('accounts.google.com') ||
                   req.headers.referer?.includes('facebook.com') ||
                   req.headers.referer?.includes('linkedin.com');

    logger.info('Customer OAuth Callback Debug:', {
      popup: req.query.popup,
      state: req.query.state,
      referer: req.headers.referer,
      isPopup,
      userIsNew: user?.isNewUser
    });

    // If this is an existing customer, log them in
    if (!user.isNewUser && user.customerId) {
      // Generate tokens
      const token = generateToken({
        id: user._id,
        customerId: user.customerId,
        userType: 'customer'
      });

      const refreshToken = await generateRefreshToken(
        user._id,
        'customer',
        req.ip
      );

      // Log successful login
      logLoginAttempt(true, 'customer', user.username, req, 'Social login successful');

      // Always handle OAuth callbacks as popups to ensure proper closing
      const message = {
        type: 'social-auth-login',
        token: token,
        refreshToken: refreshToken,
        customer: {
          customerId: user.customerId,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          affiliateId: user.affiliateId
        }
      };

      // Store in database if sessionId is provided
      if (sessionId) {
        try {
          const OAuthSession = require('../models/OAuthSession');
          await OAuthSession.createSession(sessionId, message);
        } catch (dbError) {
          logger.error('Error storing Customer OAuth session:', dbError);
        }
      }

      // Always send HTML response that closes the window
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Successful</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px;
              background-color: #f5f5f5;
            }
            .success { 
              color: #28a745; 
              font-size: 24px; 
              margin-bottom: 20px;
            }
            .message {
              color: #666;
              margin-bottom: 30px;
            }
            button { 
              padding: 10px 20px; 
              font-size: 16px; 
              cursor: pointer;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 5px;
            }
            button:hover {
              background-color: #0056b3;
            }
          </style>
        </head>
        <body>
          <div class="success">✓ Login Successful!</div>
          <p class="message">You have been successfully logged in. This window will close automatically...</p>
          <button onclick="window.close()">Close Window</button>
          <script>
            try {
              const message = ${JSON.stringify(message)};
              
              // Try multiple methods to communicate with parent
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage(message, '*');
              }
              
              if (window.parent && window.parent !== window) {
                window.parent.postMessage(message, '*');
              }
              
              // Also store in localStorage as fallback
              localStorage.setItem('socialAuthResult', JSON.stringify(message));
              
              // Try multiple methods to close the window
              setTimeout(() => {
                window.close();
                // If still open, try other methods
                if (!window.closed) {
                  window.blur();
                  window.close();
                  // Last resort
                  window.open('', '_self', '');
                  window.close();
                }
              }, 1500);
            } catch (e) {
              logger.error('Error in popup communication:', e);
              document.body.innerHTML = '<p>Login successful! Please close this window.</p><button onclick="window.close()">Close Window</button>';
            }
          </script>
        </body>
        </html>
      `);
    }

    // Handle case where social account already exists as an affiliate
    logger.info('[handleCustomerSocialCallback] Checking for existing affiliate:', {
      isExistingAffiliate: user?.isExistingAffiliate,
      userObject: user
    });
    
    if (user && user.isExistingAffiliate) {
      logger.info('[handleCustomerSocialCallback] User is an existing affiliate, showing conflict message');
      const message = {
        type: 'social-auth-account-conflict',
        message: 'This social media account is already associated with an affiliate account. Would you like to login as an affiliate instead?',
        provider: user.provider,
        accountType: 'affiliate',
        affiliateData: {
          firstName: user.affiliate.firstName,
          lastName: user.affiliate.lastName,
          email: user.affiliate.email,
          businessName: user.affiliate.businessName
        }
      };

      // Store in database if sessionId is provided
      if (sessionId) {
        try {
          const OAuthSession = require('../models/OAuthSession');
          await OAuthSession.createSession(sessionId, message);
        } catch (dbError) {
          logger.error('Error storing Customer OAuth session:', dbError);
        }
      }

      // Always handle as popup to avoid redirect issues
      const nonce = res.locals.cspNonce || '';
      logger.info('[handleCustomerSocialCallback] Using nonce for affiliate conflict:', nonce);
      
      // Set proper headers to avoid CSP issues
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Account Type Conflict</title>
          <style${nonce ? ` nonce="${nonce}"` : ''}>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px;
              background-color: #f5f5f5;
            }
            .warning { 
              color: #ff9800; 
              font-size: 24px; 
              margin-bottom: 20px;
            }
            .message {
              color: #666;
              margin-bottom: 30px;
              max-width: 500px;
              margin-left: auto;
              margin-right: auto;
            }
            button { 
              padding: 10px 20px; 
              font-size: 16px; 
              cursor: pointer;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 5px;
              margin: 5px;
            }
            button:hover {
              background-color: #0056b3;
            }
            .affiliate-info {
              background-color: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              margin: 20px auto;
              max-width: 400px;
            }
          </style>
        </head>
        <body>
          <div class="warning">⚠ Account Type Mismatch</div>
          <div class="message">
            <p>This ${message.provider} account is already registered as an affiliate account.</p>
            <div class="affiliate-info">
              <strong>Affiliate Account:</strong><br>
              ${message.affiliateData.businessName || message.affiliateData.firstName + ' ' + message.affiliateData.lastName}<br>
              ${message.affiliateData.email}
            </div>
            <p>You cannot use an affiliate account to log in as a customer. Please use a different social media account or create a new customer account.</p>
          </div>
          <button id="closeBtn">Close Window</button>
          <script${nonce ? ` nonce="${nonce}"` : ''}>
            try {
              const message = ${JSON.stringify(message)};
              
              // Add click handler for close button
              document.getElementById('closeBtn').addEventListener('click', function() {
                window.close();
              });
              
              // Send message to parent window
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage(message, '*');
              }
              
              if (window.parent && window.parent !== window) {
                window.parent.postMessage(message, '*');
              }
              
              // Also store in localStorage as fallback
              localStorage.setItem('socialAuthResult', JSON.stringify(message));
              
              // Close window after delay
              setTimeout(() => {
                window.close();
                if (!window.closed) {
                  window.open('', '_self', '');
                  window.close();
                }
              }, 10000); // Longer delay to allow user to read message
            } catch (e) {
              logger.error('Error in popup communication:', e);
            }
          </script>
        </body>
        </html>
      `);
    }

    // If we handled an existing affiliate conflict above, don't continue
    if (user && user.isExistingAffiliate) {
      return;
    }

    // For new customers, create a temporary social token and redirect to complete registration
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

    if (isPopup) {
      const message = {
        type: 'social-auth-success',
        socialToken: socialToken,
        provider: user.provider,
        // Include user data for form pre-population
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      // Store in database if sessionId is provided
      if (sessionId) {
        try {
          const OAuthSession = require('../models/OAuthSession');
          await OAuthSession.createSession(sessionId, message);
        } catch (dbError) {
          logger.error('Error storing Customer OAuth session:', dbError);
        }
      }

      return res.send(`
        <script>
          logger.info('Customer popup script executing for social-auth-success');
          try {
            const message = ${JSON.stringify(message)};
            
            logger.info('Attempting to send customer message:', message);
            
            if (window.opener && !window.opener.closed) {
              logger.info('Using window.opener.postMessage for customer');
              window.opener.postMessage(message, '*');
            } else if (window.parent && window.parent !== window) {
              logger.info('Using window.parent.postMessage for customer');
              window.parent.postMessage(message, '*');
            } else {
              logger.info('Using localStorage fallback for customer');
              localStorage.setItem('socialAuthResult', JSON.stringify(message));
            }
            
            setTimeout(() => {
              logger.info('Closing customer popup');
              window.close();
            }, 500);
          } catch (e) {
            logger.error('Error in customer popup communication:', e);
            window.close();
          }
        </script>
      `);
    }

    // Redirect to customer registration page with social data
    res.redirect(`/customer-register-embed.html?socialToken=${socialToken}&provider=${user.provider}`);

  } catch (error) {
    logger.error('Customer social callback error:', error);

    // Check if this is a popup request
    const isPopup = req.query.popup === 'true' ||
                   req.query.state === 'popup=true' ||
                   req.headers.referer?.includes('accounts.google.com') ||
                   req.headers.referer?.includes('facebook.com') ||
                   req.headers.referer?.includes('linkedin.com');

    if (isPopup) {
      return res.send(`
        <script>
          try {
            const message = {
              type: 'social-auth-error',
              message: 'An error occurred during social authentication'
            };
            
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(message, '*');
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(message, '*');
            } else {
              localStorage.setItem('socialAuthResult', JSON.stringify(message));
            }
            
            setTimeout(() => window.close(), 500);
          } catch (e) {
            logger.error('Error in popup communication:', e);
            window.close();
          }
        </script>
      `);
    }

    res.redirect('/customer-register-embed.html?error=social_auth_error');
  }
};

/**
 * Complete social media registration for customers
 */
exports.completeSocialCustomerRegistration = async (req, res) => {
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
      affiliateId,
      phone,
      address,
      city,
      state,
      zipCode,
      serviceFrequency,
      deliveryInstructions,
      specialInstructions,
      username,
      password
    } = req.body;

    // Verify social token
    let socialData;
    try {
      socialData = jwt.verify(socialToken, process.env.JWT_SECRET);
      // Sanitize social data to prevent XSS attacks
      socialData = sanitizeInput(socialData);

      // Validate that required fields are not empty after sanitization
      if (!socialData.firstName || !socialData.lastName || !socialData.email) {
        return res.status(400).json({
          success: false,
          message: 'Invalid social profile data'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    }

    // For OAuth users, username and password are not required - OAuth provides authentication
    // Generate username from social data for account identification
    const baseUsername = (socialData.firstName + socialData.lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
    let generatedUsername = baseUsername;
    let counter = 1;

    // Check for uniqueness and append number if needed
    while (await Customer.findOne({ username: generatedUsername })) {
      generatedUsername = `${baseUsername}${counter}`;
      counter++;
    }

    // Generate a secure random password for backup login (not exposed to user)
    const generatedPassword = cryptoWrapper.randomBytes(32).toString('hex') + 'A1!'; // Ensures password requirements

    // Check if email already exists
    const existingCustomer = await Customer.findOne({
      email: socialData.email
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if social account is already registered
    const socialAccountKey = `socialAccounts.${socialData.provider}.id`;
    const existingSocialCustomer = await Customer.findOne({
      [socialAccountKey]: socialData.socialId
    });

    if (existingSocialCustomer) {
      return res.status(400).json({
        success: false,
        message: 'This social media account is already registered with another customer account'
      });
    }

    // Verify affiliate exists
    const Affiliate = require('../models/Affiliate');
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid affiliate ID'
      });
    }

    // Hash password for backup login
    const { salt, hash } = encryptionUtil.hashPassword(generatedPassword);

    // Create new customer with social account data
    // customerId will be auto-generated by the model using UUID
    const customer = new Customer({
      affiliateId,
      firstName: socialData.firstName,
      lastName: socialData.lastName,
      email: socialData.email,
      phone,
      address,
      city,
      state,
      zipCode,
      serviceFrequency: serviceFrequency || 'weekly',
      deliveryInstructions,
      specialInstructions,
      username: generatedUsername,
      passwordSalt: salt,
      passwordHash: hash,
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

    await customer.save();

    // Send welcome email
    try {
      await emailService.sendCustomerWelcomeEmail(customer);
    } catch (emailError) {
      logger.error('Customer welcome email error:', emailError);
      // Continue even if email fails
    }

    // Generate tokens
    const token = generateToken({
      id: customer._id,
      customerId: customer.customerId,
      userType: 'customer'
    });

    const refreshToken = await generateRefreshToken(
      customer._id,
      'customer',
      req.ip
    );

    // Log successful registration and login
    logAuditEvent(AuditEvents.ACCOUNT_CREATED, {
      action: 'SOCIAL_CUSTOMER_REGISTRATION',
      userId: customer._id,
      userType: 'customer',
      details: {
        customerId: customer.customerId,
        affiliateId: customer.affiliateId,
        provider: socialData.provider,
        registrationMethod: 'social'
      }
    }, req);

    res.status(201).json({
      success: true,
      message: 'Customer social registration completed successfully',
      customerId: customer.customerId,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        affiliateId: customer.affiliateId,
        registrationMethod: customer.registrationMethod
      },
      token,
      refreshToken,
      expiresIn: '1h'
    });

  } catch (error) {
    logger.error('Customer social registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Customer registration failed'
    });
  }
};

/**
 * Check if username is available (public endpoint)
 * @route   POST /api/auth/check-username
 * @desc    Check if username is available
 * @access  Public
 */
exports.checkUsername = async (req, res) => {
  try {
    const available = await identityAvailabilityService.isUsernameAvailable({
      username: req.body.username
    });
    res.json({ success: true, available });
  } catch (err) {
    if (err.isIdentityAvailabilityError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Check username error:', err);
    res.status(500).json({ success: false, message: 'Error checking username availability' });
  }
};

/**
 * Check if email is available (public endpoint)
 * @route   POST /api/auth/check-email
 * @desc    Check if email is available
 * @access  Public
 */
exports.checkEmail = async (req, res) => {
  try {
    const available = await identityAvailabilityService.isEmailAvailable({
      email: req.body.email
    });
    res.json({ success: true, available });
  } catch (err) {
    if (err.isIdentityAvailabilityError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Check email error:', err);
    res.status(500).json({ success: false, message: 'Error checking email availability' });
  }
};

// Export cryptoWrapper for testing
exports._cryptoWrapper = cryptoWrapper;

module.exports = exports;
