const UI_STATE_KEY = "ollama-bench-ui-v1";
const DEFAULT_OLLAMA_HOST = "http://127.0.0.1";
const DEFAULT_OLLAMA_PORT = "11434";
const DEFAULT_NUM_PREDICT = "3000";
const DEFAULT_RUNS_PER_TEST = "2";
const TOTAL_TESTS = 14;

const elements = {
  regexInput: document.getElementById("regexInput"),
  minSizeInput: document.getElementById("minSizeInput"),
  maxSizeInput: document.getElementById("maxSizeInput"),
  ollamaHostInput: document.getElementById("ollamaHostInput"),
  ollamaPortInput: document.getElementById("ollamaPortInput"),
  numPredictInput: document.getElementById("numPredictInput"),
  runNameInput: document.getElementById("runNameInput"),
  runsPerTestInput: document.getElementById("runsPerTestInput"),
  totalTestCount: document.getElementById("totalTestCount"),
  ollamaModelCount: document.getElementById("ollamaModelCount"),
  filteredModelCount: document.getElementById("filteredModelCount"),
  statusPill: document.getElementById("statusPill"),
};

const state = {
  filters: {
    regexText: "",
    minSizeText: "",
    maxSizeText: "",
  },
  inference: {
    hostText: DEFAULT_OLLAMA_HOST,
    portText: DEFAULT_OLLAMA_PORT,
    numPredictText: DEFAULT_NUM_PREDICT,
  },
  runSettings: {
    runNameText: "",
    runsPerTestText: DEFAULT_RUNS_PER_TEST,
  },
  validity: {
    regexValid: true,
    hostValid: true,
    portValid: true,
    numPredictValid: true,
    runsPerTestValid: true,
  },
  models: [],
  modelsStatus: "idle",
  lastBaseUrl: "",
  fetchTimer: null,
  fetchController: null,
};

init();

function init() {
  if (
    !elements.regexInput ||
    !elements.minSizeInput ||
    !elements.maxSizeInput ||
    !elements.ollamaHostInput ||
    !elements.ollamaPortInput ||
    !elements.numPredictInput ||
    !elements.runNameInput ||
    !elements.runsPerTestInput
  ) {
    return;
  }
  loadUiStateFromStorage();
  bindEvents();
  refreshModelCounts();
}

function bindEvents() {
  elements.regexInput.addEventListener("input", handleChange);
  elements.minSizeInput.addEventListener("input", handleChange);
  elements.maxSizeInput.addEventListener("input", handleChange);
  elements.ollamaHostInput.addEventListener("input", handleChange);
  elements.ollamaPortInput.addEventListener("input", handleChange);
  elements.numPredictInput.addEventListener("input", handleChange);
  elements.runNameInput.addEventListener("input", handleChange);
  elements.runsPerTestInput.addEventListener("input", handleChange);
}

function handleChange() {
  const filters = readFilterInputs();
  const inference = readInferenceInputs();
  const runSettings = readRunSettingsInputs();
  const regexValid = validateRegex(filters.regexText);
  const hostValid = validateHost(inference.hostText);
  const portValid = validatePort(inference.portText);
  const numPredictValid = validateNumPredict(inference.numPredictText);
  const runsPerTestValid = validateRunsPerTest(runSettings.runsPerTestText);
  elements.regexInput.classList.toggle("invalid", !regexValid);
  elements.ollamaHostInput.classList.toggle("invalid", !hostValid);
  elements.ollamaPortInput.classList.toggle("invalid", !portValid);
  elements.numPredictInput.classList.toggle("invalid", !numPredictValid);
  elements.runsPerTestInput.classList.toggle("invalid", !runsPerTestValid);
  state.filters = filters;
  state.inference = inference;
  state.runSettings = normalizeRunSettings(runSettings);
  state.validity = {
    regexValid,
    hostValid,
    portValid,
    numPredictValid,
    runsPerTestValid,
  };
  saveUiStateToStorage({ filters, inference, runSettings: state.runSettings });
  const allValid =
    regexValid && hostValid && portValid && numPredictValid && runsPerTestValid;
  updateStatus(allValid ? "Saved" : !regexValid ? "Invalid regex" : "Invalid input");
  refreshModelCounts();
  updateTestRunSummary();
}

function readFilterInputs() {
  return {
    regexText: elements.regexInput.value.trim(),
    minSizeText: elements.minSizeInput.value.trim(),
    maxSizeText: elements.maxSizeInput.value.trim(),
  };
}

function readInferenceInputs() {
  return {
    hostText: elements.ollamaHostInput.value.trim(),
    portText: elements.ollamaPortInput.value.trim(),
    numPredictText: elements.numPredictInput.value.trim(),
  };
}

function readRunSettingsInputs() {
  return {
    runNameText: elements.runNameInput.value.trim(),
    runsPerTestText: elements.runsPerTestInput.value.trim(),
  };
}

function normalizeRunSettings({ runNameText, runsPerTestText }) {
  return {
    runNameText: normalizeText(runNameText),
    runsPerTestText:
      normalizeText(runsPerTestText) || DEFAULT_RUNS_PER_TEST,
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseLegacyOllamaUrl(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    return {
      hostText: `${url.protocol}//${url.hostname}`,
      portText: url.port,
    };
  } catch {
    return null;
  }
}

function validateRegex(text) {
  if (!text) {
    return true;
  }
  try {
    new RegExp(text, "i");
    return true;
  } catch {
    return false;
  }
}

function validateHost(text) {
  return Boolean(normalizeText(text));
}

function validatePort(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return true;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return false;
  }
  const intValue = Math.trunc(value);
  return intValue > 0 && intValue <= 65535;
}

function validateNumPredict(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return true;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return false;
  }
  const intValue = Math.trunc(value);
  return intValue > 0;
}

function validateRunsPerTest(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return true;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return false;
  }
  const intValue = Math.trunc(value);
  return intValue > 0;
}

function parsePort(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  const intValue = Math.trunc(value);
  if (intValue <= 0 || intValue > 65535) {
    return null;
  }
  return String(intValue);
}

function buildOllamaUrl(hostText, portText) {
  const hostValue = normalizeText(hostText) || DEFAULT_OLLAMA_HOST;
  const withScheme =
    /^https?:\/\//i.test(hostValue) ? hostValue : `http://${hostValue}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    url = new URL(DEFAULT_OLLAMA_HOST);
  }
  const port = parsePort(portText) || url.port || DEFAULT_OLLAMA_PORT;
  const host =
    url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname;
  return `${url.protocol}//${host}:${port}`;
}

function parseParamSize(text) {
  if (!text) {
    return null;
  }
  const match = text.trim().match(/([\d.]+)\s*([BM])/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (!Number.isFinite(value)) {
    return null;
  }
  if (unit === "B") {
    return value;
  }
  if (unit === "M") {
    return value / 1000;
  }
  return null;
}

function buildModelList(data) {
  const models = Array.isArray(data?.models) ? data.models : [];
  return models
    .map((model) => {
      const name = String(model?.name || model?.model || "").trim();
      const sizeText = model?.details?.parameter_size || "";
      return {
        name,
        sizeB: parseParamSize(sizeText),
      };
    })
    .filter((model) => model.name);
}

function filterModels(models, filters, regexValid) {
  if (!regexValid) {
    return [];
  }
  const regexText = normalizeText(filters.regexText);
  const minSize = parseFloat(filters.minSizeText);
  const maxSize = parseFloat(filters.maxSizeText);
  let regex = null;
  if (regexText) {
    try {
      regex = new RegExp(regexText, "i");
    } catch {
      return [];
    }
  }
  return models.filter((model) => {
    if (regex && !regex.test(model.name)) {
      return false;
    }
    const sizeB = model.sizeB;
    if (Number.isFinite(minSize)) {
      if (sizeB === null || sizeB < minSize) {
        return false;
      }
    }
    if (Number.isFinite(maxSize)) {
      if (sizeB === null || sizeB > maxSize) {
        return false;
      }
    }
    return true;
  });
}

function parseRunsPerTest(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return Number(DEFAULT_RUNS_PER_TEST);
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  const intValue = Math.trunc(value);
  return intValue > 0 ? intValue : null;
}

function updateTestRunSummary() {
  if (!elements.totalTestCount) {
    return;
  }
  if (!state.validity.runsPerTestValid) {
    elements.totalTestCount.textContent = "Invalid input";
    return;
  }
  const runsPerTest = parseRunsPerTest(state.runSettings.runsPerTestText);
  if (!runsPerTest) {
    elements.totalTestCount.textContent = "Invalid input";
    return;
  }
  const total = runsPerTest * TOTAL_TESTS;
  elements.totalTestCount.textContent = String(total);
}

function refreshModelCounts() {
  const { hostValid, portValid } = state.validity;
  if (!hostValid || !portValid) {
    state.modelsStatus = "invalid";
    updateModelCountDisplays();
    return;
  }
  const baseUrl = buildOllamaUrl(
    state.inference.hostText,
    state.inference.portText
  );
  if (baseUrl !== state.lastBaseUrl) {
    state.lastBaseUrl = baseUrl;
    scheduleModelFetch(baseUrl);
    return;
  }
  updateModelCountDisplays();
}

function scheduleModelFetch(baseUrl) {
  if (state.fetchTimer) {
    clearTimeout(state.fetchTimer);
  }
  if (state.fetchController) {
    state.fetchController.abort();
  }
  state.modelsStatus = "loading";
  updateModelCountDisplays();
  state.fetchTimer = setTimeout(() => {
    fetchModelList(baseUrl);
  }, 300);
}

async function fetchModelList(baseUrl) {
  const controller = new AbortController();
  state.fetchController = controller;
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${baseUrl}/api/tags`);
    }
    const data = await response.json();
    if (baseUrl !== state.lastBaseUrl) {
      return;
    }
    state.models = buildModelList(data);
    state.modelsStatus = "ready";
    updateModelCountDisplays();
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    state.models = [];
    state.modelsStatus = "error";
    updateModelCountDisplays();
  }
}

function updateModelCountDisplays() {
  updateOllamaModelCount();
  updateFilteredModelCount();
}

function updateOllamaModelCount() {
  if (!elements.ollamaModelCount) {
    return;
  }
  if (state.modelsStatus === "loading") {
    elements.ollamaModelCount.textContent = "Loading";
    return;
  }
  if (state.modelsStatus === "error") {
    elements.ollamaModelCount.textContent = "Unavailable";
    return;
  }
  if (state.modelsStatus === "invalid") {
    elements.ollamaModelCount.textContent = "Invalid input";
    return;
  }
  if (state.modelsStatus === "ready") {
    elements.ollamaModelCount.textContent = String(state.models.length);
    return;
  }
  elements.ollamaModelCount.textContent = "—";
}

function updateFilteredModelCount() {
  if (!elements.filteredModelCount) {
    return;
  }
  if (state.modelsStatus === "loading") {
    elements.filteredModelCount.textContent = "Loading";
    return;
  }
  if (state.modelsStatus === "error") {
    elements.filteredModelCount.textContent = "Unavailable";
    return;
  }
  if (state.modelsStatus === "invalid") {
    elements.filteredModelCount.textContent = "Invalid input";
    return;
  }
  if (!state.validity.regexValid) {
    elements.filteredModelCount.textContent = "Invalid regex";
    return;
  }
  if (state.modelsStatus !== "ready") {
    elements.filteredModelCount.textContent = "—";
    return;
  }
  const filtered = filterModels(state.models, state.filters, state.validity.regexValid);
  elements.filteredModelCount.textContent = String(filtered.length);
}

function loadUiStateFromStorage() {
  const stored = readStoredState();
  const filters = {
    regexText: typeof stored.regex === "string" ? stored.regex : "",
    minSizeText: typeof stored.min === "string" ? stored.min : "",
    maxSizeText: typeof stored.max === "string" ? stored.max : "",
  };
  const inference = resolveInferenceSettings(stored);
  const runSettings = resolveRunSettings(stored);
  elements.regexInput.value = filters.regexText;
  elements.minSizeInput.value = filters.minSizeText;
  elements.maxSizeInput.value = filters.maxSizeText;
  elements.ollamaHostInput.value = inference.hostText;
  elements.ollamaPortInput.value = inference.portText;
  elements.numPredictInput.value = inference.numPredictText;
  elements.runNameInput.value = runSettings.runNameText;
  elements.runsPerTestInput.value = runSettings.runsPerTestText;
  const regexValid = validateRegex(filters.regexText);
  const hostValid = validateHost(inference.hostText);
  const portValid = validatePort(inference.portText);
  const numPredictValid = validateNumPredict(inference.numPredictText);
  const runsPerTestValid = validateRunsPerTest(runSettings.runsPerTestText);
  elements.regexInput.classList.toggle("invalid", !regexValid);
  elements.ollamaHostInput.classList.toggle("invalid", !hostValid);
  elements.ollamaPortInput.classList.toggle("invalid", !portValid);
  elements.numPredictInput.classList.toggle("invalid", !numPredictValid);
  elements.runsPerTestInput.classList.toggle("invalid", !runsPerTestValid);
  state.filters = filters;
  state.inference = inference;
  state.runSettings = runSettings;
  state.validity = {
    regexValid,
    hostValid,
    portValid,
    numPredictValid,
    runsPerTestValid,
  };
  const allValid =
    regexValid && hostValid && portValid && numPredictValid && runsPerTestValid;
  updateStatus(allValid ? "Ready" : !regexValid ? "Invalid regex" : "Invalid input");
  updateTestRunSummary();
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function resolveInferenceSettings(stored) {
  const legacy = parseLegacyOllamaUrl(stored.ollamaUrl);
  const hostText =
    normalizeText(stored.ollamaHost) ||
    legacy?.hostText ||
    DEFAULT_OLLAMA_HOST;
  const portText =
    normalizeText(stored.ollamaPort) ||
    legacy?.portText ||
    DEFAULT_OLLAMA_PORT;
  const numPredictText =
    normalizeText(stored.defaultNumPredict) || DEFAULT_NUM_PREDICT;
  return { hostText, portText, numPredictText };
}

function resolveRunSettings(stored) {
  const runNameText = normalizeText(stored.runName);
  const runsPerTestText =
    normalizeText(stored.runsPerTest) || DEFAULT_RUNS_PER_TEST;
  return normalizeRunSettings({ runNameText, runsPerTestText });
}

function saveUiStateToStorage({ filters, inference, runSettings }) {
  const stored = readStoredState();
  const payload = {
    ...stored,
    regex: filters.regexText,
    min: filters.minSizeText,
    max: filters.maxSizeText,
    ollamaHost: inference.hostText,
    ollamaPort: inference.portText,
    defaultNumPredict: inference.numPredictText,
    runsPerTest: runSettings.runsPerTestText,
    runName: runSettings.runNameText,
  };
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(payload));
  } catch (error) {
    updateStatus("Unable to save");
  }
}

function updateStatus(text) {
  if (!elements.statusPill) {
    return;
  }
  elements.statusPill.textContent = text;
}
