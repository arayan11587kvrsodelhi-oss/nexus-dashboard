/* =========================================================
   NEXUS Dashboard - Express App
   -----------------------------------------------------------
   Replaces the old raw-http `serve.js`. This file only builds
   and exports the app (no listen()) so it can be imported by
   both server/index.js and the test suite (supertest).
   ========================================================= */

"use strict";

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const healthRoutes = require("./routes/health.routes");
const githubRoutes = require("./routes/github.routes");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

function createApp() {
  const app = express();

  // Render runs behind a reverse proxy (X-Forwarded-For).
  // Express must trust the 1st hop proxy so express-rate-limit and req.ip work accurately.
  app.set("trust proxy", 1);

  // Security headers (CSP, X-Content-Type-Options, etc.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'"]
        }
      }
    })
  );

  app.disable("x-powered-by");

  app.use(requestLogger);

  // General API rate limiting - basic abuse protection (audit P2).
  app.use(
    "/api/",
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(express.json());

  // ----- API routes -----
  app.use("/api", healthRoutes);
  app.use("/api/v1", healthRoutes);
  app.use("/api/v1", githubRoutes);

  // ----- Static frontend -----
  // Long cache for hashed/static assets; short cache for index.html so
  // deploys are picked up without needing a hard refresh. This directly
  // fixes the old serve.js behavior of sending
  // "Cache-Control: no-cache, no-store, must-revalidate" for EVERYTHING.
  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      cacheControl: false, // we set Cache-Control ourselves below, deliberately
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      }
    })
  );

  app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"), {
      cacheControl: false,
      headers: { "Cache-Control": "no-cache" }
    });
  });

  // API 404s get JSON; anything else falls through to Express's default.
  app.use("/api", notFoundHandler);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
