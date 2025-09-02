/* ========= Active nav highlight ========= */
(function(){
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav a').forEach(a=>{
    a.classList.toggle('active', a.getAttribute('href').toLowerCase() === file);
  });
})();

/* ========= Theme state ========= */
const THEME_KEY = 'xr_theme';
function getTheme(){ return localStorage.getItem(THEME_KEY) || 'dark'; }
function setTheme(t){ localStorage.setItem(THEME_KEY, t); }
function applyThemeToDOM(){
  const t = getTheme();
  document.body.classList.toggle('light', t === 'light');
  const btn = document.getElementById('themeToggle');
  if(btn) btn.textContent = (t === 'light') ? '🌙 Dark' : '🌞 Light';
}

/* ========= Keep nav consistent: force TV -> Chill everywhere ========= */
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

/* ========= Helpers ========= */
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

/* ========= Two permanent ticker tapes ========= */
function buildTickerTapes(theme, force=false){
  const cryptoHost = document.getElementById('cryptoTape');
  const stocksHost = document.getElementById('stocksTape');

  if(!cryptoHost && !stocksHost) return;

  if(force){
    if(cryptoHost) cryptoHost.innerHTML = '';
    if(stocksHost) stocksHost.innerHTML = '';
    delete document.body.dataset.tapesBuilt;
  }
  if(document.body.dataset.tapesBuilt) return;

  if(cryptoHost){
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    s.async = true;
    s.text = JSON.stringify({
      symbols: [
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
        {"proName":"BINANCE:BONKUSDT","title":"BONK"}
      ],
      showSymbolLogo: true,
      displayMode: "adaptive",
      isTransparent: false,
      colorTheme: theme,
      locale: "en"
    });
    wrap.appendChild(s); cryptoHost.appendChild(wrap);
  }
  if(stocksHost){
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    s.async = true;
    s.text = JSON.stringify({
      symbols: [
        {"proName":"SP:SPX","title":"S&P 500"},
        {"proName":"INDEXDJX:DJI","title":"Dow"},
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
        {"proName":"NYSE:JNJ","title":"JNJ"},
        {"proName":"NYSE:WMT","title":"WMT"},
        {"proName":"NYSE:JPM","title":"JPM"},
        {"proName":"NYSE:V","title":"V"},
        {"proName":"NYSE:PG","title":"PG"},
        {"proName":"NYSE:GS","title":"GS"},
        {"proName":"NASDAQ:COST","title":"COST"},
        {"proName":"NYSE:UNH","title":"UNH"},
        {"proName":"NYSE:HD","title":"HD"},
        {"proName":"NYSE:MCD","title":"MCD"},
        {"proName":"NYSE:NKE","title":"NKE"},
        {"proName":"NYSE:DIS","title":"DIS"},
        {"proName":"NYSE:BABA","title":"BABA"},
        {"proName":"NYSE:CRM","title":"CRM"},
        {"proName":"NASDAQ:PYPL","title":"PYPL"},
        {"proName":"NASDAQ:ADBE","title":"ADBE"},
        {"proName":"NYSE:ORCL","title":"ORCL"},
        {"proName":"NYSE:CVX","title":"CVX"},
        {"proName":"NYSE:XOM","title":"XOM"},
        {"proName":"NYSE:BA","title":"BA"},
        {"proName":"NYSE:CAT","title":"CAT"},
        {"proName":"NYSE:IBM","title":"IBM"},
        {"proName":"NYSE:MMM","title":"MMM"},
        {"proName":"NYSE:GE","title":"GE"},
        {"proName":"NYSE:F","title":"F"},
        {"proName":"NASDAQ:SOFI","title":"SOFI"},
        {"proName":"NYSE:BBAI","title":"BBAI"},

        {"proName":"NASDAQ:COIN","title":"COIN"},
        {"proName":"NASDAQ:MSTR","title":"MSTR"},
        {"proName":"NASDAQ:MARA","title":"MARA"},
        {"proName":"NASDAQ:RIOT","title":"RIOT"},
        {"proName":"AMEX:IBIT","title":"IBIT"},
        {"proName":"AMEX:FBTC","title":"FBTC"},
        {"proName":"AMEX:WGMI","title":"WGMI"}
      ],
      showSymbolLogo: true,
      displayMode: "adaptive",
      isTransparent: false,
      colorTheme: theme,
      locale: "en"
    });
    wrap.appendChild(s); stocksHost.appendChild(wrap);
  }
  document.body.dataset.tapesBuilt = '1';
}
function rebuildTickerTapes(){ buildTickerTapes(getTheme(), true); }

/* ========= Rebuilders for page widgets (not tickers) ========= */
function rebuildAdvancedChart(container){
  if(!container) return;
  ensureCachedConfig(container);
  const theme = getTheme();
  const base = safeParseJSON(container.dataset.tvCfg || '{}', {});
  const merged = Object.assign({}, base, {
    theme: theme,
    backgroundColor: theme === 'light' ? '#ffffff' : '#0f1115',
    gridColor: theme === 'light' ? 'rgba(46,46,46,0.06)' : 'rgba(255,255,255,0.06)'
  });
  resetContainer(container);
  injectTV(container, 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js', merged);
}
function rebuildWidgetsIn(root){
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
  root.querySelectorAll('[data-tv="timeline"]').forEach(wrap=>{
    rebuildOneWidget(wrap,'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js',{ colorTheme: theme, isTransparent: false });
  });
}
/* Ensure widgets actually mounted; retry once if blank */
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
function swapHomeAdvancedSymbol(symbol){
  const adv = document.querySelector('#chart [data-tv="advchart"]');
  if(!adv) return;
  ensureCachedConfig(adv);
  const cfg = safeParseJSON(adv.dataset.tvCfg || '{}', {});
  cfg.symbol = symbol;
  adv.dataset.tvCfg = JSON.stringify(cfg);
  rebuildAdvancedChart(adv);
  const h1 = document.querySelector('#chart h1');
  if(h1) h1.textContent = symbol.replace('BINANCE:','') + ' — Advanced Chart';
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
  const adv = document.getElementById('adv-chart-wrap');
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
  const qIndex = h.indexOf('?');
  if(qIndex === -1) return {};
  const qp = new URLSearchParams(h.slice(qIndex+1));
  const obj = {}; qp.forEach((v,k)=> obj[k] = v);
  return obj;
}
function applyHomeDeepLink(){
  const onHome = document.querySelector('#chart [data-tv="advchart"]');
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

/* ========= Bind header controls (called after swaps) ========= */
function bindHeaderControls(){
  applyThemeToDOM();
  normalizeNav(); // <- ensure header link says Chill, not TV

  const themeBtn = document.getElementById('themeToggle');
  if(themeBtn){
    themeBtn.onclick = ()=>{
      setTheme(getTheme()==='light' ? 'dark' : 'light');
      applyThemeToDOM();
      rebuildTickerTapes();                                   // recolor tapes
      rebuildWidgetsIn(document.getElementById('pageMain'));  // recolor page widgets
    };
  }

  const homeForm = document.getElementById('symbolForm');
  if(homeForm){
    homeForm.onsubmit = (e)=>{
      e.preventDefault();
      const inp = document.getElementById('symbolInput');
      const sym = mapShortToSymbol(inp.value || '');
      if(!sym) return;
      swapHomeAdvancedSymbol(sym);
      inp.value = '';
    };
  }

  const mForm = document.getElementById('marketSymbolForm');
  if(mForm){
    mForm.onsubmit = (e)=>{
      e.preventDefault();
      const inp = document.getElementById('marketSymbolInput');
      const sym = mapMarketSymbol(inp.value || '');
      if(!sym) return;
      setMarketsChartSymbol(sym);
      inp.value = '';
    };
  }

  const addBtn = document.getElementById('wlAdd');
  if(addBtn){
    addBtn.onclick = ()=>{
      const raw = document.getElementById('wlInput').value || '';
      const sym = mapShortToSymbol(raw);
      if(!sym) return;
      WL.add(sym);
      document.getElementById('wlInput').value = '';
      // notify watchlist page to re-render
      window.dispatchEvent(new CustomEvent('wl-updated'));
    };
  }
}

/* ========= Init ========= */
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    buildTickerTapes(getTheme());    // two tapes, mount with current theme
    bindHeaderControls();            // bind current page header controls
    normalizeNav();                  // <- extra safety on initial load
    rebuildWidgetsIn(document.getElementById('pageMain'));
    ensureMounted(document.getElementById('pageMain'));
  }catch(e){ console.error('Init failed:', e); }

  applyHomeDeepLink();

  /* ==== Mobile menu ==== */
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
      nav.addEventListener('click', (e)=>{
        if(e.target.matches('a')) closeMenu();
      });
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
      a.classList.toggle('active', a.getAttribute('href').toLowerCase() === file);
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

      const currentMain = document.getElementById(MAIN_ID);

      // swap header controls first
      const currentHC = document.getElementById('headerControls');
      if(currentHC) currentHC.replaceWith(nextHeaderControls);
      bindHeaderControls();
      normalizeNav(); // <- make sure the nav label/href is Chill

      // swap main
      currentMain.replaceWith(nextMain);
      executeInlineScripts(nextMain);

      requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
        rebuildWidgetsIn(nextMain);
        ensureMounted(nextMain);
      }); });

      document.title = nextTitle;
      setActiveNav(url);
      window.scrollTo({ top: 0, behavior: 'instant' });

      // ===== Page-specific post-actions (delayed so listeners exist) =====
      const parsed = new URL(url, location.href);
      const file = (parsed.pathname.split('/').pop() || 'index.html').toLowerCase();
      requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
        if(file === 'index.html' && parsed.hash.includes('symbol=')) {
          applyHomeDeepLink();
        }
        if(file === 'watchlist.html') {
          setTimeout(() => window.dispatchEvent(new CustomEvent('wl-updated')), 180);
        }
      }); });
      // ===================================================================

      if(opts.push) history.pushState({ url }, '', url);
    }catch(err){
      console.warn('[SoftNav] Hard nav fallback:', err?.message || err);
      location.href = url;
    }
  }

  // Prefetch on hover/focus
  document.addEventListener('mouseover', (e)=>{
    const a = e.target.closest('#primaryNav a, .brand');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
    const url = new URL(href, location.href).toString();
    if(!prefetchCache.has(url)) fetchNext(url).catch(()=>{});
  });
  document.addEventListener('focusin', (e)=>{
    const a = e.target.closest('#primaryNav a, .brand');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
    const url = new URL(href, location.href).toString();
    if(!prefetchCache.has(url)) fetchNext(url).catch(()=>{});
  });

  // Intercept header links
  document.addEventListener('click', (e)=>{
    const headerLink = e.target.closest('#primaryNav a, .brand');
    const softLink = e.target.closest('a[data-softnav]');
    const a = headerLink || softLink;
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
})();
