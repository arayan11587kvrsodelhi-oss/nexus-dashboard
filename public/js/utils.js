/* =========================================================
   NEXUS Dashboard - Pure Utility Functions
   -----------------------------------------------------------
   Stateless, DOM-free helpers extracted from the main
   dashboard script so they can be unit tested directly and
   reused. No behavior change from the original inline
   versions - this is purely a testability seam.

   Works both as a plain browser <script> (exposes globals)
   and as a CommonJS module (for the test suite).
========================================================= */

(function (root, factory) {
  const exportsObj = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObj;
  }

  if (root) {
    Object.assign(root, exportsObj);
  }
})(typeof window !== "undefined" ? window : undefined, function () {
  "use strict";

  const fmt = (v) => new Intl.NumberFormat("en-US").format(Number(v) || 0);

  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function timeAgo(dateInput) {
    if (!dateInput) return "Recently";

    const date =
      typeof dateInput === "string" || typeof dateInput === "number"
        ? new Date(dateInput)
        : dateInput;

    if (isNaN(date.getTime())) return "Recently";

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);

    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);

    if (months < 12) return `${months}mo ago`;

    const years = Math.floor(months / 12);

    return `${years}y ago`;
  }

  function formatDate(dateInput) {
    if (!dateInput) return "";

    const d = new Date(dateInput);

    if (isNaN(d.getTime())) return "";

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  return { fmt, ease, timeAgo, formatDate, escapeHTML, escapeAttribute };
});
