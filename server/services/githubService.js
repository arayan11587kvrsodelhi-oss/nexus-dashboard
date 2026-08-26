/* =========================================================
   NEXUS Dashboard - GitHub Service
   -----------------------------------------------------------
   Server-side replacement for the client-side GitHubAPI object
   that used to live in github-api.js. Behavior is intentionally
   preserved:
     - fetch profile + repos + events in parallel
     - process them into the dashboard payload
     - cache the result (in-memory, TTL-based)
     - on fetch failure, fall back to the last good cached
       payload and flag it, instead of failing the request

   The one behavior CHANGE from the original: this runs on the
   server with an optional GITHUB_TOKEN, so the 60 req/hour
   unauthenticated GitHub rate limit (shared across every
   visitor's IP) becomes 5,000 req/hour shared across all of
   THIS SERVER's own requests to GitHub - which is what the
   architecture audit flagged as the real scalability limit.
   ========================================================= */

"use strict";

const { env } = require("../config/env");
const { logger } = require("../utils/logger");
const { TTLCache } = require("../utils/cache");
const { processGitHubData } = require("../lib/githubDataProcessor");

const CACHE_KEY = "github:dashboard";

const cache = new TTLCache();

function buildHeaders() {
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "nexus-dashboard"
  };

  if (env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`;
  }

  return headers;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithDiagnostics(url) {
  let response;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal
    });
  } catch (networkErr) {
    const isTimeout = networkErr?.name === "AbortError";

    logger.error("GitHub API network failure", {
      url,
      message: networkErr?.message,
      timedOut: isTimeout
    });

    const err = new Error(
      isTimeout
        ? "Timed out connecting to GitHub."
        : "Unable to connect to GitHub."
    );
    err.isNetworkError = true;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const rateLimit = {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset")
  };

  if (!response.ok) {
    let bodyText = "";

    try {
      bodyText = await response.text();
    } catch {
      bodyText = "";
    }

    logger.error("GitHub API request failed", {
      url,
      status: response.status,
      statusText: response.statusText,
      rateLimit
    });

    let message = `Unable to fetch GitHub data (HTTP ${response.status}).`;

    if (
      response.status === 403 ||
      response.status === 429 ||
      (rateLimit.remaining !== null && Number(rateLimit.remaining) === 0)
    ) {
      message = "GitHub API rate limit reached. Please try again later.";
    } else if (response.status === 404) {
      message = "GitHub profile could not be found.";
    } else if (response.status >= 500) {
      message = "GitHub is temporarily unavailable.";
    }

    const err = new Error(message);
    err.status = response.status;
    err.body = bodyText;
    err.rateLimit = rateLimit;
    throw err;
  }

  return response.json();
}

function getProfile() {
  return fetchWithDiagnostics(
    `${env.GITHUB_API_BASE_URL}/users/${encodeURIComponent(env.GITHUB_USERNAME)}`
  );
}

function getRepositories() {
  const url =
    `${env.GITHUB_API_BASE_URL}/users/${encodeURIComponent(env.GITHUB_USERNAME)}` +
    `/repos?per_page=100&sort=updated&direction=desc&type=owner`;

  return fetchWithDiagnostics(url);
}

function getEvents() {
  const url =
    `${env.GITHUB_API_BASE_URL}/users/${encodeURIComponent(env.GITHUB_USERNAME)}` +
    `/events/public?per_page=100&page=1`;

  return fetchWithDiagnostics(url);
}

/**
 * Fetch a live, fully processed dashboard payload from GitHub
 * (no cache read/write - used internally by getDashboard).
 */
async function fetchLiveDashboard() {
  const [profile, repos, events] = await Promise.all([
    getProfile(),
    getRepositories(),
    getEvents()
  ]);

  const processed = processGitHubData(env.GITHUB_USERNAME, profile, repos, events);

  processed.fetchedAt = Date.now();
  processed.isCached = false;
  processed.fetchError = null;

  return processed;
}

/**
 * Main entry point used by the routes layer.
 *
 * @param {boolean} forceRefresh - bypass the cache and hit GitHub live
 * @returns {Promise<object>} dashboard payload
 */
async function getDashboard(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);

    if (cached) {
      return {
        ...cached,
        isCached: true,
        isStale: false,
        cacheAgeMs: Math.max(0, Date.now() - cached.fetchedAt),
        cacheState: "fresh-cache",
        dataSource: "github"
      };
    }
  }

  try {
    const fresh = await fetchLiveDashboard();

    cache.set(CACHE_KEY, fresh, env.GITHUB_CACHE_TTL_MS);

    return {
      ...fresh,
      isCached: false,
      isStale: false,
      cacheAgeMs: 0,
      cacheState: "live",
      dataSource: "github"
    };
  } catch (error) {
    logger.error("GitHub data synchronization failed", { message: error?.message });

    const stale = cache.getStale(CACHE_KEY);

    if (stale) {
      return {
        ...stale.value,
        isCached: true,
        isStale: true,
        cacheAgeMs: stale.ageMs,
        cacheState: "stale-cache",
        dataSource: "github-cache",
        fetchError: error?.message || "Unable to synchronize GitHub data."
      };
    }

    // No cache at all (e.g. first request ever, GitHub down) - surface the error.
    throw error;
  }
}

/**
 * Used by the readiness endpoint to report cache/last-fetch state
 * without triggering a new GitHub call.
 */
function getStatus() {
  const stale = cache.getStale(CACHE_KEY);

  return {
    hasCachedData: Boolean(stale),
    cacheAgeMs: stale ? stale.ageMs : null,
    githubTokenConfigured: Boolean(env.GITHUB_TOKEN)
  };
}

module.exports = { getDashboard, getStatus };
