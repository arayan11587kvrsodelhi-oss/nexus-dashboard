/* =========================================================
   NEXUS Dashboard - API Client
   -----------------------------------------------------------
   Replaces the old client-side github-api.js. This module
   NEVER talks to api.github.com directly - it only calls our
   own backend, which holds the (optional) GitHub token and
   does the caching. This keeps the token off the browser
   entirely and removes the 60 req/hour unauthenticated GitHub
   rate limit as a client-side concern.

   The returned payload shape is identical to what the old
   client-side GitHubAPI.fetchAll() returned, so the rest of
   the frontend (app.js) needed no changes to its rendering
   logic - only to how the data is fetched.
   ========================================================= */

"use strict";

const NexusAPI = {
  /**
   * @param {boolean} forceRefresh - ask the server to bypass its cache
   *   and hit GitHub live (rate-limited server-side).
   */
  async fetchAll(forceRefresh = false) {
    const url = `/api/v1/github/dashboard${forceRefresh ? "?refresh=true" : ""}`;

    let response;

    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (networkError) {
      const err = new Error("Unable to reach the NEXUS server. Check your connection.");
      err.isNetworkError = true;
      err.originalError = networkError;
      throw err;
    }

    if (!response.ok) {
      let body = null;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      const message =
        body?.error?.message ||
        `Unable to fetch dashboard data (HTTP ${response.status}).`;

      const err = new Error(message);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }
};

if (typeof window !== "undefined") {
  window.NexusAPI = NexusAPI;
}
