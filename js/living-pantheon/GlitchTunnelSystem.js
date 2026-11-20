/**
 * @file GlitchTunnelSystem.js
 * @description Wormhole glitch transitions between chambers.
 * Triggers randomly (~10% of navigations) and applies a pixel-sort +
 * RGB-separation + scanline distortion effect during page transitions.
 *
 * Effect sequence (~2s):
 *   1. Capture current visible page to an offscreen canvas
 *   2. Overlay the canvas fullscreen
 *   3. Animate pixel-sort intensity 0→100→0 with scanline displacement
 *      and RGB channel separation
 *   4. Dissolve overlay to reveal new page
 *
 * Falls back silently if canvas capture fails.
 * Respects prefers-reduced-motion.
 *
 * Configuration source: ETCETER4_CONFIG.livingPantheon.glitchTunnels
 */

'use strict';

/**
 * Glitch-tunnel configuration, mirroring
 * ETCETER4_CONFIG.livingPantheon.glitchTunnels (js/config.js). Every field
 * is optional: the constructor merges its own defaults over the global section.
 *
 * @typedef {Object} GlitchTunnelOptions
 * @property {boolean} [enabled]
 * @property {number} [probability] - Probability of triggering per navigation
 * @property {number} [duration] - Total effect duration in ms
 * @property {number} [captureWidth] - Capture resolution (lower = faster)
 * @property {number} [captureHeight]
 * @property {Object} [pixelSort]
 * @property {number} [pixelSort.thresholdLow]
 * @property {number} [pixelSort.thresholdHigh]
 */
class GlitchTunnelSystem {
  /**
   * @param {GlitchTunnelOptions} [options] - Configuration options
   */
  constructor(options = {}) {
    /** @type {GlitchTunnelOptions} */
    const configFromGlobal =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon?.glitchTunnels || {}
        : {};

    this.config = {
      enabled: options.enabled ?? configFromGlobal.enabled ?? true,
      probability: options.probability ?? configFromGlobal.probability ?? 0.1,
      duration: options.duration ?? configFromGlobal.duration ?? 2000,
      captureWidth:
        options.captureWidth ?? configFromGlobal.captureWidth ?? 640,
      captureHeight:
        options.captureHeight ?? configFromGlobal.captureHeight ?? 480,
      pixelSort: {
        thresholdLow: configFromGlobal.pixelSort?.thresholdLow ?? 0.1,
        thresholdHigh: configFromGlobal.pixelSort?.thresholdHigh ?? 0.85,
      },
    };

    this.isRunning = false;
    this.isAnimating = false;
    this._overlay = null;
    this._canvas = null;
    this._ctx = null;
    this._boundOnTransition = this._onChamberTransition.bind(this);
  }

  /** Start listening for chamber transitions */
  start() {
    if (this.isRunning || !this.config.enabled) {
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    this.isRunning = true;
    window.addEventListener(
      'living-pantheon-status-change',
      this._boundOnTransition
    );
  }

  /** Stop listening */
  stop() {
    this.isRunning = false;
    window.removeEventListener(
      'living-pantheon-status-change',
      this._boundOnTransition
    );
  }

  /** Get status */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isAnimating: this.isAnimating,
    };
  }

  /** Dispose */
  dispose() {
    this.stop();
    this._removeOverlay();
  }

  /**
   * Handle chamber-transition events from LivingPantheonCore.
   * Roll the dice and optionally trigger the tunnel effect.
   * @param {CustomEvent} event
   * @private
   */
  _onChamberTransition(event) {
    if (event.detail?.event !== 'chamber-transition') {
      return;
    }
    if (this.isAnimating) {
      return;
    }
    if (Math.random() > this.config.probability) {
      return;
    }
    this._runTunnelEffect();
  }

  /**
   * Execute the full glitch tunnel effect.
   * @private
   */
  async _runTunnelEffect() {
    this.isAnimating = true;

    try {
      // 1. Capture current viewport to canvas
      const sourceCanvas = await this._captureViewport();
      if (!sourceCanvas) {
        this.isAnimating = false;
        return;
      }

      // 2. Create fullscreen overlay
      this._createOverlay();
      this._canvas = document.createElement('canvas');
      this._canvas.width = sourceCanvas.width;
      this._canvas.height = sourceCanvas.height;
      this._canvas.style.cssText =
        'width:100%;height:100%;object-fit:cover;display:block;';
      this._overlay.appendChild(this._canvas);
      this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });

      // Draw source
      this._ctx.drawImage(sourceCanvas, 0, 0);

      // 3. Animate distortion
      await this._animateDistortion(sourceCanvas);

      // 4. Fade out overlay
      await this._fadeOutOverlay();
    } catch (err) {
      // Fail silently - tunnel is decorative
      console.warn('GlitchTunnelSystem: effect skipped', err.message);
    } finally {
      this._removeOverlay();
      this.isAnimating = false;
    }
  }

  /**
   * Capture the current viewport into a scaled-down canvas.
   * Uses DOM-to-canvas via a simple <canvas> draw from existing visible section.
   * @returns {Promise<HTMLCanvasElement|null>}
   * @private
   */
  async _captureViewport() {
    try {
      // Find the currently visible section
      const visibleSection = /** @type {HTMLElement | null} */ (
        document.querySelector(
          'section:not(.dn)[id]:not([style*="display: none"])'
        )
      );
      if (!visibleSection) {
        return null;
      }

      // Create a canvas snapshot from the visible area using html2canvas if available,
      // otherwise create a stylized colored canvas as a visual approximation
      const w = this.config.captureWidth;
      const h = this.config.captureHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (typeof html2canvas !== 'undefined') {
        const captured = await html2canvas(visibleSection, {
          width: window.innerWidth,
          height: window.innerHeight,
          scale: w / window.innerWidth,
          logging: false,
          useCORS: true,
        });
        ctx.drawImage(captured, 0, 0, w, h);
      } else {
        // Fallback: generate a noise pattern colored by the current chamber
        this._generateNoiseFallback(ctx, w, h);
      }

      return canvas;
    } catch {
      return null;
    }
  }

  /**
   * Generate a stylized noise pattern as fallback when html2canvas isn't available
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @private
   */
  _generateNoiseFallback(ctx, w, h) {
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    // Get chamber color from CSS custom property if available
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const chamberRgb = style.getPropertyValue('--chamber-color-rgb').trim();
    const [cr, cg, cb] = chamberRgb
      ? chamberRgb.split(',').map(v => parseInt(v.trim()))
      : [128, 128, 128];

    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 0.3;
      data[i] = Math.floor(cr * (0.2 + noise));
      data[i + 1] = Math.floor(cg * (0.2 + noise));
      data[i + 2] = Math.floor(cb * (0.2 + noise));
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Animate the distortion effect over the configured duration.
   * Intensity ramps 0→1→0 using a sine curve.
   * @param {HTMLCanvasElement} source - Original captured frame
   * @returns {Promise<void>}
   * @private
   */
  _animateDistortion(source) {
    return new Promise(resolve => {
      const duration = this.config.duration;
      const startTime = performance.now();
      const w = this._canvas.width;
      const h = this._canvas.height;

      const frame = now => {
        if (!this.isAnimating) {
          resolve();
          return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Sine ramp: 0→1→0
        const intensity = Math.sin(progress * Math.PI);

        // Redraw source
        this._ctx.drawImage(source, 0, 0);

        // Apply pixel sort at current intensity
        if (intensity > 0.05) {
          const imageData = this._ctx.getImageData(0, 0, w, h);
          if (typeof PixelSortUtils !== 'undefined') {
            PixelSortUtils.sortColumns(imageData.data, w, h, {
              thresholdLow: this.config.pixelSort.thresholdLow,
              thresholdHigh: this.config.pixelSort.thresholdHigh,
              interpolation: intensity,
            });
          }
          this._ctx.putImageData(imageData, 0, 0);
        }

        // RGB channel separation
        if (intensity > 0.1) {
          const offset = Math.round(intensity * 8);
          this._applyRGBSeparation(offset);
        }

        // Scanline displacement
        if (intensity > 0.15) {
          this._applyScanlines(intensity, w, h);
        }

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(frame);
    });
  }

  /**
   * Apply RGB channel separation by offsetting red/blue channels
   * @param {number} offset - Pixel offset amount
   * @private
   */
  _applyRGBSeparation(offset) {
    if (offset < 1) {
      return;
    }
    this._ctx.globalCompositeOperation = 'screen';
    this._ctx.globalAlpha = 0.3;
    // Red channel shift
    this._ctx.drawImage(this._canvas, offset, 0);
    // Blue channel shift
    this._ctx.drawImage(this._canvas, -offset, 0);
    this._ctx.globalCompositeOperation = 'source-over';
    this._ctx.globalAlpha = 1.0;
  }

  /**
   * Apply scanline displacement effect
   * @param {number} intensity - 0-1 effect intensity
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   * @private
   */
  _applyScanlines(intensity, w, h) {
    const lineHeight = 2;
    const maxShift = Math.round(intensity * 20);

    for (let y = 0; y < h; y += lineHeight * 4) {
      if (Math.random() < intensity * 0.3) {
        const shift = Math.round((Math.random() - 0.5) * 2 * maxShift);
        const sliceData = this._ctx.getImageData(0, y, w, lineHeight);
        this._ctx.putImageData(sliceData, shift, y);
      }
    }
  }

  /** Create the fullscreen overlay element @private */
  _createOverlay() {
    this._removeOverlay();
    this._overlay = document.createElement('div');
    this._overlay.id = 'glitch-tunnel-overlay';
    this._overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:#000;' +
      'display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(this._overlay);
  }

  /**
   * Fade out and remove the overlay
   * @returns {Promise<void>}
   * @private
   */
  _fadeOutOverlay() {
    return new Promise(resolve => {
      if (!this._overlay) {
        resolve();
        return;
      }
      this._overlay.style.transition = 'opacity 0.4s ease-out';
      this._overlay.style.opacity = '0';
      setTimeout(resolve, 400);
    });
  }

  /** Remove overlay from DOM @private */
  _removeOverlay() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
      this._canvas = null;
      this._ctx = null;
    }
  }
}

// Make available globally
window.GlitchTunnelSystem = GlitchTunnelSystem;
