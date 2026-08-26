/* =========================================================
   NEXUS Dashboard - Entrypoint
   ========================================================= */

"use strict";

const { env, validateEnv } = require("./config/env");
const { logger } = require("./utils/logger");
const { createApp } = require("./app");

validateEnv();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info("NEXUS Dashboard server started", {
    port: env.PORT,
    env: env.NODE_ENV,
    url: `http://localhost:${env.PORT}`
  });
});

function shutdown(signal) {
  logger.info("Shutting down", { signal });

  server.close(() => {
    logger.info("Server closed cleanly");
    process.exit(0);
  });

  // Force-exit if connections don't close within 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: String(reason) });
});
