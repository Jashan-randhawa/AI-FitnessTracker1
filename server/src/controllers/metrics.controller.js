/**
 * Metrics Controller
 * Exposes Prometheus exposition format at /metrics for scraper probes (e.g., Prometheus / Datadog / Grafana Agent).
 */

const crypto = require('crypto');
const metrics = require('../utils/metrics');

const timingSafeMatch = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const getMetrics = (req, res) => {
  const configuredToken = process.env.METRICS_TOKEN;

  if (configuredToken) {
    const authHeader = req.headers.authorization || '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const tokenFromQuery = req.query.token;

    const matchesHeader = tokenFromHeader ? timingSafeMatch(tokenFromHeader, configuredToken) : false;
    const matchesQuery = tokenFromQuery ? timingSafeMatch(tokenFromQuery, configuredToken) : false;

    if (!matchesHeader && !matchesQuery) {
      return res.status(401).send('# Unauthorized metrics access\n');
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(503).send('# Metrics endpoint disabled in production: METRICS_TOKEN not configured\n');
  }

  const output = metrics.getPrometheusFormat();
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(output);
};

module.exports = {
  getMetrics,
};
