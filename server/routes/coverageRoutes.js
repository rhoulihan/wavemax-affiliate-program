// Coverage Analysis Report Routes
// This route is separate from the embedded app and only accessible directly

const express = require('express');
const router = express.Router();
const path = require('path');

// Middleware to prevent access from embedded contexts
const preventEmbeddedAccess = (req, res, next) => {
  // Check if request is coming from an iframe
  const referer = req.get('Referer');
  const isEmbedded = req.get('Sec-Fetch-Dest') === 'iframe' ||
                     req.get('X-Frame-Options') ||
                     (referer && referer.includes('/embed'));

  if (isEmbedded) {
    return res.status(403).json({
      success: false,
      message: 'Coverage reports cannot be accessed from embedded contexts'
    });
  }

  // Add X-Frame-Options to prevent embedding of coverage reports
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

// Simple access control - only allow in development/test environments or with secret key
const accessControl = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const hasSecretKey = req.query.key === process.env.COVERAGE_ACCESS_KEY;

  if (!isDevelopment && !hasSecretKey) {
    return res.status(403).send(`
      <html>
        <head>
          <title>Access Denied</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f5f5f5;
            }
            .error-container {
              text-align: center;
              padding: 40px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #dc2626; }
            p { color: #666; }
            code { 
              background: #f3f4f6; 
              padding: 2px 6px; 
              border-radius: 4px;
              font-size: 0.9em;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Access Denied</h1>
            <p>Coverage reports are only available in development environment.</p>
            <p>To access in production, add <code>?key=YOUR_SECRET_KEY</code> to the URL.</p>
          </div>
        </body>
      </html>
    `);
  }

  next();
};

// Apply middleware to all coverage routes
router.use(preventEmbeddedAccess);
router.use(accessControl);

// Serve the coverage analysis directory
router.use('/', express.static(path.join(__dirname, '../../public/coverage-analysis'), {
  index: 'index.html',
  setHeaders: (res, path) => {
    // Prevent caching for fresh reports
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Handle specific page routes
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/coverage-analysis/index.html'));
});

router.get('/critical-files', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/coverage-analysis/critical-files.html'));
});

router.get('/test-templates', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/coverage-analysis/test-templates.html'));
});

router.get('/action-plan', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/coverage-analysis/action-plan.html'));
});

// Catch-all for 404s within coverage routes
router.use((req, res) => {
  res.status(404).send(`
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .error-container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 { color: #1e3a8a; }
          a { 
            color: #3b82f6; 
            text-decoration: none;
            font-weight: bold;
          }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>Page Not Found</h1>
          <p>The coverage report page you're looking for doesn't exist.</p>
          <p><a href="/coverage">← Back to Coverage Overview</a></p>
        </div>
      </body>
    </html>
  `);
});

module.exports = router;