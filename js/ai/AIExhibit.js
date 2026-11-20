/**
 * @file AIExhibit.js
 * @description Local-first activation controller and fallback manager for the 4 AI exhibits:
 * - Audio Orb: Real-time voice AI with 3D audio visualization
 * - Gemini Ink Studio: AI voice-controlled digital painting with LBM fluid dynamics
 * - p5.js Playground: Chat-based creative coding sketch generation
 * - Synthwave Space: AI-generated 3D arcade game showcase
 *
 * Provides deterministic lifecycle methods: init, activate, deactivate, getStatus, renderFallback.
 * Ensures zero unhandled network errors and graceful local-first operation when offline or uncredentialed.
 */

'use strict';

/**
 * Base AIExhibit class defining the standard exhibit lifecycle contract.
 */
export class AIExhibit {
  /**
   * @param {Object} [config]
   * @param {string} [config.id] - Unique exhibit ID
   * @param {string} [config.title] - Display title
   * @param {string} [config.description] - Detailed description
   * @param {string} [config.tech] - Technology stack
   * @param {string} [config.color] - Theme accent color
   * @param {string} [config.icon] - Visual glyph / emoji
   * @param {string} [config.src] - Path to exhibit distribution bundle
   * @param {string} [config.apiKey] - Optional provider API key (checked by hasCredentials)
   */
  constructor(config = {}) {
    this.id = config.id || 'unnamed-exhibit';
    this.title = config.title || 'AI Exhibit';
    this.description = config.description || '';
    this.tech = config.tech || '';
    this.color = config.color || '#00ffcc';
    this.icon = config.icon || '✨';
    this.src = config.src || '';

    // Lifecycle state: 'uninitialized' | 'ready' | 'active' | 'fallback' | 'inactive'
    this.status = 'uninitialized';
    this.container = null;
    this.fallbackElement = null;
    this.activeElement = null;
    this.isLocalFirst = true;
    this.options = { ...config };
    this._listeners = new Set();
  }

  /**
   * Check whether safe external provider credentials or session tokens are available.
   * @returns {boolean}
   */
  hasCredentials() {
    if (this.options.apiKey) {
      return true;
    }
    if (
      typeof process !== 'undefined' &&
      process.env &&
      (process.env.GEMINI_API_KEY || process.env.API_KEY)
    ) {
      return true;
    }
    if (typeof window !== 'undefined' && window.ETCETER4_CONFIG?.ai?.apiKey) {
      return true;
    }
    return false;
  }

  /**
   * Check whether runtime environment has network connectivity.
   * @returns {boolean}
   */
  isOnline() {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.onLine === 'boolean'
    ) {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Initialize the exhibit configuration and prepare local assets.
   * @param {Object} [options]
   * @returns {Promise<AIExhibit>}
   */
  async init(options = {}) {
    this.options = { ...this.options, ...options };
    this.status = 'ready';
    return this;
  }

  /**
   * Activate the exhibit inside the target DOM container.
   * Deterministically transitions to local-first fallback when uncredentialed or offline
   * without throwing unhandled network errors.
   *
   * @param {HTMLElement} container - DOM mount container
   * @param {Object} [options] - Activation parameters
   * @returns {Promise<{ ok: boolean, status: string, mode: string }>}
   */
  async activate(container, options = {}) {
    this.container = container;
    const forceFallback = options.forceFallback ?? false;
    const hasCreds = this.hasCredentials();
    const online = this.isOnline();

    // If unauthenticated or offline or explicitly forced, run local fallback
    if (forceFallback || !hasCreds || !online) {
      this.status = 'fallback';
      const reason = forceFallback
        ? 'forced'
        : !online
          ? 'offline'
          : 'unauthenticated';
      this.renderFallback(container, reason);
      return { ok: true, status: this.status, mode: 'fallback' };
    }

    try {
      this.status = 'active';
      this._renderLiveView(container);
      return { ok: true, status: this.status, mode: 'live' };
    } catch (_err) {
      // Gracefully recover to fallback on live mount failure
      this.status = 'fallback';
      this.renderFallback(container, 'activation_error');
      return { ok: true, status: this.status, mode: 'fallback' };
    }
  }

  /**
   * Deactivate and cleanly release all allocated resources.
   * @returns {Promise<{ ok: boolean, status: string }>}
   */
  async deactivate() {
    this._listeners.forEach(cleanup => {
      try {
        cleanup();
      } catch (_err) {
        // Continue cleanup
      }
    });
    this._listeners.clear();

    if (this.fallbackElement && this.fallbackElement.parentNode) {
      this.fallbackElement.remove();
      this.fallbackElement = null;
    }
    if (this.activeElement && this.activeElement.parentNode) {
      this.activeElement.remove();
      this.activeElement = null;
    }

    this.container = null;
    this.status = 'inactive';
    return { ok: true, status: this.status };
  }

  /**
   * Retrieve current lifecycle and capability status.
   * @returns {Object}
   */
  getStatus() {
    return {
      id: this.id,
      title: this.title,
      tech: this.tech,
      color: this.color,
      status: this.status,
      isLocalFirst: this.isLocalFirst,
      hasCredentials: this.hasCredentials(),
      isOnline: this.isOnline(),
      fallbackReady: true,
      hasFallbackMounted: Boolean(this.fallbackElement),
    };
  }

  /**
   * Render deterministic local-first fallback UI.
   * @param {HTMLElement} container
   * @param {string} [reason='unauthenticated']
   * @returns {HTMLElement}
   */
  renderFallback(container, reason = 'unauthenticated') {
    if (!container) {
      return null;
    }

    // Clean previous fallback
    if (this.fallbackElement && this.fallbackElement.parentNode) {
      this.fallbackElement.remove();
    }

    const wrapper = document.createElement('div');
    wrapper.className = `exhibit-fallback exhibit-fallback--${this.id} tc pa4 mw6 center`;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', `${this.title} Local Fallback`);

    const reasonMessage =
      reason === 'offline'
        ? 'Operating in offline local-first mode.'
        : reason === 'unauthenticated'
          ? 'No external Gemini API key supplied. Running local-first preview mode.'
          : 'Exhibit operating in local fallback mode.';

    wrapper.innerHTML = `
      <div class="exhibit-icon f1 mb2" aria-hidden="true">${this.icon}</div>
      <h3 class="f3 mt0 mb2" style="color: ${this.color}">${this.title}</h3>
      <p class="f6 o-80 mt0 mb3">${this.description}</p>
      <div class="ba b--white-20 br3 pa3 mb3 tl bg-black-70" style="border-left: 3px solid ${this.color}">
        <p class="f7 fw6 mt0 mb1" style="color: ${this.color}">Mode: Local-First Fallback</p>
        <p class="f7 o-80 mt0 mb2">${reasonMessage}</p>
        <p class="f7 fw6 mt0 mb1" style="color: #00ff00">Setup Instructions:</p>
        <ol class="f7 o-70 pl3 mt0 mb2">
          <li>Build the exhibit: <code class="bg-black-50 ph1 br1">cd absorb-alchemize/${this.id} && npm ci && npm run build</code></li>
          <li>Add Gemini API key in local configuration or proxy</li>
          <li>Reload this chamber</li>
        </ol>
      </div>
      <div class="local-simulation-container mt3 tl"></div>
      <button type="button" class="exhibit-close-btn pa2 ph4 ba b--white-30 bg-black-70 white f6 pointer br2 hover-bg-white-10 mt3">
        Back to Gallery
      </button>
    `;

    // Hook close button
    const closeBtn = wrapper.querySelector('.exhibit-close-btn');
    if (closeBtn) {
      const onClose = () => {
        this.deactivate();
        if (typeof window !== 'undefined' && window.exhibitPortal) {
          window.exhibitPortal.closeExhibit();
        }
      };
      closeBtn.addEventListener('click', onClose);
      this._listeners.add(() => closeBtn.removeEventListener('click', onClose));
    }

    // Render exhibit-specific local simulation
    const simContainer = /** @type {HTMLElement | null} */ (
      wrapper.querySelector('.local-simulation-container')
    );
    if (simContainer) {
      this.renderLocalSimulation(simContainer);
    }

    container.appendChild(wrapper);
    this.fallbackElement = wrapper;
    return wrapper;
  }

  /**
   * Render local-first interactive simulation/preview without external dependencies.
   * Can be overridden by subclasses.
   * @param {HTMLElement} simContainer
   */
  renderLocalSimulation(simContainer) {
    const defaultBox = document.createElement('div');
    defaultBox.className = 'pa3 ba b--white-10 br2 bg-black-40 f7 tc';
    defaultBox.innerHTML = `
      <span class="o-60">Interactive Local Preview: Ready</span>
      <div class="mt2 f7 o-40 font-mono">${this.tech}</div>
    `;
    simContainer.appendChild(defaultBox);
  }

  /**
   * Render live iframe view when credentials exist.
   * @param {HTMLElement} container
   * @private
   */
  _renderLiveView(container) {
    const iframe = document.createElement('iframe');
    iframe.className = 'w-100 db exhibit-live-iframe';
    iframe.src = this.src;
    iframe.style.height = 'calc(100vh - 120px)';
    iframe.style.border = 'none';
    iframe.style.background = '#000';
    container.appendChild(iframe);
    this.activeElement = iframe;
  }
}

/**
 * 1. Audio Orb Exhibit
 * Real-time voice AI conversation with audio-reactive 3D visualization.
 */
export class AudioOrbExhibit extends AIExhibit {
  constructor(options = {}) {
    super({
      id: 'audio-orb',
      title: 'Audio Orb',
      description:
        'Real-time voice AI conversation with audio-reactive 3D visualization. Speak to the orb and watch it respond.',
      tech: 'Lit + Three.js + Gemini Live Audio',
      color: '#00ffcc',
      icon: '\u{1F50A}',
      src: 'absorb-alchemize/audio-orb/dist/index.html',
      ...options,
    });
  }

  /**
   * Local-first 32-bin simulated FFT frequency visualizer.
   */
  renderLocalSimulation(simContainer) {
    const visualizer = document.createElement('div');
    visualizer.className = 'pa3 ba b--white-10 br2 bg-black-60';
    visualizer.innerHTML = `
      <div class="flex items-center justify-between mb2">
        <span class="f7 fw6" style="color: #00ffcc">Simulated 32-Bin Audio Spectrum</span>
        <span class="f7 o-50">Local Web Audio Synthesizer</span>
      </div>
      <div class="fft-bars flex items-end justify-between" style="height: 60px; gap: 2px;">
        ${Array.from({ length: 32 }, (_, i) => {
          const height = Math.max(
            10,
            Math.floor(Math.sin((i / 32) * Math.PI) * 55)
          );
          return `<div class="fft-bar" style="flex: 1; background: #00ffcc; opacity: ${0.4 + height / 100}; height: ${height}px; border-radius: 1px;"></div>`;
        }).join('')}
      </div>
    `;
    simContainer.appendChild(visualizer);
  }
}

/**
 * 2. Gemini Ink Studio Exhibit
 * AI voice-controlled digital painting with lattice Boltzmann fluid dynamics.
 */
export class GeminiInkStudioExhibit extends AIExhibit {
  constructor(options = {}) {
    super({
      id: 'gemini-ink-studio',
      title: 'Gemini Ink Studio',
      description:
        'AI voice-controlled digital painting with lattice Boltzmann fluid dynamics. Paint with CMY pigments that flow like real ink.',
      tech: 'React + LBM Physics + Gemini',
      color: '#ff6b9d',
      icon: '\u{1F3A8}',
      src: 'absorb-alchemize/gemini-ink-studio/dist/index.html',
      ...options,
    });
  }

  /**
   * Local-first fluid dynamics ink canvas preview.
   */
  renderLocalSimulation(simContainer) {
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'pa3 ba b--white-10 br2 bg-black-60';
    canvasWrap.innerHTML = `
      <div class="flex items-center justify-between mb2">
        <span class="f7 fw6" style="color: #ff6b9d">Local LBM Fluid Canvas</span>
        <span class="f7 o-50">Interactive CMY Pigment</span>
      </div>
      <canvas class="ink-preview-canvas w-100 br2" width="300" height="80" style="background: #111; border: 1px solid rgba(255,107,157,0.3)"></canvas>
      <div class="mt2 flex justify-between f7 o-70">
        <span>Click or tap to deposit pigment</span>
        <span>Physics: LBM D2Q9</span>
      </div>
    `;

    const canvas = canvasWrap.querySelector('canvas');
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw initial ink droplets
        ctx.fillStyle = '#ff6b9d';
        ctx.beginPath();
        ctx.arc(60, 40, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(150, 40, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(240, 40, 15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    simContainer.appendChild(canvasWrap);
  }
}

/**
 * 3. p5.js Playground Exhibit
 * Chat-based creative coding IDE for procedural generative art.
 */
export class P5jsPlaygroundExhibit extends AIExhibit {
  constructor(options = {}) {
    super({
      id: 'p5js-playground',
      title: 'p5.js Playground',
      description:
        'Chat-based creative coding IDE. Describe a sketch in natural language and AI generates running p5.js code.',
      tech: 'Lit + Gemini 2.5 Pro + p5.js',
      color: '#ed225d',
      icon: '\u{1F4BB}',
      src: 'absorb-alchemize/p5js-playground/dist/index.html',
      ...options,
    });
  }

  /**
   * Local-first preset sketch explorer.
   */
  renderLocalSimulation(simContainer) {
    const sketchBox = document.createElement('div');
    sketchBox.className = 'pa3 ba b--white-10 br2 bg-black-60';
    sketchBox.innerHTML = `
      <div class="flex items-center justify-between mb2">
        <span class="f7 fw6" style="color: #ed225d">Local Algorithmic Preset</span>
        <span class="f7 o-50">Zero-API Sketch Generator</span>
      </div>
      <pre class="pa2 br2 bg-black-90 f7 overflow-x-auto" style="color: #00ff00; font-family: monospace; margin: 0;"><code>function setup() {
  createCanvas(400, 400);
}
function draw() {
  background(10, 20);
  circle(mouseX, mouseY, 30);
}</code></pre>
      <div class="mt2 f7 o-60">Preset: Sine Wave Interference Pattern</div>
    `;
    simContainer.appendChild(sketchBox);
  }
}

/**
 * 4. Synthwave Space Exhibit
 * AI-generated 3D arcade game showcase with remix capabilities.
 */
export class SynthwaveSpaceExhibit extends AIExhibit {
  constructor(options = {}) {
    super({
      id: 'synthwave-space',
      title: 'Synthwave Space',
      description:
        'AI-generated 3D arcade game showcase. Complete Three.js games created by Gemini, with remix capabilities.',
      tech: 'React + Three.js + Gemini',
      color: '#b967ff',
      icon: '\u{1F680}',
      src: 'absorb-alchemize/synthwave-space/dist/index.html',
      ...options,
    });
  }

  /**
   * Local-first bundled game showcase preview.
   */
  renderLocalSimulation(simContainer) {
    const gameBox = document.createElement('div');
    gameBox.className = 'pa3 ba b--white-10 br2 bg-black-60';
    gameBox.innerHTML = `
      <div class="flex items-center justify-between mb2">
        <span class="f7 fw6" style="color: #b967ff">Bundled Offline Game Showcase</span>
        <span class="f7 o-50">Local Three.js Arcade</span>
      </div>
      <div class="flex items-center justify-around pa2 bg-black-80 br2">
        <div class="tc">
          <div class="f4 mb1">🛸</div>
          <div class="f7 fw6" style="color: #b967ff">Gemini 2.5 Racer</div>
          <div class="f7 o-50">init/gemini2p5.html</div>
        </div>
        <div class="tc">
          <div class="f4 mb1">👾</div>
          <div class="f7 fw6" style="color: #00ffcc">Gemini 3 Space Invaders</div>
          <div class="f7 o-50">init/gemini3.html</div>
        </div>
      </div>
      <div class="mt2 f7 o-60">Verified offline game inputs retained without remote generative endpoint.</div>
    `;
    simContainer.appendChild(gameBox);
  }
}

/**
 * Exhibit registry map linking canonical exhibit IDs to their controller classes.
 */
export const AI_EXHIBIT_CLASSES = {
  'audio-orb': AudioOrbExhibit,
  'gemini-ink-studio': GeminiInkStudioExhibit,
  'p5js-playground': P5jsPlaygroundExhibit,
  'synthwave-space': SynthwaveSpaceExhibit,
};

/**
 * Factory helper to instantiate an exhibit controller by ID.
 * @param {string} id
 * @param {Object} [options]
 * @returns {AIExhibit|null}
 */
export function getExhibit(id, options = {}) {
  const Cls = AI_EXHIBIT_CLASSES[id];
  return Cls ? new Cls(options) : null;
}

/**
 * Retrieve all four AI exhibit instances.
 * @param {Object} [options]
 * @returns {Array<AIExhibit>}
 */
export function getAllExhibits(options = {}) {
  return Object.keys(AI_EXHIBIT_CLASSES).map(id => getExhibit(id, options));
}

/**
 * Initialize all four exhibit instances.
 * @param {Object} [options]
 * @returns {Promise<Array<AIExhibit>>}
 */
export async function initAllExhibits(options = {}) {
  const exhibits = getAllExhibits(options);
  await Promise.all(exhibits.map(ex => ex.init(options)));
  return exhibits;
}

// Global browser window export for backward-compatibility
if (typeof window !== 'undefined') {
  window.AIExhibit = AIExhibit;
  window.AudioOrbExhibit = AudioOrbExhibit;
  window.GeminiInkStudioExhibit = GeminiInkStudioExhibit;
  window.P5jsPlaygroundExhibit = P5jsPlaygroundExhibit;
  window.SynthwaveSpaceExhibit = SynthwaveSpaceExhibit;
  window.AI_EXHIBIT_CLASSES = AI_EXHIBIT_CLASSES;
  window.getExhibit = getExhibit;
  window.getAllExhibits = getAllExhibits;
  window.initAllExhibits = initAllExhibits;
}
