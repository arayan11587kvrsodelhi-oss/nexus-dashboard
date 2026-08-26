import { describe, it, expect } from "vitest";
import {
  processGitHubData,
  safeArray,
  safeNumber,
  formatRepoName,
  getDateKey
} from "../../server/lib/githubDataProcessor.js";

describe("safeArray", () => {
  it("returns the array unchanged when given an array", () => {
    expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("returns an empty array for non-array input", () => {
    expect(safeArray(null)).toEqual([]);
    expect(safeArray(undefined)).toEqual([]);
    expect(safeArray("not an array")).toEqual([]);
  });
});

describe("safeNumber", () => {
  it("parses valid numeric input", () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber("17")).toBe(17);
  });

  it("falls back for invalid input", () => {
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber("not a number", 5)).toBe(5);
    expect(safeNumber(NaN, 9)).toBe(9);
  });
});

describe("formatRepoName", () => {
  it("strips the owner prefix", () => {
    expect(formatRepoName("aryan/nexus", "aryan")).toBe("nexus");
  });

  it("returns the name unchanged if there is no matching prefix", () => {
    expect(formatRepoName("someoneelse/repo", "aryan")).toBe("someoneelse/repo");
  });

  it("returns a fallback for empty input", () => {
    expect(formatRepoName("", "aryan")).toBe("repository");
    expect(formatRepoName(null, "aryan")).toBe("repository");
  });
});

describe("getDateKey", () => {
  it("returns a YYYY-MM-DD key for a valid date", () => {
    expect(getDateKey("2026-03-10T12:00:00Z")).toBe("2026-03-10");
  });

  it("returns null for invalid or missing input", () => {
    expect(getDateKey(null)).toBeNull();
    expect(getDateKey("not-a-date")).toBeNull();
  });
});

describe("processGitHubData", () => {
  const profile = {
    login: "aryan",
    public_repos: 2,
    followers: 12,
    following: 4,
    public_gists: 1
  };

  const repos = [
    {
      id: 1,
      name: "nexus",
      full_name: "aryan/nexus",
      description: "A dashboard",
      html_url: "https://github.com/aryan/nexus",
      language: "JavaScript",
      stargazers_count: 5,
      forks_count: 2,
      open_issues_count: 1,
      watchers_count: 5,
      size: 100,
      archived: false,
      fork: false,
      private: false,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      pushed_at: "2025-06-01T00:00:00Z",
      default_branch: "main",
      topics: ["dashboard"]
    },
    {
      id: 2,
      name: "old-lib",
      full_name: "aryan/old-lib",
      language: "Python",
      stargazers_count: 3,
      forks_count: 0,
      open_issues_count: 0,
      archived: true,
      fork: false
    }
  ];

  const events = [
    {
      id: "e1",
      type: "PushEvent",
      repo: { name: "aryan/nexus" },
      created_at: new Date().toISOString(),
      payload: { commits: [{ message: "Fix rendering bug" }] }
    },
    {
      id: "e2",
      type: "PullRequestEvent",
      repo: { name: "aryan/nexus" },
      created_at: new Date().toISOString(),
      payload: { action: "opened", number: 7, pull_request: { title: "Add feature" } }
    },
    {
      id: "e3",
      type: "IssuesEvent",
      repo: { name: "aryan/nexus" },
      created_at: new Date().toISOString(),
      payload: { action: "opened", issue: { number: 3, title: "Bug report" } }
    }
  ];

  it("computes language breakdown from real repo data", () => {
    const result = processGitHubData("aryan", profile, repos, events);

    expect(result.languages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "JavaScript", count: 1 }),
        expect.objectContaining({ name: "Python", count: 1 })
      ])
    );
  });

  it("computes repository-level stats correctly", () => {
    const result = processGitHubData("aryan", profile, repos, events);

    expect(result.stats.totalStars).toBe(8);
    expect(result.stats.totalForks).toBe(2);
    expect(result.stats.archivedRepos).toBe(1);
    expect(result.stats.publicRepos).toBe(2);
    expect(result.stats.followers).toBe(12);
  });

  it("never fabricates PR/issue counts beyond what events actually show", () => {
    const result = processGitHubData("aryan", profile, repos, events);

    // Exactly one PullRequestEvent and one IssuesEvent were provided.
    expect(result.stats.pullRequestEvents).toBe(1);
    expect(result.stats.issueEvents).toBe(1);
  });

  it("builds a human-readable activity feed with repo names stripped of the owner prefix", () => {
    const result = processGitHubData("aryan", profile, repos, events);

    const pushEntry = result.activityFeed.find((a) => a.type === "PushEvent");

    expect(pushEntry.repo).toBe("nexus");
    expect(pushEntry.title).toBe("Pushed 1 commit");
    expect(pushEntry.desc).toBe("Fix rendering bug");
  });

  it("handles missing/empty repos and events gracefully", () => {
    const result = processGitHubData("aryan", profile, null, undefined);

    expect(result.repos).toEqual([]);
    expect(result.languages).toEqual([]);
    expect(result.stats.totalStars).toBe(0);
    expect(result.activityFeed).toEqual([]);
  });

  it("always returns exactly 12 monthly labels", () => {
    const result = processGitHubData("aryan", profile, repos, events);
    expect(result.monthlyLabels).toHaveLength(12);
  });
});
