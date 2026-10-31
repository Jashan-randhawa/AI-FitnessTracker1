const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const routes = require('./routes');
const requestId = require('./middleware/requestId');
const httpLogger = require('./middleware/httpLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxy (e.g. Render, Heroku) so req.ip and express-rate-limit work properly
app.set('trust proxy', 1);

// Assign request ID header and property early in request lifecycle
app.use(requestId);
app.use(httpLogger);

// HTTP security headers with cross-origin resource policy enabled.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Configures CORS for known client origins, plus CLIENT_URL from env so
// a deployed frontend origin can be added without editing code.
const allowedOrigins = [
  'https://ai-fitness-tracker1.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header, e.g. curl/Postman/OAuth redirects)
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();
      const isAllowed = allowedOrigins.some(
        (allowed) => allowed.replace(/\/$/, '').toLowerCase() === normalizedOrigin
      );
      if (isAllowed) return callback(null, true);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Request-Id', 'X-Timezone', 'Idempotency-Key', 'X-Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'X-Next-Cursor', 'Idempotency-Replayed', 'X-Conflict', 'Retry-After'],
  })
);

// JSON body limit generous enough for chat payloads and base64 image uploads (4MB raw = ~5.33MB base64)
app.use(express.json({ limit: '7mb' }));
app.use(express.urlencoded({ extended: true, limit: '7mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'AI Fitness Tracker API' });
});

app.get('/api/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  const isHealthy = dbState === 1 || process.env.NODE_ENV === 'test';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

app.use(require('./routes/metrics.routes'));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
