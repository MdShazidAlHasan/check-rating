# Check Rating

A tiny Chrome extension for Codeforces problem pages:
- Shows the problem's **difficulty rating** automatically.
- **Hides the tags** by default (no spoilers).
- Adds a **"Show Tags"** button to reveal them whenever you want.

## How it works

1. On a problem page, the extension reads the contest ID and problem index from the URL.
2. It fetches problem data (rating + tags) from the public Codeforces API
   (`https://codeforces.com/api/problemset.problems`), caching the result in
   `chrome.storage.local` for 24 hours so it doesn't refetch on every page load.
3. It finds Codeforces' own tag elements on the page (`.tag-box`) and hides them.
4. It inserts a small badge showing the rating and a "Show Tags" / "Hide Tags"
   toggle button near the problem title.

## Install (unpacked, for testing)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this `check-rating` folder.
5. Visit any Codeforces problem page, e.g.
   `https://codeforces.com/problemset/problem/1/A` — you should see the
   rating badge and the "Show Tags" button, with tags hidden until you click it.

## Notes / possible follow-ups

- If Codeforces changes its page markup (class name `tag-box`), the tag-hiding
  logic may need a small update.
- If a problem has no official rating (e.g. some gym/unrated problems), the
  badge shows "Rating: N/A".
- Works on `/problemset/problem/...`, `/contest/.../problem/...`, and
  `/gym/.../problem/...` URLs.
