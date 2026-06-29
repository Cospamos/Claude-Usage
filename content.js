(function () {
  'use strict';

  const WRAPPER_ID  = 'cu-wrapper';
  const BTN_ID      = 'cu-btn';
  const POPUP_ID    = 'cu-popup';
  const BODY_ID     = 'cu-body';
  const REFRESH_ID  = 'cu-refresh';
  const ORG_ATTR    = 'data-cu-org-id';
  const UUID_PAT    = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const UUID_RE     = new RegExp(`/api/organizations/(${UUID_PAT})`);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  function cleanup() {
    document.getElementById(POPUP_ID)?.remove();
    document.getElementById(WRAPPER_ID)?.remove();
  }

  // ── Org ID detection ───────────────────────────────────────────────────────

  function injectInterceptor() {
    if (document.getElementById('cu-interceptor')) return;
    const s = document.createElement('script');
    s.id = 'cu-interceptor';
    s.textContent = `(function(){
      if (window.__cuIntercepted) return;
      window.__cuIntercepted = true;
      const RE = /\\/api\\/organizations\\/(${UUID_PAT})/;
      const ATTR = '${ORG_ATTR}';
      function capture(url) {
        const m = String(url || '').match(RE);
        if (m) document.documentElement.setAttribute(ATTR, m[1]);
      }
      const _f = window.fetch;
      window.fetch = function() {
        capture(arguments[0]?.url ?? arguments[0]);
        return _f.apply(this, arguments);
      };
      const _xo = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(_, url) {
        capture(url);
        return _xo.apply(this, arguments);
      };
    })();`;
    (document.head || document.documentElement).prepend(s);
    s.remove();
  }

  injectInterceptor();

  function getOrgIdFromPage() {
    const attr = document.documentElement.getAttribute(ORG_ATTR);
    if (attr) return attr;

    try {
      const re = new RegExp(`^claude-mcp-has-connectors:(${UUID_PAT})$`);
      for (const key of Object.keys(localStorage)) {
        const m = key.match(re);
        if (m) return m[1];
      }
    } catch (_) {}

    try {
      const nd = document.getElementById('__NEXT_DATA__');
      if (nd) {
        const m = nd.textContent.match(UUID_RE);
        if (m) return m[1];
      }
    } catch (_) {}

    return null;
  }

  async function getOrgId() {
    const fromPage = getOrgIdFromPage();
    if (fromPage) return fromPage;
    try {
      const res = await fetch('/api/organizations', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const id = data[0].id || data[0].uuid;
        if (id) document.documentElement.setAttribute(ORG_ATTR, id);
        return id;
      }
    } catch (_) {}
    return null;
  }

  // ── Usage fetch ────────────────────────────────────────────────────────────

  async function fetchUsage() {
    const id = getOrgIdFromPage() || await getOrgId();
    if (!id) return null;
    try {
      const res = await fetch(`/api/organizations/${id}/usage`, { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function timeUntil(iso) {
    const diff = new Date(iso) - Date.now();
    if (diff <= 0) return 'resets now';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 48) return `resets in ${Math.floor(h / 24)}d`;
    if (h >= 24) return `resets in ${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `resets in ${h}h ${m}m`;
    return `resets in ${m}m`;
  }

  function barColor(pct) {
    if (pct >= 90) return '#C96442';
    if (pct >= 70) return '#D97757';
    return '#87867F';
  }

  const KIND_LABELS = { session: '5-hour', weekly_all: '7-day', weekly: '7-day' };

  // ── Render ─────────────────────────────────────────────────────────────────

  function setBodyLoading() {
    const body = document.getElementById(BODY_ID);
    const ref  = document.getElementById(REFRESH_ID);
    if (body) body.innerHTML = '<div class="cu-msg">Loading…</div>';
    if (ref)  { ref.textContent = '…'; ref.classList.add('cu-refresh--busy'); }
  }

  function renderUsage(usage) {
    const body = document.getElementById(BODY_ID);
    const ref  = document.getElementById(REFRESH_ID);
    if (!body) return;

    if (ref) { ref.textContent = 'Refresh'; ref.classList.remove('cu-refresh--busy'); }

    if (!usage) {
      body.innerHTML = '<div class="cu-msg">Failed to load</div>';
      return;
    }

    const limits = (usage.limits || []).filter(l => l.resets_at);
    if (!limits.length) {
      body.innerHTML = '<div class="cu-msg">No data</div>';
      return;
    }

    body.innerHTML = limits.map(limit => {
      const pct   = Math.min(Math.round(limit.percent), 100);
      const color = barColor(pct);
      const label = KIND_LABELS[limit.kind] || limit.kind;
      const badge = limit.is_active ? `<span class="cu-badge">active</span>` : '';
      return `<div class="cu-row">
        <div class="cu-row-header">
          <span class="cu-label">${label}${badge}</span>
          <span class="cu-pct" style="color:${color}">${pct}%</span>
        </div>
        <div class="cu-bar-bg">
          <div class="cu-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="cu-reset">${timeUntil(limit.resets_at)}</div>
      </div>`;
    }).join('');
  }

  async function refresh() {
    const ref = document.getElementById(REFRESH_ID);
    if (ref?.classList.contains('cu-refresh--busy')) return;
    setBodyLoading();
    const usage = await fetchUsage();
    renderUsage(usage);
  }

  // ── Settings navigation ────────────────────────────────────────────────────

  function openSettings() {
    document.querySelector('[data-testid="user-menu-button"]')?.click();

    const menuObserver = new MutationObserver(() => {
      const menu = document.querySelector('.z-popover[data-open]');
      if (!menu) return;

      menu.style.opacity = '0';

      const settings = menu.querySelector('[data-testid="user-menu-settings"]');
      if (!settings) return;

      menuObserver.disconnect();
      settings.click();
      setTimeout(() => { menu.style.opacity = ''; }, 100);

      const usageObserver = new MutationObserver(() => {
        const usageBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.querySelector('span.truncate')?.textContent.trim() === 'Usage'
        );
        if (!usageBtn) return;

        usageObserver.disconnect();
        usageBtn.click();
      });

      usageObserver.observe(document.body, { childList: true, subtree: true });
    });

    menuObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── Popup ──────────────────────────────────────────────────────────────────

  async function togglePopup(btn) {
    const wrapper  = document.getElementById(WRAPPER_ID);
    const existing = document.getElementById(POPUP_ID);
    if (existing) {
      existing.remove();
      return;
    }

    const popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.innerHTML = `
      <div class="cu-header">
        <span class="cu-title">Usage</span>
        <span class="cu-refresh cu-refresh--busy" id="${REFRESH_ID}">…</span>
      </div>
      <div id="${BODY_ID}"><div class="cu-msg">Loading…</div></div>
      <div class="cu-footer">
        <span class="cu-link" id="cu-settings-link">View usage settings</span>
      </div>`;

    wrapper.appendChild(popup);

    popup.querySelector(`#${REFRESH_ID}`).addEventListener('click', refresh);

    popup.querySelector('#cu-settings-link').addEventListener('click', () => {
      popup.remove();
      openSettings();
    });

    const usage = await fetchUsage();
    renderUsage(usage);

    const onOutside = (e) => {
      const p = document.getElementById(POPUP_ID);
      if (p && !p.contains(e.target) && e.target !== btn) {
        p.remove();
        document.removeEventListener('mousedown', onOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  }

  // ── Injection ──────────────────────────────────────────────────────────────

  function injectButton(container) {
    cleanup();

    const wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = 'Usage';
    btn.setAttribute('aria-label', 'Usage');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopup(btn);
    });

    wrapper.appendChild(btn);
    container.appendChild(wrapper);
  }

  function tryInject() {
    const wrapper = document.getElementById(WRAPPER_ID);
    if (wrapper) {
      if (wrapper.isConnected && wrapper.closest('div.relative.flex')) return;
      cleanup();
    }

    const selectors = [
      'div.relative.flex.gap-2.w-full.items-center',
      'div.relative.flex.w-full.items-center',
    ];
    for (const sel of selectors) {
      for (const node of document.querySelectorAll(sel)) {
        if (node.querySelector('button')) {
          injectButton(node);
          return;
        }
      }
    }
  }

  // ── Extension messaging (used by popup.html) ───────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.type === 'GET_USAGE') {
      fetchUsage().then(usage => respond({ usage }));
      return true;
    }
    if (msg.type === 'OPEN_SETTINGS') {
      openSettings();
      respond({ ok: true });
    }
  });

  new MutationObserver(tryInject).observe(document.documentElement, { childList: true, subtree: true });
  tryInject();
})();
