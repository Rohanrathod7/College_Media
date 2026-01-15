/**
 * ============================================================
 * API CONSUMER QUOTA MANAGEMENT – NODE.JS
 * Issue: Absence of API Consumer Quota Management (#752)
 * ============================================================
 */

'use strict';

const express = require('express');

const app = express();
app.use(express.json());

/* ============================================================
   CONFIG
============================================================ */
const CONFIG = {
  PORT: process.env.PORT || 3000,
  WINDOW_MS: 60 * 1000, // 1 minute window
};

/* ============================================================
   CONSUMER PLANS & QUOTAS
============================================================ */
const plans = {
  free: {
    limit: 30, // requests per window
  },
  pro: {
    limit: 100,
  },
  enterprise: {
    limit: 1000,
  },
};

/* ============================================================
   CONSUMER REGISTRY (MOCK)
============================================================ */
const consumers = {
  'key-free-123': {
    name: 'Free User',
    plan: 'free',
  },
  'key-pro-456': {
    name: 'Pro User',
    plan: 'pro',
  },
  'key-ent-789': {
    name: 'Enterprise User',
    plan: 'enterprise',
  },
};

/* ============================================================
   QUOTA STORE (IN-MEMORY)
============================================================ */
const quotaStore = new Map();

/* ============================================================
   QUOTA MIDDLEWARE
============================================================ */
function quotaLimiter(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !consumers[apiKey]) {
    return res.status(401).json({
      error: 'Invalid or missing API key',
    });
  }

  const consumer = consumers[apiKey];
  const plan = plans[consumer.plan];

  const now = Date.now();
  const entry =
    quotaStore.get(apiKey) || {
      count: 0,
      windowStart: now,
    };

  if (now - entry.windowStart > CONFIG.WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count++;
  quotaStore.set(apiKey, entry);

  if (entry.count > plan.limit) {
    return res.status(429).json({
      error: 'API quota exceeded',
      plan: consumer.plan,
      limit: plan.limit,
      windowMs: CONFIG.WINDOW_MS,
    });
  }

  // attach consumer context
  req.consumer = consumer;
  req.quota = {
    used: entry.count,
    limit: plan.limit,
  };

  next();
}

/* ============================================================
   SAMPLE API ROUTES
============================================================ */
app.get('/api/data', quotaLimiter, (req, res) => {
  res.json({
    message: 'Data response',
    consumer: req.consumer.name,
    quota: req.quota,
  });
});

app.post('/api/process', quotaLimiter, (req, res) => {
  res.json({
    status: 'processed',
    consumer: req.consumer.name,
    quota: req.quota,
  });
});

/* ============================================================
   CONSUMER USAGE METRICS
============================================================ */
app.get('/api/usage', quotaLimiter, (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const entry = quotaStore.get(apiKey);

  res.json({
    consumer: req.consumer.name,
    plan: req.consumer.plan,
    usage: {
      used: entry.count,
      limit: plans[req.consumer.plan].limit,
      windowMs: CONFIG.WINDOW_MS,
    },
  });
});

/* ============================================================
   ADMIN: VIEW ALL CONSUMER USAGE
============================================================ */
app.get('/admin/usage', (req, res) => {
  const data = [];

  for (const [key, value] of quotaStore.entries()) {
    data.push({
      apiKey: key,
      consumer: consumers[key]?.name,
      plan: consumers[key]?.plan,
      used: value.count,
    });
  }

  res.json(data);
});

/* ============================================================
   HEALTH
============================================================ */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    consumers: Object.keys(consumers).length,
  });
});

/* ============================================================
   SERVER
============================================================ */
app.listen(CONFIG.PORT, () => {
  console.log(
    `🚀 API Consumer Quota Management server running on port ${CONFIG.PORT}`
  );
});
