const DEFAULT_STATE = { recording: false, recordingOrigin: null, funnelName: '', steps: [] };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('funnelState', (data) => {
    if (!data.funnelState) chrome.storage.local.set({ funnelState: DEFAULT_STATE });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get('funnelState', (data) => resolve(data.funnelState || DEFAULT_STATE));
  });
}

function setState(state) {
  return new Promise((resolve) => chrome.storage.local.set({ funnelState: state }, resolve));
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (e) {
    return null;
  }
}

function generateId() {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function handleMessage(message, sender) {
  const state = await getState();

  switch (message.type) {
    case 'GET_STATE':
      return state;

    case 'START_RECORDING': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const origin = tab && tab.url ? safeOrigin(tab.url) : null;
      const nextState = {
        ...state,
        recording: true,
        recordingOrigin: origin,
        funnelName: message.funnelName || state.funnelName,
        steps: [],
      };
      await setState(nextState);
      return nextState;
    }

    case 'STOP_RECORDING': {
      const nextState = { ...state, recording: false };
      await setState(nextState);
      return nextState;
    }

    case 'STEP_CAPTURED': {
      if (!state.recording) return state;
      const senderOrigin = sender.origin || (sender.url ? safeOrigin(sender.url) : null);
      if (state.recordingOrigin && senderOrigin && senderOrigin !== state.recordingOrigin) return state;
      const nextState = { ...state, steps: [...state.steps, { id: generateId(), ...message.step }] };
      await setState(nextState);
      return nextState;
    }

    case 'UPDATE_STEPS': {
      const nextState = { ...state, steps: message.steps };
      await setState(nextState);
      return nextState;
    }

    case 'SET_FUNNEL_NAME': {
      const nextState = { ...state, funnelName: message.funnelName };
      await setState(nextState);
      return nextState;
    }

    case 'RESET_FUNNEL': {
      await setState(DEFAULT_STATE);
      return DEFAULT_STATE;
    }

    default:
      return state;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});
