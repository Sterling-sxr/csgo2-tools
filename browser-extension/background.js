const DEFAULT_DASHBOARD_URL = "http://localhost:3000/";

async function getDashboardUrl() {
  const settings = await chrome.storage.sync.get("dashboardUrl");
  return settings.dashboardUrl || DEFAULT_DASHBOARD_URL;
}

async function openDetectedMatch(matchId) {
  const dashboardUrl = new URL(await getDashboardUrl());
  dashboardUrl.searchParams.set("match", matchId);
  dashboardUrl.searchParams.set("source", "faceit-extension");

  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((tab) => {
    if (!tab.url) return false;

    try {
      const tabUrl = new URL(tab.url);
      return (
        tabUrl.origin === dashboardUrl.origin &&
        tabUrl.pathname === dashboardUrl.pathname
      );
    } catch {
      return false;
    }
  });

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, {
      active: true,
      url: dashboardUrl.toString(),
    });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ active: true, url: dashboardUrl.toString() });
}

chrome.runtime.onMessage.addListener((message) => {
  if (
    message?.type !== "FACEIT_MATCHROOM_DETECTED" ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(message.matchId)
  ) {
    return;
  }

  void openDetectedMatch(message.matchId);
});
