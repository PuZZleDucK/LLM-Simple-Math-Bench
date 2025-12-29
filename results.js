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
  renderTable();
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
