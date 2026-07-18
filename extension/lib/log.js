// Structured error logging for the extension. No bundler here, so this is a
// plain script exposed as FunnelLog on `window` (content script/side panel)
// or `self` (background service worker) — same pattern as FunnelSelector/
// FunnelUrlPattern.
//
// Every entry always lands in a local ring buffer (chrome.storage.local,
// inspectable from chrome://extensions even offline). It's *also* forwarded
// to the backend's /api/ext-logs -> Sentry when a backend origin is known,
// but the extension has no persisted backend URL (it's typed in ad hoc on
// send), so that part is best-effort and callers pass it explicitly rather
// than this module inventing a config store for one string.
(function (root) {
  const MAX_ENTRIES = 50;
  const STORAGE_KEY = 'funnelLogs';

  function record(level, message, context) {
    const entry = { level, message, context: context || {}, time: new Date().toISOString() };
    const serialized = JSON.stringify(entry);
    if (level === 'error') console.error(serialized);
    else if (level === 'warn') console.warn(serialized);
    else console.log(serialized);

    try {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        const logs = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
        logs.push(entry);
        while (logs.length > MAX_ENTRIES) logs.shift();
        chrome.storage.local.set({ [STORAGE_KEY]: logs });
      });
    } catch (e) {
      // storage unavailable (e.g. context torn down) — the console line above already happened
    }

    if (context && context.backendOrigin) {
      forward(entry, context.backendOrigin).catch(() => {});
    }
  }

  async function forward(entry, backendOrigin) {
    const { backendOrigin: _drop, ...context } = entry.context;
    await fetch(`${backendOrigin}/api/ext-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: entry.level, message: entry.message, context }),
    });
  }

  root.FunnelLog = {
    error: (message, context) => record('error', message, context),
    warn: (message, context) => record('warn', message, context),
    recent: () => new Promise((resolve) => chrome.storage.local.get(STORAGE_KEY, (data) => resolve(data[STORAGE_KEY] || []))),
  };
})(typeof window !== 'undefined' ? window : self);
