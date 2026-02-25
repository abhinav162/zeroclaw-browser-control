# ZeroClaw Browser Control

Chrome extension + local bridge server that lets ZeroClaw (AI assistant) control and scrape Chrome tabs via commands.

## Architecture

```
ZeroClaw AI / CLI
       │
       │  HTTP POST (port 7823)
       ▼
┌─────────────────┐
│  Bridge Server   │  Node.js (Express + WS)
│  REST → WebSocket│
└────────┬────────┘
         │  WebSocket (port 7822)
         ▼
┌─────────────────┐
│ Chrome Extension │  MV3 Service Worker
│  background.js   │  ↔ content_script.js
└─────────────────┘
         │
         ▼
    Browser DOM
```

## Quick Start

### 1. Install dependencies

```bash
cd bridge-server
npm install
```

### 2. Start the bridge server

```bash
cd bridge-server
npm start
```

### 3. Load the Chrome extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` directory

The extension auto-connects to `ws://localhost:7822` when the bridge server is running.

### 4. Send commands

Using the CLI wrapper:

```bash
chmod +x zc-browser.sh

# Navigate
./zc-browser.sh navigate url=https://example.com

# Click
./zc-browser.sh click selector="#my-button"

# Fill input
./zc-browser.sh fill selector="#email" value="user@example.com"

# Scrape page
./zc-browser.sh scrape

# Screenshot
./zc-browser.sh screenshot

# Check status
./zc-browser.sh health
```

Or via curl:

```bash
# Unified endpoint
curl -X POST http://localhost:7823/command \
  -H "Content-Type: application/json" \
  -d '{"action": "navigate", "url": "https://example.com"}'

# Shortcut endpoints
curl -X POST http://localhost:7823/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Commands

| Action | Parameters | Description |
|--------|-----------|-------------|
| `navigate` | `url` (required), `tabId` | Navigate to a URL |
| `click` | `selector` (required), `tabId` | Click an element (CSS/XPath/text) |
| `fill` | `selector` (required), `value` (required), `submit`, `tabId` | Fill an input field |
| `scrape` | `selector`, `attribute`, `multiple`, `tabId` | Scrape page or specific elements |
| `screenshot` | `tabId` | Capture visible tab as base64 PNG |
| `scroll` | `direction` (up/down/left/right/top/bottom), `amount`, `selector`, `tabId` | Scroll the page |
| `hover` | `selector` (required), `tabId` | Hover over an element |
| `get_text` | `selector` (required), `tabId` | Get text content of an element |
| `get_title` | `tabId` | Get page title and URL |

### Selector Resolution

Selectors are resolved in order:
1. **CSS selector** — `#id`, `.class`, `div > span`
2. **XPath** — `//div[@class="foo"]`
3. **Text match** — exact text content of an element

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

On error:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server status + extension connection |
| `POST` | `/command` | Send any command (`action` field required) |
| `POST` | `/<action>` | Shortcut for each action (params in body) |

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `ZC_BRIDGE_HOST` | `localhost` | Bridge server host (for CLI) |
| `ZC_BRIDGE_PORT` | `7823` | Bridge server REST port (for CLI) |

Ports are configured in `bridge-server/server.js`:
- **7822** — WebSocket (extension ↔ server)
- **7823** — REST API (CLI/AI → server)

## Troubleshooting

**Extension not connecting:**
- Ensure bridge server is running (`./zc-browser.sh health`)
- Check Chrome extension page for errors
- Reload the extension from `chrome://extensions/`

**Commands timing out:**
- Ensure you have an active tab open
- Check that the page has finished loading
- Some pages block content script injection (chrome://, extension pages)

**Content script errors:**
- Verify the selector is correct
- Try using a CSS selector first, then XPath
- For dynamic content, add a delay after navigation

## Project Structure

```
zeroclaw-extension/
├── chrome-extension/
│   ├── manifest.json          # MV3 manifest
│   ├── background.js          # WebSocket client + command router
│   └── content_script.js      # DOM extractor + action executor
├── bridge-server/
│   ├── server.js              # Express + WebSocket server
│   └── package.json
├── zc-browser.sh              # CLI wrapper script
└── README.md
```
