(function initResultsNav() {
  const DEFAULT_RESULTS_FILE = "results.csv";
  const BASE_URL = resolveBaseUrl();
  const RESULTS_FILES_ENDPOINT = new URL("api/results-files", BASE_URL).toString();

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
    if (fileName.toLowerCase() === DEFAULT_RESULTS_FILE) {
      return "Latest";
    }
    const stripped = fileName.replace(/^results-?/i, "").replace(/\.csv$/i, "");
    const label = stripped.replace(/[-_]+/g, " ").trim();
    return label || fileName;
  }

  function buildResultsHref(fileName) {
    const url = new URL("index.html", BASE_URL);
    if (fileName && fileName.toLowerCase() !== DEFAULT_RESULTS_FILE) {
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

  async function loadResultsFiles() {
    try {
      const response = await fetch(RESULTS_FILES_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch results files");
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.files)) {
        throw new Error("Invalid results files payload");
      }
      const seen = new Set();
      const files = [];
      data.files.forEach((file) => {
        const cleaned = sanitizeResultsFilename(file);
        if (!cleaned || seen.has(cleaned)) {
          return;
        }
        seen.add(cleaned);
        files.push(cleaned);
      });
      if (files.length === 0) {
        return [DEFAULT_RESULTS_FILE];
      }
      const ordered = [DEFAULT_RESULTS_FILE, ...files.filter((file) => file !== DEFAULT_RESULTS_FILE)];
      return ordered;
    } catch (error) {
      return [DEFAULT_RESULTS_FILE];
    }
  }

  function renderResultsMenu(dropdown, files) {
    const menu =
      dropdown.querySelector(".nav-menu") || dropdown.appendChild(document.createElement("div"));
    menu.className = "nav-menu";
    menu.innerHTML = "";

    const onResultsPage = isResultsPage();
    const activeFile = currentResultsFile();

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
