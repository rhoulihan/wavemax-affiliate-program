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
const affiliateScheduleRoutes = require('./server/routes/affiliateScheduleRoutes');
const customerRoutes = require('./server/routes/customerRoutes');
const orderRoutes = require('./server/routes/orderRoutes');
const administratorRoutes = require('./server/routes/administratorRoutes');
const operatorRoutes = require('./server/routes/operatorRoutes');
const monitoringRoutes = require('./server/routes/monitoringRoutes');
const systemConfigRoutes = require('./server/routes/systemConfigRoutes');
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
  // Do NOT auto-build schema indexes on connect. The Oracle Autonomous DB
  // MongoDB API rejects 2dsphere (geospatial) and TTL index builds, so an
  // autoIndex pass would throw on the Affiliate serviceLocation 2dsphere
  // index at startup. Indexes are managed explicitly (the migration creates
  // the Oracle-compatible set). Disabling autoIndex is also standard practice
  // for production regardless of backend.
  autoIndex: false,
  // TLS enforced everywhere except local dev. Set MONGODB_TLS=false to
  // disable (e.g. plain local mongod that doesn't speak TLS).
  ...(process.env.MONGODB_TLS === 'false'
    ? {}
    : {
      tls: true,
      tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
    })
};

// Connect to MongoDB with consistent options (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGODB_URI, mongoOptions)
    .then(async () => {
      logger.info('Connected to MongoDB');

      // Warm the access-gate whitelist/password cache + start periodic refresh.
      const gate = require('./server/middleware/accessGate');
      gate.loadCache().then(() => gate.startCacheRefresh())
        .catch((e) => logger.error('Access gate cache init failed:', e.message));

      // Initialize system configuration defaults
      try {
        const SystemConfig = require('./server/models/SystemConfig');
        await SystemConfig.initializeDefaults();
        logger.info('System configuration defaults initialized');

        const paymentVerificationJob = require('./server/jobs/paymentVerificationJob');
        await paymentVerificationJob.start();
        logger.info('Payment verification job started');
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
  // 'strict-origin-when-cross-origin' is the modern default — sends full
  // URL on same-origin, origin only on cross-origin HTTPS→HTTPS, nothing
  // on HTTPS→HTTP downgrade. Tighter than the previous 'same-origin' which
  // sent full URL (including query) to internal log sinks on same-origin
  // navigation. APP-002 / prod-lockdown-2026-05-20.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
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

  // X-Frame-Options — belt-and-suspenders alongside the CSP
  // frame-ancestors directive (modern browsers honor frame-ancestors and
  // ignore XFO, but XFO catches older browsers + legacy security
  // scanners and observability tools that grade this control literally).
  // SAMEORIGIN matches the CSP frame-ancestors allowlist semantics for
  // the routes that aren't explicitly listed by the franchisor for
  // embedding (wavemaxlaundry.com is already whitelisted via the CSP
  // frame-ancestors directive, which a browser will prefer over XFO).
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Cross-Origin-Opener-Policy. Helmet's default is 'same-origin' which
  // would break the OAuth popup flow (popup needs to postMessage back to
  // opener after provider returns). 'same-origin-allow-popups' keeps the
  // opener-isolation against reverse window.opener abuse from cross-origin
  // CHILD pages while still allowing same-origin popups to retain a
  // reference. APP-003 / prod-lockdown-2026-05-20.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // Clear-Site-Data header for logout endpoints
  if (req.path.includes('/logout')) {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  // Override CORS and resource policy for parent bridge script. Franchise
  // host pages on wavemaxlaundry.com (or any other parent domain) load
  // the bridge from wavemax.promo and need cross-origin permission.
  if (req.path === '/assets/js/parent-iframe-bridge-v3.js') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  // Allow public static assets (images, CSS, JS, fonts, locales) to be
  // embedded by pages on other origins. LOCATION_DATA holds absolute URLs
  // pointing at wavemax.promo's /assets/ tree; without this the per-
  // location domains (atxwashateria.com, etc.) fail with
  // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin even when the request itself
  // returns 200. Helmet's default Cross-Origin-Resource-Policy is
  // 'same-origin' so we override here for the asset path tree.
  if (req.path.startsWith('/assets/') || req.path.startsWith('/locales/')) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
    '/embed-app-v2.html',
    '/operator-login-store.html',
    '/affiliate-register-embed.html',
    '/affiliate-login-embed.html',
    '/affiliate-dashboard-embed.html',
    '/customer-register-embed.html',
    '/customer-login-embed.html',
    '/customer-dashboard-embed.html',
    '/forgot-password-embed.html',
    '/reset-password-embed.html',
    '/site-page-content-only.html',
    // Austin franchisee content surfaces — embed pages have zero inline
    // executable scripts after the 2026-05-20 sweep that converted the
    // off-screen `style="position:absolute…"` attrs to .wm-sr-only.
    '/austin-landing-v3-embed.html',
    '/contact-embed.html',
    '/wash-dry-fold-embed.html',
    '/self-serve-laundry-embed.html',
    '/commercial-embed.html',
    '/about-us-embed.html'
  ];

  // Apply strict CSP to documentation pages as well (but not examples)
  const isDocumentationPage = req.path.startsWith('/docs/') &&
                             req.path.endsWith('.html') &&
                             !req.path.includes('/examples/');

  // Apply strict CSP to franchise-host renders (/<slug>/ and
  // /<slug>/<page> routes served by franchiseController). Enabled
  // 2026-05-20 after the SEC L-1/L-2 sweep replaced inline-style
  // mutations in austin-host-mock.js (modal scroll lock + search
  // filter) and corporate-locations-modal.js with the .wm-noscroll /
  // .wm-hidden class-toggle utilities. The controller's
  // FRANCHISE_DATA_INJECTION inline script already carries the
  // per-request nonce. Pattern: single-segment slug or slug + page,
  // lowercase + digits + hyphens, no dots (i.e. not a static-file
  // request like .html or .js).
  const isFranchiseHostPage = /^\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?\/?$/.test(req.path)
                              && !req.path.startsWith('/api/')
                              && !req.path.startsWith('/assets/')
                              && !req.path.startsWith('/locales/')
                              && !req.path.startsWith('/docs/')
                              && !req.path.startsWith('/dev/');

  const useStrictCSP = strictCSPPages.includes(req.path) || isDocumentationPage || isFranchiseHostPage;
  
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
      'https://code.jquery.com',
      'https://www.local-marketing-reports.com',
      // reports.hibu.com used to be in this list when the page loaded
      // Hibu's ybDynamicPhoneInsertion.js cross-origin. We now self-host
      // a snapshot at /assets/vendor/ybDynamicPhoneInsertion.js (refreshed
      // every 12h by scripts/ops/refresh-hibu.sh) so the origin is no
      // longer needed in script-src.
      'https://static.cloudflareinsights.com',
      // Google Maps JS API loader + bootstrap (locations modal)
      'https://maps.googleapis.com',
      // Hibu Social retargeting — Meta Pixel loader (connect.facebook.net/
      // en_US/fbevents.js), injected by public/assets/js/austin-fb-pixel.js.
      // Marketing chrome only (franchise-host.html), never the app pages.
      'https://connect.facebook.net'
    ],
    'style-src': [
      "'self'",
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
      'https://fonts.googleapis.com',
      'https://stackpath.bootstrapcdn.com'
    ],
    'img-src': ["'self'", 'data:', 'https://wavemax.promo', 'https://www.wavemax.promo', 'https://atxwashateria.com', 'https://atxwashdryfold.com', 'https://runberglaundry.com', 'https://rundberglaundry.com', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org', 'https://cdnjs.cloudflare.com', 'https://flagcdn.com', 'https://secure.walibu.com', 'https://upload.wikimedia.org', 'https://*.googleusercontent.com', 'https://maps.googleapis.com', 'https://maps.gstatic.com', 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://www.facebook.com'],
    'connect-src': ["'self'", 'https://wavemax.promo', 'https://atxwashateria.com', 'https://atxwashdryfold.com', 'https://runberglaundry.com', 'https://rundberglaundry.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://stackpath.bootstrapcdn.com', 'https://router.project-osrm.org', 'https://graphhopper.com', 'https://api.openrouteservice.org', 'https://valhalla1.openstreetmap.de', 'https://nominatim.openstreetmap.org', 'https://www.local-marketing-reports.com', 'https://places.googleapis.com', 'https://maps.googleapis.com', 'https://maps.gstatic.com', 'https://connect.facebook.net', 'https://www.facebook.com'],
    'font-src': ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://my.matterport.com'],
    'form-action': ["'self'", 'https://safepay.paymentlogistics.net'],
    'frame-ancestors': ["'self'", 'https://www.wavemaxlaundry.com', 'https://wavemaxlaundry.com'],
    'base-uri': ["'self'"],
    'child-src': ["'none'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"]
  };
  
  // CSP3 quirk: when a nonce is present in a directive, `'unsafe-inline'`
  // is silently ignored for that directive — even for JS-driven inline
  // style mutations like `el.style.display = 'block'`. The language
  // switcher dropdown toggles inline display, and the self-hosted Hibu
  // analytics loader rewrites body.innerHTML which forces the browser to
  // re-evaluate every inline `style="..."` attribute against style-src.
  // Both legitimately need inline styles. We keep the strict script-src
  // (that's the XSS-relevant directive) but always allow 'unsafe-inline'
  // on style-src — the CSS-injection threat model is materially weaker
  // than JS injection, and gating styles by class-toggle would require
  // forking Hibu's script.
  if (!skipNonce && nonce) {
    directives['script-src'].push(`'nonce-${nonce}'`);
    // Intentionally NOT adding the nonce to style-src: the CSP3 quirk
    // above would then silently kill 'unsafe-inline' for styles.
  }
  directives['style-src'].push("'unsafe-inline'");

  // Add unsafe-inline for non-migrated pages (script-src only — style-src
  // is already permissive above).
  if (!useStrictCSP) {
    directives['script-src'].push("'unsafe-inline'");
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
      'https://wavemax.promo', // Add our own domain for iframe same-origin
      // Per-location domains that proxy the Austin franchise content
      'https://atxwashateria.com',
      'https://atxwashdryfold.com',
      'https://runberglaundry.com',
      'https://rundberglaundry.com'
    ];

    const allAllowedOrigins = [...allowedOrigins, ...wavemaxDomains];

    // H-7 / prod-lockdown-2026-05-20: previously this branch returned
    // callback(null, true), admitting any null-origin request (curl,
    // Postman, server-to-server) with credentials:true cookie clearance.
    // The only legitimate consumers of /api are browsers (allowlisted via
    // wavemaxDomains) and authenticated bots that present a JWT — neither
    // depends on permissive null-origin CORS. Reject by default; explicit
    // server-to-server callers can identify themselves by other means
    // (mTLS, signed webhook, allowlisted IP).
    if (!origin) return callback(null, false);

    if (allAllowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // CORS rejection should be CLEAN — callback(null, false) makes the
      // cors middleware respond 204/200 without CORS headers, leaving the
      // browser to reject the cross-origin request itself. Throwing here
      // surfaces as a 500 with a server stack trace in the JSON body,
      // which (a) is the wrong HTTP semantic for a CORS rejection, and
      // (b) leaks server-side paths + impl details via the error handler.
      // The actual CORS protection is identical either way (no
      // Access-Control-Allow-Origin returned), but the cleaner response
      // is 204 with no body.
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
// cookie-parser is required by csrf-csrf (SEC M-5 migration) so it can
// read its double-submit cookie from req.cookies.
app.use(require('cookie-parser')());

// Sanitization middleware
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(sanitizeRequest); // Sanitize all inputs for XSS prevention

// Compression for all responses
app.use(compression());

// Access gate — password-protects ALL web traffic to the Express-served
// domains unless the client IP is whitelisted. No-op unless
// ACCESS_GATE_ENABLED=true, so it deploys dark; mounted here so it fronts
// every route and has body+cookie parsing (above) for the password POST,
// but runs before the API rate limiter and session creation.
const accessGate = require('./server/middleware/accessGate');
app.use(accessGate);

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
    touchAfter: 24 * 3600, // Lazy session update in seconds (24 hours)
    // Purge expired sessions with a periodic deleteMany rather than a Mongo
    // TTL index. The Oracle ADB MongoDB API rejects TTL index creation unless
    // the schema holds CREATE JOB, and connect-mongo's default
    // autoRemove:'native' throws an unhandled rejection on connect there
    // (crash-loops startup). 'interval' performs cleanup with a plain query
    // Oracle supports; session validity is also enforced on read via the
    // `expires` field, so correctness never depended on the TTL sweep.
    autoRemove: 'interval',
    autoRemoveInterval: 10 // minutes
  });

// __Host- prefix in production: enforces Secure + Path=/ + no Domain
// attribute, blocking sub-domain cookie injection. In dev/test we keep
// the bare name because __Host- requires Secure which we only set in
// prod. APP-009 / prod-lockdown-2026-05-20.
const sessionCookieName = process.env.NODE_ENV === 'production'
  ? '__Host-wavemax.sid'
  : 'wavemax.sid';

app.use(session({
  name: sessionCookieName,
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

// Location quarantine — lock deployment down to Austin + affiliate-program
// app. Activated by env var QUARANTINE_NON_AUSTIN=true. Mounted here so it
// runs before all route handlers and static middleware, redirecting any
// non-Austin/non-app request to the corporate site (wavemaxlaundry.com).
// No-op when the env var is unset/false.
const locationQuarantine = require('./server/middleware/locationQuarantine');

// IMPORTANT ORDERING — these two handlers must run BEFORE
// locationQuarantine. The quarantine middleware redirects any request
// it doesn't recognize as Austin/app content to www.wavemaxlaundry.com.
// Without an explicit short-circuit for these paths, our security.txt
// route and sensitive-path 404 handler are bypassed and the responses
// turn into 302s back to the franchisor's domain (which itself 404s,
// producing the broken-redirect chain the comparative audit flagged).

// .well-known/security.txt — RFC 9116 disclosure policy.
// Explicit route because Express's serve-static ignores dotfiles by
// default (and globally allowing dotfiles would expose other dot-paths
// we don't want public).
app.get('/.well-known/security.txt', (req, res) => {
  res.type('text/plain').sendFile(path.join(__dirname, 'public', '.well-known', 'security.txt'));
});

// Explicit 404s for common sensitive-path probes — closes the 302 leak
// the comparative audit flagged. Files are not exposed either way; this
// just produces the clean response semantic scanners and audit tools
// expect. List intentionally short — common scanner targets only.
const sensitiveProbePaths = [
  '/.env', '/.env.local', '/.env.production',
  '/.git', '/.git/config', '/.git/HEAD',
  '/.svn', '/.svn/entries',
  '/.DS_Store',
  '/package.json', '/package-lock.json',
  '/Dockerfile', '/docker-compose.yml',
  '/composer.json', '/composer.lock',
  '/yarn.lock'
];
app.use((req, res, next) => {
  if (sensitiveProbePaths.includes(req.path)) {
    return res.status(404).type('text/plain').send('Not Found');
  }
  next();
});

// NOW the quarantine — runs after the two early-route handlers above.
app.use(locationQuarantine);

// Mount embed routes with CSP nonce support BEFORE static file serving
const embedRoutes = require('./server/routes/embedRoutes');

app.use('/', embedRoutes);


// Mount monitoring dashboard BEFORE static files for CSP nonce injection
app.use('/monitoring', monitoringRoutes);

// Handle direct monitoring-dashboard.html path
app.get('/monitoring-dashboard.html', (req, res) => {
  res.redirect('/monitoring/');
});


// ─── Austin reference build: server-rendered config ────────────────
// Provides the Google Places API key + Place ID to the browser without
// committing them to source control. The browser-direct call to the
// Places API needs the key in the page; key abuse is bounded by HTTP
// referrer restrictions configured on the key in Google Cloud Console
// (wavemax.promo, *.wavemax.promo, and localhost only). Both values
// are read from process.env so we can rotate by editing .env + pm2
// restart, without redeploying or touching public/.
//
// The URL deliberately lives under /api/ and has no .js extension —
// Cloudflare's default cache rules ignore /api/* AND don't auto-cache
// extensionless paths, so a key rotation hits browsers immediately.
// The HTML loads it with <script src="..."> + the Content-Type below.
app.get('/api/austin-tx/places-config', (req, res) => {
  const apiKey  = (process.env.GOOGLE_PLACES_API_KEY  || '').replace(/['"\\\n\r]/g, '');
  const placeId = (process.env.GOOGLE_PLACES_LOCATION_PLACE_ID || '').replace(/['"\\\n\r]/g, '');
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  // Belt-and-suspenders no-cache: standard Cache-Control + the
  // Cloudflare-specific cdn-cache-control directive so neither origin
  // browser cache nor any intermediate CDN layer holds this.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('CDN-Cache-Control', 'no-store');
  res.set('Cloudflare-CDN-Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.send(
    "/* Server-rendered. Reads from process.env at request time. */\n" +
    "(function () {\n" +
    "  'use strict';\n" +
    "  window.GOOGLE_PLACES_API_KEY = window.GOOGLE_PLACES_API_KEY || '" + apiKey + "';\n" +
    "  window.LOCATION_PLACE_ID     = window.LOCATION_PLACE_ID     || '" + placeId + "';\n" +
    "})();\n"
  );
});

// Legacy URL redirect: /dev/austin-host-mock.html?route=/path → /austin-tx/path/
// The /dev/ page was the pre-resolver demo; production URLs now live at
// /<slug>/. Mounted BEFORE the static middleware so the file isn't served
// instead.
app.get('/dev/austin-host-mock.html', (req, res, next) => {
  const r = (req.query.route || '/').toString();
  // Sanity-check: must start with / and contain only slug-safe chars,
  // otherwise fall through to static (or just 404).
  if (!/^\/[a-z0-9/_-]*$/i.test(r)) return next();
  const tail = r === '/' ? '' : r.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
  // Preserve any other query params (e.g. ?lang=es), drop the route one.
  const qs = new URLSearchParams(req.query);
  qs.delete('route');
  const queryString = qs.toString();
  res.redirect(301, `/austin-tx/${tail}${queryString ? '?' + queryString : ''}`);
});

// Serve static files in all environments
app.use(express.static(path.join(__dirname, 'public')));

// Serve documentation if enabled
if (process.env.SHOW_DOCS === 'true') {
  const docsRoutes = require('./server/routes/docsRoutes');
  app.use('/docs', docsRoutes);
}

// Coverage routes are mounted earlier, before static files

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

// Franchise registry listing — drives the /locations/ finder UI on the
// corporate clone. Mounted under /api/v1/ so the legacy /api → /api/v1
// rewrite covers it too.
apiV1Router.get('/franchises', require('./server/controllers/franchiseController').listFranchises);

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
apiV1Router.use('/affiliates', affiliateScheduleRoutes);  // Affiliate schedule management
apiV1Router.use('/customers', customerRoutes);
apiV1Router.use('/orders', orderRoutes);
apiV1Router.use('/administrators', administratorRoutes);
apiV1Router.use('/operators', operatorRoutes);
apiV1Router.use('/system/config', systemConfigRoutes);
apiV1Router.use('/service-area', serviceAreaRoutes);  // Service area and location validation
apiV1Router.use('/location', require('./server/routes/locationRoutes'));  // Per-location reads (reviews, etc.)
apiV1Router.use('/contact', require('./server/routes/contactRoutes'));  // Per-location contact-form submissions
apiV1Router.use('/', require('./server/routes/corporateInquiryRoutes'));  // /corporate-contact + /franchise-lead
apiV1Router.use('/', require('./server/routes/mapsConfigRoute'));  // /maps-config — Maps API key for corporate pages
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

// Corporate-level pages — Phase 5c clone. These live on top-level paths
// like /franchise, /about/, etc. and are static V3-styled marketing
// pages with no per-franchise data. Mounted BEFORE the slug router so
// these top-level slugs don't get picked up as (nonexistent) franchise slugs.
app.get('/', (req, res) => {
  res.redirect(302, '/franchise/');
});
app.get(['/franchise', '/franchise/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'franchise.html'));
});
app.get(['/become-a-franchisee', '/become-a-franchisee/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'become-a-franchisee.html'));
});
app.get(['/about', '/about/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});
app.get(['/testimonials', '/testimonials/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'testimonials.html'));
});
app.get(['/why-invest-in-wavemax', '/why-invest-in-wavemax/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'why-invest-in-wavemax.html'));
});
app.get(['/wavemax-vs-zombiemat', '/wavemax-vs-zombiemat/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wavemax-vs-zombiemat.html'));
});
app.get(['/virtual-tour', '/virtual-tour/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'virtual-tour.html'));
});
app.get(['/faq', '/faq/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'faq.html'));
});
app.get(['/contact', '/contact/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});
app.get(['/laundromat-investment-guide', '/laundromat-investment-guide/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'laundromat-investment-guide.html'));
});

// Per-franchise dynamic routes — Phase 5a. Mounted AFTER /api/* and the
// static middleware so unknown slugs fall through to a 404 instead of
// shadowing real asset paths. The controller's registry-lookup gate is
// the slug allowlist; anything not in /public/data/franchises/ calls
// next() and Express returns the standard 404.
app.use('/', require('./server/routes/franchiseRoutes'));

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

// Per-hostname robots.txt and sitemap.xml. Each managed host serves its
// own — required for self-canonical multi-domain SEO. Hosts that aren't
// in the override map fall back to a generic robots that allows everything
// and points to wavemax.promo's sitemap.
app.get('/robots.txt', (req, res) => {
  const host = (req.hostname || 'wavemax.promo').toLowerCase().replace(/^www\./, '');
  res.type('text/plain');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /api/\n` +
    `Disallow: /admin/\n` +
    `Disallow: /embed-app-v2.html\n` +
    `Disallow: /monitoring/\n` +
    `\n` +
    `Sitemap: https://${host}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const host = (req.hostname || 'wavemax.promo').toLowerCase().replace(/^www\./, '');
  const { isManagedHost } = require('./server/config/domainSeoOverrides');
  const now = new Date().toISOString().slice(0, 10);

  // rundberglaundry.com is the primary domain — its sitemap lists every
  // Austin page so Google indexes the full site. The three sister domains
  // each target a single query and ship a minimal sitemap (apex only).
  // wavemax.promo is locked down (everything 301s to rundberglaundry),
  // so its sitemap points at rundberglaundry.
  const urls = [];
  if (host === 'rundberglaundry.com') {
    urls.push(
      { loc: `https://${host}/`,                                priority: '1.0' },
      { loc: `https://${host}/austin-tx/wash-dry-fold/`,         priority: '0.9' },
      { loc: `https://${host}/austin-tx/self-serve-laundry/`,    priority: '0.9' },
      { loc: `https://${host}/austin-tx/commercial/`,            priority: '0.8' },
      { loc: `https://${host}/austin-tx/about-us/`,              priority: '0.7' },
      { loc: `https://${host}/austin-tx/contact/`,               priority: '0.7' }
    );
  } else if (host === 'atxwashdryfold.com') {
    // Apex deep-links to the WDF page — list it as canonical.
    urls.push(
      { loc: `https://${host}/`,                            priority: '1.0' },
      { loc: `https://${host}/austin-tx/wash-dry-fold/`,    priority: '0.9' }
    );
  } else if (isManagedHost(host)) {
    // atxwashateria.com, runberglaundry.com — apex only.
    urls.push({ loc: `https://${host}/`, priority: '1.0' });
  } else {
    // wavemax.promo (or unknown host) — redirect target.
    urls.push({ loc: 'https://rundberglaundry.com/', priority: '1.0' });
  }

  res.type('application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, priority }) => (
      `  <url><loc>${loc}</loc><lastmod>${now}</lastmod><priority>${priority}</priority></url>`
    )),
    '</urlset>'
  ].join('\n');
  res.send(body);
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

app.get('/refund-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'refund-policy.html'));
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

// Central error handler (server/middleware/errorHandler.js). This is the
// single, final error-handling middleware. A second duplicate handler used
// to live here; with errorHandler already responding, the duplicate only
// ever ran when errorHandler itself threw ERR_HTTP_HEADERS_SENT, producing a
// second throw and escalating to an uncaughtException. Removed 2026-05-21.
app.use(errorHandler);

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