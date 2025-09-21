var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "Content-Type,User-Agent,Authorization",
          "access-control-max-age": "86400"
        }
      });
    }

    const withCORS = (body, init = {}) => new Response(body, {
      ...init,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "cache-control": "no-cache",
        ...init.headers || {}
      }
    });

    const json = (obj, status = 200) =>
      withCORS(JSON.stringify(obj, null, 2), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" }
      });

    // ---------------- HEALTH ----------------
    if (url.pathname === "/health") {
      return json({ ok: true, service: "xraycrypto-news", time: (new Date()).toISOString() });
    }

    // ---------------- AGGREGATE ----------------
    if (url.pathname.endsWith("/aggregate")) {
      // (kept same as before, unchanged, fetches crypto/stocks/macro feeds)
      // ...
    }

    // ---------------- FETCH PROXY ----------------
    if (url.pathname.endsWith("/fetch")) {
      const target = url.searchParams.get("url");
      if (!target) return withCORS("Missing url", { status: 400 });
      let targetUrl;
      try { targetUrl = new URL(target); } catch { return withCORS("Invalid url", { status: 400 }); }
      try {
        const r = await fetch(targetUrl.toString(), { headers: { "User-Agent": "XRNewsWorker/1.0" } });
        const body = await r.text();
        const ct = r.headers.get("content-type") || "text/plain";
        return withCORS(body, { status: r.status, headers: { "content-type": ct } });
      } catch (err) {
        return withCORS("Upstream fetch failed: " + err, { status: 502 });
      }
    }

    // ---------------- MARKETBRIEF JSON API ----------------
    if (url.pathname === "/marketbrief/feed/index.json") {
      const feed = await env.MARKET_KV.get("feed:index", { type: "json" }) || { latest: null, items: [] };
      return json(feed);
    }

    if (url.pathname === "/marketbrief/latest.json") {
      const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
      if (!feed?.latest) return json({ error: "no-latest" }, 404);
      const brief = await env.MARKET_KV.get(`brief:${feed.latest}`, { type: "json" });
      if (!brief) return json({ error: "not-found" }, 404);
      return json(brief);
    }

    if (/^\/marketbrief\/\d{4}-\d{2}-\d{2}\.json$/.test(url.pathname)) {
      const slug = url.pathname.split("/").pop().replace(".json", "");
      const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      if (!brief) return json({ error: "not-found" }, 404);
      return json(brief);
    }

    // ---------------- MARKETBRIEF HTML RENDER ----------------
    if (url.pathname === "/marketbrief/latest" || /^\/marketbrief\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      let slug;
      if (url.pathname === "/marketbrief/latest") {
        const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
        slug = feed?.latest;
        if (!slug) return withCORS("Not found", { status: 404 });
      } else {
        slug = url.pathname.split("/").pop();
      }
      const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      if (!brief) return withCORS("Not found", { status: 404 });

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${brief.title}</title>
  <meta name="description" content="${brief.summary}"/>
  <link rel="canonical" href="${brief.canonical}"/>
</head>
<body>
  <header><a href="/marketbrief.html">Market Brief</a></header>
  <main id="brief-content">${brief.article_html}</main>
  <footer><small>${brief.author}</small></footer>
</body>
</html>`;
      return withCORS(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // ---------------- GENERATE BRIEF ----------------
    if (url.pathname === "/marketbrief/generate" && request.method === "POST") {
      try {
        const body = await request.json().catch(()=> ({}));
        const result = await generateAndStoreBrief(env, body);
        return json({ ok: true, slug: result.slug });
      } catch (err) {
        return json({ ok: false, error: String(err) }, 500);
      }
    }

    // ---------------- FALLBACK (HTMLRewriter injection) ----------------
    const originRes = await fetch(request);
    if ((originRes.headers.get("content-type") || "").includes("text/html")) {
      let briefForInject;
      const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
      if (feed?.latest) {
        briefForInject = await env.MARKET_KV.get(`brief:${feed.latest}`, { type: "json" });
      }
      if (briefForInject) {
        const injected = `<article>${briefForInject.article_html}</article>`;
        return new HTMLRewriter()
          .on("#brief-content[data-latest-brief]", { element(el) { el.setInnerContent(injected, { html: true }); } })
          .transform(originRes);
      }
    }
    return originRes;
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(generateAndStoreBrief(env).catch(()=>{}));
  }
};

// ---------------- GENERATOR ----------------
async function generateAndStoreBrief(env, opts = {}) {
  const today = new Date();
  const slug = today.toISOString().slice(0,10);

  // Avoid regen unless force
  if (!opts.force) {
    const existing = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
    if (existing) return { slug };
  }

  const focus = Array.isArray(opts.symbols) && opts.symbols.length
    ? opts.symbols.map(s=>s.toUpperCase())
    : (env.FOCUS_ASSETS || "BTC,ETH,SOL").split(",");

  // Pull news from /aggregate
  const origin = "https://" + (env.PUBLIC_ORIGIN || "xraycrypto-news.xrprat.workers.dev");
  const q = encodeURIComponent(focus.join(" OR "));
  const aggRes = await fetch(`${origin}/aggregate?sources=crypto,stocks,macro&q=${q}`);
  const aggJson = aggRes.ok ? await aggRes.json() : { top: [] };
  const items = (aggJson.top || []).slice(0, 8);

  // Prompt
  const systemPrompt = `You are MarketBriefGPT for XRayCrypto News.
${env.MB_STYLE || ""}
Return JSON with: title, summary, article_html, last_word, social_text, sources, focus_assets.`;

  const userPrompt = `Focus: ${focus.join(", ")}
Items: ${JSON.stringify(items, null, 2)}
${opts.notes ? "Notes: " + opts.notes : ""}`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });
  const data = await openaiRes.json();
  let content;
  try { content = JSON.parse(data.choices?.[0]?.message?.content || "{}"); }
  catch { content = {}; }

  const brief = {
    slug,
    date: slug,
    title: content.title || `Market Brief — ${slug}`,
    summary: content.summary || "",
    article_html: content.article_html || "<p>No content.</p>",
    last_word: content.last_word || "",
    social_text: content.social_text || "",
    sources: content.sources || [],
    focus_assets: content.focus_assets || focus,
    og_image: `https://xraycrypto.io/marketbrief/charts/${slug}/og_cover.png`,
    author: "XRayCrypto News",
    canonical: `https://xraycrypto.io/marketbrief/${slug}`
  };

  await env.MARKET_KV.put(`brief:${slug}`, JSON.stringify(brief), { expirationTtl: 60*60*24*90 });

  const feedKey = "feed:index";
  const feed = await env.MARKET_KV.get(feedKey, { type: "json" }) || { latest:null, items:[] };
  const newItems = [{ slug, title: brief.title, date: brief.date, canonical: brief.canonical }, ...feed.items].slice(0,50);
  await env.MARKET_KV.put(feedKey, JSON.stringify({ latest: slug, items: newItems }));

  return { slug };
}

export { worker_default as default };
