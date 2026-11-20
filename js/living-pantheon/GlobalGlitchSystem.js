/**
 * @file GlobalGlitchSystem.js
 * @description Global glitch system for random visual effects across the site
 * Implements 2% random visual glitches as part of the Living Pantheon system
 *
 * Glitch Effect Types:
 * --------------------
 * TEXT: Randomly scramble characters in text nodes temporarily
 * COLOR: Briefly invert or shift colors of an element
 * POSITION: Briefly offset element position by a few pixels
 * IMAGE: Apply brief CSS filter effects (hue-rotate, saturate, etc.)
 *
 * Configuration (from ETCETER4_CONFIG.livingPantheon.glitch):
 * - frequency: 0.02 (2% chance per check)
 * - checkInterval: 5000 (check every 5 seconds)
 * - types: ['text', 'color', 'position', 'image']
 * - duration: { min: 50, max: 200 } ms
 * - excludeSelectors: ['.no-glitch', 'input', 'button', 'a']
 *
 * Usage:
 * ------
 * const glitchSystem = new GlobalGlitchSystem();
 * glitchSystem.start();
 *
 * // Later...
 * glitchSystem.stop();
 * glitchSystem.dispose();
 */

'use strict';

/**
 * Global-glitch configuration, mirroring ETCETER4_CONFIG.livingPantheon.glitch
 * (js/config.js). Every field is optional: the constructor merges its own
 * defaults over the global section.
 *
 * @typedef {Object} GlobalGlitchOptions
 * @property {boolean} [enabled]
 * @property {number} [frequency] - Probability of a glitch per check (0-1)
 * @property {number} [checkInterval] - Interval between checks in ms
 * @property {string[]} [types] - Glitch effect types to use
 * @property {Object} [duration] - Duration range for effects in ms
 * @property {number} [duration.min]
 * @property {number} [duration.max]
 * @property {string[]} [excludeSelectors] - CSS selectors to exclude from glitching
 */
/**
 * GlobalGlitchSystem - Manages random visual glitch effects across the DOM
 * @class
 */
class GlobalGlitchSystem {
  /**
   * Create a new GlobalGlitchSystem instance
   * @param {GlobalGlitchOptions} [options] - Configuration options
   */
  constructor(options = {}) {
    // Get configuration from global config or use defaults
    /** @type {GlobalGlitchOptions} */
    const configFromGlobal =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon?.glitch || {}
        : {};

    // Merge options with config and defaults
    this.config = {
      enabled: configFromGlobal.enabled !== false,
      frequency: options.frequency ?? configFromGlobal.frequency ?? 0.02,
      checkInterval:
        options.checkInterval ?? configFromGlobal.checkInterval ?? 5000,
      types: options.types ??
        configFromGlobal.types ?? ['text', 'color', 'position', 'image'],
      duration: {
        min: options.duration?.min ?? configFromGlobal.duration?.min ?? 50,
        max: options.duration?.max ?? configFromGlobal.duration?.max ?? 200,
      },
      excludeSelectors: options.excludeSelectors ??
        configFromGlobal.excludeSelectors ?? [
          '.no-glitch',
          'input',
          'button',
          'a',
        ],
    };

    // State tracking
    this.isRunning = false;
    this.checkIntervalId = null;
    this.activeGlitches = new Set();
    this.pendingAnimationFrames = new Set();

    // Glitch characters for text scramble effect
    this.glitchChars =
      '!@#$%^&*()_+-=[]{}|;:,.<>?/~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    // Color inversion maximum duration for seizure safety
    this.maxColorInversionDuration = 50;

    // Bind methods
    this._performCheck = this._performCheck.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /**
   * Start the glitch system
   * @returns {GlobalGlitchSystem} Returns this for chaining
   */
  start() {
    if (this.isRunning || !this.config.enabled) {
      return this;
    }

    // Check for prefers-reduced-motion
    if (this._prefersReducedMotion()) {
      console.warn(
        'GlobalGlitchSystem: Disabled due to prefers-reduced-motion'
      );
      return this;
    }

    this.isRunning = true;

    // Start periodic checks
    this.checkIntervalId = setInterval(
      this._performCheck,
      this.config.checkInterval
    );

    // Listen for visibility changes to pause when hidden
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    return this;
  }

  /**
   * Stop the glitch system
   * @returns {GlobalGlitchSystem} Returns this for chaining
   */
  stop() {
    this.isRunning = false;

    // Clear interval
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    // Cancel any pending animation frames
    for (const frameId of this.pendingAnimationFrames) {
      cancelAnimationFrame(frameId);
    }
    this.pendingAnimationFrames.clear();

    // Remove visibility listener
    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    return this;
  }

  /**
   * Dispose of all resources and clean up
   */
  dispose() {
    this.stop();

    // Restore any elements that might still be glitched
    this.activeGlitches.clear();
  }

  /**
   * Manually trigger a glitch effect (for testing or external triggers)
   * @param {string} [type] - Optional specific glitch type to trigger
   * @returns {boolean} True if glitch was triggered, false if no valid element found
   */
  triggerGlitch(type) {
    const element = this._selectRandomElement();
    if (!element) {
      return false;
    }

    const glitchType =
      type && this.config.types.includes(type)
        ? type
        : this._selectRandomType();

    this._applyGlitch(element, glitchType);
    return true;
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
      // Pause checks when page is hidden
      if (this.checkIntervalId !== null) {
        clearInterval(this.checkIntervalId);
        this.checkIntervalId = null;
      }
    } else if (this.isRunning && this.checkIntervalId === null) {
      // Resume checks when page becomes visible
      this.checkIntervalId = setInterval(
        this._performCheck,
        this.config.checkInterval
      );
    }
  }

  /**
   * Perform a glitch check (called on interval)
   * @private
   */
  _performCheck() {
    // Roll for glitch probability
    if (Math.random() > this.config.frequency) {
      return;
    }

    // Select a random element
    const element = this._selectRandomElement();
    if (!element) {
      return;
    }

    // Select a random glitch type
    const glitchType = this._selectRandomType();

    // Apply the glitch
    this._applyGlitch(element, glitchType);
  }

  /**
   * Select a random glitch type from configured types
   * @private
   * @returns {string}
   */
  _selectRandomType() {
    const types = this.config.types;
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Select a random visible element from the DOM
   * @private
   * @returns {Element|null}
   */
  _selectRandomElement() {
    // Build exclude selector string
    const excludeSelector = this.config.excludeSelectors.join(', ');

    // Get all visible elements
    const allElements = document.body.querySelectorAll('*');
    const candidates = [];

    for (const el of allElements) {
      // Skip excluded selectors
      if (excludeSelector && el.matches(excludeSelector)) {
        continue;
      }

      // Skip if inside an excluded element
      if (excludeSelector && el.closest(excludeSelector)) {
        continue;
      }

      // Skip if already being glitched
      if (this.activeGlitches.has(el)) {
        continue;
      }

      // Check visibility
      if (!this._isElementVisible(el)) {
        continue;
      }

      candidates.push(el);
    }

    if (candidates.length === 0) {
      return null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
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
   * Get random duration within configured range
   * @private
   * @returns {number}
   */
  _getRandomDuration() {
    const { min, max } = this.config.duration;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Apply a glitch effect to an element
   * @private
   * @param {Element} element
   * @param {string} type
   */
  _applyGlitch(element, type) {
    // Mark element as being glitched
    this.activeGlitches.add(element);

    // Get duration (limit color to 50ms for seizure safety)
    let duration = this._getRandomDuration();
    if (type === 'color') {
      duration = Math.min(duration, this.maxColorInversionDuration);
    }

    switch (type) {
      case 'text':
        this._applyTextGlitch(element, duration);
        break;
      case 'color':
        this._applyColorGlitch(element, duration);
        break;
      case 'position':
        this._applyPositionGlitch(element, duration);
        break;
      case 'image':
        this._applyImageGlitch(element, duration);
        break;
      default:
        this.activeGlitches.delete(element);
    }
  }

  /**
   * Apply text scramble glitch effect
   * @private
   * @param {Element} element
   * @param {number} duration
   */
  _applyTextGlitch(element, duration) {
    // Find direct text nodes within this element
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        // Only accept nodes with actual text content
        if (node.textContent.trim().length > 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    if (textNodes.length === 0) {
      this.activeGlitches.delete(element);
      return;
    }

    // Select a random text node
    const targetNode = textNodes[Math.floor(Math.random() * textNodes.length)];
    const originalText = targetNode.textContent;

    // Scramble some characters
    const scrambledText = this._scrambleText(originalText);
    targetNode.textContent = scrambledText;

    // Schedule restoration using requestAnimationFrame for smoothness
    const startTime = performance.now();
    const restoreText = currentTime => {
      if (currentTime - startTime >= duration) {
        targetNode.textContent = originalText;
        this.activeGlitches.delete(element);
      } else {
        const frameId = requestAnimationFrame(restoreText);
        this.pendingAnimationFrames.add(frameId);
      }
    };

    const frameId = requestAnimationFrame(restoreText);
    this.pendingAnimationFrames.add(frameId);
  }

  /**
   * Scramble a portion of text
   * @private
   * @param {string} text
   * @returns {string}
   */
  _scrambleText(text) {
    const chars = text.split('');
    const numToScramble = Math.ceil(chars.length * 0.3); // Scramble ~30% of characters

    for (let i = 0; i < numToScramble; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      // Don't scramble whitespace
      if (chars[idx].trim()) {
        chars[idx] =
          this.glitchChars[Math.floor(Math.random() * this.glitchChars.length)];
      }
    }

    return chars.join('');
  }

  /**
   * Apply color inversion/shift glitch effect
   * @private
   * @param {Element} element
   * @param {number} duration
   */
  _applyColorGlitch(element, duration) {
    // Create an overlay element for the color effect
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      mix-blend-mode: difference;
      background-color: white;
      opacity: 0.8;
    `;

    // Ensure element has relative positioning for overlay
    const originalPosition = window.getComputedStyle(element).position;
    if (originalPosition === 'static') {
      /** @type {HTMLElement} */ (element).style.position = 'relative';
    }

    element.appendChild(overlay);

    // Schedule removal
    const startTime = performance.now();
    const removeOverlay = currentTime => {
      if (currentTime - startTime >= duration) {
        if (overlay.parentNode) {
          overlay.remove();
        }
        if (originalPosition === 'static') {
          /** @type {HTMLElement} */ (element).style.position = '';
        }
        this.activeGlitches.delete(element);
        this.pendingAnimationFrames.delete(removeOverlay);
      } else {
        const frameId = requestAnimationFrame(removeOverlay);
        this.pendingAnimationFrames.add(frameId);
      }
    };

    const frameId = requestAnimationFrame(removeOverlay);
    this.pendingAnimationFrames.add(frameId);
  }

  /**
   * Apply position offset glitch effect
   * @private
   * @param {Element} element
   * @param {number} duration
   */
  _applyPositionGlitch(element, duration) {
    // Store original transform
    const originalTransform = /** @type {HTMLElement} */ (element).style
      .transform;

    // Generate small random offset (1-5 pixels)
    const offsetX = (Math.random() - 0.5) * 10;
    const offsetY = (Math.random() - 0.5) * 10;

    // Apply offset transform
    const newTransform = originalTransform
      ? `${originalTransform} translate(${offsetX}px, ${offsetY}px)`
      : `translate(${offsetX}px, ${offsetY}px)`;

    /** @type {HTMLElement} */ (element).style.transform = newTransform;

    // Schedule restoration
    const startTime = performance.now();
    const restorePosition = currentTime => {
      if (currentTime - startTime >= duration) {
        /** @type {HTMLElement} */ (element).style.transform =
          originalTransform;
        this.activeGlitches.delete(element);
        this.pendingAnimationFrames.delete(restorePosition);
      } else {
        const frameId = requestAnimationFrame(restorePosition);
        this.pendingAnimationFrames.add(frameId);
      }
    };

    const frameId = requestAnimationFrame(restorePosition);
    this.pendingAnimationFrames.add(frameId);
  }

  /**
   * Apply image filter glitch effect
   * @private
   * @param {Element} element
   * @param {number} duration
   */
  _applyImageGlitch(element, duration) {
    // Store original filter
    const originalFilter = /** @type {HTMLElement} */ (element).style.filter;

    // Generate random filter effect
    const filterEffects = [
      `hue-rotate(${Math.floor(Math.random() * 360)}deg)`,
      `saturate(${200 + Math.floor(Math.random() * 300)}%)`,
      `brightness(${50 + Math.floor(Math.random() * 100)}%)`,
      `contrast(${150 + Math.floor(Math.random() * 150)}%)`,
      `hue-rotate(${Math.floor(Math.random() * 180)}deg) saturate(${200 + Math.floor(Math.random() * 200)}%)`,
    ];

    const selectedFilter =
      filterEffects[Math.floor(Math.random() * filterEffects.length)];

    // Apply filter
    /** @type {HTMLElement} */ (element).style.filter = originalFilter
      ? `${originalFilter} ${selectedFilter}`
      : selectedFilter;

    // Schedule restoration
    const startTime = performance.now();
    const restoreFilter = currentTime => {
      if (currentTime - startTime >= duration) {
        /** @type {HTMLElement} */ (element).style.filter = originalFilter;
        this.activeGlitches.delete(element);
        this.pendingAnimationFrames.delete(restoreFilter);
      } else {
        const frameId = requestAnimationFrame(restoreFilter);
        this.pendingAnimationFrames.add(frameId);
      }
    };

    const frameId = requestAnimationFrame(restoreFilter);
    this.pendingAnimationFrames.add(frameId);
  }

  /**
   * Get current system status
   * @returns {Object} Status object with running state and configuration
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeGlitchCount: this.activeGlitches.size,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration at runtime
   * @param {Object} newConfig - Partial configuration to merge
   * @returns {GlobalGlitchSystem} Returns this for chaining
   */
  updateConfig(newConfig) {
    if (newConfig.frequency !== undefined) {
      this.config.frequency = newConfig.frequency;
    }
    if (newConfig.checkInterval !== undefined) {
      this.config.checkInterval = newConfig.checkInterval;
      // Restart interval with new timing if running
      if (this.isRunning && this.checkIntervalId !== null) {
        clearInterval(this.checkIntervalId);
        this.checkIntervalId = setInterval(
          this._performCheck,
          this.config.checkInterval
        );
      }
    }
    if (newConfig.types !== undefined) {
      this.config.types = newConfig.types;
    }
    if (newConfig.duration !== undefined) {
      this.config.duration = { ...this.config.duration, ...newConfig.duration };
    }
    if (newConfig.excludeSelectors !== undefined) {
      this.config.excludeSelectors = newConfig.excludeSelectors;
    }
    if (newConfig.enabled !== undefined) {
      this.config.enabled = newConfig.enabled;
      if (!newConfig.enabled && this.isRunning) {
        this.stop();
      }
    }

    return this;
  }
}

// Export for global scope
window.GlobalGlitchSystem = GlobalGlitchSystem;
