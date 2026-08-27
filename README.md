# ⚡ NEXUS Dashboard

### GitHub Developer Intelligence Dashboard

> A production-ready, single-owner developer intelligence dashboard powered by real GitHub data.

<p align="center">
  <a href="https://nexus-dashboard-l1q3.onrender.com/">
    <strong>🚀 Live Demo</strong>
  </a>
  &nbsp; • &nbsp;
  <a href="https://github.com/arayan11587kvrsodelhi-oss/nexus-dashboard">
    <strong>💻 Source Code</strong>
  </a>
</p>

---

## ✦ Overview

**NEXUS** is a live developer intelligence dashboard built around a single GitHub account.

It transforms GitHub profile, repository, and public activity data into a modern analytics interface featuring:

- 📊 Developer statistics
- 📦 Repository intelligence
- 🔎 Repository search and filtering
- 📈 Developer analytics
- 🧩 Language distribution
- 🗓️ Activity timeline
- 🔥 Contribution/activity heatmap
- 👤 GitHub profile information
- ⚡ Live / Synced / Stale data states
- 🎨 Multiple visual themes
- 📱 Fully responsive mobile experience
- 🔐 Production-focused security

NEXUS is intentionally designed as a **single-owner dashboard**, rather than a multi-user SaaS product.

All displayed GitHub statistics are derived from real API data.

**No fabricated statistics. No fake activity. No hardcoded dashboard metrics.**

---

## 🚀 Live Application

### [Open NEXUS Dashboard →](https://nexus-dashboard-l1q3.onrender.com/)

The production application is deployed on **Render** and communicates with the GitHub API through a secure server-side backend.

---

## ✨ Core Features

### 📊 Developer Dashboard

A centralized overview of the GitHub account including:

- Public repositories
- Total stars
- Total forks
- Followers
- Recent activity
- Repository statistics
- Language distribution

Metrics are derived from actual GitHub API responses.

---

### ⚡ Live Data Synchronization

NEXUS clearly communicates the freshness of its data.

| State | Meaning |
|---|---|
| 🟢 **LIVE** | Fresh data successfully fetched from GitHub |
| 🔵 **SYNCED** | Data served from the server cache |
| 🟡 **STALE** | GitHub refresh failed, last known-good data displayed |
| 🔴 **OFFLINE** | No usable GitHub data is currently available |

Relative timestamps automatically update to communicate when data was last synchronized.

---

### 📦 Repository Intelligence

Explore repositories through:

- Real-time search
- Language filters
- Topic filters
- Recently updated sorting
- Most stars sorting
- Most forks sorting
- Alphabetical sorting
- Repository metadata
- Quick-view modal

Repository information includes:

- Description
- Primary language
- Stars
- Forks
- Open issues
- License
- Default branch
- Creation date
- Last pushed date
- Topics
- GitHub URL
- Live/demo URL when available

---


### 📈 Analytics

NEXUS provides visual analytics based on genuine GitHub activity.

Available views include:

- Commits
- Pull requests
- Issues
- Activity
- Language distribution
- Repository activity

Charts are responsive and adapt to desktop, tablet, and mobile screens.

---

### 🗓️ Activity Timeline

The activity timeline processes public GitHub events including:

- Push events
- Repository creation
- Stars
- Forks
- Pull requests
- Issues
- Releases
- Issue comments

Each event includes contextual information and relative timestamps.

---

### 🔥 Contribution / Activity Heatmap

NEXUS visualizes available public GitHub activity in a GitHub-style contribution heatmap.

The visualization is deliberately based on available public event data rather than fabricated historical contribution numbers.

---

### 👤 Developer Profile

The profile interface uses genuine GitHub information such as:

- Avatar
- Name
- Username
- Bio
- Location
- Role/company information
- Followers
- Following
- Public repositories
- GitHub profile

---

### 🎨 Customization

NEXUS includes multiple interface themes:

- 🌌 Dark Cyber
- ☁️ Light Slate
- 🖤 OLED High Contrast

Additional controls include:

- Reduced motion
- Automatic refresh interval
- Manual GitHub synchronization
- Keyboard shortcuts

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` / `⌘ + K` | Focus global search |
| `/` | Focus project search |
| `T` | Cycle themes |
| `R` | Trigger GitHub refresh |
| `S` | Open Settings |
| `?` | Open Help |
| `Esc` | Close active modal/drawer |

---

# 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      GitHub API      │
                         │   api.github.com     │
                         └──────────┬───────────┘
                                    │
                                    │ Server-side
                                    ▼
┌────────────────────────────────────────────────────────┐
│                    NEXUS Backend                        │
│                  Node.js + Express                     │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ GitHub       │  │ Cache        │  │ Rate        │ │
│  │ Service      │  │ Layer        │  │ Limiting    │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                        │
│             Processed Dashboard Payload               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ /api/v1/*
                           ▼
┌────────────────────────────────────────────────────────┐
│                     NEXUS Frontend                     │
│                Vanilla HTML / CSS / JS                 │
│                                                        │
│  Dashboard • Projects • Activity • Analytics           │
│  Profile • Settings • Responsive Navigation            │
└────────────────────────────────────────────────────────┘
Repository Structure--
nexus-dashboard/
│
├── server/
│   ├── index.js
│   ├── config/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── utils/
│
├── public/
│   ├── index.html
│   ├── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── apiClient.js
│   │   └── utils.js
│   └── assets/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── frontend/
│   └── browser-qa.mjs
│
├── scripts/
├── .github/
├── .env.example
├── package.json
└── README.md
