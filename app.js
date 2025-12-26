const OLLAMA_URL = "http://dundee.tail31c56b.ts.net:11434";
const RESULTS_ENDPOINT = "/api/results";
const RAW_RESULTS_ENDPOINT = "/api/results.csv";
const CLEAR_RESULTS_ENDPOINT = "/api/clear";
const UI_STATE_KEY = "ollama-bench-ui-v1";

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
  const maxScore = cases.length * 2;
  return {
    id,
    name,
    minScore: 0,
    maxScore,
    run: async (modelName) => {
      const caseResults = [];
      let totalScore = 0;
      const statsTotals = createStatsAccumulator();

      for (const [index, testCase] of cases.entries()) {
        const caseId = testCase.id || `case-${index + 1}`;
        const prompt = testCase.prompt;
        const expected = String(testCase.expected);
        let output = "";
        let error = "";
        let stats = {};
        let caseScore = 0;

        try {
          const response = await callChat(modelName, prompt);
          output = response.content.trim();
          stats = response.stats;
          addStats(statsTotals, stats);
          const contains = containsExpectedAnswer(output, expected);
          const exactOnly = isExactAnswer(output, expected);
          if (contains) {
            caseScore += 1;
          }
          if (exactOnly) {
            caseScore += 1;
          }
        } catch (err) {
          error = String(err?.message || err);
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
    nameWrap.append(excludeBtn, nameText, sizeText);
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
        const tooltip = formatResultTooltip(result, test);
        if (tooltip) {
          cell.title = tooltip;
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
        const totalDuration = getResultDurationNs(result);
        const durationText = formatDurationNs(totalDuration);
        if (durationText) {
          const time = document.createElement("div");
          time.className = "time-sub";
          time.textContent = durationText;
          scoreWrap.appendChild(time);
        }
        const tooltip = formatResultTooltip(result, test);
        if (tooltip) {
          scoreWrap.title = tooltip;
        }
        cell.appendChild(scoreWrap);
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
      if (state.excludedModels.has(model.name)) {
        continue;
      }
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

function formatResultTooltip(result, test) {
  if (!result) {
    return "";
  }
  const lines = [];
  if (result.error) {
    lines.push(`Error: ${result.error}`);
  }
  if (Array.isArray(result.caseResults) && result.caseResults.length > 0) {
    result.caseResults.forEach((caseResult) => {
      const label = caseResult.caseId || test?.name || "case";
      if (caseResult.error) {
        lines.push(`${label}: error: ${caseResult.error}`);
      } else if (caseResult.output) {
        lines.push(`${label}: ${caseResult.output}`);
      } else {
        lines.push(`${label}: (no output)`);
      }
    });
  } else if (result.output) {
    lines.push(result.output.trim());
  }
  return lines.join("\n---\n");
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
  }
}
