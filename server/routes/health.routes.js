/* =========================================================
   NEXUS Dashboard - Health & Readiness Routes
   ========================================================= */

"use strict";

const express = require("express");
const { getStatus, checkGitHubHealth } = require("../services/githubService");
const { env } = require("../config/env");

const router = express.Router();

/**
 * GET /api/v1/health & GET /api/health
 * Comprehensive production health status endpoint.
 */
router.get("/health", async (req, res) => {
  const cacheStatus = getStatus();
  const githubHealth = await checkGitHubHealth();

  const isHealthy = githubHealth.status === "healthy" || githubHealth.status === "degraded" || cacheStatus.hasCachedData;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    service: "nexus-dashboard",
    version: "2.2.0",
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    cache: {
      status: "healthy",
      hasCachedData: cacheStatus.hasCachedData,
      cacheAgeMs: cacheStatus.cacheAgeMs
    },
    github: {
      status: githubHealth.status,
      username: env.GITHUB_USERNAME,
      tokenConfigured: githubHealth.tokenConfigured,
      latencyMs: githubHealth.latencyMs
    }
  });
});

/**
 * GET /api/v1/ping & GET /api/ping
 * Fast lightweight liveness check.
 */
router.get("/ping", (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

/**
 * GET /api/v1/ready & GET /api/ready
 * Readiness: is the app configured and ready to serve requests.
 */
router.get("/ready", (req, res) => {
  const status = getStatus();
  const ready = Boolean(env.GITHUB_USERNAME);

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    githubUsernameConfigured: Boolean(env.GITHUB_USERNAME),
    githubTokenConfigured: status.githubTokenConfigured,
    hasCachedData: status.hasCachedData,
    cacheAgeMs: status.cacheAgeMs,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
