// node_modules/@capacitor/core/dist/index.js
var ExceptionCode;
(function(ExceptionCode2) {
  ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
  ExceptionCode2["Unavailable"] = "UNAVAILABLE";
})(ExceptionCode || (ExceptionCode = {}));
var CapacitorException = class extends Error {
  constructor(message, code, data) {
    super(message);
    this.message = message;
    this.code = code;
    this.data = data;
  }
};
var getPlatformId = (win) => {
  var _a, _b;
  if (win === null || win === void 0 ? void 0 : win.androidBridge) {
    return "android";
  } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
    return "ios";
  } else {
    return "web";
  }
};
var createCapacitor = (win) => {
  const capCustomPlatform = win.CapacitorCustomPlatform || null;
  const cap = win.Capacitor || {};
  const Plugins = cap.Plugins = cap.Plugins || {};
  const getPlatform = () => {
    return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
  };
  const isNativePlatform = () => getPlatform() !== "web";
  const isPluginAvailable = (pluginName) => {
    const plugin2 = registeredPlugins.get(pluginName);
    if (plugin2 === null || plugin2 === void 0 ? void 0 : plugin2.platforms.has(getPlatform())) {
      return true;
    }
    if (getPluginHeader(pluginName)) {
      return true;
    }
    return false;
  };
  const getPluginHeader = (pluginName) => {
    var _a;
    return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
  };
  const handleError = (err) => win.console.error(err);
  const registeredPlugins = /* @__PURE__ */ new Map();
  const registerPlugin2 = (pluginName, jsImplementations = {}) => {
    const registeredPlugin = registeredPlugins.get(pluginName);
    if (registeredPlugin) {
      console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
      return registeredPlugin.proxy;
    }
    const platform = getPlatform();
    const pluginHeader = getPluginHeader(pluginName);
    let jsImplementation;
    const loadPluginImplementation = async () => {
      if (!jsImplementation && platform in jsImplementations) {
        jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
      } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
        jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
      }
      return jsImplementation;
    };
    const createPluginMethod = (impl, prop) => {
      var _a, _b;
      if (pluginHeader) {
        const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
        if (methodHeader) {
          if (methodHeader.rtype === "promise") {
            return (options) => cap.nativePromise(pluginName, prop.toString(), options);
          } else {
            return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
          }
        } else if (impl) {
          return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
        }
      } else if (impl) {
        return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
      } else {
        throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
      }
    };
    const createPluginMethodWrapper = (prop) => {
      let remove;
      const wrapper = (...args) => {
        const p = loadPluginImplementation().then((impl) => {
          const fn = createPluginMethod(impl, prop);
          if (fn) {
            const p2 = fn(...args);
            remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
            return p2;
          } else {
            throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        });
        if (prop === "addListener") {
          p.remove = async () => remove();
        }
        return p;
      };
      wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
      Object.defineProperty(wrapper, "name", {
        value: prop,
        writable: false,
        configurable: false
      });
      return wrapper;
    };
    const addListener = createPluginMethodWrapper("addListener");
    const removeListener = createPluginMethodWrapper("removeListener");
    const addListenerNative = (eventName, callback) => {
      const call = addListener({ eventName }, callback);
      const remove = async () => {
        const callbackId = await call;
        removeListener({
          eventName,
          callbackId
        }, callback);
      };
      const p = new Promise((resolve) => call.then(() => resolve({ remove })));
      p.remove = async () => {
        console.warn(`Using addListener() without 'await' is deprecated.`);
        await remove();
      };
      return p;
    };
    const proxy = new Proxy({}, {
      get(_, prop) {
        switch (prop) {
          // https://github.com/facebook/react/issues/20030
          case "$$typeof":
            return void 0;
          case "toJSON":
            return () => ({});
          case "addListener":
            return pluginHeader ? addListenerNative : addListener;
          case "removeListener":
            return removeListener;
          default:
            return createPluginMethodWrapper(prop);
        }
      }
    });
    Plugins[pluginName] = proxy;
    registeredPlugins.set(pluginName, {
      name: pluginName,
      proxy,
      platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
    });
    return proxy;
  };
  if (!cap.convertFileSrc) {
    cap.convertFileSrc = (filePath) => filePath;
  }
  cap.getPlatform = getPlatform;
  cap.handleError = handleError;
  cap.isNativePlatform = isNativePlatform;
  cap.isPluginAvailable = isPluginAvailable;
  cap.registerPlugin = registerPlugin2;
  cap.Exception = CapacitorException;
  cap.DEBUG = !!cap.DEBUG;
  cap.isLoggingEnabled = !!cap.isLoggingEnabled;
  return cap;
};
var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
var Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
var registerPlugin = Capacitor.registerPlugin;
var WebPlugin = class {
  constructor() {
    this.listeners = {};
    this.retainedEventArguments = {};
    this.windowListeners = {};
  }
  addListener(eventName, listenerFunc) {
    let firstListener = false;
    const listeners = this.listeners[eventName];
    if (!listeners) {
      this.listeners[eventName] = [];
      firstListener = true;
    }
    this.listeners[eventName].push(listenerFunc);
    const windowListener = this.windowListeners[eventName];
    if (windowListener && !windowListener.registered) {
      this.addWindowListener(windowListener);
    }
    if (firstListener) {
      this.sendRetainedArgumentsForEvent(eventName);
    }
    const remove = async () => this.removeListener(eventName, listenerFunc);
    const p = Promise.resolve({ remove });
    return p;
  }
  async removeAllListeners() {
    this.listeners = {};
    for (const listener in this.windowListeners) {
      this.removeWindowListener(this.windowListeners[listener]);
    }
    this.windowListeners = {};
  }
  notifyListeners(eventName, data, retainUntilConsumed) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      if (retainUntilConsumed) {
        let args = this.retainedEventArguments[eventName];
        if (!args) {
          args = [];
        }
        args.push(data);
        this.retainedEventArguments[eventName] = args;
      }
      return;
    }
    listeners.forEach((listener) => listener(data));
  }
  hasListeners(eventName) {
    var _a;
    return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
  }
  registerWindowListener(windowEventName, pluginEventName) {
    this.windowListeners[pluginEventName] = {
      registered: false,
      windowEventName,
      pluginEventName,
      handler: (event) => {
        this.notifyListeners(pluginEventName, event);
      }
    };
  }
  unimplemented(msg = "not implemented") {
    return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
  }
  unavailable(msg = "not available") {
    return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
  }
  async removeListener(eventName, listenerFunc) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      return;
    }
    const index = listeners.indexOf(listenerFunc);
    if (index !== -1) {
      this.listeners[eventName].splice(index, 1);
    }
    if (!this.listeners[eventName].length) {
      this.removeWindowListener(this.windowListeners[eventName]);
    }
  }
  addWindowListener(handle) {
    window.addEventListener(handle.windowEventName, handle.handler);
    handle.registered = true;
  }
  removeWindowListener(handle) {
    if (!handle) {
      return;
    }
    window.removeEventListener(handle.windowEventName, handle.handler);
    handle.registered = false;
  }
  sendRetainedArgumentsForEvent(eventName) {
    const args = this.retainedEventArguments[eventName];
    if (!args) {
      return;
    }
    delete this.retainedEventArguments[eventName];
    args.forEach((arg) => {
      this.notifyListeners(eventName, arg);
    });
  }
};
var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
var CapacitorCookiesPluginWeb = class extends WebPlugin {
  async getCookies() {
    const cookies = document.cookie;
    const cookieMap = {};
    cookies.split(";").forEach((cookie) => {
      if (cookie.length <= 0)
        return;
      let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
      key = decode(key).trim();
      value = decode(value).trim();
      cookieMap[key] = value;
    });
    return cookieMap;
  }
  async setCookie(options) {
    try {
      const encodedKey = encode(options.key);
      const encodedValue = encode(options.value);
      const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
      const path = (options.path || "/").replace("path=", "");
      const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
      document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async deleteCookie(options) {
    try {
      document.cookie = `${options.key}=; Max-Age=0`;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async clearCookies() {
    try {
      const cookies = document.cookie.split(";") || [];
      for (const cookie of cookies) {
        document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async clearAllCookies() {
    try {
      await this.clearCookies();
    } catch (error) {
      return Promise.reject(error);
    }
  }
};
var CapacitorCookies = registerPlugin("CapacitorCookies", {
  web: () => new CapacitorCookiesPluginWeb()
});
var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result;
    resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
  };
  reader.onerror = (error) => reject(error);
  reader.readAsDataURL(blob);
});
var normalizeHttpHeaders = (headers = {}) => {
  const originalKeys = Object.keys(headers);
  const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
  const normalized = loweredKeys.reduce((acc, key, index) => {
    acc[key] = headers[originalKeys[index]];
    return acc;
  }, {});
  return normalized;
};
var buildUrlParams = (params, shouldEncode = true) => {
  if (!params)
    return null;
  const output = Object.entries(params).reduce((accumulator, entry) => {
    const [key, value] = entry;
    let encodedValue;
    let item;
    if (Array.isArray(value)) {
      item = "";
      value.forEach((str) => {
        encodedValue = shouldEncode ? encodeURIComponent(str) : str;
        item += `${key}=${encodedValue}&`;
      });
      item.slice(0, -1);
    } else {
      encodedValue = shouldEncode ? encodeURIComponent(value) : value;
      item = `${key}=${encodedValue}`;
    }
    return `${accumulator}&${item}`;
  }, "");
  return output.substr(1);
};
var buildRequestInit = (options, extra = {}) => {
  const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
  const headers = normalizeHttpHeaders(options.headers);
  const type = headers["content-type"] || "";
  if (typeof options.data === "string") {
    output.body = options.data;
  } else if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.data || {})) {
      params.set(key, value);
    }
    output.body = params.toString();
  } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
    const form = new FormData();
    if (options.data instanceof FormData) {
      options.data.forEach((value, key) => {
        form.append(key, value);
      });
    } else {
      for (const key of Object.keys(options.data)) {
        form.append(key, options.data[key]);
      }
    }
    output.body = form;
    const headers2 = new Headers(output.headers);
    headers2.delete("content-type");
    output.headers = headers2;
  } else if (type.includes("application/json") || typeof options.data === "object") {
    output.body = JSON.stringify(options.data);
  }
  return output;
};
var CapacitorHttpPluginWeb = class extends WebPlugin {
  /**
   * Perform an Http request given a set of options
   * @param options Options to build the HTTP request
   */
  async request(options) {
    const requestInit = buildRequestInit(options, options.webFetchExtra);
    const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
    const url = urlParams ? `${options.url}?${urlParams}` : options.url;
    const response = await fetch(url, requestInit);
    const contentType = response.headers.get("content-type") || "";
    let { responseType = "text" } = response.ok ? options : {};
    if (contentType.includes("application/json")) {
      responseType = "json";
    }
    let data;
    let blob;
    switch (responseType) {
      case "arraybuffer":
      case "blob":
        blob = await response.blob();
        data = await readBlobAsBase64(blob);
        break;
      case "json":
        data = await response.json();
        break;
      case "document":
      case "text":
      default:
        data = await response.text();
    }
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      data,
      headers,
      status: response.status,
      url: response.url
    };
  }
  /**
   * Perform an Http GET request given a set of options
   * @param options Options to build the HTTP request
   */
  async get(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
  }
  /**
   * Perform an Http POST request given a set of options
   * @param options Options to build the HTTP request
   */
  async post(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
  }
  /**
   * Perform an Http PUT request given a set of options
   * @param options Options to build the HTTP request
   */
  async put(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
  }
  /**
   * Perform an Http PATCH request given a set of options
   * @param options Options to build the HTTP request
   */
  async patch(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
  }
  /**
   * Perform an Http DELETE request given a set of options
   * @param options Options to build the HTTP request
   */
  async delete(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
  }
};
var CapacitorHttp = registerPlugin("CapacitorHttp", {
  web: () => new CapacitorHttpPluginWeb()
});
var SystemBarsStyle;
(function(SystemBarsStyle2) {
  SystemBarsStyle2["Dark"] = "DARK";
  SystemBarsStyle2["Light"] = "LIGHT";
  SystemBarsStyle2["Default"] = "DEFAULT";
})(SystemBarsStyle || (SystemBarsStyle = {}));
var SystemBarType;
(function(SystemBarType2) {
  SystemBarType2["StatusBar"] = "StatusBar";
  SystemBarType2["NavigationBar"] = "NavigationBar";
})(SystemBarType || (SystemBarType = {}));
var SystemBarsPluginWeb = class extends WebPlugin {
  async setStyle() {
    this.unavailable("not available for web");
  }
  async setAnimation() {
    this.unavailable("not available for web");
  }
  async show() {
    this.unavailable("not available for web");
  }
  async hide() {
    this.unavailable("not available for web");
  }
};
var SystemBars = registerPlugin("SystemBars", {
  web: () => new SystemBarsPluginWeb()
});

// bluetooth.js
var el = (selector) => document.querySelector(selector);
var COMMAND_GROUPS = {
  all: "ALL",
  towerA: "TOWER_A",
  towerB: "TOWER_B",
  landscape: "LANDSCAPE",
  clubhouse: "CLUBHOUSE",
  crown: "CROWN_TERRACE",
  facade: "FACADE",
  cars: "CARS",
  animation: "ANIMATION"
};
var PRESET_SYNC_KEYS = ["towerA", "towerB", "landscape", "clubhouse", "crown", "facade"];
var HW_KEYS = [...PRESET_SYNC_KEYS, "cars", "animation"];
var KEY_BY_GROUP = Object.fromEntries(Object.entries(COMMAND_GROUPS).map(([key, group]) => [group, key]));
var VALID_COMMANDS = /* @__PURE__ */ new Set([
  "STATUS",
  ...Object.values(COMMAND_GROUPS).flatMap((group) => [`${group}:ON`, `${group}:OFF`])
]);
var LABELS = {
  towerA: "Tower A",
  towerB: "Tower B",
  landscape: "Landscape",
  clubhouse: "Clubhouse",
  crown: "Crown terrace",
  facade: "Facade",
  cars: "Moving car",
  animation: "Animation"
};
var DEFAULT_DEVICE_NAME = "HC-05";
var DEFAULT_DEVICE_ADDRESS = "20:26:01:00:80:BF";
var LAST_DEVICE_KEY = "towerlightning.bluetooth.lastDevice";
var AUTO_RECONNECT_KEY = "towerlightning.bluetooth.autoReconnect";
var REPLY_TIMEOUT_MS = 3e3;
var CONNECT_TIMEOUT_MS = 2e4;
var RETRY_DELAYS_MS = [1500, 4e3, 1e4];
var MAX_QUEUE = 24;
var ADDRESS_PATTERN = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
function getClassicBluetoothPlugin() {
  try {
    return registerPlugin("ClassicBluetooth");
  } catch (error) {
    console.error("ClassicBluetooth registration failed:", error);
    return null;
  }
}
var isNative = Boolean(window.Capacitor?.isNativePlatform?.());
var plugin = isNative ? getClassicBluetoothPlugin() : null;
var supportText = el("#bluetooth-support");
var detailText = el("#bluetooth-detail");
var badge = el("#bluetooth-badge");
var button = el("#bluetooth-button");
var reconnectButton = el("#bluetooth-reconnect");
var deviceSelect = el("#bluetooth-device");
var refreshButton = el("#bluetooth-refresh");
var logBox = el("#bluetooth-log");
var banner = el("#hardware-banner");
var toast = el("#toast");
var hardwareBox = document.createElement("div");
hardwareBox.id = "hardware-state";
hardwareBox.className = "hardware-state";
hardwareBox.setAttribute("aria-live", "polite");
logBox.before(hardwareBox);
var manualBox = document.createElement("div");
manualBox.id = "manual-commands";
manualBox.className = "manual-commands";
[
  ["ALL", "All"],
  ["TOWER_A", "Tower A"],
  ["TOWER_B", "Tower B"],
  ["LANDSCAPE", "Landscape"],
  ["CLUBHOUSE", "Clubhouse"],
  ["CROWN_TERRACE", "Crown terrace"],
  ["FACADE", "Facade"],
  ["CARS", "Moving car"],
  ["ANIMATION", "Animation"]
].forEach(([group, label]) => {
  const row = document.createElement("div");
  row.className = "manual-row";
  const name = document.createElement("span");
  name.textContent = label;
  row.append(name);
  ["ON", "OFF"].forEach((state) => {
    const manualButton = document.createElement("button");
    manualButton.type = "button";
    manualButton.className = "button-secondary";
    manualButton.dataset.manualCommand = `${group}:${state}`;
    manualButton.textContent = state;
    row.append(manualButton);
  });
  manualBox.append(row);
});
var statusButton = document.createElement("button");
statusButton.type = "button";
statusButton.className = "button-secondary";
statusButton.dataset.manualCommand = "STATUS";
statusButton.textContent = "Request STATUS";
manualBox.append(statusButton);
hardwareBox.before(manualBox);
manualBox.hidden = !plugin;
manualBox.addEventListener("click", (event) => {
  const target = event.target.closest("[data-manual-command]");
  if (!target) return;
  if (!connected) {
    say("Hardware not connected: command not sent.");
    return;
  }
  sendCommand(target.dataset.manualCommand);
});
var connected = false;
var busy = false;
var userDisconnecting = false;
var deviceLabel = "";
var toastTimer;
var hardwareState = Object.fromEntries(HW_KEYS.map((key) => [key, null]));
var statusReceived = false;
var queue = [];
var inflight = null;
var retryTimer = null;
var retryAttempt = 0;
var cycleId = 0;
function readLastDevice() {
  try {
    return localStorage.getItem(LAST_DEVICE_KEY);
  } catch {
    return null;
  }
}
function autoReconnectAllowed() {
  try {
    return localStorage.getItem(AUTO_RECONNECT_KEY) !== "0";
  } catch {
    return true;
  }
}
function setAutoReconnect(allowed) {
  try {
    localStorage.setItem(AUTO_RECONNECT_KEY, allowed ? "1" : "0");
  } catch {
  }
}
function say(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}
function log(message, isError = false) {
  const row = document.createElement("div");
  row.textContent = `${(/* @__PURE__ */ new Date()).toLocaleTimeString()}  ${message}`;
  if (isError) row.className = "bluetooth-log-error";
  logBox.prepend(row);
  while (logBox.children.length > 30) logBox.lastChild.remove();
}
function previewIsOn(key) {
  const control = document.querySelector(`[data-control="${key}"]`);
  return control ? control.getAttribute("aria-pressed") === "true" : null;
}
function renderHardwareState() {
  hardwareBox.replaceChildren();
  hardwareBox.hidden = !plugin;
  if (!plugin) return;
  const title = document.createElement("div");
  title.className = "hardware-state-title";
  title.textContent = connected ? statusReceived ? "Arduino-confirmed output commands" : "Arduino state not yet confirmed" : "Preview only \u2014 no hardware-confirmed state";
  hardwareBox.append(title);
  HW_KEYS.forEach((key) => {
    const hw = hardwareState[key];
    const preview = previewIsOn(key);
    const chip = document.createElement("span");
    const known = connected && hw !== null;
    const mismatch = known && preview !== null && preview !== hw;
    chip.className = `hardware-chip${known ? " is-known" : ""}${mismatch ? " is-mismatch" : ""}`;
    chip.textContent = `${LABELS[key]}: ${known ? hw ? "ON" : "OFF" : "?"}${mismatch ? " \u2260 preview" : ""}`;
    hardwareBox.append(chip);
    const control = document.querySelector(`[data-control="${key}"]`);
    if (control) control.dataset.hw = !known ? "preview" : mismatch ? "unconfirmed" : "confirmed";
  });
}
function render(detail) {
  badge.textContent = busy ? "WORKING\u2026" : connected ? "CONNECTED" : "NOT CONNECTED";
  badge.classList.toggle("is-connected", connected && !busy);
  button.textContent = connected ? "Disconnect" : "Connect";
  button.disabled = busy || !plugin;
  deviceSelect.disabled = connected || busy || !plugin;
  reconnectButton.hidden = !plugin || connected || !readLastDevice();
  reconnectButton.disabled = busy;
  refreshButton.hidden = !plugin || connected;
  refreshButton.disabled = busy;
  if (detail) detailText.textContent = detail;
  banner.classList.toggle("is-live", connected);
  banner.textContent = connected ? `Hardware link open: ${deviceLabel}. The Arduino confirms commands it received; relay/lamp output is not independently verified.` : "Preview only. Hardware not connected: the 3D model changes, real lights do not.";
  renderHardwareState();
}
function applyAck(line) {
  const match = /^OK:([A-Z_]+):(ON|OFF)$/.exec(line);
  if (!match) return false;
  const [, group, state] = match;
  const on = state === "ON";
  if (group === "ALL") {
    PRESET_SYNC_KEYS.forEach((key) => {
      hardwareState[key] = on;
    });
  } else if (KEY_BY_GROUP[group] && group !== "ALL") {
    hardwareState[KEY_BY_GROUP[group]] = on;
  } else {
    return false;
  }
  return true;
}
function parseStatus(line) {
  const match = /^STATUS:(.+)$/.exec(line);
  if (!match) return null;
  const parsed = {};
  for (const part of match[1].split(",")) {
    const pair = /^([A-Z_]+)=(ON|OFF)$/.exec(part);
    const key = pair && pair[1] !== "ALL" ? KEY_BY_GROUP[pair[1]] : null;
    if (!key || key in parsed) return null;
    parsed[key] = pair[2] === "ON";
  }
  return HW_KEYS.every((key) => key in parsed) && Object.keys(parsed).length === HW_KEYS.length ? parsed : null;
}
function resetHardwareState() {
  HW_KEYS.forEach((key) => {
    hardwareState[key] = null;
  });
  statusReceived = false;
}
function settle(entry, error) {
  if (entry.settled) return;
  entry.settled = true;
  clearTimeout(entry.timer);
  if (inflight === entry) inflight = null;
  if (error) entry.reject(error);
  else entry.resolve();
  pump();
}
function pump() {
  if (inflight || !connected || !queue.length) return;
  const entry = queue.shift();
  inflight = entry;
  entry.timer = setTimeout(() => {
    log(`No reply from controller for ${entry.command}. Delivery is unconfirmed.`, true);
    say(`No reply from controller for ${entry.command}`);
    settle(entry, new Error("timeout"));
  }, REPLY_TIMEOUT_MS);
  plugin.write({ data: `${entry.command}
` }).then(
    () => log(`Sent: ${entry.command}`),
    (error) => {
      const message = error?.message || String(error);
      log(message, true);
      say(`Command not delivered: ${message}`);
      settle(entry, new Error(message));
    }
  );
}
function sendCommand(command) {
  if (!VALID_COMMANDS.has(command)) {
    log(`Blocked unsupported command: ${command}`, true);
    return Promise.resolve();
  }
  if (!connected) return Promise.resolve();
  const groupOf = (command2) => command2.split(":")[0];
  queue = queue.filter((item) => {
    if (groupOf(item.command) !== groupOf(command)) return true;
    item.settled = true;
    item.resolve();
    return false;
  });
  if (queue.length >= MAX_QUEUE) {
    log("Command queue full; command dropped.", true);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push({ command, settled: false, timer: null, resolve, reject: resolve });
    pump();
  });
}
function clearQueue() {
  const entries = [...queue, ...inflight ? [inflight] : []];
  queue = [];
  inflight = null;
  entries.forEach((entry) => {
    entry.settled = true;
    clearTimeout(entry.timer);
    entry.resolve();
  });
}
function onReply(line) {
  line = String(line).trim();
  if (!line) return;
  const entry = inflight;
  if (entry && entry.command === "STATUS") {
    const status = parseStatus(line);
    if (status) {
      Object.assign(hardwareState, status);
      statusReceived = true;
      log("Controller STATUS received (commanded output states).");
      settle(entry);
      renderHardwareState();
      return;
    }
  }
  if (applyAck(line)) {
    if (entry && line === `OK:${entry.command}`) {
      log(`Controller accepted: ${line}`);
      settle(entry);
    } else {
      log(`Late or unmatched controller reply: ${line}`, true);
    }
    renderHardwareState();
    return;
  }
  if (/^ERR:/.test(line)) {
    log(`Controller rejected${entry ? ` ${entry.command}` : ""}: ${line}`, true);
    say(`Controller error: ${line}`);
    if (entry) settle(entry, new Error(line));
    return;
  }
  log(`Unexpected controller reply${entry ? ` to ${entry.command}` : ""}: ${line}`, true);
}
async function loadDevices(preferredAddress) {
  const { devices } = await plugin.listPaired();
  deviceSelect.replaceChildren();
  const wanted = (preferredAddress || DEFAULT_DEVICE_ADDRESS).toUpperCase();
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.address;
    option.textContent = `${device.name || "Unnamed"} (${device.address})`;
    option.selected = device.address.toUpperCase() === wanted;
    deviceSelect.append(option);
  });
  if (!devices.length) {
    const option = document.createElement("option");
    option.textContent = "No paired devices found";
    deviceSelect.append(option);
    throw new Error("No paired devices. Pair the HC-05 in Android Bluetooth settings, then tap Refresh paired devices.");
  }
  const found = devices.some((device) => device.address.toUpperCase() === wanted);
  if (!found) log(`${DEFAULT_DEVICE_NAME} (${wanted}) is not paired. Choose a device from the list.`, true);
  return found;
}
async function refreshDevices() {
  cancelRetries();
  busy = true;
  render("Loading paired devices\u2026");
  try {
    await loadDevices(readLastDevice());
    render(`${deviceSelect.options.length} paired device(s) found. Select one and tap Connect.`);
  } catch (error) {
    const message = error?.message || String(error);
    log(message, true);
    render(message);
  } finally {
    busy = false;
    render();
  }
}
async function openLink(address) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Connection timed out. Check the HC-05 is powered and in range.")), CONNECT_TIMEOUT_MS);
  });
  try {
    await Promise.race([plugin.connect({ address }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
async function attemptConnect(address, label) {
  if (busy || connected) return false;
  busy = true;
  deviceLabel = label;
  render("Connecting\u2026");
  try {
    log(`Connecting to ${label}\u2026`);
    await openLink(address);
    connected = true;
    try {
      localStorage.setItem(LAST_DEVICE_KEY, address);
    } catch {
    }
    log(`Connected to ${label}`);
    return true;
  } catch (error) {
    connected = false;
    const message = error?.message || String(error);
    log(message, true);
    plugin.disconnect().catch(() => {
    });
    render(message);
    return false;
  } finally {
    busy = false;
    render(connected ? "Link open. Requesting controller STATUS\u2026" : void 0);
    if (connected) {
      resetHardwareState();
      renderHardwareState();
      sendCommand("STATUS");
    }
  }
}
async function connect(preferredAddress) {
  cancelRetries();
  setAutoReconnect(true);
  if (busy || connected) return;
  try {
    if (!ADDRESS_PATTERN.test(deviceSelect.value)) {
      busy = true;
      render("Loading paired devices\u2026");
      try {
        await loadDevices(preferredAddress);
      } finally {
        busy = false;
      }
    }
    const address = deviceSelect.value;
    if (!ADDRESS_PATTERN.test(address)) throw new Error("Select a paired device first (tap Refresh paired devices).");
    const ok = await attemptConnect(address, deviceSelect.selectedOptions[0].textContent);
    if (!ok) say("Could not connect. See the hardware log for details.");
  } catch (error) {
    const message = error?.message || String(error);
    log(message, true);
    say(message);
    render(message);
  }
}
async function disconnect() {
  cancelRetries();
  setAutoReconnect(false);
  busy = true;
  userDisconnecting = true;
  render();
  try {
    await plugin.disconnect();
  } catch (error) {
    log(error?.message || String(error), true);
  } finally {
    busy = false;
    userDisconnecting = false;
    connected = false;
    clearQueue();
    resetHardwareState();
    log("Disconnected");
    render("No hardware connection is active. Preview only.");
  }
}
function cancelRetries() {
  cycleId += 1;
  clearTimeout(retryTimer);
  retryTimer = null;
  retryAttempt = 0;
}
async function canAutoReconnect() {
  if (!plugin || connected || busy || !autoReconnectAllowed()) return null;
  const address = readLastDevice();
  if (!address || !ADDRESS_PATTERN.test(address)) return null;
  try {
    const status = await plugin.getStatus();
    if (!status.available || !status.enabled || !status.permissionGranted) return null;
  } catch {
    return null;
  }
  return address;
}
async function startAutoReconnect(reason) {
  cancelRetries();
  const myCycle = cycleId;
  const address = await canAutoReconnect();
  if (myCycle !== cycleId) return;
  if (!address) {
    log(`Automatic reconnect skipped (${reason}): saved device, Bluetooth or permission unavailable.`);
    return;
  }
  const scheduleNext = () => {
    if (myCycle !== cycleId) return;
    if (retryAttempt >= RETRY_DELAYS_MS.length) {
      log("Automatic reconnect gave up. Choose the device and tap Connect.", true);
      render("Automatic reconnect failed. Select the device and tap Connect.");
      return;
    }
    const delay = RETRY_DELAYS_MS[retryAttempt];
    retryAttempt += 1;
    retryTimer = setTimeout(async () => {
      if (myCycle !== cycleId || connected || busy || document.hidden) return;
      const stillAddress = await canAutoReconnect();
      if (myCycle !== cycleId) return;
      if (!stillAddress) {
        log("Automatic reconnect stopped: Bluetooth or permission unavailable.");
        return;
      }
      const option = [...deviceSelect.options].find((item) => item.value.toUpperCase() === stillAddress.toUpperCase());
      if (!option) {
        log("Saved device is not in the paired list. Choose a device manually.", true);
        return;
      }
      option.selected = true;
      log(`Automatic reconnect attempt ${retryAttempt}/${RETRY_DELAYS_MS.length}\u2026`);
      const ok = await attemptConnect(stillAddress, option.textContent);
      if (!ok && myCycle === cycleId) scheduleNext();
    }, delay);
  };
  log(`Automatic reconnect (${reason})\u2026`);
  scheduleNext();
}
function onStateEvent({ connected: isConnected, message }) {
  const wasConnected = connected;
  if (isConnected && !wasConnected && !busy) {
    connected = true;
    sendCommand("STATUS");
  } else if (!isConnected) {
    connected = false;
  }
  if (wasConnected && !isConnected) {
    clearQueue();
    resetHardwareState();
    if (!userDisconnecting) {
      log(message || "Connection lost", true);
      say("Bluetooth connection lost. Preview only until you reconnect.");
      startAutoReconnect("link lost");
    }
  }
  render(isConnected ? void 0 : "No hardware connection is active. Preview only.");
}
function controlCommand(control) {
  const group = COMMAND_GROUPS[control.dataset.control];
  if (!group) return null;
  return `${group}:${control.getAttribute("aria-pressed") === "true" ? "ON" : "OFF"}`;
}
async function startup() {
  busy = true;
  render("Loading paired devices\u2026");
  try {
    await loadDevices(readLastDevice());
    render(`${deviceSelect.options.length} paired device(s) found. Select one and tap Connect.`);
  } catch (error) {
    const message = error?.message || String(error);
    log(message, true);
    render(message);
  } finally {
    busy = false;
    render();
  }
  startAutoReconnect("app start");
}
if (!plugin) {
  supportText.textContent = "Hardware control needs the Android app";
  detailText.textContent = "Browsers and installed PWAs cannot open the HC-05's Bluetooth Classic SPP link. Install the Tower Lighting APK.";
  render();
} else {
  supportText.textContent = "Bluetooth Classic SPP/RFCOMM, 9600 baud";
  render("No hardware connection is active.");
  plugin.addListener("data", ({ line }) => onReply(line));
  plugin.addListener("state", onStateEvent);
  button.addEventListener("click", () => connected ? disconnect() : connect(readLastDevice()));
  reconnectButton.addEventListener("click", () => connect(readLastDevice()));
  refreshButton.addEventListener("click", refreshDevices);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelRetries();
    } else if (!connected && !busy) {
      startAutoReconnect("app resumed");
    } else if (connected) {
      sendCommand("STATUS");
    }
  });
  startup();
}
document.querySelectorAll("[data-control]").forEach((control) => {
  if (!COMMAND_GROUPS[control.dataset.control]) return;
  control.addEventListener("click", () => {
    if (!connected) {
      say("Hardware not connected: only the 3D preview changed.");
    } else {
      sendCommand(controlCommand(control));
    }
    renderHardwareState();
  });
});
document.querySelectorAll("[data-preset]").forEach((presetButton) => {
  presetButton.addEventListener("click", () => {
    if (!connected) {
      say("Hardware not connected: only the 3D preview changed.");
    } else {
      PRESET_SYNC_KEYS.forEach((key) => {
        const control = document.querySelector(`[data-control="${key}"]`);
        if (control) sendCommand(controlCommand(control));
      });
    }
    renderHardwareState();
  });
});
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
