/* =========================================================
   NEXUS Dashboard - Build Smoke Check
   -----------------------------------------------------------
   There is no bundler in this project (deliberately - a
   single-owner dashboard doesn't need one, per the
   architecture cleanup scope). "Build" here means: verify the
   server boots cleanly end-to-end and the static frontend
   files it will serve actually exist, so CI catches a broken
   deploy before it ships.
   ========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_STATIC_FILES = [
  "public/index.html",
  "public/style.css",
  "public/js/utils.js",
  "public/js/apiClient.js",
  "public/js/app.js"
];

function checkStaticFiles() {
  const missing = REQUIRED_STATIC_FILES.filter(
    (relativePath) => !fs.existsSync(path.join(__dirname, "..", relativePath))
  );

  if (missing.length > 0) {
    throw new Error(`Missing required static files: ${missing.join(", ")}`);
  }

  console.log(`✓ All ${REQUIRED_STATIC_FILES.length} required static files present`);
}

async function checkServerBoots() {
  process.env.GITHUB_USERNAME = process.env.GITHUB_USERNAME || "build-check-user";
  process.env.PORT = "0"; // ask the OS for a free port
  process.env.NODE_ENV = "test";

  const { createApp } = require("../server/app");
  const app = createApp();

  await new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      console.log("✓ Express app boots and listens successfully");
      server.close(resolve);
    });

    server.on("error", reject);
  });
}

async function main() {
  checkStaticFiles();
  await checkServerBoots();
  console.log("\nBuild check passed.");
}

main().catch((err) => {
  console.error("Build check failed:", err.message);
  process.exit(1);
});
