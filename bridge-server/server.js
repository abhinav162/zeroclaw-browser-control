// ZeroClaw Bridge Server — WebSocket + REST bridge
// WebSocket server on port 7822 (extension connects here)
// REST API on port 7823 (CLI/AI sends commands here)

const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
const crypto = require("crypto");

// --- Configuration ---

const WS_PORT = 7822;
const REST_PORT = 7823;
const COMMAND_TIMEOUT_MS = 30000;

// --- State ---

let extensionSocket = null;
const pendingCommands = new Map(); // id -> { resolve, reject, timer }

// --- WebSocket Server (extension connects here) ---

const wsServer = new WebSocketServer({ port: WS_PORT });

wsServer.on("listening", () => {
  console.log(`[ZeroClaw] WebSocket server listening on ws://localhost:${WS_PORT}`);
});

wsServer.on("connection", (socket) => {
  console.log("[ZeroClaw] Chrome extension connected");
  extensionSocket = socket;

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.error("[ZeroClaw] Invalid JSON from extension:", raw.toString().slice(0, 200));
      return;
    }

    // Handle pings
    if (msg.type === "ping") return;

    // Handle extension_ready
    if (msg.type === "extension_ready") {
      console.log(`[ZeroClaw] Extension ready (v${msg.version})`);
      return;
    }

    // Handle command responses
    if (msg.id && pendingCommands.has(msg.id)) {
      const { resolve, reject, timer } = pendingCommands.get(msg.id);
      clearTimeout(timer);
      pendingCommands.delete(msg.id);

      if (msg.success) {
        resolve(msg.data);
      } else {
        reject(new Error(msg.error || "Extension command failed"));
      }
      return;
    }
  });

  socket.on("close", () => {
    console.log("[ZeroClaw] Chrome extension disconnected");
    if (extensionSocket === socket) extensionSocket = null;

    // Reject all pending commands
    for (const [id, { reject, timer }] of pendingCommands) {
      clearTimeout(timer);
      reject(new Error("Extension disconnected"));
      pendingCommands.delete(id);
    }
  });

  socket.on("error", (err) => {
    console.error("[ZeroClaw] WebSocket error:", err.message);
  });
});

// --- Send command to extension and wait for response ---

function sendCommand(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      reject(new Error("Chrome extension is not connected"));
      return;
    }

    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command timed out after ${COMMAND_TIMEOUT_MS / 1000}s: ${action}`));
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(id, { resolve, reject, timer });

    const payload = JSON.stringify({ id, action, ...params });
    extensionSocket.send(payload);
  });
}

// --- REST API (CLI/AI sends commands here) ---

const app = express();
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    extensionConnected: extensionSocket !== null && extensionSocket.readyState === WebSocket.OPEN,
    pendingCommands: pendingCommands.size,
  });
});

// Unified command endpoint
app.post("/command", async (req, res) => {
  const { action, ...params } = req.body;

  if (!action) {
    return res.status(400).json({ success: false, error: "Missing 'action' field" });
  }

  try {
    const data = await sendCommand(action, params);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes("not connected") ? 503 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// Convenience shortcuts
const SHORTCUT_ACTIONS = [
  "navigate",
  "click",
  "fill",
  "scrape",
  "screenshot",
  "scroll",
  "hover",
  "get_text",
  "get_title",
];

for (const action of SHORTCUT_ACTIONS) {
  app.post(`/${action}`, async (req, res) => {
    try {
      const data = await sendCommand(action, req.body);
      res.json({ success: true, data });
    } catch (err) {
      const status = err.message.includes("not connected") ? 503 : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  });
}

// 404
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    available: ["/health", "/command", ...SHORTCUT_ACTIONS.map((a) => `/${a}`)],
  });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[ZeroClaw] Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const httpServer = http.createServer(app);
httpServer.listen(REST_PORT, () => {
  console.log(`[ZeroClaw] REST API listening on http://localhost:${REST_PORT}`);
  console.log(`[ZeroClaw] Endpoints: POST /command, /navigate, /click, /fill, /scrape, /screenshot, /scroll, /hover, /get_text, /get_title`);
  console.log(`[ZeroClaw] Health check: GET /health`);
});

// --- Graceful shutdown ---

function shutdown() {
  console.log("\n[ZeroClaw] Shutting down...");

  for (const [id, { reject, timer }] of pendingCommands) {
    clearTimeout(timer);
    reject(new Error("Server shutting down"));
    pendingCommands.delete(id);
  }

  wsServer.close();
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
