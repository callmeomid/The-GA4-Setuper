let state = { recording: false, recordingOrigin: null, funnelName: '', steps: [], mode: 'idle', templateId: null };
let renderedIds = new Set();
let matchStatusById = {}; // stepId -> 'found' | 'not-found' | 'n/a' — ephemeral, not persisted
let activeTabId = null;

function sendMessage(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function tabSendMessage(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false });
    });
  });
}

async function ensureActiveTabId() {
  if (activeTabId != null) return activeTabId;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab ? tab.id : null;
  return activeTabId;
}

function currentBaseView() {
  return state.mode === 'template' ? 'confirm' : 'recorder';
}

function render() {
  renderHeader();
  const exportShowing = !document.getElementById('export-view').classList.contains('hidden');
  if (!exportShowing) {
    const base = currentBaseView();
    document.getElementById('recorder-view').classList.toggle('hidden', base !== 'recorder');
    document.getElementById('confirm-view').classList.toggle('hidden', base !== 'confirm');
  }
  if (currentBaseView() === 'recorder') {
    renderTemplatePicker();
    renderStepList();
  } else {
    renderConfirmView();
  }
}

function renderHeader() {
  const nameInput = document.getElementById('funnel-name');
  if (document.activeElement !== nameInput) nameInput.value = state.funnelName || '';

  const statusIndicator = document.getElementById('status-indicator');
  const statusLabel = document.getElementById('status-label');
  const recordingOriginEl = document.getElementById('recording-origin');

  if (state.recording) {
    statusIndicator.className = 'status status-recording';
    statusLabel.textContent = 'RECORDING';
    recordingOriginEl.classList.remove('hidden');
    recordingOriginEl.textContent = state.recordingOrigin ? `on ${state.recordingOrigin.replace(/^https?:\/\//, '')}` : '';
  } else if (state.mode === 'template') {
    statusIndicator.className = 'status status-idle';
    statusLabel.textContent = 'CONFIRMING TEMPLATE';
    recordingOriginEl.classList.remove('hidden');
    recordingOriginEl.textContent = state.recordingOrigin ? `on ${state.recordingOrigin.replace(/^https?:\/\//, '')}` : '';
  } else {
    statusIndicator.className = 'status status-idle';
    statusLabel.textContent = 'IDLE';
    recordingOriginEl.classList.add('hidden');
  }

  const toggleBtn = document.getElementById('record-toggle');
  toggleBtn.textContent = state.recording ? 'Stop Recording' : 'Start Recording';
  toggleBtn.className = state.recording ? 'btn btn-recording' : 'btn btn-primary';

  document.getElementById('finish-btn').disabled = state.steps.length === 0;
}

// --- Template picker ------------------------------------------------------

function renderTemplatePicker() {
  const picker = document.getElementById('template-picker');
  const show = !state.recording && state.steps.length === 0;
  picker.classList.toggle('hidden', !show);
  if (!show) return;

  const list = document.getElementById('template-list');
  list.innerHTML = '';
  const templates = (window.FunnelTemplates && window.FunnelTemplates.list) || [];
  templates.forEach((template) => {
    const li = document.createElement('li');
    li.className = 'template-card';

    const top = document.createElement('div');
    top.className = 'template-card-top';

    const name = document.createElement('span');
    name.className = 'template-card-name';
    name.textContent = template.name;

    const count = document.createElement('span');
    count.className = 'template-card-count';
    count.textContent = `${template.steps.length} STEPS`;

    top.appendChild(name);
    top.appendChild(count);

    const desc = document.createElement('div');
    desc.className = 'template-card-desc';
    desc.textContent = template.description;

    li.appendChild(top);
    li.appendChild(desc);
    li.addEventListener('click', () => useTemplate(template));
    list.appendChild(li);
  });
}

async function useTemplate(template) {
  matchStatusById = {};
  activeTabId = null;
  const steps = template.steps.map((s) => ({ ...s }));
  state = await sendMessage({
    type: 'LOAD_TEMPLATE',
    templateId: template.templateId,
    funnelName: template.funnelName,
    steps,
  });
  renderedIds = new Set();
  render();
  await autoCheckAllSteps();
}

// --- Confirm/adjust view ---------------------------------------------------

async function autoCheckAllSteps() {
  if (state.mode !== 'template') return;
  const tabId = await ensureActiveTabId();
  const placeholder = (window.FunnelTemplates && window.FunnelTemplates.DOMAIN_PLACEHOLDER) || '';
  const origin = state.recordingOrigin;

  const updatedSteps = [];
  for (const step of state.steps) {
    let next = { ...step, trigger: { ...step.trigger } };

    if (origin && placeholder && next.urlPattern && next.urlPattern.startsWith(placeholder)) {
      next.urlPattern = origin + next.urlPattern.slice(placeholder.length);
    }

    if (next.trigger.type === 'pageview') {
      matchStatusById[step.id] = 'n/a';
    } else if (tabId != null) {
      const candidates = [next.trigger.selector, ...(next.selectorCandidates || [])].filter(Boolean);
      let matched = null;
      for (const candidate of candidates) {
        const res = await tabSendMessage(tabId, { type: 'CHECK_SELECTOR', selector: candidate });
        if (res.ok && res.count > 0) {
          matched = candidate;
          break;
        }
      }
      if (matched) {
        next.trigger.selector = matched;
        matchStatusById[step.id] = 'found';
      } else {
        matchStatusById[step.id] = 'not-found';
      }
    } else {
      matchStatusById[step.id] = 'not-found';
    }

    updatedSteps.push(next);
  }

  state = { ...state, steps: updatedSteps };
  render();
  await sendMessage({ type: 'UPDATE_STEPS', steps: updatedSteps });
}

function pulseStep(id) {
  const el = document.querySelector(`.confirm-step[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('confirm-step-pulse');
  setTimeout(() => el.classList.remove('confirm-step-pulse'), 150);
}

async function commitStepField(id, field, value) {
  const steps = state.steps.map((s) => (s.id === id ? { ...s, [field]: value } : s));
  state = { ...state, steps };
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

async function commitStepSelector(id, value) {
  const steps = state.steps.map((s) => (s.id === id ? { ...s, trigger: { ...s.trigger, selector: value } } : s));
  state = { ...state, steps };
  delete matchStatusById[id];
  render();
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

async function toggleConfirmed(id) {
  const wasConfirmed = !!state.steps.find((s) => s.id === id)?.confirmed;
  const steps = state.steps.map((s) => (s.id === id ? { ...s, confirmed: !s.confirmed } : s));
  state = { ...state, steps };
  render();
  if (!wasConfirmed) pulseStep(id);
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

async function checkStep(id) {
  const step = state.steps.find((s) => s.id === id);
  if (!step) return;
  const tabId = await ensureActiveTabId();
  if (tabId == null) return;
  const res = await tabSendMessage(tabId, { type: 'CHECK_SELECTOR', selector: step.trigger.selector });
  matchStatusById[id] = res.ok && res.count > 0 ? 'found' : 'not-found';
  render();
}

async function pickStep(id) {
  const step = state.steps.find((s) => s.id === id);
  if (!step) return;
  const tabId = await ensureActiveTabId();
  if (tabId == null) return;
  await tabSendMessage(tabId, { type: 'ENTER_PICK_MODE', stepId: id, triggerType: step.trigger.type });
}

async function handleElementPicked(message) {
  if (state.mode !== 'template') return;
  const steps = state.steps.map((s) =>
    s.id === message.stepId
      ? {
          ...s,
          trigger: { ...s.trigger, selector: message.selector },
          urlPattern: message.urlPattern || s.urlPattern,
          confirmed: true,
        }
      : s,
  );
  matchStatusById[message.stepId] = 'found';
  state = { ...state, steps };
  render();
  pulseStep(message.stepId);
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

function renderConfirmView() {
  const list = document.getElementById('confirm-step-list');
  list.innerHTML = '';

  state.steps.forEach((step, index) => {
    const li = document.createElement('li');
    li.className = 'confirm-step' + (step.confirmed ? ' confirm-step-confirmed' : '');
    li.dataset.id = step.id;

    const top = document.createElement('div');
    top.className = 'confirm-step-top';

    const order = document.createElement('span');
    order.className = 'confirm-step-order';
    order.textContent = String(index + 1).padStart(2, '0');

    const label = document.createElement('input');
    label.className = 'confirm-step-label';
    label.type = 'text';
    label.value = step.label;
    label.addEventListener('blur', () => commitStepField(step.id, 'label', label.value));
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') label.blur();
    });

    const badge = document.createElement('span');
    badge.className = 'step-badge';
    badge.textContent = step.trigger.type;

    top.appendChild(order);
    top.appendChild(label);
    top.appendChild(badge);
    li.appendChild(top);

    if (step.hint) {
      const hint = document.createElement('div');
      hint.className = 'confirm-step-hint';
      hint.textContent = step.hint;
      li.appendChild(hint);
    }

    const urlInput = document.createElement('input');
    urlInput.className = 'confirm-step-url-input';
    urlInput.type = 'text';
    urlInput.value = step.urlPattern;
    urlInput.addEventListener('blur', () => commitStepField(step.id, 'urlPattern', urlInput.value));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') urlInput.blur();
    });
    li.appendChild(urlInput);

    if (step.trigger.type !== 'pageview') {
      const selInput = document.createElement('input');
      selInput.className = 'confirm-step-selector-input';
      selInput.type = 'text';
      selInput.value = step.trigger.selector || '';
      selInput.addEventListener('blur', () => commitStepSelector(step.id, selInput.value));
      selInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') selInput.blur();
      });
      li.appendChild(selInput);

      const matchStatus = matchStatusById[step.id] || 'n/a';
      const matchRow = document.createElement('div');
      matchRow.className = `confirm-step-match-row ${
        matchStatus === 'found' ? 'match-found' : matchStatus === 'not-found' ? 'match-not-found' : ''
      }`;
      const dot = document.createElement('span');
      dot.className = 'confirm-step-match-dot';
      const text = document.createElement('span');
      text.textContent =
        matchStatus === 'found'
          ? 'Match found on this page'
          : matchStatus === 'not-found'
          ? 'Not found — pick the real element'
          : 'Not checked yet';
      matchRow.appendChild(dot);
      matchRow.appendChild(text);
      li.appendChild(matchRow);

      const checkActions = document.createElement('div');
      checkActions.className = 'confirm-step-actions';

      const checkBtn = document.createElement('button');
      checkBtn.className = 'btn btn-ghost btn-small';
      checkBtn.textContent = 'Check';
      checkBtn.addEventListener('click', () => checkStep(step.id));

      const pickBtn = document.createElement('button');
      pickBtn.className = 'btn btn-primary btn-small';
      pickBtn.textContent = 'Pick element';
      pickBtn.addEventListener('click', () => pickStep(step.id));

      checkActions.appendChild(checkBtn);
      checkActions.appendChild(pickBtn);
      li.appendChild(checkActions);
    }

    const confirmActions = document.createElement('div');
    confirmActions.className = 'confirm-step-actions';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-accent btn-small';
    confirmBtn.textContent = step.confirmed ? 'Confirmed ✓' : 'Confirm';
    confirmBtn.addEventListener('click', () => toggleConfirmed(step.id));
    confirmActions.appendChild(confirmBtn);
    li.appendChild(confirmActions);

    list.appendChild(li);

    if (renderedIds.has(step.id)) {
      li.classList.add('step-in');
    } else {
      renderedIds.add(step.id);
      requestAnimationFrame(() => li.classList.add('step-in'));
    }
  });

  const total = state.steps.length;
  const confirmedCount = state.steps.filter((s) => s.confirmed).length;
  const matchedCount = state.steps.filter((s) => matchStatusById[s.id] === 'found').length;
  document.getElementById('confirm-stat-line').textContent = total
    ? `${total} STEPS PRELOADED · ${matchedCount} AUTO-MATCHED ON THIS PAGE · ${confirmedCount}/${total} CONFIRMED`
    : '';

  document.getElementById('confirm-finish-btn').disabled = total === 0 || confirmedCount !== total;
  document.getElementById('confirm-all-matched-btn').disabled = !state.steps.some(
    (s) => !s.confirmed && matchStatusById[s.id] === 'found',
  );
}

// --- Scratch recorder view (unchanged behavior) ---------------------------

function renderStepList() {
  const emptyState = document.getElementById('empty-state');
  const list = document.getElementById('step-list');
  emptyState.classList.toggle('hidden', state.steps.length > 0);
  list.innerHTML = '';

  state.steps.forEach((step, index) => {
    const row = document.createElement('li');
    row.className = 'step-row';
    row.dataset.id = step.id;

    const top = document.createElement('div');
    top.className = 'step-row-top';

    const order = document.createElement('span');
    order.className = 'step-order';
    order.textContent = String(index + 1).padStart(2, '0');

    const dot = document.createElement('span');
    dot.className = `step-dot dot-${step.confidence}`;

    const label = document.createElement('input');
    label.className = 'step-label';
    label.type = 'text';
    label.value = step.label;
    label.addEventListener('blur', () => commitLabel(step.id, label.value));
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') label.blur();
    });

    const badge = document.createElement('span');
    badge.className = 'step-badge';
    badge.textContent = step.trigger.type;

    const actions = document.createElement('div');
    actions.className = 'step-actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'icon-btn';
    upBtn.textContent = '↑';
    upBtn.title = 'Move up';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveStep(index, index - 1));

    const downBtn = document.createElement('button');
    downBtn.className = 'icon-btn';
    downBtn.textContent = '↓';
    downBtn.title = 'Move down';
    downBtn.disabled = index === state.steps.length - 1;
    downBtn.addEventListener('click', () => moveStep(index, index + 1));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn danger';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete step';
    deleteBtn.addEventListener('click', () => deleteStep(step.id));

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(deleteBtn);

    top.appendChild(order);
    top.appendChild(dot);
    top.appendChild(label);
    top.appendChild(badge);
    top.appendChild(actions);

    const meta = document.createElement('div');
    meta.className = 'step-meta';
    const fieldsSuffix = step.formFields && step.formFields.length ? `  ·  fields: ${step.formFields.join(', ')}` : '';
    meta.textContent = `${step.urlPattern}${fieldsSuffix}`;

    row.appendChild(top);
    row.appendChild(meta);
    list.appendChild(row);

    if (renderedIds.has(step.id)) {
      row.classList.add('step-in');
    } else {
      renderedIds.add(step.id);
      requestAnimationFrame(() => row.classList.add('step-in'));
    }
  });
}

async function commitLabel(id, value) {
  const steps = state.steps.map((s) => (s.id === id ? { ...s, label: value } : s));
  state = { ...state, steps };
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

async function moveStep(from, to) {
  const steps = state.steps.slice();
  const [item] = steps.splice(from, 1);
  steps.splice(to, 0, item);
  state = { ...state, steps };
  render();
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

async function deleteStep(id) {
  const steps = state.steps.filter((s) => s.id !== id);
  state = { ...state, steps };
  render();
  await sendMessage({ type: 'UPDATE_STEPS', steps });
}

// --- Export (shared by both flows) -----------------------------------------

function buildExportSpec() {
  return {
    funnelName: state.funnelName || 'Untitled funnel',
    steps: state.steps.map((step, index) => {
      const exported = {
        order: index + 1,
        label: step.label,
        urlPattern: step.urlPattern,
        trigger: { type: step.trigger.type, selector: step.trigger.selector },
      };
      if (step.formFields && step.formFields.length) exported.formFields = step.formFields;
      return exported;
    }),
  };
}

function showExportView() {
  document.getElementById('recorder-view').classList.add('hidden');
  document.getElementById('confirm-view').classList.add('hidden');
  document.getElementById('export-view').classList.remove('hidden');
  document.getElementById('json-output').textContent = JSON.stringify(buildExportSpec(), null, 2);
}

function showBaseView() {
  document.getElementById('export-view').classList.add('hidden');
  const base = currentBaseView();
  document.getElementById('recorder-view').classList.toggle('hidden', base !== 'recorder');
  document.getElementById('confirm-view').classList.toggle('hidden', base !== 'confirm');
}

async function sendFunnelSpec(url, spec) {
  if (!url) return { ok: false, error: 'Enter a backend URL first' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function resetAll() {
  state = await sendMessage({ type: 'RESET_FUNNEL' });
  matchStatusById = {};
  activeTabId = null;
  renderedIds = new Set();
  render();
}

document.getElementById('funnel-name').addEventListener('blur', async (e) => {
  state = await sendMessage({ type: 'SET_FUNNEL_NAME', funnelName: e.target.value });
});

document.getElementById('record-toggle').addEventListener('click', async () => {
  if (state.recording) {
    state = await sendMessage({ type: 'STOP_RECORDING' });
  } else {
    const funnelName = document.getElementById('funnel-name').value;
    state = await sendMessage({ type: 'START_RECORDING', funnelName });
    renderedIds = new Set();
  }
  render();
});

document.getElementById('reset-btn').addEventListener('click', resetAll);
document.getElementById('confirm-reset-btn').addEventListener('click', resetAll);
document.getElementById('confirm-back-btn').addEventListener('click', resetAll);

document.getElementById('finish-btn').addEventListener('click', showExportView);
document.getElementById('confirm-finish-btn').addEventListener('click', showExportView);
document.getElementById('back-to-editing').addEventListener('click', showBaseView);

document.getElementById('confirm-all-matched-btn').addEventListener('click', async () => {
  const steps = state.steps.map((s) => (matchStatusById[s.id] === 'found' && !s.confirmed ? { ...s, confirmed: true } : s));
  state = { ...state, steps };
  render();
  await sendMessage({ type: 'UPDATE_STEPS', steps });
});

document.getElementById('copy-btn').addEventListener('click', async () => {
  const text = document.getElementById('json-output').textContent;
  await navigator.clipboard.writeText(text);
  const btn = document.getElementById('copy-btn');
  const original = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => {
    btn.textContent = original;
  }, 1500);
});

document.getElementById('send-btn').addEventListener('click', async () => {
  const url = document.getElementById('backend-url').value.trim();
  const resultEl = document.getElementById('send-result');
  resultEl.className = 'send-result';
  resultEl.textContent = 'Sending…';
  const result = await sendFunnelSpec(url, buildExportSpec());
  if (result.ok) {
    resultEl.className = 'send-result ok';
    resultEl.textContent = `Sent — server responded ${result.status}`;
  } else {
    resultEl.className = 'send-result error';
    resultEl.textContent = result.error || `Server responded ${result.status}`;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.funnelState) {
    state = changes.funnelState.newValue;
    render();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'ELEMENT_PICKED') {
    handleElementPicked(message);
  }
});

(async function init() {
  state = await sendMessage({ type: 'GET_STATE' });
  state.steps.forEach((s) => renderedIds.add(s.id));
  render();
})();
