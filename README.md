# Reddit Stealth Checker

Reddit Stealth Checker is a full-stack web application designed to monitor Reddit accounts, posts, and comments in real-time. It provides a stealthy way to track karma, upvotes, and account status (active vs. banned/deleted) without being blocked by Reddit's anti-bot protections.

## 🚀 Architecture & Hosting

This project uses a modern, decoupled architecture:

*   **Frontend (Vercel):** Built with React, Vite, and Tailwind CSS. It provides a sleek, dark-themed dashboard. Vercel is used for hosting because it's the industry standard for React apps, offering incredibly fast global edge delivery.
*   **Backend (Render):** Built with Python, FastAPI, and SQLAlchemy. Render hosts the API web service. It handles all database operations and executes the actual scraping.
*   **Database (Render PostgreSQL):** A relational database storing the tracked accounts, posts, comments, and their historical metadata.

## 🕵️ How the Scraping Works

Reddit aggressively blocks standard scraping bots (like Python's `requests` library) using Cloudflare. To bypass this:
1.  We use `curl_cffi`, a Python library that perfectly mimics the TLS/SSL fingerprint of a real Google Chrome browser.
2.  We append `.json` to Reddit URLs (e.g., `reddit.com/user/username/about.json`) to get structured data instead of HTML.
3.  The backend securely handles session cookies and user agents to appear as organic traffic.

## ✨ Core Features

*   **Real-time Monitoring:** Instantly see if a tracked account, post, or comment goes down (banned/deleted) or stays active.
*   **Live Metrics:** Tracks total karma for users and upvote counts for posts/comments.
*   **Auto-Tracking:** Flip a switch on any account, and the system will automatically detect and track any *new* posts or comments they make.
*   **New Activity Detection:** Expanding an account row shows their 10 most recent posts/comments from Reddit. Untracked items glow with a `+ NEW` badge for 1-click tracking.
*   **Auto-Refresh:** The dashboard automatically syncs with the backend every 5 minutes while open, complete with a visual countdown timer.
*   **Bulk Actions:** Paste multiple usernames or URLs at once to track them in bulk.
*   **Stealth Dashboard:** Premium, responsive dark-mode UI with smooth micro-animations.

---

## 🎛️ User Interface Guide

Here is a breakdown of the interactive elements (buttons, text fields) across the dashboard:

### 1. Account Lookup Page
*   **Input Field (`Enter Reddit username...`):** Type a username (with or without `u/`) to fetch live data directly from Reddit.
*   **Button (`Check Account`):** Triggers the live fetch. Returns profile data, karma, avatar, and recent activity.

### 2. Tracked Accounts Page
*   **Button (`Bulk Track`):** Opens a modal to paste multiple accounts.
*   **Textarea (Bulk Modal):** Paste multiple Reddit usernames (one per line) to track them all at once.
*   **Row Click (Expand):** Clicking an account row expands a panel showing their recent Reddit activity.
*   **Button (`⚡ Auto`):** Toggles the Auto-Track feature for that specific user. When ON (blue), new posts/comments are automatically saved to your tracker.
*   **Button (`🗑️ Delete`):** Removes the account from your database.
*   **Button (`+ NEW`):** Inside the expanded panel, this appears next to recent posts/comments you aren't tracking yet. Clicking it instantly adds the item to your tracker.
*   **Link (`Refresh now`):** Located in the footer next to the countdown timer. Instantly forces a background refresh of all accounts.

### 3. Tracked Posts / Tracked Comments Pages
*   **Button (`Bulk Track`):** Opens a modal to paste multiple URLs.
*   **Textarea (Bulk Modal):** Paste multiple Reddit post or comment URLs (one per line).
*   **Button (`🔄 Sync All`):** Forces the backend to go out to Reddit and update the live status and upvote count for *every single* post/comment in your database at once.
*   **Row Click (Expand):** Expands the row to fetch and display live, granular details about that specific post/comment directly from Reddit.
*   **Button (`🗑️ Delete`):** Removes the post or comment from your database.
*   **External Link (`↗️`):** Opens the actual Reddit post/comment in a new browser tab.

## 🔄 Data Flow (How we fetch everything)

1.  **Frontend Load:** When you open a page (e.g., Tracked Accounts), React calls the backend `GET /api/accounts`.
2.  **Instant Render:** The backend returns cached data from the PostgreSQL database instantly, allowing the UI to load without waiting for Reddit.
3.  **Background Sync:** Immediately after loading, the frontend fires off parallel requests (`Promise.all`) to the backend to refresh the live status of each item.
4.  **Backend Fetch:** The FastAPI backend uses `curl_cffi` to ping Reddit's JSON endpoints.
5.  **Database Update:** The backend updates the PostgreSQL database with the fresh karma/upvotes/status and returns it to the frontend.
6.  **UI Update:** The React frontend gracefully updates the numbers and statuses on your screen without reloading the page.
