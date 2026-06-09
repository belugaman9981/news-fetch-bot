const Parser = require('rss-parser');
const parser = new Parser();

// RSS feeds grouped by category — all free, no limits
const FEEDS = [
  // AI
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', category: 'ai' },
  { url: 'https://www.artificialintelligence-news.com/feed/', category: 'ai' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai' },
  { url: 'https://openai.com/news/rss.xml', category: 'ai' },

  // Tech
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', category: 'tech' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
  { url: 'https://techcrunch.com/feed/', category: 'tech' },
  { url: 'https://www.wired.com/feed/rss', category: 'tech' },

  // Science
  { url: 'https://www.sciencedaily.com/rss/top/technology.xml', category: 'science' },
  { url: 'https://feeds.nature.com/nature/rss/current', category: 'science' },

  // Business/Startups
  { url: 'https://techcrunch.com/category/startups/feed/', category: 'startups' },
  { url: 'https://feeds.feedburner.com/entrepreneur/latest', category: 'startups' },
];

async function fetchFeed({ url, category }) {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, 15).map(item => ({
      id: Buffer.from(item.link || item.title || '').toString('base64').slice(0, 24),
      title: item.title || '',
      summary: item.contentSnippet || item.summary || '',
      url: item.link || '',
      source: feed.title || url,
      category,
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    }));
  } catch (err) {
    console.warn(`[fetcher] Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

async function refresh(db) {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by id
  const seen = new Set();
  const unique = articles.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Sort newest first
  unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  db.set('cache', unique).write();
  console.log(`[fetcher] Cached ${unique.length} articles from ${FEEDS.length} feeds.`);
  return unique;
}

module.exports = { refresh };
