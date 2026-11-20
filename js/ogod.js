/**
 * @file ogod.js
 * @description Backward-compatible wrapper for the OGOD animation system.
 * Detects standalone OGOD pages (ogod/*.html) and bootstraps the modern
 * OGODAnimationEngine using the existing DOM structure.
 * Also works in the SPA context via the global OGODAnimationEngine class.
 *
 * @requires OGODAnimationEngine
 * @requires OGODImageLoader
 * @requires OGODFrameSequencer
 * @requires OGODCanvasRenderer
 */

'use strict';

/**
 * Active OGOD engine instance for standalone pages
 * @type {OGODAnimationEngine|null}
 */
let ogodEngine = null;

/**
 * Cleanup OGOD resources - disposes engine and removes handlers
 * Should be called when navigating away from OGOD pages
 */
function cleanupOgod() {
  if (ogodEngine) {
    ogodEngine.dispose();
    ogodEngine = null;
  }
}

/**
 * Bootstrap OGOD animation on standalone pages.
 * Detects the legacy #bgi image element, creates a canvas overlay,
 * and drives the animation through OGODAnimationEngine.
 */
function initStandaloneOgod() {
  const bgiElement = /** @type {HTMLImageElement | null} */ (
    document.getElementById('bgi')
  );
  if (!bgiElement) {
    return; // Not a standalone OGOD page
  }

  // Check if engine classes are available
  if (typeof OGODAnimationEngine === 'undefined') {
    console.warn('OGOD: Animation engine not loaded, falling back to legacy');
    return;
  }

  const bgElement = document.getElementById('bg');
  if (!bgElement) {
    return;
  }

  /**
   * Initialize the engine once the source image is loaded
   * @param {HTMLImageElement} img
   */
  const bootstrap = async img => {
    // Clean up any previous engine
    cleanupOgod();

    // Create a container for the canvas that covers the viewport
    const container = document.createElement('div');
    container.id = 'ogod-canvas-container';
    container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';
    document.body.appendChild(container);

    // Hide the legacy image-based animation
    bgElement.style.display = 'none';

    // Read initial mode from mode selector (if present), default to "faithful"
    const modeSelect = /** @type {HTMLSelectElement | null} */ (
      document.querySelector('.ogod-mode-select')
    );
    const initialMode = modeSelect ? modeSelect.value : 'faithful';

    try {
      ogodEngine = new OGODAnimationEngine({
        container,
        mode: initialMode,
        imageElement: img,
      });

      await ogodEngine.initialize();
      ogodEngine.start();

      // Wire up mode switcher
      if (modeSelect) {
        modeSelect.addEventListener('change', e => {
          if (ogodEngine) {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            ogodEngine.setMode(target.value);
          }
        });
      }
    } catch (err) {
      console.error(
        'OGOD: Engine initialization failed, falling back to legacy',
        err
      );
      // Restore legacy display
      container.remove();
      bgElement.style.display = '';
      ogodEngine = null;
      fallbackToLegacy(img);
    }
  };

  // Wait for the image to load (or use it immediately if already loaded)
  if (bgiElement.complete && bgiElement.naturalWidth > 0) {
    bootstrap(bgiElement);
  } else {
    bgiElement.addEventListener('load', () => bootstrap(bgiElement), {
      once: true,
    });
    // Make image visible so it can load
    bgiElement.style.visibility = 'visible';
  }
}

/**
 * Legacy fallback - original CSS offset technique
 * Used when the modern engine fails to load
 * @param {HTMLImageElement} _img - The #bgi image element
 */
function fallbackToLegacy(_img) {
  const config =
    typeof ETCETER4_CONFIG !== 'undefined'
      ? ETCETER4_CONFIG.ogod
      : { gridSize: 21, totalFrames: 410, frameInterval: 120 };

  const bgEl = document.getElementById('bg');
  const bgiEl = document.getElementById('bgi');
  if (!bgEl || !bgiEl) {
    return;
  }

  // Resize image to grid
  const resize = () => {
    bgiEl.style.width = `${window.innerWidth * config.gridSize}px`;
    bgiEl.style.height = `${window.innerHeight * config.gridSize}px`;
  };

  bgiEl.style.visibility = 'visible';
  resize();

  let f = 0;
  const intervalId = setInterval(() => {
    bgEl.style.left = `-${(f % config.gridSize) * window.innerWidth}px`;
    bgEl.style.top = `-${Math.floor(f / config.gridSize) * window.innerHeight}px`;
    f += 1;
    if (f === config.totalFrames) {
      f = 0;
    }
  }, config.frameInterval);

  window.addEventListener('resize', resize);

  // Override cleanup to also handle legacy fallback
  window._ogodLegacyCleanup = () => {
    clearInterval(intervalId);
    window.removeEventListener('resize', resize);
  };
}

// Auto-initialize when DOM is ready
if (typeof $ !== 'undefined') {
  // jQuery available (standalone pages load it)
  $(document).ready(() => {
    initStandaloneOgod();
  });
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStandaloneOgod);
} else {
  // DOM already ready
  initStandaloneOgod();
}
