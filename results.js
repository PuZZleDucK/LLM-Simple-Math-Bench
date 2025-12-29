const CSV_URL = "data/results.csv";

const state = {
  rows: [],
  tests: [],
  results: {},
  modelOrder: [],
  status: "Loading",
  lastUpdated: null,
  error: null,
};

const elements = {
  statusPill: document.getElementById("statusPill"),
  totalTests: document.getElementById("totalTests"),
  maxScore: document.getElementById("maxScore"),
  modelCount: document.getElementById("modelCount"),
  lastUpdated: document.getElementById("lastUpdated"),
  progressChart: document.getElementById("progressChart"),
  resultsTable: document.getElementById("resultsTable"),
  tableHint: document.getElementById("tableHint"),
};

init();

async function init() {
  try {
    await loadCsv();
    state.status = "Ready";
  } catch (error) {
    state.error = error;
    state.status = "Missing CSV";
  }
  render();
}

async function loadCsv() {
  const response = await fetch(CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${CSV_URL}`);
  }
  const text = await response.text();
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
  state.lastUpdated = lastUpdated;
}

function render() {
  updateSummary();
  updateStatus();
  renderProgressChart();
  renderTable();
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

  const xForIndex = (i) => {
    if (testCount <= 1) {
      return padding.left + plotW / 2;
    }
    return padding.left + (i / (testCount - 1)) * plotW;
  };
  const yForScore = (score) => {
    const clamped = Math.max(0, Math.min(maxTotal, score));
    return padding.top + (1 - clamped / maxTotal) * plotH;
  };

  drawChartGrid(ctx, { width, height, padding, plotW, plotH, testCount, maxTotal, xForIndex, yForScore });

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
    const color = colorForModel(modelName);
    drawSeries(ctx, series, { idx, color, xForIndex, yForScore });
  });
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

function drawChartGrid(ctx, { width, height, padding, plotW, plotH, testCount, maxTotal, xForIndex, yForScore }) {
  ctx.save();
  ctx.strokeStyle = "rgba(164, 169, 183, 0.22)";
  ctx.lineWidth = 1;

  // Outer bounds
  ctx.strokeRect(padding.left, padding.top, plotW, plotH);

  // Horizontal grid + labels
  const steps = 4;
  ctx.fillStyle = "rgba(164, 169, 183, 0.85)";
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
  ctx.strokeStyle = "rgba(164, 169, 183, 0.12)";
  for (let i = 0; i < testCount; i += 1) {
    const x = xForIndex(i);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();
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
  ctx.lineWidth = emphasized ? 2.2 : 1.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = emphasized ? 0.8 : 0.35;

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
  ctx.globalAlpha = emphasized ? 0.85 : 0.45;
  const radius = emphasized ? 2.6 : 1.8;
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
  const series = [];
  let running = 0;
  let hasAny = false;
  state.tests.forEach((test) => {
    const row = modelResults[test.id];
    const score = row ? toNumber(row.score) : null;
    if (Number.isFinite(score)) {
      running += score;
      hasAny = true;
      series.push(running);
      return;
    }
    series.push(hasAny ? null : 0);
  });
  if (!hasAny) {
    return null;
  }
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
  if (state.lastUpdated) {
    elements.lastUpdated.textContent = `Last updated: ${formatTimestamp(
      state.lastUpdated
    )}`;
  } else {
    elements.lastUpdated.textContent = "";
  }
}

function updateStatus() {
  elements.statusPill.textContent = state.status;
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
    nameText.textContent = formatModelName(model);
    nameText.className = "cell-mono";
    nameText.title = model;
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
  const limit = 25;
  if (!name || name.length <= limit) {
    return name;
  }
  return `${name.slice(0, limit - 3)}...`;
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
