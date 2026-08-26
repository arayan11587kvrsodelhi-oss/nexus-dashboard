/* =========================================================
   NEXUS Dashboard - Request Logging Middleware
   -----------------------------------------------------------
   Attaches a request ID to every request/response (for
   correlating logs) and logs method, path, status, and
   latency for every request - the "API latency measurement"
   and "request IDs" observability items from the audit.
   ========================================================= */

"use strict";

const crypto = require("crypto");
const { logger } = require("../utils/logger");

function requestLogger(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    logger.info("request completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100
    });
  });

  next();
}

module.exports = { requestLogger };
