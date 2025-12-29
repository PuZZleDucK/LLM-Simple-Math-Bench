const OLLAMA_URL = "http://127.0.0.1:11434";
const RESULTS_ENDPOINT = "/api/results";
const RAW_RESULTS_ENDPOINT = "/api/results.csv";
const CLEAR_RESULTS_ENDPOINT = "/api/clear";
const UI_STATE_KEY = "ollama-bench-ui-v1";
const DEFAULT_NUM_PREDICT = 20000;
const RUNS_PER_TEST = 5;
const TOAST_TTL_MS = 8000;
const TOAST_MAX_VISIBLE = 4;

const tests = [
  createMultiPromptTest({
    id: "simple-addition",
    name: "Simple Addition",
    cases: [
      { id: "1+1", prompt: "Compute: 1 + 1. Respond only with the answer in digits.", expected: "2" },
      { id: "3+2", prompt: "Compute: 3 + 2. Respond only with the answer in digits.", expected: "5" },
      { id: "8+4", prompt: "Compute: 8 + 4. Respond only with the answer in digits.", expected: "12" },
      { id: "16+32", prompt: "Compute: 16 + 32. Respond only with the answer in digits.", expected: "48" },
      { id: "19+77", prompt: "Compute: 19 + 77. Respond only with the answer in digits.", expected: "96" },
    ],
  }),
  createMultiPromptTest({
    id: "simple-subtraction",
    name: "Simple Subtraction",
    cases: [
      { id: "2-1", prompt: "Compute: 2 - 1. Respond only with the answer in digits.", expected: "1" },
      { id: "5-2", prompt: "Compute: 5 - 2. Respond only with the answer in digits.", expected: "3" },
      { id: "11-3", prompt: "Compute: 11 - 3. Respond only with the answer in digits.", expected: "8" },
      { id: "67-32", prompt: "Compute: 67 - 32. Respond only with the answer in digits.", expected: "35" },
      { id: "97-58", prompt: "Compute: 97 - 58. Respond only with the answer in digits.", expected: "39" },
    ],
  }),
  createMultiPromptTest({
    id: "simple-multiplication",
    name: "Simple Multiplication",
    cases: [
      { id: "1*4", prompt: "Compute: 1 * 4. Respond only with the answer in digits.", expected: "4" },
      { id: "2*8", prompt: "Compute: 2 * 8. Respond only with the answer in digits.", expected: "16" },
      { id: "3*7", prompt: "Compute: 3 * 7. Respond only with the answer in digits.", expected: "21" },
      { id: "5*12", prompt: "Compute: 5 * 12. Respond only with the answer in digits.", expected: "60" },
      { id: "13*23", prompt: "Compute: 13 * 23. Respond only with the answer in digits.", expected: "299" },
    ],
  }),
  createMultiPromptTest({
    id: "simple-division",
    name: "Simple Division",
    cases: [
      { id: "3/1", prompt: "Compute: 3 / 1. Respond only with the answer in digits.", expected: "3" },
      { id: "7/7", prompt: "Compute: 7 / 7. Respond only with the answer in digits.", expected: "1" },
      { id: "15/5", prompt: "Compute: 15 / 5. Respond only with the answer in digits.", expected: "3" },
      { id: "60/15", prompt: "Compute: 60 / 15. Respond only with the answer in digits.", expected: "4" },
      { id: "100/20", prompt: "Compute: 100 / 20. Respond only with the answer in digits.", expected: "5" },
    ],
  }),
  createMultiPromptTest({
    id: "compound-addition",
    name: "Compound Addition",
    cases: [
      { id: "1+2+3", prompt: "Compute: 1 + 2 + 3. Respond only with the answer in digits.", expected: "6" },
      { id: "17+31+6", prompt: "Compute: 17 + 31 + 6. Respond only with the answer in digits.", expected: "54" },
      { id: "5+8+3+9", prompt: "Compute: 5 + 8 + 3 + 9. Respond only with the answer in digits.", expected: "25" },
      { id: "104+305+694", prompt: "Compute: 104 + 305 + 694. Respond only with the answer in digits.", expected: "1103" },
      { id: "638+837+921", prompt: "Compute: 638 + 837 + 921. Respond only with the answer in digits.", expected: "2396" },
    ],
  }),
  createMultiPromptTest({
    id: "compound-subtraction",
    name: "Compound Subtraction",
    cases: [
      { id: "3-2-1", prompt: "Compute: 3 - 2 - 1. Respond only with the answer in digits.", expected: "0" },
      { id: "3-(2-1)", prompt: "Compute: 3 - (2 - 1). Respond only with the answer in digits.", expected: "2" },
      { id: "10-5-7", prompt: "Compute: 10 - 5 - 7. Respond only with the answer in digits.", expected: "-2" },
      { id: "100-(50-7)", prompt: "Compute: 100 - (50 - 7). Respond only with the answer in digits.", expected: "57" },
      { id: "30-50-5", prompt: "Compute: 30 - 50 - 5. Respond only with the answer in digits.", expected: "-25" },
    ],
  }),
  createMultiPromptTest({
    id: "compound-multiplication",
    name: "Compound Multiplication",
    cases: [
      { id: "5*5*5", prompt: "Compute: 5 * 5 * 5. Respond only with the answer in digits.", expected: "125" },
      { id: "3*9*7", prompt: "Compute: 3 * 9 * 7. Respond only with the answer in digits.", expected: "189" },
      { id: "23*7*3", prompt: "Compute: 23 * 7 * 3. Respond only with the answer in digits.", expected: "483" },
      { id: "53*12*2", prompt: "Compute: 53 * 12 * 2. Respond only with the answer in digits.", expected: "1272" },
      { id: "32*41*13", prompt: "Compute: 32 * 41 * 13. Respond only with the answer in digits.", expected: "17056" },
    ],
  }),
  createMultiPromptTest({
    id: "compound-division",
    name: "Compound Division",
    cases: [
      {
        id: "9/3/3",
        prompt: "Compute: 9 / 3 / 3. Respond only with the answer in digits.",
        expected: "1",
        matchMode: "numeric",
      },
      {
        id: "12/(8/2)",
        prompt: "Compute: 12 / (8 / 2). Respond only with the answer in digits.",
        expected: "3",
        matchMode: "numeric",
      },
      {
        id: "25/5/2",
        prompt: "Compute: 25 / 5 / 2. Respond only with the answer in digits.",
        expected: "2.5",
        matchMode: "numeric",
      },
      {
        id: "100/5/2",
        prompt: "Compute: 100 / 5 / 2. Respond only with the answer in digits.",
        expected: "10",
        matchMode: "numeric",
      },
      {
        id: "900/25/9",
        prompt: "Compute: 900 / 25 / 9. Respond only with the answer in digits.",
        expected: "4",
        matchMode: "numeric",
      },
    ],
  }),
  createMultiPromptTest({
    id: "bmdas-assisted",
    name: "BMDAS Assisted",
    cases: [
      {
        id: "6+2*(5-3)",
        prompt:
          "Compute: 6 + 2 * (5 - 3). Use BMDAS (brackets, multiply, divide, add, subtract). Respond only with the answer in digits.",
        expected: "10",
      },
      {
        id: "(18/3)*(4+1)",
        prompt:
          "Compute: (18 / 3) * (4 + 1). Use BMDAS (brackets, multiply, divide, add, subtract). Respond only with the answer in digits.",
        expected: "30",
      },
      {
        id: "40-6*(3+2)",
        prompt:
          "Compute: 40 - 6 * (3 + 2). Use BMDAS (brackets, multiply, divide, add, subtract). Respond only with the answer in digits.",
        expected: "10",
      },
      {
        id: "(100-25)/5+7",
        prompt:
          "Compute: (100 - 25) / 5 + 7. Use BMDAS (brackets, multiply, divide, add, subtract). Respond only with the answer in digits.",
        expected: "22",
      },
      {
        id: "50/(5+5)*6-4",
        prompt:
          "Compute: 50 / (5 + 5) * 6 - 4. Use BMDAS (brackets, multiply, divide, add, subtract). Respond only with the answer in digits.",
        expected: "26",
      },
    ],
  }),
  createMultiPromptTest({
    id: "bmdas-mixed",
    name: "BMDAS Mixed",
    cases: [
      {
        id: "6+2*(5-3)",
        prompt: "Compute: 6 + 2 * (5 - 3). Respond only with the answer in digits.",
        expected: "10",
      },
      {
        id: "(18/3)*(4+1)",
        prompt: "Compute: (18 / 3) * (4 + 1). Respond only with the answer in digits.",
        expected: "30",
      },
      {
        id: "40-6*(3+2)",
        prompt: "Compute: 40 - 6 * (3 + 2). Respond only with the answer in digits.",
        expected: "10",
      },
      {
        id: "(100-25)/5+7",
        prompt: "Compute: (100 - 25) / 5 + 7. Respond only with the answer in digits.",
        expected: "22",
      },
      {
        id: "50/(5+5)*6-4",
        prompt: "Compute: 50 / (5 + 5) * 6 - 4. Respond only with the answer in digits.",
        expected: "26",
      },
    ],
  }),
];

const state = {
  models: [],
  filteredModels: [],
  results: {},
  running: false,
  lastUpdated: null,
  status: "Idle",
  regexValid: true,
  error: null,
  resultsError: null,
  excludedModels: new Set(),
  runtimeInfo: {},
};

const elements = {
  runBtn: document.getElementById("runBtn"),
  clearBtn: document.getElementById("clearBtn"),
  exportBtn: document.getElementById("exportBtn"),
  regexInput: document.getElementById("regexInput"),
  minSizeInput: document.getElementById("minSizeInput"),
  maxSizeInput: document.getElementById("maxSizeInput"),
  statusPill: document.getElementById("statusPill"),
  totalTests: document.getElementById("totalTests"),
  minScore: document.getElementById("minScore"),
  maxScore: document.getElementById("maxScore"),
  modelCount: document.getElementById("modelCount"),
  lastUpdated: document.getElementById("lastUpdated"),
  resultsTable: document.getElementById("resultsTable"),
};

let toastContainer = null;
const toastDedupe = new Map();
let hoverTooltip = null;

function ensureToastContainer() {
  if (toastContainer) {
    return toastContainer;
  }
  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function truncateText(text, maxLen) {
  const value = String(text ?? "");
  if (value.length <= maxLen) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLen - 1))}…`;
}

function removeToast(key) {
  const entry = toastDedupe.get(key);
  if (!entry) {
    return;
  }
  clearTimeout(entry.timeoutId);
  if (entry.element && entry.element.parentNode) {
    entry.element.parentNode.removeChild(entry.element);
  }
  toastDedupe.delete(key);
}

function showToast(message, { variant = "error", dedupeKey = null, ttlMs = TOAST_TTL_MS } = {}) {
  const container = ensureToastContainer();
  const safeMessage = truncateText(message, 240);
  const key = dedupeKey || `${variant}:${safeMessage}`;

  const existing = toastDedupe.get(key);
  if (existing && existing.element && existing.element.parentNode) {
    existing.count += 1;
    const countEl = existing.element.querySelector(".toast-count");
    if (countEl) {
      countEl.textContent = `x${existing.count}`;
    }
    clearTimeout(existing.timeoutId);
    existing.timeoutId = setTimeout(() => removeToast(key), ttlMs);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;

  const messageEl = document.createElement("div");
  messageEl.className = "toast-message";
  messageEl.textContent = safeMessage;

  const meta = document.createElement("div");
  meta.className = "toast-meta";

  const countEl = document.createElement("span");
  countEl.className = "toast-count";
  countEl.textContent = "";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => removeToast(key));

  meta.append(countEl, closeBtn);
  toast.append(messageEl, meta);

  container.prepend(toast);

  while (container.children.length > TOAST_MAX_VISIBLE) {
    const last = container.lastElementChild;
    if (!last) {
      break;
    }
    last.remove();
    for (const [mapKey, entry] of toastDedupe.entries()) {
      if (entry.element === last) {
        toastDedupe.delete(mapKey);
        break;
      }
    }
  }

  const timeoutId = setTimeout(() => removeToast(key), ttlMs);
  toastDedupe.set(key, { element: toast, count: 1, timeoutId });
}

function notifyRunError({ modelName, testName, caseId, error }) {
  const prefix = [modelName, testName, caseId].filter(Boolean).join(" / ");
  showToast(`${prefix}: ${error}`, {
    variant: "error",
    dedupeKey: `${prefix}|${String(error)}`,
  });
}

function ensureHoverTooltip() {
  if (hoverTooltip) {
    return hoverTooltip;
  }
  hoverTooltip = document.createElement("div");
  hoverTooltip.className = "hover-tooltip";
  hoverTooltip.setAttribute("role", "tooltip");
  hoverTooltip.style.display = "none";
  const pre = document.createElement("pre");
  pre.className = "hover-tooltip__pre";
  hoverTooltip.appendChild(pre);
  document.body.appendChild(hoverTooltip);
  return hoverTooltip;
}

function positionHoverTooltip(event) {
  if (!hoverTooltip || hoverTooltip.style.display === "none") {
    return;
  }
  const margin = 12;
  const maxLeft = window.innerWidth - hoverTooltip.offsetWidth - margin;
  const maxTop = window.innerHeight - hoverTooltip.offsetHeight - margin;
  const left = Math.max(margin, Math.min(maxLeft, event.clientX + margin));
  const top = Math.max(margin, Math.min(maxTop, event.clientY + margin));
  hoverTooltip.style.left = `${left}px`;
  hoverTooltip.style.top = `${top}px`;
}

function bindHoverTooltip(element, text) {
  if (!element || !text) {
    return;
  }
  ensureHoverTooltip();
  element.addEventListener("pointerenter", (event) => {
    const tooltip = ensureHoverTooltip();
    const pre = tooltip.querySelector(".hover-tooltip__pre");
    if (pre) {
      pre.textContent = text;
    }
    tooltip.style.display = "block";
    positionHoverTooltip(event);
  });
  element.addEventListener("pointermove", (event) => {
    positionHoverTooltip(event);
  });
  element.addEventListener("pointerleave", () => {
    if (!hoverTooltip) {
      return;
    }
    hoverTooltip.style.display = "none";
  });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, value));
  return `${clamped.toFixed(clamped >= 10 ? 0 : 1)}%`;
}

function formatGb(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return null;
  }
  const gb = sizeBytes / 1e9;
  return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`;
}

async function fetchRuntimeInfo(modelName) {
  const response = await fetch(`${OLLAMA_URL}/api/ps`);
  if (!response.ok) {
    throw new Error("Unable to fetch /api/ps");
  }
  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];
  const entry =
    models.find((m) => m?.name === modelName) || models.find((m) => m?.model === modelName);
  if (!entry) {
    return null;
  }
  const totalBytes = Number(entry?.size);
  const vramBytes = Number(entry?.size_vram);
  const total = Number.isFinite(totalBytes) ? totalBytes : null;
  const vram = Number.isFinite(vramBytes) ? vramBytes : null;
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  const gpuShare = Number.isFinite(vram) && vram > 0 ? Math.min(1, vram / total) : 0;
  const gpuPercent = gpuShare * 100;
  const cpuPercent = 100 - gpuPercent;
  return {
    totalBytes: total,
    vramBytes: Number.isFinite(vram) ? vram : 0,
    cpuPercent,
    gpuPercent,
    contextLength: Number(entry?.context_length) || null,
  };
}

function getModelInfoNumber(modelInfo, suffix) {
  if (!modelInfo || typeof modelInfo !== "object") {
    return null;
  }
  for (const [key, value] of Object.entries(modelInfo)) {
    if (!key.endsWith(suffix)) {
      continue;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

function estimateContextBytesFromModelInfo(modelInfo) {
  const contextTokens = getModelInfoNumber(modelInfo, ".context_length");
  const layers = getModelInfoNumber(modelInfo, ".block_count");
  const headCountKv = getModelInfoNumber(modelInfo, ".attention.head_count_kv");
  const keyLength = getModelInfoNumber(modelInfo, ".attention.key_length");
  const valueLength = getModelInfoNumber(modelInfo, ".attention.value_length");
  if (
    !Number.isFinite(contextTokens) ||
    !Number.isFinite(layers) ||
    !Number.isFinite(headCountKv) ||
    !Number.isFinite(keyLength) ||
    !Number.isFinite(valueLength)
  ) {
    return { contextTokens: Number.isFinite(contextTokens) ? contextTokens : null, bytes: null };
  }

  // Best-effort estimate of KV cache size at max context length.
  // Assumes fp16 cache (2 bytes per element) and ignores overhead.
  const bytesPerElement = 2;
  const bytes =
    contextTokens * layers * headCountKv * (keyLength + valueLength) * bytesPerElement;
  return { contextTokens, bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : null };
}

async function fetchModelInfo(modelName) {
  const response = await fetch(`${OLLAMA_URL}/api/show`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName }),
  });
  if (!response.ok) {
    throw new Error("Unable to fetch /api/show");
  }
  const data = await response.json();
  return data?.model_info ?? null;
}

async function updateRuntimeInfo(modelName) {
  try {
    const info = await fetchRuntimeInfo(modelName);
    if (info) {
      const merged = { ...info };
      try {
        const modelInfo = await fetchModelInfo(modelName);
        const contextEstimate = estimateContextBytesFromModelInfo(modelInfo);
        merged.contextTokens = contextEstimate.contextTokens;
        merged.contextBytesEstimated = contextEstimate.bytes;
      } catch {
        // Ignore /api/show failures; runtime info is still useful.
      }
      state.runtimeInfo[modelName] = merged;
    }
  } catch (error) {
    showToast(`Failed to read runtime info (${modelName}): ${String(error?.message || error)}`, {
      variant: "error",
      dedupeKey: `runtime:${modelName}:${String(error?.message || error)}`,
    });
  }
}

async function init() {
  ensureToastContainer();
  loadUiStateFromStorage();
  bindEvents();
  await loadResults();
  updateSummary();
  await loadModels();
  applyFilters();
  render();
}

function bindEvents() {
  elements.runBtn.addEventListener("click", runUnrunBenchmarks);
  elements.clearBtn.addEventListener("click", clearResults);
  elements.exportBtn.addEventListener("click", exportCsv);
  elements.regexInput.addEventListener("input", handleFilterChange);
  elements.minSizeInput.addEventListener("input", handleFilterChange);
  elements.maxSizeInput.addEventListener("input", handleFilterChange);
}

function loadUiStateFromStorage() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }
    if (typeof parsed.regex === "string") {
      elements.regexInput.value = parsed.regex;
    }
    if (typeof parsed.min === "string") {
      elements.minSizeInput.value = parsed.min;
    }
    if (typeof parsed.max === "string") {
      elements.maxSizeInput.value = parsed.max;
    }
    if (Array.isArray(parsed.excluded)) {
      state.excludedModels = new Set(parsed.excluded.filter(Boolean));
    }
  } catch (error) {
    console.warn("Failed to load UI state", error);
  }
}

function saveUiStateToStorage() {
  const payload = {
    regex: elements.regexInput.value.trim(),
    min: elements.minSizeInput.value.trim(),
    max: elements.maxSizeInput.value.trim(),
    excluded: Array.from(state.excludedModels),
  };
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to save UI state", error);
  }
}

function createMultiPromptTest({ id, name, cases }) {
  const maxScore = cases.length * 2 * RUNS_PER_TEST;
  return {
    id,
    name,
    minScore: 0,
    maxScore,
    caseCount: cases.length,
    repeatCount: RUNS_PER_TEST,
    runCount: cases.length * RUNS_PER_TEST,
    run: async (modelName) => {
      const caseResults = [];
      let totalScore = 0;
      const statsTotals = createStatsAccumulator();
      const runStats = [];

      for (let runIndex = 0; runIndex < RUNS_PER_TEST; runIndex += 1) {
        const runAccumulator = createStatsAccumulator();
        for (const [index, testCase] of cases.entries()) {
          const rawCaseId = testCase.id || `case-${index + 1}`;
          const caseId = `${rawCaseId} #${runIndex + 1}`;
          const prompt = testCase.prompt;
          const expected = String(testCase.expected);
          const matchMode = testCase.matchMode || "literal";
          let output = "";
          let error = "";
          let stats = {};
          let caseScore = 0;

          try {
            const response = await callChat(modelName, prompt);
            output = response.content.trim();
            stats = response.stats;
            addStats(statsTotals, stats);
            addStats(runAccumulator, stats);
            const { contains, exactOnly } = scoreAnswer(output, expected, matchMode);
            if (contains) {
              caseScore += 1;
            }
            if (exactOnly) {
              caseScore += 1;
            }
          } catch (err) {
            error = String(err?.message || err);
            notifyRunError({ modelName, testName: name, caseId, error });
          }

          totalScore += caseScore;
          caseResults.push({
            caseId,
            prompt,
            expected,
            score: caseScore,
            maxScore: 2,
            output,
            error,
            completedAt: new Date().toISOString(),
            ...stats,
          });
        }
        runStats.push(finalizeStats(runAccumulator));
      }

      const avgPromptTokensPerSecond = averageFinite(
        runStats.map((stats) => stats.promptTokensPerSecond)
      );
      const avgEvalTokensPerSecond = averageFinite(
        runStats.map((stats) => stats.evalTokensPerSecond)
      );

      const outputSummary = caseResults
        .map((caseResult) => {
          const label = caseResult.caseId || "case";
          if (caseResult.error) {
            return `${label}: error: ${caseResult.error}`;
          }
          if (caseResult.output) {
            return `${label}: ${caseResult.output}`;
          }
          return `${label}: (no output)`;
        })
        .join("\n---\n");
      const aggregatedStats = finalizeStats(statsTotals);
      return {
        score: totalScore,
        maxScore,
        output: outputSummary,
        completedAt: new Date().toISOString(),
        caseResults,
        ...aggregatedStats,
        avgPromptTokensPerSecond,
        avgEvalTokensPerSecond,
        promptTokensPerSecond: avgPromptTokensPerSecond ?? aggregatedStats.promptTokensPerSecond,
        evalTokensPerSecond: avgEvalTokensPerSecond ?? aggregatedStats.evalTokensPerSecond,
      };
    },
  };
}

function createNumericTest({ id, name, prompt, expected, tolerance, maxScore }) {
  return {
    id,
    name,
    prompt,
    minScore: 0,
    maxScore,
    run: async (modelName) => {
      const { content, stats } = await callChat(modelName, prompt);
      const output = content.trim();
      const baseResult = {
        maxScore,
        output,
        ...stats,
      };
      const number = extractFirstNumber(content);
      if (number === null) {
        return { ...baseResult, error: "No numeric answer" };
      }
      const diff = Math.abs(number - expected);
      const score = diff <= tolerance ? maxScore : 0;
      return {
        ...baseResult,
        score,
      };
    },
  };
}

async function callChat(modelName, prompt) {
  const payload = {
    model: modelName,
    messages: [{ role: "user", content: prompt }],
    stream: false,
    options: {
      temperature: 0,
      num_predict: DEFAULT_NUM_PREDICT,
    },
  };

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to call Ollama");
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(String(data.error));
  }
  const stats = {
    promptEvalCount: toNumber(data?.prompt_eval_count),
    evalCount: toNumber(data?.eval_count),
    promptEvalDuration: toNumber(data?.prompt_eval_duration),
    evalDuration: toNumber(data?.eval_duration),
    totalDuration: toNumber(data?.total_duration),
    loadDuration: toNumber(data?.load_duration),
  };
  stats.promptTokensPerSecond = calculateTokensPerSecond(
    stats.promptEvalCount,
    stats.promptEvalDuration
  );
  stats.evalTokensPerSecond = calculateTokensPerSecond(
    stats.evalCount,
    stats.evalDuration
  );
  const content = data?.message?.content ?? "";
  if (!content || !content.trim()) {
    const doneReason = data?.done_reason ? String(data.done_reason) : "";
    const hasThinking = Boolean(data?.message?.thinking);
    throw new Error(
      hasThinking && doneReason === "length"
        ? `Empty response (hit token limit at num_predict=${DEFAULT_NUM_PREDICT})`
        : "Empty response"
    );
  }
  return {
    content,
    stats,
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function averageFinite(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  let sum = 0;
  let count = 0;
  values.forEach((value) => {
    if (Number.isFinite(value)) {
      sum += value;
      count += 1;
    }
  });
  if (count === 0) {
    return null;
  }
  return sum / count;
}

function calculateTokensPerSecond(tokens, durationNs) {
  if (!Number.isFinite(tokens) || !Number.isFinite(durationNs) || durationNs <= 0) {
    return null;
  }
  return tokens / (durationNs / 1e9);
}

function scoreAnswer(output, expected, matchMode) {
  if (!output) {
    return { contains: false, exactOnly: false };
  }
  if (matchMode === "numeric") {
    return scoreNumericAnswer(output, expected);
  }
  return {
    contains: containsExpectedAnswer(output, expected),
    exactOnly: isExactAnswer(output, expected),
  };
}

function scoreNumericAnswer(output, expected) {
  const expectedValue = parseNumericValue(expected);
  if (expectedValue === null) {
    return { contains: false, exactOnly: false };
  }
  const normalized = normalizeFractionSpacing(output);
  const tokens = extractNumericTokens(normalized);
  const contains = tokens.some((value) => numericEqual(value, expectedValue));
  const exactTokenValue = parseNumericToken(normalized.trim());
  const exactOnly =
    exactTokenValue !== null && numericEqual(exactTokenValue, expectedValue);
  return { contains, exactOnly };
}

function parseNumericToken(text) {
  const normalized = normalizeFractionSpacing(text.trim());
  if (!/^-?(?:\d+\/\d+|\d*\.\d+|\d+)$/.test(normalized)) {
    return null;
  }
  return parseNumericValue(normalized);
}

function parseNumericValue(token) {
  const normalized = normalizeFractionSpacing(String(token).trim());
  if (!normalized) {
    return null;
  }
  if (normalized.includes("/")) {
    const [rawNumerator, rawDenominator] = normalized.split("/");
    const numerator = Number(rawNumerator);
    const denominator = Number(rawDenominator);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractNumericTokens(text) {
  const normalized = normalizeFractionSpacing(text);
  const regex = /-?(?:\d+\/\d+|\d*\.\d+|\d+)/g;
  const tokens = [];
  const matches = normalized.match(regex) || [];
  matches.forEach((match) => {
    const value = parseNumericValue(match);
    if (value !== null) {
      tokens.push(value);
    }
  });
  return tokens;
}

function numericEqual(a, b) {
  return Math.abs(a - b) <= 1e-9;
}

function normalizeFractionSpacing(text) {
  return String(text).replace(/(\d)\s*\/\s*(\d)/g, "$1/$2");
}

function createStatsAccumulator() {
  return {
    promptEvalCount: 0,
    evalCount: 0,
    promptEvalDuration: 0,
    evalDuration: 0,
    totalDuration: 0,
    loadDuration: 0,
    hasPromptEvalCount: false,
    hasEvalCount: false,
    hasPromptEvalDuration: false,
    hasEvalDuration: false,
    hasTotalDuration: false,
    hasLoadDuration: false,
  };
}

function addStats(accumulator, stats) {
  if (!stats) {
    return;
  }
  if (Number.isFinite(stats.promptEvalCount)) {
    accumulator.promptEvalCount += stats.promptEvalCount;
    accumulator.hasPromptEvalCount = true;
  }
  if (Number.isFinite(stats.evalCount)) {
    accumulator.evalCount += stats.evalCount;
    accumulator.hasEvalCount = true;
  }
  if (Number.isFinite(stats.promptEvalDuration)) {
    accumulator.promptEvalDuration += stats.promptEvalDuration;
    accumulator.hasPromptEvalDuration = true;
  }
  if (Number.isFinite(stats.evalDuration)) {
    accumulator.evalDuration += stats.evalDuration;
    accumulator.hasEvalDuration = true;
  }
  if (Number.isFinite(stats.totalDuration)) {
    accumulator.totalDuration += stats.totalDuration;
    accumulator.hasTotalDuration = true;
  }
  if (Number.isFinite(stats.loadDuration)) {
    accumulator.loadDuration += stats.loadDuration;
    accumulator.hasLoadDuration = true;
  }
}

function finalizeStats(accumulator) {
  const totals = {
    promptEvalCount: accumulator.hasPromptEvalCount
      ? accumulator.promptEvalCount
      : null,
    evalCount: accumulator.hasEvalCount ? accumulator.evalCount : null,
    promptEvalDuration: accumulator.hasPromptEvalDuration
      ? accumulator.promptEvalDuration
      : null,
    evalDuration: accumulator.hasEvalDuration ? accumulator.evalDuration : null,
    totalDuration: accumulator.hasTotalDuration ? accumulator.totalDuration : null,
    loadDuration: accumulator.hasLoadDuration ? accumulator.loadDuration : null,
  };
  totals.promptTokensPerSecond = calculateTokensPerSecond(
    totals.promptEvalCount,
    totals.promptEvalDuration
  );
  totals.evalTokensPerSecond = calculateTokensPerSecond(
    totals.evalCount,
    totals.evalDuration
  );
  return totals;
}

function isExactAnswer(text, expected) {
  return text.trim() === expected;
}

function containsExpectedAnswer(text, expected) {
  const escaped = escapeRegExp(expected);
  const regex = new RegExp(`(?:^|[^0-9])${escaped}(?:[^0-9]|$)`);
  return regex.test(text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFirstNumber(text) {
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

async function loadModels() {
  try {
    setStatus("Loading models");
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) {
      throw new Error("Unable to fetch /api/tags");
    }
    const data = await response.json();
    state.models = (data.models || []).map((model) => {
      const sizeText = model?.details?.parameter_size || "";
      const sizeBytes = Number(model?.size);
      return {
        name: model.name,
        sizeB: parseParamSize(sizeText),
        sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
        raw: model,
      };
    });
    state.error = null;
  } catch (error) {
    state.error = error;
    state.models = [];
  } finally {
    setStatus("Idle");
  }
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

function handleFilterChange() {
  applyFilters();
  saveUiStateToStorage();
  render();
}

function excludeModel(name) {
  if (!name) {
    return;
  }
  state.excludedModels.add(name);
  applyFilters();
  saveUiStateToStorage();
  render();
}

function applyFilters() {
  const regexText = elements.regexInput.value.trim();
  const minSize = parseFloat(elements.minSizeInput.value);
  const maxSize = parseFloat(elements.maxSizeInput.value);
  let regex = null;
  state.regexValid = true;

  if (regexText) {
    try {
      regex = new RegExp(regexText, "i");
    } catch (error) {
      state.regexValid = false;
    }
  }

  elements.regexInput.classList.toggle("invalid", !state.regexValid);

  if (!state.regexValid) {
    state.filteredModels = [];
    return;
  }

  state.filteredModels = state.models.filter((model) => {
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

function updateSummary() {
  const minTotal = tests.reduce((sum, test) => sum + test.minScore, 0);
  const maxTotal = tests.reduce((sum, test) => sum + test.maxScore, 0);
  elements.totalTests.textContent = String(tests.length);
  elements.minScore.textContent = String(minTotal);
  elements.maxScore.textContent = String(maxTotal);
}

function render() {
  updateSummary();
  updateStatusPill();
  renderTable();
  renderMeta();
}

function updateStatusPill() {
  elements.statusPill.textContent = state.status;
}

function renderMeta() {
  const count = state.filteredModels.length;
  if (!state.regexValid) {
    elements.modelCount.textContent = "0 models selected (invalid regex)";
  } else {
    elements.modelCount.textContent = `${count} model${count === 1 ? "" : "s"} selected`;
  }

  if (state.lastUpdated) {
    elements.lastUpdated.textContent = `Last updated: ${formatTimestamp(
      state.lastUpdated
    )}`;
  } else if (state.resultsError) {
    elements.lastUpdated.textContent = "Results offline";
  } else {
    elements.lastUpdated.textContent = "";
  }
}

function renderTable() {
  const thead = elements.resultsTable.querySelector("thead");
  const tbody = elements.resultsTable.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const headerRow = document.createElement("tr");
  headerRow.appendChild(createHeaderCell("Model"));
  tests.forEach((test) => {
    headerRow.appendChild(createHeaderCell(test.name));
  });
  headerRow.appendChild(createHeaderCell("Average"));
  thead.appendChild(headerRow);

  if (state.error) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = tests.length + 2;
    cell.textContent = "Failed to load models. Check the Ollama URL.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  if (state.filteredModels.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = tests.length + 2;
    cell.textContent = "No models match the current filters.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const models = [...state.filteredModels].sort((a, b) => {
    const aScore = calculateAverage(a.name);
    const bScore = calculateAverage(b.name);
    if (aScore === null && bScore === null) {
      return a.name.localeCompare(b.name);
    }
    if (aScore === null) {
      return 1;
    }
    if (bScore === null) {
      return -1;
    }
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    return a.name.localeCompare(b.name);
  });

  models.forEach((model, index) => {
    const row = document.createElement("tr");
    row.style.animationDelay = `${index * 20}ms`;
	    if (state.excludedModels.has(model.name)) {
	      row.classList.add("row-excluded");
	    }
	    const nameCell = document.createElement("td");
	    const nameWrap = document.createElement("div");
	    nameWrap.className = "model-name";
	    const nameTop = document.createElement("div");
	    nameTop.className = "model-name__top";
	    const nameMeta = document.createElement("div");
	    nameMeta.className = "model-name__meta";
	    const excludeBtn = document.createElement("button");
	    excludeBtn.type = "button";
	    excludeBtn.className = "exclude-btn";
	    excludeBtn.textContent = "x";
    excludeBtn.title = state.excludedModels.has(model.name)
      ? "Excluded from runs"
      : "Exclude model from runs";
    excludeBtn.setAttribute("aria-label", `Exclude ${model.name}`);
    excludeBtn.disabled = state.excludedModels.has(model.name);
    excludeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      excludeModel(model.name);
    });
    const nameText = document.createElement("span");
    nameText.textContent = formatModelName(model.name);
    nameText.className = "cell-mono";
    nameText.title = model.name;
	    const sizeText = document.createElement("span");
	    sizeText.className = "model-size";
	    sizeText.textContent = formatModelSize(model.sizeB, model.sizeBytes) || "n/a";
	    const runtimeText = document.createElement("span");
	    runtimeText.className = "model-runtime";
	    const runtimeInfo = state.runtimeInfo[model.name];
	    if (runtimeInfo) {
	      const cpuPct = formatPercent(runtimeInfo.cpuPercent) || "?";
	      const gpuPct = formatPercent(runtimeInfo.gpuPercent) || "?";
	      const runningSize = formatGb(runtimeInfo.totalBytes) || "n/a";
	      const ctxGb = formatGb(runtimeInfo.contextBytesEstimated);
	      runtimeText.textContent = ctxGb
	        ? `runtime: CPU ${cpuPct} / GPU ${gpuPct} • ${runningSize} • ctx ~${ctxGb}`
	        : `runtime: CPU ${cpuPct} / GPU ${gpuPct} • ${runningSize}`;
	    } else {
	      runtimeText.textContent = "";
	    }

	    nameTop.append(excludeBtn, nameText);
	    nameMeta.append(sizeText);
	    if (runtimeText.textContent) {
	      nameMeta.append(runtimeText);
	    }
	    nameWrap.append(nameTop, nameMeta);
	    nameCell.appendChild(nameWrap);
	    row.appendChild(nameCell);

    const modelResults = state.results[model.name] || {};

    tests.forEach((test) => {
      const result = modelResults[test.id];
      const cell = document.createElement("td");
      if (!result || result.maxScore !== test.maxScore) {
        cell.textContent = "pending";
        cell.className = "pending";
	      } else if (result.error) {
	        cell.textContent = "error";
	        cell.className = "error";
	        const tooltip = formatResultTooltip(result, test);
	        if (tooltip) {
	          bindHoverTooltip(cell, tooltip);
	        }
	      } else if (typeof result.score === "number") {
	        const scoreWrap = document.createElement("div");
	        scoreWrap.className = "score-stack";
        const chip = document.createElement("span");
        chip.className = "score-chip";
        chip.textContent = formatScore(result.score, result.maxScore);
        if (result.score === result.maxScore) {
          chip.classList.add("score-chip--max");
        } else if (result.score === 0) {
          chip.classList.add("score-chip--zero");
        }
        scoreWrap.appendChild(chip);
	        const avgDuration = getResultAverageDurationNs(result, test);
	        const durationText = formatDurationNs(avgDuration);
	        if (durationText) {
	          const time = document.createElement("div");
	          time.className = "time-sub";
	          time.textContent = `${durationText}`;
	          scoreWrap.appendChild(time);
	        }
	        const avgTokensPerSecond = getResultAverageTokensPerSecond(result);
	        if (Number.isFinite(avgTokensPerSecond) && avgTokensPerSecond > 0) {
	          const tps = document.createElement("div");
	          tps.className = "time-sub";
	          tps.textContent = `${avgTokensPerSecond.toFixed(1)} t/s`;
	          scoreWrap.appendChild(tps);
	        }
	        const tooltip = formatResultTooltip(result, test);
	        if (tooltip) {
	          bindHoverTooltip(scoreWrap, tooltip);
	        }
	        cell.appendChild(scoreWrap);
	      } else {
	        cell.textContent = "...";
	        cell.className = "pending";
      }
      row.appendChild(cell);
    });

    const avgCell = document.createElement("td");
    avgCell.className = "cell-mono";
    const avg = calculateAverage(model.name);
    avgCell.textContent = avg === null ? "--" : `${(avg * 100).toFixed(1)}%`;
    row.appendChild(avgCell);

    tbody.appendChild(row);
  });
}

function calculateAverage(modelName) {
  const results = state.results[modelName] || {};
  let totalScore = 0;
  let totalMax = 0;

  tests.forEach((test) => {
    const result = results[test.id];
    if (result && result.maxScore === test.maxScore && typeof result.score === "number") {
      totalScore += result.score;
      totalMax += result.maxScore;
    }
  });

  if (totalMax === 0) {
    return null;
  }
  return totalScore / totalMax;
}

function createHeaderCell(text) {
  const cell = document.createElement("th");
  cell.textContent = text;
  return cell;
}

async function runUnrunBenchmarks() {
  if (state.running || state.filteredModels.length === 0) {
    return;
  }

  state.running = true;
  toggleButtons(true);

  try {
	    for (const model of state.filteredModels) {
	      if (state.excludedModels.has(model.name)) {
	        continue;
	      }
	      let runtimeCaptured = Boolean(state.runtimeInfo[model.name]);
	      const modelResults = state.results[model.name] || {};
	      for (const test of tests) {
	        const existing = modelResults[test.id];
	        if (existing && existing.maxScore === test.maxScore) {
	          continue;
	        }
	        setStatus(`Running ${test.name} on ${model.name}`);
	        try {
	          const result = await test.run(model.name);
	          const completedAt = new Date().toISOString();
	          modelResults[test.id] = {
	            ...result,
	            completedAt,
	          };
	          await persistResult(model.name, test, modelResults[test.id]);
	        } catch (error) {
	          const completedAt = new Date().toISOString();
	          notifyRunError({
	            modelName: model.name,
	            testName: test.name,
	            caseId: null,
	            error: String(error?.message || error),
	          });
	          modelResults[test.id] = {
	            error: String(error.message || error),
	            maxScore: test.maxScore,
	            completedAt,
	          };
	          await persistResult(model.name, test, modelResults[test.id]);
	        }
	        if (!runtimeCaptured) {
	          await updateRuntimeInfo(model.name);
	          runtimeCaptured = Boolean(state.runtimeInfo[model.name]);
	        }
	        state.results[model.name] = modelResults;
	        state.lastUpdated = new Date();
	        render();
	      }
	    }
	  } finally {
    state.running = false;
    setStatus("Idle");
    toggleButtons(false);
    render();
  }
}

function toggleButtons(disabled) {
  elements.runBtn.disabled = disabled;
  elements.clearBtn.disabled = disabled;
  elements.exportBtn.disabled = disabled;
}

async function clearResults() {
  if (state.running) {
    return;
  }
  try {
    await fetch(CLEAR_RESULTS_ENDPOINT, { method: "POST" });
  } catch (error) {
    console.warn("Failed to clear results", error);
  }
  state.results = {};
  state.lastUpdated = null;
  render();
}

function exportCsv() {
  const link = document.createElement("a");
  link.href = RAW_RESULTS_ENDPOINT;
  link.download = "ollama-benchmarks-raw.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setStatus(text) {
  state.status = text;
  updateStatusPill();
}

function formatScore(score, maxScore) {
  return `${score}/${maxScore}`;
}

function formatResultTooltip(result, test) {
  if (!result) {
    return "";
  }
  const lines = [];
  const prefixForScore = (score, maxScore) =>
    typeof score === "number" && typeof maxScore === "number" && score === maxScore
      ? "✅"
      : "❌";
  if (result.error) {
    lines.push(`❌ Error: ${result.error}`);
  }
  if (Array.isArray(result.caseResults) && result.caseResults.length > 0) {
    result.caseResults.forEach((caseResult) => {
      const label = caseResult.caseId || test?.name || "case";
      if (caseResult.error) {
        lines.push(`❌ ${label}: error: ${caseResult.error}`);
      } else if (caseResult.output) {
        const prefix = prefixForScore(caseResult.score, caseResult.maxScore);
        lines.push(`${prefix} ${label}: ${caseResult.output}`);
      } else {
        lines.push(`❌ ${label}: (no output)`);
      }
    });
  } else if (result.output) {
    const prefix = prefixForScore(result.score, result.maxScore);
    lines.push(`${prefix} ${result.output.trim()}`);
  }
  return lines.join("\n");
}

function getResultDurationNs(result) {
  if (!result) {
    return null;
  }
  if (Number.isFinite(result.totalDuration)) {
    return result.totalDuration;
  }
  if (Array.isArray(result.caseResults)) {
    let sum = 0;
    let has = false;
    result.caseResults.forEach((caseResult) => {
      if (Number.isFinite(caseResult.totalDuration)) {
        sum += caseResult.totalDuration;
        has = true;
      }
    });
    return has ? sum : null;
  }
  return null;
}

function getResultAverageDurationNs(result, test) {
  const total = getResultDurationNs(result);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  const repeats = Number(test?.repeatCount);
  if (Number.isFinite(repeats) && repeats > 0) {
    return total / repeats;
  }
  const runs = Number(test?.runCount);
  if (Number.isFinite(runs) && runs > 0) {
    return total / runs;
  }
  return total;
}

function getResultAverageTokensPerSecond(result) {
  if (!result) {
    return null;
  }
  if (Number.isFinite(result.avgEvalTokensPerSecond) && result.avgEvalTokensPerSecond > 0) {
    return result.avgEvalTokensPerSecond;
  }
  if (Number.isFinite(result.evalTokensPerSecond) && result.evalTokensPerSecond > 0) {
    return result.evalTokensPerSecond;
  }
  return null;
}

function formatDurationNs(durationNs) {
  if (!Number.isFinite(durationNs) || durationNs <= 0) {
    return null;
  }
  const seconds = durationNs / 1e9;
  if (seconds < 1) {
    const ms = seconds * 1000;
    const precision = ms < 100 ? 1 : 0;
    return `${ms.toFixed(precision)} ms`;
  }
  if (seconds < 10) {
    return `${seconds.toFixed(2)} s`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatModelName(name) {
  const limit = 25;
  if (!name || name.length <= limit) {
    return name;
  }
  return `${name.slice(0, limit - 3)}...`;
}

function formatModelSize(sizeB, sizeBytes) {
  const paramText = formatParamCount(sizeB);
  const gbText = formatSizeGb(sizeBytes);
  if (paramText && gbText) {
    return `${paramText} / ${gbText}`;
  }
  return paramText || gbText;
}

function formatParamCount(sizeB) {
  if (!Number.isFinite(sizeB)) {
    return null;
  }
  let precision = 1;
  if (sizeB >= 10) {
    precision = 0;
  } else if (sizeB < 1) {
    precision = 2;
  }
  return `${sizeB.toFixed(precision)}B`;
}

function formatSizeGb(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return null;
  }
  const gb = sizeBytes / 1e9;
  let precision = 2;
  if (gb >= 10) {
    precision = 1;
  } else if (gb < 1) {
    precision = 3;
  }
  return `${gb.toFixed(precision)} GB`;
}

function formatTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

async function loadResults() {
  try {
    const response = await fetch(RESULTS_ENDPOINT);
    if (!response.ok) {
      throw new Error("Unable to fetch results");
    }
    const data = await response.json();
    state.results = data.results || {};
    state.lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : null;
    state.resultsError = null;
  } catch (error) {
    state.results = {};
    state.lastUpdated = null;
    state.resultsError = error;
  }
}

async function persistResult(modelName, test, result) {
  const entries = [];
  const aggregateTimestamp = result.completedAt || new Date().toISOString();
  entries.push({
    timestamp: aggregateTimestamp,
    model: modelName,
    test_id: test.id,
    test_name: test.name,
    case_id: "",
    case_prompt: "",
    expected: "",
    score: result.score ?? "",
    max_score: result.maxScore ?? test.maxScore,
    output: result.output ?? "",
    error: result.error ?? "",
    prompt_eval_count: result.promptEvalCount ?? "",
    eval_count: result.evalCount ?? "",
    prompt_eval_duration: result.promptEvalDuration ?? "",
    eval_duration: result.evalDuration ?? "",
    total_duration: result.totalDuration ?? "",
    load_duration: result.loadDuration ?? "",
    prompt_tokens_per_second: result.promptTokensPerSecond ?? "",
    eval_tokens_per_second: result.evalTokensPerSecond ?? "",
  });

  if (Array.isArray(result.caseResults)) {
    result.caseResults.forEach((caseResult) => {
      entries.push({
        timestamp: caseResult.completedAt || aggregateTimestamp,
        model: modelName,
        test_id: test.id,
        test_name: test.name,
        case_id: caseResult.caseId ?? "",
        case_prompt: caseResult.prompt ?? "",
        expected: caseResult.expected ?? "",
        score: caseResult.score ?? "",
        max_score: caseResult.maxScore ?? 2,
        output: caseResult.output ?? "",
        error: caseResult.error ?? "",
        prompt_eval_count: caseResult.promptEvalCount ?? "",
        eval_count: caseResult.evalCount ?? "",
        prompt_eval_duration: caseResult.promptEvalDuration ?? "",
        eval_duration: caseResult.evalDuration ?? "",
        total_duration: caseResult.totalDuration ?? "",
        load_duration: caseResult.loadDuration ?? "",
        prompt_tokens_per_second: caseResult.promptTokensPerSecond ?? "",
        eval_tokens_per_second: caseResult.evalTokensPerSecond ?? "",
      });
    });
  }

  const payload = {
    entries,
  };

  try {
    const response = await fetch(RESULTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.warn("Failed to persist result", error);
    showToast(`Failed to persist result (${modelName} / ${test?.name}): ${String(error?.message || error)}`, {
      variant: "error",
      dedupeKey: `persist:${modelName}:${test?.id}:${String(error?.message || error)}`,
    });
  }
}

init();
