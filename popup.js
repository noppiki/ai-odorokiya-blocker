const DEFAULTS = {
  enabled: true,
  threshold: 60,
  mode: "collapse",
  accountScores: {}
};

const $ = (id) => document.getElementById(id);

function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
}

function setSettings(values) {
  return new Promise((resolve) => chrome.storage.sync.set(values, resolve));
}

function flash(message) {
  $("status").textContent = message;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => ($("status").textContent = ""), 1400);
}

async function refresh() {
  const settings = await getSettings();
  $("enabled").checked = settings.enabled;
  $("threshold").value = settings.threshold;
  $("thresholdValue").textContent = settings.threshold;
  $("mode").value = settings.mode;
  $("learnedCount").textContent = Object.keys(settings.accountScores || {}).length;
}

$("enabled").addEventListener("change", async (event) => {
  await setSettings({ enabled: event.target.checked });
  flash("保存しました");
});

$("threshold").addEventListener("input", (event) => {
  $("thresholdValue").textContent = event.target.value;
});

$("threshold").addEventListener("change", async (event) => {
  await setSettings({ threshold: Number(event.target.value) });
  flash("保存しました");
});

$("mode").addEventListener("change", async (event) => {
  await setSettings({ mode: event.target.value });
  flash("保存しました");
});

$("resetLearning").addEventListener("click", async () => {
  await setSettings({ accountScores: {} });
  await refresh();
  flash("学習データをリセットしました");
});

refresh();
