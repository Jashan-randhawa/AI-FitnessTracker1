/**
 * Lightweight Prometheus-Compatible Metrics Registry & Collector
 * Provides zero-overhead counters, histograms, and gauges for system observability.
 * Exports metrics in standard Prometheus / OpenMetrics plaintext exposition format.
 */

class MetricsRegistry {
  constructor() {
    this.counters = new Map();
    this.histograms = new Map();
    this.gauges = new Map();
    this.metadata = new Map();

    this.registerDefaults();
  }

  registerDefaults() {
    this.register('password_reset_requests_total', 'counter', 'Total number of password reset requests received by outcome');
    this.register('password_reset_validations_total', 'counter', 'Total number of password reset token validations by outcome');
    this.register('password_reset_completions_total', 'counter', 'Total number of completed password resets by outcome');
    this.register('password_reset_email_dispatches_total', 'counter', 'Total email dispatches attempted for password reset');
    this.register('password_reset_email_failures_total', 'counter', 'Total email dispatch failures by failure reason');
    this.register('password_reset_email_duration_seconds', 'histogram', 'Email dispatch duration in seconds', [0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
    this.register('email_webhook_events_total', 'counter', 'Total Brevo webhook delivery events ingested');
  }

  register(name, type, help, buckets = [0.1, 0.5, 1, 2.5, 5, 10]) {
    this.metadata.set(name, { type, help, buckets });
  }

  _formatLabels(labels = {}) {
    const keys = Object.keys(labels).sort();
    if (keys.length === 0) return '';
    const formatted = keys.map((k) => `${k}="${String(labels[k]).replace(/"/g, '\\"')}"`).join(',');
    return `{${formatted}}`;
  }

  increment(name, labels = {}, value = 1) {
    if (!this.metadata.has(name)) {
      this.register(name, 'counter', `Counter for ${name}`);
    }
    const labelKey = this._formatLabels(labels);
    const fullKey = `${name}${labelKey}`;
    const current = this.counters.get(fullKey) || 0;
    this.counters.set(fullKey, current + value);
  }

  set(name, labels = {}, value = 0) {
    if (!this.metadata.has(name)) {
      this.register(name, 'gauge', `Gauge for ${name}`);
    }
    const labelKey = this._formatLabels(labels);
    const fullKey = `${name}${labelKey}`;
    this.gauges.set(fullKey, value);
  }

  observe(name, labels = {}, value = 0) {
    if (!this.metadata.has(name)) {
      this.register(name, 'histogram', `Histogram for ${name}`);
    }
    const meta = this.metadata.get(name);
    const buckets = meta.buckets || [0.1, 0.5, 1, 2.5, 5, 10];
    const baseLabelKey = this._formatLabels(labels);

    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }
    const histMap = this.histograms.get(name);

    if (!histMap.has(baseLabelKey)) {
      const bucketCounts = new Map();
      buckets.forEach((b) => bucketCounts.set(b, 0));
      histMap.set(baseLabelKey, {
        buckets: bucketCounts,
        sum: 0,
        count: 0,
      });
    }

    const entry = histMap.get(baseLabelKey);
    entry.count += 1;
    entry.sum += value;

    for (const b of buckets) {
      if (value <= b) {
        entry.buckets.set(b, entry.buckets.get(b) + 1);
      }
    }
  }

  getMetricsJSON() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Array.from(this.histograms.entries()).map(([k, v]) => [k, Array.from(v.entries())]),
    };
  }

  getPrometheusFormat() {
    const lines = [];

    // Group counters by metric base name
    const groupedCounters = new Map();
    for (const [key, val] of this.counters.entries()) {
      const metricName = key.includes('{') ? key.substring(0, key.indexOf('{')) : key;
      if (!groupedCounters.has(metricName)) groupedCounters.set(metricName, []);
      groupedCounters.get(metricName).push({ key, val });
    }

    for (const [name, items] of groupedCounters.entries()) {
      const meta = this.metadata.get(name) || { help: `Metric ${name}`, type: 'counter' };
      lines.push(`# HELP ${name} ${meta.help}`);
      lines.push(`# TYPE ${name} ${meta.type}`);
      for (const item of items) {
        lines.push(`${item.key} ${item.val}`);
      }
      lines.push('');
    }

    // Gauges
    for (const [key, val] of this.gauges.entries()) {
      const metricName = key.includes('{') ? key.substring(0, key.indexOf('{')) : key;
      const meta = this.metadata.get(metricName) || { help: `Metric ${metricName}`, type: 'gauge' };
      lines.push(`# HELP ${metricName} ${meta.help}`);
      lines.push(`# TYPE ${metricName} ${meta.type}`);
      lines.push(`${key} ${val}`);
      lines.push('');
    }

    // Histograms
    for (const [name, histMap] of this.histograms.entries()) {
      const meta = this.metadata.get(name) || { help: `Histogram ${name}`, type: 'histogram' };
      lines.push(`# HELP ${name} ${meta.help}`);
      lines.push(`# TYPE ${name} histogram`);

      for (const [labelStr, data] of histMap.entries()) {
        const rawLabels = labelStr ? labelStr.slice(1, -1) : '';
        const prefix = rawLabels ? `${rawLabels},` : '';

        let cumulative = 0;
        for (const [bucket, count] of data.buckets.entries()) {
          cumulative = count;
          lines.push(`${name}_bucket{${prefix}le="${bucket}"} ${cumulative}`);
        }
        lines.push(`${name}_bucket{${prefix}le="+Inf"} ${data.count}`);
        const suffix = rawLabels ? `{${rawLabels}}` : '';
        lines.push(`${name}_sum${suffix} ${data.sum.toFixed(4)}`);
        lines.push(`${name}_count${suffix} ${data.count}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

const metrics = new MetricsRegistry();

module.exports = metrics;
