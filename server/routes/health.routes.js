/* =========================================================
   NEXUS Dashboard - Health & Readiness Routes
   ========================================================= */

"use strict";

const express = require("express");
const { getStatus } = require("../services/githubService");
const { env } = require("../config/env");

const router = express.Router();

/**
 * GET /api/v1/health
 * Liveness: is the process up and responding at all.
 */
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/ready
 * Readiness: is the app actually configured and able to serve
 * real dashboard data (has config, has cached or reachable data).
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
