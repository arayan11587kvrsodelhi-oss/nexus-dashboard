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

// In-flight promise deduplication
let inFlightFetchPromise = null;

function formatAuthHeader(rawToken) {
  if (!rawToken || typeof rawToken !== "string") return null;
  const token = rawToken.trim().replace(/^["']|["']$/g, "");
  if (!token) return null;
  if (token.startsWith("Bearer ") || token.startsWith("token ")) {
    return token;
  }
  return `Bearer ${token}`;
}

function buildHeaders() {
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "nexus-dashboard"
  };

  const auth = formatAuthHeader(env.GITHUB_TOKEN);
  if (auth) {
    headers["Authorization"] = auth;
  }

  return headers;
}

const FETCH_TIMEOUT_MS = 10000;

async function fetchWithDiagnostics(url) {
  let response;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startHr = process.hrtime.bigint();

  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal
    });
  } catch (networkErr) {
    const isTimeout = networkErr?.name === "AbortError";
    const durationMs = Number(process.hrtime.bigint() - startHr) / 1e6;

    logger.error("GitHub API network failure", {
      url,
      durationMs: Math.round(durationMs),
      message: networkErr?.message,
      timedOut: isTimeout
    });

    const err = new Error(
      isTimeout
        ? "Timed out connecting to GitHub."
        : "Unable to connect to GitHub."
    );
    err.status = isTimeout ? 504 : 502;
    err.code = isTimeout ? "GITHUB_TIMEOUT" : "GITHUB_NETWORK_ERROR";
    err.isNetworkError = true;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Number(process.hrtime.bigint() - startHr) / 1e6;
  const rateLimit = {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset"),
    resource: response.headers.get("x-ratelimit-resource")
  };

  logger.debug("GitHub API upstream call completed", {
    url,
    status: response.status,
    durationMs: Math.round(durationMs),
    rateLimitRemaining: rateLimit.remaining
  });

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
    let code = "GITHUB_API_ERROR";
    let retryAfter = null;

    if (rateLimit.reset) {
      const resetTime = Number(rateLimit.reset) * 1000;
      retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
    }

    if (response.status === 401) {
      code = "GITHUB_UNAUTHORIZED";
      message = "GitHub authentication failed. Check your server GITHUB_TOKEN.";
    } else if (
      response.status === 403 ||
      response.status === 429 ||
      (rateLimit.remaining !== null && Number(rateLimit.remaining) === 0)
    ) {
      code = "GITHUB_RATE_LIMIT";
      message = "GitHub API rate limit reached. Please try again later.";
    } else if (response.status === 404) {
      code = "GITHUB_NOT_FOUND";
      message = `GitHub profile '${env.GITHUB_USERNAME}' could not be found.`;
    } else if (response.status >= 500) {
      code = "GITHUB_UPSTREAM_ERROR";
      message = "GitHub is temporarily unavailable.";
    }

    const err = new Error(message);
    err.status = response.status;
    err.code = code;
    err.retryAfter = retryAfter;
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
 * with in-flight deduplication.
 */
async function fetchLiveDashboard() {
  if (inFlightFetchPromise) {
    return inFlightFetchPromise;
  }

  inFlightFetchPromise = (async () => {
    try {
      const [profile, repos, events] = await Promise.all([
        getProfile(),
        getRepositories(),
        getEvents()
      ]);

      const processed = processGitHubData(env.GITHUB_USERNAME, profile, repos, events);
      const now = Date.now();

      processed.fetchedAt = now;
      processed.expiresAt = now + env.GITHUB_CACHE_TTL_MS;
      processed.isCached = false;
      processed.fetchError = null;

      return processed;
    } finally {
      inFlightFetchPromise = null;
    }
  })();

  return inFlightFetchPromise;
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
    logger.error("GitHub data synchronization failed", {
      code: error?.code,
      status: error?.status,
      message: error?.message
    });

    const stale = cache.getStale(CACHE_KEY);

    if (stale) {
      return {
        ...stale.value,
        isCached: true,
        isStale: true,
        cacheAgeMs: stale.ageMs,
        cacheState: "stale-cache",
        dataSource: "github-cache",
        fetchError: error?.message || "Unable to synchronize GitHub data.",
        errorCode: error?.code || "GITHUB_SYNC_ERROR"
      };
    }

    // No cache at all (e.g. first request ever, GitHub down) - surface the error.
    throw error;
  }
}

/**
 * Health check helper measuring upstream GitHub latency without full load.
 */
async function checkGitHubHealth() {
  const start = Date.now();
  let latencyMs = null;
  let status = "healthy";

  if (!env.GITHUB_USERNAME) {
    return {
      status: "unconfigured",
      latencyMs: null
    };
  }

  try {
    const res = await fetch(`${env.GITHUB_API_BASE_URL}/users/${encodeURIComponent(env.GITHUB_USERNAME)}`, {
      method: "GET",
      headers: buildHeaders(),
      signal: AbortSignal.timeout(4000)
    });

    latencyMs = Date.now() - start;

    if (!res.ok) {
      status = res.status === 403 || res.status === 429 ? "rate_limited" : "degraded";
    }
  } catch {
    latencyMs = Date.now() - start;
    status = "unreachable";
  }

  return {
    status,
    latencyMs,
    username: env.GITHUB_USERNAME,
    tokenConfigured: Boolean(env.GITHUB_TOKEN)
  };
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

module.exports = { getDashboard, getStatus, checkGitHubHealth, cache };
