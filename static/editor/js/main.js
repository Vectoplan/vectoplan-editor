// services/vectoplan-editor/static/editor/js/main.js
(function () {
  "use strict";

  /**
   * VECTOPLAN Editor - Fallback/Compatibility Runtime
   *
   * Wichtige Rolle dieser Datei:
   * - `frontend/src/main.ts` ist jetzt die eigentliche Source-of-Truth
   * - `static/editor/js/main.js` ist der stabile Auslieferungspfad im Browser
   * - im regulären Build wird diese Datei durch das Vite-Artefakt ersetzt
   * - diese handgeschriebene Variante dient als robuster Fallback und
   *   Entwicklungsanker, falls noch kein Frontend-Build vorliegt
   *
   * Ziele dieser Fallback-Version:
   * - die Seite nicht leer lassen
   * - Bootstrap-Daten weiter robust lesen
   * - eine kleine sichtbare Canvas-Runtime liefern
   * - Status-/Pointer-Lock-Basis verfügbar halten
   * - eine kompatible öffentliche API exportieren
   */

  if (typeof window !== "undefined" && window.__VECTOPLAN_EDITOR_STATIC_MAIN_INITIALIZED__) {
    return;
  }

  try {
    if (typeof window !== "undefined") {
      window.__VECTOPLAN_EDITOR_STATIC_MAIN_INITIALIZED__ = true;
    }
  } catch (error) {
    // bewusst still
  }

  var RUNTIME_NAME = "vectoplan-editor";
  var RUNTIME_VERSION = "0.3.0-static-fallback";

  var DEFAULT_BOOTSTRAP = deepFreeze({
    appName: RUNTIME_NAME,
    pageTitle: "VECTOPLAN Editor",
    brandName: "VECTOPLAN Editor",
    routePath: "/editor",
    initialStatus: "Initialisierung...",
    runtimeLoadingStatus: "Fallback-Runtime wird geladen...",
    runtimeReadyStatus: "Fallback-Runtime aktiv",
    runtimeErrorStatus: "Fallback-Runtime Fehler",
    viewportPlaceholder: "Frontend-Build nicht aktiv. Fallback-Runtime läuft.",
    pointerLock: {
      title: "First-Person-Modus",
      message: "Klicke in den Editor, um den Mausfokus zu aktivieren.",
      hint: "Diese Datei ist nur der statische Fallback. Der modulare Build ersetzt sie später."
    },
    runtime: {
      mode: "single_viewport",
      firstPersonEnabled: true,
      debugOverlayEnabled: true,
      crosshairEnabled: true,
      showPlaceholder: true,
      allowPointerLock: true,
      worldMode: "test_world"
    },
    assets: {
      cssUrl: "/static/editor/css/editor.css",
      jsUrl: "/static/editor/js/main.js"
    }
  });

  var STATE = {
    started: false,
    startInProgress: false,
    failed: false,
    destroyed: false,
    bootstrap: null,
    animationHandle: null,
    lastFrameAt: null,
    viewportSize: {
      width: 0,
      height: 0,
      devicePixelRatio: 1
    },
    pointerLock: {
      supported: false,
      active: false,
      requested: false,
      lastChangedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null
    },
    render: {
      frameCount: 0,
      fps: 0,
      framesThisWindow: 0,
      lastFpsSampleAt: null
    },
    meta: {
      startedAt: null,
      stoppedAt: null,
      lastErrorMessage: null
    }
  };

  var CACHE = {
    bootstrap: null,
    publicApi: null,
    dom: {
      root: null,
      viewport: null,
      status: null,
      viewportPlaceholder: null,
      canvasHost: null,
      runtimeOverlay: null,
      pointerLockOverlay: null,
      bootstrapScript: null,
      runtimeCanvas: null,
      crosshair: null
    },
    listeners: {
      registered: false,
      clickHandler: null,
      resizeHandler: null,
      pointerLockChangeHandler: null,
      pointerLockErrorHandler: null,
      visibilityHandler: null
    }
  };


  // ---------------------------------------------------------------------------
  // Primitive Safe Helpers
  // ---------------------------------------------------------------------------

  function safeWindow() {
    try {
      return window;
    } catch (error) {
      return null;
    }
  }

  function safeDocument() {
    try {
      return document;
    } catch (error) {
      return null;
    }
  }

  function safeNow() {
    try {
      return Date.now();
    } catch (error) {
      return 0;
    }
  }

  function safePerformanceNow() {
    var win = safeWindow();

    try {
      if (win && win.performance && typeof win.performance.now === "function") {
        return win.performance.now();
      }
    } catch (error) {
      // bewusst still
    }

    return safeNow();
  }

  function safeConsole(method) {
    var win = safeWindow();
    var consoleRef = null;
    var args = [];
    var index = 1;

    try {
      consoleRef = win && win.console ? win.console : null;
    } catch (error) {
      consoleRef = null;
    }

    for (; index < arguments.length; index += 1) {
      args.push(arguments[index]);
    }

    if (!consoleRef) {
      return;
    }

    try {
      if (typeof consoleRef[method] === "function") {
        consoleRef[method].apply(consoleRef, args);
        return;
      }

      if (typeof consoleRef.log === "function") {
        consoleRef.log.apply(consoleRef, args);
      }
    } catch (error) {
      // bewusst still
    }
  }

  function safeString(value, fallback) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      return trimmed || fallback;
    }

    if (value === null || value === undefined) {
      return fallback;
    }

    try {
      var converted = String(value).trim();
      return converted || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeBoolean(value, fallback) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return !!value;
    }

    if (typeof value === "string") {
      var normalized = value.trim().toLowerCase();

      if (["1", "true", "t", "yes", "y", "on"].indexOf(normalized) >= 0) {
        return true;
      }

      if (["0", "false", "f", "no", "n", "off"].indexOf(normalized) >= 0) {
        return false;
      }
    }

    return fallback;
  }

  function safeNumber(value, fallback, minimum, maximum) {
    var result;

    try {
      result = Number(value);
    } catch (error) {
      result = Number(fallback);
    }

    if (!isFinite(result)) {
      result = Number(fallback);
    }

    if (!isFinite(result)) {
      result = 0;
    }

    if (typeof minimum === "number" && isFinite(minimum)) {
      result = Math.max(minimum, result);
    }

    if (typeof maximum === "number" && isFinite(maximum)) {
      result = Math.min(maximum, result);
    }

    return result;
  }

  function safeJsonParse(value, fallback) {
    if (typeof value !== "string" || !value.trim()) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Bootstrap-JSON konnte nicht geparst werden.", error);
      return fallback;
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function shallowMerge(base, override) {
    var merged = {};
    var key;

    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        merged[key] = base[key];
      }
    }

    if (override && typeof override === "object" && !Array.isArray(override)) {
      for (key in override) {
        if (Object.prototype.hasOwnProperty.call(override, key)) {
          merged[key] = override[key];
        }
      }
    }

    return merged;
  }

  function deepFreeze(value, seen) {
    var key;
    var localSeen = seen;

    try {
      if (!value || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
      }

      localSeen = localSeen || (typeof WeakSet === "function" ? new WeakSet() : null);

      if (localSeen && localSeen.has(value)) {
        return value;
      }

      if (localSeen) {
        localSeen.add(value);
      }

      Object.freeze(value);

      for (key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          deepFreeze(value[key], localSeen);
        }
      }
    } catch (error) {
      // bewusst still
    }

    return value;
  }

  function safeRequestAnimationFrame(callback) {
    var win = safeWindow();

    try {
      if (win && typeof win.requestAnimationFrame === "function") {
        return win.requestAnimationFrame(callback);
      }
    } catch (error) {
      // bewusst still
    }

    try {
      if (win && typeof win.setTimeout === "function") {
        return win.setTimeout(function () {
          callback(safePerformanceNow());
        }, 16);
      }
    } catch (error) {
      // bewusst still
    }

    return null;
  }

  function safeCancelAnimationFrame(handle) {
    var win = safeWindow();

    if (handle === null || handle === undefined) {
      return;
    }

    try {
      if (win && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(handle);
        return;
      }
    } catch (error) {
      // bewusst still
    }

    try {
      if (win && typeof win.clearTimeout === "function") {
        win.clearTimeout(handle);
      }
    } catch (timeoutError) {
      // bewusst still
    }
  }


  // ---------------------------------------------------------------------------
  // DOM Helpers
  // ---------------------------------------------------------------------------

  function getCachedElement(cacheKey, resolver) {
    var cached = CACHE.dom[cacheKey];

    try {
      if (cached && typeof cached.isConnected === "boolean" && cached.isConnected) {
        return cached;
      }
    } catch (error) {
      // bewusst still
    }

    try {
      var resolved = resolver();
      CACHE.dom[cacheKey] = resolved || null;
      return resolved || null;
    } catch (resolverError) {
      CACHE.dom[cacheKey] = null;
      safeConsole("warn", "[VECTOPLAN Editor] DOM-Resolver fehlgeschlagen:", cacheKey, resolverError);
      return null;
    }
  }

  function getRootElement() {
    return getCachedElement("root", function () {
      var doc = safeDocument();
      return doc && typeof doc.getElementById === "function"
        ? doc.getElementById("editor-app")
        : null;
    });
  }

  function getViewportElement() {
    return getCachedElement("viewport", function () {
      var doc = safeDocument();
      if (!doc || typeof doc.querySelector !== "function") {
        return null;
      }

      return doc.querySelector("[data-editor-viewport]") || doc.getElementById("editor-viewport");
    });
  }

  function getStatusElement() {
    return getCachedElement("status", function () {
      var doc = safeDocument();
      return doc && typeof doc.querySelector === "function"
        ? doc.querySelector("[data-editor-status]")
        : null;
    });
  }

  function getViewportPlaceholderElement() {
    return getCachedElement("viewportPlaceholder", function () {
      var doc = safeDocument();
      return doc && typeof doc.querySelector === "function"
        ? doc.querySelector("[data-viewport-placeholder]")
        : null;
    });
  }

  function getCanvasHostElement() {
    return getCachedElement("canvasHost", function () {
      var doc = safeDocument();
      return doc && typeof doc.querySelector === "function"
        ? doc.querySelector("[data-editor-canvas-host]")
        : null;
    });
  }

  function getRuntimeOverlayElement() {
    return getCachedElement("runtimeOverlay", function () {
      var doc = safeDocument();
      return doc && typeof doc.querySelector === "function"
        ? doc.querySelector("[data-editor-overlay='runtime']")
        : null;
    });
  }

  function getPointerLockOverlayElement() {
    return getCachedElement("pointerLockOverlay", function () {
      var doc = safeDocument();
      return doc && typeof doc.querySelector === "function"
        ? doc.querySelector("[data-editor-overlay='pointer-lock']")
        : null;
    });
  }

  function getBootstrapScriptElement() {
    return getCachedElement("bootstrapScript", function () {
      var doc = safeDocument();
      return doc && typeof doc.getElementById === "function"
        ? doc.getElementById("vectoplan-editor-bootstrap")
        : null;
    });
  }

  function getCrosshairElement() {
    return getCachedElement("crosshair", function () {
      var doc = safeDocument();
      return doc && typeof doc.querySelector === "function"
        ? doc.querySelector("[data-editor-crosshair]")
        : null;
    });
  }

  function safeSetText(element, value) {
    if (!element) {
      return;
    }

    try {
      element.textContent = safeString(value, "");
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] textContent konnte nicht gesetzt werden.", error);
    }
  }

  function safeSetAttribute(element, name, value) {
    if (!element || !name) {
      return;
    }

    try {
      element.setAttribute(name, safeString(value, ""));
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Attribut konnte nicht gesetzt werden.", name, error);
    }
  }

  function safeSetStyle(element, propertyName, value) {
    if (!element || !element.style || !propertyName) {
      return;
    }

    try {
      element.style[propertyName] = safeString(value, "");
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Style konnte nicht gesetzt werden.", propertyName, error);
    }
  }

  function ensureRuntimeCanvas() {
    var existing = CACHE.dom.runtimeCanvas;
    var canvasHost = getCanvasHostElement();
    var canvas;

    try {
      if (existing && typeof existing.isConnected === "boolean" && existing.isConnected) {
        return existing;
      }
    } catch (error) {
      // bewusst still
    }

    if (!canvasHost) {
      return null;
    }

    try {
      canvas = canvasHost.querySelector("canvas[data-editor-fallback-runtime='true']");
      if (canvas) {
        CACHE.dom.runtimeCanvas = canvas;
        return canvas;
      }
    } catch (error) {
      // bewusst still
    }

    try {
      canvas = safeDocument().createElement("canvas");
      canvas.setAttribute("data-editor-fallback-runtime", "true");
      canvas.setAttribute("aria-label", "Editor Fallback Runtime Canvas");
      canvas.setAttribute("tabindex", "0");

      safeSetStyle(canvas, "position", "absolute");
      safeSetStyle(canvas, "inset", "0");
      safeSetStyle(canvas, "width", "100%");
      safeSetStyle(canvas, "height", "100%");
      safeSetStyle(canvas, "display", "block");
      safeSetStyle(canvas, "background", "transparent");
      safeSetStyle(canvas, "outline", "none");

      canvasHost.appendChild(canvas);
      CACHE.dom.runtimeCanvas = canvas;
      return canvas;
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Fallback-Canvas konnte nicht erzeugt werden.", error);
      return null;
    }
  }


  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function readBootstrapFromScriptTag() {
    var element = getBootstrapScriptElement();
    var parsed = null;

    if (!element) {
      return {};
    }

    try {
      parsed = safeJsonParse(element.textContent || "", {});
    } catch (error) {
      parsed = {};
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  }

  function readBootstrapFromGlobal() {
    var win = safeWindow();
    var value = null;

    if (!win) {
      return {};
    }

    try {
      value = win.__VECTOPLAN_EDITOR_BOOTSTRAP__;
    } catch (error) {
      value = null;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  function readBootstrapFromDataset() {
    var root = getRootElement();
    var result = {};

    if (!root || !root.dataset) {
      return result;
    }

    try {
      if (root.dataset.pageTitle) {
        result.pageTitle = root.dataset.pageTitle;
      }

      if (root.dataset.route) {
        result.routePath = root.dataset.route;
      }

      if (root.dataset.runtimeMode || root.dataset.templateMode || root.dataset.worldMode ||
          root.dataset.firstPersonEnabled || root.dataset.debugOverlayEnabled || root.dataset.crosshairEnabled) {
        result.runtime = result.runtime || {};
      }

      if (root.dataset.runtimeMode) {
        result.runtime.mode = root.dataset.runtimeMode;
      } else if (root.dataset.templateMode) {
        result.runtime.mode = root.dataset.templateMode;
      }

      if (root.dataset.worldMode) {
        result.runtime.worldMode = root.dataset.worldMode;
      }

      if (root.dataset.firstPersonEnabled) {
        result.runtime.firstPersonEnabled = root.dataset.firstPersonEnabled;
      }

      if (root.dataset.debugOverlayEnabled) {
        result.runtime.debugOverlayEnabled = root.dataset.debugOverlayEnabled;
      }

      if (root.dataset.crosshairEnabled) {
        result.runtime.crosshairEnabled = root.dataset.crosshairEnabled;
      }
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Dataset-Bootstrap konnte nicht gelesen werden.", error);
    }

    return result;
  }

  function normalizeBootstrap(rawValue) {
    var raw = rawValue && typeof rawValue === "object" ? rawValue : {};
    var merged = shallowMerge(DEFAULT_BOOTSTRAP, raw);

    merged.pointerLock = shallowMerge(DEFAULT_BOOTSTRAP.pointerLock, raw.pointerLock);
    merged.runtime = shallowMerge(DEFAULT_BOOTSTRAP.runtime, raw.runtime);
    merged.assets = shallowMerge(DEFAULT_BOOTSTRAP.assets, raw.assets);

    merged.appName = safeString(merged.appName, DEFAULT_BOOTSTRAP.appName);
    merged.pageTitle = safeString(merged.pageTitle, DEFAULT_BOOTSTRAP.pageTitle);
    merged.brandName = safeString(merged.brandName, DEFAULT_BOOTSTRAP.brandName);
    merged.routePath = safeString(merged.routePath, DEFAULT_BOOTSTRAP.routePath);

    merged.initialStatus = safeString(merged.initialStatus, DEFAULT_BOOTSTRAP.initialStatus);
    merged.runtimeLoadingStatus = safeString(merged.runtimeLoadingStatus, DEFAULT_BOOTSTRAP.runtimeLoadingStatus);
    merged.runtimeReadyStatus = safeString(merged.runtimeReadyStatus, DEFAULT_BOOTSTRAP.runtimeReadyStatus);
    merged.runtimeErrorStatus = safeString(merged.runtimeErrorStatus, DEFAULT_BOOTSTRAP.runtimeErrorStatus);
    merged.viewportPlaceholder = safeString(merged.viewportPlaceholder, DEFAULT_BOOTSTRAP.viewportPlaceholder);

    merged.pointerLock.title = safeString(merged.pointerLock.title, DEFAULT_BOOTSTRAP.pointerLock.title);
    merged.pointerLock.message = safeString(merged.pointerLock.message, DEFAULT_BOOTSTRAP.pointerLock.message);
    merged.pointerLock.hint = safeString(merged.pointerLock.hint, DEFAULT_BOOTSTRAP.pointerLock.hint);

    merged.runtime.mode = safeString(merged.runtime.mode, DEFAULT_BOOTSTRAP.runtime.mode);
    merged.runtime.firstPersonEnabled = safeBoolean(merged.runtime.firstPersonEnabled, DEFAULT_BOOTSTRAP.runtime.firstPersonEnabled);
    merged.runtime.debugOverlayEnabled = safeBoolean(merged.runtime.debugOverlayEnabled, DEFAULT_BOOTSTRAP.runtime.debugOverlayEnabled);
    merged.runtime.crosshairEnabled = safeBoolean(merged.runtime.crosshairEnabled, DEFAULT_BOOTSTRAP.runtime.crosshairEnabled);
    merged.runtime.showPlaceholder = safeBoolean(merged.runtime.showPlaceholder, DEFAULT_BOOTSTRAP.runtime.showPlaceholder);
    merged.runtime.allowPointerLock = safeBoolean(merged.runtime.allowPointerLock, DEFAULT_BOOTSTRAP.runtime.allowPointerLock);
    merged.runtime.worldMode = safeString(merged.runtime.worldMode, DEFAULT_BOOTSTRAP.runtime.worldMode);

    merged.assets.cssUrl = safeString(merged.assets.cssUrl, DEFAULT_BOOTSTRAP.assets.cssUrl);
    merged.assets.jsUrl = safeString(merged.assets.jsUrl, DEFAULT_BOOTSTRAP.assets.jsUrl);

    return deepFreeze(merged);
  }

  function resolveBootstrap() {
    var merged;

    if (CACHE.bootstrap) {
      return CACHE.bootstrap;
    }

    try {
      merged = shallowMerge(DEFAULT_BOOTSTRAP, readBootstrapFromScriptTag());
      merged = shallowMerge(merged, readBootstrapFromGlobal());
      merged = shallowMerge(merged, readBootstrapFromDataset());

      merged.pointerLock = shallowMerge(DEFAULT_BOOTSTRAP.pointerLock, merged.pointerLock);
      merged.runtime = shallowMerge(DEFAULT_BOOTSTRAP.runtime, merged.runtime);
      merged.assets = shallowMerge(DEFAULT_BOOTSTRAP.assets, merged.assets);

      CACHE.bootstrap = normalizeBootstrap(merged);
    } catch (error) {
      safeConsole("error", "[VECTOPLAN Editor] Bootstrap-Auflösung fehlgeschlagen. Fallback wird verwendet.", error);
      CACHE.bootstrap = normalizeBootstrap(DEFAULT_BOOTSTRAP);
    }

    return CACHE.bootstrap;
  }


  // ---------------------------------------------------------------------------
  // Pointer Lock
  // ---------------------------------------------------------------------------

  function getPointerLockElement() {
    var doc = safeDocument();

    if (!doc) {
      return null;
    }

    try {
      return doc.pointerLockElement || null;
    } catch (error) {
      return null;
    }
  }

  function isPointerLockSupported() {
    var doc = safeDocument();
    var target = ensureRuntimeCanvas() || getViewportElement();

    try {
      return !!(
        doc &&
        typeof doc.exitPointerLock === "function" &&
        target &&
        typeof target.requestPointerLock === "function"
      );
    } catch (error) {
      return false;
    }
  }

  function isPointerLockElementWithinEditor(pointerLockElement) {
    var viewport = getViewportElement();
    var canvas = ensureRuntimeCanvas();

    if (!pointerLockElement) {
      return false;
    }

    try {
      return (
        pointerLockElement === canvas ||
        pointerLockElement === viewport
      );
    } catch (error) {
      return false;
    }
  }

  function syncPointerLockState() {
    var pointerLockElement = getPointerLockElement();
    var isActive = isPointerLockElementWithinEditor(pointerLockElement);

    STATE.pointerLock.supported = isPointerLockSupported();
    STATE.pointerLock.active = isActive;
    STATE.pointerLock.lastChangedAt = safeNow();

    syncRootMetadata();
  }

  function requestPointerLock() {
    var bootstrap = resolveBootstrap();
    var target = ensureRuntimeCanvas() || getViewportElement();

    if (!bootstrap.runtime.allowPointerLock || !bootstrap.runtime.firstPersonEnabled) {
      return false;
    }

    if (!target || typeof target.requestPointerLock !== "function") {
      STATE.pointerLock.supported = false;
      STATE.pointerLock.lastErrorMessage = "Pointer Lock wird vom Browser nicht unterstützt";
      syncRootMetadata();
      return false;
    }

    try {
      if (typeof target.focus === "function") {
        target.focus();
      }
    } catch (error) {
      // bewusst still
    }

    try {
      STATE.pointerLock.requested = true;
      target.requestPointerLock();
      return true;
    } catch (error) {
      STATE.pointerLock.requested = false;
      STATE.pointerLock.lastErrorAt = safeNow();
      STATE.pointerLock.lastErrorMessage = "Pointer Lock Anforderung fehlgeschlagen";
      safeConsole("warn", "[VECTOPLAN Editor] Pointer Lock konnte nicht angefordert werden.", error);
      syncRootMetadata();
      return false;
    }
  }

  function releasePointerLock() {
    var doc = safeDocument();

    if (!doc || typeof doc.exitPointerLock !== "function") {
      return false;
    }

    try {
      doc.exitPointerLock();
      return true;
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Pointer Lock konnte nicht gelöst werden.", error);
      return false;
    }
  }


  // ---------------------------------------------------------------------------
  // Status / Metadata / Exports
  // ---------------------------------------------------------------------------

  function applyDocumentTitle(title) {
    var doc = safeDocument();
    var finalTitle = safeString(title, DEFAULT_BOOTSTRAP.pageTitle);

    if (!doc) {
      return;
    }

    try {
      doc.title = finalTitle;
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Dokumenttitel konnte nicht gesetzt werden.", error);
    }
  }

  function setStatusMessage(message) {
    var bootstrap = resolveBootstrap();
    var statusElement = getStatusElement();
    safeSetText(statusElement, safeString(message, bootstrap.initialStatus));
  }

  function updateViewportPlaceholder(message) {
    var element = getViewportPlaceholderElement();
    var bootstrap = resolveBootstrap();
    safeSetText(element, safeString(message, bootstrap.viewportPlaceholder));
  }

  function syncOverlayVisibility() {
    var bootstrap = resolveBootstrap();
    var runtimeOverlay = getRuntimeOverlayElement();
    var pointerOverlay = getPointerLockOverlayElement();
    var crosshair = getCrosshairElement();

    if (runtimeOverlay) {
      safeSetStyle(runtimeOverlay, "display", bootstrap.runtime.debugOverlayEnabled ? "" : "none");
    }

    if (pointerOverlay) {
      safeSetStyle(pointerOverlay, "display", STATE.pointerLock.active ? "none" : "");
    }

    if (crosshair) {
      safeSetStyle(crosshair, "display", bootstrap.runtime.crosshairEnabled ? "" : "none");
      safeSetStyle(crosshair, "opacity", STATE.failed ? "0.45" : "1");
    }
  }

  function syncRootMetadata() {
    var root = getRootElement();
    var viewport = getViewportElement();
    var bootstrap = resolveBootstrap();

    if (!root) {
      return;
    }

    safeSetAttribute(root, "data-app-name", bootstrap.appName);
    safeSetAttribute(root, "data-route", bootstrap.routePath);
    safeSetAttribute(root, "data-runtime-version", RUNTIME_VERSION);
    safeSetAttribute(root, "data-runtime-started", STATE.started ? "true" : "false");
    safeSetAttribute(root, "data-runtime-failed", STATE.failed ? "true" : "false");
    safeSetAttribute(root, "data-template-mode", bootstrap.runtime.mode);
    safeSetAttribute(root, "data-runtime-mode", bootstrap.runtime.mode);
    safeSetAttribute(root, "data-world-mode", bootstrap.runtime.worldMode);
    safeSetAttribute(root, "data-first-person-enabled", bootstrap.runtime.firstPersonEnabled ? "true" : "false");
    safeSetAttribute(root, "data-debug-overlay-enabled", bootstrap.runtime.debugOverlayEnabled ? "true" : "false");
    safeSetAttribute(root, "data-crosshair-enabled", bootstrap.runtime.crosshairEnabled ? "true" : "false");
    safeSetAttribute(root, "data-pointer-lock-active", STATE.pointerLock.active ? "true" : "false");
    safeSetAttribute(root, "data-pointer-lock-supported", STATE.pointerLock.supported ? "true" : "false");

    if (viewport) {
      safeSetAttribute(viewport, "data-runtime-state", safeString(STATE.currentRuntimeState, "idle"));
      safeSetAttribute(viewport, "data-world-mode", bootstrap.runtime.worldMode);
      safeSetAttribute(viewport, "data-pointer-lock-state", STATE.pointerLock.active ? "locked" : (STATE.pointerLock.supported ? "unlocked" : "unsupported"));
      safeSetAttribute(viewport, "data-viewport-width", String(STATE.viewportSize.width));
      safeSetAttribute(viewport, "data-viewport-height", String(STATE.viewportSize.height));
    }

    syncOverlayVisibility();
  }

  function updateGlobalExports() {
    var win = safeWindow();
    if (!win) {
      return;
    }

    try {
      win.__VECTOPLAN_EDITOR_BOOTSTRAP__ = STATE.bootstrap || resolveBootstrap();
    } catch (error) {
      // bewusst still
    }

    try {
      win.__VECTOPLAN_EDITOR_RUNTIME_STARTED__ = !!STATE.started;
    } catch (error) {
      // bewusst still
    }

    try {
      win.__VECTOPLAN_EDITOR_TEMPLATE_MODE__ = resolveBootstrap().runtime.mode;
    } catch (error) {
      // bewusst still
    }

    try {
      win.__VECTOPLAN_EDITOR_RUNTIME_SOURCE__ = "static-fallback-main";
    } catch (error) {
      // bewusst still
    }

    try {
      win.__VECTOPLAN_EDITOR_RUNTIME_STATE__ = buildStateSnapshot();
    } catch (error) {
      // bewusst still
    }
  }


  // ---------------------------------------------------------------------------
  // Canvas Preview
  // ---------------------------------------------------------------------------

  function getCanvasContext2D() {
    var canvas = ensureRuntimeCanvas();

    if (!canvas || typeof canvas.getContext !== "function") {
      return null;
    }

    try {
      return canvas.getContext("2d", {
        alpha: false,
        desynchronized: true
      });
    } catch (error) {
      try {
        return canvas.getContext("2d");
      } catch (fallbackError) {
        safeConsole("warn", "[VECTOPLAN Editor] 2D-Canvas-Kontext konnte nicht erzeugt werden.", fallbackError);
        return null;
      }
    }
  }

  function resizeRuntimeCanvas(force) {
    var canvas = ensureRuntimeCanvas();
    var viewport = getViewportElement();
    var pixelRatio;
    var width;
    var height;
    var targetWidth;
    var targetHeight;

    if (!canvas || !viewport) {
      return false;
    }

    try {
      pixelRatio = clamp(
        safeNumber((safeWindow() && safeWindow().devicePixelRatio) || 1, 1, 1, 2),
        1,
        2
      );

      width = Math.max(1, safeNumber(viewport.clientWidth, 1, 1));
      height = Math.max(1, safeNumber(viewport.clientHeight, 1, 1));

      targetWidth = Math.max(1, Math.round(width * pixelRatio));
      targetHeight = Math.max(1, Math.round(height * pixelRatio));

      if (!force && canvas.width === targetWidth && canvas.height === targetHeight) {
        return false;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      STATE.viewportSize.width = width;
      STATE.viewportSize.height = height;
      STATE.viewportSize.devicePixelRatio = pixelRatio;
      STATE.lastResizeAt = safeNow();

      return true;
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Runtime Canvas konnte nicht skaliert werden.", error);
      return false;
    }
  }

  function drawBackground(context, width, height, timeMs) {
    var phase = (safeNumber(timeMs, 0) / 1000) * 0.2;
    var horizonShift = Math.sin(phase) * height * 0.04;
    var horizonY = clamp((height * 0.5) + horizonShift, height * 0.2, height * 0.8);
    var skyGradient;
    var groundGradient;

    try {
      skyGradient = context.createLinearGradient(0, 0, 0, horizonY);
      skyGradient.addColorStop(0, "#0b1220");
      skyGradient.addColorStop(0.58, "#111827");
      skyGradient.addColorStop(1, "#1e293b");

      context.fillStyle = skyGradient;
      context.fillRect(0, 0, width, horizonY);

      groundGradient = context.createLinearGradient(0, horizonY, 0, height);
      groundGradient.addColorStop(0, "#111827");
      groundGradient.addColorStop(0.18, "#0f172a");
      groundGradient.addColorStop(1, "#020617");

      context.fillStyle = groundGradient;
      context.fillRect(0, horizonY, width, height - horizonY);

      context.fillStyle = "rgba(255,255,255,0.03)";
      context.fillRect(0, horizonY - 1, width, 2);
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Hintergrund konnte nicht gerendert werden.", error);
    }
  }

  function drawGrid(context, width, height, timeMs) {
    var gridSize = 32;
    var offsetY = (safeNumber(timeMs, 0) * 0.02) % gridSize;
    var x;
    var y;

    try {
      context.save();
      context.strokeStyle = "rgba(148,163,184,0.12)";
      context.lineWidth = 1;

      for (x = 0; x <= width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      for (y = -gridSize; y <= height + gridSize; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y + offsetY);
        context.lineTo(width, y + offsetY);
        context.stroke();
      }

      context.restore();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Grid konnte nicht gerendert werden.", error);
    }
  }

  function drawFallbackLabel(context, width, height) {
    var bootstrap = resolveBootstrap();

    try {
      context.save();

      context.fillStyle = "rgba(255,255,255,0.07)";
      context.fillRect(16, 16, Math.min(420, width - 32), 54);

      context.fillStyle = "#f8fafc";
      context.font = "700 14px Arial, sans-serif";
      context.fillText(safeString(bootstrap.brandName, "VECTOPLAN Editor"), 28, 38);

      context.fillStyle = "#cbd5e1";
      context.font = "13px Arial, sans-serif";
      context.fillText("Statischer Fallback aktiv – der modulare Build ersetzt diese Datei.", 28, 58);

      context.restore();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Fallback-Label konnte nicht gezeichnet werden.", error);
    }
  }

  function renderRuntimeFrame(timestampMs) {
    var canvas = ensureRuntimeCanvas();
    var context = getCanvasContext2D();
    var width;
    var height;

    if (!canvas || !context) {
      return;
    }

    width = Math.max(1, canvas.width || 1);
    height = Math.max(1, canvas.height || 1);

    try {
      context.save();
      context.clearRect(0, 0, width, height);
      drawBackground(context, width, height, timestampMs);
      drawGrid(context, width, height, timestampMs);
      drawFallbackLabel(context, width, height);
      context.restore();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Runtime-Frame konnte nicht gerendert werden.", error);
    }
  }


  // ---------------------------------------------------------------------------
  // Render Metrics / Loop
  // ---------------------------------------------------------------------------

  function updateRenderMetrics(timestampMs) {
    if (!STATE.render.lastFpsSampleAt) {
      STATE.render.lastFpsSampleAt = timestampMs;
      STATE.render.framesThisWindow = 0;
      STATE.render.fps = 0;
    }

    if (STATE.lastFrameAt !== null) {
      // reserved for future timing extensions
    }

    STATE.render.framesThisWindow += 1;

    if ((timestampMs - STATE.render.lastFpsSampleAt) >= 1000) {
      STATE.render.fps = (STATE.render.framesThisWindow * 1000) / Math.max(1, (timestampMs - STATE.render.lastFpsSampleAt));
      STATE.render.framesThisWindow = 0;
      STATE.render.lastFpsSampleAt = timestampMs;
    }

    STATE.render.frameCount += 1;
  }

  function updateDebugPanel() {
    var bootstrap = resolveBootstrap();
    var panel = getRuntimeOverlayElement();
    var lines;

    if (!bootstrap.runtime.debugOverlayEnabled || !panel) {
      return;
    }

    lines = [
      "mode: " + safeString(bootstrap.runtime.mode, "single_viewport"),
      "world: " + safeString(bootstrap.runtime.worldMode, "test_world"),
      "source: static-fallback-main.js",
      "pointer_lock: " + (STATE.pointerLock.active ? "locked" : (STATE.pointerLock.supported ? "ready" : "unsupported")),
      "fps: " + safeNumber(STATE.render.fps, 0).toFixed(1),
      "viewport: " + safeNumber(STATE.viewportSize.width, 0) + "x" + safeNumber(STATE.viewportSize.height, 0),
      "status: " + safeString(STATE.currentRuntimeState, "idle")
    ];

    safeSetAttribute(panel, "data-fallback-runtime", "true");

    try {
      var existingDebug = panel.querySelector("[data-editor-debug-panel]");
      if (!existingDebug) {
        existingDebug = safeDocument().createElement("div");
        existingDebug.setAttribute("data-editor-debug-panel", "true");
        safeSetStyle(existingDebug, "marginTop", "10px");
        safeSetStyle(existingDebug, "paddingTop", "8px");
        safeSetStyle(existingDebug, "borderTop", "1px solid rgba(255,255,255,0.08)");
        safeSetStyle(existingDebug, "fontFamily", "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace");
        safeSetStyle(existingDebug, "fontSize", "12px");
        safeSetStyle(existingDebug, "lineHeight", "1.45");
        safeSetStyle(existingDebug, "whiteSpace", "pre-wrap");
        safeSetStyle(existingDebug, "color", "#cbd5e1");
        panel.appendChild(existingDebug);
      }

      safeSetText(existingDebug, lines.join("\n"));
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Debug-Panel konnte nicht aktualisiert werden.", error);
    }
  }

  function animationLoop(timestampMs) {
    if (!STATE.started || STATE.failed || STATE.destroyed) {
      return;
    }

    try {
      updateRenderMetrics(timestampMs);
      renderRuntimeFrame(timestampMs);
      updateDebugPanel();
      updateGlobalExports();

      STATE.animationHandle = safeRequestAnimationFrame(animationLoop);
    } catch (error) {
      markRuntimeError("Fallback-Runtime Loop fehlgeschlagen.", error);
    }
  }

  function startRenderLoop() {
    if (STATE.animationHandle !== null) {
      safeCancelAnimationFrame(STATE.animationHandle);
      STATE.animationHandle = null;
    }

    STATE.animationHandle = safeRequestAnimationFrame(animationLoop);
  }

  function stopRenderLoop() {
    if (STATE.animationHandle !== null) {
      safeCancelAnimationFrame(STATE.animationHandle);
      STATE.animationHandle = null;
    }
  }


  // ---------------------------------------------------------------------------
  // Snapshot / Error Handling
  // ---------------------------------------------------------------------------

  function buildStateSnapshot() {
    return deepFreeze({
      runtimeName: RUNTIME_NAME,
      runtimeVersion: RUNTIME_VERSION,
      started: !!STATE.started,
      startInProgress: !!STATE.startInProgress,
      failed: !!STATE.failed,
      destroyed: !!STATE.destroyed,
      currentRuntimeState: safeString(STATE.currentRuntimeState, "idle"),
      lastErrorMessage: STATE.lastErrorMessage || STATE.meta.lastErrorMessage,
      viewportSize: {
        width: safeNumber(STATE.viewportSize.width, 0, 0),
        height: safeNumber(STATE.viewportSize.height, 0, 0),
        devicePixelRatio: safeNumber(STATE.viewportSize.devicePixelRatio, 1, 1)
      },
      pointerLock: {
        supported: !!STATE.pointerLock.supported,
        active: !!STATE.pointerLock.active,
        requested: !!STATE.pointerLock.requested,
        lastChangedAt: STATE.pointerLock.lastChangedAt,
        lastErrorAt: STATE.pointerLock.lastErrorAt,
        lastErrorMessage: STATE.pointerLock.lastErrorMessage
      },
      render: {
        frameCount: safeNumber(STATE.render.frameCount, 0, 0),
        fps: safeNumber(STATE.render.fps, 0, 0)
      },
      bootstrap: STATE.bootstrap || resolveBootstrap(),
      source: "static-fallback-main.js"
    });
  }

  function markRuntimeError(message, error) {
    var bootstrap = resolveBootstrap();
    var finalMessage = safeString(message, bootstrap.runtimeErrorStatus);

    STATE.failed = true;
    STATE.startInProgress = false;
    STATE.started = false;
    STATE.currentRuntimeState = "error";
    STATE.lastErrorMessage = finalMessage;
    STATE.meta.lastErrorMessage = finalMessage;

    stopRenderLoop();

    setStatusMessage(finalMessage);
    syncRootMetadata();
    updateDebugPanel();
    updateGlobalExports();

    safeConsole("error", "[VECTOPLAN Editor] " + finalMessage, error || null);
  }


  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  function handleViewportClick() {
    requestPointerLock();
  }

  function handleWindowResize() {
    try {
      resizeRuntimeCanvas(true);
      syncRootMetadata();
      updateDebugPanel();
      renderRuntimeFrame(safePerformanceNow());
      updateGlobalExports();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Resize-Verarbeitung fehlgeschlagen.", error);
    }
  }

  function handleVisibilityChange() {
    var doc = safeDocument();

    try {
      if (doc && doc.visibilityState === "hidden") {
        stopRenderLoop();
      } else if (STATE.started && !STATE.failed) {
        startRenderLoop();
      }

      updateGlobalExports();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] visibilitychange konnte nicht verarbeitet werden.", error);
    }
  }

  function handlePointerLockChange() {
    syncPointerLockState();

    if (STATE.pointerLock.active) {
      setStatusMessage("Fallback-Runtime aktiv · Pointer Lock an");
    } else if (STATE.started && !STATE.failed) {
      setStatusMessage(resolveBootstrap().runtimeReadyStatus);
    }

    updateDebugPanel();
    updateGlobalExports();
  }

  function handlePointerLockError() {
    STATE.pointerLock.supported = isPointerLockSupported();
    STATE.pointerLock.active = false;
    STATE.pointerLock.requested = false;
    STATE.pointerLock.lastErrorAt = safeNow();
    STATE.pointerLock.lastErrorMessage = "Pointer Lock Fehler";
    setStatusMessage("Pointer Lock nicht verfügbar");
    syncRootMetadata();
    updateDebugPanel();
    updateGlobalExports();
  }

  function registerGlobalListeners() {
    var win = safeWindow();
    var doc = safeDocument();
    var target = ensureRuntimeCanvas() || getViewportElement();

    if (CACHE.listeners.registered) {
      return;
    }

    CACHE.listeners.clickHandler = handleViewportClick;
    CACHE.listeners.resizeHandler = handleWindowResize;
    CACHE.listeners.pointerLockChangeHandler = handlePointerLockChange;
    CACHE.listeners.pointerLockErrorHandler = handlePointerLockError;
    CACHE.listeners.visibilityHandler = handleVisibilityChange;

    try {
      if (target && typeof target.addEventListener === "function") {
        target.addEventListener("click", CACHE.listeners.clickHandler);
      }
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Click-Listener konnte nicht registriert werden.", error);
    }

    try {
      if (win && typeof win.addEventListener === "function") {
        win.addEventListener("resize", CACHE.listeners.resizeHandler, { passive: true });
      }
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Resize-Listener konnte nicht registriert werden.", error);
    }

    try {
      if (doc && typeof doc.addEventListener === "function") {
        doc.addEventListener("pointerlockchange", CACHE.listeners.pointerLockChangeHandler);
        doc.addEventListener("pointerlockerror", CACHE.listeners.pointerLockErrorHandler);
        doc.addEventListener("visibilitychange", CACHE.listeners.visibilityHandler);
      }
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Document-Listener konnten nicht vollständig registriert werden.", error);
    }

    CACHE.listeners.registered = true;
  }

  function unregisterGlobalListeners() {
    var win = safeWindow();
    var doc = safeDocument();
    var target = ensureRuntimeCanvas() || getViewportElement();

    if (!CACHE.listeners.registered) {
      return;
    }

    try {
      if (target && typeof target.removeEventListener === "function" && CACHE.listeners.clickHandler) {
        target.removeEventListener("click", CACHE.listeners.clickHandler);
      }
    } catch (error) {
      // bewusst still
    }

    try {
      if (win && typeof win.removeEventListener === "function" && CACHE.listeners.resizeHandler) {
        win.removeEventListener("resize", CACHE.listeners.resizeHandler);
      }
    } catch (error) {
      // bewusst still
    }

    try {
      if (doc && typeof doc.removeEventListener === "function") {
        if (CACHE.listeners.pointerLockChangeHandler) {
          doc.removeEventListener("pointerlockchange", CACHE.listeners.pointerLockChangeHandler);
        }
        if (CACHE.listeners.pointerLockErrorHandler) {
          doc.removeEventListener("pointerlockerror", CACHE.listeners.pointerLockErrorHandler);
        }
        if (CACHE.listeners.visibilityHandler) {
          doc.removeEventListener("visibilitychange", CACHE.listeners.visibilityHandler);
        }
      }
    } catch (error) {
      // bewusst still
    }

    CACHE.listeners.registered = false;
  }


  // ---------------------------------------------------------------------------
  // Runtime Lifecycle
  // ---------------------------------------------------------------------------

  function startEditorRuntime() {
    var bootstrap;
    var canvas;

    if (STATE.destroyed) {
      return buildStateSnapshot();
    }

    if (STATE.started) {
      updateGlobalExports();
      return buildStateSnapshot();
    }

    if (STATE.startInProgress) {
      return buildStateSnapshot();
    }

    STATE.startInProgress = true;
    STATE.failed = false;
    STATE.meta.lastErrorMessage = null;
    STATE.lastErrorMessage = null;

    try {
      bootstrap = resolveBootstrap();
      STATE.bootstrap = bootstrap;

      applyDocumentTitle(bootstrap.pageTitle);
      setStatusMessage(bootstrap.runtimeLoadingStatus);
      updateViewportPlaceholder(bootstrap.viewportPlaceholder);

      canvas = ensureRuntimeCanvas();
      if (!canvas) {
        throw new Error("Fallback-Canvas konnte nicht erzeugt werden.");
      }

      registerGlobalListeners();
      resizeRuntimeCanvas(true);
      syncPointerLockState();

      STATE.started = true;
      STATE.startInProgress = false;
      STATE.currentRuntimeState = "running";
      STATE.meta.startedAt = safeNow();
      STATE.meta.stoppedAt = null;

      setStatusMessage(bootstrap.runtimeReadyStatus);
      syncRootMetadata();
      updateDebugPanel();
      updateGlobalExports();

      startRenderLoop();

      safeConsole("info", "[VECTOPLAN Editor] Fallback-Runtime erfolgreich gestartet.", buildStateSnapshot());
      return buildStateSnapshot();
    } catch (error) {
      markRuntimeError("Fallback-Runtime Start fehlgeschlagen.", error);
      return buildStateSnapshot();
    }
  }

  function stopEditorRuntime() {
    if ((!STATE.started && !STATE.startInProgress) || STATE.destroyed) {
      return buildStateSnapshot();
    }

    try {
      stopRenderLoop();
      unregisterGlobalListeners();
      releasePointerLock();

      STATE.started = false;
      STATE.startInProgress = false;
      STATE.pointerLock.active = false;
      STATE.pointerLock.requested = false;
      STATE.currentRuntimeState = "stopped";
      STATE.meta.stoppedAt = safeNow();

      setStatusMessage("Fallback-Runtime gestoppt");
      syncRootMetadata();
      updateDebugPanel();
      updateGlobalExports();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Fallback-Runtime konnte nicht sauber gestoppt werden.", error);
    }

    return buildStateSnapshot();
  }

  function restartEditorRuntime() {
    try {
      stopEditorRuntime();
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Fallback-Restart: Stop fehlgeschlagen.", error);
    }

    return startEditorRuntime();
  }

  function destroyEditorRuntime() {
    if (STATE.destroyed) {
      return buildStateSnapshot();
    }

    stopEditorRuntime();
    STATE.destroyed = true;
    STATE.currentRuntimeState = "stopped";
    updateGlobalExports();

    return buildStateSnapshot();
  }

  function setRuntimeStatus(message) {
    setStatusMessage(message);
    updateGlobalExports();
    return buildStateSnapshot();
  }

  function setRuntimeViewportMessage(message) {
    updateViewportPlaceholder(message);
    updateGlobalExports();
    return buildStateSnapshot();
  }

  function getRuntimeState() {
    return buildStateSnapshot();
  }

  function getRuntimeBootstrap() {
    return STATE.bootstrap || resolveBootstrap();
  }

  function exposePublicApi() {
    var win = safeWindow();

    if (!win) {
      return null;
    }

    if (CACHE.publicApi) {
      return CACHE.publicApi;
    }

    CACHE.publicApi = Object.freeze({
      start: startEditorRuntime,
      stop: stopEditorRuntime,
      restart: restartEditorRuntime,
      destroy: destroyEditorRuntime,
      getState: getRuntimeState,
      getBootstrap: getRuntimeBootstrap,
      setStatus: setRuntimeStatus,
      setViewportMessage: setRuntimeViewportMessage,
      requestPointerLock: requestPointerLock,
      releasePointerLock: releasePointerLock,
      markError: function (message, error) {
        markRuntimeError(message, error);
        return buildStateSnapshot();
      }
    });

    try {
      win.VECTOPLAN_EDITOR_RUNTIME = CACHE.publicApi;
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] Öffentliche Runtime-API konnte nicht exportiert werden.", error);
    }

    updateGlobalExports();
    return CACHE.publicApi;
  }


  // ---------------------------------------------------------------------------
  // DOM Ready
  // ---------------------------------------------------------------------------

  function onDomReady(callback) {
    var doc = safeDocument();

    if (!doc) {
      try {
        callback();
      } catch (error) {
        safeConsole("error", "[VECTOPLAN Editor] DOM-Ready Callback ohne Dokument fehlgeschlagen.", error);
      }
      return;
    }

    try {
      if (doc.readyState === "interactive" || doc.readyState === "complete") {
        callback();
        return;
      }

      doc.addEventListener(
        "DOMContentLoaded",
        function handleReady() {
          try {
            callback();
          } catch (error) {
            safeConsole("error", "[VECTOPLAN Editor] DOMContentLoaded Callback fehlgeschlagen.", error);
          }
        },
        { once: true }
      );
    } catch (error) {
      safeConsole("warn", "[VECTOPLAN Editor] DOM-Ready Registrierung fehlgeschlagen. Direkter Start wird versucht.", error);

      try {
        callback();
      } catch (callbackError) {
        safeConsole("error", "[VECTOPLAN Editor] Direktstart nach DOM-Ready Fehler fehlgeschlagen.", callbackError);
      }
    }
  }


  // ---------------------------------------------------------------------------
  // Bootstrap Entry
  // ---------------------------------------------------------------------------

  exposePublicApi();

  onDomReady(function () {
    try {
      startEditorRuntime();
    } catch (error) {
      markRuntimeError("Fallback-Runtime Initialisierung auf DOM-Ebene fehlgeschlagen.", error);
    }
  });
})();