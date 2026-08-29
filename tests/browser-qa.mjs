export default async function run(page) {
  const results = {
    viewportsTested: [],
    overflowChecks: [],
    responsiveComponentChecks: [],
    modalsTested: [],
    dropdownsTested: [],
    mobileDrawerTested: null,
    themeSwitch: false,
    filterAndSort: false,
    dataIntegrity: null,
    consoleErrors: []
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.consoleErrors.push(msg.text());
    }
  });

  const viewports = [
    { name: "375px (iPhone SE)", width: 375, height: 667 },
    { name: "390px (iPhone 12/13/14 Pro)", width: 390, height: 844 },
    { name: "414px (iPhone Plus)", width: 414, height: 896 },
    { name: "768px (iPad Portrait)", width: 768, height: 1024 },
    { name: "1024px (iPad Landscape)", width: 1024, height: 768 },
    { name: "1280px (Laptop)", width: 1280, height: 800 },
    { name: "1440px (Desktop)", width: 1440, height: 900 },
    { name: "1920px (FHD Ultrawide)", width: 1920, height: 1080 }
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(100);

    const vpMetrics = await page.evaluate(() => {
      const docEl = document.documentElement;
      const hasPageHorizontalScroll =
        docEl.scrollWidth > window.innerWidth || window.scrollX > 0;

      const heroAvatarRect = document.querySelector("#heroAvatar")?.getBoundingClientRect();
      const donutWrapRect = document.querySelector(".lang-donut-wrap")?.getBoundingClientRect();
      const chartWrapRect = document.querySelector(".chart-wrap")?.getBoundingClientRect();

      const projectsGrid = document.querySelector("#projectsGrid");
      let projectGridColumns = 1;
      if (projectsGrid) {
        const style = window.getComputedStyle(projectsGrid);
        projectGridColumns = style.gridTemplateColumns.split(" ").length;
      }

      return {
        hasPageHorizontalScroll,
        docScrollWidth: docEl.scrollWidth,
        windowWidth: window.innerWidth,
        heroAvatarWidth: Math.round(heroAvatarRect?.width || 0),
        heroAvatarHeight: Math.round(heroAvatarRect?.height || 0),
        donutWidth: Math.round(donutWrapRect?.width || 0),
        donutHeight: Math.round(donutWrapRect?.height || 0),
        chartHeight: Math.round(chartWrapRect?.height || 0),
        projectGridColumns
      };
    });

    results.viewportsTested.push(`${vp.name}: ${vp.width}x${vp.height}`);
    results.overflowChecks.push({
      viewport: vp.name,
      width: vp.width,
      pageOverflow: vpMetrics.hasPageHorizontalScroll,
      docScrollWidth: vpMetrics.docScrollWidth,
      windowWidth: vpMetrics.windowWidth
    });

    results.responsiveComponentChecks.push({
      viewport: vp.name,
      heroAvatarSize: `${vpMetrics.heroAvatarWidth}x${vpMetrics.heroAvatarHeight}`,
      donutSize: `${vpMetrics.donutWidth}x${vpMetrics.donutHeight}`,
      chartHeight: vpMetrics.chartHeight,
      projectGridColumns: vpMetrics.projectGridColumns
    });
  }

  // Mobile drawer test at 375px
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(150);
  await page.click("#menuBtn");
  const drawerOpen = await page.evaluate(() => document.body.classList.contains("sidebar-open"));
  await page.keyboard.press("Escape");
  const drawerClosed = await page.evaluate(() => !document.body.classList.contains("sidebar-open"));
  results.mobileDrawerTested = { opened: drawerOpen, closedOnEsc: drawerClosed };

  // Reset to desktop viewport for interactive feature testing
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);

  // 1. Theme toggle test
  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("#themeToggle");
  const toggledTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  results.themeSwitch = (initialTheme !== toggledTheme);

  // 2. Settings modal test
  await page.click("#navSettingsBtn");
  const settingsVisible = await page.evaluate(() => !document.querySelector("#settingsModal").hidden);
  await page.keyboard.press("Escape");
  const settingsClosed = await page.evaluate(() => document.querySelector("#settingsModal").hidden);
  results.modalsTested.push({ name: "SettingsModal", opened: settingsVisible, closedOnEsc: settingsClosed });

  // 3. Help modal test
  await page.click("#navHelpBtn");
  const helpVisible = await page.evaluate(() => !document.querySelector("#helpModal").hidden);
  await page.keyboard.press("Escape");
  const helpClosed = await page.evaluate(() => document.querySelector("#helpModal").hidden);
  results.modalsTested.push({ name: "HelpModal", opened: helpVisible, closedOnEsc: helpClosed });

  // 4. Notification dropdown test
  await page.click("#notifBtn");
  const notifOpen = await page.evaluate(() => !document.querySelector("#notifDropdown").hidden);
  await page.click("body");
  const notifClosed = await page.evaluate(() => document.querySelector("#notifDropdown").hidden);
  results.dropdownsTested.push({ name: "NotifDropdown", opened: notifOpen, closedOnOutsideClick: notifClosed });

  // 5. Profile dropdown test
  await page.click("#profileBtn");
  const profileOpen = await page.evaluate(() => !document.querySelector("#profileDropdown").hidden);
  await page.click("body");
  const profileClosed = await page.evaluate(() => document.querySelector("#profileDropdown").hidden);
  results.dropdownsTested.push({ name: "ProfileDropdown", opened: profileOpen, closedOnOutsideClick: profileClosed });

  // 6. Project sort and search test
  await page.fill("#projectSearch", "test");
  await page.selectOption("#projectSort", "stars");
  results.filterAndSort = true;

  // 7. Data integrity verification (ensure real GitHub data populated the DOM)
  await page.fill("#projectSearch", "");
  await page.waitForTimeout(400);

  const dataIntegrity = await page.evaluate(() => {
    const reposCount = Number(document.querySelector("#statRepos")?.textContent?.replace(/,/g, "") || 0);
    const renderedProjectCards = document.querySelectorAll("#projectsGrid .project-card").length;
    const timelineItems = document.querySelectorAll("#timeline .timeline-item").length;
    const liveState = document.querySelector("#liveStatusPill")?.dataset?.state;
    const username = document.querySelector("#welcomeUsername")?.textContent?.trim();
    const donutSegments = document.querySelectorAll("#langDonutSegments .lang-donut-segment").length;
    const footnoteIconRect = document.querySelector(".panel__foot-note svg")?.getBoundingClientRect();

    return {
      reposCount,
      renderedProjectCards,
      timelineItems,
      liveState,
      username,
      donutSegments,
      footnoteIconWidth: footnoteIconRect?.width || 0
    };
  });

  results.dataIntegrity = dataIntegrity;

  return results;
}
