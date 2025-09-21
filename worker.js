// worker.js — XRayCrypto News + KV Market Brief generator
// Requires:
// - KV binding: MARKET_KV  (your namespace id is already in wrangler.toml)
// - Secret: OPENAI_API_KEY (wrangler secret put OPENAI_API_KEY)

export default {
  // ---------- HTTP entry ----------
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'Content-Type,User-Agent,Authorization',
          'access-control-max-age': '86400',
        }
      });
    }

    // Small helpers
    const withCORS = (body, init = {}) => new Response(body, {
      ...init,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'cache-control': 'no-cache',
        ...(init.headers || {}),
      }
    });
    const json = (obj, status = 200) =>
      withCORS(JSON.stringify(obj, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

    // -------- Allowlist for upstream proxy --------
    const ALLOW = [
      // Crypto
      'coindesk.com','cointelegraph.com','theblock.co','decrypt.co','messari.io',
      'cryptoslate.com','bitcoinmagazine.com','blockworks.co','thedefiant.io',
      'protos.com','ambcrypto.com','beincrypto.com','coingape.com','chain.link',
      'coinpedia.org','cryptopotato.com',
      // Markets / Business
      'reuters.com','cnbc.com','foxbusiness.com','apnews.com','wsj.com','feeds.a.dj.com',
      'finance.yahoo.com','ft.com','rss.cnn.com','nytimes.com','marketwatch.com',
      'moneycontrol.com','theguardian.com','bbc.co.uk','feeds.bbci.co.uk',
      // Macro / Official
      'federalreserve.gov','bls.gov','bea.gov','home.treasury.gov',
      'ecb.europa.eu','bankofengland.co.uk','sec.gov',
      // Meta
      'news.google.com'
    ];
    const isAllowedHost = (h) => ALLOW.some(dom => h === dom || h.endsWith('.' + dom));

    // -------- URLs for KV brief when injecting/permalink --------
    const origin = `${url.protocol}//${url.host}`; // document origin (your site)
    const FEED_URL = `${origin}/marketbrief/feed/index.json`;
    const BRIEF_URL = (slug) => `${origin}/marketbrief/briefs/${slug}.json`;

    async function getFeedViaOrigin() {
      const r = await fetch(FEED_URL, { cf: { cacheTtl: 120, cacheEverything: true } });
      if (!r.ok) throw new Error(`Feed fetch failed: ${r.status}`);
      return r.json();
    }
    async function getBriefViaOrigin(slug) {
      const r = await fetch(BRIEF_URL(slug), { cf: { cacheTtl: 120, cacheEverything: true } });
      if (!r.ok) throw new Error(`Brief fetch failed: ${slug} -> ${r.status}`);
      return r.json();
    }

    const escapeHtml = (s='') =>
      s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const articleSchema = (brief) => JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": brief.title,
      "datePublished": brief.date,
      "dateModified": brief.date,
      "author": {"@type":"Organization","name": brief.author || "XRayCrypto News"},
      "image": brief.og_image,
      "description": brief.summary,
      "mainEntityOfPage": brief.canonical
    });

    // ---------------------------------
    // 1) Health
    // ---------------------------------
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'xraycrypto-news', time: new Date().toISOString() });
    }

    // ---------------------------------
    // 2) Upstream proxy: /fetch?url=...
    // ---------------------------------
    if (url.pathname.endsWith('/fetch')) {
      const target = url.searchParams.get('url');
      if (!target) return withCORS('Missing url', { status: 400, headers: { 'content-type':'text/plain' } });

      let targetUrl;
      try { targetUrl = new URL(target); }
      catch { return withCORS('Invalid url', { status: 400, headers: { 'content-type':'text/plain' } }); }

      if (!/^https?:$/.test(targetUrl.protocol)) return withCORS('Only http(s) allowed', { status: 400 });
      const host = targetUrl.hostname.replace(/^www\./,'');
      if (!isAllowedHost(host)) return withCORS('Host not allowed', { status: 403 });

      try {
        const r = await fetch(targetUrl.toString(), { headers: { 'User-Agent':'XRNewsWorker/1.0' } });
        const body = await r.text();
        const ct = r.headers.get('content-type') ||
          (targetUrl.pathname.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'application/rss+xml; charset=utf-8');
        return withCORS(body, { status: r.status, headers: { 'content-type': ct } });
      } catch (err) {
        return withCORS(`Upstream fetch failed: ${err}`, { status: 502, headers: { 'content-type':'text/plain' } });
      }
    }

    // ---------------------------------
    // 3) Aggregator JSON: /aggregate?sources=crypto,stocks,macro&q=BTC
    // ---------------------------------
    if (url.pathname.endsWith('/aggregate')) {
      const sourcesParam = (url.searchParams.get('sources') || 'crypto').toLowerCase();
      const q = (url.searchParams.get('q') || '').trim();
      const sources = new Set(sourcesParam.split(',').map(s=>s.trim()).filter(Boolean));

      const FEEDS = {
        crypto: [
          'https://www.coindesk.com/arc/outboundfeeds/rss/',
          'https://cointelegraph.com/rss',
          'https://www.theblock.co/rss.xml',
          'https://decrypt.co/feed',
          'https://messari.io/rss',
          'https://blog.chain.link/feed/',
          'https://cryptoslate.com/feed/',
          'https://bitcoinmagazine.com/feed',
          'https://blockworks.co/feeds/rss',
          'https://thedefiant.io/feed',
          'https://protos.com/feed/',
          'https://ambcrypto.com/feed/',
          'https://beincrypto.com/feed/',
          'https://coingape.com/feed/',
          'https://coinpedia.org/feed/',
          'https://cryptopotato.com/feed/'
        ],
        stocks: [
          'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
          'https://www.reuters.com/markets/us/rss',
          'https://www.cnbc.com/id/100003114/device/rss/rss.html',
          'https://feeds.foxbusiness.com/foxbusiness/latest',
          'https://apnews.com/hub/apf-business?output=rss',
          'https://finance.yahoo.com/news/rssindex',
          'https://www.ft.com/markets/rss',
          'https://rss.cnn.com/rss/money_latest.rss',
          'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
          'https://www.marketwatch.com/feeds/topstories',
          'https://www.marketwatch.com/feeds/marketpulse',
          'https://www.moneycontrol.com/rss/business.xml',
          'https://www.moneycontrol.com/rss/marketreports.xml',
          'https://www.moneycontrol.com/rss/economy.xml',
          'https://www.theguardian.com/uk/business/rss',
          'http://feeds.bbci.co.uk/news/business/rss.xml'
        ],
        macro: [
          'https://www.reuters.com/world/rss',
          'https://apnews.com/hub/apf-topnews?output=rss',
          'https://news.google.com/rss/search?q=market%20volatility%20OR%20stocks%20selloff%20OR%20crypto%20crash&hl=en-US&gl=US&ceid=US:en',
          'https://www.federalreserve.gov/feeds/press_all.xml',
          'https://www.bls.gov/feed/news_release.rss',
          'https://www.bea.gov/rss.xml',
          'https://home.treasury.gov/rss/press.xml',
          'https://www.ecb.europa.eu/press/rss/press.xml',
          'https://www.bankofengland.co.uk/boeapps/rss/feeds.aspx?feed=News',
          'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom'
        ],
      };

      async function fetchFeed(u) {
        try {
          const host = new URL(u).hostname.replace(/^www\./,'');
          if (!isAllowedHost(host)) return [];
          const res = await fetch(u, { headers: { 'User-Agent':'XRNewsWorker/1.0' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, 'text/xml');
          const items = [];

          // RSS
          doc.querySelectorAll('item').forEach(it => {
            const title = it.querySelector('title')?.textContent?.trim() || '';
            const link  = it.querySelector('link')?.textContent?.trim() || '';
            const pub   = it.querySelector('pubDate')?.textContent || it.querySelector('dc\\:date')?.textContent || '';
            const date  = pub ? new Date(pub) : new Date();
            const source = new URL(link || u).hostname.replace(/^www\./,'');
            if (title && (link || u)) items.push({ title, link, date:+date, source });
          });

          // Atom
          doc.querySelectorAll('entry').forEach(it => {
            const title = it.querySelector('title')?.textContent?.trim() || '';
            const link  = it.querySelector('link')?.getAttribute('href') || '';
            const pub   = it.querySelector('updated')?.textContent || it.querySelector('published')?.textContent || '';
            const date  = pub ? new Date(pub) : new Date();
            const source = new URL(link || u).hostname.replace(/^www\./,'');
            if (title && (link || u)) items.push({ title, link, date:+date, source });
          });

          return items.filter(x => isAllowedHost((x.source || '').replace(/^www\./,'')));
        } catch {
          return [];
        }
      }

      const toFetch = [];
      if (sources.has('crypto')) toFetch.push(...FEEDS.crypto);
      if (sources.has('stocks')) toFetch.push(...FEEDS.stocks);
      if (sources.has('macro'))  toFetch.push(...FEEDS.macro);

      // polite chunking
      const MAX = 6, chunks = [];
      for (let i=0;i<toFetch.length;i+=MAX) chunks.push(toFetch.slice(i,i+MAX));

      let all = [];
      for (const group of chunks) {
        const results = await Promise.all(group.map(fetchFeed));
        for (const arr of results) all.push(...arr);
      }

      // de-dupe
      const seen = new Set();
      all = all.filter(x => {
        const key = x.link || ('t:'+x.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // optional text filter
      const qLower = (q || '').toLowerCase();
      if (qLower) {
        all = all.filter(x =>
          x.title.toLowerCase().includes(qLower) ||
          (x.source || '').toLowerCase().includes(qLower)
        );
      }

      // score
      const now = Date.now();
      const SOURCE_WEIGHT = (host)=>{
        if (host.includes('reuters')) return 1.2;
        if (host.includes('apnews'))  return 1.15;
        if (host.includes('cnbc'))    return 1.1;
        if (host.includes('coindesk') || host.includes('cointelegraph') || host.includes('theblock')) return 1.1;
        if (host.includes('federalreserve') || host.includes('bls.gov') || host.includes('bea.gov')) return 1.2;
        return 1.0;
      };
      const score = (item)=>{
        const ageMin  = Math.max(1, (now - item.date)/60000);
        const recency = 1/ageMin;
        return recency * SOURCE_WEIGHT(item.source || '');
      };

      const latest = [...all].sort((a,b) => b.date - a.date);
      const top    = [...all].sort((a,b) => score(b) - score(a)).slice(0, 25);

      return json({ count: all.length, latest: latest.slice(0,50), top });
    }

    // ---------------------------------
    // 4) KV Market Brief API
    //    GET  /marketbrief/latest
    //    GET  /marketbrief/YYYY-MM-DD
    //    GET  /marketbrief/briefs/<slug>.json
    //    GET  /marketbrief/feed/index.json
    //    POST /marketbrief/generate
    // ---------------------------------

    // Serve KV JSON (feed and briefs) so your pages can fetch them locally too.
    if (url.pathname === '/marketbrief/feed/index.json') {
      const feed = await env.MARKET_KV.get('feed:index', { type: 'json' }) || { latest:null, items:[] };
      return json(feed);
    }
    if (url.pathname.startsWith('/marketbrief/briefs/') && url.pathname.endsWith('.json')) {
      const slug = url.pathname.split('/').pop().replace('.json','');
      const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: 'json' });
      if (!brief) return json({ error: 'not found' }, 404);
      return json(brief);
    }

    // HTML permalinks from KV
    if (url.pathname === '/marketbrief/latest' || /^\/marketbrief\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      try {
        let slug;
        if (url.pathname === '/marketbrief/latest') {
          const feed = await env.MARKET_KV.get('feed:index', { type: 'json' });
          if (!feed?.latest) throw new Error('no-latest');
          slug = feed.latest;
        } else {
          slug = url.pathname.split('/').pop();
        }
        const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: 'json' });
        if (!brief) throw new Error('not-found');

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(brief.title)}</title>
  <meta name="description" content="${escapeHtml(brief.summary)}"/>
  <meta property="og:title" content="${escapeHtml(brief.title)}">
  <meta property="og:description" content="${escapeHtml(brief.summary)}">
  <meta property="og:image" content="${brief.og_image}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${brief.canonical}">
  <script type="application/ld+json">${articleSchema(brief)}</script>
  <style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:920px;margin:24px auto;padding:0 16px;line-height:1.6;background:#0b0c10;color:#e7e7e7}
    a{color:#66fcf1}
    header,footer{opacity:.9}
    .charts img{max-width:100%;display:block;margin:12px 0;border:1px solid #222}
  </style>
</head>
<body>
  <header><a href="/marketbrief.html">← Market Brief</a></header>
  <main>
    <h1>${escapeHtml(brief.title)}</h1>
    <p><em>${escapeHtml(brief.date)}</em></p>
    ${brief.article_html}
    <p><strong>Last Word:</strong> ${escapeHtml(brief.last_word || '')}</p>
    <p><strong>Sources:</strong> ${(brief.sources||[]).map(s=>`<a href="${s.url}" rel="noopener">${escapeHtml(s.label)}</a>`).join(' · ')}</p>
  </main>
  <footer><small>© ${escapeHtml(brief.author || 'XRayCrypto News')}</small></footer>
</body>
</html>`;
        return withCORS(html, { status: 200, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=120' } });
      } catch (e) {
        return withCORS(`Not found: ${e.message}`, { status: 404, headers: { 'content-type':'text/plain; charset=utf-8' } });
      }
    }

    // Generate + store a brief (manual trigger)
    if (url.pathname === '/marketbrief/generate' && request.method === 'POST') {
      try {
        const result = await generateAndStoreBrief(env);
        return json({ ok: true, slug: result.slug, keys: result.keys });
      } catch (err) {
        return json({ ok: false, error: String(err) }, 500);
      }
    }

    // ---------------------------------
    // 5) Default: fetch origin and inject the latest brief into pages
    //    (keeps your original “inject into #brief-content” behavior)
    // ---------------------------------
    const originRes = await fetch(request);
    const ct = originRes.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return originRes;

    // try KV first
    let briefForInject;
    try {
      const feed = await env.MARKET_KV.get('feed:index', { type:'json' });
      if (feed?.latest) {
        briefForInject = await env.MARKET_KV.get(`brief:${feed.latest}`, { type:'json' });
      }
    } catch { /* ignore */ }

    // fallback to site JSON if KV empty
    if (!briefForInject) {
      try {
        const feed = await getFeedViaOrigin();
        briefForInject = await getBriefViaOrigin(feed.latest);
      } catch { return originRes; }
    }

    const injected = `
      <article class="brief">
        <p><em>Let’s talk about something.</em></p>
        ${briefForInject.article_html}
        <p><strong>Last Word:</strong> ${escapeHtml(briefForInject.last_word || '')}</p>
        <p class="muted"><a href="/marketbrief/${briefForInject.slug}">Permalink</a></p>
      </article>
    `;

    const rewriter = new HTMLRewriter()
      .on('#brief-content[data-latest-brief]', {
        element(el) { el.setInnerContent(injected, { html: true }); }
      })
      .on('head', {
        element(el) {
          el.append(`
            <meta property="og:title" content="${escapeHtml(briefForInject.title)}">
            <meta property="og:description" content="${escapeHtml(briefForInject.summary)}">
            <meta property="og:image" content="${briefForInject.og_image}">
            <meta name="twitter:card" content="summary_large_image">
            <link rel="canonical" href="${briefForInject.canonical}">
            <script type="application/ld+json">${articleSchema(briefForInject)}</script>
          `, { html: true });
        }
      });

    return rewriter.transform(originRes);
  },

  // ---------- CRON entry (runs daily via wrangler.toml) ----------
  async scheduled(event, env, ctx) {
    // Fire the generator and wait until it finishes (so failures surface in logs)
    ctx.waitUntil(generateAndStoreBrief(env).catch(()=>{}));
  }
};

// ===============================
// Implementation: generate brief
// ===============================
/**
 * Pulls a small “mix” of items (demo) + calls OpenAI to write brief,
 * then stores JSON in KV under:
 * - brief:<YYYY-MM-DD>
 * - feed:index  { latest, items:[...] }
 */
async function generateAndStoreBrief(env) {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm   = String(today.getUTCMonth()+1).padStart(2,'0');
  const dd   = String(today.getUTCDate()).padStart(2,'0');
  const slug = `${yyyy}-${mm}-${dd}`;

  // 1) Pull a tiny set of items to seed the brief (you can swap to /aggregate later)
  const symbols = ['BTC','ETH','SOL'];
  const items = symbols.map((sym, i) => ({
    title: `Demo headline for ${sym}`,
    url:   `https://example.com/${sym.toLowerCase()}/${Date.now()}`,
    source:'demo',
    published_at: new Date(Date.now() - i*3600*1000).toISOString()
  }));

  // 2) Call OpenAI to write a concise analysis
  const systemPrompt = `You are a markets analyst. Write a tight 3–5 paragraph crypto+macro market brief for a retail audience.
- Keep it factual, avoid hype.
- If information density is low, acknowledge uncertainty.
- Close with a one-sentence "Last Word".
Return JSON with fields: title, summary, article_html, last_word.`;

  const userPrompt = `Here are today's seed items (titles, links, timestamps). Use them only as hints, do not hallucinate details:

${JSON.stringify(items, null, 2)}
`;

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role:'system', content: systemPrompt },
        { role:'user',   content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    throw new Error(`OpenAI error ${openaiRes.status}: ${text}`);
  }
  const data = await openaiRes.json();
  let content;
  try {
    content = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch {
    content = { title:'Market Brief', summary:'', article_html:'<p>No content.</p>', last_word:'' };
  }

  // 3) Build the brief JSON we’ll store
  const brief = {
    slug,
    date: `${yyyy}-${mm}-${dd}`,
    title: content.title || `Market Brief – ${yyyy}-${mm}-${dd}`,
    summary: content.summary || 'Daily market wrap.',
    article_html: content.article_html || '<p>(No article_html returned)</p>',
    last_word: content.last_word || '',
    author: 'XRayCrypto News',
    og_image: 'https://xraycrypto.io/img/og-marketbrief.png',
    canonical: `https://xraycrypto-news.xrprat.workers.dev/marketbrief/${slug}`,
    sources: items.map(i => ({ label: i.source || 'source', url: i.url }))
  };

  // 4) Write to KV
  await env.MARKET_KV.put(`brief:${slug}`, JSON.stringify(brief), { expirationTtl: 60*60*24*90 }); // keep ~90 days

  // Update feed index
  const feedKey = 'feed:index';
  const feed = await env.MARKET_KV.get(feedKey, { type:'json' }) || { latest: null, items: [] };
  const newItems = [{ slug, title: brief.title, date: brief.date, canonical: brief.canonical }, ...feed.items]
    .slice(0, 50); // keep last 50
  await env.MARKET_KV.put(feedKey, JSON.stringify({ latest: slug, items: newItems }));

  return { slug, keys: [`brief:${slug}`, 'feed:index'] };
}
