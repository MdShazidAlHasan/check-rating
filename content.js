// Check Rating — Codeforces content script
// Shows the problem's rating, hides tags behind a "Show Tags" button,
// and provides a quick redirection button to Friends Standings on problem pages.
// Handles:
//   1. Individual problem statement pages (/problemset/problem/ID/IDX, /contest/ID/problem/IDX, /gym/ID/problem/IDX)
//   2. Problem listing pages (/problemset, /problemset/page/N, /problemset?tags=..., /contest/ID/problems)

const API_URL = "https://codeforces.com/api/problemset.problems";
const CACHE_KEY = "cf_problem_data";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_CONTEST_ID = 2264; // Fallback contest ID for Friends Standings

// State
let globalTagsVisible = false;

// ---------- Shared helpers ----------

function parseProblemFromUrl() {
  const path = window.location.pathname;
  let match = path.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
  if (match) return { contestId: parseInt(match[1], 10), index: match[2].toUpperCase(), isGym: false };
  match = path.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
  if (match) return { contestId: parseInt(match[1], 10), index: match[2].toUpperCase(), isGym: false };
  match = path.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/);
  if (match) return { contestId: parseInt(match[1], 10), index: match[2].toUpperCase(), isGym: true };
  return null;
}

function isListingPage() {
  const path = window.location.pathname;
  const isProblemsetListing = path.startsWith("/problemset") && !parseProblemFromUrl();
  const isContestListing = /^\/contest\/\d+(\/problems)?\/?$/.test(path);
  return isProblemsetListing || isContestListing;
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

  const problems = data.result.problems;
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

function getRatingTierClass(rating) {
  if (typeof rating !== "number") return "rating-unrated";
  if (rating < 1200) return "rating-newbie";
  if (rating < 1400) return "rating-pupil";
  if (rating < 1600) return "rating-specialist";
  if (rating < 1900) return "rating-expert";
  if (rating < 2200) return "rating-cm";
  if (rating < 2400) return "rating-master";
  return "rating-gm";
}

function buildPanel({
  rating,
  contestId,
  isGym = false,
  hasToggle = false,
  showFriendsStanding = false,
  sidebarMode = false,
} = {}) {
  // Prevent duplicate panels
  const existing = document.getElementById("check-rating-container");
  if (existing) existing.remove();

  const hasRating = rating !== undefined;

  // If there is nothing to show at all, do not render the container
  if (!hasRating && !hasToggle && !showFriendsStanding) {
    return null;
  }

  const container = document.createElement("div");
  container.id = "check-rating-container";
  if (sidebarMode) {
    container.classList.add("check-rating-sidebar");
  }

  // 1. Rating badge
  let badge = null;
  if (hasRating) {
    badge = document.createElement("span");
    badge.id = "check-rating-badge";
    const tierClass = getRatingTierClass(rating);
    badge.className = tierClass;
    badge.textContent = typeof rating === "number" ? `Rating: ${rating}` : "Rating: N/A";
    container.appendChild(badge);
  }

  // 2. Show / Hide Tags toggle button
  let button = null;
  if (hasToggle) {
    button = document.createElement("button");
    button.id = "check-rating-toggle-btn";
    button.type = "button";
    button.textContent = globalTagsVisible ? "Hide Tags" : "Show Tags";
    container.appendChild(button);
  }

  // 3. Friends Standings Redirection button
  if (showFriendsStanding) {
    const effectiveContestId = contestId || DEFAULT_CONTEST_ID;
    const contestType = isGym ? "gym" : "contest";
    const friendsLink = document.createElement("a");
    friendsLink.id = "check-rating-friends-btn";
    friendsLink.href = `https://codeforces.com/${contestType}/${effectiveContestId}/standings/friends/true`;
    friendsLink.target = "_blank";
    friendsLink.rel = "noopener noreferrer";
    friendsLink.title = `View Friends Standings for Contest ${effectiveContestId}`;
    friendsLink.innerHTML = `
      <svg class="check-rating-icon" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
      <span>Friends Standings</span>
    `;
    container.appendChild(friendsLink);
  }

  function updateRating(newRating) {
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "check-rating-badge";
      container.insertBefore(badge, container.firstChild);
    }
    const tierClass = getRatingTierClass(newRating);
    badge.className = tierClass;
    badge.textContent = typeof newRating === "number" ? `Rating: ${newRating}` : "Rating: N/A";
  }

  return { container, button, updateRating };
}

// ---------- Individual problem statement page ----------

function findContestMaterialsSidebox() {
  const sideboxes = document.querySelectorAll("#sidebar .roundbox, .roundbox.sidebox, .roundbox");
  for (const box of sideboxes) {
    const caption = box.querySelector(".caption");
    if (caption && /contest\s*material|материалы/i.test(caption.textContent)) {
      return box;
    }
  }

  // Fallback: search for announcement/tutorial/editorial links in sidebar
  for (const box of sideboxes) {
    const link = box.querySelector('a[href*="/blog/entry/"], a[href*="editorial"], a[href*="announcement"]');
    if (link) {
      return box;
    }
  }

  return null;
}

function findProblemTagsSidebox() {
  // 1. Check for tag-box inside a sidebox
  const tagBox = document.querySelector(".tag-box");
  if (tagBox) {
    const box = tagBox.closest(".roundbox.sidebox, #sidebar .roundbox, .roundbox, .sidebox");
    if (box) return box;
  }

  // 2. Search through sideboxes for caption titled "Problem tags" (or Russian "Теги задачи")
  const sideboxes = document.querySelectorAll("#sidebar .roundbox, .roundbox.sidebox, .roundbox");
  for (const box of sideboxes) {
    const caption = box.querySelector(".caption");
    if (caption && /problem\s*tags|теги\s*задачи/i.test(caption.textContent)) {
      return box;
    }
  }

  // 3. Search for tag links in the sidebar
  const tagLink = document.querySelector("#sidebar a[href*='tags='], .sidebox a[href*='tags=']");
  if (tagLink) {
    const box = tagLink.closest(".roundbox.sidebox, #sidebar .roundbox, .roundbox, .sidebox");
    if (box) return box;
  }

  return null;
}

function extractRatingFromDom(sidebox) {
  if (!sidebox) return null;
  const diffTag = sidebox.querySelector('.tag-box[title*="Difficulty" i], .tag-box[title*="сложность" i]');
  if (diffTag) {
    const match = diffTag.textContent.match(/\*?(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

async function initProblemPage(parsed) {
  const contestMaterialsBox = findContestMaterialsSidebox();
  const problemTagsBox = findProblemTagsSidebox();
  const sidebar = document.getElementById("sidebar");

  const tagBoxes = document.querySelectorAll(".tag-box");
  const hasTags = tagBoxes.length > 0 || !!problemTagsBox;

  // Mark Problem tags sidebox so CSS hides it by default
  if (problemTagsBox) {
    problemTagsBox.classList.add("check-rating-tags-sidebox");
    problemTagsBox.style.setProperty("display", globalTagsVisible ? "" : "none", "important");
  }

  // Extract initial rating from DOM if available before API returns
  const domRating = problemTagsBox ? extractRatingFromDom(problemTagsBox) : null;

  // Determine whether we can mount inside the sidebar
  const canMountInSidebar = !!(contestMaterialsBox || problemTagsBox || sidebar);

  const panel = buildPanel({
    rating: domRating,
    contestId: parsed.contestId,
    isGym: parsed.isGym,
    hasToggle: hasTags,
    showFriendsStanding: true,
    sidebarMode: canMountInSidebar,
  });

  if (panel) {
    if (contestMaterialsBox) {
      // Primary: place directly below Contest materials section
      contestMaterialsBox.insertAdjacentElement("afterend", panel.container);
    } else if (problemTagsBox) {
      // Fallback 1: place directly above Problem tags section
      problemTagsBox.insertAdjacentElement("beforebegin", panel.container);
    } else if (sidebar) {
      // Fallback 2: insert into sidebar
      sidebar.appendChild(panel.container);
    } else {
      // Fallback 3: floating overlay
      document.body.appendChild(panel.container);
    }

    if (panel.button && hasTags) {
      panel.button.addEventListener("click", () => {
        globalTagsVisible = !globalTagsVisible;
        document.body.classList.toggle("check-rating-show-tags", globalTagsVisible);
        if (problemTagsBox) {
          problemTagsBox.style.setProperty("display", globalTagsVisible ? "" : "none", "important");
        } else {
          const currentTags = document.querySelectorAll(".tag-box");
          setHidden(currentTags, !globalTagsVisible);
        }
        panel.button.textContent = globalTagsVisible ? "Hide Tags" : "Show Tags";
      });
    }
  }

  // Fetch official rating from Codeforces API and update badge
  try {
    const problems = await fetchAllProblems();
    const problem = findProblem(problems, parsed.contestId, parsed.index);
    if (problem && typeof problem.rating === "number") {
      if (panel) panel.updateRating(problem.rating);
    } else if (domRating === null && panel) {
      panel.updateRating(null);
    }
  } catch (e) {
    console.warn("Check Rating: failed to fetch rating", e);
  }
}

// ---------- Problem listing page (/problemset, /problemset/page/N, ...) ----------

function findListingTagContainers() {
  const containers = new Set();

  // In Codeforces, tags in problemset rows are rendered inside a float:right div within td
  document.querySelectorAll('table.problems td > div[style*="float: right"]').forEach((div) => {
    // Only include if it contains tag links
    if (div.querySelector('a[href*="tags="], a.notice')) {
      containers.add(div);
    }
  });

  return Array.from(containers);
}

function initListingPage() {
  const tagContainers = findListingTagContainers();
  const hasTags = tagContainers.length > 0;

  if (hasTags) {
    setHidden(tagContainers, !globalTagsVisible);
  }

  // On listing pages:
  // - hasToggle: ONLY if page contains tags
  // - showFriendsStanding: FALSE (do NOT show on listing pages)
  const panel = buildPanel({
    hasToggle: hasTags,
    showFriendsStanding: false,
    sidebarMode: false,
  });

  if (panel) {
    document.body.appendChild(panel.container);

    if (panel.button && hasTags) {
      panel.button.addEventListener("click", () => {
        globalTagsVisible = !globalTagsVisible;
        document.body.classList.toggle("check-rating-show-tags", globalTagsVisible);
        const currentContainers = findListingTagContainers();
        setHidden(currentContainers, !globalTagsVisible);
        panel.button.textContent = globalTagsVisible ? "Hide Tags" : "Show Tags";
      });
    }
  }
}

// ---------- Entry point ----------

async function init() {
  // Sync body class with initial state
  document.body.classList.toggle("check-rating-show-tags", globalTagsVisible);

  const parsed = parseProblemFromUrl();
  if (parsed) {
    await initProblemPage(parsed);
  } else if (isListingPage()) {
    initListingPage();
  }
}

// Safe bootstrap for document_start
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
