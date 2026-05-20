/* ============================================================
   SPMS Theme Switcher — spms-theme-switcher.js
   Drop this <script src="js/spms-theme-switcher.js"></script>
   into index.html (before </body>). It self-injects the
   modal, palette chip CSS, and wires the existing moon-icon
   nav-item to open the picker instead of the old toggle.
   ============================================================ */

(function () {
  'use strict';

  /* ── THEME DEFINITIONS ─────────────────────────────────── */
  var THEMES = [
    {
      id: 'dark',
      name: 'Midnight',
      desc: 'deep-dark theme',
      icon: '🌑',
      accent: '#f43f5e',
      vars: {
        '--night': '#07080d',
        '--panel': '#0c0e17',
        '--card':  '#101420',
        '--card2': '#141828',
        '--card3': '#181d2e',
        '--border': 'rgba(255,255,255,0.06)',
        '--borderb': 'rgba(255,255,255,0.11)',
        '--borderc': 'rgba(255,255,255,0.17)',
        '--text':  '#e8eaf2',
        '--text2': '#8892aa',
        '--text3': '#4a5270',
        '--muted': '#3e4560',
        /* accent palette unchanged */
        '--rose':   '#f43f5e',
        '--violet': '#8b5cf6',
        '--green':  '#10b981',
        '--amber':  '#f59e0b',
        '--blue':   '#3b82f6',
        '--cyan':   '#06b6d4',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(244,63,94,0.12)',
        '--violet-d': 'rgba(139,92,246,0.12)',
        '--green-d':  'rgba(16,185,129,0.12)',
        '--amber-d':  'rgba(245,158,11,0.12)',
        '--blue-d':   'rgba(59,130,246,0.12)',
      },
      bodyClass: 'dark-mode',           
      dashClass: 'dark',
    },
    {
      id: 'light',
      name: 'Daylight',
      desc: 'Default Clean white interface',
      icon: '☀️',
      accent: '#f43f5e',
      vars: {
        '--night': '#f1f5f9',
        '--panel': '#ffffff',
        '--card':  '#ffffff',
        '--card2': '#f8fafc',
        '--card3': '#f1f5f9',
        '--border': 'rgba(0,0,0,0.06)',
        '--borderb': 'rgba(0,0,0,0.11)',
        '--borderc': 'rgba(0,0,0,0.17)',
        '--text':  '#0f172a',
        '--text2': '#475569',
        '--text3': '#94a3b8',
        '--muted': '#94a3b8',
        '--rose':   '#f43f5e',
        '--violet': '#8b5cf6',
        '--green':  '#10b981',
        '--amber':  '#f59e0b',
        '--blue':   '#3b82f6',
        '--cyan':   '#06b6d4',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(244,63,94,0.10)',
        '--violet-d': 'rgba(139,92,246,0.10)',
        '--green-d':  'rgba(16,185,129,0.10)',
        '--amber-d':  'rgba(245,158,11,0.10)',
        '--blue-d':   'rgba(59,130,246,0.10)',
      },
      bodyClass: '',    // no extra class — this IS the default dark
      dashClass: '',
    },
    {
      id: 'ocean',
      name: 'Deep Ocean',
      desc: 'Cool teal-blue tones',
      icon: '🌊',
      accent: '#06b6d4',
      vars: {
        '--night': '#020d14',
        '--panel': '#041824',
        '--card':  '#06202e',
        '--card2': '#082536',
        '--card3': '#0a2a3e',
        '--border': 'rgba(6,182,212,0.08)',
        '--borderb': 'rgba(6,182,212,0.14)',
        '--borderc': 'rgba(6,182,212,0.22)',
        '--text':  '#e0f7fa',
        '--text2': '#7dd3e8',
        '--text3': '#3a7a90',
        '--muted': '#2a5a6e',
        '--rose':   '#06b6d4',
        '--violet': '#0ea5e9',
        '--green':  '#10b981',
        '--amber':  '#f59e0b',
        '--blue':   '#0284c7',
        '--cyan':   '#22d3ee',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(6,182,212,0.12)',
        '--violet-d': 'rgba(14,165,233,0.12)',
        '--green-d':  'rgba(16,185,129,0.12)',
        '--amber-d':  'rgba(245,158,11,0.12)',
        '--blue-d':   'rgba(2,132,199,0.12)',
      },
      bodyClass: 'theme-ocean',
      dashClass: 'theme-ocean',
    },
    {
      id: 'forest',
      name: 'Forest',
      desc: 'Rich earthy greens',
      icon: '🌲',
      accent: '#10b981',
      vars: {
        '--night': '#030a06',
        '--panel': '#071510',
        '--card':  '#0a1e13',
        '--card2': '#0d2418',
        '--card3': '#102a1d',
        '--border': 'rgba(16,185,129,0.08)',
        '--borderb': 'rgba(16,185,129,0.14)',
        '--borderc': 'rgba(16,185,129,0.22)',
        '--text':  '#dcfce7',
        '--text2': '#6ee7b7',
        '--text3': '#2e7a52',
        '--muted': '#1e5236',
        '--rose':   '#10b981',
        '--violet': '#34d399',
        '--green':  '#4ade80',
        '--amber':  '#f59e0b',
        '--blue':   '#3b82f6',
        '--cyan':   '#06b6d4',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(16,185,129,0.12)',
        '--violet-d': 'rgba(52,211,153,0.12)',
        '--green-d':  'rgba(74,222,128,0.12)',
        '--amber-d':  'rgba(245,158,11,0.12)',
        '--blue-d':   'rgba(59,130,246,0.12)',
      },
      bodyClass: 'theme-forest',
      dashClass: 'theme-forest',
    },
    {
      id: 'amber',
      name: 'Amber Glow',
      desc: 'Warm amber & gold tones',
      icon: '🔥',
      accent: '#f59e0b',
      vars: {
        '--night': '#0d0800',
        '--panel': '#1a1000',
        '--card':  '#201500',
        '--card2': '#261a00',
        '--card3': '#2c1f00',
        '--border': 'rgba(245,158,11,0.08)',
        '--borderb': 'rgba(245,158,11,0.14)',
        '--borderc': 'rgba(245,158,11,0.22)',
        '--text':  '#fef3c7',
        '--text2': '#fcd34d',
        '--text3': '#78530a',
        '--muted': '#52380a',
        '--rose':   '#f59e0b',
        '--violet': '#f97316',
        '--green':  '#10b981',
        '--amber':  '#fbbf24',
        '--blue':   '#3b82f6',
        '--cyan':   '#06b6d4',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(245,158,11,0.12)',
        '--violet-d': 'rgba(249,115,22,0.12)',
        '--green-d':  'rgba(16,185,129,0.12)',
        '--amber-d':  'rgba(251,191,36,0.12)',
        '--blue-d':   'rgba(59,130,246,0.12)',
      },
      bodyClass: 'theme-amber',
      dashClass: 'theme-amber',
    },
    {
      id: 'violet',
      name: 'Violet Night',
      desc: 'Deep purple cosmic feel',
      icon: '🔮',
      accent: '#8b5cf6',
      vars: {
        '--night': '#06030f',
        '--panel': '#0d0520',
        '--card':  '#120829',
        '--card2': '#170b32',
        '--card3': '#1c0e3b',
        '--border': 'rgba(139,92,246,0.08)',
        '--borderb': 'rgba(139,92,246,0.14)',
        '--borderc': 'rgba(139,92,246,0.22)',
        '--text':  '#ede9fe',
        '--text2': '#c4b5fd',
        '--text3': '#5b3fa0',
        '--muted': '#3d2a72',
        '--rose':   '#8b5cf6',
        '--violet': '#a78bfa',
        '--green':  '#10b981',
        '--amber':  '#f59e0b',
        '--blue':   '#6366f1',
        '--cyan':   '#818cf8',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(139,92,246,0.12)',
        '--violet-d': 'rgba(167,139,250,0.12)',
        '--green-d':  'rgba(16,185,129,0.12)',
        '--amber-d':  'rgba(245,158,11,0.12)',
        '--blue-d':   'rgba(99,102,241,0.12)',
      },
      bodyClass: 'theme-violet',
      dashClass: 'theme-violet',
    },
    {
      id: 'rose',
      name: 'Rose Dusk',
      desc: 'Soft rose & pink hues',
      icon: '🌸',
      accent: '#ec4899',
      vars: {
        '--night': '#0f0309',
        '--panel': '#1e0514',
        '--card':  '#26081c',
        '--card2': '#2e0a22',
        '--card3': '#360c28',
        '--border': 'rgba(236,72,153,0.08)',
        '--borderb': 'rgba(236,72,153,0.14)',
        '--borderc': 'rgba(236,72,153,0.22)',
        '--text':  '#fce7f3',
        '--text2': '#f9a8d4',
        '--text3': '#8f2660',
        '--muted': '#621a42',
        '--rose':   '#ec4899',
        '--violet': '#f472b6',
        '--green':  '#10b981',
        '--amber':  '#f59e0b',
        '--blue':   '#3b82f6',
        '--cyan':   '#06b6d4',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(236,72,153,0.12)',
        '--violet-d': 'rgba(244,114,182,0.12)',
        '--green-d':  'rgba(16,185,129,0.12)',
        '--amber-d':  'rgba(245,158,11,0.12)',
        '--blue-d':   'rgba(59,130,246,0.12)',
      },
      bodyClass: 'theme-rose',
      dashClass: 'theme-rose',
    },
    {
      id: 'slate',
      name: 'Slate Pro',
      desc: 'Professional cool-grey',
      icon: '🪨',
      accent: '#64748b',
      vars: {
        '--night': '#0a0c10',
        '--panel': '#111520',
        '--card':  '#161b2a',
        '--card2': '#1c2233',
        '--card3': '#22283c',
        '--border': 'rgba(100,116,139,0.10)',
        '--borderb': 'rgba(100,116,139,0.18)',
        '--borderc': 'rgba(100,116,139,0.28)',
        '--text':  '#e2e8f0',
        '--text2': '#94a3b8',
        '--text3': '#475569',
        '--muted': '#334155',
        '--rose':   '#38bdf8',
        '--violet': '#818cf8',
        '--green':  '#10b981',
        '--amber':  '#f59e0b',
        '--blue':   '#38bdf8',
        '--cyan':   '#67e8f9',
        '--red':    '#ef4444',
        '--rose-d':   'rgba(56,189,248,0.12)',
        '--violet-d': 'rgba(129,140,248,0.12)',
        '--green-d':  'rgba(16,185,129,0.12)',
        '--amber-d':  'rgba(245,158,11,0.12)',
        '--blue-d':   'rgba(56,189,248,0.12)',
      },
      bodyClass: 'theme-slate',
      dashClass: 'theme-slate',
    },
  ];

  /* ── STORAGE KEY ───────────────────────────────────────── */
  var STORAGE_KEY = 'spms_theme';
  var _currentThemeId = localStorage.getItem(STORAGE_KEY) || 'dark';
  var _modalOpen = false;

  /* ── APPLY THEME ───────────────────────────────────────── */
  function applyTheme(themeId) {
    var theme = THEMES.find(function(t) { return t.id === themeId; });
    if (!theme) return;

    _currentThemeId = themeId;
    localStorage.setItem(STORAGE_KEY, themeId);

    /* remove all theme classes */
    var allClasses = THEMES.map(function(t) { return t.bodyClass; }).filter(Boolean);
    var allDashClasses = THEMES.map(function(t) { return t.dashClass; }).filter(Boolean);
    document.body.classList.remove.apply(document.body.classList, allClasses);

    /* also remove from the dashboard body inside iframe / loaded doc */
    var dashBody = document.querySelector('#mainContent body') || document.body;
    if (dashBody) dashBody.classList.remove.apply(dashBody.classList, allDashClasses);

    /* add new classes */
    if (theme.bodyClass) document.body.classList.add(theme.bodyClass);

    /* apply CSS custom properties to :root (document.documentElement) */
    var root = document.documentElement;
    Object.keys(theme.vars).forEach(function(prop) {
      root.style.setProperty(prop, theme.vars[prop]);
    });

    /* also propagate to any #dashContent or #mainContent iframes */
    propagateToLoadedPages(theme);

    /* update picker chips */
    updatePickerUI(themeId);

    /* fire custom event so dashboard.html / other pages can react */
    document.dispatchEvent(new CustomEvent('spmsThemeChange', { detail: theme }));
  }

  /* ── PROPAGATE to SPA-injected pages ──────────────────── */
  function propagateToLoadedPages(theme) {
    /* SPA content lives inside #mainContent div, not an iframe,
       so setting vars on documentElement already covers it.
       But we also need to handle dashContent if it has its own
       body element (dashboard.html loaded via fetch/innerHTML).
       We'll just dispatch the event — each page listens. */
    var allClasses = THEMES.map(function(t) { return t.dashClass; }).filter(Boolean);

    /* Find all elements that might carry a theme class */
    [document.body, document.querySelector('#dashContent'), document.querySelector('#mainContent')]
      .filter(Boolean)
      .forEach(function(el) {
        allClasses.forEach(function(c) { el.classList.remove(c); });
        if (theme.dashClass) el.classList.add(theme.dashClass);
      });
  }

  /* ── INJECT MODAL HTML ─────────────────────────────────── */
  function injectModal() {
    var el = document.createElement('div');
    el.id = 'spmsThemeModal';
    el.innerHTML = [
      '<div id="spmsThemeOverlay"></div>',
      '<div id="spmsThemePanel">',
      '  <div id="stpHeader">',
      '    <div id="stpTitle">',
      '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
      '      Appearance',
      '    </div>',
      '    <button id="stpClose">✕</button>',
      '  </div>',
      '  <div id="stpSubtitle">Choose your colour theme — changes apply instantly across the entire system.</div>',
      '  <div id="stpGrid"></div>',
      '  <div id="stpFooter">',
      '    <span id="stpCurrentLabel">Current: <strong id="stpCurrentName">—</strong></span>',
      '    <button id="stpDone">Done</button>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(el);

    /* Wire close buttons */
    document.getElementById('spmsThemeOverlay').addEventListener('click', closeModal);
    document.getElementById('stpClose').addEventListener('click', closeModal);
    document.getElementById('stpDone').addEventListener('click', closeModal);

    /* Build theme chips */
    buildGrid();
  }

  function buildGrid() {
    var grid = document.getElementById('stpGrid');
    if (!grid) return;
    grid.innerHTML = '';
    THEMES.forEach(function(theme) {
      var chip = document.createElement('button');
      chip.className = 'stp-chip';
      chip.dataset.themeId = theme.id;
      chip.innerHTML = [
        '<div class="stp-chip-preview" style="background:' + theme.vars['--night'] + ';border-color:' + theme.accent + '">',
        '  <div class="stp-chip-card" style="background:' + theme.vars['--card'] + ';border-color:' + theme.vars['--borderb'] + '"></div>',
        '  <div class="stp-chip-bar" style="background:' + theme.accent + '"></div>',
        '  <div class="stp-chip-bar stp-chip-bar2" style="background:' + theme.vars['--text3'] + '"></div>',
        '  <div class="stp-chip-dot" style="background:' + theme.accent + '"></div>',
        '</div>',
        '<div class="stp-chip-icon">' + theme.icon + '</div>',
        '<div class="stp-chip-name">' + theme.name + '</div>',
        '<div class="stp-chip-desc">' + theme.desc + '</div>',
        '<div class="stp-chip-check">✓</div>',
      ].join('');
      chip.addEventListener('click', function() {
        applyTheme(theme.id);
      });
      grid.appendChild(chip);
    });
  }

  function updatePickerUI(themeId) {
    document.querySelectorAll('.stp-chip').forEach(function(chip) {
      chip.classList.toggle('active', chip.dataset.themeId === themeId);
    });
    var theme = THEMES.find(function(t) { return t.id === themeId; });
    var nameEl = document.getElementById('stpCurrentName');
    if (nameEl && theme) nameEl.textContent = theme.icon + ' ' + theme.name;
  }

  /* ── MODAL OPEN / CLOSE ────────────────────────────────── */
  function openModal() {
    _modalOpen = true;
    var modal = document.getElementById('spmsThemeModal');
    if (modal) {
      modal.classList.add('open');
      updatePickerUI(_currentThemeId);
    }
  }

  function closeModal() {
    _modalOpen = false;
    var modal = document.getElementById('spmsThemeModal');
    if (modal) modal.classList.remove('open');
  }

  /* ── INJECT CSS ────────────────────────────────────────── */
  function injectCSS() {
    var style = document.createElement('style');
    style.id = 'spmsThemeCSS';
    style.textContent = [
      /* overlay */
      '#spmsThemeModal { display:none; }',
      '#spmsThemeModal.open { display:block; }',

      '#spmsThemeOverlay {',
      '  position:fixed; inset:0; background:rgba(0,0,0,.65);',
      '  backdrop-filter:blur(12px); z-index:9000;',
      '}',

      /* panel */
      '#spmsThemePanel {',
      '  position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);',
      '  width:min(760px, 95vw); max-height:90vh; overflow-y:auto;',
      '  background:var(--panel); border:1px solid var(--borderb);',
      '  border-radius:20px; z-index:9001;',
      '  box-shadow:0 32px 80px rgba(0,0,0,.7);',
      '  animation:stpSlideIn .22s cubic-bezier(.34,1.56,.64,1) both;',
      '}',

      '@keyframes stpSlideIn {',
      '  from { opacity:0; transform:translate(-50%,-48%) scale(.95); }',
      '  to   { opacity:1; transform:translate(-50%,-50%) scale(1); }',
      '}',

      /* header */
      '#stpHeader {',
      '  display:flex; align-items:center; justify-content:space-between;',
      '  padding:20px 22px 0;',
      '}',
      '#stpTitle {',
      '  display:flex; align-items:center; gap:8px;',
      '  font-size:16px; font-weight:700; color:var(--text);',
      '}',
      '#stpClose {',
      '  background:var(--card2); border:1px solid var(--border);',
      '  color:var(--text3); border-radius:8px; padding:6px 11px;',
      '  cursor:pointer; font-size:13px; transition:.15s; line-height:1;',
      '}',
      '#stpClose:hover { color:var(--rose); border-color:var(--rose); }',

      '#stpSubtitle {',
      '  font-size:12px; color:var(--text3); padding:8px 22px 16px;',
      '  border-bottom:1px solid var(--border);',
      '}',

      /* grid */
      '#stpGrid {',
      '  display:grid; grid-template-columns:repeat(4,1fr);',
      '  gap:10px; padding:16px;',
      '}',
      '@media(max-width:600px){#stpGrid{grid-template-columns:repeat(2,1fr);}}',

      /* chip */
      '.stp-chip {',
      '  background:var(--card2); border:1.5px solid var(--border);',
      '  border-radius:14px; padding:12px 10px 10px;',
      '  cursor:pointer; transition:.2s; text-align:center;',
      '  position:relative; overflow:hidden;',
      '  font-family:inherit;',
      '}',
      '.stp-chip:hover {',
      '  border-color:var(--borderc); transform:translateY(-2px);',
      '  box-shadow:0 6px 20px rgba(0,0,0,.25);',
      '}',
      '.stp-chip.active {',
      '  border-color:var(--rose); transform:translateY(-3px);',
      '  box-shadow:0 8px 24px rgba(0,0,0,.3);',
      '}',
      '.stp-chip.active::before {',
      '  content:""; position:absolute; top:0; left:0; right:0; height:2px;',
      '  background:linear-gradient(90deg,var(--rose),var(--violet));',
      '}',

      /* chip preview mini-mockup */
      '.stp-chip-preview {',
      '  width:100%; height:56px; border-radius:8px;',
      '  border:1px solid; margin-bottom:8px; position:relative;',
      '  overflow:hidden;',
      '}',
      '.stp-chip-card {',
      '  position:absolute; top:8px; left:8px; right:8px; height:16px;',
      '  border-radius:4px; border:1px solid;',
      '}',
      '.stp-chip-bar {',
      '  position:absolute; bottom:12px; left:8px; width:60%; height:4px;',
      '  border-radius:4px; opacity:.8;',
      '}',
      '.stp-chip-bar2 {',
      '  width:35%; bottom:5px; opacity:.4;',
      '}',
      '.stp-chip-dot {',
      '  position:absolute; bottom:10px; right:8px; width:8px; height:8px;',
      '  border-radius:50%;',
      '}',

      '.stp-chip-icon { font-size:18px; line-height:1; margin-bottom:4px; }',

      '.stp-chip-name {',
      '  font-size:12px; font-weight:600; color:var(--text); margin-bottom:2px;',
      '}',
      '.stp-chip-desc {',
      '  font-size:10px; color:var(--text3); line-height:1.3;',
      '}',

      /* check badge */
      '.stp-chip-check {',
      '  position:absolute; top:8px; right:8px;',
      '  background:var(--rose); color:#fff;',
      '  width:18px; height:18px; border-radius:50%;',
      '  font-size:10px; font-weight:700;',
      '  display:none; align-items:center; justify-content:center;',
      '}',
      '.stp-chip.active .stp-chip-check { display:flex; }',

      /* footer */
      '#stpFooter {',
      '  display:flex; align-items:center; justify-content:space-between;',
      '  padding:12px 22px 18px;',
      '  border-top:1px solid var(--border);',
      '}',
      '#stpCurrentLabel { font-size:12px; color:var(--text3); }',
      '#stpCurrentLabel strong { color:var(--text); }',
      '#stpDone {',
      '  background:linear-gradient(135deg,var(--rose),var(--violet));',
      '  color:#fff; border:none; border-radius:10px;',
      '  padding:9px 22px; font-size:13px; font-weight:600;',
      '  cursor:pointer; transition:.18s; font-family:inherit;',
      '}',
      '#stpDone:hover { opacity:.88; transform:translateY(-1px); }',

    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── WIRE the existing toggle button ───────────────────── */
  function wireButton() {
    /* Find the moon-icon nav-item — currently calls toggleTheme() */
    /* We override window.toggleTheme and also bind directly */
    window.toggleTheme = function() { openModal(); };

    /* Also handle direct clicks just in case */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.nav-item[data-tip="Toggle Theme"]');
      if (btn) { e.stopPropagation(); openModal(); }
    });
  }

  /* ── INIT ──────────────────────────────────────────────── */
  function init() {
    injectCSS();
    injectModal();
    wireButton();
    applyTheme(_currentThemeId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── PUBLIC API ────────────────────────────────────────── */
  window.SPMSTheme = {
    open: openModal,
    apply: applyTheme,
    current: function() { return _currentThemeId; },
    themes: THEMES,
  };

})();