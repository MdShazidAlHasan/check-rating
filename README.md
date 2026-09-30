# Check Rating

A modern Chrome extension for Codeforces:
- Shows the problem's **difficulty rating** with official rank-tier colors.
- **Hides problem tags** by default on both problem statement and problemset listing pages (no spoilers!).
- Adds a **"Show Tags"** / **"Hide Tags"** toggle button.
- Provides a quick **"Friends Standings"** redirection button (opens the friends standings page for the active contest).
- Features a **Dedicated Sidebar Panel** on problem statement pages (placed directly below the Contest materials section) and a **Modern Floating Pill** on problemset listing pages.

## Features & How It Works

1. **Problem Statement Pages (Sidebar Panel)**:
   - Reads the contest ID and problem index from the URL (`/problemset/problem/:id/:idx`, `/contest/:id/problem/:idx`, `/gym/:id/problem/:idx`).
   - Fetches difficulty rating and tags from the public Codeforces API, caching results in `chrome.storage.local` for 24 hours.
   - Positions a sleek card directly **below the Contest materials section** in the sidebar.
   - Displays a color-coded rank tier rating badge, a "Show Tags" / "Hide Tags" toggle button, and a "Friends Standings" shortcut.
   - Hides the native Codeforces "Problem tags" sidebar box by default to avoid spoilers, and reveals it smoothly right below the panel when "Show Tags" is clicked.
   - Gracefully falls back to above Problem tags or floating pill if the sidebar layout varies.

2. **Problemset Listing Pages**:
   - Works across all `/problemset` views: unfiltered, filtered by difficulty (`?tags=1200-1500`), filtered by tag (`?tags=dp`), or sorted (`?order=BY_RATING_ASC`).
   - Hides the tag lists for every row in the table by default (zero-flicker).
   - Provides a "Show Tags" / "Hide Tags" floating toggle.

3. **Friends Standings Redirection**:
   - Dynamically targets `https://codeforces.com/contest/{contestId}/standings/friends/true` (or `/gym/{id}/...`) based on the active problem.

## Install (unpacked, for testing)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this extension folder (`check-rating2`).
5. Visit any Codeforces problem page or problemset listing:
   - Problem page: `https://codeforces.com/contest/2264/problem/C`
   - Problemset page: `https://codeforces.com/problemset?tags=1200-1500`
   - Filtered/sorted: `https://codeforces.com/problemset?order=BY_RATING_ASC`
