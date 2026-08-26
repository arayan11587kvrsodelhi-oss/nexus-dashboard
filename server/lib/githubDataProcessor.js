/* =========================================================
   NEXUS Dashboard - GitHub Data Processor
   -----------------------------------------------------------
   Ported from the original client-side `github-api.js`.
   This module is pure/framework-free and unit-testable:
   given raw GitHub API responses, it derives the shaped
   dashboard payload (languages, stats, activity feed,
   contribution map, monthly series, repo summaries).

   It intentionally does NOT perform any network calls or
   caching itself - see `services/githubService.js` for that.
   ========================================================= */

"use strict";

/* =========================================================
   HELPERS
   ========================================================= */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function formatRepoName(repoName, username) {
  if (!repoName) return "repository";

  const prefix = `${username}/`;

  return repoName.startsWith(prefix)
    ? repoName.slice(prefix.length)
    : repoName;
}

function getDateKey(date) {
  if (!date) return null;

  try {
    return new Date(date).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function getMonthDifference(dateA, dateB) {
  return (
    (dateA.getFullYear() - dateB.getFullYear()) * 12 +
    (dateA.getMonth() - dateB.getMonth())
  );
}

function capitalize(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* =========================================================
   PROCESS DATA

   NOTE ON DATA HONESTY (see architecture audit):
   GitHub's public Events API only exposes a rolling window of
   recent activity, NOT a full one-year contribution history
   and NOT lifetime PR/issue counts. Every field derived from
   `events` below is explicitly a "recent activity" metric.
   We never fabricate or estimate numbers GitHub does not
   actually provide.
   ========================================================= */

function processGitHubData(username, profile, repos, events) {

    repos = safeArray(repos);
    events = safeArray(events);


    /* =====================================================
       1. LANGUAGE BREAKDOWN
       ===================================================== */

    const languageCounts = {};

    let totalLanguageRepos = 0;


    repos.forEach(repo => {

      if (!repo || !repo.language) {
        return;
      }

      const language = repo.language;

      languageCounts[language] =
        (languageCounts[language] || 0) + 1;

      totalLanguageRepos++;
    });


    const languages = Object.entries(languageCounts)

      .map(([name, count]) => ({

        name,

        count,

        percent: Math.round(
          (count / (totalLanguageRepos || 1)) * 100
        )

      }))

      .sort((a, b) => b.count - a.count);


    /* =====================================================
       2. REPOSITORY STATISTICS
       ===================================================== */

    const totalStars = repos.reduce(
      (total, repo) =>
        total + safeNumber(repo?.stargazers_count),
      0
    );


    const totalForks = repos.reduce(
      (total, repo) =>
        total + safeNumber(repo?.forks_count),
      0
    );


    const openIssues = repos.reduce(
      (total, repo) =>
        total + safeNumber(repo?.open_issues_count),
      0
    );


    const archivedRepos = repos.filter(
      repo => repo?.archived
    ).length;


    const forkedRepos = repos.filter(
      repo => repo?.fork
    ).length;


    /* =====================================================
       3. ACTIVITY TIMELINE
       ===================================================== */

    const activityFeed = events

      .filter(event => event)

      .map(event => {

        let title = "GitHub Activity";

        let description = "";

        let icon = "git";

        let color = "cyan";


        const repoName =
          formatRepoName(event?.repo?.name, username);


        switch (event?.type) {

          /* -----------------------------------------------
             Push
             ----------------------------------------------- */

          case "PushEvent": {

            const commitCount =
              safeNumber(
                event?.payload?.commits?.length,
                safeNumber(event?.payload?.size, 1)
              );


            title =
              `Pushed ${commitCount} commit` +
              `${commitCount === 1 ? "" : "s"}`;


            const firstCommit =
              event?.payload?.commits?.[0];


            description =
              firstCommit?.message ||
              `Updated code in ${repoName}`;


            icon = "push";

            color = "cyan";

            break;
          }


          /* -----------------------------------------------
             Create
             ----------------------------------------------- */

          case "CreateEvent":

            title =
              `Created ${event?.payload?.ref_type || "item"}`;


            description =
              event?.payload?.description ||
              event?.payload?.ref ||
              repoName;


            icon = "check";

            color = "green";

            break;


          /* -----------------------------------------------
             Delete
             ----------------------------------------------- */

          case "DeleteEvent":

            title =
              `Deleted ${event?.payload?.ref_type || "item"}`;


            description =
              event?.payload?.ref ||
              `Deleted something in ${repoName}`;


            icon = "bolt";

            color = "amber";

            break;


          /* -----------------------------------------------
             Watch / Star
             ----------------------------------------------- */

          case "WatchEvent":

            title = "Starred repository";


            description =
              `Starred ${repoName}`;


            icon = "star";

            color = "amber";

            break;


          /* -----------------------------------------------
             Fork
             ----------------------------------------------- */

          case "ForkEvent":

            title = "Forked repository";


            description =
              `Forked ${repoName}`;


            icon = "git";

            color = "purple";

            break;


          /* -----------------------------------------------
             Pull Request
             ----------------------------------------------- */

          case "PullRequestEvent": {

            const action =
              event?.payload?.action || "updated";


            const number =
              event?.payload?.number;


            title =
              `${capitalize(action)} PR` +
              `${number ? ` #${number}` : ""}`;


            description =
              event?.payload?.pull_request?.title ||
              `Pull request in ${repoName}`;


            icon = "pr";

            color = "purple";

            break;
          }


          /* -----------------------------------------------
             Issues
             ----------------------------------------------- */

          case "IssuesEvent": {

            const action =
              event?.payload?.action || "updated";


            const issueNumber =
              event?.payload?.issue?.number;


            title =
              `${capitalize(action)} issue` +
              `${issueNumber ? ` #${issueNumber}` : ""}`;


            description =
              event?.payload?.issue?.title ||
              `Issue in ${repoName}`;


            icon = "comment";

            color = "amber";

            break;
          }


          /* -----------------------------------------------
             Issue comment
             ----------------------------------------------- */

          case "IssueCommentEvent":

            title = "Commented on issue";


            description =
              event?.payload?.issue?.title ||
              `Commented in ${repoName}`;


            icon = "comment";

            color = "amber";

            break;


          /* -----------------------------------------------
             Release
             ----------------------------------------------- */

          case "ReleaseEvent":

            title =
              `${capitalize(
                event?.payload?.action || "updated"
              )} release`;


            description =
              event?.payload?.release?.name ||
              event?.payload?.release?.tag_name ||
              `Release in ${repoName}`;


            icon = "star";

            color = "green";

            break;


          /* -----------------------------------------------
             Pull Request Review
             ----------------------------------------------- */

          case "PullRequestReviewEvent":

            title = "Reviewed pull request";


            description =
              event?.payload?.pull_request?.title ||
              `Reviewed a pull request in ${repoName}`;


            icon = "check";

            color = "purple";

            break;


          /* -----------------------------------------------
             Default
             ----------------------------------------------- */

          default:

            title =
              event?.type
                ? event.type.replace(/Event$/, "")
                : "Activity";


            description =
              `Activity in ${repoName}`;


            icon = "bolt";

            color = "cyan";
        }


        return {

          id:
            event?.id ||
            `${event?.type}-${event?.created_at}-${repoName}`,

          type:
            event?.type || "UnknownEvent",

          title,

          desc: description,

          repo: repoName,

          repoUrl:
            event?.repo?.name
              ? `https://github.com/${event.repo.name}`
              : `https://github.com/${username}`,

          time:
            event?.created_at || new Date().toISOString(),

          icon,

          color
        };
      });


    /* =====================================================
       4. RECENT ACTIVITY MAP
       
       This is deliberately based on GitHub events only.
       We do NOT count repo updated_at/pushed_at as fake
       contributions.
       ===================================================== */

    const contributionMap = {};


    events.forEach(event => {

      const dateKey =
        getDateKey(event?.created_at);


      if (!dateKey) {
        return;
      }


      let weight = 1;


      if (event?.type === "PushEvent") {

        weight =
          Math.max(
            1,
            safeNumber(
              event?.payload?.commits?.length,
              safeNumber(event?.payload?.size, 1)
            )
          );
      }


      contributionMap[dateKey] =
        (contributionMap[dateKey] || 0) +
        weight;
    });


    /* =====================================================
       5. RECENT CONTRIBUTION TOTAL
       
       This is NOT a one-year GitHub contribution count.
       It represents activity available through Events API.
       ===================================================== */

    const recentContributionTotal =
      Object.values(contributionMap).reduce(
        (total, value) => total + value,
        0
      );


    /* =====================================================
       6. MONTHLY ACTIVITY
       
       GitHub Events API provides recent events only.
       monthlyUpdates therefore represents available
       recent push activity, not guaranteed 12-month data.
       ===================================================== */

    const monthlyUpdates =
      new Array(12).fill(0);


    const monthlyCommits =
      new Array(12).fill(0);


    const monthlyPullRequests =
      new Array(12).fill(0);


    const monthlyIssues =
      new Array(12).fill(0);


    const now = new Date();


    events.forEach(event => {

      if (!event?.created_at) {
        return;
      }


      const date =
        new Date(event.created_at);


      if (Number.isNaN(date.getTime())) {
        return;
      }


      const diffMonths =
        getMonthDifference(now, date);


      if (
        diffMonths < 0 ||
        diffMonths >= 12
      ) {
        return;
      }


      const index =
        11 - diffMonths;


      /* Push activity */

      if (event.type === "PushEvent") {

        const commits =
          Math.max(
            1,
            safeNumber(
              event?.payload?.commits?.length,
              safeNumber(event?.payload?.size, 1)
            )
          );


        monthlyUpdates[index] += commits;

        monthlyCommits[index] += commits;
      }


      /* Pull requests */

      if (event.type === "PullRequestEvent") {

        monthlyPullRequests[index] += 1;
      }


      /* Issues */

      if (event.type === "IssuesEvent") {

        monthlyIssues[index] += 1;
      }
    });


    /* =====================================================
       7. MONTH LABELS
       ===================================================== */

    const monthlyLabels = [];


    for (let i = 11; i >= 0; i--) {

      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );


      monthlyLabels.push(
        date.toLocaleDateString("en-US", {
          month: "short"
        })
      );
    }


    /* =====================================================
       8. REPOSITORY SUMMARY
       ===================================================== */

    const repositorySummary = repos.map(repo => ({

      id: repo?.id,

      name: repo?.name || "Untitled",

      fullName:
        repo?.full_name ||
        `${username}/${repo?.name || ""}`,

      description:
        repo?.description ||
        "No description provided.",

      htmlUrl:
        repo?.html_url ||
        `https://github.com/${username}/${repo?.name || ""}`,

      homepage:
        repo?.homepage || "",

      language:
        repo?.language || "Other",

      stars:
        safeNumber(repo?.stargazers_count),

      forks:
        safeNumber(repo?.forks_count),

      issues:
        safeNumber(repo?.open_issues_count),

      watchers:
        safeNumber(repo?.watchers_count),

      size:
        safeNumber(repo?.size),

      archived:
        Boolean(repo?.archived),

      fork:
        Boolean(repo?.fork),

      private:
        Boolean(repo?.private),

      createdAt:
        repo?.created_at || null,

      updatedAt:
        repo?.updated_at || null,

      pushedAt:
        repo?.pushed_at || null,

      defaultBranch:
        repo?.default_branch || "main",

      topics:
        Array.isArray(repo?.topics)
          ? repo.topics
          : []

    }));


    /* =====================================================
       9. FINAL STATS
       ===================================================== */

    const stats = {

      publicRepos:
        safeNumber(
          profile?.public_repos,
          repos.length
        ),

      followers:
        safeNumber(profile?.followers),

      following:
        safeNumber(profile?.following),

      publicGists:
        safeNumber(profile?.public_gists),

      totalStars,

      totalForks,

      openIssues,

      archivedRepos,

      forkedRepos,

      recentContributionTotal,

      recentEventCount:
        events.length,

      pushEvents:
        events.filter(
          event => event?.type === "PushEvent"
        ).length,

      pullRequestEvents:
        events.filter(
          event => event?.type === "PullRequestEvent"
        ).length,

      issueEvents:
        events.filter(
          event => event?.type === "IssuesEvent"
        ).length
    };


    /* =====================================================
       RETURN
       ===================================================== */

    return {

      profile,

      repos,

      repositorySummary,

      events,

      activityFeed,

      languages,

      contributionMap,

      monthlyUpdates,

      monthlyCommits,

      monthlyPullRequests,

      monthlyIssues,

      monthlyLabels,

      stats,

      fetchedAt: Date.now(),

      isCached: false,

      fetchError: null
    };
}

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  processGitHubData,
  safeArray,
  safeNumber,
  formatRepoName,
  getDateKey,
  getMonthDifference,
  capitalize
};
