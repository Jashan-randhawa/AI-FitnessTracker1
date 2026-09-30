/**
 * Metrics Controller
 * Exposes Prometheus exposition format at /metrics for scraper probes (e.g., Prometheus / Datadog / Grafana Agent).
 */

const metrics = require('../utils/metrics');

const getMetrics = (req, res) => {
  const configuredToken = process.env.METRICS_TOKEN;

  if (configuredToken) {
    const authHeader = req.headers.authorization || '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const tokenFromQuery = req.query.token;

    if (tokenFromHeader !== configuredToken && tokenFromQuery !== configuredToken) {
      return res.status(401).send('# Unauthorized metrics access\n');
    }
  }

  const output = metrics.getPrometheusFormat();
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(output);
};

module.exports = {
  getMetrics,
};
