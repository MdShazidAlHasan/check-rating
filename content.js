// Check Rating — Codeforces content script
// Shows the problem's rating and hides tags behind a "Show Tags" button.

const API_URL = "https://codeforces.com/api/problemset.problems";
const CACHE_KEY = "cf_problem_data";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function parseProblemFromUrl() {
  const url = window.location.pathname; // e.g. /problemset/problem/1234/A or /contest/1234/problem/A
  let match = url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
  if (!match) match = url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
  if (!match) match = url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return { contestId: parseInt(match[1], 10), index: match[2].toUpperCase() };
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
  return problems.find(
    (p) => p.contestId === contestId && p.index === index
  );
}

function findTagBox() {
  // Codeforces renders tags in a block with class "tag-box" inside ".roundbox" sidebar
  return document.querySelectorAll(".tag-box");
}

function buildBadgeAndButton(rating, tagEls) {
  const container = document.createElement("div");
  container.id = "check-rating-container";

  const badge = document.createElement("span");
  badge.id = "check-rating-badge";
  badge.textContent = rating ? `Rating: ${rating}` : "Rating: N/A";
  container.appendChild(badge);

  const button = document.createElement("button");
  button.id = "check-rating-toggle-btn";
  button.textContent = "Show Tags";

  // Track visibility explicitly instead of reading computed/inline styles back,
  // since CF's own tag-box elements don't all share one consistent default
  // display value, which was making the old read-back logic flip inconsistently.
  let tagsVisible = false;

  button.addEventListener("click", () => {
    tagsVisible = !tagsVisible;
    tagEls.forEach((el) => {
      el.style.setProperty("display", tagsVisible ? "inline-block" : "none", "important");
    });
    button.textContent = tagsVisible ? "Hide Tags" : "Show Tags";
  });
  container.appendChild(button);

  return container;
}

function insertContainer(container) {
  // Fixed floating panel, bottom-right corner — doesn't disturb the statement layout.
  document.body.appendChild(container);
}

async function init() {
  const parsed = parseProblemFromUrl();
  if (!parsed) return;

  const tagEls = findTagBox();
  // Hide tags by default (!important guards against CF's own inline-block styling)
  tagEls.forEach((el) => {
    el.style.setProperty("display", "none", "important");
  });

  let rating = null;
  try {
    const problems = await fetchAllProblems();
    const problem = findProblem(problems, parsed.contestId, parsed.index);
    if (problem) rating = problem.rating || null;
  } catch (e) {
    console.warn("Check Rating: failed to fetch rating", e);
  }

  const container = buildBadgeAndButton(rating, tagEls);
  insertContainer(container);
}

init();
