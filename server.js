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
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Import middleware
const { mongoSanitize, sanitizeRequest } = require('./server/middleware/sanitization');

// Import routes
const authRoutes = require('./server/routes/authRoutes');
const affiliateRoutes = require('./server/routes/affiliateRoutes');
const customerRoutes = require('./server/routes/customerRoutes');
const orderRoutes = require('./server/routes/orderRoutes');
const bagRoutes = require('./server/routes/bagRoutes');
const affiliateController = require('./server/controllers/affiliateController');
const customerController = require('./server/controllers/customerController');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

const logger = require('./server/utils/logger');

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

// Connect to MongoDB with consistent options
mongoose.connect(process.env.MONGODB_URI, mongoOptions)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch(err => {
    logger.error('MongoDB connection error:', { error: err.message });
    process.exit(1);
  });

// Middleware
// HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', 'https://cdnjs.cloudflare.com'],
      styleSrc: ['\'self\'', 'https://cdnjs.cloudflare.com', '\'unsafe-inline\''], // unsafe-inline needed for Tailwind
      imgSrc: ['\'self\'', 'data:', 'https://www.wavemax.promo'],
      connectSrc: ['\'self\''],
      fontSrc: ['\'self\'', 'https://cdnjs.cloudflare.com'],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'none\'']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
  frameguard: { action: 'deny' }
}));

// CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:3000'];

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Setup session middleware - add this after other middleware like helmet, cors, etc.
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files in all environments
app.use(express.static(path.join(__dirname, 'public')));

// Set up CSRF protection using sessions instead of cookies
const csrf = require('csurf');
const csrfProtection = csrf({
  cookie: false // Use req.session instead of cookies
});

// CSRF excluded paths - only public endpoints that don't require authentication
const csrfExcludedPaths = [
  '/api/auth/affiliate/login',
  '/api/auth/customer/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh-token',
  '/api/affiliates/register',
  '/api/customers/register',
  '/api/affiliates/:affiliateId/public',
  '/api/customers/:customerId/profile',
  // Also include versioned API paths
  '/api/v1/auth/affiliate/login',
  '/api/v1/auth/customer/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh-token',
  '/api/v1/affiliates/register',
  '/api/v1/customers/register',
  '/api/v1/affiliates/:affiliateId/public',
  '/api/v1/customers/:customerId/profile'
];

// Apply CSRF conditionally
const conditionalCsrf = (req, res, next) => {
  // Check if path is excluded
  const isExcluded = csrfExcludedPaths.some(path => {
    if (path.includes(':')) {
      const regex = new RegExp('^' + path.replace(/:[^/]+/g, '[^/]+') + '$');
      return regex.test(req.path);
    }
    return req.path === path;
  });

  // Skip CSRF for excluded paths and GET requests
  if (isExcluded || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Apply CSRF protection for all other routes
  csrfProtection(req, res, next);
};

// Apply conditional CSRF to all routes
app.use(conditionalCsrf);

// CSRF token endpoint - ensure session exists before generating token
app.get('/api/csrf-token', (req, res, next) => {
  // Initialize session if it doesn't exist
  if (!req.session) {
    return res.status(500).json({ error: 'Session not initialized' });
  }

  // Apply CSRF protection and generate token
  csrfProtection(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate CSRF token' });
    }
    res.json({ csrfToken: req.csrfToken() });
  });
});

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

// API Routes with versioning
const apiV1Router = express.Router();

// Mount v1 routes
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/affiliates', affiliateRoutes);
apiV1Router.use('/customers', customerRoutes);
apiV1Router.use('/orders', orderRoutes);
apiV1Router.use('/bags', bagRoutes);

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

// Serve the frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

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

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't crash the server in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

module.exports = app;