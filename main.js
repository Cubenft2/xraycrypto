/* ========= Active nav highlight ========= */
(function(){
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav a').forEach(a=>{
    a.classList.toggle('active', (a.getAttribute('href')||'').toLowerCase() === file);
  });
})();

/* ========= Theme state ========= */
const THEME_KEY = 'xr_theme';
function getTheme(){ return localStorage.getItem(THEME_KEY) || 'dark'; }
function setTheme(t){ localStorage.setItem(THEME_KEY, t); }
function applyThemeToDOM(){
  const t = getTheme();
  document.body.classList.remove('light','dark');
  document.body.classList.add(t === 'light' ? 'light' : 'dark');
  const btn = document.getElementById('themeToggle');
  if(btn) btn.textContent = (t === 'light') ? '🌙' : '🌞';
}

/* ========= Ambient background (Fog / Stars) ========= */
const AMBIENT_KEY = 'xr_ambient';
function ensureFogMask(){
  if(document.getElementById('xr-fog-defs')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.id = 'xr-fog-defs';
  svg.setAttribute('width','0'); svg.setAttribute('height','0');
  svg.style.position = 'fixed'; svg.style.zIndex = '-1';
  svg.innerHTML = `
    <defs>
      <filter id="fogFilter">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.008" numOctaves="3" seed="7">
          <animate attributeName="baseFrequency" dur="32s"
            values="0.006 0.008; 0.004 0.006; 0.006 0.008" repeatCount="indefinite"/>
        </feTurbulence>
        <feColorMatrix type="saturate" values="0"/>
        <feGaussianBlur stdDeviation="12"/>
      </filter>
      <mask id="fogMask">
        <rect x="0" y="0" width="100%" height="100%" filter="url(#fogFilter)" fill="#fff"/>
      </mask>
    </defs>`;
  document.body.appendChild(svg);
}
let __XR_STARS = null;
function ensureStarsCanvas(){
  if(document.getElementById('bgStars')) return;
  const c = document.createElement('canvas');
  c.id = 'bgStars';
  c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;display:none';
  document.body.appendChild(c);
  (function(){
    const cvs = c;
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const ctx = cvs.getContext('2d');
    let stars = [], w=0, h=0, animId=0, t=0;
    function resize(){
      const vw = innerWidth, vh = innerHeight;
      w = cvs.width  = Math.floor(vw * DPR);
      h = cvs.height = Math.floor(vh * DPR);
      cvs.style.width  = vw + 'px';
      cvs.style.height = vh + 'px';
      makeStars();
    }
    function makeStars(){
      const count = Math.floor((w*h) / (9000 * DPR));
      stars = [];
      for(let i=0;i<count;i++){
        const x = Math.random()*w, y = Math.random()*h;
        const r = Math.random()*1.6 + 0.2;
        const tw = Math.random()*0.6 + 0.2;
        stars.push({x,y,r,tw,phase:Math.random()*Math.PI*2});
      }
    }
    function drawMilkyWay(){
      const grad = ctx.createLinearGradient(0, h*0.2, w, h*0.8);
      grad.addColorStop(0.00, 'rgba(255,255,255,0.00)');
      grad.addColorStop(0.40, 'rgba(200,220,255,0.05)');
      grad.addColorStop(0.50, 'rgba(180,200,255,0.10)');
      grad.addColorStop(0.60, 'rgba(200,220,255,0.05)');
      grad.addColorStop(1.00, 'rgba(255,255,255,0.00)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
      const veil = ctx.createRadialGradient(w*0.65, h*0.35, 0, w*0.65, h*0.35, Math.max(w,h)*0.8);
      veil.addColorStop(0, 'rgba(0,207,255,0.05)'); veil.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = veil; ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation = 'source-over';
    }
    function tick(){
      t += 0.016;
      ctx.clearRect(0,0,w,h);
      const light = document.body.classList.contains('light');
      ctx.fillStyle = light ? 'rgba(246,247,249,1)' : 'rgba(15,17,21,1)';
      ctx.fillRect(0,0,w,h);
      ctx.save(); ctx.fillStyle = '#fff';
      for(const s of stars){
        const flicker = 0.65 + 0.35*Math.sin(t*s.tw + s.phase);
        const r = Math.max(0.6, s.r * flicker);
        ctx.globalAlpha = 0.4 + 0.6*flicker;
        ctx.beginPath(); ctx.arc(s.x, s.y + Math.sin((s.x/w)*2*Math.PI + t*0.03)*2, r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
      drawMilkyWay();
      animId = requestAnimationFrame(tick);
    }
    function start(){
      if(!document.body.classList.contains('stars-on')) return;
      cancelAnimationFrame(animId);
      cvs.style.display = 'block';
      resize(); tick();
    }
    function stop(){ cancelAnimationFrame(animId); ctx.clearRect(0,0,w,h); cvs.style.display = 'none'; }
    window.addEventListener('resize', ()=> document.body.classList.contains('stars-on') && resize());
    __XR_STARS = { start, stop };
  })();
}
function applyAmbient(){
  const mode = localStorage.getItem(AMBIENT_KEY) || 'off';
  if(mode === 'fog') ensureFogMask();
  if(mode === 'stars') ensureStarsCanvas();
  document.body.classList.toggle('fog-on',   mode === 'fog');
  document.body.classList.toggle('stars-on', mode === 'stars');
  if(__XR_STARS){ if(mode === 'stars') __XR_STARS.start(); else __XR_STARS.stop(); }
}
function cycleAmbient(){
  const cur = localStorage.getItem(AMBIENT_KEY) || 'off';
  const next = cur === 'off' ? 'fog' : cur === 'fog' ? 'stars' : 'off';
  localStorage.setItem(AMBIENT_KEY, next);
  applyAmbient();
}
function bindAmbientToggle(){
  applyAmbient();
  const btn = document.getElementById('ambientToggle');
  if(btn) btn.onclick = cycleAmbient;
}

/* ========= Keep nav consistent: force TV -> Chill ========= */
function normalizeNav(){
  document.querySelectorAll('#primaryNav a').forEach(a=>{
    const href = (a.getAttribute('href') || '').toLowerCase();
    const label = (a.textContent || '').trim().toLowerCase();
    if(href === 'tv.html' || label === 'tv'){
      a.setAttribute('href','chill.html');
      a.textContent = 'Chill';
    }
  });
}

/* ========= Helpers for TradingView embeds ========= */
function safeParseJSON(text, fallback={}){ try { return JSON.parse(text); } catch(e){ return fallback; } }
function ensureCachedConfig(container){
  if(container.dataset.tvCfg) return;
  const scriptWithJSON = Array.from(container.querySelectorAll('script'))
    .find(s => s.textContent && s.textContent.trim().startsWith('{'));
  const cfg = scriptWithJSON ? safeParseJSON(scriptWithJSON.textContent.trim(), {}) : {};
  container.dataset.tvCfg = JSON.stringify(cfg);
}
function resetContainer(container){
  const copyright = container.querySelector('.tradingview-widget-copyright');
  const copyrightHTML = copyright ? copyright.outerHTML : '';
  container.innerHTML = `<div class="tradingview-widget-container__widget"></div>${copyrightHTML}`;
}
function injectTV(container, scriptSrc, mergedCfg){
  const s = document.createElement('script');
  s.src = scriptSrc; s.async = true; s.setAttribute('data-tv','1');
  s.text = JSON.stringify(mergedCfg);
  container.appendChild(s);
}
function rebuildOneWidget(container, scriptSrc, themeOverrides){
  ensureCachedConfig(container);
  const base = safeParseJSON(container.dataset.tvCfg || '{}', {});
  const merged = Object.assign({}, base, themeOverrides);
  resetContainer(container);
  injectTV(container, scriptSrc, merged);
}

/* ========= Ticker tapes ========= */
let tapesBuilt = false;
function buildTickerTapes(theme, force=false){
  const cryptoHost = document.getElementById('cryptoTape');
  const stocksHost = document.getElementById('stocksTape');
  if(!cryptoHost && !stocksHost) return;
  if(force || !tapesBuilt){
    if(cryptoHost) cryptoHost.innerHTML = '';
    if(stocksHost) stocksHost.innerHTML = '';
    const addTape = (host, symbols)=>{
      const wrap = document.createElement('div');
      wrap.className = 'tradingview-widget-container';
      wrap.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
      const s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
      s.async = true;
      s.text = JSON.stringify({
        symbols, showSymbolLogo:true, displayMode:"adaptive", isTransparent:false,
        colorTheme: theme, locale:"en"
      });
      wrap.appendChild(s);
      host.appendChild(wrap);
    };
    if(cryptoHost){
      addTape(cryptoHost, [
        {"proName":"BINANCE:BTCUSDT","title":"BTC"},
        {"proName":"BINANCE:ETHUSDT","title":"ETH"},
        {"proName":"BINANCE:BNBUSDT","title":"BNB"},
        {"proName":"BINANCE:XRPUSDT","title":"XRP"},
        {"proName":"BINANCE:SOLUSDT","title":"SOL"},
        {"proName":"BINANCE:DOGEUSDT","title":"DOGE"},
        {"proName":"BINANCE:TONUSDT","title":"TON"},
        {"proName":"BINANCE:WLFIUSDT","title":"WLFI"},
        {"proName":"BINANCE:ADAUSDT","title":"ADA"},
        {"proName":"BINANCE:AVAXUSDT","title":"AVAX"},
        {"proName":"BINANCE:SHIBUSDT","title":"SHIB"},
        {"proName":"BINANCE:TRXUSDT","title":"TRX"},
        {"proName":"BINANCE:DOTUSDT","title":"DOT"},
        {"proName":"BINANCE:LINKUSDT","title":"LINK"},
        {"proName":"BINANCE:POLUSDT","title":"POL"},
        {"proName":"BINANCE:LTCUSDT","title":"LTC"},
        {"proName":"BINANCE:NEARUSDT","title":"NEAR"},
        {"proName":"BINANCE:XLMUSDT","title":"XLM"},
        {"proName":"BINANCE:ATOMUSDT","title":"ATOM"},
        {"proName":"BINANCE:AAVEUSDT","title":"AAVE"},
        {"proName":"BINANCE:SUIUSDT","title":"SUI"},
        {"proName":"BINANCE:ALGOUSDT","title":"ALGO"},
        {"proName":"BINANCE:PEPEUSDT","title":"PEPE"},
        {"proName":"BINANCE:USDCUSDT","title":"USDC"},
        {"proName":"BINANCE:FDUSDUSDT","title":"FDUSD"},
        {"proName":"OKX:OKBUSDT","title":"OKB"},
        {"proName":"OKX:ZETAUSDT","title":"ZETA"},
        {"proName":"BINANCE:CETUSUSDT","title":"CETUS"},
        {"proName":"BINANCE:BONKUSDT","title":"BONK"},
        {"proName":"OKX:HYPEUSDT","title":"HYPE"},
        {"proName":"BYBIT:HYPEUSDT","title":"HYPE"}
      ]);
    }
    if(stocksHost){
      addTape(stocksHost, [
        {"proName":"SP:SPX","title":"S&P 500"},
        {"proName":"DJX:DJI","title":"DOW"},
        {"proName":"NASDAQ:IXIC","title":"Nasdaq"},
        {"proName":"AMEX:SPY","title":"SPY"},
        {"proName":"NASDAQ:QQQ","title":"QQQ"},
        {"proName":"AMEX:DIA","title":"DIA"},
        {"proName":"TVC:VIX","title":"VIX"},
        {"proName":"NASDAQ:NVDA","title":"NVDA"},
        {"proName":"NASDAQ:SMCI","title":"SMCI"},
        {"proName":"NASDAQ:PLTR","title":"PLTR"},
        {"proName":"NASDAQ:AMD","title":"AMD"},
        {"proName":"NASDAQ:INTC","title":"INTC"},
        {"proName":"NASDAQ:TSLA","title":"TSLA"},
        {"proName":"NASDAQ:GOOGL","title":"GOOGL"},
        {"proName":"NASDAQ:AMZN","title":"AMZN"},
        {"proName":"NASDAQ:AAPL","title":"AAPL"},
        {"proName":"NASDAQ:MSFT","title":"MSFT"},
        {"proName":"NYSE:BRK.B","title":"BRK.B"},
        {"proName":"NYSE:WMT","title":"WMT"},
        {"proName":"NYSE:JPM","title":"JPM"},
        {"proName":"NYSE:V","title":"V"},
        {"proName":"NYSE:PG","title":"PG"},
        {"proName":"NASDAQ:COIN","title":"COIN"},
        {"proName":"NASDAQ:MSTR","title":"MSTR"},
        {"proName":"NASDAQ:MARA","title":"MARA"},
        {"proName":"NASDAQ:RIOT","title":"RIOT"},
        {"proName":"AMEX:IBIT","title":"IBIT"},
        {"proName":"AMEX:FBTC","title":"FBTC"},
        {"proName":"AMEX:WGMI","title":"WGMI"}
      ]);
    }
    tapesBuilt = true;
  }
}
function rebuildTickerTapes(){ buildTickerTapes(getTheme(), true); }

/* ========= TV Rebuilders ========= */
function rebuildAdvancedChart(container){
  if(!container) return;
  ensureCachedConfig(container);
  const theme = getTheme();
  const base = safeParseJSON(container.dataset.tvCfg || '{}', {});
  const merged = Object.assign({}, base, {
    theme,
    backgroundColor: theme === 'light' ? '#ffffff' : '#0f1115',
    gridColor: theme === 'light' ? 'rgba(46,46,46,0.06)' : 'rgba(255,255,255,0.06)'
  });
  resetContainer(container);
  injectTV(container, 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js', merged);
}
function rebuildWidgetsIn(root){
  if(!root) return;
  const theme = getTheme();
  root.querySelectorAll('[data-tv="advchart"]').forEach(wrap=> rebuildAdvancedChart(wrap));
  root.querySelectorAll('[data-tv="screener"]').forEach(wrap=>{
    rebuildOneWidget(wrap,'https://s3.tradingview.com/external-embedding/embed-widget-screener.js',{ colorTheme: theme, isTransparent: false });
  });
  root.querySelectorAll('[data-tv="crypto-heatmap"]').forEach(wrap=>{
    rebuildOneWidget(wrap,'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js',{ colorTheme: theme });
  });
  root.querySelectorAll('[data-tv="stock-heatmap"]').forEach(wrap=>{
    rebuildOneWidget(wrap,'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',{ colorTheme: theme });
  });
}
function refreshTimelines(root){
  if(!root) return;
  root.querySelectorAll('[data-tv="timeline"] iframe').forEach(f=>{ if(f && f.src){ try { f.src = f.src; } catch(e) {} }});
}
function ensureMounted(root, tries=2){
  const ok = () => root.querySelector('iframe[src*="tradingview"]');
  if(ok()) return;
  if(tries<=0) return;
  setTimeout(()=>{ rebuildWidgetsIn(root); ensureMounted(root, tries-1); }, 220);
}

/* ========= Symbol mapping ========= */
const preferredExchange = 'BINANCE';
const defaultQuote = 'USDT';
function mapShortToSymbol(raw){
  if(!raw) return null;
  const s = raw.trim().toUpperCase();
  if(s.includes(':')) return s;
  if(/USDT$/.test(s)) return `${preferredExchange}:${s}`;
  return `${preferredExchange}:${s}${defaultQuote}`;
}
window.mapShortToSymbol = mapShortToSymbol;

/* ========= Home / Markets helpers ========= */
function getHomeAdvRoot(){
  return (
    document.querySelector('#chart [data-tv="advchart"]') ||
    document.querySelector('#adv-chart-wrap[data-tv="advchart"]') ||
    document.querySelector('.tradingview-widget-container[data-tv="advchart"]')
  );
}
function swapHomeAdvancedSymbol(symbol){
  const adv = getHomeAdvRoot();
  if(!adv) return;
  ensureCachedConfig(adv);
  const cfg = safeParseJSON(adv.dataset.tvCfg || '{}', {});
  cfg.symbol = symbol;
  adv.dataset.tvCfg = JSON.stringify(cfg);
  rebuildAdvancedChart(adv);
  const h1 = document.querySelector('#chart h1');
  if(h1) h1.textContent = symbol.replace(/^.*:/,'') + ' — Advanced Chart';
  const chartSection = document.getElementById('chart');
  if(chartSection) chartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function mapMarketSymbol(raw){
  if(!raw) return null;
  const s = raw.trim().toUpperCase();
  if(s.includes(':')) return s;
  if(/USDT$/.test(s)) return 'BINANCE:' + s;
  const amex = new Set(['SPY','DIA','QQQ','IBIT','FBTC','WGMI']);
  if(amex.has(s)) return 'AMEX:' + s;
  return 'NASDAQ:' + s;
}
function setMarketsChartSymbol(symbol){
  const adv = document.getElementById('adv-chart-wrap') || document.querySelector('#chart [data-tv="advchart"]');
  if(!adv) return;
  ensureCachedConfig(adv);
  const cfg = safeParseJSON(adv.dataset.tvCfg || '{}', {});
  cfg.symbol = symbol;
  adv.dataset.tvCfg = JSON.stringify(cfg);
  rebuildAdvancedChart(adv);
  const titleEl = document.querySelector('#chart h1');
  if(titleEl) titleEl.textContent = symbol.split(':').pop() + ' — Advanced Chart';
}

/* ========= Watchlist storage ========= */
const WL_KEY = 'xr_watchlist';
const WL = {
  get(){ return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); },
  set(arr){ localStorage.setItem(WL_KEY, JSON.stringify(arr)); },
  add(sym){ const s = this.get(); if(!s.includes(sym)){ s.push(sym); this.set(s);} },
  remove(sym){ this.set(this.get().filter(x=>x!==sym)); },
  clear(){ this.set([]); }
};
window.WL = WL;

/* ========= Deep-link to Home chart ========= */
function parseHashQuery(){
  const h = location.hash || '';
  if(!h) return {};
  const raw = h.startsWith('#?') ? h.slice(2) : h.startsWith('#') ? h.slice(1) : h;
  const qp = new URLSearchParams(raw);
  const obj = {}; qp.forEach((v,k)=> obj[k] = v);
  return obj;
}
function applyHomeDeepLink(){
  const onHome = !!getHomeAdvRoot();
  if(!onHome) return;
  const hp = parseHashQuery();
  const fromHash = hp.symbol && hp.symbol.trim();
  const fromSession = sessionStorage.getItem('xr_symbol');
  const raw = fromHash || fromSession;
  if(!raw) return;
  if(fromSession) sessionStorage.removeItem('xr_symbol');
  const sym = mapShortToSymbol(raw);
  if(sym) swapHomeAdvancedSymbol(sym);
}

/* ========= News via Worker ========= */
async function loadNewsFromWorker() {
  const cfgEl = document.getElementById('news-config');
  const { workerBase } = cfgEl ? safeParseJSON(cfgEl.textContent || '{}') : {};
  const cryptoList = document.getElementById('newsListCrypto');
  const marketList = document.getElementById('newsListMarkets');
  const stampEl = document.getElementById('newsUpdatedAt');
  if (!cryptoList || !marketList) return;
  if (!workerBase) {
    const msg = '<li>Worker URL not set. Edit the <code>news-config</code> script in index.html.</li>';
    cryptoList.innerHTML = marketList.innerHTML = msg;
    return;
  }
  cryptoList.innerHTML = '<li>Loading…</li>';
  marketList.innerHTML = '<li>Loading…</li>';

  const CRYPTO_FEEDS = [
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://cointelegraph.com/rss',
    'https://www.theblock.co/rss.xml',
    'https://decrypt.co/feed',
    'https://cryptoslate.com/feed/',
    'https://bitcoinmagazine.com/feed',
    'https://messari.io/rss',
    'https://coinpedia.org/feed/',
    'https://cryptopotato.com/feed/'
  ];
  const MARKET_FEEDS = [
    'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    'https://www.reuters.com/markets/rss',
    'https://finance.yahoo.com/news/rssindex',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://apnews.com/hub/apf-business?output=rss',
    'https://www.ft.com/markets/rss',
    'https://feeds.nbcnews.com/nbcnews/public/business',
    'https://feeds.foxbusiness.com/foxbusiness/latest',
    'https://rss.cnn.com/rss/money_latest.rss',
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml'
  ];

  const parseFeed = (xmlText) => {
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('XML parse error');
    const items = [];
    xml.querySelectorAll('item').forEach(it => {
      const title = it.querySelector('title')?.textContent?.trim() || '';
      const link = it.querySelector('link')?.textContent?.trim() || '#';
      const pubDate =
        it.querySelector('pubDate')?.textContent ||
        it.querySelector('dc\\:date')?.textContent || '';
      const date = pubDate ? new Date(pubDate) : new Date();
      if (title && link) items.push({ title, link, date });
    });
    xml.querySelectorAll('entry').forEach(it => {
      const title = it.querySelector('title')?.textContent?.trim() || '';
      const link = it.querySelector('link')?.getAttribute('href') || '#';
      const pubDate =
        it.querySelector('updated')?.textContent ||
        it.querySelector('published')?.textContent || '';
      const date = pubDate ? new Date(pubDate) : new Date();
      if (title && link) items.push({ title, link, date });
    });
    return items;
  };

  async function loadGroup(feeds) {
    const out = [];
    for (const url of feeds) {
      try {
        const r = await fetch(workerBase + encodeURIComponent(url), { cache: 'no-store' });
        if (!r.ok) throw new Error(`${r.status}`);
        const txt = await r.text();
        out.push(...parseFeed(txt));
      } catch (e) {
        console.warn('Feed failed', url, e);
      }
    }
    return out.sort((a,b)=>b.date-a.date);
  }

  const [cryptoItems, marketItems] = await Promise.all([
    loadGroup(CRYPTO_FEEDS),
    loadGroup(MARKET_FEEDS)
  ]);

  const render = (arr) =>
    (arr.slice(0, 30).map(i =>
      `<li><a href="${i.link}" target="_blank" rel="noopener">${i.title}</a><time>${i.date.toLocaleString()}</time></li>`
    ).join('')) || '<li>No items returned.</li>';

  cryptoList.innerHTML = render(cryptoItems);
  marketList.innerHTML = render(marketItems);
  if (stampEl) stampEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

/* ========= Twitch parent fixer ========= */
function fixTwitchParents(){
  const host = location.hostname || 'localhost';
  const defaults = ['xraycrypto.io','localhost'];
  const parents = new Set([...defaults, host].filter(Boolean));
  document.querySelectorAll('iframe[data-twitch-src]').forEach(f=>{
    try{
      const u = new URL(f.getAttribute('data-twitch-src'));
      u.searchParams.delete('parent');
      parents.forEach(p => u.searchParams.append('parent', p));
      const next = u.toString();
      if (f.src !== next) f.src = next;
    }catch(e){}
  });
}

/* ========= FULLSCREEN CHART (shared for all pages) ========= */
function tvPumpResize(){
  window.dispatchEvent(new Event('resize'));
  setTimeout(()=>window.dispatchEvent(new Event('resize')), 150);
}
function bindChartFullscreen(){
  const expandBtn = document.getElementById('chartExpand');   // header button
  const closeBtn  = document.getElementById('chartFsClose');  // inside #chart .card

  function enterFS(){
    document.body.classList.add('chart-fullscreen');
    if(expandBtn){
      expandBtn.setAttribute('aria-pressed','true');
      expandBtn.textContent = '⤡';
      expandBtn.title = 'Close chart';
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    tvPumpResize();
  }
  function exitFS(){
    document.body.classList.remove('chart-fullscreen');
    if(expandBtn){
      expandBtn.setAttribute('aria-pressed','false');
      expandBtn.textContent = '⤢';
      expandBtn.title = 'Expand chart to fullscreen';
    }
    tvPumpResize();
  }
  function toggleFS(){ document.body.classList.contains('chart-fullscreen') ? exitFS() : enterFS(); }

  if(expandBtn) expandBtn.onclick = toggleFS;
  if(closeBtn)  closeBtn.onclick  = exitFS;
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') exitFS(); });

  // keep header button label consistent on SPA back/forward
  window.addEventListener('pageshow', ()=>{
    const on = document.body.classList.contains('chart-fullscreen');
    if(expandBtn){
      expandBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      expandBtn.textContent = on ? '⤡ Close' : '⤢ Expand';
    }
  });
}

/* ========= Bind header controls ========= */
function bindHeaderControls(){
  applyThemeToDOM();
  normalizeNav();
  bindAmbientToggle();

  const themeBtn = document.getElementById('themeToggle');
  if(themeBtn){
    themeBtn.onclick = ()=>{
      setTheme(getTheme()==='light' ? 'dark' : 'light');
      applyThemeToDOM();
      rebuildTickerTapes();
      rebuildWidgetsIn(document.getElementById('pageMain'));
      loadNewsFromWorker();
    };
  }

  const refreshBtn = document.getElementById('newsRefresh');
  if (refreshBtn) refreshBtn.onclick = () => { loadNewsFromWorker(); };

  const tabsEl = document.getElementById('newsTabs') || document.querySelector('#news .tabs');
  if (tabsEl) {
    tabsEl.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-tab]');
      if(!btn) return;
      const tab = btn.dataset.tab; // 'crypto' | 'markets'
      tabsEl.querySelectorAll('button[data-tab]').forEach(b=>{
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#news [data-tab-panel]').forEach(panel=>{
        panel.classList.toggle('hidden', panel.getAttribute('data-tab-panel') !== tab);
      });
    });
  }

  /* HOME: Open button */
  const homeForm = document.getElementById('symbolForm');
  if(homeForm){
    homeForm.onsubmit = (e)=>{
      e.preventDefault();
      const inp = document.getElementById('symbolInput');
      const sym = mapShortToSymbol(inp && inp.value || '');
      if(!sym) return;
      swapHomeAdvancedSymbol(sym);
      if(inp) inp.value = '';
    };
  }

  /* MARKETS: Open button */
  const mForm = document.getElementById('marketSymbolForm');
  if(mForm){
    mForm.onsubmit = (e)=>{
      e.preventDefault();
      const inp = document.getElementById('marketSymbolInput');
      const sym = mapMarketSymbol(inp && inp.value || '');
      if(!sym) return;
      setMarketsChartSymbol(sym);
      if(inp) inp.value = '';
    };
  }

  /* Watchlist: add symbol */
  const addBtn = document.getElementById('wlAdd');
  if(addBtn){
    addBtn.onclick = ()=>{
      const raw = document.getElementById('wlInput')?.value || '';
      const sym = mapShortToSymbol(raw);
      if(!sym) return;
      WL.add(sym);
      const inp = document.getElementById('wlInput');
      if(inp) inp.value = '';
      window.dispatchEvent(new CustomEvent('wl-updated'));
    };
  }

  /* Tip copy */
  const copyBtn = document.getElementById('tipCopy');
  if(copyBtn){
    copyBtn.onclick = ()=>{
      const addr = document.getElementById('tipAddress')?.textContent?.trim();
      if(!addr) return;
      navigator.clipboard.writeText(addr).catch(()=>{});
      copyBtn.textContent = 'Copied!';
      setTimeout(()=> copyBtn.textContent = 'Copy', 1200);
    };
  }

  fixTwitchParents();
  bindChartFullscreen();  // <— hook up the shared fullscreen logic
}

/* ==== ChillZone effects ==== */
function bindChillZoneEffects() {
  document.querySelectorAll('.video-frame').forEach(frame => {
    frame.addEventListener('click', () => { frame.classList.add('playing'); }, { capture: true });
  });
  const brand = document.querySelector('.topbar .brand');
  if (brand) {
    if (!brand.querySelector('.woof-bubble')) {
      const b = document.createElement('span');
      b.className = 'woof-bubble';
      b.textContent = 'woof!';
      b.setAttribute('aria-hidden', 'true');
      brand.style.position = 'relative';
      brand.appendChild(b);
    }
    const logo = brand.querySelector('.logo');
    if (logo) {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        brand.classList.add('woof');
        setTimeout(() => brand.classList.remove('woof'), 1200);
      });
    }
  }
}

/* ========= Init ========= */
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    const mode = localStorage.getItem(AMBIENT_KEY) || 'off';
    if(mode === 'fog') ensureFogMask();
    if(mode === 'stars') ensureStarsCanvas();

    buildTickerTapes(getTheme());
    bindHeaderControls();
    normalizeNav();
    const mainRoot = document.getElementById('pageMain');
    rebuildWidgetsIn(mainRoot);
    ensureMounted(mainRoot);

    loadNewsFromWorker();

    const hasNewsLists = document.getElementById('newsListCrypto') && document.getElementById('newsListMarkets');
    if (hasNewsLists) setInterval(()=> loadNewsFromWorker(), 300000);
  }catch(e){ console.error('Init failed:', e); }

  document.querySelectorAll('iframe').forEach(f => {
    const h = parseInt(f.getAttribute('height') || '0', 10);
    if(!isNaN(h) && h > 0 && h < 320) f.setAttribute('height','360');
  });

  applyHomeDeepLink();
  bindChillZoneEffects();
  fixTwitchParents();
  applyAmbient();

  /* Mobile menu */
  try{
    const menuBtn = document.getElementById('menuToggle');
    const nav = document.getElementById('primaryNav');
    function closeMenu(){
      if(!nav) return;
      nav.classList.remove('open');
      if(menuBtn) menuBtn.setAttribute('aria-expanded','false');
    }
    function toggleMenu(){
      if(!nav) return;
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      if(menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if(menuBtn && nav){
      menuBtn.addEventListener('click', toggleMenu);
      nav.addEventListener('click', (e)=>{ if(e.target.matches('a')) closeMenu(); });
      document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeMenu(); });
    }
  }catch(e){ console.error('Menu init failed:', e); }
});

/* ========= Soft Navigation (SPA-lite) ========= */
(function(){
  const MAIN_ID = 'pageMain';
  const prefetchCache = new Map();

  function setActiveNav(url){
    const file = (new URL(url, location.href).pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav a').forEach(a=>{
      a.classList.toggle('active', (a.getAttribute('href')||'').toLowerCase() === file);
    });
  }

  async function fetchNext(url){
    if(prefetchCache.has(url)) return prefetchCache.get(url);
    const res = await fetch(url, { credentials: 'same-origin' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const html = await res.text();
    prefetchCache.set(url, html);
    return html;
  }

  function extract(html){
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = doc.getElementById(MAIN_ID);
    const nextTitle = doc.querySelector('title')?.textContent || document.title;
    const nextHeaderControls = doc.getElementById('headerControls');
    return { nextMain, nextHeaderControls, nextTitle };
  }

  function executeInlineScripts(container){
    container.querySelectorAll('script').forEach(old=>{
      const s = document.createElement('script');
      if(old.src){ s.src = old.src; s.async = old.async; s.defer = old.defer; }
      else { s.textContent = old.textContent; }
      if(old.type) s.type = old.type;
      old.replaceWith(s);
    });
  }

  async function softNavigate(url, opts={push:true}){
    try{
      const html = await fetchNext(url);
      const { nextMain, nextHeaderControls, nextTitle } = extract(html);
      if(!nextMain || !nextHeaderControls) throw new Error('Missing main/headerControls');

      const theme = getTheme() === 'light' ? 'light' : 'dark';
      const tmpDoc = new DOMParser().parseFromString(html, 'text/html');
      const incomingBodyClass = (tmpDoc.body && tmpDoc.body.className) || '';
      const kept = document.body.className
        .split(/\s+/)
        .filter(c => c && !/-page$/.test(c) && c !== 'light' && c !== 'dark');
      document.body.className = kept.join(' ');
      incomingBodyClass.split(/\s+/).forEach(c => { if (c) document.body.classList.add(c); });
      document.body.classList.add(theme);

      const currentMain = document.getElementById(MAIN_ID);

      const currentHC = document.getElementById('headerControls');
      if(currentHC) currentHC.replaceWith(nextHeaderControls);
      bindHeaderControls();
      normalizeNav();

      currentMain.replaceWith(nextMain);
      executeInlineScripts(nextMain);

      requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
        rebuildWidgetsIn(nextMain);
        ensureMounted(nextMain);
        loadNewsFromWorker();
        bindChillZoneEffects();
        fixTwitchParents();
        bindHeaderControls();
        applyAmbient();
      }); });

      document.title = nextTitle;
      setActiveNav(url);
      window.scrollTo({ top: 0, behavior: 'auto' });

      const parsed = new URL(url, location.href);
      const file = (parsed.pathname.split('/').pop() || 'index.html').toLowerCase();
      requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
        const hasHashSymbol = (parsed.hash && /symbol=/i.test(parsed.hash));
        if(file === 'index.html' && hasHashSymbol) {
          applyHomeDeepLink();
        }
        if(file === 'watchlist.html') {
          setTimeout(() => window.dispatchEvent(new CustomEvent('wl-updated')), 180);
        }
      }); });

      if(opts.push) history.pushState({ url }, '', url);
    }catch(err){
      console.warn('[SoftNav] Hard nav fallback:', err?.message || err);
      location.href = url;
    }
  }

  document.addEventListener('mouseover', (e)=>{
    const a = e.target.closest('#primaryNav a, .brand, a[data-softnav]');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
    const url = new URL(href, location.href).toString();
    if(!prefetchCache.has(url)) fetchNext(url).catch(()=>{});
  });
  document.addEventListener('focusin', (e)=>{
    const a = e.target.closest('#primaryNav a, .brand, a[data-softnav]');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
    const url = new URL(href, location.href).toString();
    if(!prefetchCache.has(url)) fetchNext(url).catch(()=>{});
  });

  document.addEventListener('click', (e)=>{
    const headerLink = e.target.closest('#primaryNav a, .brand, a[data-softnav]');
    const a = headerLink;
    if(!a) return;
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('http') || href.startsWith('mailto:')) return;
    if(href.startsWith('#')) return;
    e.preventDefault();
    softNavigate(href, { push:true });
  });

  window.addEventListener('popstate', (e)=>{
    const url = (e.state && e.state.url) ? e.state.url : location.href;
    softNavigate(url, { push:false });
  });

  if(!history.state) history.replaceState({ url: location.href }, '', location.href);

  /* === GLOBAL helper: open on Home from anywhere === */
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-open-home]');
    if(!btn) return;
    e.preventDefault();
    const raw = btn.getAttribute('data-open-home') || btn.dataset.symbol || '';
    if(!raw) return;
    sessionStorage.setItem('xr_symbol', raw);
    const dest = 'index.html#?symbol=' + encodeURIComponent(raw);
    const a = document.createElement('a');
    a.href = dest; a.setAttribute('data-softnav','');
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  /* ===== Global: copy-to-clipboard for [data-copy] ===== */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;

    e.preventDefault();
    const sel = btn.getAttribute('data-copy');
    const el  = sel && document.querySelector(sel);
    const text = (el?.textContent || el?.value || '').trim();
    if (!text) return;

    async function flash(label) {
      const original = btn.textContent;
      btn.textContent = label;
      setTimeout(() => (btn.textContent = original || 'Copy'), 1200);
    }

    try {
      await navigator.clipboard.writeText(text);
      flash('Copied!');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        flash('Copied!');
      } catch {
        flash('Failed');
      } finally {
        document.body.removeChild(ta);
      }
    }
  });

})(); // end Soft Navigation IIFE
