(function initResultsNav() {
  const DEFAULT_RESULTS_FILE = "results.csv";
  const BASE_URL = resolveBaseUrl();
  const RESULTS_FILES_ENDPOINT = new URL("api/results-files", BASE_URL).toString();
  const RESULTS_MANIFEST_URL = new URL("data/results-files.json", BASE_URL).toString();

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

  function labelForResultsFile(fileName) {
    if (!fileName) {
      return "Results";
    }
    const stripped = fileName.replace(/^results-?/i, "").replace(/\.csv$/i, "");
    const label = stripped.replace(/[-_]+/g, " ").trim();
    return label || fileName;
  }

  function buildResultsHref(fileName) {
    const url = new URL("index.html", BASE_URL);
    if (fileName) {
      url.searchParams.set("file", fileName);
    }
    return url.toString();
  }

  function isResultsPage() {
    const path = window.location.pathname || "";
    return path === "/" || /(^|\/)index\.html$/.test(path);
  }

  function currentResultsFile() {
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

  function normalizeResultsFiles(files) {
    const seen = new Set();
    const normalized = [];
    files.forEach((file) => {
      const cleaned = sanitizeResultsFilename(file);
      if (!cleaned || cleaned.toLowerCase() === DEFAULT_RESULTS_FILE) {
        return;
      }
      if (seen.has(cleaned)) {
        return;
      }
      seen.add(cleaned);
      normalized.push(cleaned);
    });
    return normalized;
  }

  async function fetchResultsFiles(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch results files");
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.files)) {
        throw new Error("Invalid results files payload");
      }
      return normalizeResultsFiles(data.files);
    } catch (error) {
      return [];
    }
  }

  async function loadResultsFiles() {
    const apiFiles = await fetchResultsFiles(RESULTS_FILES_ENDPOINT);
    if (apiFiles.length > 0) {
      return apiFiles;
    }
    const manifestFiles = await fetchResultsFiles(RESULTS_MANIFEST_URL);
    return manifestFiles;
  }

  function renderEmptyMenu(menu) {
    const empty = document.createElement("span");
    empty.className = "nav-menu__empty";
    empty.textContent = "No results available";
    menu.appendChild(empty);
  }

  function renderResultsMenu(dropdown, files) {
    const menu =
      dropdown.querySelector(".nav-menu") || dropdown.appendChild(document.createElement("div"));
    menu.className = "nav-menu";
    menu.innerHTML = "";

    const onResultsPage = isResultsPage();
    const activeFile = currentResultsFile();

    if (!files.length) {
      renderEmptyMenu(menu);
      return;
    }

    files.forEach((file) => {
      const link = document.createElement("a");
      link.className = "nav-menu__item";
      link.href = buildResultsHref(file);
      link.textContent = labelForResultsFile(file);
      link.title = file;
      if (onResultsPage && file === activeFile) {
        link.setAttribute("aria-current", "page");
      }
      menu.appendChild(link);
    });
  }

  async function initResultsDropdown() {
    const dropdowns = document.querySelectorAll("[data-results-dropdown]");
    if (!dropdowns.length) {
      return;
    }
    const files = await loadResultsFiles();
    dropdowns.forEach((dropdown) => {
      renderResultsMenu(dropdown, files);
    });
  }

  initResultsDropdown();
})();
