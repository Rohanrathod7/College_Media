/**
 * ============================================================
 * N+1 QUERY SAFEGUARD – NODE.JS (BATCH FETCHING)
 * Issue: No Safeguard Against N+1 Query Problem (#747)
 * ============================================================
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/* ============================================================
   CONFIG
============================================================ */
const CONFIG = {
  PORT: process.env.PORT || 3000,
};

/* ============================================================
   MOCK DATABASE
============================================================ */
const db = {
  users: {},
  posts: {},
};

function genId() {
  return crypto.randomBytes(5).toString('hex');
}

/* ============================================================
   SEED DATA
============================================================ */
function seed() {
  for (let i = 0; i < 5; i++) {
    const userId = genId();
    db.users[userId] = { id: userId, name: `User-${i}` };

    for (let j = 0; j < 3; j++) {
      const postId = genId();
      db.posts[postId] = {
        id: postId,
        userId,
        title: `Post-${j} of ${userId}`,
      };
    }
  }
}
seed();

/* ============================================================
   BAD: N+1 QUERY EXAMPLE (ANTI-PATTERN)
============================================================ */
app.get('/bad/users-with-posts', async (req, res) => {
  const users = Object.values(db.users);

  // ❌ N+1 queries
  const result = users.map((user) => {
    const posts = Object.values(db.posts).filter(
      (p) => p.userId === user.id
    );
    return { ...user, posts };
  });

  res.json({
    warning: 'N+1 query pattern detected',
    data: result,
  });
});

/* ============================================================
   GOOD: BATCH FETCH STRATEGY (SAFE)
============================================================ */
app.get('/good/users-with-posts', async (req, res) => {
  const users = Object.values(db.users);

  // single batch query
  const userIds = users.map((u) => u.id);
  const posts = Object.values(db.posts).filter((p) =>
    userIds.includes(p.userId)
  );

  // group posts by userId
  const postMap = {};
  posts.forEach((post) => {
    if (!postMap[post.userId]) postMap[post.userId] = [];
    postMap[post.userId].push(post);
  });

  const result = users.map((user) => ({
    ...user,
    posts: postMap[user.id] || [],
  }));

  res.json({
    optimized: true,
    data: result,
  });
});

/* ============================================================
   SAFEGUARD: QUERY COUNTER
============================================================ */
let queryCount = 0;

function queryTracker(fn) {
  queryCount++;
  return fn();
}

/* ============================================================
   SAFEGUARD: DETECT N+1
============================================================ */
app.get('/detect-n-plus-one', async (req, res) => {
  queryCount = 0;

  const users = queryTracker(() => Object.values(db.users));

  users.forEach((u) => {
    queryTracker(() =>
      Object.values(db.posts).filter((p) => p.userId === u.id)
    );
  });

  res.json({
    totalQueries: queryCount,
    warning:
      queryCount > 2
        ? '⚠️ Potential N+1 query detected'
        : '✅ Query usage optimal',
  });
});

/* ============================================================
   HEALTH
============================================================ */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    users: Object.keys(db.users).length,
    posts: Object.keys(db.posts).length,
  });
});

/* ============================================================
   SERVER
============================================================ */
app.listen(CONFIG.PORT, () => {
  console.log(
    `🚀 N+1 Safeguard server running on port ${CONFIG.PORT}`
  );
});
