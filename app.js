const OLLAMA_URL = "http://dundee.tail31c56b.ts.net:11434";
const RESULTS_ENDPOINT = "/api/results";
const RAW_RESULTS_ENDPOINT = "/api/results.csv";
const CLEAR_RESULTS_ENDPOINT = "/api/clear";

const tests = [
  createNumericTest({
    id: "add-17-25",
    name: "Add 17 + 25",
    prompt: "Compute: 17 + 25. Respond with the number only.",
    expected: 42,
    tolerance: 0,
    maxScore: 1,
  }),
  createNumericTest({
    id: "mul-12-9",
    name: "Multiply 12 * 9",
    prompt: "Compute: 12 * 9. Respond with the number only.",
    expected: 108,
    tolerance: 0,
    maxScore: 1,
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

init();

async function init() {
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
      num_predict: 64,
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
  return {
    content: data?.message?.content ?? "",
    stats,
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateTokensPerSecond(tokens, durationNs) {
  if (!Number.isFinite(tokens) || !Number.isFinite(durationNs) || durationNs <= 0) {
    return null;
  }
  return tokens / (durationNs / 1e9);
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
    const nameCell = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "model-name";
    const nameText = document.createElement("span");
    nameText.textContent = formatModelName(model.name);
    nameText.className = "cell-mono";
    nameText.title = model.name;
    const sizeText = document.createElement("span");
    sizeText.className = "model-size";
    sizeText.textContent = formatModelSize(model.sizeB, model.sizeBytes) || "n/a";
    nameWrap.append(nameText, sizeText);
    nameCell.appendChild(nameWrap);
    row.appendChild(nameCell);

    const modelResults = state.results[model.name] || {};

    tests.forEach((test) => {
      const result = modelResults[test.id];
      const cell = document.createElement("td");
      if (!result) {
        cell.textContent = "pending";
        cell.className = "pending";
      } else if (result.error) {
        cell.textContent = "error";
        cell.className = "error";
      } else if (typeof result.score === "number") {
        cell.innerHTML = `<span class="score-chip">${formatScore(
          result.score,
          result.maxScore
        )}</span>`;
      } else {
        cell.textContent = "pending";
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
    if (result && typeof result.score === "number") {
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
      const modelResults = state.results[model.name] || {};
      for (const test of tests) {
        if (modelResults[test.id]) {
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
          modelResults[test.id] = {
            error: String(error.message || error),
            maxScore: test.maxScore,
            completedAt,
          };
          await persistResult(model.name, test, modelResults[test.id]);
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
  const payload = {
    entries: [
      {
        timestamp: result.completedAt,
        model: modelName,
        test_id: test.id,
        test_name: test.name,
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
      },
    ],
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
  }
}
