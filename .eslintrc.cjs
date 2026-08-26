module.exports = {
  env: {
    node: true,
    browser: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "script"
  },
  extends: ["eslint:recommended"],
  overrides: [
    {
      files: ["vitest.config.js"],
      parserOptions: { sourceType: "module" }
    },
    {
      files: ["tests/**/*.js"],
      parserOptions: { sourceType: "module" },
      env: { node: true }
    },
    {
      /*
        app.js is split across multiple classic <script> tags that share
        one global scope by design (utils.js defines these, app.js and
        apiClient.js consume them) - this is the actual browser execution
        model, not a bug, so these are declared as known globals rather
        than "undefined variable" errors.
      */
      files: ["public/js/app.js"],
      globals: {
        fmt: "readonly",
        ease: "readonly",
        timeAgo: "readonly",
        formatDate: "readonly",
        escapeHTML: "readonly",
        escapeAttribute: "readonly",
        NexusAPI: "readonly"
      }
    }
  ],
  ignorePatterns: ["node_modules/", "coverage/"],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
  }
};
