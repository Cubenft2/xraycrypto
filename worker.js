export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- Global CORS for preflight ----
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'Content-Type,User-Agent',
          'access-control-max-age': '86400',
        }
      });
    }

    // ---- Common headers helper ----
    const withCORS = (body, init = {}) => new Response(body, {
      ...init,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'cache-control': 'no-cache',
        ...(init.headers || {})
      }
    });

    // ---- Allowlist used by both modes ----
    const ALLOW = [
      // Crypto
      'coindesk.com', 'cointelegraph.com', 'theblock.co', 'decrypt.co', 'messari.io',
      'cryptoslate.com', 'bitcoinmagazine.com', 'blockworks.co', 'thedefiant.io',
      'protos.com', 'ambcrypto.com', 'beincrypto.com', 'coingape.com', 'chain.link',
      'coinpedia.org', 'cryptopotato.com',   // <-- added

      // Markets / Business
      'reuters.com', 'cnbc.com', 'foxbusiness.com', 'apnews.com', 'wsj.com',
      'feeds.a.dj.com', // WSJ RSS host
      'finance.yahoo.com', 'ft.com', 'rss.cnn.com', 'nytimes.com',
      'marketwatch.com', 'moneycontrol.com', 'theguardian.com', 'bbc.co.uk',
      'feeds.bbci.co.uk',

      // Macro / Official
      'federalreserve.gov', 'bls.gov', 'bea.gov', 'home.treasury.gov',
      'ecb.europa.eu', 'bankofengland.co.uk', 'sec.gov',

      // Meta
      'news.google.com'
    ];
    const isAllowedHost = (h) => ALLOW.some(dom => h === dom || h.endsWith('.' + dom));

    // ========== Mode A: proxy raw feed (compat with /fetch?url=...) ==========
    if (url.pathname.endsWith('/fetch')) {
      const target = url.searchParams.get('url');
      if (!target) return withCORS('Missing url', { status: 400 });

      let targetUrl;
      try {
        targetUrl = new URL(target);
      } catch {
        return withCORS('Invalid url', { status: 400, headers: { 'content-type': 'text/plain' } });
      }
      if (!/^https?:$/.test(targetUrl.protocol)) {
        return withCORS('Only http(s) allowed', { status: 400 });
      }
      // OPTIONAL SECURITY
      if (!isAllowedHost(targetUrl.hostname.replace(/^www\./,''))) {
        return withCORS('Host not allowed', { status: 403 });
      }

      try {
        const r = await fetch(targetUrl.toString(), { headers: { 'User-Agent': 'XRNewsWorker/1.0' } });
        const body = await r.text(); // pass raw XML/Atom through
        const contentType =
          r.headers.get('content-type') ||
          (targetUrl.pathname.endsWith('.xml') ? 'application/xml; charset=utf-8'
                                               : 'application/rss+xml; charset=utf-8');
        return withCORS(body, {
          status: r.status,
          headers: { 'content-type': contentType }
        });
      } catch (err) {
        return withCORS(`Upstream fetch failed: ${err}`, { status: 502, headers: { 'content-type':'text/plain' } });
      }
    }

    // ========== Mode B: aggregate JSON (/aggregate?sources=crypto,stocks,macro&q=BTC) ==========
    if (url.pathname.endsWith('/aggregate')) {
      const sourcesParam = (url.searchParams.get('sources') || 'crypto').toLowerCase();
      const q = (url.searchParams.get('q') || '').trim();
      const wantTop = (url.searchParams.get('top') || '1') === '1';
      const sources = new Set(sourcesParam.split(',').map(s => s.trim()).filter(Boolean));

      const FEEDS = {
        crypto: [
          // existing
          'https://www.coindesk.com/arc/outboundfeeds/rss/',
          'https://cointelegraph.com/rss',
          'https://www.theblock.co/rss.xml',
          'https://decrypt.co/feed',
          'https://messari.io/rss',
          'https://blog.chain.link/feed/',
          'https://cryptoslate.com/feed/',
          'https://bitcoinmagazine.com/feed',
          // additions
          'https://blockworks.co/feeds/rss',
          'https://thedefiant.io/feed',
          'https://protos.com/feed/',
          'https://ambcrypto.com/feed/',
          'https://beincrypto.com/feed/',
          'https://coingape.com/feed/',
          // new (requested)
          'https://coinpedia.org/feed/',
          'https://cryptopotato.com/feed/'
        ],
        stocks: [
          // existing
          'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
          'https://www.reuters.com/markets/us/rss',
          'https://www.cnbc.com/id/100003114/device/rss/rss.html',
          'https://feeds.foxbusiness.com/foxbusiness/latest',
          'https://apnews.com/hub/apf-business?output=rss',
          'https://finance.yahoo.com/news/rssindex',
          'https://www.ft.com/markets/rss',
          'https://rss.cnn.com/rss/money_latest.rss',
          'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
          // additions
          'https://www.marketwatch.com/feeds/topstories',
          'https://www.marketwatch.com/feeds/marketpulse',
          'https://www.moneycontrol.com/rss/business.xml',
          'https://www.moneycontrol.com/rss/marketreports.xml',
          'https://www.moneycontrol.com/rss/economy.xml',
          'https://www.theguardian.com/uk/business/rss',
          'http://feeds.bbci.co.uk/news/business/rss.xml'
        ],
        macro: [
          // existing
          'https://www.reuters.com/world/rss',
          'https://apnews.com/hub/apf-topnews?output=rss',
          'https://news.google.com/rss/search?q=market%20volatility%20OR%20stocks%20selloff%20OR%20crypto%20crash&hl=en-US&gl=US&ceid=US:en',
          // additions (official)
          'https://www.federalreserve.gov/feeds/press_all.xml',
          'https://www.bls.gov/feed/news_release.rss',
          'https://www.bea.gov/rss.xml',
          'https://home.treasury.gov/rss/press.xml',
          'https://www.ecb.europa.eu/press/rss/press.xml',
          'https://www.bankofengland.co.uk/boeapps/rss/feeds.aspx?feed=News',
          // SEC latest 8-Ks (Atom)
          'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom'
        ],
      };

      async function fetchFeed(u) {
        try {
          const host = new URL(u).hostname.replace(/^www\./,'');
          if (!isAllowedHost(host)) return [];
          const res = await fetch(u, { headers: { 'User-Agent': 'XRNewsWorker/1.0' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, 'text/xml');
          const items = [];

          // RSS
          doc.querySelectorAll('item').forEach(it => {
            const title = it.querySelector('title')?.textContent?.trim() || '';
            const link = it.querySelector('link')?.textContent?.trim() || '';
            const pubDate = it.querySelector('pubDate')?.textContent || it.querySelector('dc\\:date')?.textContent || '';
            const date = pubDate ? new Date(pubDate) : new Date();
            const source = new URL(link || u).hostname.replace(/^www\./,'');
            if (title && (link || u)) items.push({ title, link, date: +date, source });
          });

          // Atom
          doc.querySelectorAll('entry').forEach(it => {
            const title = it.querySelector('title')?.textContent?.trim() || '';
            const link = it.querySelector('link')?.getAttribute('href') || '';
            const pubDate = it.querySelector('updated')?.textContent || it.querySelector('published')?.textContent || '';
            const date = pubDate ? new Date(pubDate) : new Date();
            const source = new URL(link || u).hostname.replace(/^www\./,'');
            if (title && (link || u)) items.push({ title, link, date: +date, source });
          });

          // allowlist filter (belt & suspenders)
          return items.filter(x => isAllowedHost((x.source || '').replace(/^www\./,'')));
        } catch {
          return [];
        }
      }

      const toFetch = [];
      if (sources.has('crypto')) toFetch.push(...FEEDS.crypto);
      if (sources.has('stocks')) toFetch.push(...FEEDS.stocks);
      if (sources.has('macro'))  toFetch.push(...FEEDS.macro);

      // Simple concurrency cap
      const MAX = 6, chunks = [];
      for (let i = 0; i < toFetch.length; i += MAX) chunks.push(toFetch.slice(i, i + MAX));

      let all = [];
      for (const group of chunks) {
        const results = await Promise.all(group.map(fetchFeed));
        for (const arr of results) all.push(...arr);
      }

      // Deduplicate
      const seen = new Set();
      all = all.filter(x => {
        const key = x.link || ('t:' + x.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Query filter
      const qLower = q.toLowerCase();
      if (qLower) {
        all = all.filter(x =>
          x.title.toLowerCase().includes(qLower) ||
          (x.source || '').toLowerCase().includes(qLower)
        );
      }

      const latest = [...all].sort((a,b) => b.date - a.date);

      // Lightweight "top" scoring
      const SOURCE_WEIGHT = (host)=>{
        if (host.includes('reuters')) return 1.2;
        if (host.includes('apnews'))  return 1.15;
        if (host.includes('cnbc'))    return 1.1;
        if (host.includes('coindesk') || host.includes('cointelegraph') || host.includes('theblock')) return 1.1;
        if (host.includes('federalreserve') || host.includes('bls.gov') || host.includes('bea.gov')) return 1.2;
        return 1.0;
      };
      const now = Date.now();
      const score = (item) => {
        const ageMin = Math.max(1, (now - item.date) / 60000);
        const recency = 1 / ageMin;
        const match = qLower && item.title.toLowerCase().includes(qLower) ? 0.5 : 0;
        return recency * SOURCE_WEIGHT(item.source || '') + match;
      };
      const top = wantTop ? [...all].sort((a,b)=> score(b) - score(a)).slice(0, 25) : [];

      return withCORS(JSON.stringify({
        count: all.length,
        latest: latest.slice(0, 50),
        top
      }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }

    return withCORS('OK', { status: 200, headers: { 'content-type':'text/plain' } });
  }
}
