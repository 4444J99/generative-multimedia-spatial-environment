/**
 * @file AnimatedContentSystem.js
 * @description Animated content system for breathing sections and text drift effects
 * Part of the Living Pantheon generative system.
 *
 * Provides two animation types:
 * - Breathing: Subtle scale pulse (1.0 → 1.02 → 1.0) on target elements
 * - Text drift: Gentle position offset cycle (max 2px, 8s) on text elements
 *
 * Uses CSS class toggling and custom properties driven by requestAnimationFrame
 * for smooth, GPU-composited animations.
 *
 * Configuration source: ETCETER4_CONFIG.livingPantheon.animation
 */

'use strict';

/**
 * Animated-content configuration, mirroring
 * ETCETER4_CONFIG.livingPantheon.animation (js/config.js). Every field is
 * optional: the constructor merges its own defaults over the global section.
 *
 * @typedef {Object} AnimatedContentOptions
 * @property {boolean} [enabled]
 * @property {Object} [breathing] - Breathing animation (subtle scale pulse)
 * @property {boolean} [breathing.enabled]
 * @property {number} [breathing.scaleMin]
 * @property {number} [breathing.scaleMax]
 * @property {number} [breathing.duration] - One breath cycle in ms
 * @property {string[]} [breathing.targetSelectors]
 * @property {Object} [textDrift] - Text drift (subtle position movement)
 * @property {boolean} [textDrift.enabled]
 * @property {number} [textDrift.maxDrift] - Maximum drift in pixels
 * @property {number} [textDrift.duration] - One drift cycle in ms
 * @property {string[]} [textDrift.targetSelectors]
 */
class AnimatedContentSystem {
  /**
   * @param {AnimatedContentOptions} [options] - Configuration from LivingPantheonCore
   */
  constructor(options = {}) {
    /** @type {AnimatedContentOptions} */
    const configFromGlobal =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon?.animation || {}
        : {};

    this.config = {
      enabled: options.enabled ?? configFromGlobal.enabled ?? true,
      breathing: {
        enabled:
          options.breathing?.enabled ??
          configFromGlobal.breathing?.enabled ??
          true,
        scaleMin:
          options.breathing?.scaleMin ??
          configFromGlobal.breathing?.scaleMin ??
          1.0,
        scaleMax:
          options.breathing?.scaleMax ??
          configFromGlobal.breathing?.scaleMax ??
          1.02,
        duration:
          options.breathing?.duration ??
          configFromGlobal.breathing?.duration ??
          4000,
        targetSelectors: options.breathing?.targetSelectors ??
          configFromGlobal.breathing?.targetSelectors ?? [
            '.breathing',
            '.living-element',
          ],
      },
      textDrift: {
        enabled:
          options.textDrift?.enabled ??
          configFromGlobal.textDrift?.enabled ??
          true,
        maxDrift:
          options.textDrift?.maxDrift ??
          configFromGlobal.textDrift?.maxDrift ??
          2,
        duration:
          options.textDrift?.duration ??
          configFromGlobal.textDrift?.duration ??
          8000,
        targetSelectors: options.textDrift?.targetSelectors ??
          configFromGlobal.textDrift?.targetSelectors ?? [
            '.drifting-text',
            '.living-text',
          ],
      },
    };

    this.isRunning = false;
    this._rafId = null;
    this._startTime = null;
  }

  /**
   * Start the animation loop
   */
  start() {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    // Respect prefers-reduced-motion
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.isRunning = true;
    this._startTime = performance.now();
    this._tick(this._startTime);
  }

  /**
   * Stop the animation loop and reset elements
   */
  stop() {
    this.isRunning = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._resetElements();
  }

  /**
   * Get current status
   * @returns {Object}
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
    };
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    this.stop();
  }

  /**
   * Core animation tick driven by requestAnimationFrame
   * @param {number} now - Current timestamp from rAF
   * @private
   */
  _tick(now) {
    if (!this.isRunning) {
      return;
    }

    const elapsed = now - this._startTime;

    if (this.config.breathing.enabled) {
      this._applyBreathing(elapsed);
    }
    if (this.config.textDrift.enabled) {
      this._applyTextDrift(elapsed);
    }

    this._rafId = requestAnimationFrame(t => this._tick(t));
  }

  /**
   * Apply breathing scale pulse to target elements
   * @param {number} elapsed - ms since start
   * @private
   */
  _applyBreathing(elapsed) {
    const { scaleMin, scaleMax, duration, targetSelectors } =
      this.config.breathing;
    // Sine wave oscillation: 0→1→0 over one duration cycle
    const phase = (Math.sin((2 * Math.PI * elapsed) / duration) + 1) / 2;
    const scale = scaleMin + (scaleMax - scaleMin) * phase;

    const selector = targetSelectors.join(', ');
    const elements = document.querySelectorAll(selector);

    for (const el of elements) {
      /** @type {HTMLElement} */ (el).style.transform = `scale(${scale})`;
    }
  }

  /**
   * Apply subtle text drift to target elements
   * @param {number} elapsed - ms since start
   * @private
   */
  _applyTextDrift(elapsed) {
    const { maxDrift, duration, targetSelectors } = this.config.textDrift;
    // Lissajous-style drift using two phase-offset sine waves
    const phaseX = Math.sin((2 * Math.PI * elapsed) / duration);
    const phaseY = Math.sin((2 * Math.PI * elapsed) / duration + Math.PI / 3);
    const dx = maxDrift * phaseX;
    const dy = maxDrift * phaseY * 0.5;

    const selector = targetSelectors.join(', ');
    const elements = document.querySelectorAll(selector);

    for (const el of elements) {
      /** @type {HTMLElement} */ (el).style.transform =
        `translate(${dx}px, ${dy}px)`;
    }
  }

  /**
   * Reset all animated elements to their natural state
   * @private
   */
  _resetElements() {
    const allSelectors = [
      ...this.config.breathing.targetSelectors,
      ...this.config.textDrift.targetSelectors,
    ];
    const selector = allSelectors.join(', ');
    const elements = document.querySelectorAll(selector);

    for (const el of elements) {
      /** @type {HTMLElement} */ (el).style.transform = '';
    }
  }
}

// Make available globally
window.AnimatedContentSystem = AnimatedContentSystem;
