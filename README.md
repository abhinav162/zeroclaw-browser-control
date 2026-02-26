# ZeroClaw Browser Control — Chrome Extension

Chrome extension that allows [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) AI agent to control and scrape Chrome tabs via commands.

## How It Works

```
ZeroClaw Agent
       │  HTTP POST (port 7823)
       ▼
Bridge Server (auto-spawned by ZeroClaw)
       │  WebSocket (port 7822)
       ▼
This Chrome Extension
       │  Chrome APIs + DOM
       ▼
  Your Browser
```

ZeroClaw auto-starts the bridge server internally. This repo contains **only the Chrome extension** — you just need to load it once.

## Setup

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` directory from this repo

That's it. The extension auto-connects to the bridge server when ZeroClaw starts.

## ZeroClaw Configuration

In `~/.zeroclaw/config.toml`:

```toml
[browser]
enabled = true
backend = "bridge"
allowed_domains = ["*"]

[browser.bridge]
endpoint = "http://127.0.0.1:7823/command"
timeout_ms = 30000
auto_start = true
```

## Supported Commands

| Action | Parameters | Description |
|--------|-----------|-------------|
| `navigate` | `url` (required), `tabId` | Navigate to a URL |
| `click` | `selector` (required), `tabId` | Click an element (CSS/XPath/text) |
| `fill` | `selector`, `value` (required), `submit`, `tabId` | Fill an input field |
| `scrape` | `selector`, `attribute`, `multiple`, `tabId` | Scrape page or specific elements |
| `screenshot` | `tabId` | Capture visible tab as base64 PNG |
| `scroll` | `direction`, `amount`, `selector`, `tabId` | Scroll the page |
| `hover` | `selector` (required), `tabId` | Hover over an element |
| `get_text` | `selector` (required), `tabId` | Get text content of an element |
| `get_title` | `tabId` | Get page title and URL |

### Selector Resolution

Selectors are resolved in order:
1. **CSS selector** — `#id`, `.class`, `div > span`
2. **XPath** — `//div[@class="foo"]`
3. **Text match** — exact text content of an element

## CLI Wrapper

`zc-browser.sh` lets you send commands directly to the bridge server for testing:

```bash
./zc-browser.sh navigate url=https://example.com
./zc-browser.sh scrape selector="h1"
./zc-browser.sh get_title
./zc-browser.sh health
```

## Troubleshooting

**Extension not connecting:**
- Ensure ZeroClaw is running with `backend = "bridge"`
- Check `curl http://localhost:7823/health` — should show `extensionConnected: true`
- Reload the extension from `chrome://extensions/`

**Commands timing out:**
- Ensure you have an active tab open in Chrome
- Some pages block content script injection (`chrome://` pages, extension pages)

## Project Structure

```
zeroclaw-browser-control/
├── chrome-extension/
│   ├── manifest.json          # MV3 manifest
│   ├── background.js          # WebSocket client + command router
│   ├── content_script.js      # DOM extractor + action executor
│   └── icons/
├── zc-browser.sh              # CLI wrapper (optional)
└── README.md
```
