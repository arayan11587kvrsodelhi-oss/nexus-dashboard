/* =========================================================
   NEXUS Dashboard - Centralized Error Handler
   -----------------------------------------------------------
   Every route forwards errors here via next(err) (or async
   errors are caught by asyncHandler below). Ensures a
   consistent JSON error shape and prevents stack traces from
   leaking to the client in production.
   ========================================================= */

"use strict";

const { logger } = require("../utils/logger");

/**
 * Wrap an async route handler so thrown/rejected errors are
 * forwarded to Express's error-handling middleware instead of
 * crashing the process or hanging the request.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;

  logger.error("request error", {
    requestId: req.requestId,
    path: req.originalUrl,
    status,
    message: err?.message
  });

  const isProd = process.env.NODE_ENV === "production";

  res.status(status).json({
    error: {
      message: err?.message || "Internal server error.",
      requestId: req.requestId,
      ...(isProd ? {} : { stack: err?.stack })
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Not found: ${req.method} ${req.originalUrl}`,
      requestId: req.requestId
    }
  });
}

module.exports = { asyncHandler, errorHandler, notFoundHandler };
