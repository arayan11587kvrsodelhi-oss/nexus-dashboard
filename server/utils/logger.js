/* =========================================================
   NEXUS Dashboard - Structured Logger
   -----------------------------------------------------------
   Deliberately dependency-free: a small structured JSON logger
   over console.*. This keeps the "boring, reliable technology"
   principle - a single-owner project does not need a full
   logging stack (Winston/Pino) to get structured, greppable
   logs with levels and request IDs. Swap this module for a
   real provider (e.g. Pino) later without touching call sites,
   since every call site just does logger.info(...) etc.
   ========================================================= */

"use strict";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const configuredLevel = LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

function write(level, message, meta = {}) {
  if (LEVELS[level] > configuredLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const logger = {
  error: (message, meta) => write("error", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  info: (message, meta) => write("info", message, meta),
  debug: (message, meta) => write("debug", message, meta)
};

module.exports = { logger };
