/**
 * @file ExhibitPortal.js
 * @description Gallery controller for the Ergasterion chamber.
 * Manages a 4-card gallery of absorb-alchemize AI experiments with
 * click-to-launch iframe embedding and graceful API key fallback.
 */

'use strict';

class ExhibitPortal {
  constructor() {
    this.exhibits = [
      {
        id: 'audio-orb',
        title: 'Audio Orb',
        description:
          'Real-time voice AI conversation with audio-reactive 3D visualization. Speak to the orb and watch it respond.',
        tech: 'Lit + Three.js + Gemini Live Audio',
        color: '#00ffcc',
        icon: '\u{1F50A}', // speaker high volume
        src: 'absorb-alchemize/audio-orb/dist/index.html',
      },
      {
        id: 'gemini-ink-studio',
        title: 'Gemini Ink Studio',
        description:
          'AI voice-controlled digital painting with lattice Boltzmann fluid dynamics. Paint with CMY pigments that flow like real ink.',
        tech: 'React + LBM Physics + Gemini',
        color: '#ff6b9d',
        icon: '\u{1F3A8}', // artist palette
        src: 'absorb-alchemize/gemini-ink-studio/dist/index.html',
      },
      {
        id: 'p5js-playground',
        title: 'p5.js Playground',
        description:
          'Chat-based creative coding IDE. Describe a sketch in natural language and AI generates running p5.js code.',
        tech: 'Lit + Gemini 2.5 Pro + p5.js',
        color: '#ed225d',
        icon: '\u{1F4BB}', // laptop
        src: 'absorb-alchemize/p5js-playground/dist/index.html',
      },
      {
        id: 'synthwave-space',
        title: 'Synthwave Space',
        description:
          'AI-generated 3D arcade game showcase. Complete Three.js games created by Gemini, with remix capabilities.',
        tech: 'React + Three.js + Gemini',
        color: '#b967ff',
        icon: '\u{1F680}', // rocket
        src: 'absorb-alchemize/synthwave-space/dist/index.html',
      },
    ];

    this.currentExhibit = null;
    this.bridge = null;
    this.container = null;
    this.galleryEl = null;
    this.iframeContainer = null;
  }

  /**
   * Initialize the portal in the given container element
   * @param {HTMLElement} container - The ergasterion content container
   */
  init(container) {
    return this.initialize(container);
  }

  /**
   * Initialize the portal in the given container element
   * @param {HTMLElement} container - The ergasterion content container
   */
  initialize(container) {
    this.container = container;

    // Create gallery
    this.galleryEl = document.createElement('div');
    this.galleryEl.className = 'exhibit-gallery';
    this.galleryEl.innerHTML = this.exhibits
      .map(ex => this._renderCard(ex))
      .join('');
    container.appendChild(this.galleryEl);

    // Create iframe container (hidden)
    this.iframeContainer = document.createElement('div');
    this.iframeContainer.className = 'exhibit-iframe-container dn';
    this.iframeContainer.innerHTML = `
      <div class="exhibit-iframe-header flex items-center justify-between pa3">
        <div>
          <span id="exhibit-title" class="f4 fw6" style="color: #00ff00"></span>
          <span id="exhibit-tech" class="f7 o-50 ml2"></span>
        </div>
        <button id="exhibit-back-btn" class="pa2 ph3 ba b--white-30 bg-black-70 white f7 pointer br2">
          &#8592; Back to Gallery
        </button>
      </div>
      <div class="exhibit-iframe-wrapper relative">
        <div id="exhibit-loading" class="absolute absolute--fill flex items-center justify-center bg-black-80 z-1">
          <p class="f5" style="color: #00ff00">Loading exhibit...</p>
        </div>
        <iframe id="exhibit-iframe" class="w-100 db" style="height: calc(100vh - 120px); border: none; background: #000;"></iframe>
      </div>
    `;
    container.appendChild(this.iframeContainer);

    // Bind events
    this.galleryEl.addEventListener('click', e => {
      const target = /** @type {HTMLElement} */ (e.target);
      const card = /** @type {HTMLElement | null} */ (
        target.closest('.exhibit-card')
      );
      if (card) {
        this.launchExhibit(card.dataset.exhibitId);
      }
    });

    document
      .getElementById('exhibit-back-btn')
      ?.addEventListener('click', () => this.closeExhibit());
  }

  /**
   * Render an exhibit card
   * @param {Object} exhibit
   * @returns {string} HTML string
   * @private
   */
  _renderCard(exhibit) {
    return `
      <div class="exhibit-card pointer" data-exhibit-id="${exhibit.id}"
           style="border-color: ${exhibit.color}">
        <div class="exhibit-card-icon tc mb3">
          <span class="f1">${exhibit.icon}</span>
        </div>
        <h3 class="f4 mt0 mb2" style="color: ${exhibit.color}">${exhibit.title}</h3>
        <p class="f6 o-80 mt0 mb2">${exhibit.description}</p>
        <p class="f7 o-50 mt0 mb0" style="font-family: Monaco, 'Courier New', monospace">
          ${exhibit.tech}
        </p>
        <div class="exhibit-card-cta mt3 f7" style="color: ${exhibit.color}">
          Launch Exhibit &#8594;
        </div>
      </div>
    `;
  }

  /**
   * Activate an exhibit by ID (lifecycle alias for launchExhibit)
   * @param {string} exhibitId
   */
  activate(exhibitId) {
    return this.launchExhibit(exhibitId);
  }

  /**
   * Launch an exhibit in fullscreen iframe
   * @param {string} exhibitId
   */
  launchExhibit(exhibitId) {
    const exhibit = this.exhibits.find(e => e.id === exhibitId);
    if (!exhibit) {
      return;
    }

    this.currentExhibit = exhibit;

    // Update UI
    document.getElementById('exhibit-title').textContent = exhibit.title;
    document.getElementById('exhibit-tech').textContent = exhibit.tech;

    // Show iframe container, hide gallery
    this.galleryEl.classList.add('dn');
    this.iframeContainer.classList.remove('dn');

    // Show loading
    const loading = document.getElementById('exhibit-loading');
    if (loading) {
      loading.classList.remove('dn');
    }

    // Set iframe src
    const iframe = /** @type {HTMLIFrameElement | null} */ (
      document.getElementById('exhibit-iframe')
    );
    if (!iframe) {
      return;
    }

    // Set up bridge
    if (this.bridge) {
      this.bridge.dispose();
    }
    this.bridge = new ExhibitBridge(iframe, {
      onLoaded: () => {
        loading?.classList.add('dn');
      },
      onError: err => {
        console.warn('Exhibit error:', err);
        this._showFallback(exhibit);
      },
      onClose: () => {
        this.closeExhibit();
      },
    });

    // Pause living pantheon
    this.bridge.pauseAtmosphere();

    // Load the exhibit
    iframe.src = exhibit.src;

    // Fallback: if iframe doesn't load in 10s, show fallback
    this._loadTimeout = setTimeout(() => {
      if (!this.bridge?.isConnected) {
        this._showFallback(exhibit);
      }
    }, 10000);

    // Also handle iframe load errors
    iframe.onerror = () => this._showFallback(exhibit);
    iframe.onload = () => {
      if (loading) {
        loading.classList.add('dn');
      }
      this.bridge?.sendReady();
    };
  }

  /**
   * Show graceful fallback when exhibit can't load (no build or no API key)
   * @param {Object} exhibit
   * @private
   */
  _showFallback(exhibit) {
    const loading = document.getElementById('exhibit-loading');
    if (loading) {
      loading.innerHTML = `
        <div class="tc pa4 mw6">
          <span class="f1 db mb3">${exhibit.icon}</span>
          <h3 class="f3 mb2" style="color: ${exhibit.color}">${exhibit.title}</h3>
          <p class="f6 o-80 mb3">${exhibit.description}</p>
          <div class="ba b--white-20 br3 pa3 mb3 tl" style="background: rgba(0,255,0,0.05)">
            <p class="f7 fw6 mt0 mb2" style="color: #00ff00">Setup Required:</p>
            <p class="f7 o-70 mt0 mb1">1. Build the exhibit: <code class="bg-black-50 ph1 br1">cd absorb-alchemize/${exhibit.id} && npm install && npm run build</code></p>
            <p class="f7 o-70 mt0 mb1">2. Add your Gemini API key to <code class="bg-black-50 ph1 br1">.env.local</code></p>
            <p class="f7 o-70 mt0 mb0">3. Reload this page</p>
          </div>
          <button onclick="window.exhibitPortal?.closeExhibit()" class="pa2 ph4 ba b--white-30 bg-black-70 white f6 pointer br2">
            Back to Gallery
          </button>
        </div>
      `;
      loading.classList.remove('dn');
    }
  }

  /**
   * Deactivate currently active exhibit (lifecycle alias for closeExhibit)
   */
  deactivate() {
    return this.closeExhibit();
  }

  /** Close the current exhibit and return to gallery */
  closeExhibit() {
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout);
      this._loadTimeout = null;
    }

    // Clear iframe
    const iframe = /** @type {HTMLIFrameElement | null} */ (
      document.getElementById('exhibit-iframe')
    );
    if (iframe) {
      iframe.src = 'about:blank';
    }

    // Dispose bridge
    if (this.bridge) {
      this.bridge.dispose();
      this.bridge = null;
    }

    this.currentExhibit = null;

    // Show gallery, hide iframe container
    this.iframeContainer.classList.add('dn');
    this.galleryEl.classList.remove('dn');

    // Reset loading state
    const loading = document.getElementById('exhibit-loading');
    if (loading) {
      loading.innerHTML =
        '<p class="f5" style="color: #00ff00">Loading exhibit...</p>';
    }
  }

  /**
   * Get lifecycle status of an exhibit or current state
   * @param {string} [exhibitId]
   * @returns {Object}
   */
  getStatus(exhibitId) {
    const target = exhibitId
      ? this.exhibits.find(e => e.id === exhibitId)
      : this.currentExhibit;
    return {
      activeId: this.currentExhibit ? this.currentExhibit.id : null,
      targetId: target ? target.id : null,
      status: this.currentExhibit
        ? this.bridge?.isConnected
          ? 'active'
          : 'loading'
        : 'ready',
      isLocalFirst: true,
      fallbackReady: true,
    };
  }

  /**
   * Render fallback for an exhibit (lifecycle method)
   * @param {Object|string} exhibit
   * @param {HTMLElement} [_container]
   * @param {string} [_reason]
   */
  renderFallback(exhibit, _container, _reason) {
    const targetExhibit =
      typeof exhibit === 'string'
        ? this.exhibits.find(e => e.id === exhibit)
        : exhibit;
    if (targetExhibit) {
      this._showFallback(targetExhibit);
    }
  }

  /** Dispose of all resources */
  dispose() {
    this.closeExhibit();
    if (this.galleryEl) {
      this.galleryEl.remove();
    }
    if (this.iframeContainer) {
      this.iframeContainer.remove();
    }
  }
}

window.ExhibitPortal = ExhibitPortal;
