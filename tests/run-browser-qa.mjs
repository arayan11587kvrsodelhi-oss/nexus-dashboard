import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.PORT = "0";
process.env.NODE_ENV = "test";
process.env.GITHUB_USERNAME = "arayan11587kvrsodelhi-oss";

const { createApp } = await import("../server/app.js");
const app = createApp();

const server = app.listen(0, async () => {
  const port = server.address().port;
  const url = `http://localhost:${port}/`;
  console.log(`Test server running at ${url}`);

  const browserMjsPath = "C:\\Users\\sharm\\.codegpt\\skills\\browser-automation\\browser.mjs";
  const scriptPath = path.resolve(__dirname, "browser-qa.mjs");

  const proc = spawn("node", [browserMjsPath, url, "--script", scriptPath], {
    stdio: "inherit",
    shell: true
  });

  proc.on("close", (code) => {
    server.close(() => {
      console.log(`Browser QA completed with exit code ${code}`);
      process.exit(code || 0);
    });
  });

  proc.on("error", (err) => {
    console.error("Browser QA failed to start:", err);
    server.close(() => process.exit(1));
  });
});
