const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Roughly equivalent to Strapi's `strapi::security` middleware.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Matches the exact origins/methods/headers from the original
// config/middlewares.ts `strapi::cors` entry, plus CLIENT_URL from env so
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
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  })
);

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// JSON body limit generous enough for chat history payloads; image uploads
// go through multer separately (see middleware/upload.js) and aren't
// affected by this limit.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'AI Fitness Tracker API' });
});
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
