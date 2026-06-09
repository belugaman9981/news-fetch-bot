const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const cron = require('node-cron');
const fetcher = require('./fetcher');

const app = express();
app.use(express.json());
app.use(cors());

// DB setup
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ keys: [], cache: [] }).write();

// ── Middleware: validate API key ──────────────────────────────────────────────
function requireKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  const record = db.get('keys').find({ key }).value();
  if (!record) return res.status(403).json({ error: 'Invalid API key' });
  record.lastUsed = new Date().toISOString();
  record.requests = (record.requests || 0) + 1;
  db.write();
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Generate a new API key
// POST /keys  { "label": "my-app" }
app.post('/keys', (req, res) => {
  const label = req.body.label || 'unnamed';
  const key = 'nfb_' + uuidv4().replace(/-/g, '');
  db.get('keys').push({
    key,
    label,
    created: new Date().toISOString(),
    lastUsed: null,
    requests: 0
  }).write();
  res.json({ key, label, message: 'Keep this key safe — it will not be shown again.' });
});

// List all keys (no auth needed — admin endpoint, protect with env var if you want)
app.get('/keys', (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'Admin secret required' });
  }
  const keys = db.get('keys').map(k => ({
    label: k.label,
    keyPreview: k.key.slice(0, 12) + '...',
    created: k.created,
    lastUsed: k.lastUsed,
    requests: k.requests
  })).value();
  res.json(keys);
});

// Revoke a key
// DELETE /keys/:key
app.delete('/keys/:key', (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'Admin secret required' });
  }
  db.get('keys').remove({ key: req.params.key }).write();
  res.json({ message: 'Key revoked' });
});

// Fetch news — main endpoint
// GET /news?apiKey=nfb_xxx&category=ai&limit=10
app.get('/news', requireKey, (req, res) => {
  const { category = 'all', limit = 20, q } = req.query;
  let articles = db.get('cache').value();

  if (category !== 'all') {
    articles = articles.filter(a => a.category === category);
  }
  if (q) {
    const query = q.toLowerCase();
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(query) ||
      (a.summary || '').toLowerCase().includes(query)
    );
  }

  articles = articles.slice(0, parseInt(limit));
  res.json({ count: articles.length, articles });
});

// Force refresh cache
app.post('/refresh', requireKey, async (req, res) => {
  await fetcher.refresh(db);
  res.json({ message: 'Cache refreshed', count: db.get('cache').size().value() });
});

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'news-fetch-bot',
    status: 'ok',
    articles: db.get('cache').size().value(),
    keys: db.get('keys').size().value()
  });
});

// ── Cron: refresh news every 30 minutes ──────────────────────────────────────
cron.schedule('*/30 * * * *', () => {
  console.log('[cron] Refreshing news cache...');
  fetcher.refresh(db);
});

// Initial fetch on startup
fetcher.refresh(db).then(() => {
  console.log('[startup] News cache loaded.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`news-fetch-bot running on port ${PORT}`));
