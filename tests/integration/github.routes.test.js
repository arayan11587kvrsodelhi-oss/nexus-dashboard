import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

// Ensure required env vars exist before the app (and its config module) loads.
process.env.GITHUB_USERNAME = process.env.GITHUB_USERNAME || "test-user";
process.env.NODE_ENV = "test";

const { createApp } = await import("../../server/app.js");

function mockGitHubResponses({ profile, repos, events }) {
  global.fetch = vi.fn(async (url) => {
    const makeResponse = (body, ok = true, status = 200) => ({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      headers: {
        get: () => null
      },
      json: async () => body,
      text: async () => JSON.stringify(body)
    });

    if (url.includes("/events/public")) {
      return makeResponse(events);
    }

    if (url.includes("/repos?")) {
      return makeResponse(repos);
    }

    return makeResponse(profile);
  });
}

describe("GET /api/v1/health", () => {
  it("returns 200 and an ok status", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/v1/ready", () => {
  it("returns 200 when GITHUB_USERNAME is configured", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });
});

describe("GET /api/v1/github/dashboard", () => {
  const originalFetch = global.fetch;

  // This scenario must run BEFORE any other test in this file populates
  // the cache singleton inside server/services/githubService.js - it
  // verifies behavior when there is truly no prior data to fall back on.
  it("propagates a real error status when GitHub fails and there is no cache to fall back on", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: { get: (key) => (key === "x-ratelimit-remaining" ? "0" : null) },
      json: async () => ({}),
      text: async () => "rate limited"
    }));

    const app = createApp();
    const res = await request(app).get("/api/v1/github/dashboard");

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/rate limit/i);
  });

  beforeEach(() => {
    mockGitHubResponses({
      profile: { login: "test-user", public_repos: 1, followers: 3 },
      repos: [
        {
          id: 1,
          name: "demo",
          full_name: "test-user/demo",
          language: "TypeScript",
          stargazers_count: 4,
          forks_count: 1
        }
      ],
      events: [
        {
          id: "e1",
          type: "PushEvent",
          repo: { name: "test-user/demo" },
          created_at: new Date().toISOString(),
          payload: { commits: [{ message: "Initial commit" }] }
        }
      ]
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns a processed dashboard payload on success", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/github/dashboard");

    expect(res.status).toBe(200);
    expect(res.body.stats.totalStars).toBe(4);
    expect(res.body.isCached).toBe(false);
    expect(res.body.fetchError).toBeNull();
  });

  it("serves from cache on a second request without calling fetch again", async () => {
    const app = createApp();

    await request(app).get("/api/v1/github/dashboard");

    const callCountAfterFirst = global.fetch.mock.calls.length;

    const res = await request(app).get("/api/v1/github/dashboard");

    expect(res.status).toBe(200);
    expect(res.body.isCached).toBe(true);
    expect(global.fetch.mock.calls.length).toBe(callCountAfterFirst);
  });

  it("falls back to the last cached payload when GitHub fails after a cache already exists", async () => {
    const app = createApp();

    // Prime the cache with a successful response first.
    await request(app).get("/api/v1/github/dashboard");

    // Now make GitHub fail and force a refresh.
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: { get: (key) => (key === "x-ratelimit-remaining" ? "0" : null) },
      json: async () => ({}),
      text: async () => "rate limited"
    }));

    const res = await request(app).get("/api/v1/github/dashboard?refresh=true");

    // Graceful degradation: still 200, but flagged as stale with the real error surfaced.
    expect(res.status).toBe(200);
    expect(res.body.isStale).toBe(true);
    expect(res.body.fetchError).toMatch(/rate limit/i);
  });
});
