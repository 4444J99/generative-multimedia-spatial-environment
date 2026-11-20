'use strict';

/**
 * @file ChamberLoader.js
 * @description Singleton that manages lazy loading of chamber HTML fragments,
 * CSS, and JS. Chambers register their asset manifest; on first navigation,
 * ChamberLoader fetches the fragment, injects it into the placeholder <section>,
 * and loads the declared scripts in order.
 *
 * @requires ScriptLoader
 */

// eslint-disable-next-line no-unused-vars
class ChamberLoader {
  /** @type {ChamberLoader|null} */
  static _instance = null;

  /**
   * Get the singleton instance.
   * @returns {ChamberLoader}
   */
  static getInstance() {
    if (!ChamberLoader._instance) {
      ChamberLoader._instance = new ChamberLoader();
    }
    return ChamberLoader._instance;
  }

  constructor() {
    /** @type {Map<string, Object>} chamberId → manifest */
    this._manifests = new Map();

    /** @type {Map<string, Promise<void>>} chamberId → in-flight load promise */
    this._loadPromises = new Map();

    /** @type {Set<string>} Successfully loaded chamber IDs */
    this._loaded = new Set();

    /** @type {Map<string, Promise<void>>} chamberId → in-flight preload promise */
    this._preloadPromises = new Map();
  }

  /**
   * Register a chamber's asset manifest.
   *
   * @param {string} chamberId - Chamber ID (without '#'), e.g. 'akademia'
   * @param {Object} manifest
   * @param {string} manifest.html - Path to the HTML fragment file
   * @param {Array<string|Object>} [manifest.scripts=[]] - Scripts to load (passed to ScriptLoader.loadSequence)
   * @param {string[]} [manifest.styles=[]] - CSS files to load
   */
  register(chamberId, manifest) {
    this._manifests.set(chamberId, {
      html: manifest.html || '',
      scripts: manifest.scripts || [],
      styles: manifest.styles || [],
    });
  }

  /**
   * Check if a chamber is registered.
   * @param {string} chamberId
   * @returns {boolean}
   */
  isRegistered(chamberId) {
    return this._manifests.has(chamberId);
  }

  /** Return declared scripts without loading the chamber or exposing its registry. */
  getScripts(chamberId) {
    return (this._manifests.get(chamberId)?.scripts || []).map(script =>
      typeof script === 'string' ? script : { ...script }
    );
  }

  /**
   * Check if a chamber's assets have been fully loaded.
   * @param {string} chamberId
   * @returns {boolean}
   */
  isLoaded(chamberId) {
    return this._loaded.has(chamberId);
  }

  /**
   * Ensure a chamber's fragment and scripts are loaded.
   * Idempotent: second call returns the same promise.
   *
   * @param {string} chamberId
   * @returns {Promise<void>}
   */
  ensureLoaded(chamberId) {
    if (this._loaded.has(chamberId)) {
      return Promise.resolve();
    }

    if (this._loadPromises.has(chamberId)) {
      return this._loadPromises.get(chamberId);
    }

    const promise = this._doLoad(chamberId);
    this._loadPromises.set(chamberId, promise);
    return promise;
  }

  /**
   * Background-fetch the HTML fragment without loading scripts.
   * Useful for anticipatory preloading of likely-next chambers.
   *
   * @param {string} chamberId
   * @returns {Promise<void>}
   */
  preload(chamberId) {
    if (this._loaded.has(chamberId) || this._loadPromises.has(chamberId)) {
      return Promise.resolve();
    }

    if (this._preloadPromises.has(chamberId)) {
      return this._preloadPromises.get(chamberId);
    }

    const manifest = this._manifests.get(chamberId);
    if (!manifest || !manifest.html) {
      return Promise.resolve();
    }

    // Check connection: skip preloading on saveData or 2g
    if (this._shouldSkipPreload()) {
      return Promise.resolve();
    }

    const promise = fetch(manifest.html)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Preload failed: ${res.status}`);
        }
        return res.text();
      })
      .then(() => {
        // Fragment fetched and cached by browser; actual injection happens in ensureLoaded
      })
      .catch(err => {
        console.warn(
          `ChamberLoader preload warning for ${chamberId}:`,
          err.message
        );
        this._preloadPromises.delete(chamberId);
      });

    this._preloadPromises.set(chamberId, promise);
    return promise;
  }

  /**
   * Internal: perform the full load sequence for a chamber.
   * @param {string} chamberId
   * @returns {Promise<void>}
   * @private
   */
  async _doLoad(chamberId) {
    const manifest = this._manifests.get(chamberId);
    if (!manifest) {
      throw new Error(`ChamberLoader: no manifest for "${chamberId}"`);
    }

    const el = document.querySelector(`#${chamberId}`);

    try {
      // 1. Load CSS (parallel, non-blocking)
      if (manifest.styles.length > 0) {
        this._loadStyles(manifest.styles);
      }

      // 2. Fetch and inject HTML fragment
      if (manifest.html) {
        await this._loadFragment(
          chamberId,
          manifest.html,
          /** @type {HTMLElement} */ (el)
        );
      }

      // 3. Load scripts in order
      if (manifest.scripts.length > 0 && typeof ScriptLoader !== 'undefined') {
        await ScriptLoader.loadSequence(manifest.scripts);
      }

      this._loaded.add(chamberId);
    } catch (err) {
      // A fetched fragment does not prove its scripts loaded. Never count an
      // error message or partially loaded chamber as successful inline content.
      this._loadPromises.delete(chamberId);
      throw err;
    }
  }

  /**
   * Fetch an HTML fragment and inject it into the target element.
   * @param {string} chamberId
   * @param {string} htmlPath
   * @param {HTMLElement} el
   * @returns {Promise<void>}
   * @private
   */
  async _loadFragment(chamberId, htmlPath, el) {
    if (!el) {
      throw new Error(`ChamberLoader: no element found for #${chamberId}`);
    }

    // Skip if content already present (e.g. still inline, or already injected)
    if (el.innerHTML.trim().length > 0) {
      return;
    }

    const response = await fetch(htmlPath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${htmlPath}`);
    }

    const html = await response.text();
    el.innerHTML = html;
  }

  /**
   * Load CSS stylesheets that haven't been loaded yet.
   * @param {string[]} styles
   * @private
   */
  _loadStyles(styles) {
    for (const href of styles) {
      if (document.querySelector(`link[href="${href}"]`)) {
        continue;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  /**
   * Check if preloading should be skipped based on connection quality.
   * @returns {boolean}
   * @private
   */
  _shouldSkipPreload() {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (!conn) {
      return false;
    }
    if (conn.saveData) {
      return true;
    }
    if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
      return true;
    }
    return false;
  }

  /**
   * Whether preloading should be skipped based on connection quality.
   * Public read of the internal check, for navigation in page.js.
   * @returns {boolean}
   */
  shouldSkipPreload() {
    return this._shouldSkipPreload();
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._manifests.clear();
    this._loadPromises.clear();
    this._loaded.clear();
    this._preloadPromises.clear();
    ChamberLoader._instance = null;
  }
}
