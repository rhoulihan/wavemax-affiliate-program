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
        // Update last login and social account info using selective update to avoid validation issues
          await Affiliate.findByIdAndUpdate(
            affiliate._id,
            {
              'socialAccounts.google.accessToken': accessToken,
              'socialAccounts.google.refreshToken': refreshToken,
              'lastLogin': new Date()
            },
            { runValidators: false }
          );

          // Fetch the updated affiliate
          affiliate = await Affiliate.findById(affiliate._id);

          console.log('Found existing affiliate by Google ID:', affiliate.affiliateId);
          return done(null, affiliate);
        }

        // Check if affiliate exists with same email
        affiliate = await Affiliate.findOne({ email: profile.emails[0].value });

        if (affiliate) {
        // Link Google account to existing affiliate using selective update
          await Affiliate.findByIdAndUpdate(
            affiliate._id,
            {
              'socialAccounts.google': {
                id: profile.id,
                accessToken,
                refreshToken,
                email: profile.emails[0].value,
                name: profile.displayName,
                linkedAt: new Date()
              },
              'lastLogin': new Date()
            },
            { runValidators: false }
          );

          // Fetch the updated affiliate
          affiliate = await Affiliate.findById(affiliate._id);

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
    profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const isCustomerContext = req.query.state && req.query.state.includes('customer');
      console.log('Facebook OAuth context:', { isCustomerContext, state: req.query.state });

      // Extract email from profile
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      
      console.log('Facebook OAuth Debug:', {
        profileId: profile.id,
        email: email,
        profileData: profile._json,
        isCustomerContext: isCustomerContext
      });

      // If this is a customer OAuth request, handle it differently
      if (isCustomerContext) {
        // Check if customer already exists with this Facebook ID
        let customer = await Customer.findOne({ 'socialAccounts.facebook.id': profile.id });
        
        if (customer) {
          // Update last login and social account info
          await Customer.findByIdAndUpdate(
            customer._id,
            {
              'socialAccounts.facebook.accessToken': accessToken,
              'lastLogin': new Date()
            },
            { runValidators: false }
          );
          
          // Fetch the updated customer
          customer = await Customer.findById(customer._id);
          
          console.log('Found existing customer by Facebook ID:', customer.customerId);
          return done(null, customer);
        }
        
        // Check if customer exists with same email
        if (email) {
          customer = await Customer.findOne({ email });
          
          if (customer) {
            // Link Facebook account to existing customer
            await Customer.findByIdAndUpdate(
              customer._id,
              {
                'socialAccounts.facebook': {
                  id: profile.id,
                  accessToken,
                  email,
                  name: profile.displayName,
                  linkedAt: new Date()
                },
                'lastLogin': new Date()
              },
              { runValidators: false }
            );
            
            // Fetch the updated customer
            customer = await Customer.findById(customer._id);
            
            console.log('Linked Facebook account to existing customer:', customer.customerId);
            return done(null, customer);
          }
        }
        
        // Check if an affiliate exists with this social account or email
        console.log('Checking for existing affiliate with Facebook ID:', profile.id, 'or email:', email);
        let existingAffiliate = await Affiliate.findOne({
          $or: [
            { 'socialAccounts.facebook.id': profile.id },
            email ? { email } : null
          ].filter(Boolean)
        });
        
        console.log('Affiliate search result:', existingAffiliate ? {
          affiliateId: existingAffiliate.affiliateId,
          email: existingAffiliate.email,
          facebookId: existingAffiliate.socialAccounts?.facebook?.id
        } : 'No affiliate found');
        
        if (existingAffiliate) {
          // Same social account is already used by an affiliate
          console.log('Found existing affiliate when trying customer OAuth:', existingAffiliate.affiliateId);
          return done(null, {
            isExistingAffiliate: true,
            provider: 'facebook',
            socialId: profile.id,
            email: email,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            affiliate: existingAffiliate,
            accessToken,
            refreshToken,
            profileData: profile._json
          });
        }
        
        // Extract name parts
        let firstName = '';
        let lastName = '';
        
        if (profile.name) {
          firstName = profile.name.givenName || '';
          lastName = profile.name.familyName || '';
        }
        
        // Fallback to parsing displayName if structured name not available
        if ((!firstName || !lastName) && profile.displayName) {
          const nameParts = profile.displayName.trim().split(' ');
          if (!firstName) firstName = nameParts[0] || '';
          if (!lastName && nameParts.length > 1) {
            lastName = nameParts.slice(1).join(' ');
          }
        }
        
        // No existing customer found - return new user data for registration
        console.log('New customer registration needed for:', email);
        return done(null, {
          isNewUser: true,
          userType: 'customer',
          provider: 'facebook',
          socialId: profile.id,
          email: email,
          firstName: firstName,
          lastName: lastName,
          displayName: profile.displayName,
          accessToken,
          refreshToken,
          profileData: profile._json
        });
      }
      
      // If NOT in customer context, handle affiliate login/registration
      if (!isCustomerContext) {
        // Check if affiliate already exists with this Facebook ID
        let affiliate = await Affiliate.findOne({ 'socialAccounts.facebook.id': profile.id });

      if (affiliate) {
      // Update last login and social account info using selective update
        await Affiliate.findByIdAndUpdate(
          affiliate._id,
          {
            'socialAccounts.facebook.accessToken': accessToken,
            'lastLogin': new Date()
          },
          { runValidators: false }
        );

        // Fetch the updated affiliate
        affiliate = await Affiliate.findById(affiliate._id);

        return done(null, affiliate);
      }

      // Check if affiliate exists with same email
      if (email) {
        affiliate = await Affiliate.findOne({ email });

        if (affiliate) {
        // Link Facebook account to existing affiliate using selective update
          await Affiliate.findByIdAndUpdate(
            affiliate._id,
            {
              'socialAccounts.facebook': {
                id: profile.id,
                accessToken,
                email,
                name: profile.displayName,
                linkedAt: new Date()
              },
              'lastLogin': new Date()
            },
            { runValidators: false }
          );

          // Fetch the updated affiliate
          affiliate = await Affiliate.findById(affiliate._id);

          return done(null, affiliate);
        }
      }

      // Log the profile structure for debugging
      console.log('Facebook profile structure:', {
        id: profile.id,
        displayName: profile.displayName,
        name: profile.name,
        emails: profile.emails,
        _json: profile._json
      });

      // Extract name parts - Facebook might not always provide structured name
      let firstName = '';
      let lastName = '';
      
      if (profile.name) {
        firstName = profile.name.givenName || '';
        lastName = profile.name.familyName || '';
      }
      
      // Fallback to parsing displayName if structured name not available
      if ((!firstName || !lastName) && profile.displayName) {
        const nameParts = profile.displayName.trim().split(' ');
        if (!firstName) firstName = nameParts[0] || '';
        if (!lastName && nameParts.length > 1) {
          lastName = nameParts.slice(1).join(' ');
        }
      }

      // Check if a customer exists with this social account or email
      let existingCustomer = await Customer.findOne({
        $or: [
          { 'socialAccounts.facebook.id': profile.id },
          email ? { email } : null
        ].filter(Boolean)
      });
      
      if (existingCustomer) {
        // Same social account is already used by a customer
        console.log('Found existing customer when trying affiliate OAuth:', existingCustomer.customerId);
        return done(null, {
          isExistingCustomer: true,
          provider: 'facebook',
          socialId: profile.id,
          email: email,
          firstName: firstName,
          lastName: lastName,
          customer: existingCustomer,
          accessToken,
          refreshToken,
          profileData: profile._json
        });
      }

      // Return profile data for new registration
      return done(null, {
        isNewUser: true,
        userType: 'affiliate',
        provider: 'facebook',
        socialId: profile.id,
        email: email,
        firstName: firstName,
        lastName: lastName,
        displayName: profile.displayName,
        accessToken,
        profileData: profile._json
      });
      }

    } catch (error) {
      const isCustomerContext = req.query.state && req.query.state.includes('customer');
      console.error('Facebook OAuth error:', error);
      logAuditEvent(AuditEvents.AUTH_ERROR, {
        provider: 'facebook',
        userType: isCustomerContext ? 'customer' : 'affiliate',
        error: error.message
      });
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
      // Update last login and social account info using selective update
        await Affiliate.findByIdAndUpdate(
          affiliate._id,
          {
            'socialAccounts.linkedin.accessToken': accessToken,
            'socialAccounts.linkedin.refreshToken': refreshToken,
            'lastLogin': new Date()
          },
          { runValidators: false }
        );

        // Fetch the updated affiliate
        affiliate = await Affiliate.findById(affiliate._id);

        return done(null, affiliate);
      }

      // Check if affiliate exists with same email
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        affiliate = await Affiliate.findOne({ email });

        if (affiliate) {
        // Link LinkedIn account to existing affiliate using selective update
          await Affiliate.findByIdAndUpdate(
            affiliate._id,
            {
              'socialAccounts.linkedin': {
                id: profile.id,
                accessToken,
                refreshToken,
                email,
                name: profile.displayName,
                linkedAt: new Date()
              },
              'lastLogin': new Date()
            },
            { runValidators: false }
          );

          // Fetch the updated affiliate
          affiliate = await Affiliate.findById(affiliate._id);

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