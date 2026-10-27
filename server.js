/**
 * BetBook Standalone & Local Development Server
 * ---------------------------------------------
 * Runs the backend API routes with MongoDB Atlas and serves public/ static files.
 * Zero external web framework dependencies needed — runs directly on Node.js!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple .env parser if not already loaded by Node
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

// Set sensible defaults if missing
if (!process.env.ADMIN_NAME) process.env.ADMIN_NAME = 'naveen';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'betbook-secret-jwt-key-minimum-32-chars-long-xyz123!';
if (!process.env.ADMIN_SETUP_CODE) process.env.ADMIN_SETUP_CODE = 'naveen123';

// Load API handlers
const authHandler = require('./api/auth');
const dataHandler = require('./api/data');
const adminHandler = require('./api/admin');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Augment request with parsed query
  req.query = parsedUrl.query || {};

  // Augment response with helper methods
  res.status = function (statusCode) {
    this.statusCode = statusCode;
    return this;
  };

  res.json = function (data) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(data));
  };

  // Helper to parse JSON body
  async function parseBody() {
    return new Promise((resolve) => {
      if (['GET', 'HEAD'].includes(req.method)) {
        return resolve({});
      }
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
        if (bodyStr.length > 2e6) req.destroy(); // 2MB limit
      });
      req.on('end', () => {
        try {
          resolve(bodyStr ? JSON.parse(bodyStr) : {});
        } catch (e) {
          resolve({});
        }
      });
    });
  }

  // 1. API Route Dispatcher
  if (pathname.startsWith('/api/')) {
    req.body = await parseBody();

    try {
      if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
        return await authHandler(req, res);
      } else if (pathname === '/api/data' || pathname.startsWith('/api/data/')) {
        return await dataHandler(req, res);
      } else if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
        return await adminHandler(req, res);
      } else {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
    } catch (err) {
      console.error('Server error handling API request:', err);
      return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
  }

  // 2. Static File Serving from public/
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Normalize path to prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routes
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 404;
        return res.end('File not found');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  BetBook is running at: http://localhost:${PORT}`);
  console.log(`  Database URI: ${process.env.MONGODB_URI ? 'Configured (MongoDB Atlas)' : 'MISSING MONGODB_URI in .env'}`);
  console.log(`==================================================\n`);
});
