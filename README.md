# Claude Usage Monitor

<p align="center">
  <img src="icons/icon-128.png" alt="Claude Usage Monitor icon" width="128" height="128">
</p>

A minimal browser extension that adds a usage indicator button to [claude.ai](https://claude.ai), showing your 5-hour and 7-day rate limits at a glance - without leaving the chat.

## Features

- **One-click usage popup** - bar chart button in the chat toolbar, anchored to the button (no floating drift)
- **Progress bars** with color coding: green < 70% · yellow 70–90% · red ≥ 90%
- **Reset countdowns** - shows exactly when each limit resets
- **Refresh** - re-fetch data without closing the popup
- **View usage settings** - navigates directly to the Usage tab in Claude settings (no page reload)
- **Auto theme** - adapts to Claude's light/dark mode via native CSS variables
- **Zero config** - org ID is detected automatically from page network requests or localStorage

## Installation

> No Chrome Web Store listing yet - load unpacked manually.

1. Clone or download this repository
2. Open `chrome://extensions/` (or `edge://extensions/`)
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `claude-usage-extension` folder
5. Open [claude.ai](https://claude.ai) - the button appears in the chat toolbar

To update after pulling new changes: click the **↺** refresh icon on the extension card.

## Usage

Click the **bar chart icon** (﹏) in the bottom toolbar of any chat.

| Element | Action |
|---|---|
| Progress bars | Visual usage for each limit |
| `Refresh` | Re-fetch current usage data |
| `View usage settings` | Opens the Usage tab in Claude Settings |

## How it works

**Org ID detection** (in priority order):
1. Intercepts `fetch` / `XHR` calls the page already makes and extracts the org UUID from any `/api/organizations/{id}/...` URL
2. Scans `localStorage` for `claude-mcp-has-connectors:{id}` keys (persistent)
3. Reads the embedded Next.js `__NEXT_DATA__` script tag
4. Falls back to calling `/api/organizations` directly

**Theme detection**: reads `data-mode="dark"` on `<html>` (Claude's own mechanism), with `.dark` class and `prefers-color-scheme` as fallbacks. All colors use Claude's native CSS variables (`--text-100`, `--border-300`, `--font-ui`).

**Duplicate protection**: before every injection the extension removes any previously added elements. The MutationObserver also checks `isConnected` on the wrapper to handle React re-mounts.

## Files

```
claude-usage-extension/
├── manifest.json   - MV3 manifest, matches https://claude.ai/*
├── content.js      - all logic (org detection, fetch, render, injection)
└── content.css     - styles using Claude's own CSS variables
```

## Browser support

Tested on Chrome / Chromium. Should work on any MV3-compatible browser (Edge, Brave, Opera). Firefox requires Manifest V2 - not currently supported.

## License

MIT
