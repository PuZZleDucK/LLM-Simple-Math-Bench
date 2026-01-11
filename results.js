const DEFAULT_RESULTS_FILE = "results.csv";

function sanitizeResultsFilename(filename) {
  if (!filename) {
    return null;
  }
  const name = String(filename).trim();
  if (!name) {
    return null;
  }
  const base = name.split(/[\\/]/).pop();
  if (!/^results(?:-[a-z0-9][a-z0-9._-]*)?\.csv$/i.test(base)) {
    return null;
  }
  return base;
}

function resolveResultsFileFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeResultsFilename(params.get("file")) || DEFAULT_RESULTS_FILE;
}

function resolveBaseUrl() {
  const url = new URL(window.location.href);
  const path = url.pathname;
  const hasExtension = /\.[a-z0-9]+$/i.test(path);
  if (path.endsWith("/")) {
    // Keep directory path as-is.
  } else if (hasExtension) {
    url.pathname = path.replace(/[^/]*$/, "");
  } else {
    url.pathname = `${path}/`;
  }
  url.search = "";
  url.hash = "";
  return url;
}

const RESULTS_FILE = resolveResultsFileFromUrl();
const BASE_URL = resolveBaseUrl();
const RESULTS_MANIFEST_URL = new URL("data/results-files.json", BASE_URL).toString();

function buildStaticCsvUrl(fileName) {
  return new URL(`data/${fileName}`, BASE_URL).toString();
}

function buildApiCsvUrl(fileName) {
  const apiUrl = new URL("api/results.csv", BASE_URL);
  apiUrl.searchParams.set("file", fileName);
  return apiUrl.toString();
}

const STATIC_CSV_URL = buildStaticCsvUrl(RESULTS_FILE);
const API_CSV_URL = buildApiCsvUrl(RESULTS_FILE);

const state = {
  rows: [],
  tests: [],
  results: {},
  modelOrder: [],
  modelMeta: {},
  modelColors: {},
  status: "Loading",
  lastUpdated: null,
  error: null,
  resultsFile: RESULTS_FILE,
  csvUrl: STATIC_CSV_URL,
};

const elements = {
  statusPill: document.getElementById("statusPill"),
  totalTests: document.getElementById("totalTests"),
  maxScore: document.getElementById("maxScore"),
  modelCount: document.getElementById("modelCount"),
  winningModel: document.getElementById("winningModel"),
  bestAverage: document.getElementById("bestAverage"),
  minAverage: document.getElementById("minAverage"),
  meanAverage: document.getElementById("meanAverage"),
  medianAverage: document.getElementById("medianAverage"),
  fastestTime: document.getElementById("fastestTime"),
  lastUpdated: document.getElementById("lastUpdated"),
  progressChart: document.getElementById("progressChart"),
  resultsTable: document.getElementById("resultsTable"),
  tableHint: document.getElementById("tableHint"),
  downloadCsvLink: document.getElementById("downloadCsvLink"),
  downloadHint: document.getElementById("downloadHint"),
};

init();

async function init() {
  updateDownloadLink();
  try {
    await loadCsv();
    state.status = "Ready";
  } catch (error) {
    state.error = error;
    state.status = "Missing CSV";
  }
  render();
}

function updateDownloadLink() {
  if (!elements.downloadCsvLink) {
    return;
  }
  elements.downloadCsvLink.href = state.csvUrl;
  elements.downloadCsvLink.download = state.resultsFile;
  if (elements.downloadHint) {
    if (state.csvUrl.startsWith("/api/")) {
      elements.downloadHint.textContent = "Ensure the API results endpoint is available.";
    } else {
      elements.downloadHint.textContent = `Ensure \`data/${RESULTS_FILE}\` is published.`;
    }
  }
}

async function loadCsv() {
  let fileName = state.resultsFile;
  let staticUrl = buildStaticCsvUrl(fileName);
  let text = await fetchCsvText(staticUrl);
  if (text === null) {
    if (fileName === DEFAULT_RESULTS_FILE) {
      const manifestFiles = await loadResultsManifest();
      if (manifestFiles.length > 0) {
        fileName = manifestFiles[0];
        state.resultsFile = fileName;
        staticUrl = buildStaticCsvUrl(fileName);
        text = await fetchCsvText(staticUrl);
      }
    }
  }

  if (text === null) {
    const apiText = await fetchCsvText(buildApiCsvUrl(fileName));
    if (apiText === null) {
      throw new Error(`Failed to load ${fileName}`);
    }
    state.csvUrl = buildApiCsvUrl(fileName);
    updateDownloadLink();
    parseCsvText(apiText);
    return;
  }
  state.csvUrl = staticUrl;
  updateDownloadLink();
  parseCsvText(text);
}

async function fetchCsvText(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

async function loadResultsManifest() {
  try {
    const response = await fetch(RESULTS_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.files)) {
      return [];
    }
    return data.files
      .map((file) => sanitizeResultsFilename(file))
      .filter((file) => file && file.toLowerCase() !== DEFAULT_RESULTS_FILE);
  } catch {
    return [];
  }
}

function parseCsvText(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return;
  }
  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).filter((row) => row.length > 0);
  state.rows = dataRows.map((row) => rowToObject(headers, row));
  buildResults();
}

function buildResults() {
  const tests = new Map();
  const results = {};
  const modelSet = new Set();
  const modelMeta = {};
  let lastUpdated = null;

  state.rows.forEach((row) => {
    const model = (row.model || "").trim();
    const testId = (row.test_id || "").trim();
    const testName = (row.test_name || testId || "").trim();
    const caseId = (row.case_id || "").trim();
    if (!model || !testId) {
      return;
    }
    if (caseId) {
      return;
    }

    modelSet.add(model);
    modelMeta[model] ||= {};
    const sizeBytes = toNumber(row.model_size_bytes);
    const sizeB = toNumber(row.model_param_b);
    if (Number.isFinite(sizeBytes)) {
      modelMeta[model].sizeBytes = sizeBytes;
    }
    if (Number.isFinite(sizeB)) {
      modelMeta[model].sizeB = sizeB;
    }

    if (!tests.has(testId)) {
      tests.set(testId, {
        id: testId,
        name: testName || testId,
        maxScore: toNumber(row.max_score) || 0,
        order: tests.size,
      });
    }

    const timestamp = parseTimestamp(row.timestamp);
    if (timestamp && (!lastUpdated || timestamp > lastUpdated)) {
      lastUpdated = timestamp;
    }

    results[model] ||= {};
    const current = results[model][testId];
    const currentTime = current ? parseTimestamp(current.timestamp) : null;
    if (!current || (timestamp && (!currentTime || timestamp > currentTime))) {
      results[model][testId] = row;
    }
  });

  state.tests = Array.from(tests.values()).sort((a, b) => a.order - b.order);
  state.results = results;
  state.modelOrder = Array.from(modelSet).sort();
  state.modelMeta = modelMeta;
  state.lastUpdated = lastUpdated;
}

function render() {
  updateSummary();
  updateStatus();
  state.modelColors = buildModelColorMap();
  renderProgressChart();
  renderTable();
}

function buildModelColorMap() {
  const models = [...state.modelOrder];
  const meta = state.modelMeta || {};
  const entries = models.map((name) => {
    const sizeBytes = meta?.[name]?.sizeBytes;
    const sizeB = meta?.[name]?.sizeB;
    return {
      name,
      size: Number.isFinite(sizeBytes)
        ? sizeBytes
        : Number.isFinite(sizeB)
          ? sizeB
          : null,
    };
  });

  entries.sort((a, b) => {
    if (a.size === null && b.size === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.size === null) {
      return 1;
    }
    if (b.size === null) {
      return -1;
    }
    return a.size - b.size;
  });

  const n = entries.length;
  const colors = {};
  entries.forEach((entry, idx) => {
    const t = n <= 1 ? 0 : idx / (n - 1);
    colors[entry.name] = gradientModelColor(t);
  });
  return colors;
}

function gradientModelColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  // Dark blue -> purple -> red as sizes grow.
  const blue = { h: 215, s: 78, l: 38 };
  const purple = { h: 285, s: 72, l: 50 };
  const red = { h: 10, s: 80, l: 52 };
  if (clamped < 0.55) {
    const u = clamped / 0.55;
    return hslLerp(blue, purple, u);
  }
  const u = (clamped - 0.55) / 0.45;
  return hslLerp(purple, red, u);
}

function hslLerp(a, b, t) {
  const lerp = (x, y) => x + (y - x) * t;
  const h = lerp(a.h, b.h);
  const s = lerp(a.s, b.s);
  const l = lerp(a.l, b.l);
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / 1)`;
}

let chartResizeListenerBound = false;

function getCanvasCssWidth(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width && rect.width > 0) {
    return rect.width;
  }
  const parent = canvas.parentElement;
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    if (parentRect.width && parentRect.width > 0) {
      return parentRect.width;
    }
  }
  return canvas.clientWidth || 0;
}

function renderProgressChart() {
  const canvas = elements.progressChart;
  if (!canvas) {
    return;
  }

  if (!chartResizeListenerBound) {
    chartResizeListenerBound = true;
    window.addEventListener("resize", () => {
      renderProgressChart();
    });
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  canvas.style.width = "100%";
  const width = getCanvasCssWidth(canvas);
  const height = Math.max(240, Math.min(380, Math.round(((width || 720) * 0.25))));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (width <= 10) {
    // Layout can report 0 width briefly; retry next frame.
    requestAnimationFrame(() => renderProgressChart());
    return;
  }

  if (state.error || state.tests.length === 0 || state.modelOrder.length === 0) {
    drawChartMessage(ctx, width, height, state.error ? "Chart unavailable (CSV missing)." : "No data yet.");
    return;
  }

  const maxTotal = state.tests.reduce((sum, test) => sum + test.maxScore, 0);
  if (maxTotal <= 0) {
    drawChartMessage(ctx, width, height, "No score range available.");
    return;
  }

  const padding = { left: 44, right: 14, top: 12, bottom: 26 };
  const plotW = Math.max(1, width - padding.left - padding.right);
  const plotH = Math.max(1, height - padding.top - padding.bottom);
  const testCount = state.tests.length;
  const pointCount = testCount + 1;

  const xForIndex = (i) => {
    if (pointCount <= 1) {
      return padding.left + plotW / 2;
    }
    return padding.left + (i / (pointCount - 1)) * plotW;
  };
  const yForScore = (score) => {
    const clamped = Math.max(0, Math.min(maxTotal, score));
    return padding.top + (1 - clamped / maxTotal) * plotH;
  };

  drawChartGrid(ctx, {
    width,
    height,
    padding,
    plotW,
    plotH,
    testCount,
    pointCount,
    maxTotal,
    xForIndex,
    yForScore,
  });

  const modelsByFinal = [...state.modelOrder].sort((a, b) => {
    const ta = calculateTotalScore(a);
    const tb = calculateTotalScore(b);
    if (ta === tb) {
      return a.localeCompare(b);
    }
    return tb - ta;
  });

  modelsByFinal.forEach((modelName, idx) => {
    const series = buildCumulativeSeries(modelName);
    if (!series) {
      return;
    }
    const color = state.modelColors?.[modelName] || colorForModel(modelName);
    drawSeries(ctx, series, { idx, color, xForIndex, yForScore });
  });

  // Always draw a small legend hint to confirm the chart rendered.
  ctx.save();
  ctx.fillStyle = "rgba(164, 169, 183, 0.9)";
  ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${state.modelOrder.length} models`, width - 10, height - 8);
  ctx.restore();
}

function drawChartMessage(ctx, width, height, message) {
  ctx.save();
  ctx.fillStyle = "rgba(164, 169, 183, 0.85)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
  ctx.restore();
}

function drawChartGrid(ctx, { width, height, padding, plotW, plotH, testCount, pointCount, maxTotal, xForIndex, yForScore }) {
  ctx.save();
  ctx.strokeStyle = "rgba(164, 169, 183, 0.35)";
  ctx.lineWidth = 1;

  // Outer bounds
  ctx.strokeRect(padding.left, padding.top, plotW, plotH);

  // Horizontal grid + labels
  const steps = 4;
  ctx.fillStyle = "rgba(244, 241, 236, 0.9)";
  ctx.font = "11px var(--mono, ui-monospace)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= steps; i += 1) {
    const score = (i / steps) * maxTotal;
    const y = yForScore(score);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(score)), padding.left - 6, y);
  }

  // Vertical grid (tests)
  ctx.strokeStyle = "rgba(164, 169, 183, 0.18)";
  for (let i = 0; i <= testCount; i += 1) {
    const x = xForIndex(i);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();
  }

  // Test index labels (1..N) along the x axis.
  const approxLabelWidth = 14;
  const step = Math.max(1, Math.ceil(testCount / Math.max(1, Math.floor(plotW / approxLabelWidth))));
  ctx.fillStyle = "rgba(244, 241, 236, 0.78)";
  ctx.font = "10px var(--mono, ui-monospace)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 1; i <= testCount; i += step) {
    const x = xForIndex(i);
    ctx.fillText(String(i), x, padding.top + plotH + 8);
  }

  // x-axis hint
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("tests →", padding.left, padding.top + plotH + 8);
  ctx.restore();
}

function drawSeries(ctx, series, { idx, color, xForIndex, yForScore }) {
  ctx.save();
  const emphasized = idx < 5;
  ctx.lineWidth = emphasized ? 2.6 : 1.7;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = emphasized ? 1 : 0.65;

  // Draw segments (stop at nulls).
  ctx.beginPath();
  let hasSegment = false;
  let segmentStarted = false;
  series.forEach((score, i) => {
    if (!Number.isFinite(score)) {
      segmentStarted = false;
      return;
    }
    const x = xForIndex(i);
    const y = yForScore(score);
    if (!segmentStarted) {
      ctx.moveTo(x, y);
      segmentStarted = true;
      hasSegment = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (hasSegment) {
    ctx.stroke();
  }

  // Draw points so partial progress is visible even with 1 completed test.
  ctx.globalAlpha = emphasized ? 1 : 0.85;
  const radius = emphasized ? 3.0 : 2.2;
  series.forEach((score, i) => {
    if (!Number.isFinite(score)) {
      return;
    }
    const x = xForIndex(i);
    const y = yForScore(score);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function buildCumulativeSeries(modelName) {
  const modelResults = state.results[modelName] || {};
  if (state.tests.length === 0) {
    return null;
  }
  const scores = state.tests.map((test) => {
    const row = modelResults[test.id];
    return row ? toNumber(row.score) : null;
  });
  let lastWithScore = -1;
  scores.forEach((score, idx) => {
    if (Number.isFinite(score)) {
      lastWithScore = idx;
    }
  });
  if (lastWithScore < 0) {
    return null;
  }
  const series = [0];
  let running = 0;
  scores.forEach((score, idx) => {
    if (idx > lastWithScore) {
      series.push(null);
      return;
    }
    if (Number.isFinite(score)) {
      running += score;
    }
    series.push(running);
  });
  return series;
}

function calculateTotalScore(modelName) {
  const modelResults = state.results[modelName] || {};
  let total = 0;
  state.tests.forEach((test) => {
    const row = modelResults[test.id];
    const score = row ? toNumber(row.score) : null;
    if (Number.isFinite(score)) {
      total += score;
    }
  });
  return total;
}

function colorForModel(name) {
  const hash = hashString(name);
  const hue = hash % 360;
  return `hsl(${hue} 70% 62% / 1)`;
}

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function updateSummary() {
  const maxTotal = state.tests.reduce((sum, test) => sum + test.maxScore, 0);
  elements.totalTests.textContent = String(state.tests.length);
  elements.maxScore.textContent = String(maxTotal);
  elements.modelCount.textContent = String(state.modelOrder.length);
  const summaries = summarizeModelAverages();
  if (elements.winningModel) {
    elements.winningModel.textContent = summaries.winnerLabel ?? "--";
    if (summaries.winnerName) {
      elements.winningModel.title = summaries.winnerName;
    }
  }
  if (elements.bestAverage) {
    elements.bestAverage.textContent = summaries.bestAverage ?? "--";
  }
  if (elements.minAverage) {
    elements.minAverage.textContent = summaries.minAverage ?? "--";
  }
  if (elements.meanAverage) {
    elements.meanAverage.textContent = summaries.meanAverage ?? "--";
  }
  if (elements.medianAverage) {
    elements.medianAverage.textContent = summaries.medianAverage ?? "--";
  }
  if (elements.fastestTime) {
    elements.fastestTime.textContent = summaries.fastestTime ?? "--";
    if (summaries.fastestModel) {
      elements.fastestTime.title = summaries.fastestModel;
    }
  }
  if (state.lastUpdated) {
    elements.lastUpdated.textContent = `Last updated: ${formatTimestamp(
      state.lastUpdated
    )}`;
  } else {
    elements.lastUpdated.textContent = "";
  }
}

function updateStatus() {
  if (elements.statusPill) {
    elements.statusPill.textContent = state.status;
  }
  if (state.error) {
    elements.tableHint.textContent = "CSV missing or inaccessible.";
  } else if (state.tests.length === 0) {
    elements.tableHint.textContent = "No results found in CSV.";
  } else {
    elements.tableHint.textContent = "Showing aggregate results.";
  }
}

function renderTable() {
  const thead = elements.resultsTable.querySelector("thead");
  const tbody = elements.resultsTable.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const headerRow = document.createElement("tr");
  headerRow.appendChild(createHeaderCell("Model"));
  state.tests.forEach((test) => {
    headerRow.appendChild(createHeaderCell(test.name));
  });
  headerRow.appendChild(createHeaderCell("Average"));
  thead.appendChild(headerRow);

  if (state.error) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = state.tests.length + 2;
    cell.textContent = "Results CSV not found.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  if (state.modelOrder.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = state.tests.length + 2;
    cell.textContent = "No models available.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const sortedModels = [...state.modelOrder].sort((a, b) => {
    const aScore = calculateAverage(a);
    const bScore = calculateAverage(b);
    if (aScore === null && bScore === null) {
      return a.localeCompare(b);
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
    return a.localeCompare(b);
  });

  sortedModels.forEach((model, index) => {
    const row = document.createElement("tr");
    row.style.animationDelay = `${index * 20}ms`;
    const nameCell = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "model-name";
    const nameText = document.createElement("span");
    nameText.textContent = formatModelLabel(model);
    nameText.className = "cell-mono";
    nameText.title = model;
    const modelColor = state.modelColors?.[model];
    if (modelColor) {
      nameText.style.color = modelColor;
    }
    nameWrap.append(nameText);
    nameCell.appendChild(nameWrap);
    row.appendChild(nameCell);

    const modelResults = state.results[model] || {};

    state.tests.forEach((test) => {
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
      } else if (result.score !== undefined) {
        const scoreWrap = document.createElement("div");
        scoreWrap.className = "score-stack";
        const chip = document.createElement("span");
        chip.className = "score-chip";
        const score = toNumber(result.score) ?? 0;
        const maxScore = toNumber(result.max_score) ?? test.maxScore;
        chip.textContent = formatScore(score, maxScore);
        if (score === maxScore) {
          chip.classList.add("score-chip--max");
        } else if (score === 0) {
          chip.classList.add("score-chip--zero");
        }
        scoreWrap.appendChild(chip);
        const duration = toNumber(result.total_duration);
        const durationText = formatDurationNs(duration);
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
    const avg = calculateAverage(model);
    avgCell.textContent = avg === null ? "--" : `${(avg * 100).toFixed(1)}%`;
    row.appendChild(avgCell);

    tbody.appendChild(row);
  });
}

function calculateAverage(modelName) {
  const results = state.results[modelName] || {};
  let totalScore = 0;
  let totalMax = 0;

  state.tests.forEach((test) => {
    const result = results[test.id];
    if (!result) {
      return;
    }
    const score = toNumber(result.score);
    const maxScore = toNumber(result.max_score) ?? test.maxScore;
    if (Number.isFinite(score)) {
      totalScore += score;
      totalMax += Number.isFinite(maxScore) ? maxScore : 0;
    }
  });

  if (totalMax === 0) {
    return null;
  }
  return totalScore / totalMax;
}

function summarizeModelAverages() {
  const averages = [];
  let best = null;
  let worst = null;

  state.modelOrder.forEach((model) => {
    const avg = calculateAverage(model);
    if (avg === null) {
      return;
    }
    averages.push(avg);
    if (!best || avg > best.value || (avg === best.value && model < best.model)) {
      best = { model, value: avg };
    }
    if (!worst || avg < worst.value || (avg === worst.value && model < worst.model)) {
      worst = { model, value: avg };
    }
  });

  const averageSummary = {
    winnerName: best?.model ?? null,
    winnerLabel: best ? formatModelLabel(best.model) : null,
    bestAverage: best ? formatPercent(best.value) : null,
    minAverage: worst ? formatPercent(worst.value) : null,
    meanAverage: null,
    medianAverage: null,
    fastestTime: null,
    fastestModel: null,
  };

  if (averages.length > 0) {
    const mean = averages.reduce((sum, value) => sum + value, 0) / averages.length;
    averageSummary.meanAverage = formatPercent(mean);
    const sorted = [...averages].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    averageSummary.medianAverage = formatPercent(median);
  }

  const fastest = calculateFastestTotalTime();
  if (fastest) {
    averageSummary.fastestTime = formatDurationNs(fastest.duration) ?? "--";
    averageSummary.fastestModel = fastest.model;
  }

  return averageSummary;
}

function calculateFastestTotalTime() {
  let fastest = null;
  state.modelOrder.forEach((model) => {
    const results = state.results[model] || {};
    let total = 0;
    let counted = 0;
    state.tests.forEach((test) => {
      const result = results[test.id];
      if (!result) {
        return;
      }
      const duration = toNumber(result.total_duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      total += duration;
      counted += 1;
    });
    if (counted === 0) {
      return;
    }
    if (!fastest || total < fastest.duration) {
      fastest = { model, duration: total };
    }
  });
  return fastest;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else if (char === "\r") {
      // Ignore CR
    } else {
      current += char;
    }
    i += 1;
  }
  row.push(current);
  rows.push(row);
  return rows.filter((entry) => entry.length > 1 || entry[0] !== "");
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? "";
  });
  return obj;
}

function createHeaderCell(text) {
  const cell = document.createElement("th");
  cell.textContent = text;
  return cell;
}

function formatScore(score, maxScore) {
  return `${score}/${maxScore}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatResultTooltip(result, test) {
  const lines = [];
  if (result.error) {
    lines.push(`Error: ${result.error}`);
  }
  if (result.output) {
    lines.push(result.output.trim());
  }
  if (lines.length === 0 && test) {
    lines.push(test.name);
  }
  return lines.join("\n---\n");
}

function formatModelName(name) {
  if (!name) {
    return name;
  }
  let cleaned = String(name).trim();
  if (!cleaned) {
    return cleaned;
  }
  cleaned = cleaned.replace(/^config-/i, "");
  cleaned = cleaned.replace(/:latest$/i, "");
  const limit = 25;
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, limit - 3)}...`;
}

function formatModelLabel(name) {
  const cleanedName = formatModelName(name);
  const sizeB = state.modelMeta?.[name]?.sizeB;
  if (!Number.isFinite(sizeB)) {
    return cleanedName;
  }
  const formatted = formatModelSizeB(sizeB);
  return `[${formatted}] ${cleanedName}`;
}

function formatModelSizeB(sizeB) {
  if (!Number.isFinite(sizeB) || sizeB <= 0) {
    return "--";
  }
  if (sizeB < 1) {
    return `${sizeB.toFixed(2)}B`;
  }
  if (sizeB < 10) {
    return `${sizeB.toFixed(1)}B`;
  }
  return `${sizeB.toFixed(0)}B`;
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

function formatTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
