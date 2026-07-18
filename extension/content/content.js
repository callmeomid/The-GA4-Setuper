(function () {
  let armed = false;
  let lastSentUrlPattern = null;
  let toastHost = null;

  function applyState(state) {
    if (!state) return;
    armed = !!(state.recording && state.recordingOrigin === location.origin);
    if (armed) maybeCapturePageview();
  }

  function initArmState() {
    chrome.storage.local.get('funnelState', (data) => applyState(data.funnelState));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.funnelState) applyState(changes.funnelState.newValue);
  });

  function sendStep(step) {
    try {
      chrome.runtime.sendMessage({ type: 'STEP_CAPTURED', step }, (state) => {
        if (chrome.runtime.lastError) return;
        if (state && Array.isArray(state.steps)) showToast(state.steps.length, step.label, step.confidence);
      });
    } catch (e) {
      // extension context invalidated (e.g. reloaded mid-session) — nothing to recover here
    }
  }

  function maybeCapturePageview() {
    if (!armed) return;
    const urlPattern = window.FunnelUrlPattern.toUrlPattern(location.href);
    if (urlPattern === lastSentUrlPattern) return;
    lastSentUrlPattern = urlPattern;
    sendStep({
      label: document.title || urlPattern,
      urlPattern,
      trigger: { type: 'pageview', selector: null },
      confidence: 'n/a',
    });
  }

  function queuePageviewCheck() {
    setTimeout(maybeCapturePageview, 50);
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    queuePageviewCheck();
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    queuePageviewCheck();
    return result;
  };
  window.addEventListener('popstate', queuePageviewCheck);

  const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'tab']);
  const INTERACTIVE_INPUT_TYPES = new Set(['submit', 'button', 'reset', 'image']);

  function isInteractive(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A') return true;
    if (tag === 'INPUT' && INTERACTIVE_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase())) return true;
    const role = el.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    if (el.hasAttribute('onclick')) return true;
    try {
      if (getComputedStyle(el).cursor === 'pointer') return true;
    } catch (e) {
      // cross-origin iframe or detached node — skip the style probe
    }
    return false;
  }

  function findInteractiveAncestor(path) {
    const limit = Math.min(path.length, 8);
    for (let i = 0; i < limit; i += 1) {
      const node = path[i];
      if (node && node.nodeType === 1 && isInteractive(node)) return node;
    }
    return null;
  }

  function captureClick(target) {
    const { selector, confidence } = window.FunnelSelector.getStableSelector(target);
    const label = window.FunnelSelector.getVisibleLabel(target);
    sendStep({
      label,
      urlPattern: window.FunnelUrlPattern.toUrlPattern(location.href),
      trigger: { type: 'click', selector },
      confidence,
    });
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!armed) return;
      try {
        const path = event.composedPath ? event.composedPath() : [event.target];
        const target = findInteractiveAncestor(path);
        if (!target) return;
        captureClick(target);
      } catch (e) {
        // A click-listener exception is uncaught by the page and easy to
        // miss in devtools — log it so a bad capture doesn't just vanish.
        FunnelLog.error('Click capture failed', { url: location.href, error: e.message });
      }
    },
    true,
  );

  document.addEventListener(
    'submit',
    (event) => {
      if (!armed) return;
      try {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
        const label = submitButton ? window.FunnelSelector.getVisibleLabel(submitButton) : 'Form submission';
        const { selector, confidence } = window.FunnelSelector.getStableSelector(form);
        const formFields = Array.from(form.elements)
          .map((el) => el.name)
          .filter(Boolean)
          .filter((name, index, all) => all.indexOf(name) === index);
        sendStep({
          label: `Submitted: ${label}`,
          urlPattern: window.FunnelUrlPattern.toUrlPattern(location.href),
          trigger: { type: 'formSubmit', selector },
          formFields,
          confidence,
        });
      } catch (e) {
        FunnelLog.error('Form submit capture failed', { url: location.href, error: e.message });
      }
    },
    true,
  );

  function ensureToastHost() {
    if (toastHost) return toastHost;
    const host = document.createElement('div');
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.bottom = '20px';
    host.style.right = '20px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    (document.body || document.documentElement).appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      .toast-list { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
      .toast {
        min-width: 200px;
        max-width: 320px;
        background: #0A0B0D;
        border: 1px dashed #6B6E73;
        border-radius: 2px;
        padding: 8px 10px;
        font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 150ms linear, transform 150ms linear, border-color 150ms linear, box-shadow 150ms linear;
      }
      .toast.toast-confirm { opacity: 1; transform: translateY(0); border-style: solid; border-color: #39FF88; box-shadow: 0 0 0 1px rgba(57, 255, 136, 0.2); }
      .toast.toast-out { opacity: 0; transform: translateY(-6px); }
      .toast-row { display: flex; align-items: center; gap: 6px; }
      .toast-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; background: #6B6E73; }
      .toast-dot.dot-data-attr, .toast-dot.dot-id { background: #39FF88; }
      .toast-dot.dot-aria-label, .toast-dot.dot-name { background: #8FE6B2; }
      .toast-dot.dot-structural { background: #FFB84D; }
      .toast-index { font-size: 10px; letter-spacing: 0.08em; color: #6B6E73; }
      .toast.toast-confirm .toast-index { color: #39FF88; }
      .toast-label { font-size: 12px; color: #E8E9EA; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 230px; }
    `;
    shadow.appendChild(style);
    const list = document.createElement('div');
    list.className = 'toast-list';
    shadow.appendChild(list);
    toastHost = { host, list };
    return toastHost;
  }

  function showToast(stepNumber, label, confidence) {
    const { list } = ensureToastHost();
    const card = document.createElement('div');
    card.className = 'toast';

    const row = document.createElement('div');
    row.className = 'toast-row';

    const dot = document.createElement('span');
    dot.className = `toast-dot dot-${confidence}`;

    const index = document.createElement('span');
    index.className = 'toast-index';
    index.textContent = `STEP ${stepNumber}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'toast-label';
    labelEl.textContent = label;

    row.appendChild(dot);
    row.appendChild(index);
    row.appendChild(labelEl);
    card.appendChild(row);
    list.appendChild(card);

    requestAnimationFrame(() => card.classList.add('toast-confirm'));
    setTimeout(() => {
      card.classList.add('toast-out');
      setTimeout(() => card.remove(), 300);
    }, 2200);
  }

  initArmState();
})();
