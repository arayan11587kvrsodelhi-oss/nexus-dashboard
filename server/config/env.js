/* =========================================================
   NEXUS Dashboard - Environment Configuration
   -----------------------------------------------------------
   Single source of truth for env vars. Fails fast on missing
   required config; warns (but still runs) on missing optional
   config that only degrades functionality (GITHUB_TOKEN).
   ========================================================= */

"use strict";

require("dotenv").config();

const { logger } = require("../utils/logger");

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toInt(process.env.PORT, 8130),

  GITHUB_USERNAME: process.env.GITHUB_USERNAME || "",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  GITHUB_API_BASE_URL: process.env.GITHUB_API_BASE_URL || "https://api.github.com",

  GITHUB_CACHE_TTL_MS: toInt(process.env.GITHUB_CACHE_TTL_MS, 5 * 60 * 1000),

  REFRESH_RATE_LIMIT_WINDOW_MS: toInt(process.env.REFRESH_RATE_LIMIT_WINDOW_MS, 30 * 1000),
  REFRESH_RATE_LIMIT_MAX: toInt(process.env.REFRESH_RATE_LIMIT_MAX, 1),

  LOG_LEVEL: process.env.LOG_LEVEL || "info"
};

function validateEnv() {
  const errors = [];

  if (!env.GITHUB_USERNAME) {
    errors.push("GITHUB_USERNAME is required (the GitHub account this dashboard displays).");
  }

  if (errors.length > 0) {
    logger.error("Invalid environment configuration", { errors });
    throw new Error(
      `Invalid environment configuration:\n - ${errors.join("\n - ")}\n` +
      "Copy .env.example to .env and fill in the required values."
    );
  }

  if (!env.GITHUB_TOKEN) {
    logger.warn(
      "GITHUB_TOKEN is not set. Running against the GitHub API unauthenticated " +
      "(60 requests/hour limit shared across ALL visitors' IPs). " +
      "Set GITHUB_TOKEN in .env to raise this to 5,000 requests/hour."
    );
  }
}

module.exports = { env, validateEnv };
