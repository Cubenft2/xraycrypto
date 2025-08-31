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

/* ========= Helpers ========= */
function safeParseJSON(text, fallback={}){
  try { return JSON.parse(text); } catch(e){ return fallback; }
}

/**
 * Capture & cache the base config for a TradingView container.
 * We read the FIRST inline <script> inside the container that has JSON text
 * (that’s how TV’s embed works). We store it on dataset.tvCfg (stringified).
 */
function ensureCachedConfig(container){
  if(container.dataset.tvCfg) return;

  // Find an inline script with JSON config (this is the TV embed script you have in HTML)
  const scriptWithJSON = Array.from(container.querySelectorAll('script'))
    .find(s => s.textContent && s.textContent.trim().startsWith('{'));

  const cfg = scriptWithJSON ? safeParseJSON(scriptWithJSON.textContent.trim(), {}) : {};
  container.dataset.tvCfg = JSON.stringify(cfg);
}

/** Remove every iframe/script inside the container and rebuild a clean skeleton */
function resetContainer(container){
  // Try to keep the copyright block if present
  const copyright = container.querySelector('.tradingview-widget-copyright');
  const copyrightHTML = copyright ? copyright.outerHTML : '';

  // Hard reset (prevents stacking completely)
  container.innerHTML = `<div class="tradingview-widget-container__widget"></div>${copyrightHTML}`;
}

/** Inject a fresh TradingView script with the merged config */
function injectTV(container, scriptSrc, mergedCfg){
  const s = document.createElement('script');
  s.src = scriptSrc;
  s.async = true;
  s.setAttribute('data-tv','1');
  s.text = JSON.stringify(mergedCfg);
  container.appendChild(s);
}

/** Generic rebuild for a TV widget container */
function rebuildOneWidget(container, scriptSrc, themeOverrides){
  ensureCachedConfig(container);
  const base = safeParseJSON(container.dataset.tvCfg || '{}', {});
  const merged = Object.assign({}, base, themeOverrides);
  resetContainer(container);
  injectTV(container, scriptSrc, merged);
}

/* ========= Rebuild all widgets on the page ========= */
let rebuildTimer = null;
function rebuildAllWidgets(){
  // Debounce to avoid double-injection on rapid toggles
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(()=>{
    const theme = getTheme();

    // Ticker tape
    document.querySelectorAll('[data-tv="ticker"]').forEach(wrap=>{
      rebuildOneWidget(
        wrap,
        'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js',
        { colorTheme: theme, isTransparent: false }
      );
    });

    // Advanced chart
    document.querySelectorAll('[data-tv="advchart"]').forEach(wrap=>{
      rebuildOneWidget(
        wrap,
        'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
        {
          theme: theme,
          backgroundColor: theme === 'light' ? '#ffffff' : '#0f1115',
          gridColor: theme === 'light' ? 'rgba(46,46,46,0.06)' : 'rgba(255,255,255,0.06)'
        }
      );
    });

    // Screeners
    document.querySelectorAll('[data-tv="screener"]').forEach(wrap=>{
      rebuildOneWidget(
        wrap,
        'https://s3.tradingview.com/external-embedding/embed-widget-screener.js',
        { colorTheme: theme, isTransparent: false }
      );
    });

    // Crypto heatmap
    document.querySelectorAll('[data-tv="crypto-heatmap"]').forEach(wrap=>{
      rebuildOneWidget(
        wrap,
        'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js',
        { colorTheme: theme }
      );
    });

    // Stock heatmap
    document.querySelectorAll('[data-tv="stock-heatmap"]').forEach(wrap=>{
      rebuildOneWidget(
        wrap,
        'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
        { colorTheme: theme }
      );
    });

    // News timelines
    document.querySelectorAll('[data-tv="timeline"]').forEach(wrap=>{
      rebuildOneWidget(
        wrap,
        'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js',
        { colorTheme: theme, isTransparent: false }
      );
    });
  }, 50);
}

/* ========= Symbol mapping (crypto) ========= */
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

/* Swap Home page advanced chart symbol */
function swapHomeAdvancedSymbol(symbol){
  const adv = document.querySelector('#chart [data-tv="advchart"]');
  if(!adv) return;
  ensureCachedConfig(adv);
  const cfg = safeParseJSON(adv.dataset.tvCfg || '{}', {});
  cfg.symbol = symbol;
  adv.dataset.tvCfg = JSON.stringify(cfg);
  rebuildAllWidgets();

  const h1 = document.querySelector('#chart h1');
  if(h1) h1.textContent = symbol.replace('BINANCE:','') + ' — Advanced Chart';
}

/* ========= Watchlist localStorage ========= */
const WL_KEY = 'xr_watchlist';
const WL = {
  get(){ return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); },
  set(arr){ localStorage.setItem(WL_KEY, JSON.stringify(arr)); },
  add(sym){ const s = this.get(); if(!s.includes(sym)){ s.push(sym); this.set(s);} },
  remove(sym){ this.set(this.get().filter(x=>x!==sym)); },
  clear(){ this.set([]); }
};
window.WL = WL;

/* ========= Markets page helpers ========= */
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
  rebuildAllWidgets();

  const titleEl = document.querySelector('#chart h1');
  if(titleEl) titleEl.textContent = symbol.split(':').pop() + ' — Advanced Chart';
}

/* ========= Init ========= */
document.addEventListener('DOMContentLoaded', ()=>{
  applyThemeToDOM();
  rebuildAllWidgets();

  const btn = document.getElementById('themeToggle');
  if(btn){
    btn.addEventListener('click', ()=>{
      setTheme(getTheme()==='light' ? 'dark' : 'light');
      applyThemeToDOM();
      rebuildAllWidgets();
    });
  }

  // Home: open symbol
  const form = document.getElementById('symbolForm');
  if(form){
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const inp = document.getElementById('symbolInput');
      const sym = mapShortToSymbol(inp.value || '');
      if(!sym) return;
      swapHomeAdvancedSymbol(sym);
      inp.value = '';
    });
  }

  // Markets: open symbol
  const mForm = document.getElementById('marketSymbolForm');
  if(mForm){
    mForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const inp = document.getElementById('marketSymbolInput');
      const sym = mapMarketSymbol(inp.value || '');
      if(!sym) return;
      setMarketsChartSymbol(sym);
      inp.value = '';
    });
  }
});
