// Check Rating — Codeforces content script
// Shows the problem's rating and hides tags behind a "Show Tags" button.
// Handles two page types:
//   1. Individual problem statement pages (/problemset/problem/ID/IDX, /contest/ID/problem/IDX, /gym/ID/problem/IDX)
//   2. The problem listing page (/problemset, /problemset/page/N, /problemset?tags=...)

const API_URL = "https://codeforces.com/api/problemset.problems";
const CACHE_KEY = "cf_problem_data";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------- Shared helpers ----------

function parseProblemFromUrl() {
  const path = window.location.pathname; // e.g. /problemset/problem/1234/A or /contest/1234/problem/A
  let match = path.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
  if (!match) match = path.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
  if (!match) match = path.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return { contestId: parseInt(match[1], 10), index: match[2].toUpperCase() };
}

function isListingPage() {
  // /problemset itself, /problemset/page/N, /problemset?tags=... — but NOT an individual problem page.
  return window.location.pathname.startsWith("/problemset") && !parseProblemFromUrl();
}

function getCachedProblems() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY], (result) => {
      const cached = result[CACHE_KEY];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        resolve(cached.problems);
      } else {
        resolve(null);
      }
    });
  });
}

function setCachedProblems(problems) {
  chrome.storage.local.set({
    [CACHE_KEY]: { problems, timestamp: Date.now() },
  });
}

async function fetchAllProblems() {
  const cached = await getCachedProblems();
  if (cached) return cached;

  const res = await fetch(API_URL);
  const data = await res.json();
  if (data.status !== "OK") throw new Error("CF API error");

  const problems = data.result.problems; // array of { contestId, index, name, rating?, tags: [] }
  setCachedProblems(problems);
  return problems;
}

function findProblem(problems, contestId, index) {
  return problems.find((p) => p.contestId === contestId && p.index === index);
}

function setHidden(els, hidden) {
  els.forEach((el) => {
    el.style.setProperty("display", hidden ? "none" : "", "important");
  });
}

function buildFloatingPanel({ ratingText } = {}) {
  const container = document.createElement("div");
  container.id = "check-rating-container";

  if (ratingText) {
    const badge = document.createElement("span");
    badge.id = "check-rating-badge";
    badge.textContent = ratingText;
    container.appendChild(badge);
  }

  const button = document.createElement("button");
  button.id = "check-rating-toggle-btn";
  button.textContent = "Show Tags";
  container.appendChild(button);

  document.body.appendChild(container);
  return button;
}

// ---------- Individual problem statement page ----------

function findStatementTagEls() {
  // On statement pages, Codeforces renders tags as plain (non-link) text
  // inside a "tag-box" element in the sidebar.
  return Array.from(document.querySelectorAll(".tag-box"));
}

async function initProblemPage(parsed) {
  const tagEls = findStatementTagEls();
  setHidden(tagEls, true); // hidden by default

  let rating = null;
  try {
    const problems = await fetchAllProblems();
    const problem = findProblem(problems, parsed.contestId, parsed.index);
    if (problem) rating = problem.rating || null;
  } catch (e) {
    console.warn("Check Rating: failed to fetch rating", e);
  }

  const button = buildFloatingPanel({
    ratingText: rating ? `Rating: ${rating}` : "Rating: N/A",
  });

  let tagsVisible = false;
  button.addEventListener("click", () => {
    tagsVisible = !tagsVisible;
    setHidden(tagEls, !tagsVisible);
    button.textContent = tagsVisible ? "Hide Tags" : "Show Tags";
  });
}

// ---------- Problem listing page (/problemset, /problemset/page/N, ...) ----------

function findListingTagContainers() {
  // On the listing table, each tag is rendered as a real <a> link whose href
  // contains "tags=" (e.g. /problemset?tags=dp). The sidebar's "Filter Problems"
  // tag picker does NOT use these same anchor links, so this selector only
  // catches the per-row tags, leaving the filter widget untouched.
  const links = Array.from(
    document.querySelectorAll('a[href*="/problemset?tags="]')
  );
  const containers = new Set();
  links.forEach((link) => {
    // Hide the link's immediate parent, which wraps just the tag list for that row.
    if (link.parentElement) containers.add(link.parentElement);
  });
  return Array.from(containers);
}

function initListingPage() {
  const tagContainers = findListingTagContainers();
  if (tagContainers.length === 0) return; // e.g. /problemset/status, no tags on this subpage

  setHidden(tagContainers, true); // hidden by default

  const button = buildFloatingPanel({});
  button.textContent = "Show Tags";

  let tagsVisible = false;
  button.addEventListener("click", () => {
    tagsVisible = !tagsVisible;
    setHidden(tagContainers, !tagsVisible);
    button.textContent = tagsVisible ? "Hide Tags" : "Show Tags";
  });
}

// ---------- Entry point ----------

async function init() {
  const parsed = parseProblemFromUrl();
  if (parsed) {
    await initProblemPage(parsed);
  } else if (isListingPage()) {
    initListingPage();
  }
}

init();
