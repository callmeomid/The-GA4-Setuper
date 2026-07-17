let state = { recording: false, recordingOrigin: null, funnelName: '', steps: [] };
let renderedIds = new Set();

function sendMessage(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function render() {
  renderHeader();
  renderStepList();
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

async function showExportView() {
  document.getElementById('recorder-view').classList.add('hidden');
  document.getElementById('export-view').classList.remove('hidden');
  document.getElementById('json-output').textContent = JSON.stringify(buildExportSpec(), null, 2);

  const config = await loadBackendConfig();
  document.getElementById('backend-url').value = config.url;
  document.getElementById('api-key').value = config.apiKey;
  document.getElementById('send-result').textContent = '';
}

function showRecorderView() {
  document.getElementById('export-view').classList.add('hidden');
  document.getElementById('recorder-view').classList.remove('hidden');
}

async function sendFunnelSpec(url, apiKey, spec) {
  if (!url) return { ok: false, error: 'Enter a backend URL first' };
  if (!apiKey) return { ok: false, error: 'Enter an API key first' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(spec),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function loadBackendConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get('backendConfig', (data) => resolve(data.backendConfig || { url: '', apiKey: '' }));
  });
}

function saveBackendConfig(config) {
  return new Promise((resolve) => chrome.storage.local.set({ backendConfig: config }, resolve));
}

async function persistBackendConfig() {
  const url = document.getElementById('backend-url').value.trim();
  const apiKey = document.getElementById('api-key').value.trim();
  await saveBackendConfig({ url, apiKey });
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

document.getElementById('reset-btn').addEventListener('click', async () => {
  state = await sendMessage({ type: 'RESET_FUNNEL' });
  renderedIds = new Set();
  render();
});

document.getElementById('finish-btn').addEventListener('click', showExportView);
document.getElementById('back-to-editing').addEventListener('click', showRecorderView);

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

document.getElementById('backend-url').addEventListener('blur', persistBackendConfig);
document.getElementById('api-key').addEventListener('blur', persistBackendConfig);

document.getElementById('send-btn').addEventListener('click', async () => {
  const url = document.getElementById('backend-url').value.trim();
  const apiKey = document.getElementById('api-key').value.trim();
  await persistBackendConfig();
  const resultEl = document.getElementById('send-result');
  resultEl.className = 'send-result';
  resultEl.textContent = 'Sending…';
  const result = await sendFunnelSpec(url, apiKey, buildExportSpec());
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

(async function init() {
  state = await sendMessage({ type: 'GET_STATE' });
  state.steps.forEach((s) => renderedIds.add(s.id));
  render();
})();
