// =============================================================================
// logger.js - CloudWatch-style frontend logger with backend shipping
// =============================================================================

const LOG_KEY   = "flashmart_logs";
const MAX_LOGS  = 500;
const BASE_URL  = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com/v1";

// Batch queue — logs are collected and flushed every 5 seconds
let   _queue    = [];
let   _flushTimer = null;

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const getUser = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "anonymous";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || payload.userId || "unknown";
  } catch { return "anonymous"; }
};

const save = (logs) => {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(logs)); } catch {}
};

export const getLogs = () => {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { return []; }
};

// ── Flush batch to backend ────────────────────────────────────────────────────
const flushToBackend = async () => {
  if (_queue.length === 0) return;

  const batch = [..._queue];
  _queue = [];

  try {
    await fetch(`${BASE_URL}/logs`, {
      method:    "POST",
      headers:   { "Content-Type": "application/json" },
      body:      JSON.stringify({ logs: batch }),
      keepalive: true,   // fires even if user closes the tab
    });
  } catch {
    // silent fail — logs still saved in localStorage as fallback
  }
};

// ── Schedule flush every 5 seconds ───────────────────────────────────────────
const schedulFlush = () => {
  if (_flushTimer) return;
  _flushTimer = setInterval(flushToBackend, 5000);
};

// Flush immediately on page unload
window.addEventListener("beforeunload", flushToBackend);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushToBackend();
});

// ── Core log function ─────────────────────────────────────────────────────────
const log = (level, category, message, meta = {}) => {
  const entry = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    user:      getUser(),
    sessionId: sessionStorage.getItem("sessionId") || "unknown",
    ...meta,
  };

  // Console output
  const style = {
    DEBUG: "color:#6b7280",
    INFO:  "color:#3b82f6",
    WARN:  "color:#f59e0b",
    ERROR: "color:#ef4444"
  };
  console.log(`%c[${level}] [${category}] ${message}`, style[level], meta);

  // Save to localStorage (local fallback)
  const logs = getLogs();
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.splice(MAX_LOGS);
  save(logs);

  // Queue for backend shipping — all levels
  _queue.push(entry);
  schedulFlush();

  // ERROR/WARN: flush immediately, don't wait 5 seconds
  if (level === "ERROR" || level === "WARN") {
    flushToBackend();
  }

  return entry;
};

// ── Init session ──────────────────────────────────────────────────────────────
if (!sessionStorage.getItem("sessionId")) {
  sessionStorage.setItem(
    "sessionId",
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
}

// ── Logger API ────────────────────────────────────────────────────────────────
const logger = {
  debug: (cat, msg, meta) => log("DEBUG", cat, msg, meta),
  info:  (cat, msg, meta) => log("INFO",  cat, msg, meta),
  warn:  (cat, msg, meta) => log("WARN",  cat, msg, meta),
  error: (cat, msg, meta) => log("ERROR", cat, msg, meta),

  // Shorthand event loggers
  auth:    (msg, meta) => log("INFO",  "AUTH",    msg, meta),
  api:     (msg, meta) => log("INFO",  "API",     msg, meta),
  apiErr:  (msg, meta) => log("ERROR", "API",     msg, meta),
  cart:    (msg, meta) => log("INFO",  "CART",    msg, meta),
  order:   (msg, meta) => log("INFO",  "ORDER",   msg, meta),
  nav:     (msg, meta) => log("DEBUG", "NAV",     msg, meta),
  product: (msg, meta) => log("INFO",  "PRODUCT", msg, meta),
  payment: (msg, meta) => log("INFO",  "PAYMENT", msg, meta),

  // Manual flush (call this if you want to force-send immediately)
  flush: flushToBackend,

  clearLogs: () => {
    localStorage.removeItem(LOG_KEY);
    console.log("[LOGGER] Logs cleared");
  },

  downloadLogs: () => {
    const logs = getLogs();
    const lines = logs.map(l =>
      `[${l.timestamp}] [${l.level}] [${l.category}] [user:${l.user}] [session:${l.sessionId}] ${l.message}` +
      (Object.keys(l).filter(k => !["id","timestamp","level","category","message","user","sessionId"].includes(k)).length
        ? "\n  " + JSON.stringify(Object.fromEntries(
            Object.entries(l).filter(([k]) => !["id","timestamp","level","category","message","user","sessionId"].includes(k))
          )) : "")
    ).join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `flashmart-logs-${new Date().toISOString().slice(0,10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    log("INFO", "LOGGER", "Logs downloaded");
  },

  downloadJSON: () => {
    const logs = getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `flashmart-logs-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export default logger;