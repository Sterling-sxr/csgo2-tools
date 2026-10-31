const DEFAULT_DASHBOARD_URL = "http://localhost:3000/";
const form = document.querySelector("#settings-form");
const input = document.querySelector("#dashboard-url");
const status = document.querySelector("#status");

async function loadSettings() {
  const settings = await chrome.storage.sync.get("dashboardUrl");
  input.value = settings.dashboardUrl || DEFAULT_DASHBOARD_URL;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const dashboardUrl = new URL(input.value);
  await chrome.storage.sync.set({ dashboardUrl: dashboardUrl.toString() });
  status.textContent = "Saved.";
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
});

void loadSettings();
