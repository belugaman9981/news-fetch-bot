# news-fetch-bot

Self-hosted news API with API key management. Pulls from free RSS feeds — no rate limits, no $450/month bills.

## Deploy on Render

1. Connect this repo to Render as a **Web Service**
2. Build command: `npm install`
3. Start command: `node server.js`
4. Optional env var: `ADMIN_SECRET=yourpassword` (protects the key list/delete endpoints)

## Generate your first API key

```bash
curl -X POST https://your-render-url.onrender.com/keys \
  -H "Content-Type: application/json" \
  -d '{"label":"ai-news-buzz"}'
```

Returns:
```json
{ "key": "nfb_abc123...", "label": "ai-news-buzz" }
```

## Fetch news

```bash
curl "https://your-render-url.onrender.com/news?apiKey=nfb_abc123&category=ai&limit=10"
```

### Query params
| Param | Default | Options |
|-------|---------|---------|
| `category` | `all` | `ai`, `tech`, `science`, `startups` |
| `limit` | `20` | any number |
| `q` | — | keyword search |

## All endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/keys` | none | Generate a new API key |
| `GET` | `/keys` | admin | List all keys |
| `DELETE` | `/keys/:key` | admin | Revoke a key |
| `GET` | `/news` | API key | Fetch articles |
| `POST` | `/refresh` | API key | Force cache refresh |
| `GET` | `/` | none | Health check |

## Use in Kids AI Buzz

```js
const res = await fetch('https://your-render-url.onrender.com/news?category=ai&limit=20', {
  headers: { 'x-api-key': process.env.NEWS_API_KEY }
});
const { articles } = await res.json();
```

Set `NEWS_API_KEY` in your Render env vars for Kids AI Buzz.
