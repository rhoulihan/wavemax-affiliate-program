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
// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://www.wavemax.promo"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' }
}));

// CORS setup
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
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

// Set up CSRF protection
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Create API routes that need CSRF protection
// Auth routes don't need CSRF for login endpoints
app.use('/api/auth', authRoutes);
app.post('/api/affiliates/register', affiliateController.registerAffiliate);
// Add public affiliate info route without CSRF protection
app.get('/api/affiliates/:affiliateId/public', affiliateController.getPublicAffiliateInfo);
// Customer registration needs to work without CSRF for now
app.post('/api/customers/register', customerController.registerCustomer);
app.use('/api/affiliates', csrfProtection, affiliateRoutes);
app.use('/api/customers', csrfProtection, customerRoutes);
app.use('/api/orders', csrfProtection, orderRoutes);
app.use('/api/bags', csrfProtection, bagRoutes);

// For routes that render templates and need CSRF tokens, use csrfProtection middleware
app.get('/admin/*', csrfProtection, (req, res, next) => {
  // Set CSRF token for templates
  res.locals.csrfToken = req.csrfToken();
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