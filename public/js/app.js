/* NEXUS Dashboard - Live Developer Workspace */
"use strict";

/* =========================================================
   CORE HELPERS
   -----------------------------------------------------------
   fmt/ease/timeAgo/formatDate/escapeHTML/escapeAttribute now
   live in utils.js (loaded before this file) so they can be
   unit tested independently of the DOM-heavy rendering code
   below. See utils.js.
========================================================= */

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* =========================================================
   ICONS
========================================================= */

const ICONS = {
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',

  pr: '<svg viewBox="0 0 24 24"><path d="M9 18H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5"/><circle cx="18" cy="18" r="3"/><path d="M18 15v6"/></svg>',

  push: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 21h16"/></svg>',

  star: '<svg viewBox="0 0 24 24"><path d="M12 2 15 8.5 22 9.3 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.3 9 8.5 12 2Z"/></svg>',

  comment: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>',

  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 20 7v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-4"/></svg>',

  git: '<svg viewBox="0 0 24 24"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',

  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 11-13h-8l1-7Z"/></svg>',

  external: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
};

/* =========================================================
   LANGUAGE COLORS
========================================================= */

const LANG_COLORS = {
  TypeScript: "cyan",
  JavaScript: "amber",
  HTML: "purple",
  CSS: "green",
  Python: "cyan"
};

/* =========================================================
   NOTIFICATIONS
========================================================= */

const NOTIFICATIONS = [
  {
    id: 1,
    type: "cyan",
    icon: "star",
    text: "Connected to live GitHub API for <strong>arayan11587kvrsodelhi-oss</strong>",
    time: "Just now",
    read: false
  },
  {
    id: 2,
    type: "green",
    icon: "check",
    text: "Synced public repositories and activity.",
    time: "1m ago",
    read: false
  },
  {
    id: 3,
    type: "purple",
    icon: "pr",
    text: "Welcome to your live <strong>NEXUS DEV WORKSPACE</strong>.",
    time: "2m ago",
    read: false
  }
];

/* =========================================================
   GLOBAL STATE
========================================================= */

let liveData = null;
let timelineVisible = 5;
let activeFilter = "all";
let activeQuery = "";
let activeSort = "updated";
let chartMetric = "commits";
let chartPoints = [];
let chartCtx = null;
let chartW = 0;
let chartLineColor = "";
let lastRefreshTime = Date.now();
let tickerInterval = null;
let autoRefreshInterval = null;

let autoRefreshMs = (() => {
  const saved = localStorage.getItem("nexus-refresh-ms");
  if (saved !== null && !isNaN(Number(saved))) {
    return Number(saved);
  }
  return 5 * 60 * 1000;
})();

/* =========================================================
   SKELETONS
========================================================= */

function showSkeletons() {
  $$(".stat-card__value").forEach((el) => {
    el.classList.add("skeleton");
  });

  const pGrid = $("#projectsGrid");

  if (pGrid) {
    pGrid.innerHTML = Array.from({ length: 4 })
      .map(
        () => `
          <div class="project-card skeleton" style="height:320px;"></div>
        `
      )
      .join("");
  }

  const timeline = $("#timeline");

  if (timeline) {
    timeline.innerHTML = Array.from({ length: 4 })
      .map(
        () => `
          <li class="timeline-item skeleton"
              style="height:60px;margin-bottom:12px;"></li>
        `
      )
      .join("");
  }
}

function hideSkeletons() {
  $$(".skeleton").forEach((el) => {
    el.classList.remove("skeleton");
  });
}

/* =========================================================
   LIVE PILL
========================================================= */

function updateLiveStatus(data) {
  const pill = $("#liveStatusPill");
  const label = $("#liveStatusPill .live-label");
  const dot = $("#liveStatusPill .live-dot");

  if (!pill || !label || !dot) return;

  if (data?.fetchError && !data?.isCached) {
    pill.dataset.state = "error";
    label.textContent = "OFFLINE";
    pill.title = "Unable to connect to GitHub API.";
    return;
  }

  const state = data?.cacheState || (data?.isStale ? "stale-cache" : data?.isCached ? "fresh-cache" : "live");
  pill.dataset.state = state;

  if (state === "stale-cache") {
    label.textContent = "STALE";
    pill.title = "Showing cached snapshot because latest live sync failed.";
    return;
  }

  if (state === "fresh-cache") {
    label.textContent = "SYNCED";
    pill.title = "Showing fresh server-cached GitHub snapshot.";
    return;
  }

  label.textContent = "LIVE";
  pill.title = "Showing data from live GitHub synchronization.";
}

function startLiveTicker(fetchedAt) {
  lastRefreshTime = fetchedAt || Date.now();

  if (tickerInterval) {
    clearInterval(tickerInterval);
  }

  const updatePill = () => {
    const elapsedSec = Math.max(
      0,
      Math.floor((Date.now() - lastRefreshTime) / 1000)
    );

    const textEl = $("#liveTimeText");

    if (!textEl) return;

    if (elapsedSec < 10) {
      textEl.textContent = "Just now";
    } else if (elapsedSec < 60) {
      textEl.textContent = `${elapsedSec}s ago`;
    } else {
      const min = Math.floor(elapsedSec / 60);
      textEl.textContent = `${min}m ago`;
    }
  };

  updatePill();

  tickerInterval = setInterval(updatePill, 1000);
}

/* =========================================================
   COUNTER ANIMATION
========================================================= */

function animateCounter(el, target) {
  if (!el) return;

  const numericTarget = Number(target) || 0;

  const startValue = Number(
    String(el.textContent || "0").replace(/,/g, "")
  ) || 0;

  if (startValue === numericTarget) {
    el.textContent = fmt(numericTarget);
    return;
  }

  const duration = 900;

  const startTime = performance.now();

  const formatValue = (value) => {
    if (el.dataset.format === "k" && value >= 1000) {
      const k = value / 1000;

      if (k >= 100) {
        return `${Math.round(k)}k`;
      }

      return `${k.toFixed(1).replace(".0", "")}k`;
    }

    return fmt(Math.round(value));
  };

  function tick(now) {
    const progress = Math.min(
      (now - startTime) / duration,
      1
    );

    const eased = ease(progress);

    const value =
      startValue +
      (numericTarget - startValue) * eased;

    el.textContent = formatValue(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = formatValue(numericTarget);
    }
  }

  requestAnimationFrame(tick);
}

function updateLiveCounters(stats) {
  if (!stats) return;

  $$(".counter").forEach((counter) => {
    const parent =
      counter.closest(".stat-card, .pstat, .gh-stat");

    const label =
      parent
        ?.querySelector(
          ".stat-card__label, .pstat__label, .gh-stat__label"
        )
        ?.textContent
        ?.toLowerCase()
        .trim() || "";

    /*
      IMPORTANT:
      Only use REAL values returned by GitHub.
      No fake/generated contribution numbers.
    */

    if (
      label.includes("project") ||
      label.includes("repository") ||
      label.includes("repo")
    ) {
      counter.dataset.target = stats.publicRepos;
      animateCounter(counter, stats.publicRepos);
    }

    else if (label.includes("star")) {
      counter.dataset.target = stats.totalStars;
      animateCounter(counter, stats.totalStars);
    }

    else if (label.includes("fork")) {
      counter.dataset.target = stats.totalForks;
      animateCounter(counter, stats.totalForks);
    }

    else if (label.includes("follower")) {
      counter.dataset.target = stats.followers;
      animateCounter(counter, stats.followers);
    }

    /*
      Commits and Contributions are NOT available as exact
      lifetime values from the REST endpoints currently used
      by the NEXUS backend (see apiClient.js / server/services/githubService.js).

      Do NOT invent numbers for these.
    */
  });
}

/* =========================================================
   DASHBOARD QUICK STATS & GREETING
========================================================= */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function updateDashboard(data) {
  if (!data || !data.stats) return;

  const greetingEl = $("#greetingTime");
  if (greetingEl) {
    greetingEl.textContent = getGreeting();
  }

  const repoCount = $("#repoCount");
  const followersCount = $("#followersCount");
  const starsCount = $("#starsCount");
  const forksCount = $("#forksCount");
  const statRepos = $("#statRepos");
  const statStars = $("#statStars");
  const statForks = $("#statForks");
  const statFollowers = $("#statFollowers");

  if (repoCount) repoCount.textContent = fmt(data.stats.publicRepos);
  if (followersCount) followersCount.textContent = fmt(data.stats.followers);
  if (starsCount) starsCount.textContent = fmt(data.stats.totalStars);
  if (forksCount) forksCount.textContent = fmt(data.stats.totalForks);

  if (statRepos) {
    statRepos.dataset.target = data.stats.publicRepos;
    animateCounter(statRepos, data.stats.publicRepos);
  }
  if (statStars) {
    statStars.dataset.target = data.stats.totalStars;
    animateCounter(statStars, data.stats.totalStars);
  }
  if (statForks) {
    statForks.dataset.target = data.stats.totalForks;
    animateCounter(statForks, data.stats.totalForks);
  }
  if (statFollowers) {
    statFollowers.dataset.target = data.stats.followers;
    animateCounter(statFollowers, data.stats.followers);
  }

  const profileProjects = $("#profileProjects");
  const profileContributions = $("#profileContributions");
  const profileFollowers = $("#profileFollowers");
  const profileCommits = $("#profileCommits");

  if (profileProjects) profileProjects.textContent = fmt(data.stats.publicRepos);
  if (profileContributions) profileContributions.textContent = fmt(data.stats.recentContributionTotal);
  if (profileFollowers) profileFollowers.textContent = fmt(data.stats.followers);
  if (profileCommits) profileCommits.textContent = fmt(data.stats.pushEvents);

  const welcomeUsername = $("#welcomeUsername");
  const welcomeLocation = $("#welcomeLocation");
  const welcomePublicRepos = $("#welcomePublicRepos");
  const welcomeRepoSummary = $("#welcomeRepoSummary");

  if (welcomeUsername && data.profile?.name) {
    welcomeUsername.textContent = data.profile.name.toUpperCase();
  }
  if (welcomeLocation && data.profile?.location) {
    welcomeLocation.innerHTML = `<i class="dot dot--purple"></i>${escapeHTML(data.profile.location)}`;
  }
  if (welcomePublicRepos) {
    welcomePublicRepos.innerHTML = `<i class="dot dot--cyan"></i>${data.stats.publicRepos} Repositories`;
  }
  if (welcomeRepoSummary) {
    welcomeRepoSummary.textContent = `Your development ecosystem, at a glance. ${data.stats.totalStars} stars earned across ${data.stats.publicRepos} public repositories.`;
  }

  updateLiveCounters(data.stats);
}

/* =========================================================
   GITHUB SNAPSHOT (PR / ISSUE / STAR TOTALS)
   -----------------------------------------------------------
   These three cards used to show hardcoded, permanently fake
   numbers (512 / 387 / 1.9k) regardless of the real GitHub
   account. They are now wired to real values:
     - Stars earned: a genuine current lifetime total
       (sum of stargazers_count across all repos).
     - Pull requests / Issue activity: GitHub's public Events
       API only exposes a rolling recent-activity window, NOT
       lifetime PR/issue counts - so these are honestly labeled
       "(recent)" in the UI rather than implied to be totals.
========================================================= */

function updateGithubSnapshotStats(stats) {
  if (!stats) return;

  const prCount = $("#prCount");
  const issuesCount = $("#issuesCount");
  const starsEarnedCount = $("#starsEarnedCount");

  if (prCount) {
    prCount.textContent = fmt(stats.pullRequestEvents);
  }

  if (issuesCount) {
    issuesCount.textContent = fmt(stats.issueEvents);
  }

  if (starsEarnedCount) {
    starsEarnedCount.textContent = fmt(stats.totalStars);
  }
}

/* =========================================================
   PROFILE
========================================================= */

function renderProfileSection(profile, stats, languages) {
  if (!profile) return;

  /* ---------- Main avatar ---------- */

  const avatarImg = $(".profile__avatar-ring img");

  if (avatarImg) {
    avatarImg.src =
      profile.avatar_url || "assets/aryanpic.jpeg";

    avatarImg.onerror = () => {
      avatarImg.src = "assets/aryanpic.jpeg";
    };
  }

  /* ---------- Name ---------- */

  const nameEl = $(".profile__name");

  if (nameEl) {
    nameEl.textContent =
      profile.name || "Aryan Sharma";
  }

  /* ---------- Bio ---------- */

  const bioEl = $(".profile__bio");

  if (bioEl) {
    bioEl.textContent =
      profile.bio ||
      "BCA Student & Developer crafting immersive web experiences and developer tooling. Passionate about clean interfaces, automotive tech and open source.";
  }

  /* ---------- Role & Location ---------- */

  const roleEl = $(".profile__role");

  if (roleEl && (profile.company || profile.location)) {
    roleEl.innerHTML = `
      <span class="grad-text">
        ${escapeHTML(profile.company || "BCA Student & Developer")}
      </span>
      · ${escapeHTML(profile.location || "New Delhi, India")}
    `;
  }

  const sidebarAvatar = $(".sidebar__avatar");

  if (sidebarAvatar) {
    sidebarAvatar.src =
      profile.avatar_url || "assets/aryanpic.jpeg";

    sidebarAvatar.onerror = () => {
      sidebarAvatar.src = "assets/aryanpic.jpeg";
    };
  }

  /* ---------- Profile chip ---------- */

  const profileChipImg = $(".profile-chip img");

  if (profileChipImg) {
    profileChipImg.src =
      profile.avatar_url || "assets/aryanpic.jpeg";

    profileChipImg.onerror = () => {
      profileChipImg.src = "assets/aryanpic.jpeg";
    };
  }

  /* ---------- GitHub link ---------- */

  const ghSocialBtn =
    $('.profile__socials a[aria-label="GitHub"]');

  if (ghSocialBtn) {
    ghSocialBtn.href =
      profile.html_url ||
      (profile.login
        ? `https://github.com/${profile.login}`
        : "#");

    ghSocialBtn.target = "_blank";
    ghSocialBtn.rel = "noopener";
  }

  /* ---------- Live counters ---------- */

  updateLiveCounters(stats);

  /* ---------- Language distribution ---------- */

  const langBars = $(".lang-bars");

  if (langBars && languages?.length > 0) {
    const topLangs = languages.slice(0, 4);

    langBars.innerHTML = topLangs
      .map((l) => {
        const colorVar = LANG_COLORS[l.name]
          ? `var(--${LANG_COLORS[l.name]})`
          : "var(--cyan)";

        const safePercent =
          Math.max(0, Math.min(100, Number(l.percent) || 0));

        return `
          <div class="lang-row">
            <span>${escapeHTML(l.name)}</span>

            <div class="lang-track">
              <i
                class="lang-fill"
                style="
                  --w:${safePercent}%;
                  --c:${colorVar};
                  width:${safePercent}%;
                "
              ></i>
            </div>

            <em>${safePercent}%</em>
          </div>
        `;
      })
      .join("");
  }
}

/* =========================================================
   PROJECTS
========================================================= */

function getSortedRepos(repos) {
  if (!repos) return [];
  const list = [...repos];
  list.sort((a, b) => {
    switch (activeSort) {
      case "stars":
        return (b.stargazers_count || 0) - (a.stargazers_count || 0);
      case "forks":
        return (b.forks_count || 0) - (a.forks_count || 0);
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "updated":
      default: {
        const timeA = new Date(a.pushed_at || a.updated_at || 0).getTime();
        const timeB = new Date(b.pushed_at || b.updated_at || 0).getTime();
        return timeB - timeA;
      }
    }
  });
  return list;
}

function renderProjectsSection(repos) {
  const grid = $("#projectsGrid");

  if (!grid || !repos) return;

  if (repos.length === 0) {
    grid.innerHTML = "";

    const empty = $("#projectsEmpty");

    if (empty) {
      empty.hidden = false;
    }

    return;
  }

  /* ---------- Dynamic language filters ---------- */

  const filterChips = $("#filterChips");

  if (filterChips) {
    const langs = Array.from(
      new Set(
        repos
          .map((r) => r.language)
          .filter(Boolean)
      )
    ).sort();

    filterChips.innerHTML = `
      <button
        class="filter-chip ${
          activeFilter === "all" ? "is-active" : ""
        }"
        data-filter="all"
        type="button"
      >
        All
      </button>

      ${langs
        .map(
          (l) => `
            <button
              class="filter-chip ${
                activeFilter === l.toLowerCase()
                  ? "is-active"
                  : ""
              }"
              data-filter="${escapeAttribute(l.toLowerCase())}"
              type="button"
            >
              ${escapeHTML(l)}
            </button>
          `
        )
        .join("")}
    `;
  }

  const sortedRepos = getSortedRepos(repos);
  const now = new Date();

  grid.innerHTML = sortedRepos
    .map((r) => {
      const lang = r.language || "Web";

      const langColor =
        LANG_COLORS[lang] || "cyan";

      const updatedDate = formatDate(
        r.pushed_at || r.updated_at
      );

      /* ---------- Status ---------- */

      let statusLabel = "ACTIVE";

      let statusClass =
        "status-badge--active";

      if (r.archived) {
        statusLabel = "ARCHIVED";
        statusClass =
          "status-badge--archived";
      }

      else if (
        r.homepage &&
        r.homepage.trim() !== ""
      ) {
        statusLabel = "LIVE";
        statusClass =
          "status-badge--live";
      }

      else {
        const diffDays = Math.floor(
          (now -
            new Date(
              r.pushed_at || r.updated_at || 0
            )) /
            (1000 * 60 * 60 * 24)
        );

        if (diffDays <= 30) {
          statusLabel = "ACTIVE";
          statusClass =
            "status-badge--active";
        } else {
          statusLabel = "RECENT";
          statusClass =
            "status-badge--recent";
        }
      }

      const demoUrl =
        r.homepage &&
        r.homepage.startsWith("http")
          ? r.homepage
          : r.html_url;

      return `
        <article
          class="project-card"
          data-category="${escapeAttribute((
            r.language || "web"
          ).toLowerCase())}"
          data-id="${escapeAttribute(r.name)}"
        >

          <div
            class="project-card__visual"
            data-open="${escapeAttribute(r.name)}"
            role="button"
            tabindex="0"
            aria-label="View ${escapeAttribute(r.name)} details"
            aria-haspopup="dialog"
          >

            <span class="project-card__category">
              ${escapeHTML(lang)}
            </span>

            ${generateRepoVisual(r)}

            <div class="project-card__overlay">
              <span>Quick view</span>
            </div>

          </div>

          <div class="project-card__body">

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:8px;
              "
            >

              <h3 class="project-card__title">
                ${escapeHTML(r.name)}
              </h3>

              <span
                class="status-badge ${statusClass}"
              >
                ${statusLabel}
              </span>

            </div>

            <p class="project-card__desc">
              ${
                r.description
                  ? escapeHTML(r.description)
                  : "Public repository on GitHub. Click to explore code, documentation and details."
              }
            </p>

            <div class="project-card__tags">

              <span class="tag tag--${langColor}">
                ${escapeHTML(lang)}
              </span>

              <span class="tag">
                ⭐ ${fmt(r.stargazers_count || 0)}
              </span>

              <span class="tag">
                🍴 ${fmt(r.forks_count || 0)}
              </span>

              <span class="tag">
                ${escapeHTML(updatedDate)}
              </span>

            </div>

            <div class="project-card__actions">

              <a
                class="btn btn--primary"
                href="${escapeAttribute(demoUrl)}"
                target="_blank"
                rel="noopener"
              >
                ${ICONS.external}
                ${r.homepage ? "Live demo" : "Repository"}
              </a>

              <a
                class="btn btn--ghost"
                href="${escapeAttribute(r.html_url)}"
                target="_blank"
                rel="noopener"
              >
                ${ICONS.git}
                GitHub
              </a>

            </div>

          </div>

        </article>
      `;
    })
    .join("");

  applyFilters();
}

/* =========================================================
   REPOSITORY VISUAL
========================================================= */

function generateRepoVisual(repo) {
  const name = escapeHTML(repo.name);
  const stars = fmt(repo.stargazers_count || 0);
  const forks = fmt(repo.forks_count || 0);
  const lang = escapeHTML(repo.language || "Code");
  const safeId = String(repo.name || "repo").replace(/[^a-zA-Z0-9_-]/g, "-");

  return `
    <svg
      viewBox="0 0 480 270"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="${escapeAttribute(repo.name)} preview"
    >
      <defs>
        <linearGradient id="bg-${safeId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#07090e" />
          <stop offset="100%" stop-color="#0d111a" />
        </linearGradient>
        <linearGradient id="beam-${safeId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(56, 189, 248, 0)" />
          <stop offset="50%" stop-color="rgba(56, 189, 248, 0.45)" />
          <stop offset="100%" stop-color="rgba(129, 140, 248, 0)" />
        </linearGradient>
        <pattern id="grid-${safeId}" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.025)" stroke-width="1" />
        </pattern>
      </defs>

      <rect width="480" height="270" fill="url(#bg-${safeId})" />
      <rect width="480" height="270" fill="url(#grid-${safeId})" />

      <!-- Top Edge Light Beam -->
      <rect x="0" y="0" width="480" height="1" fill="url(#beam-${safeId})" />

      <!-- Center Terminal Box -->
      <rect x="36" y="32" width="408" height="206" rx="10" fill="#06080d" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
      <rect x="36" y="32" width="408" height="1" fill="rgba(255, 255, 255, 0.12)" />

      <!-- Window Header Bar -->
      <line x1="36" y1="62" x2="444" y2="62" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1" />
      <circle cx="56" cy="47" r="3" fill="#f87171" opacity="0.8" />
      <circle cx="67" cy="47" r="3" fill="#fbbf24" opacity="0.8" />
      <circle cx="78" cy="47" r="3" fill="#34d399" opacity="0.8" />
      <text x="240" y="51" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="500" fill="#64748b" letter-spacing="0.08em">main · origin/main</text>

      <!-- Main Repo Title -->
      <text x="240" y="112" text-anchor="middle" font-family="'Space Grotesk', -apple-system, sans-serif" font-size="19" font-weight="700" fill="#f8fafc" letter-spacing="-0.01em">${name}</text>

      <!-- Telemetry Tags -->
      <text x="240" y="138" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" fill="#38bdf8" font-weight="500">
        ${lang} · ⭐ ${stars} · 🍴 ${forks}
      </text>

      <!-- Bottom Badge -->
      <g transform="translate(145, 166)">
        <rect width="190" height="24" rx="5" fill="rgba(56, 189, 248, 0.06)" stroke="rgba(56, 189, 248, 0.22)" stroke-width="1" />
        <circle cx="18" cy="12" r="2.5" fill="#34d399" />
        <text x="28" y="15.5" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="600" fill="#94a3b8" letter-spacing="0.08em">PRODUCTION TELEMETRY</text>
      </g>
    </svg>
  `;
}

/* =========================================================
   ACTIVITY FEED
========================================================= */

function renderActivitySection(activityFeed) {
  const list = $("#timeline");

  if (!list || !activityFeed) return;

  if (activityFeed.length === 0) {
    list.innerHTML = `
      <li class="timeline-item">
        <p class="timeline-item__title">
          No recent public activity recorded.
        </p>
      </li>
    `;

    return;
  }

  list.innerHTML = activityFeed
    .slice(0, timelineVisible)
    .map(
      (a) => `
        <li
          class="timeline-item timeline-item--${a.color}"
        >

          <div class="timeline-item__head">

            <p class="timeline-item__title">
              ${escapeHTML(a.title)}

              <a
                href="${escapeAttribute(a.repoUrl)}"
                target="_blank"
                rel="noopener"
              >
                ${escapeHTML(a.repo)}
              </a>
            </p>

            <span class="timeline-item__time">
              ${timeAgo(a.time)}
            </span>

          </div>

          <p class="timeline-item__desc">
            ${escapeHTML(a.desc)}
          </p>

        </li>
      `
    )
    .join("");

  const btn = $("#moreActivity");

  if (btn) {
    btn.hidden =
      timelineVisible >= activityFeed.length;
  }
}

/* =========================================================
   CONTRIBUTION HEATMAP
========================================================= */

function renderContributionsSection(contributionMap) {
  const grid = $("#contribGrid");

  if (!grid) return;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  const now = new Date();

  let totalContributions = 0;

  const daysData = [];

  /*
    This is based on the public events/repository activity
    supplied by the REST API.

    It is NOT the same as GitHub's official contribution graph.
  */

  for (let i = 363; i >= 0; i--) {
    const d = new Date(now);

    d.setDate(d.getDate() - i);

    const dateStr =
      d.toISOString().split("T")[0];

    const count =
      contributionMap?.[dateStr] || 0;

    totalContributions += count;

    let level = 0;

    if (count > 0 && count <= 2) {
      level = 1;
    }

    else if (count > 2 && count <= 5) {
      level = 2;
    }

    else if (count > 5 && count <= 9) {
      level = 3;
    }

    else if (count > 9) {
      level = 4;
    }

    daysData.push({
      date: d,
      dateStr,
      count,
      level
    });
  }

  const g =
    document.createElement("div");

  g.className = "contrib-grid";

  daysData.forEach((item) => {
    const cell =
      document.createElement("div");

    cell.className = "cell";

    cell.dataset.l = item.level;

    const formattedDate =
      formatDate(item.dateStr);

    const tip =
      document.createElement("div");

    tip.className = "cell-tip";

    tip.textContent =
      `${item.count} public activity ${
        item.count === 1 ? "event" : "events"
      } on ${formattedDate}`;

    cell.appendChild(tip);

    g.appendChild(cell);
  });

  const m =
    document.createElement("div");

  m.className = "contrib-months";

  months.forEach((mo) => {
    const s =
      document.createElement("span");

    s.textContent = mo;

    m.appendChild(s);
  });

  const wrap =
    document.createElement("div");

  wrap.className = "contrib-wrap";

  wrap.appendChild(m);

  wrap.appendChild(g);

  grid.innerHTML = "";

  grid.appendChild(wrap);

  const totalEl = $("#yearTotal");

  if (totalEl) {
    totalEl.textContent =
      fmt(totalContributions);
  }
}

/* =========================================================
   SKILLS
   -----------------------------------------------------------
   Ported from the previous nex.js implementation. The skill
   "level" is a heuristic derived from the REAL language
   percentage of the owner's own repositories (percent + 25,
   capped 40-98) - it is a presentation transform of live data,
   not an invented number.

   Per the "no fake/mixed data" requirement, the old hardcoded
   fallback skill list (e.g. "React 78%" shown even with zero
   real language data) has been removed - if there is no
   language data yet, the section shows an honest empty state
   instead of fabricated numbers.
========================================================= */

function renderSkills(languages) {
  const list = $("#skillList");

  if (!list) return;

  const langs = languages || [];

  if (langs.length === 0) {
    list.innerHTML = `
      <li class="skill-empty">
        No language data available yet.
      </li>
    `;
    return;
  }

  const skills = langs.slice(0, 6).map((language, index) => ({
    name: language.name,
    level: Math.min(
      98,
      Math.max(40, language.percent + 25)
    ),
    icon: index % 2 === 0 ? "bolt" : "check",
    color:
      ["cyan", "purple", "green", "amber"][index % 4]
  }));

  list.innerHTML = skills
    .map(
      (s) => `
      <li class="skill" data-level="${s.level}">

        <span
          class="skill__icon"
          style="background:var(--${s.color}-soft);color:var(--${s.color});"
        >
          ${ICONS[s.icon] || ICONS.bolt}
        </span>

        <span class="skill__meta">
          <strong>${escapeHTML(s.name)}</strong>
          <span>${s.level}%</span>
        </span>

        <span class="skill__track">
          <span class="skill__fill"></span>
        </span>

      </li>
    `
    )
    .join("");

  animateSkills();
}

function animateSkills() {
  $$("#skillList .skill").forEach((skill) => {
    const level = Number(skill.dataset.level) || 0;

    const fill = skill.querySelector(".skill__fill");

    if (fill) {
      requestAnimationFrame(() => {
        fill.style.width = `${level}%`;
      });
    }
  });
}

/* =========================================================
   SPARKLINES
   -----------------------------------------------------------
   Ported from nex.js. NOTE: these stat-card sparklines
   currently render a fixed illustrative trend baked into
   `data-spark` attributes in index.html - GitHub's REST API
   does not expose historical day-by-day snapshots of
   repo/star/fork/follower counts, so a truly live per-day
   trend would require this server to record its own daily
   snapshots over time (new infrastructure, out of scope for
   this cleanup pass). Flagged here and in the audit as a
   deliberate, labeled limitation rather than silently fixed.
========================================================= */

function drawSparklines() {
  $$(".sparkline").forEach((sparkline) => {
    const raw = sparkline.dataset.spark;
    if (!raw) return;

    const data = raw.split(",").map(Number).filter(Number.isFinite);
    if (data.length < 2) return;

    const width = 200;
    const height = 28;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "100%";
    svg.style.height = "100%";

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);

    const points = data.map((value, index) => [
      index * step,
      height - 3 - ((value - min) / range) * (height - 6)
    ]);

    const color = sparkline.classList.contains("sparkline--cyan")
      ? "var(--cyan)"
      : sparkline.classList.contains("sparkline--purple")
      ? "var(--purple)"
      : sparkline.classList.contains("sparkline--amber")
      ? "var(--amber)"
      : "var(--green)";

    const area = document.createElementNS(namespace, "path");
    area.setAttribute(
      "d",
      `M${points[0][0]},${height} ${points.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${points[points.length - 1][0]},${height} Z`
    );
    area.setAttribute("fill", color);
    area.setAttribute("opacity", "0.08");

    const line = document.createElementNS(namespace, "polyline");
    line.setAttribute("points", points.map((p) => p.join(",")).join(" "));
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");

    svg.appendChild(area);
    svg.appendChild(line);

    sparkline.innerHTML = "";
    sparkline.appendChild(svg);
  });
}

/* =========================================================
   SCROLL REVEAL
   -----------------------------------------------------------
   Ported from nex.js - fades/slides `.reveal` sections into
   view as the user scrolls, matching the existing visual design.
========================================================= */

function initReveal() {
  const elements = $$(".reveal");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  elements.forEach((element) => observer.observe(element));
}

/* =========================================================
   ANALYTICS CHART
========================================================= */

function getActiveChartData() {
  if (!liveData) {
    return { data: new Array(12).fill(0), unit: "events" };
  }

  switch (chartMetric) {
    case "prs":
      return {
        data:
          liveData.monthlyPullRequests &&
          liveData.monthlyPullRequests.length === 12
            ? liveData.monthlyPullRequests
            : new Array(12).fill(0),
        unit: "pull requests"
      };

    case "issues":
      return {
        data:
          liveData.monthlyIssues &&
          liveData.monthlyIssues.length === 12
            ? liveData.monthlyIssues
            : new Array(12).fill(0),
        unit: "issues"
      };

    case "updates":
      return {
        data:
          liveData.monthlyUpdates &&
          liveData.monthlyUpdates.length === 12
            ? liveData.monthlyUpdates
            : new Array(12).fill(0),
        unit: "events"
      };

    case "commits":
    default:
      return {
        data:
          liveData.monthlyCommits &&
          liveData.monthlyCommits.length === 12
            ? liveData.monthlyCommits
            : (liveData.monthlyUpdates || new Array(12).fill(0)),
        unit: "commits"
      };
  }
}

function renderAnalyticsChart() {
  const canvas = $("#analyticsChart");

  if (!canvas) return;

  const wrap = canvas.parentElement;

  if (!wrap) return;

  const rect =
    wrap.getBoundingClientRect();

  const H =
    wrap.clientHeight || 260;

  const dpr =
    Math.max(
      2,
      window.devicePixelRatio || 1
    );

  canvas.width =
    Math.round(rect.width * dpr);

  canvas.height =
    Math.round(H * dpr);

  canvas.style.height =
    H + "px";

  const ctx =
    canvas.getContext("2d");

  if (!ctx) return;

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    rect.width,
    H
  );

  const { data, unit } = getActiveChartData();

  const months =
    liveData?.monthlyLabels &&
    liveData.monthlyLabels.length === 12
      ? liveData.monthlyLabels
      : [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec"
        ];

  const pad = {
    top: 16,
    right: 18,
    bottom: 30,
    left: 44
  };

  const iw = Math.max(
    rect.width -
      pad.left -
      pad.right,
    40
  );

  const ih =
    H -
    pad.top -
    pad.bottom;

  const max =
    Math.max(...data, 4) *
    1.15;

  const step =
    iw /
    (data.length - 1);

  const points =
    data.map((v, i) => ({
      x:
        pad.left +
        i * step,

      y:
        pad.top +
        ih -
        (v / max) * ih,

      value: v,
      unit
    }));

  chartPoints = points;

  chartW = rect.width;

  chartCtx = ctx;

  const css =
    getComputedStyle(
      document.documentElement
    );

  const grid =
    css.getPropertyValue("--border")
      .trim() ||
    "rgba(255,255,255,.08)";

  const faint =
    css.getPropertyValue("--text-faint")
      .trim() ||
    "#667085";

  const cyan =
    css.getPropertyValue("--cyan")
      .trim() ||
    "#22d3ee";

  const purple =
    css.getPropertyValue("--purple")
      .trim() ||
    "#a78bfa";

  const amber =
    css.getPropertyValue("--amber")
      .trim() ||
    "#fbbf24";

  const green =
    css.getPropertyValue("--green")
      .trim() ||
    "#34d399";

  const accentColor =
    chartMetric === "prs"
      ? purple
      : chartMetric === "issues"
      ? amber
      : chartMetric === "updates"
      ? green
      : cyan;

  chartLineColor = accentColor;

  ctx.font = "10.5px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = grid;
  ctx.fillStyle = faint;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ih / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(rect.width - pad.right, y);
    ctx.stroke();

    ctx.fillText(
      fmt(Math.round((max / 4) * (4 - i))),
      6,
      y
    );
  }

  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ih);
  grad.addColorStop(
    0,
    chartMetric === "prs"
      ? "rgba(129,140,248,.18)"
      : chartMetric === "issues"
      ? "rgba(251,191,36,.16)"
      : chartMetric === "updates"
      ? "rgba(52,211,153,.18)"
      : "rgba(56,189,248,.2)"
  );
  grad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.top + ih);
  points.forEach((p) => {
    ctx.lineTo(p.x, p.y);
  });
  ctx.lineTo(points[points.length - 1].x, pad.top + ih);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
  });

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
  });

  ctx.textAlign =
    "center";

  points.forEach((p, i) => {
    if (i % 2 === 0 || rect.width > 600) {
      ctx.fillText(
        months[i],
        p.x,
        pad.top +
          ih +
          17
      );
    }
  });
}

/* =========================================================
   ANALYTICS CHART HOVER TOOLTIP & TABS
========================================================= */

function initChartTabs() {
  const tabs = $$(".chart-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      chartMetric = tab.dataset.metric || "commits";
      renderAnalyticsChart();
    });
  });
}

function initChartHover() {
  const canvas = $("#analyticsChart");
  const tip = $("#chartTooltip");

  if (!canvas || !tip) return;

  let active = -1;

  canvas.addEventListener("mousemove", (event) => {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;

    let nearest = 0;
    let distance = Infinity;

    chartPoints.forEach((point, index) => {
      const current = Math.abs(point.x - x);

      if (current < distance) {
        distance = current;
        nearest = index;
      }
    });

    const step = chartW ? chartW / 12 : 40;

    if (distance < Math.max(24, step / 2)) {
      if (active !== nearest) {
        active = nearest;

        renderAnalyticsChart();

        if (chartCtx) {
          const point = chartPoints[nearest];

          chartCtx.save();
          chartCtx.beginPath();
          chartCtx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          chartCtx.fillStyle = chartLineColor;
          chartCtx.fill();

          chartCtx.beginPath();
          chartCtx.arc(point.x, point.y, 12, 0, Math.PI * 2);
          chartCtx.globalAlpha = 0.35;
          chartCtx.lineWidth = 2;
          chartCtx.stroke();
          chartCtx.restore();
        }

        const monthLabel =
          liveData?.monthlyLabels?.[nearest] || "";

        const unitLabel =
          chartPoints[nearest]?.unit || "commits";

        tip.innerHTML = `
          <strong>${fmt(chartPoints[nearest].value)}</strong>
          ${escapeHTML(monthLabel)}
          <span style="color:var(--text-faint)">${escapeHTML(unitLabel)}</span>
        `;

        tip.hidden = false;

        const tw = tip.offsetWidth || 130;
        const th = tip.offsetHeight || 52;

        tip.style.left =
          Math.min(
            Math.max(chartPoints[nearest].x - tw / 2, 4),
            chartW - tw - 4
          ) + "px";

        tip.style.top =
          Math.max(chartPoints[nearest].y - th - 12, 4) + "px";
      }
    } else if (active !== -1) {
      active = -1;
      tip.hidden = true;
      renderAnalyticsChart();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    active = -1;
    tip.hidden = true;
    renderAnalyticsChart();
  });
}

/* =========================================================
   MODAL
========================================================= */

function openModal(repoName) {
  if (
    !liveData ||
    !liveData.repos
  ) {
    return;
  }

  const repo =
    liveData.repos.find(
      (r) => r.name === repoName
    );

  if (!repo) return;

  const modalVisual =
    $("#modalVisual");

  if (modalVisual) {
    modalVisual.innerHTML =
      generateRepoVisual(repo);
  }

  const modalTitle =
    $("#modalTitle");

  if (modalTitle) {
    modalTitle.textContent =
      repo.name;
  }

  const modalDesc =
    $("#modalDesc");

  if (modalDesc) {
    modalDesc.textContent =
      repo.description ||
      "Public repository on GitHub.";
  }

  const modalMeta =
    $("#modalMeta");

  if (modalMeta) {
    modalMeta.innerHTML = `
      <span class="tag tag--cyan">
        ${escapeHTML(repo.language || "Code")}
      </span>
    `;
  }

  const modalTags =
    $("#modalTags");

  if (modalTags) {
    modalTags.innerHTML = `
      <span class="tag tag--cyan">
        ${escapeHTML(repo.language || "Code")}
      </span>

      <span class="tag">
        Open Issues:
        ${fmt(repo.open_issues_count || 0)}
      </span>

      <span class="tag">
        Default Branch:
        ${escapeHTML(repo.default_branch || "main")}
      </span>
    `;
  }

  const modalFeatures =
    $("#modalFeatures");

  if (modalFeatures) {
    modalFeatures.innerHTML = `
      <li>
        Created on
        ${escapeHTML(formatDate(repo.created_at))}
      </li>

      <li>
        Last pushed on
        ${escapeHTML(formatDate(
          repo.pushed_at ||
          repo.updated_at
        ))}
      </li>

      <li>
        License:
        ${escapeHTML(repo.license?.name || "Not specified")}
      </li>
    `;
  }

  const modalStats =
    $("#modalStats");

  if (modalStats) {
    modalStats.innerHTML = `
      <div class="modal__stat">
        <strong>
          ${fmt(repo.stargazers_count || 0)}
        </strong>
        <span>Stars</span>
      </div>

      <div class="modal__stat">
        <strong>
          ${fmt(repo.forks_count || 0)}
        </strong>
        <span>Forks</span>
      </div>

      <div class="modal__stat">
        <strong>
          ${fmt(repo.watchers_count || 0)}
        </strong>
        <span>Watchers</span>
      </div>
    `;
  }

  const modalActions =
    $(".modal__actions");

  if (modalActions) {
    const demoUrl =
      repo.homepage &&
      repo.homepage.startsWith("http")
        ? repo.homepage
        : repo.html_url;

    modalActions.innerHTML = `
      <a
        class="btn btn--primary"
        href="${escapeAttribute(demoUrl)}"
        target="_blank"
        rel="noopener"
      >
        ${ICONS.external}
        ${
          repo.homepage
            ? "Live demo"
            : "Repository"
        }
      </a>

      <a
        class="btn btn--ghost"
        href="${escapeAttribute(repo.html_url)}"
        target="_blank"
        rel="noopener"
      >
        ${ICONS.git}
        View on GitHub
      </a>
    `;
  }

  const modal =
    $("#projectModal");

  if (!modal) return;

  modal.hidden = false;

  document.body.style.overflow =
    "hidden";

  requestAnimationFrame(() => {
    $(".modal__dialog", modal)?.focus();
  });
}

function closeModal() {
  const modal =
    $("#projectModal");

  if (!modal || modal.hidden) {
    return;
  }

  modal.hidden = true;

  document.body.style.overflow = "";
}

/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {
  const q =
    activeQuery
      .trim()
      .toLowerCase();

  let visibleCount = 0;

  $$("#projectsGrid .project-card")
    .forEach((card) => {
      const id =
        card.dataset.id;

      const repo =
        liveData?.repos?.find(
          (r) => r.name === id
        );

      if (!repo) return;

      const matchesFilter =
        activeFilter === "all" ||
        (
          repo.language &&
          repo.language.toLowerCase() ===
            activeFilter
        );

      const matchesQuery =
        !q ||
        repo.name
          .toLowerCase()
          .includes(q) ||
        (
          repo.description &&
          repo.description
            .toLowerCase()
            .includes(q)
        ) ||
        (
          repo.language &&
          repo.language
            .toLowerCase()
            .includes(q)
        );

      const isVisible =
        matchesFilter &&
        matchesQuery;

      card.classList.toggle(
        "is-hidden",
        !isVisible
      );

      if (isVisible) {
        visibleCount++;
      }
    });

  const emptyState =
    $("#projectsEmpty");

  if (emptyState) {
    emptyState.hidden =
      visibleCount !== 0;
  }
}

function setFilter(filter) {
  activeFilter = filter;

  $$(".filter-chip")
    .forEach((chip) => {
      chip.classList.toggle(
        "is-active",
        chip.dataset.filter ===
          filter
      );
    });

  applyFilters();
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function renderNotifications() {
  const renderList =
    (container, items) => {
      if (!container) return;

      container.innerHTML =
        items
          .map(
            (n) => `
              <li
                class="notif-item notif-item--${n.type}
                ${n.read ? "is-read" : ""}"
                data-id="${n.id}"
              >

                <span class="notif-item__icon">
                  ${ICONS[n.icon] || ICONS.check}
                </span>

                <div class="notif-item__body">
                  <p>${n.text}</p>
                  <time>${n.time}</time>
                </div>

                ${
                  n.read
                    ? ""
                    : '<span class="notif-item__dot"></span>'
                }

              </li>
            `
          )
          .join("");
    };

  renderList(
    $("#notifList"),
    NOTIFICATIONS
  );

  renderList(
    $("#notifListPanel"),
    NOTIFICATIONS
  );

  const unread =
    NOTIFICATIONS.filter(
      (n) => !n.read
    ).length;

  const badge =
    $("#notifBadge");

  if (badge) {
    badge.textContent =
      unread;

    badge.style.display =
      unread
        ? "inline-flex"
        : "none";
  }
}

/* =========================================================
   TOAST
========================================================= */

function toast(
  msg,
  type = "info"
) {
  const container =
    $("#toasts");

  if (!container) return;

  const t =
    document.createElement("div");

  t.className =
    "toast toast--" +
    type;

  const icon =
    type === "success"
      ? ICONS.check
      : type === "warning"
        ? ICONS.bolt
        : ICONS.shield;

  t.innerHTML = `
    <span class="toast__icon">
      ${icon}
    </span>

    <span>
      ${msg}
    </span>
  `;

  container.appendChild(t);

  setTimeout(() => {
    t.style.animation =
      "toastOut .3s var(--ease) forwards";

    setTimeout(
      () => t.remove(),
      320
    );
  }, 3400);
}

/* =========================================================
   LIVE DATA LOADING
========================================================= */

async function loadLiveData(
  forceRefresh = false
) {
  const refreshBtn =
    $("#refreshDataBtn");

  if (refreshBtn) {
    refreshBtn.classList.add(
      "spin-anim"
    );
  }

  const errorBanner =
    $("#apiErrorBanner");

  if (errorBanner) {
    errorBanner.hidden = true;
  }

  try {
    showSkeletons();

    /*
      NexusAPI.fetchAll() calls OUR OWN backend
      (/api/v1/github/dashboard), which holds the GitHub
      token server-side and handles caching. See
      apiClient.js. It returns the exact same payload
      shape the old client-side GitHubAPI.fetchAll() did.
    */

    if (
      typeof NexusAPI ===
      "undefined"
    ) {
      throw new Error(
        "NexusAPI module was not loaded. Check apiClient.js is included before app.js."
      );
    }

    const data =
      await NexusAPI.fetchAll(
        forceRefresh
      );

    liveData = data;

    hideSkeletons();

    /* ---------- Update everything ---------- */

    updateDashboard(data);

    renderProfileSection(
      data.profile,
      data.stats,
      data.languages
    );

    renderProjectsSection(
      data.repos
    );

    renderActivitySection(
      data.activityFeed
    );

    renderContributionsSection(
      data.contributionMap
    );

    renderSkills(
      data.languages
    );

    renderAnalyticsChart();

    updateGithubSnapshotStats(
      data.stats
    );

    startLiveTicker(
      data.fetchedAt
    );

    updateLiveStatus(data);

    /* ---------- Error/cache state ---------- */

    if (data.fetchError) {
      const msgEl =
        $("#apiErrorMessage");

      if (msgEl) {
        msgEl.textContent =
          `Displaying cached snapshot. (${data.fetchError})`;
      }

      if (errorBanner) {
        errorBanner.hidden = false;
      }
    }

    else {
      if (errorBanner) {
        errorBanner.hidden = true;
      }
    }

    if (refreshBtn) {
      refreshBtn.classList.remove(
        "spin-anim"
      );
    }

    if (
      forceRefresh &&
      !data.fetchError
    ) {
      toast(
        "Dashboard synchronized with live GitHub API",
        "success"
      );
    }

  } catch (err) {
    hideSkeletons();

    if (refreshBtn) {
      refreshBtn.classList.remove(
        "spin-anim"
      );
    }

    const msgEl =
      $("#apiErrorMessage");

    const userMessage =
      err?.message ||
      "Unable to synchronize GitHub data.";

    if (msgEl) {
      msgEl.textContent =
        userMessage;
    }

    if (errorBanner) {
      errorBanner.hidden = false;
    }

    updateLiveStatus({
      fetchError: userMessage,
      isCached: false
    });

    console.error(
      "Dashboard error state triggered",
      {
        message: userMessage,
        error: err
      }
    );

    toast(
      userMessage,
      "error"
    );
  }
}

/* =========================================================
   AUTOMATIC LIVE REFRESH
========================================================= */

function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(
      autoRefreshInterval
    );
    autoRefreshInterval = null;
  }

  if (autoRefreshMs <= 0) return;

  autoRefreshInterval =
    setInterval(() => {
      // Do not spend GitHub API calls while the tab is hidden.
      if (document.visibilityState !== "visible") return;

      // Force refresh so we actually ask GitHub for fresh data
      // instead of using the old local cache.
      loadLiveData(true);
    }, autoRefreshMs);
}

/* =========================================================
   THEME
========================================================= */

function initTheme() {
  const savedTheme =
    localStorage.getItem("nexus-theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;

  const savedMotion =
    localStorage.getItem("nexus-reduce-motion");
  if (savedMotion === "true") {
    document.body.classList.add("reduce-motion");
  }

  const toggle =
    $("#themeToggle");

  if (toggle) {
    toggle.addEventListener(
      "click",
      () => {
        const current =
          document.documentElement.dataset.theme || "dark";

        const nextTheme =
          current === "dark"
            ? "light"
            : current === "light"
            ? "oled"
            : "dark";

        document.documentElement.dataset.theme =
          nextTheme;

        localStorage.setItem(
          "nexus-theme",
          nextTheme
        );

        renderAnalyticsChart();

        toast(`Theme set to ${nextTheme}`, "info");
      }
    );
  }
}

/* =========================================================
   SIDEBAR
========================================================= */

function initSidebar() {
  const menuBtn =
    $("#menuBtn");

  const backdrop =
    $("#sidebarBackdrop");

  function closeMobile() {
    document.body.classList.remove(
      "sidebar-open"
    );

    if (backdrop) {
      backdrop.hidden = true;
    }

    document.body.style.overflow =
      "";
  }

  const collapseBtn =
    $("#collapseBtn");

  if (collapseBtn) {
    collapseBtn.addEventListener(
      "click",
      () => {
        if (
          window.matchMedia(
            "(max-width: 767px)"
          ).matches
        ) {
          document.body.classList.toggle(
            "sidebar-open"
          );
        } else {
          document.body.classList.toggle(
            "sidebar-collapsed"
          );
        }
      }
    );
  }

  if (menuBtn) {
    menuBtn.addEventListener(
      "click",
      () => {
        const open =
          document.body.classList.toggle(
            "sidebar-open"
          );

        if (backdrop) {
          backdrop.hidden =
            !open;
        }

        document.body.style.overflow =
          open
            ? "hidden"
            : "";
      }
    );
  }

  if (backdrop) {
    backdrop.addEventListener(
      "click",
      closeMobile
    );
  }

  $$(".nav-link")
    .forEach((l) => {
      l.addEventListener(
        "click",
        () => {
          if (
            window.matchMedia(
              "(max-width: 767px)"
            ).matches
          ) {
            closeMobile();
          }
        }
      );
    });

  const sections = [
    "dashboard",
    "projects",
    "activity",
    "contributions",
    "analytics",
    "notifications-panel",
    "profile"
  ]
    .map((id) => {
      const el =
        document.getElementById(
          id
        );

      return el
        ? { id, el }
        : null;
    })
    .filter(Boolean);

  const navLinks =
    $$(".nav-link[data-nav]");

  const spy = () => {
    let current =
      "dashboard";

    sections.forEach(
      ({ id, el }) => {
        if (
          el.getBoundingClientRect()
            .top <= 140
        ) {
          current = id;
        }
      }
    );

    navLinks.forEach((l) => {
      l.classList.toggle(
        "is-active",
        l.dataset.nav ===
          current
      );
    });
  };

  window.addEventListener(
    "scroll",
    spy,
    { passive: true }
  );

  spy();
}

/* =========================================================
   SEARCH + ACTIONS
========================================================= */

function initSearchAndActions() {
  const searchInput =
    $("#searchInput");

  const projectSearch =
    $("#projectSearch");

  const syncQuery = (v) => {
    activeQuery = v;

    if (
      projectSearch &&
      projectSearch.value !== v
    ) {
      projectSearch.value =
        v;
    }

    if (
      searchInput &&
      searchInput.value !== v
    ) {
      searchInput.value =
        v;
    }

    applyFilters();
  };

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      (e) =>
        syncQuery(
          e.target.value
        )
    );
  }

  if (projectSearch) {
    projectSearch.addEventListener(
      "input",
      (e) =>
        syncQuery(
          e.target.value
        )
    );
  }

  const sortSelect =
    $("#projectSort");

  if (sortSelect) {
    sortSelect.value = activeSort;
    sortSelect.addEventListener(
      "change",
      (e) => {
        activeSort = e.target.value;
        renderProjectsSection(
          liveData?.repos
        );
      }
    );
  }

  const filterChipsContainer =
    $("#filterChips");

  if (filterChipsContainer) {
    filterChipsContainer.addEventListener(
      "click",
      (e) => {
        const chip =
          e.target.closest(
            ".filter-chip"
          );

        if (chip) {
          setFilter(
            chip.dataset.filter
          );
        }
      }
    );
  }

  const clearBtn =
    $("#clearFilters");

  if (clearBtn) {
    clearBtn.addEventListener(
      "click",
      () => {
        syncQuery("");
        setFilter("all");
      }
    );
  }

  const refreshBtn =
    $("#refreshDataBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener(
      "click",
      () =>
        loadLiveData(true)
    );
  }

  const retryBtn =
    $("#apiRetryBtn");

  if (retryBtn) {
    retryBtn.addEventListener(
      "click",
      () =>
        loadLiveData(true)
    );
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (
        (e.metaKey ||
          e.ctrlKey) &&
        e.key.toLowerCase() ===
          "k"
      ) {
        e.preventDefault();

        if (searchInput) {
          searchInput.focus();
        }

      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !==
          "INPUT"
      ) {
        e.preventDefault();

        if (projectSearch) {
          projectSearch.focus();
        }
      }
    }
  );

  const moreActivityBtn =
    $("#moreActivity");

  if (moreActivityBtn) {
    moreActivityBtn.addEventListener(
      "click",
      () => {
        timelineVisible += 5;

        renderActivitySection(
          liveData?.activityFeed ||
            []
        );
      }
    );
  }

  const resumeBtn =
    $('[data-download="resume"]');

  if (resumeBtn) {
    resumeBtn.addEventListener(
      "click",
      () => {
        const blob =
          new Blob(
            [
              "Aryan Sharma - BCA Student, Frontend Developer.\n\n" +
              "New Delhi, India.\n" +
              "GitHub: https://github.com/arayan11587kvrsodelhi-oss\n" +
              "Skills: TypeScript, JavaScript, HTML5/CSS3, React, Python.\n\n" +
              "Thank you for viewing NEXUS DEV WORKSPACE!"
            ],
            {
              type:
                "text/plain"
            }
          );

        const url =
          URL.createObjectURL(
            blob
          );

        const a =
          document.createElement(
            "a"
          );

        a.href = url;

        a.download =
          "Aryan-Sharma-CV.txt";

        a.click();

        URL.revokeObjectURL(
          url
        );

        toast(
          "Resume downloaded",
          "success"
        );
      }
    );
  }
}

/* =========================================================
   MODAL WIRING & ACCESSIBILITY
========================================================= */

let lastFocusedElement = null;

function openModalElement(modalEl) {
  if (!modalEl) return;
  lastFocusedElement = document.activeElement;
  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => {
    const focusable = modalEl.querySelector("button, input, select, a[href], [tabindex='0']");
    if (focusable) {
      focusable.focus();
    }
  });
}

function closeModalElement(modalEl) {
  if (!modalEl || modalEl.hidden) return;
  modalEl.hidden = true;
  document.body.style.overflow = "";
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function closeAllModals() {
  closeModalElement($("#projectModal"));
  closeModalElement($("#settingsModal"));
  closeModalElement($("#helpModal"));
}

function initSettings() {
  const settingsModal = $("#settingsModal");
  const navSettingsBtn = $("#navSettingsBtn");
  const profileSettingsLink = $("#profileSettingsLink");
  const themeSelect = $("#settingsThemeSelect");
  const reducedMotionCheck = $("#settingsReducedMotion");
  const refreshIntervalSelect = $("#settingsRefreshInterval");
  const syncBtn = $("#settingsSyncBtn");

  const currentTheme = document.documentElement.dataset.theme || "dark";
  if (themeSelect) themeSelect.value = currentTheme;

  const isReduced = document.body.classList.contains("reduce-motion");
  if (reducedMotionCheck) reducedMotionCheck.checked = isReduced;

  if (refreshIntervalSelect) refreshIntervalSelect.value = String(autoRefreshMs);

  const openSettings = () => openModalElement(settingsModal);

  if (navSettingsBtn) {
    navSettingsBtn.addEventListener("click", openSettings);
  }
  if (profileSettingsLink) {
    profileSettingsLink.addEventListener("click", (e) => {
      e.preventDefault();
      openSettings();
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      const theme = e.target.value;
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("nexus-theme", theme);
      renderAnalyticsChart();
      toast(`Theme set to ${theme}`, "info");
    });
  }

  if (reducedMotionCheck) {
    reducedMotionCheck.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      document.body.classList.toggle("reduce-motion", enabled);
      localStorage.setItem("nexus-reduce-motion", enabled ? "true" : "false");
      toast(enabled ? "Reduced motion enabled" : "Full animations enabled", "info");
    });
  }

  if (refreshIntervalSelect) {
    refreshIntervalSelect.addEventListener("change", (e) => {
      autoRefreshMs = Number(e.target.value);
      localStorage.setItem("nexus-refresh-ms", String(autoRefreshMs));
      startAutoRefresh();
      toast(autoRefreshMs > 0 ? `Auto-refresh set to ${autoRefreshMs / 60000}m` : "Auto-refresh disabled", "info");
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      closeModalElement(settingsModal);
      loadLiveData(true);
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-settings]")) {
        closeModalElement(settingsModal);
      }
    });
  }
}

function initHelp() {
  const helpModal = $("#helpModal");
  const navHelpBtn = $("#navHelpBtn");

  if (navHelpBtn) {
    navHelpBtn.addEventListener("click", () => openModalElement(helpModal));
  }

  if (helpModal) {
    helpModal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-help]")) {
        closeModalElement(helpModal);
      }
    });
  }
}

function initModalWiring() {
  const modal =
    $("#projectModal");

  const projectsGrid =
    $("#projectsGrid");

  if (projectsGrid) {
    projectsGrid.addEventListener(
      "click",
      (e) => {
        const v =
          e.target.closest(
            ".project-card__visual"
          );

        if (v) {
          openModal(
            v.dataset.open
          );
        }
      }
    );

    projectsGrid.addEventListener(
      "keydown",
      (e) => {
        if (
          e.key !== "Enter" &&
          e.key !== " "
        ) {
          return;
        }

        const v =
          e.target.closest(
            ".project-card__visual"
          );

        if (v) {
          e.preventDefault();

          openModal(
            v.dataset.open
          );
        }
      }
    );
  }

  if (modal) {
    modal.addEventListener(
      "click",
      (e) => {
        if (
          e.target.closest(
            "[data-close-modal]"
          )
        ) {
          closeModal();
        }
      }
    );
  }

  initSettings();
  initHelp();

  document.addEventListener(
    "keydown",
    (e) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        $("#searchInput")?.focus();
      } else if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        $("#projectSearch")?.focus();
      } else if (
        e.key.toLowerCase() === "t" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        $("#themeToggle")?.click();
      } else if (
        e.key.toLowerCase() === "r" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        loadLiveData(true);
      } else if (
        e.key.toLowerCase() === "s" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        openModalElement($("#settingsModal"));
      } else if (
        e.key === "?" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "SELECT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        openModalElement($("#helpModal"));
      } else if (e.key === "Escape") {
        closeAllModals();
        document.body.classList.remove("sidebar-open");
        const backdrop = $("#sidebarBackdrop");
        if (backdrop) backdrop.hidden = true;
        document.body.style.overflow = "";
      }
    }
  );
}

/* =========================================================
   DROPDOWNS
========================================================= */

function initDropdowns() {
  const notifBtn =
    $("#notifBtn");

  const notifDD =
    $("#notifDropdown");

  const profileBtn =
    $("#profileBtn");

  const profileDD =
    $("#profileDropdown");

  function closeAll() {
    if (notifDD) {
      notifDD.hidden = true;
    }

    if (profileDD) {
      profileDD.hidden = true;
    }
  }

  if (
    notifBtn &&
    notifDD
  ) {
    notifBtn.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();

        const willOpen =
          notifDD.hidden;

        closeAll();

        if (willOpen) {
          notifDD.hidden =
            false;
        }
      }
    );
  }

  if (
    profileBtn &&
    profileDD
  ) {
    profileBtn.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();

        const willOpen =
          profileDD.hidden;

        closeAll();

        if (willOpen) {
          profileDD.hidden =
            false;
        }
      }
    );
  }

  const markAllRead =
    $("#markAllRead");

  if (markAllRead) {
    markAllRead.addEventListener(
      "click",
      () => {
        NOTIFICATIONS.forEach(
          (n) => {
            n.read = true;
          }
        );

        renderNotifications();

        toast(
          "Notifications marked as read",
          "success"
        );
      }
    );
  }

  document.addEventListener(
    "click",
    (e) => {
      if (
        !e.target.closest(
          ".dropdown"
        )
      ) {
        closeAll();
      }
    }
  );
}

/* =========================================================
   INITIALIZATION
========================================================= */

function init() {
  initTheme();

  initSidebar();

  initSearchAndActions();

  initModalWiring();

  initDropdowns();

  initReveal();

  drawSparklines();

  initChartTabs();
  initChartHover();

  renderNotifications();

  const greetingEl = $("#greetingTime");
  if (greetingEl) {
    greetingEl.textContent = getGreeting();
  }

  const eyebrow = $(".eyebrow");
  if (eyebrow) {
    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    eyebrow.textContent = `${todayStr} · SYSTEM TELEMETRY ACTIVE`;
  }

  const footerCopyright = $(".footer p");
  if (footerCopyright) {
    const currentYear = new Date().getFullYear();
    footerCopyright.innerHTML = `&copy; ${currentYear} <strong>NEXUS</strong> &middot; Crafted by Aryan Sharma`;
  }

  /*
    IMPORTANT:
    No top-level await anymore.
    Everything starts after DOMContentLoaded.
  */

  loadLiveData(false);

  /*
    Automatically synchronize
    with GitHub every 5 minutes.
  */

  startAutoRefresh();

  let resizeTimer;

  window.addEventListener(
    "resize",
    () => {
      clearTimeout(
        resizeTimer
      );

      resizeTimer =
        setTimeout(
          () =>
            renderAnalyticsChart(),
          160
        );
    }
  );
}

/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init
  );
} else {
  init();
}