// WaveMAX Laundry Affiliate Program
// Main Server Entry Point

require('dotenv').config();
const { errorHandler } = require('./server/middleware/errorHandler');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
// Rate limiting is now handled by centralized middleware
const compression = require('compression');

// Import middleware
const { mongoSanitize, sanitizeRequest } = require('./server/middleware/sanitization');
const { conditionalCsrf, csrfTokenEndpoint } = require('./server/config/csrf-config');

// Import routes
const authRoutes = require('./server/routes/authRoutes');
const socialAuthRoutes = require('./server/routes/socialAuthRoutes');
const facebookDataRoutes = require('./server/routes/facebookDataRoutes');
const affiliateRoutes = require('./server/routes/affiliateRoutes');
const customerRoutes = require('./server/routes/customerRoutes');
const orderRoutes = require('./server/routes/orderRoutes');
const administratorRoutes = require('./server/routes/administratorRoutes');
const operatorRoutes = require('./server/routes/operatorRoutes');
const w9Routes = require('./server/routes/w9Routes');
const coverageRoutes = require('./server/routes/coverageRoutes');
const monitoringRoutes = require('./server/routes/monitoringRoutes');
const systemConfigRoutes = require('./server/routes/systemConfigRoutes');
const routingRoutes = require('./server/routes/routingRoutes');
const paymentRoutes = require('./server/routes/paymentRoutes');
const quickbooksRoutes = require('./server/routes/quickbooksRoutes');
const serviceAreaRoutes = require('./server/routes/serviceAreaRoutes');
const affiliateController = require('./server/controllers/affiliateController');
const customerController = require('./server/controllers/customerController');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

const logger = require('./server/utils/logger');
const passport = require('./server/config/passport-config');

const MongoStore = require('connect-mongo');

app.set('trust proxy', 1);

// Update logging statements
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', { error: err.message, stack: err.stack });
  process.exit(1);
});

app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// Define MongoDB connection options
const mongoOptions = {
  // Use the modern tls option instead of ssl
  tls: true,
  // Only allow invalid certificates in non-production environments
  tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
};

// Connect to MongoDB with consistent options (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGODB_URI, mongoOptions)
    .then(async () => {
      logger.info('Connected to MongoDB');

      // Initialize system configuration defaults
      try {
        const SystemConfig = require('./server/models/SystemConfig');
        await SystemConfig.initializeDefaults();
        logger.info('System configuration defaults initialized');
      } catch (error) {
        logger.error('Error initializing system config:', { error: error.message });
      }

      // Initialize default accounts (admin and operator)
      try {
        const { initializeDefaults } = require('./init-defaults');
        await initializeDefaults();
      } catch (error) {
        logger.error('Error initializing default accounts:', { error: error.message });
      }

      // Initialize Paygistix callback pool
      try {
        const callbackPoolManager = require('./server/services/callbackPoolManager');
        await callbackPoolManager.initializePool();
        logger.info('Paygistix callback pool initialized');
      } catch (error) {
        logger.error('Error initializing callback pool:', { error: error.message });
      }

      // Initialize data retention service
      try {
        const DataRetentionService = require('./server/services/dataRetentionService');
        DataRetentionService.initialize();
        logger.info('Data retention service initialized');
      } catch (error) {
        logger.error('Error initializing data retention service:', { error: error.message });
      }
    })
    .catch(err => {
      logger.error('MongoDB connection error:', { error: err.message });
      process.exit(1);
    });
}

// Middleware
// HTTPS redirect in production with host validation
if (process.env.NODE_ENV === 'production') {
  // Define allowed hosts
  const allowedHosts = [
    'wavemax.promo',
    'www.wavemax.promo',
    'affiliate.wavemax.promo',
    'localhost:3000' // For development if needed
  ];
  
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      const host = req.header('host');
      
      // Validate host header against whitelist
      if (host && allowedHosts.includes(host.toLowerCase())) {
        res.redirect(`https://${host}${req.url}`);
      } else {
        // Use default domain if host is invalid
        res.redirect(`https://wavemax.promo${req.url}`);
      }
    } else {
      next();
    }
  });
}

// CSP Nonce Middleware - must come before helmet
const cspNonceMiddleware = require('./server/middleware/cspNonce');
app.use(cspNonceMiddleware);

// Security headers with iframe embedding support
app.use(helmet({
  // Disable helmet's CSP - we'll implement it manually to support nonces
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
  // Remove frameguard to use CSP frame-ancestors instead
  frameguard: false,
  // Additional security headers
  permittedCrossDomainPolicies: false,
  hidePoweredBy: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false }
}));

// Add custom security headers not covered by helmet
app.use((req, res, next) => {
  // Permissions Policy (previously Feature Policy)
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()'
  );
  
  // X-Permitted-Cross-Domain-Policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Clear-Site-Data header for logout endpoints
  if (req.path.includes('/logout')) {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }
  
  next();
});

// Manual CSP implementation with nonce support
app.use((req, res, next) => {
  const nonce = res.locals.cspNonce;
  
  // Check if this is a migrated page that should use strict CSP
  const strictCSPPages = [
    '/terms-and-conditions-embed.html',
    '/privacy-policy.html',
    '/payment-success-embed.html',
    '/payment-error-embed.html',
    '/operator-scan-embed.html',
    '/affiliate-success-embed.html',
    '/affiliate-landing-embed.html',
    '/embed-landing.html',
    '/franchisee-landing.html',
    '/embed-app-v2.html',
    '/operator-login-store.html',
    '/affiliate-register-embed.html',
    '/affiliate-login-embed.html',
    '/affiliate-dashboard-embed.html',
    '/customer-register-embed.html',
    '/customer-login-embed.html',
    '/customer-dashboard-embed.html',
    '/forgot-password-embed.html',
    '/reset-password-embed.html'
  ];
  
  // Apply strict CSP to documentation pages as well (but not examples)
  const isDocumentationPage = req.path.startsWith('/docs/') && 
                             req.path.endsWith('.html') && 
                             !req.path.includes('/examples/');
  
  // Apply strict CSP to coverage analysis pages
  const isCoveragePage = req.path.startsWith('/coverage');
  
  const useStrictCSP = strictCSPPages.includes(req.path) || isDocumentationPage || isCoveragePage;
  
  // All embed pages now use nonces since embed-app.html was converted to CSP-compliant redirect to embed-app-v2.html
  const skipNonce = false;
  
  // Build CSP directives
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
      'https://safepay.paymentlogistics.net',
      'https://code.jquery.com'
    ],
    'style-src': [
      "'self'",
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
      'https://fonts.googleapis.com'
    ],
    'img-src': ["'self'", 'data:', 'https://www.wavemax.promo', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org', 'https://cdnjs.cloudflare.com', 'https://flagcdn.com'],
    'connect-src': ["'self'", 'https://wavemax.promo', 'https://router.project-osrm.org', 'https://graphhopper.com', 'https://api.openrouteservice.org', 'https://valhalla1.openstreetmap.de', 'https://nominatim.openstreetmap.org'],
    'font-src': ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'frame-src': process.env.ENABLE_IFRAME_DEMO === 'true' ? ["'self'"] : ["'none'"],
    'form-action': ["'self'", 'https://safepay.paymentlogistics.net'],
    'frame-ancestors': ["'self'", 'https://www.wavemaxlaundry.com', 'https://wavemaxlaundry.com'],
    'base-uri': ["'self'"],
    'child-src': ["'none'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"]
  };
  
  // Add nonces only if not skipping
  if (!skipNonce && nonce) {
    directives['script-src'].push(`'nonce-${nonce}'`);
    directives['style-src'].push(`'nonce-${nonce}'`);
  }
  
  // Add unsafe-inline for non-migrated pages
  if (!useStrictCSP) {
    directives['script-src'].push("'unsafe-inline'");
    directives['style-src'].push("'unsafe-inline'");
  }
  
  // Add upgrade-insecure-requests in production
  if (process.env.NODE_ENV === 'production') {
    directives['upgrade-insecure-requests'] = [];
  }
  
  // Build CSP header string
  const cspHeader = Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
  
  res.setHeader('Content-Security-Policy', cspHeader);
  next();
});

// CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:3000'];

    // Add WaveMAX Laundry domains to allowed origins
    const wavemaxDomains = [
      'https://www.wavemaxlaundry.com',
      'https://wavemaxlaundry.com',
      'https://wavemax.promo' // Add our own domain for iframe same-origin
    ];

    const allAllowedOrigins = [...allowedOrigins, ...wavemaxDomains];

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    if (allAllowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'csrf-token', 'xsrf-token', 'x-xsrf-token'],
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Request body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitization middleware
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(sanitizeRequest); // Sanitize all inputs for XSS prevention

// Compression for all responses
app.use(compression());

// Rate limiting for API endpoints
// Import centralized rate limiting configuration
const { apiLimiter } = require('./server/middleware/rateLimiting');

// Apply general API rate limiting to all /api routes
// The middleware itself handles test environment and relaxed mode
app.use('/api/', apiLimiter);

// Setup session middleware - add this after other middleware like helmet, cors, etc.
const session = require('express-session');

// Calculate maxAge once to ensure consistency
const sessionMaxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Configure session store based on environment
const sessionStore = process.env.NODE_ENV === 'test'
  ? undefined // Use default MemoryStore for tests
  : MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // Lazy session update in seconds (24 hours)
  });

app.use(session({
  name: 'wavemax.sid', // Explicit session cookie name
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'default-dev-secret',
  resave: false, // Don't resave session if unmodified
  saveUninitialized: true, // Changed to true to ensure sessions are created for CSRF
  rolling: false, // Disable rolling to avoid maxAge issues
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only use secure in production
    httpOnly: true,
    maxAge: sessionMaxAge, // Use pre-calculated value
    originalMaxAge: sessionMaxAge, // Store original maxAge
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' required for cross-site iframe in production
    path: '/', // Ensure cookie is available for all paths
    domain: undefined // Let browser handle domain (works better for same-origin)
  },
  // Add genid to ensure consistent session IDs
  genid: function(req) {
    // For iframe contexts, try to use a consistent ID based on authorization token
    if (req.headers.authorization) {
      const crypto = require('crypto');
      const token = req.headers.authorization.replace('Bearer ', '');
      // Create a deterministic session ID based on the auth token
      return 'sess_' + crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
    }
    // Default to random ID
    return require('crypto').randomBytes(16).toString('hex');
  }
}));

// Add middleware to ensure session cookie maxAge is always valid
app.use((req, res, next) => {
  if (req.session && req.session.cookie) {
    // Force reset cookie properties to ensure they're valid
    const originalMaxAge = req.session.cookie.maxAge;
    const originalExpires = req.session.cookie._expires;

    // Always ensure maxAge is a valid number
    if (typeof originalMaxAge !== 'number' || isNaN(originalMaxAge) || originalMaxAge < 0) {
      // Create a new cookie object to avoid prototype issues
      req.session.cookie = {
        ...req.session.cookie,
        maxAge: sessionMaxAge,
        originalMaxAge: sessionMaxAge,
        expires: new Date(Date.now() + sessionMaxAge),
        _expires: new Date(Date.now() + sessionMaxAge)
      };
    }

    // Double-check the maxAge is still valid
    if (typeof req.session.cookie.maxAge !== 'number') {
      req.session.cookie.maxAge = sessionMaxAge;
    }
  }
  next();
});

// Initialize Passport for social media authentication
app.use(passport.initialize());
app.use(passport.session());

// Mount embed routes with CSP nonce support BEFORE static file serving
const embedRoutes = require('./server/routes/embedRoutes');
app.use('/', embedRoutes);

// Mount coverage analysis reports BEFORE static files so they can handle CSP nonce injection
app.use('/coverage-analysis', coverageRoutes);

// Mount monitoring dashboard BEFORE static files for CSP nonce injection
app.use('/monitoring', monitoringRoutes);

// Handle direct monitoring-dashboard.html path
app.get('/monitoring-dashboard.html', (req, res) => {
  res.redirect('/monitoring/');
});


// Serve static files in all environments
app.use(express.static(path.join(__dirname, 'public')));

// Serve documentation if enabled
if (process.env.SHOW_DOCS === 'true') {
  const docsRoutes = require('./server/routes/docsRoutes');
  app.use('/docs', docsRoutes);
}

// Coverage routes are mounted earlier, before static files

// Mount filmwalk routes
app.use('/filmwalk', routingRoutes);

// Apply CSRF protection with new configuration
app.use(conditionalCsrf);

// CSRF token endpoint
app.get('/api/csrf-token', csrfTokenEndpoint);

// API Versioning middleware
const API_VERSION = 'v1';
const apiVersioning = (req, res, next) => {
  // Extract version from header or URL
  const versionFromHeader = req.headers['api-version'];
  const versionFromUrl = req.path.match(/^\/api\/(v\d+)\//)?.[1];

  // Use version from URL first, then header, then default
  req.apiVersion = versionFromUrl || versionFromHeader || API_VERSION;

  // Rewrite URL if version is in header but not in URL
  if (!versionFromUrl && req.path.startsWith('/api/')) {
    req.url = req.path.replace('/api/', `/api/${req.apiVersion}/`);
  }

  next();
};

// Apply API versioning
app.use(apiVersioning);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    // Add CORS headers for translation files
    if (path.includes('/locales/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
    }
  }
}));

// Test payment form - only available when explicitly enabled
if (process.env.ENABLE_TEST_PAYMENT_FORM === 'true') {
  app.get('/test-payment', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-payment-form.html'));
  });
  logger.info('Test payment form enabled and available at /test-payment');
}

// API Routes with versioning
const apiV1Router = express.Router();

// Environment endpoint (for checking if in dev/test mode)
apiV1Router.get('/environment', (req, res) => {
  res.json({
    success: true,
    nodeEnv: process.env.NODE_ENV || 'development',
    enableDeleteDataFeature: process.env.ENABLE_DELETE_DATA_FEATURE === 'true',
    enableTestPaymentForm: process.env.ENABLE_TEST_PAYMENT_FORM === 'true'
  });
});

// Mount v1 routes
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/auth', socialAuthRoutes);  // Social auth routes
apiV1Router.use('/auth/facebook', facebookDataRoutes);  // Facebook data deletion routes
apiV1Router.use('/affiliates', affiliateRoutes);
apiV1Router.use('/customers', customerRoutes);
apiV1Router.use('/orders', orderRoutes);
apiV1Router.use('/administrators', administratorRoutes);
apiV1Router.use('/operators', operatorRoutes);
apiV1Router.use('/w9', w9Routes);  // W-9 document management
apiV1Router.use('/system/config', systemConfigRoutes);
apiV1Router.use('/service-area', serviceAreaRoutes);  // Service area and location validation
apiV1Router.use('/payments', paymentRoutes);

// Test routes (development only)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_TEST_ROUTES === 'true') {
  const testRoutes = require('./server/routes/testRoutes');
  apiV1Router.use('/test', testRoutes);
}
apiV1Router.use('/quickbooks', quickbooksRoutes);  // QuickBooks export functionality

// Paygistix callback route (directly under /api/v1 for the callback)
apiV1Router.use('/payment_callback', require('./server/routes/generalPaymentCallback'));

// Environment endpoint
apiV1Router.get('/environment', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    enableDeleteDataFeature: process.env.ENABLE_DELETE_DATA_FEATURE === 'true'
  });
});


// Monitoring routes - use /monitoring/status instead of /api/monitoring/status
const monitoringModule = require('./server/monitoring/connectivity-monitor');
app.get('/monitoring/status', (req, res) => {
  try {
    const status = monitoringModule.getMonitoringStatus();
    res.json(status);
  } catch (error) {
    logger.error('Monitoring status error:', error);
    res.status(500).json({ error: 'Failed to get monitoring status' });
  }
});

// Mount versioned API
app.use('/api/v1', apiV1Router);

// Legacy support - redirect unversioned API calls to v1
app.use('/api', (req, res, next) => {
  if (!req.path.match(/^\/v\d+\//)) {
    req.url = `/v1${req.path}`;
  }
  next();
}, apiV1Router);

// Admin routes with CSRF
app.get('/admin/*', (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.redirect('/api-docs.html');
});

// Root endpoint - API server info
app.get('/', (req, res) => {
  res.json({
    name: 'WaveMAX Affiliate Program API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      docs: '/api/docs',
      auth: '/api/v1/auth',
      affiliates: '/api/v1/affiliates',
      customers: '/api/v1/customers',
      orders: '/api/v1/orders'
    },
    timestamp: new Date().toISOString()
  });
});

// Direct routes for legal pages (for Google and external access)
app.get('/terms-of-service', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms-and-conditions.html'));
});

app.get('/terms-and-conditions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms-and-conditions.html'));
});

app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

// Franchisee landing page route
app.get('/franchisee-landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'franchisee-landing.html'));
});

// Block common WordPress scanning paths
app.use((req, res, next) => {
  const blockedPaths = [
    '/wp-admin',
    '/wp-login',
    '/wp-content',
    '/wp-includes',
    '/wordpress',
    '.php',
    'wp-',
    'xmlrpc',
    'wlwmanifest'
  ];

  const isBlocked = blockedPaths.some(path =>
    req.path.toLowerCase().includes(path)
  );

  if (isBlocked) {
    // Return 404 to discourage scanners
    return res.status(404).json({
      success: false,
      message: 'Not found'
    });
  }

  next();
});

// Catch all other routes and return API error
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.path,
    method: req.method,
    hint: 'Check the API documentation at /api/docs'
  });
});

app.use(errorHandler);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// Start server (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    
    // Start connectivity monitoring
    const { startMonitoring } = require('./server/monitoring/connectivity-monitor');
    startMonitoring();
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't crash the server in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

module.exports = app;