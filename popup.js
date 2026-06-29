const KIND_LABELS = { session: '5-hour', weekly_all: '7-day', weekly: '7-day' };

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

function renderUsage(usage) {
  const body = document.getElementById('body');
  const btn  = document.getElementById('refresh');

  btn.textContent = 'Refresh';
  btn.disabled = false;

  if (!usage) {
    body.innerHTML = '<div class="msg">Failed to load — open claude.ai first</div>';
    return;
  }

  const limits = (usage.limits || []).filter(l => l.resets_at);
  if (!limits.length) {
    body.innerHTML = '<div class="msg">No data</div>';
    return;
  }

  body.innerHTML = limits.map(limit => {
    const pct   = Math.min(Math.round(limit.percent), 100);
    const color = barColor(pct);
    const label = KIND_LABELS[limit.kind] || limit.kind;
    const badge = limit.is_active ? `<span class="badge">active</span>` : '';
    return `<div class="row">
      <div class="row-header">
        <span class="label">${label}${badge}</span>
        <span class="pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="reset">${timeUntil(limit.resets_at)}</div>
    </div>`;
  }).join('');
}

async function getClaudeTab() {
  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
  return tabs[0] || null;
}

async function loadUsage() {
  const tab = await getClaudeTab();
  if (!tab) {
    renderUsage(null);
    return;
  }
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_USAGE' });
    renderUsage(resp?.usage ?? null);
  } catch {
    renderUsage(null);
  }
}

document.getElementById('refresh').addEventListener('click', async () => {
  const btn  = document.getElementById('refresh');
  const body = document.getElementById('body');
  btn.textContent = '…';
  btn.disabled = true;
  body.innerHTML = '<div class="msg">Loading…</div>';
  await loadUsage();
});

document.getElementById('settings-link').addEventListener('click', async () => {
  const tab = await getClaudeTab();
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SETTINGS' });
  } else {
    chrome.tabs.create({ url: 'https://claude.ai' });
  }
  window.close();
});

loadUsage();
