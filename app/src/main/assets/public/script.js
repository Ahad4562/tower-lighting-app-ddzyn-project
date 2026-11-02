import { createBuilding } from "./building.js";

const STORAGE_KEY = "towerlightning.workspace.v1";
const stateKeys = ["towerA", "towerB", "landscape", "clubhouse", "crown", "facade", "cars", "animation"];
const pageNames = { overview: "Overview", projects: "Projects", settings: "Settings" };
const presets = {
  Evening: { lights: [true, true, true, true, true, true], cars: false, animation: false, brightness: 100, color: "#f5c875" },
  Arrival: { lights: [true, true, true, true, false, true], cars: true, animation: false, brightness: 115, color: "#f4dba7" },
  Day: { lights: [true, true, true, true, true, true], cars: false, animation: false, brightness: 150, color: "#fffaf0" },
  Night: { lights: [false, false, true, false, false, false], cars: false, animation: false, brightness: 55, color: "#92bad8" },
  Celebration: { lights: [true, true, true, true, true, true], cars: true, animation: true, brightness: 125, color: "#74d7ed" },
};
const projectPicker = document.querySelector("#project-picker");
const projectGrid = document.querySelector("#projects-grid");
const toast = document.querySelector("#toast");
const errorMessage = document.querySelector("#scene-error");
const brightnessSlider = document.querySelector("#brightness-slider");
const colorPicker = document.querySelector("#color-picker");
let building;
let toastTimeout;

function defaultSettings() {
  return {
    sections: Object.fromEntries(stateKeys.map((key) => [key, key !== "cars" && key !== "animation"])),
    brightness: 100,
    color: null,
    preset: "Evening",
  };
}

function normalizeSettings(value) {
  const defaults = defaultSettings();
  const sections = {};
  stateKeys.forEach((key) => {
    sections[key] = typeof value?.sections?.[key] === "boolean" ? value.sections[key] : defaults.sections[key];
  });
  return {
    sections,
    brightness: Number.isFinite(value?.brightness) ? Math.min(150, Math.max(25, Math.round(value.brightness))) : defaults.brightness,
    color: typeof value?.color === "string" && /^#[\da-f]{6}$/i.test(value.color) ? value.color : null,
    preset: typeof value?.preset === "string" && Object.hasOwn(presets, value.preset) ? value.preset : "Evening",
  };
}

function newDefaultProject() {
  return { id: "dzyn-residences", name: "DZYN Residences", location: "North District", createdAt: new Date().toISOString(), settings: defaultSettings() };
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: [newDefaultProject()], activeProjectId: "dzyn-residences", page: "overview" };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects)) throw new TypeError("Saved project data has an unsupported format.");
    const projects = parsed.projects
      .filter((project) => project && typeof project.id === "string" && typeof project.name === "string")
      .map((project) => ({
        id: project.id,
        name: project.name.slice(0, 48),
        location: typeof project.location === "string" ? project.location.slice(0, 64) : "",
        createdAt: typeof project.createdAt === "string" ? project.createdAt : new Date().toISOString(),
        settings: normalizeSettings(project.settings),
      }));
    if (!projects.length) throw new TypeError("No valid projects were found in saved project data.");
    const page = Object.hasOwn(pageNames, parsed.page) ? parsed.page : "overview";
    return {
      projects,
      activeProjectId: projects.some((project) => project.id === parsed.activeProjectId) ? parsed.activeProjectId : projects[0].id,
      page,
    };
  } catch (error) {
    console.error("Unable to read saved Towerlightning project settings.", error);
    showToast("Saved settings could not be read. A fresh workspace is open; your stored data has not been deleted.");
    return { projects: [newDefaultProject()], activeProjectId: "dzyn-residences", page: "overview" };
  }
}

const store = readStore();

function activeProject() {
  return store.projects.find((project) => project.id === store.activeProjectId) ?? store.projects[0];
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    const state = document.querySelector("#storage-state");
    if (state) state.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return true;
  } catch (error) {
    console.error("Unable to save Towerlightning project settings.", error);
    showToast("Could not save settings to this browser. Check available storage and privacy settings.");
    return false;
  }
}

function saveActiveSettings() {
  if (!building) return;
  const project = activeProject();
  project.settings = {
    sections: Object.fromEntries(stateKeys.map((key) => [key, Boolean(building.states[key])])),
    brightness: Number(brightnessSlider.value),
    color: colorPicker.value.toLowerCase() === "#f5c875" && project.settings.color === null ? null : colorPicker.value.toLowerCase(),
    preset: project.settings.preset,
  };
  saveStore();
}

function renderProjectPicker() {
  projectPicker.replaceChildren();
  store.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === store.activeProjectId;
    projectPicker.append(option);
  });
  document.querySelector("#project-count").textContent = String(store.projects.length).padStart(2, "0");
}

function applyProjectSettings(project) {
  const settings = normalizeSettings(project.settings);
  project.settings = settings;
  if (!building) return;
  building.lightingKeys.forEach((key) => building.setSection(key, settings.sections[key]));
  building.setSection("cars", settings.sections.cars);
  building.setBrightness(settings.brightness / 100);
  building.setLightColor(settings.color);
  building.setAnimation(settings.sections.animation);
  building.setDaylight(settings.preset === "Day");
  brightnessSlider.value = String(settings.brightness);
  colorPicker.value = settings.color ?? "#f5c875";
}

function renderProjectCards() {
  projectGrid.replaceChildren();
  store.projects.forEach((project, index) => {
    const card = document.createElement("article");
    card.className = `project-card${project.id === store.activeProjectId ? " is-current" : ""}`;

    const header = document.createElement("div");
    header.className = "project-card-top";
    const icon = document.createElement("span");
    icon.className = "project-card-icon";
    icon.textContent = "▦";
    const badge = document.createElement("span");
    badge.className = `project-card-badge${project.id === store.activeProjectId ? " is-current" : ""}`;
    badge.textContent = project.id === store.activeProjectId ? "ACTIVE" : "SAVED";
    header.append(icon, badge);

    const title = document.createElement("h2");
    title.textContent = project.name;
    const location = document.createElement("p");
    location.className = "project-card-location";
    location.textContent = project.location || "Location not specified";
    const activeCount = Object.values(project.settings.sections).filter(Boolean).length;
    const summary = document.createElement("div");
    summary.className = "project-card-summary";
    summary.innerHTML = `<span>${activeCount} lighting groups active</span><span>${project.settings.brightness}% brightness</span>`;
    const footer = document.createElement("div");
    footer.className = "project-card-footer";
    const modelLabel = document.createElement("span");
    modelLabel.innerHTML = '<i></i> EXISTING MODEL PREVIEW';
    const select = document.createElement("button");
    select.className = "button-secondary project-open-button";
    select.type = "button";
    select.dataset.openProject = project.id;
    select.textContent = project.id === store.activeProjectId ? "Current project" : "Open project";
    select.disabled = project.id === store.activeProjectId;
    footer.append(modelLabel, select);
    card.append(header, title, location, summary, footer);
    if (store.projects.length > 1) {
      const remove = document.createElement("button");
      remove.className = "project-remove";
      remove.type = "button";
      remove.dataset.deleteProject = project.id;
      remove.setAttribute("aria-label", `Remove ${project.name}`);
      remove.title = "Remove project from this device";
      remove.textContent = "×";
      card.append(remove);
    }
    card.style.setProperty("--card-index", String(index));
    projectGrid.append(card);
  });
  const count = store.projects.length;
  document.querySelector("#projects-summary").textContent = `${count} ${count === 1 ? "project" : "projects"}`;
}

function updateControls() {
  if (!building) return;
  document.querySelectorAll("[data-control]").forEach((button) => {
    const key = button.dataset.control;
    const enabled = key === "all"
      ? building.lightingKeys.every((lightingKey) => building.states[lightingKey])
      : Boolean(building.states[key]);
    button.setAttribute("aria-pressed", String(enabled));
    button.querySelector(".control-state").textContent = enabled ? "ON" : "OFF";
  });

  const activeCount = building.lightingKeys.filter((key) => building.states[key]).length;
  const allActive = activeCount === building.lightingKeys.length;
  document.querySelector("#control-active-count").textContent = String(activeCount);
  document.querySelector("#summary-active-count").textContent = String(activeCount);
  document.querySelector("#summary-light-state").textContent = allActive ? "All systems operational" : activeCount ? "Selected systems active" : "All lighting groups off";
  document.querySelector("#scene-status-text").textContent = building.states.animation ? "DYNAMIC LIGHTING" : activeCount ? "SYSTEM ACTIVE" : "STANDBY";
  document.querySelector("#brightness-value").value = `${brightnessSlider.value}%`;
  document.querySelector("#brightness-value").textContent = `${brightnessSlider.value}%`;

  const project = activeProject();
  document.querySelector("#overview-project-name").textContent = project.name;
  document.querySelector("#overview-project-location").textContent = project.location || "Location not specified";
  document.querySelector("#summary-project").textContent = project.name;
  document.querySelector("#summary-location").textContent = project.location || "Location not specified";
  document.querySelector("#model-project-name").textContent = project.name;
  document.querySelector("#summary-preset").textContent = project.settings.preset;
  document.querySelector("#settings-active-project").textContent = project.name;
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.preset === project.settings.preset);
  });
  const colorLabel = document.querySelector("#color-value");
  colorLabel.textContent = project.settings.color ? project.settings.color.toUpperCase() : "Warm white";
  colorLabel.style.color = project.settings.color ?? "";
}

function renderWorkspace() {
  renderProjectPicker();
  renderProjectCards();
  updateControls();
}

function selectProject(projectId) {
  if (!store.projects.some((project) => project.id === projectId)) return;
  store.activeProjectId = projectId;
  applyProjectSettings(activeProject());
  renderWorkspace();
  saveStore();
}

function showPage(page) {
  if (!Object.hasOwn(pageNames, page)) return;
  document.querySelectorAll(".page").forEach((section) => {
    section.hidden = section.dataset.page !== page;
  });
  document.querySelectorAll("[data-page-link]").forEach((button) => {
    const active = button.dataset.pageLink === page;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelector("#breadcrumb-title").textContent = pageNames[page];
  store.page = page;
  saveStore();
  document.querySelector(".main-content").scrollTop = 0;
}

function setPreset(name) {
  const preset = presets[name];
  if (!preset || !building) return;
  building.lightingKeys.forEach((key, index) => building.setSection(key, preset.lights[index]));
  building.setSection("cars", preset.cars);
  brightnessSlider.value = String(preset.brightness);
  building.setBrightness(preset.brightness / 100);
  colorPicker.value = preset.color;
  building.setLightColor(preset.color);
  building.setAnimation(preset.animation);
  building.setDaylight(name === "Day");
  activeProject().settings = {
    sections: Object.fromEntries(stateKeys.map((key) => [key, Boolean(building.states[key])])),
    brightness: preset.brightness,
    color: preset.color,
    preset: name,
  };
  renderWorkspace();
  saveStore();
}

function createProject(name, location) {
  const project = {
    id: globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, 48),
    location: location.trim().slice(0, 64),
    createdAt: new Date().toISOString(),
    settings: defaultSettings(),
  };
  store.projects.push(project);
  store.activeProjectId = project.id;
  applyProjectSettings(project);
  renderWorkspace();
  saveStore();
  showPage("overview");
  showToast(`${project.name} created. Its lighting settings will be saved separately.`);
}

function registerOfflineSupport() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    document.querySelector("#capability-offline").textContent = "Unavailable";
    return;
  }
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    showToast("An app update is ready. Reload to finish updating.");
  });
  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).then((registration) => {
    if (!window.navigator.onLine) return registration;
    return registration.update().catch((error) => {
      console.warn("Unable to check for an app update; the saved offline version remains available.", error);
      return registration;
    });
  }).then((registration) => {
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw new Error("No service worker is available to cache the app.");
    return new Promise((resolve, reject) => {
      const onStateChange = () => {
        if (worker.state === "installed" || worker.state === "activated") {
          worker.removeEventListener("statechange", onStateChange);
          resolve();
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", onStateChange);
          reject(new Error("The offline app cache could not be installed."));
        }
      };
      worker.addEventListener("statechange", onStateChange);
      onStateChange();
    });
  }).then(() => {
    document.querySelector("#capability-offline").textContent = "Ready for offline use";
    document.querySelector("#capability-offline").classList.add("is-supported");
  }).catch((error) => {
    console.error("Unable to register the offline app shell.", error);
    document.querySelector("#capability-offline").textContent = "Unavailable";
    showToast("Offline app support could not be enabled in this browser.");
  });
}

function updateBluetoothStatus() {
  // The HC-05 uses Classic SPP, which browsers cannot open. bluetooth.js reports the native Android status.
  const native = Boolean(window.Capacitor?.isNativePlatform?.());
  document.querySelector("#capability-bluetooth").textContent = native ? "Classic SPP (native)" : "Android app only";
  document.querySelector("#capability-bluetooth").classList.toggle("is-supported", native);
  const apkDownload = document.querySelector("#android-apk-download");
  const apkGuidance = document.querySelector("#android-apk-guidance");
  if (apkDownload) apkDownload.hidden = native;
  if (apkGuidance) apkGuidance.hidden = native;
}

try {
  building = createBuilding(document.querySelector("#scene"));
} catch (error) {
  console.error("Unable to initialize the existing 3D building scene.", error);
  errorMessage.hidden = false;
  showToast("The 3D model could not start. Check the browser console and WebGL support.");
}

if (building) applyProjectSettings(activeProject());

document.querySelectorAll("[data-control]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!building) return;
    const key = button.dataset.control;
    if (key === "all") {
      const allOn = building.lightingKeys.every((lightingKey) => building.states[lightingKey]);
      building.setAllLights(!allOn);
    } else if (key === "animation") {
      building.setAnimation(!building.states.animation);
    } else {
      building.setSection(key, !building.states[key]);
    }
    updateControls();
    saveActiveSettings();
  });
});

projectPicker.addEventListener("change", () => selectProject(projectPicker.value));
document.querySelectorAll("[data-page-link]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.pageLink));
});
document.querySelector("#zoom-in").addEventListener("click", () => building?.setZoom(-4));
document.querySelector("#zoom-out").addEventListener("click", () => building?.setZoom(4));
document.querySelector("#reset-view").addEventListener("click", () => building?.resetView());

brightnessSlider.addEventListener("input", () => {
  if (!building) return;
  building.setBrightness(Number(brightnessSlider.value) / 100);
  document.querySelector("#brightness-value").textContent = `${brightnessSlider.value}%`;
  document.querySelector("#brightness-value").value = `${brightnessSlider.value}%`;
  saveActiveSettings();
});
colorPicker.addEventListener("input", () => {
  if (!building) return;
  building.setLightColor(colorPicker.value);
  activeProject().settings.color = colorPicker.value.toLowerCase();
  updateControls();
  saveActiveSettings();
});
const THEME_KEY = "towerlightning.theme";
const themeToggle = document.querySelector("#theme-toggle");
function renderThemeToggle() {
  const light = document.documentElement.dataset.theme === "light";
  themeToggle.querySelector(".theme-toggle-icon").textContent = light ? "☾" : "☀";
  themeToggle.querySelector(".theme-toggle-label").textContent = light ? "Dark" : "Light";
  themeToggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f4f2ef" : "#0b0d10");
}
themeToggle.addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  if (light) document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(THEME_KEY, light ? "light" : "dark"); } catch { /* storage unavailable */ }
  renderThemeToggle();
});
renderThemeToggle();

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => setPreset(button.dataset.preset));
});

const projectDialog = document.querySelector("#project-dialog");
document.querySelectorAll("[data-open-project-dialog]").forEach((button) => {
  button.addEventListener("click", () => projectDialog.showModal());
});
document.querySelectorAll("[data-close-project-dialog]").forEach((button) => {
  button.addEventListener("click", () => projectDialog.close());
});
document.querySelector("#project-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  createProject(String(form.get("name") ?? ""), String(form.get("location") ?? ""));
  event.currentTarget.reset();
  projectDialog.close();
});
projectGrid.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-project]");
  if (openButton) {
    selectProject(openButton.dataset.openProject);
    showPage("overview");
    return;
  }
  const deleteButton = event.target.closest("[data-delete-project]");
  if (!deleteButton) return;
  const project = store.projects.find((entry) => entry.id === deleteButton.dataset.deleteProject);
  if (!project || !window.confirm(`Remove "${project.name}" and its saved settings from this device?`)) return;
  store.projects = store.projects.filter((entry) => entry.id !== project.id);
  if (store.activeProjectId === project.id) store.activeProjectId = store.projects[0].id;
  applyProjectSettings(activeProject());
  renderWorkspace();
  saveStore();
  showToast(`${project.name} removed from this device.`);
});

document.querySelector("#reset-preferences").addEventListener("click", () => {
  if (!window.confirm(`Restore the default lighting settings for "${activeProject().name}"?`)) return;
  activeProject().settings = defaultSettings();
  applyProjectSettings(activeProject());
  renderWorkspace();
  saveStore();
  showToast("Default lighting settings restored for this project.");
});

renderWorkspace();
showPage(store.page);
registerOfflineSupport();
updateBluetoothStatus();
