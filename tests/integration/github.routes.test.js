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
  it("returns 200 and a healthy status", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.service).toBe("nexus-dashboard");
  });
});

describe("GET /api/ping", () => {
  it("returns 200 and pong: true", async () => {
    const app = createApp();
    const res = await request(app).get("/api/ping");

    expect(res.status).toBe(200);
    expect(res.body.pong).toBe(true);
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

  it("handles GitHub 404 user not found with proper message when cache is refreshed", async () => {
    const app = createApp();
    await request(app).get("/api/v1/github/dashboard").set("X-Forwarded-For", "192.168.1.101");

    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: { get: () => null },
      json: async () => ({ message: "Not Found" }),
      text: async () => "Not Found"
    }));

    const res = await request(app)
      .get("/api/v1/github/dashboard?refresh=true")
      .set("X-Forwarded-For", "192.168.1.101");

    expect(res.status).toBe(200);
    expect(res.body.isStale).toBe(true);
    expect(res.body.fetchError).toMatch(/could not be found|not found/i);
  });

  it("handles GitHub 401 unauthorized gracefully when cache is refreshed", async () => {
    const app = createApp();
    await request(app).get("/api/v1/github/dashboard").set("X-Forwarded-For", "192.168.1.102");

    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: { get: () => null },
      json: async () => ({ message: "Bad credentials" }),
      text: async () => "Bad credentials"
    }));

    const res = await request(app)
      .get("/api/v1/github/dashboard?refresh=true")
      .set("X-Forwarded-For", "192.168.1.102");

    expect(res.status).toBe(200);
    expect(res.body.isStale).toBe(true);
    expect(res.body.fetchError).toMatch(/unauthorized|credentials|token/i);
  });

  it("rate limits rapid manual refresh requests", async () => {
    const app = createApp();
    const testIp = "192.168.1.200";

    // Exhaust the refresh limiter
    for (let i = 0; i < 5; i++) {
      await request(app)
        .get("/api/v1/github/dashboard?refresh=true")
        .set("X-Forwarded-For", testIp);
    }

    const res = await request(app)
      .get("/api/v1/github/dashboard?refresh=true")
      .set("X-Forwarded-For", testIp);

    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/too many manual refreshes/i);
  });
});

describe("Security Headers & Unknown Routes", () => {
  it("includes Content-Security-Policy and standard security headers", async () => {
    const app = createApp();
    const res = await request(app).get("/api/ping");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  it("returns 404 JSON for unknown API routes", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/nonexistent-route");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toMatch(/not found/i);
  });
});
