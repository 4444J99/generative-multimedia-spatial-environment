/**
 * @file StemMixer.js
 * @description Stem mixer UI for OGOD 3D experience
 * Individual volume sliders, mute/solo buttons, and visual meters
 */

'use strict';

/**
 * StemMixer - Audio stem mixing panel
 * @class
 */
class StemMixer {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} [options.audioEngine] - OGODAudioEngine instance
   * @param {Function} [options.onVolumeChange] - Callback when volume changes
   * @param {boolean} [options.collapsed=true] - Start collapsed
   */
  constructor(options = {}) {
    this.audioEngine = options.audioEngine || null;
    this.onVolumeChange = options.onVolumeChange || null;
    this.isCollapsed = options.collapsed !== false;

    // Stem configuration
    this.stems = ['drums', 'bass', 'vocals', 'other'];
    this.stemLabels = {
      drums: 'Drums',
      bass: 'Bass',
      vocals: 'Vocals',
      other: 'Other',
    };
    this.stemColors = {
      drums: '#FF6B6B',
      bass: '#4ECDC4',
      vocals: '#FFE66D',
      other: '#95E1D3',
    };

    // State
    this.volumes = {};
    this.muted = {};
    this.soloed = {};
    this.masterVolume = 80;
    this.meterValues = {};

    // Initialize state for each stem
    this.stems.forEach(stem => {
      this.volumes[stem] = 100;
      this.muted[stem] = false;
      this.soloed[stem] = false;
      this.meterValues[stem] = 0;
    });

    // DOM elements
    this.containerElement = null;
    this.meterAnimationId = null;

    // Bind methods
    this._updateMeters = this._updateMeters.bind(this);

    // Initialize
    this._createPanel();
  }

  /**
   * Create the mixer panel DOM structure
   * @private
   */
  _createPanel() {
    this.containerElement = document.createElement('div');
    this.containerElement.className = `stem-mixer ${this.isCollapsed ? 'collapsed' : ''}`;
    this.containerElement.setAttribute('role', 'region');
    this.containerElement.setAttribute('aria-label', 'Audio Stem Mixer');

    this.containerElement.innerHTML = `
      <button class="stem-mixer-toggle" aria-expanded="${!this.isCollapsed}" aria-controls="stem-mixer-content" tabindex="0">
        <span class="stem-mixer-toggle-icon" aria-hidden="true"></span>
        <span class="stem-mixer-toggle-label">Mixer</span>
      </button>

      <div id="stem-mixer-content" class="stem-mixer-content" ${this.isCollapsed ? 'hidden' : ''}>
        <!-- Master Volume -->
        <div class="stem-mixer-master">
          <div class="stem-mixer-master-header">
            <span class="stem-mixer-master-label">Master</span>
            <span class="stem-mixer-master-value" id="master-value">${this.masterVolume}%</span>
          </div>
          <div class="stem-mixer-master-slider">
            <input type="range" id="mixer-master-volume" class="stem-slider stem-slider-master"
                   min="0" max="100" value="${this.masterVolume}"
                   aria-label="Master volume" tabindex="0">
          </div>
        </div>

        <!-- Stem Channels -->
        <div class="stem-channels">
          ${this.stems.map(stem => this._createStemChannel(stem)).join('')}
        </div>

        <!-- Solo/Mute All -->
        <div class="stem-mixer-actions">
          <button class="stem-action-btn" id="unmute-all-btn" aria-label="Unmute all stems" tabindex="0">
            Unmute All
          </button>
          <button class="stem-action-btn" id="unsolo-all-btn" aria-label="Clear all solo" tabindex="0">
            Clear Solo
          </button>
        </div>
      </div>
    `;

    // Append to body
    document.body.appendChild(this.containerElement);

    // Set up event listeners
    this._setupEventListeners();

    // Start meter animation
    this._startMeterAnimation();
  }

  /**
   * Create a single stem channel
   * @private
   * @param {string} stem
   * @returns {string}
   */
  _createStemChannel(stem) {
    const label = this.stemLabels[stem];
    const color = this.stemColors[stem];

    return `
      <div class="stem-channel" data-stem="${stem}">
        <div class="stem-channel-header">
          <span class="stem-label">${label}</span>
          <div class="stem-buttons">
            <button class="stem-btn stem-mute-btn" data-stem="${stem}" data-action="mute"
                    aria-label="Mute ${label}" aria-pressed="false" tabindex="0">
              M
            </button>
            <button class="stem-btn stem-solo-btn" data-stem="${stem}" data-action="solo"
                    aria-label="Solo ${label}" aria-pressed="false" tabindex="0">
              S
            </button>
          </div>
        </div>

        <div class="stem-meter-container">
          <div class="stem-meter-track">
            <div class="stem-meter-fill" id="mixer-meter-${stem}" style="background: ${color};"></div>
          </div>
        </div>

        <div class="stem-volume-container">
          <input type="range" class="stem-slider stem-volume-slider" data-stem="${stem}"
                 min="0" max="100" value="${this.volumes[stem]}"
                 orient="vertical" aria-label="${label} volume" tabindex="0">
          <span class="stem-volume-value" id="stem-value-${stem}">${this.volumes[stem]}%</span>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Toggle collapse
    const toggleBtn = this.containerElement.querySelector('.stem-mixer-toggle');
    toggleBtn.addEventListener('click', () => this.toggleCollapse());

    // Master volume
    const masterSlider = /** @type {HTMLInputElement | null} */ (
      this.containerElement.querySelector('#mixer-master-volume')
    );
    masterSlider.addEventListener('input', e =>
      this._handleMasterVolumeChange(e)
    );

    // Stem volume sliders
    const stemSliders = this.containerElement.querySelectorAll(
      '.stem-volume-slider'
    );
    stemSliders.forEach(slider => {
      slider.addEventListener('input', e => this._handleStemVolumeChange(e));
    });

    // Mute/Solo buttons
    const muteButtons =
      this.containerElement.querySelectorAll('.stem-mute-btn');
    muteButtons.forEach(btn => {
      btn.addEventListener('click', e => this._handleMuteClick(e));
    });

    const soloButtons =
      this.containerElement.querySelectorAll('.stem-solo-btn');
    soloButtons.forEach(btn => {
      btn.addEventListener('click', e => this._handleSoloClick(e));
    });

    // Action buttons
    const unmuteAllBtn = this.containerElement.querySelector('#unmute-all-btn');
    unmuteAllBtn.addEventListener('click', () => this._unmuteAll());

    const unsoloAllBtn = this.containerElement.querySelector('#unsolo-all-btn');
    unsoloAllBtn.addEventListener('click', () => this._unsoloAll());
  }

  /**
   * Handle master volume change
   * @private
   * @param {Event} e
   */
  _handleMasterVolumeChange(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    this.masterVolume = parseInt(target.value, 10);

    // Update display
    const valueDisplay = this.containerElement.querySelector('#master-value');
    if (valueDisplay) {
      valueDisplay.textContent = `${this.masterVolume}%`;
    }

    // Apply to audio engine
    if (this.audioEngine) {
      this.audioEngine.setMasterVolume(this.masterVolume / 100);
    }

    // Notify callback
    if (this.onVolumeChange) {
      this.onVolumeChange('master', this.masterVolume / 100);
    }
  }

  /**
   * Handle stem volume change
   * @private
   * @param {Event} e
   */
  _handleStemVolumeChange(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const stem = target.dataset.stem;
    const value = parseInt(target.value, 10);
    this.volumes[stem] = value;

    // Update display
    const valueDisplay = this.containerElement.querySelector(
      `#stem-value-${stem}`
    );
    if (valueDisplay) {
      valueDisplay.textContent = `${value}%`;
    }

    // Apply volume
    this._applyVolumes();

    // Notify callback
    if (this.onVolumeChange) {
      this.onVolumeChange(stem, value / 100);
    }
  }

  /**
   * Handle mute button click
   * @private
   * @param {Event} e
   */
  _handleMuteClick(e) {
    const target = /** @type {HTMLButtonElement} */ (e.target);
    const stem = target.dataset.stem;
    this.muted[stem] = !this.muted[stem];

    // Update button state
    target.classList.toggle('active', this.muted[stem]);
    target.setAttribute('aria-pressed', String(this.muted[stem]));

    // If muting, clear solo
    if (this.muted[stem]) {
      this.soloed[stem] = false;
      const soloBtn = this.containerElement.querySelector(
        `.stem-solo-btn[data-stem="${stem}"]`
      );
      if (soloBtn) {
        soloBtn.classList.remove('active');
        soloBtn.setAttribute('aria-pressed', 'false');
      }
    }

    // Apply volumes
    this._applyVolumes();
  }

  /**
   * Handle solo button click
   * @private
   * @param {Event} e
   */
  _handleSoloClick(e) {
    const target = /** @type {HTMLButtonElement} */ (e.target);
    const stem = target.dataset.stem;
    this.soloed[stem] = !this.soloed[stem];

    // Update button state
    target.classList.toggle('active', this.soloed[stem]);
    target.setAttribute('aria-pressed', String(this.soloed[stem]));

    // If soloing, unmute this stem
    if (this.soloed[stem] && this.muted[stem]) {
      this.muted[stem] = false;
      const muteBtn = this.containerElement.querySelector(
        `.stem-mute-btn[data-stem="${stem}"]`
      );
      if (muteBtn) {
        muteBtn.classList.remove('active');
        muteBtn.setAttribute('aria-pressed', 'false');
      }
    }

    // Apply volumes
    this._applyVolumes();
  }

  /**
   * Unmute all stems
   * @private
   */
  _unmuteAll() {
    this.stems.forEach(stem => {
      this.muted[stem] = false;
      const muteBtn = this.containerElement.querySelector(
        `.stem-mute-btn[data-stem="${stem}"]`
      );
      if (muteBtn) {
        muteBtn.classList.remove('active');
        muteBtn.setAttribute('aria-pressed', 'false');
      }
    });

    this._applyVolumes();
  }

  /**
   * Clear all solos
   * @private
   */
  _unsoloAll() {
    this.stems.forEach(stem => {
      this.soloed[stem] = false;
      const soloBtn = this.containerElement.querySelector(
        `.stem-solo-btn[data-stem="${stem}"]`
      );
      if (soloBtn) {
        soloBtn.classList.remove('active');
        soloBtn.setAttribute('aria-pressed', 'false');
      }
    });

    this._applyVolumes();
  }

  /**
   * Apply current volume state to audio engine
   * @private
   */
  _applyVolumes() {
    if (!this.audioEngine) {
      return;
    }

    // Check if any stem is soloed
    const anySoloed = this.stems.some(stem => this.soloed[stem]);

    const volumes = {};
    this.stems.forEach(stem => {
      let volume = this.volumes[stem] / 100;

      // Apply mute
      if (this.muted[stem]) {
        volume = 0;
      }
      // Apply solo logic: if any stem is soloed, mute non-soloed stems
      else if (anySoloed && !this.soloed[stem]) {
        volume = 0;
      }

      volumes[stem] = volume;
    });

    this.audioEngine.setStemVolumes(volumes);
  }

  /**
   * Start meter animation loop
   * @private
   */
  _startMeterAnimation() {
    this._updateMeters();
  }

  /**
   * Update meter displays
   * @private
   */
  _updateMeters() {
    if (this.audioEngine && !this.isCollapsed) {
      const stemVolumes = this.audioEngine.getStemVolumes();

      this.stems.forEach(stem => {
        // Get volume and add some random variation to simulate audio activity
        let level = stemVolumes[stem] || 0;

        // Add slight randomization for visual effect when playing
        if (this.audioEngine.isPlaying) {
          level = Math.min(1, level * (0.7 + Math.random() * 0.6));
        }

        // Smooth the value
        this.meterValues[stem] = this.meterValues[stem] * 0.7 + level * 0.3;

        // Update meter fill
        const meter = /** @type {HTMLElement | null} */ (
          this.containerElement.querySelector(`#mixer-meter-${stem}`)
        );
        if (meter) {
          meter.style.height = `${this.meterValues[stem] * 100}%`;
        }
      });
    }

    this.meterAnimationId = requestAnimationFrame(this._updateMeters);
  }

  /**
   * Stop meter animation
   * @private
   */
  _stopMeterAnimation() {
    if (this.meterAnimationId) {
      cancelAnimationFrame(this.meterAnimationId);
      this.meterAnimationId = null;
    }
  }

  /**
   * Toggle collapsed state
   */
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.containerElement.classList.toggle('collapsed', this.isCollapsed);

    const toggleBtn = this.containerElement.querySelector('.stem-mixer-toggle');
    toggleBtn.setAttribute('aria-expanded', String(!this.isCollapsed));

    const content = /** @type {HTMLElement | null} */ (
      this.containerElement.querySelector('#stem-mixer-content')
    );
    content.hidden = this.isCollapsed;
  }

  /**
   * Expand the mixer
   */
  expand() {
    if (this.isCollapsed) {
      this.toggleCollapse();
    }
  }

  /**
   * Collapse the mixer
   */
  collapse() {
    if (!this.isCollapsed) {
      this.toggleCollapse();
    }
  }

  /**
   * Set audio engine reference
   * @param {Object} audioEngine
   */
  setAudioEngine(audioEngine) {
    this.audioEngine = audioEngine;
  }

  /**
   * Get current mixer state
   * @returns {Object}
   */
  getState() {
    return {
      masterVolume: this.masterVolume,
      volumes: { ...this.volumes },
      muted: { ...this.muted },
      soloed: { ...this.soloed },
    };
  }

  /**
   * Load mixer state
   * @param {Object} state
   */
  loadState(state) {
    if (!state) {
      return;
    }

    if (state.masterVolume !== undefined) {
      this.masterVolume = state.masterVolume;
      const masterSlider = /** @type {HTMLInputElement | null} */ (
        this.containerElement.querySelector('#mixer-master-volume')
      );
      const masterValue = this.containerElement.querySelector('#master-value');
      if (masterSlider) {
        masterSlider.value = String(this.masterVolume);
      }
      if (masterValue) {
        masterValue.textContent = `${this.masterVolume}%`;
      }
    }

    if (state.volumes) {
      this.stems.forEach(stem => {
        if (state.volumes[stem] !== undefined) {
          this.volumes[stem] = state.volumes[stem];
          const slider = /** @type {HTMLInputElement | null} */ (
            this.containerElement.querySelector(
              `.stem-volume-slider[data-stem="${stem}"]`
            )
          );
          const valueDisplay = this.containerElement.querySelector(
            `#stem-value-${stem}`
          );
          if (slider) {
            slider.value = this.volumes[stem];
          }
          if (valueDisplay) {
            valueDisplay.textContent = `${this.volumes[stem]}%`;
          }
        }
      });
    }

    if (state.muted) {
      this.stems.forEach(stem => {
        if (state.muted[stem] !== undefined) {
          this.muted[stem] = state.muted[stem];
          const muteBtn = this.containerElement.querySelector(
            `.stem-mute-btn[data-stem="${stem}"]`
          );
          if (muteBtn) {
            muteBtn.classList.toggle('active', this.muted[stem]);
            muteBtn.setAttribute('aria-pressed', this.muted[stem]);
          }
        }
      });
    }

    if (state.soloed) {
      this.stems.forEach(stem => {
        if (state.soloed[stem] !== undefined) {
          this.soloed[stem] = state.soloed[stem];
          const soloBtn = this.containerElement.querySelector(
            `.stem-solo-btn[data-stem="${stem}"]`
          );
          if (soloBtn) {
            soloBtn.classList.toggle('active', this.soloed[stem]);
            soloBtn.setAttribute('aria-pressed', this.soloed[stem]);
          }
        }
      });
    }

    this._applyVolumes();
  }

  /**
   * Set stem volume programmatically
   * @param {string} stem
   * @param {number} volume - 0-100
   */
  setStemVolume(stem, volume) {
    if (!this.stems.includes(stem)) {
      return;
    }

    this.volumes[stem] = Math.max(0, Math.min(100, volume));

    const slider = /** @type {HTMLInputElement | null} */ (
      this.containerElement.querySelector(
        `.stem-volume-slider[data-stem="${stem}"]`
      )
    );
    const valueDisplay = this.containerElement.querySelector(
      `#stem-value-${stem}`
    );

    if (slider) {
      slider.value = this.volumes[stem];
    }
    if (valueDisplay) {
      valueDisplay.textContent = `${this.volumes[stem]}%`;
    }

    this._applyVolumes();
  }

  /**
   * Set master volume programmatically
   * @param {number} volume - 0-100
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(100, volume));

    const masterSlider = /** @type {HTMLInputElement | null} */ (
      this.containerElement.querySelector('#mixer-master-volume')
    );
    const masterValue = this.containerElement.querySelector('#master-value');

    if (masterSlider) {
      masterSlider.value = String(this.masterVolume);
    }
    if (masterValue) {
      masterValue.textContent = `${this.masterVolume}%`;
    }

    if (this.audioEngine) {
      this.audioEngine.setMasterVolume(this.masterVolume / 100);
    }
  }

  /**
   * Mute a stem
   * @param {string} stem
   * @param {boolean} muted
   */
  muteStem(stem, muted) {
    if (!this.stems.includes(stem)) {
      return;
    }

    this.muted[stem] = muted;
    const muteBtn = this.containerElement.querySelector(
      `.stem-mute-btn[data-stem="${stem}"]`
    );
    if (muteBtn) {
      muteBtn.classList.toggle('active', muted);
      muteBtn.setAttribute('aria-pressed', String(muted));
    }

    this._applyVolumes();
  }

  /**
   * Solo a stem
   * @param {string} stem
   * @param {boolean} soloed
   */
  soloStem(stem, soloed) {
    if (!this.stems.includes(stem)) {
      return;
    }

    this.soloed[stem] = soloed;
    const soloBtn = this.containerElement.querySelector(
      `.stem-solo-btn[data-stem="${stem}"]`
    );
    if (soloBtn) {
      soloBtn.classList.toggle('active', soloed);
      soloBtn.setAttribute('aria-pressed', String(soloed));
    }

    this._applyVolumes();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this._stopMeterAnimation();

    if (this.containerElement && this.containerElement.parentElement) {
      this.containerElement.parentElement.removeChild(this.containerElement);
    }

    this.containerElement = null;
    this.audioEngine = null;
  }
}

// Export for global scope
window.StemMixer = StemMixer;
