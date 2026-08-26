/* =========================================================
   NEXUS Dashboard - GitHub Routes
   -----------------------------------------------------------
   The only data route the frontend needs. The GitHub token
   (if configured) never leaves this server - the browser only
   ever talks to our own /api/v1/github/dashboard endpoint.
   ========================================================= */

"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { getDashboard } = require("../services/githubService");
const { asyncHandler } = require("../middleware/errorHandler");
const { env } = require("../config/env");

const router = express.Router();

/*
  Manual "force refresh" is rate-limited on its own, separate from
  general API traffic, so a visitor mashing the refresh button can't
  burn through the GitHub rate limit or hammer this server with live
  upstream calls.
*/
const refreshLimiter = rateLimit({
  windowMs: env.REFRESH_RATE_LIMIT_WINDOW_MS,
  max: env.REFRESH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many manual refreshes. Please wait a moment before trying again."
    }
  }
});

router.get(
  "/github/dashboard",
  (req, res, next) => {
    // Only rate-limit the expensive "force a live GitHub call" path.
    if (req.query.refresh === "true") {
      return refreshLimiter(req, res, next);
    }
    next();
  },
  asyncHandler(async (req, res) => {
    const forceRefresh = req.query.refresh === "true";
    const data = await getDashboard(forceRefresh);
    res.json(data);
  })
);

module.exports = router;
