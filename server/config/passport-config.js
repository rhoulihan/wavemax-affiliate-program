// Passport Configuration for Social Media Authentication
// WaveMAX Laundry Affiliate Program

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

/**
 * Configure Google OAuth Strategy
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_URI || 'https://wavemax.promo'}/api/v1/auth/google/callback`,
    passReqToCallback: true // This allows us to access req in the callback
  }, async (req, accessToken, refreshToken, profile, done) => {
  try {
    // Determine context from state parameter
    const isCustomerContext = req.query.state && req.query.state.startsWith('customer');
    
    console.log('Google OAuth Strategy Context:', {
      state: req.query.state,
      isCustomerContext: isCustomerContext,
      userEmail: profile.emails[0].value
    });
    
    if (isCustomerContext) {
      // Customer OAuth Logic
      console.log('Processing customer OAuth for:', profile.emails[0].value);
      
      // Check if customer already exists with this Google ID
      let customer = await Customer.findOne({ 'socialAccounts.google.id': profile.id });
      
      if (customer) {
        // Update last login and social account info
        customer.socialAccounts.google.accessToken = accessToken;
        customer.socialAccounts.google.refreshToken = refreshToken;
        customer.lastLogin = new Date();
        await customer.save();
        
        console.log('Found existing customer by Google ID:', customer.customerId);
        return done(null, customer);
      }
      
      // Check if customer exists with same email
      customer = await Customer.findOne({ email: profile.emails[0].value });
      
      if (customer) {
        // Link Google account to existing customer
        customer.socialAccounts.google = {
          id: profile.id,
          accessToken,
          refreshToken,
          email: profile.emails[0].value,
          name: profile.displayName,
          linkedAt: new Date()
        };
        customer.lastLogin = new Date();
        await customer.save();
        
        console.log('Linked Google account to existing customer:', customer.customerId);
        return done(null, customer);
      }
      
      // Check if an affiliate exists with this social account or email
      let existingAffiliate = await Affiliate.findOne({ 
        $or: [
          { 'socialAccounts.google.id': profile.id },
          { email: profile.emails[0].value }
        ]
      });
      
      if (existingAffiliate) {
        // Same social account is already used by an affiliate
        console.log('Found existing affiliate when trying customer OAuth:', existingAffiliate.affiliateId);
        return done(null, {
          isExistingAffiliate: true,
          provider: 'google',
          socialId: profile.id,
          email: profile.emails[0].value,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          affiliate: existingAffiliate,
          accessToken,
          refreshToken,
          profileData: profile._json
        });
      }
      
      // No existing customer found - return new user data for registration
      console.log('New customer registration needed for:', profile.emails[0].value);
      return done(null, {
        isNewUser: true,
        userType: 'customer',
        provider: 'google',
        socialId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        accessToken,
        refreshToken,
        profileData: profile._json
      });
      
    } else {
      // Affiliate OAuth Logic (default)
      console.log('Processing affiliate OAuth for:', profile.emails[0].value);
      
      // Check if affiliate already exists with this Google ID
      let affiliate = await Affiliate.findOne({ 'socialAccounts.google.id': profile.id });
      
      if (affiliate) {
        // Update last login and social account info
        affiliate.socialAccounts.google.accessToken = accessToken;
        affiliate.socialAccounts.google.refreshToken = refreshToken;
        affiliate.lastLogin = new Date();
        await affiliate.save();
        
        console.log('Found existing affiliate by Google ID:', affiliate.affiliateId);
        return done(null, affiliate);
      }
      
      // Check if affiliate exists with same email
      affiliate = await Affiliate.findOne({ email: profile.emails[0].value });
      
      if (affiliate) {
        // Link Google account to existing affiliate
        affiliate.socialAccounts.google = {
          id: profile.id,
          accessToken,
          refreshToken,
          email: profile.emails[0].value,
          name: profile.displayName,
          linkedAt: new Date()
        };
        affiliate.lastLogin = new Date();
        await affiliate.save();
        
        console.log('Linked Google account to existing affiliate:', affiliate.affiliateId);
        return done(null, affiliate);
      }
      
      // Check if a customer exists with this social account or email
      let existingCustomer = await Customer.findOne({ 
        $or: [
          { 'socialAccounts.google.id': profile.id },
          { email: profile.emails[0].value }
        ]
      });
      
      if (existingCustomer) {
        // Same social account is already used by a customer
        console.log('Found existing customer when trying affiliate OAuth:', existingCustomer.customerId);
        return done(null, {
          isExistingCustomer: true,
          provider: 'google',
          socialId: profile.id,
          email: profile.emails[0].value,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          customer: existingCustomer,
          accessToken,
          refreshToken,
          profileData: profile._json
        });
      }
      
      // No existing affiliate found - return new user data for registration
      console.log('New affiliate registration needed for:', profile.emails[0].value);
      return done(null, {
        isNewUser: true,
        userType: 'affiliate',
        provider: 'google',
        socialId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        accessToken,
        refreshToken,
        profileData: profile._json
      });
    }
    
  } catch (error) {
    const isCustomerContext = req.query.state && req.query.state.startsWith('customer');
    console.error('Google OAuth error:', error);
    logAuditEvent(AuditEvents.AUTH_ERROR, {
      provider: 'google',
      userType: isCustomerContext ? 'customer' : 'affiliate',
      error: error.message
    });
    return done(error, null);
  }
  }));
}

/**
 * Configure Facebook OAuth Strategy
 */
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: `${process.env.OAUTH_CALLBACK_URI || 'https://wavemax.promo'}/api/v1/auth/facebook/callback`,
  profileFields: ['id', 'emails', 'name', 'picture.type(large)']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if affiliate already exists with this Facebook ID
    let affiliate = await Affiliate.findOne({ 'socialAccounts.facebook.id': profile.id });
    
    if (affiliate) {
      // Update last login and social account info
      affiliate.socialAccounts.facebook.accessToken = accessToken;
      affiliate.lastLogin = new Date();
      await affiliate.save();
      
      return done(null, affiliate);
    }
    
    // Check if affiliate exists with same email
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      affiliate = await Affiliate.findOne({ email });
      
      if (affiliate) {
        // Link Facebook account to existing affiliate
        affiliate.socialAccounts.facebook = {
          id: profile.id,
          accessToken,
          email,
          name: profile.displayName,
          linkedAt: new Date()
        };
        affiliate.lastLogin = new Date();
        await affiliate.save();
        
        return done(null, affiliate);
      }
    }
    
    // Return profile data for new registration
    return done(null, {
      isNewUser: true,
      provider: 'facebook',
      socialId: profile.id,
      email: email,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      accessToken,
      profileData: profile._json
    });
    
  } catch (error) {
    console.error('Facebook OAuth error:', error);
    return done(error, null);
  }
  }));
}

/**
 * Configure LinkedIn OAuth Strategy
 */
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: `${process.env.OAUTH_CALLBACK_URI || 'https://wavemax.promo'}/api/v1/auth/linkedin/callback`,
  scope: ['r_emailaddress', 'r_liteprofile']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if affiliate already exists with this LinkedIn ID
    let affiliate = await Affiliate.findOne({ 'socialAccounts.linkedin.id': profile.id });
    
    if (affiliate) {
      // Update last login and social account info
      affiliate.socialAccounts.linkedin.accessToken = accessToken;
      affiliate.socialAccounts.linkedin.refreshToken = refreshToken;
      affiliate.lastLogin = new Date();
      await affiliate.save();
      
      return done(null, affiliate);
    }
    
    // Check if affiliate exists with same email
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (email) {
      affiliate = await Affiliate.findOne({ email });
      
      if (affiliate) {
        // Link LinkedIn account to existing affiliate
        affiliate.socialAccounts.linkedin = {
          id: profile.id,
          accessToken,
          refreshToken,
          email,
          name: profile.displayName,
          linkedAt: new Date()
        };
        affiliate.lastLogin = new Date();
        await affiliate.save();
        
        return done(null, affiliate);
      }
    }
    
    // Return profile data for new registration
    return done(null, {
      isNewUser: true,
      provider: 'linkedin',
      socialId: profile.id,
      email: email,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      accessToken,
      refreshToken,
      profileData: profile._json
    });
    
  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    return done(error, null);
  }
  }));
}


/**
 * Serialize user for session storage
 */
passport.serializeUser((user, done) => {
  done(null, user._id || user.socialId);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id, done) => {
  try {
    const affiliate = await Affiliate.findById(id);
    done(null, affiliate);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;