/**
 * @file MorphingImageSystem.js
 * @description Morphing image system for photo→glitch→abstract transitions
 * Implements multi-phase transitions over 60 seconds with blend mode cycling
 *
 * Transition Phases (60 seconds total):
 * -----------------------------------
 * Phase 1 (0-20s): Normal → Glitch
 *   - Gradually apply glitch filters: blur, hue-rotate, saturate
 *   - Increase distortion intensity
 *
 * Phase 2 (20-40s): Glitch → Abstract
 *   - Mix blend modes cycling through configured modes
 *   - More intense filters: contrast, brightness, blur
 *   - Create artistic/abstract appearance
 *
 * Phase 3 (40-60s): Abstract → Normal
 *   - Gradually transition back to clean state
 *   - Reduce filter intensity
 *   - Return to original blend mode (normal)
 *
 * Configuration (from ETCETER4_CONFIG.livingPantheon.morphing):
 * - enabled: true
 * - transitionDuration: 60000 (60 seconds)
 * - pauseBetween: 30000 (pause between cycles)
 * - targetSelectors: ['.morph-image', '.morphing-target']
 * - blendModes: ['normal', 'multiply', 'screen', 'overlay', 'difference']
 *
 * Usage:
 * ------
 * const morphSystem = new MorphingImageSystem();
 * morphSystem.start();
 *
 * // Later...
 * morphSystem.stop();
 * morphSystem.dispose();
 */

'use strict';

/**
 * MorphingImageSystem - Manages progressive image morphing transitions
 * @class
 */
/**
 * Morphing-image configuration, mirroring
 * ETCETER4_CONFIG.livingPantheon.morphing (js/config.js). Every field is
 * optional: the constructor merges its own defaults over the global section.
 *
 * @typedef {Object} MorphingOptions
 * @property {boolean} [enabled]
 * @property {number} [transitionDuration] - Total transition duration in ms
 * @property {number} [pauseBetween] - Pause between morph cycles in ms
 * @property {string[]} [targetSelectors] - CSS selectors for images to morph
 * @property {string[]} [blendModes] - Blend modes to cycle through
 */
class MorphingImageSystem {
  /**
   * Create a new MorphingImageSystem instance
   * @param {MorphingOptions} [options] - Configuration options
   */
  constructor(options = {}) {
    // Get configuration from global config or use defaults
    /** @type {MorphingOptions} */
    const configFromGlobal =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon?.morphing || {}
        : {};

    // Merge options with config and defaults
    this.config = {
      enabled: configFromGlobal.enabled !== false,
      transitionDuration:
        options.transitionDuration ??
        configFromGlobal.transitionDuration ??
        60000,
      pauseBetween:
        options.pauseBetween ?? configFromGlobal.pauseBetween ?? 30000,
      targetSelectors: options.targetSelectors ??
        configFromGlobal.targetSelectors ?? [
          '.morph-image',
          '.morphing-target',
        ],
      blendModes: options.blendModes ??
        configFromGlobal.blendModes ?? [
          'normal',
          'multiply',
          'screen',
          'overlay',
          'difference',
        ],
    };

    // State tracking
    this.isRunning = false;
    this.activeMorphs = new Map(); // Map of element -> morph state
    this.pendingAnimationFrames = new Set();
    this.pauseTimeouts = new Set();
    this.morphStartTime = null;
    this.currentBlendModeIndex = 0;

    // Bind methods
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /**
   * Start the morphing system
   * @returns {MorphingImageSystem} Returns this for chaining
   */
  start() {
    if (this.isRunning || !this.config.enabled) {
      return this;
    }

    // Check for prefers-reduced-motion
    if (this._prefersReducedMotion()) {
      console.info(
        'MorphingImageSystem: Disabled due to prefers-reduced-motion'
      );
      return this;
    }

    this.isRunning = true;

    // Find and initialize all target images
    this._initializeTargetImages();

    // Start morphing cycle for each image
    for (const element of this.activeMorphs.keys()) {
      this._startMorphCycle(element);
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    return this;
  }

  /**
   * Stop the morphing system
   * @returns {MorphingImageSystem} Returns this for chaining
   */
  stop() {
    this.isRunning = false;

    // Cancel all pending animation frames
    for (const frameId of this.pendingAnimationFrames) {
      cancelAnimationFrame(frameId);
    }
    this.pendingAnimationFrames.clear();

    // Clear all pending timeouts
    for (const timeoutId of this.pauseTimeouts) {
      clearTimeout(timeoutId);
    }
    this.pauseTimeouts.clear();

    // Reset all elements to original state
    for (const [element, state] of this.activeMorphs) {
      element.style.filter = '';
      element.style.mixBlendMode = '';
    }

    // Remove visibility listener
    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    return this;
  }

  /**
   * Dispose of all resources and clean up
   */
  dispose() {
    this.stop();
    this.activeMorphs.clear();
    this.morphStartTime = null;
  }

  /**
   * Manually trigger a morph on a specific element
   * @param {Element|string} element - Element or selector to morph
   * @returns {boolean} True if morph was triggered, false if element not found
   */
  triggerMorph(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }

    if (!element) {
      return false;
    }

    // If not in active morphs, add it
    if (!this.activeMorphs.has(element)) {
      this._initializeElement(element);
    }

    // Start morph cycle for this element
    this._startMorphCycle(element);

    return true;
  }

  /**
   * Get current system status
   * @returns {Object} Status object with running state and active morph count
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeMorphCount: this.activeMorphs.size,
      config: { ...this.config },
    };
  }

  /**
   * Initialize all target image elements
   * @private
   */
  _initializeTargetImages() {
    for (const selector of this.config.targetSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        this._initializeElement(element);
      }
    }
  }

  /**
   * Initialize a single element
   * @private
   * @param {Element} element
   */
  _initializeElement(element) {
    if (this.activeMorphs.has(element)) {
      return;
    }

    // Skip elements that aren't visible
    if (!this._isElementVisible(element)) {
      return;
    }

    this.activeMorphs.set(element, {
      phase: 0, // 0 = not started, 1 = glitch, 2 = abstract, 3 = return to normal
      startTime: null,
      originalFilter: /** @type {HTMLElement} */ (element).style.filter,
      originalBlendMode: /** @type {HTMLElement} */ (element).style
        .mixBlendMode,
    });
  }

  /**
   * Check if an element is visible in the viewport
   * @private
   * @param {Element} element
   * @returns {boolean}
   */
  _isElementVisible(element) {
    const style = window.getComputedStyle(element);

    // Check basic visibility properties
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }

    // Check if element has dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    // Check if element is in viewport
    const inViewport =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    return inViewport;
  }

  /**
   * Check if user prefers reduced motion
   * @private
   * @returns {boolean}
   */
  _prefersReducedMotion() {
    return (
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    );
  }

  /**
   * Handle visibility change events
   * @private
   */
  _onVisibilityChange() {
    if (document.hidden) {
      // Pause morphing when page is hidden
      this.stop();
    } else if (this.isRunning) {
      // Resume morphing when page becomes visible
      for (const element of this.activeMorphs.keys()) {
        this._startMorphCycle(element);
      }
    }
  }

  /**
   * Start a morph cycle for an element
   * @private
   * @param {Element} element
   */
  _startMorphCycle(element) {
    if (!this.isRunning || !this.activeMorphs.has(element)) {
      return;
    }

    const state = this.activeMorphs.get(element);
    state.startTime = performance.now();
    state.phase = 1;

    this._performMorphFrame(element);
  }

  /**
   * Perform a single animation frame of morphing
   * @private
   * @param {Element} element
   */
  _performMorphFrame(element) {
    if (!this.isRunning || !this.activeMorphs.has(element)) {
      return;
    }

    const state = this.activeMorphs.get(element);
    const currentTime = performance.now();
    const elapsed = currentTime - state.startTime;
    const progress = Math.min(elapsed / this.config.transitionDuration, 1);

    // Apply morphing based on current phase
    if (progress < 1) {
      this._applyMorphing(element, progress);

      // Schedule next frame
      const frameId = requestAnimationFrame(() =>
        this._performMorphFrame(element)
      );
      this.pendingAnimationFrames.add(frameId);
    } else {
      // Morph cycle complete - reset and schedule pause
      /** @type {HTMLElement} */ (element).style.filter = '';
      /** @type {HTMLElement} */ (element).style.mixBlendMode = '';

      state.phase = 0;

      // Schedule pause before next cycle
      const timeoutId = setTimeout(() => {
        this._startMorphCycle(element);
      }, this.config.pauseBetween);

      this.pauseTimeouts.add(timeoutId);
    }
  }

  /**
   * Apply morphing filters based on progress through cycle
   * @private
   * @param {Element} element
   * @param {number} progress - 0 to 1, total progress through morph cycle
   */
  _applyMorphing(element, progress) {
    const filters = [];
    let blendMode = 'normal';

    if (progress < 0.333) {
      // Phase 1 (0-20s, 0-0.333): Normal → Glitch
      const phaseProgress = progress / 0.333;

      const blur = Math.ceil(phaseProgress * 8); // 0 to 8px blur
      const hueRotate = Math.ceil(phaseProgress * 45); // 0 to 45 degrees
      const saturate = 100 + Math.ceil(phaseProgress * 50); // 100% to 150%

      filters.push(`blur(${blur}px)`);
      filters.push(`hue-rotate(${hueRotate}deg)`);
      filters.push(`saturate(${saturate}%)`);
    } else if (progress < 0.667) {
      // Phase 2 (20-40s, 0.333-0.667): Glitch → Abstract
      const phaseProgress = (progress - 0.333) / 0.334;

      // Cycle through blend modes
      const blendModeCount = Math.floor(
        phaseProgress * this.config.blendModes.length
      );
      const nextIndex = Math.min(
        blendModeCount,
        this.config.blendModes.length - 1
      );
      blendMode = this.config.blendModes[nextIndex];

      const blur = 8 - Math.ceil(phaseProgress * 2); // 8 to 6px blur
      const contrast = 100 + Math.ceil(phaseProgress * 60); // 100% to 160%
      const brightness = 100 - Math.ceil(phaseProgress * 30); // 100% to 70%
      const saturate = 150 - Math.ceil(phaseProgress * 50); // 150% to 100%

      filters.push(`blur(${blur}px)`);
      filters.push(`contrast(${contrast}%)`);
      filters.push(`brightness(${brightness}%)`);
      filters.push(`saturate(${saturate}%)`);
    } else {
      // Phase 3 (40-60s, 0.667-1.0): Abstract → Normal
      const phaseProgress = (progress - 0.667) / 0.333;

      const blur = 6 - Math.ceil(phaseProgress * 6); // 6 to 0px blur
      const contrast = 160 - Math.ceil(phaseProgress * 60); // 160% to 100%
      const brightness = 70 + Math.ceil(phaseProgress * 30); // 70% to 100%

      filters.push(`blur(${blur}px)`);
      filters.push(`contrast(${contrast}%)`);
      filters.push(`brightness(${brightness}%)`);
    }

    // Apply filters and blend mode
    /** @type {HTMLElement} */ (element).style.filter = filters.join(' ');
    /** @type {HTMLElement} */ (element).style.mixBlendMode = blendMode;
  }
}

// Export for global scope
window.MorphingImageSystem = MorphingImageSystem;
