/**
 * @file SettingsPanel.js
 * @description Settings panel overlay for OGOD 3D experience
 * ESC key toggles panel with smooth slide-in/out animation
 */

'use strict';

/**
 * SettingsPanel - Slide-in settings overlay
 * @class
 */
class SettingsPanel {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} [options.sceneManager] - OGODSceneManager instance
   * @param {Object} [options.audioEngine] - OGODAudioEngine instance
   * @param {Object} [options.sessionManager] - SessionManager instance
   * @param {Function} [options.onSettingsChange] - Callback when settings change
   */
  constructor(options = {}) {
    this.sceneManager = options.sceneManager || null;
    this.audioEngine = options.audioEngine || null;
    this.sessionManager = options.sessionManager || null;
    this.onSettingsChange = options.onSettingsChange || null;

    // Default settings
    this.settings = {
      graphics: {
        quality: 'medium',
        bloom: true,
        depthOfField: false,
        motionBlur: false,
        ssao: false,
      },
      audio: {
        masterVolume: 0.8,
        reverbMix: 0.3,
      },
      controls: {
        mouseSensitivity: 0.5,
        invertY: false,
        moveSpeed: 5.0,
      },
      accessibility: {
        reduceMotion: false,
        highContrast: false,
        largeText: false,
      },
    };

    // State
    this.isOpen = false;
    this.isAnimating = false;
    this.panelElement = null;
    this.overlayElement = null;
    this.activeSection = 'graphics';

    // Bind methods
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleOverlayClick = this._handleOverlayClick.bind(this);

    // Initialize
    this._createPanel();
    this._attachEventListeners();
  }

  /**
   * Create the settings panel DOM structure
   * @private
   */
  _createPanel() {
    // Create overlay
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'settings-overlay';
    this.overlayElement.setAttribute('aria-hidden', 'true');

    // Create panel
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'settings-panel';
    this.panelElement.setAttribute('role', 'dialog');
    this.panelElement.setAttribute('aria-label', 'Settings');
    this.panelElement.setAttribute('aria-modal', 'true');

    // Panel content
    this.panelElement.innerHTML = `
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button class="settings-close-btn" aria-label="Close settings" tabindex="0">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <nav class="settings-tabs" role="tablist" aria-label="Settings sections">
        <button class="settings-tab active" data-section="graphics" role="tab" aria-selected="true" aria-controls="section-graphics" tabindex="0">
          Graphics
        </button>
        <button class="settings-tab" data-section="audio" role="tab" aria-selected="false" aria-controls="section-audio" tabindex="0">
          Audio
        </button>
        <button class="settings-tab" data-section="controls" role="tab" aria-selected="false" aria-controls="section-controls" tabindex="0">
          Controls
        </button>
        <button class="settings-tab" data-section="accessibility" role="tab" aria-selected="false" aria-controls="section-accessibility" tabindex="0">
          Accessibility
        </button>
      </nav>

      <div class="settings-content">
        <!-- Graphics Section -->
        <section id="section-graphics" class="settings-section active" role="tabpanel" aria-labelledby="tab-graphics">
          <div class="setting-group">
            <label for="quality-preset" class="setting-label">Quality Preset</label>
            <select id="quality-preset" class="setting-select" data-setting="graphics.quality">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="ultra">Ultra</option>
            </select>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="bloom-toggle" class="setting-checkbox" data-setting="graphics.bloom" checked>
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Bloom Effect</span>
            </label>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="dof-toggle" class="setting-checkbox" data-setting="graphics.depthOfField">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Depth of Field</span>
            </label>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="motion-blur-toggle" class="setting-checkbox" data-setting="graphics.motionBlur">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Motion Blur</span>
            </label>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="ssao-toggle" class="setting-checkbox" data-setting="graphics.ssao">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Ambient Occlusion</span>
            </label>
          </div>
        </section>

        <!-- Audio Section -->
        <section id="section-audio" class="settings-section" role="tabpanel" aria-labelledby="tab-audio" hidden>
          <div class="setting-group">
            <label for="master-volume" class="setting-label">Master Volume</label>
            <div class="setting-slider-container">
              <input type="range" id="master-volume" class="setting-slider"
                     min="0" max="100" value="80" data-setting="audio.masterVolume">
              <span class="setting-slider-value" id="master-volume-value">80%</span>
            </div>
          </div>

          <div class="setting-group">
            <label for="reverb-mix" class="setting-label">Reverb Mix</label>
            <div class="setting-slider-container">
              <input type="range" id="reverb-mix" class="setting-slider"
                     min="0" max="100" value="30" data-setting="audio.reverbMix">
              <span class="setting-slider-value" id="reverb-mix-value">30%</span>
            </div>
          </div>
        </section>

        <!-- Controls Section -->
        <section id="section-controls" class="settings-section" role="tabpanel" aria-labelledby="tab-controls" hidden>
          <div class="setting-group">
            <label for="mouse-sensitivity" class="setting-label">Mouse Sensitivity</label>
            <div class="setting-slider-container">
              <input type="range" id="mouse-sensitivity" class="setting-slider"
                     min="10" max="100" value="50" data-setting="controls.mouseSensitivity">
              <span class="setting-slider-value" id="mouse-sensitivity-value">50%</span>
            </div>
          </div>

          <div class="setting-group">
            <label for="move-speed" class="setting-label">Move Speed</label>
            <div class="setting-slider-container">
              <input type="range" id="move-speed" class="setting-slider"
                     min="1" max="10" value="5" data-setting="controls.moveSpeed">
              <span class="setting-slider-value" id="move-speed-value">5</span>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="invert-y-toggle" class="setting-checkbox" data-setting="controls.invertY">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Invert Y Axis</span>
            </label>
          </div>
        </section>

        <!-- Accessibility Section -->
        <section id="section-accessibility" class="settings-section" role="tabpanel" aria-labelledby="tab-accessibility" hidden>
          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="reduce-motion-toggle" class="setting-checkbox" data-setting="accessibility.reduceMotion">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Reduce Motion</span>
            </label>
            <p class="setting-description">Reduces or disables animations</p>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="high-contrast-toggle" class="setting-checkbox" data-setting="accessibility.highContrast">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>High Contrast</span>
            </label>
            <p class="setting-description">Increases contrast for better visibility</p>
          </div>

          <div class="setting-group">
            <label class="setting-checkbox-label">
              <input type="checkbox" id="large-text-toggle" class="setting-checkbox" data-setting="accessibility.largeText">
              <span class="setting-checkbox-custom" aria-hidden="true"></span>
              <span>Large Text</span>
            </label>
            <p class="setting-description">Increases UI text size</p>
          </div>
        </section>
      </div>

      <div class="settings-footer">
        <button class="settings-btn settings-btn-secondary" id="reset-defaults-btn" tabindex="0">
          Reset to Defaults
        </button>
        <button class="settings-btn settings-btn-primary" id="close-settings-btn" tabindex="0">
          Done
        </button>
      </div>
    `;

    // Append to body
    document.body.appendChild(this.overlayElement);
    document.body.appendChild(this.panelElement);

    // Set up internal event listeners
    this._setupPanelListeners();
  }

  /**
   * Set up event listeners for panel controls
   * @private
   */
  _setupPanelListeners() {
    // Close button
    const closeBtn = this.panelElement.querySelector('.settings-close-btn');
    closeBtn.addEventListener('click', () => this.close());

    // Done button
    const doneBtn = this.panelElement.querySelector('#close-settings-btn');
    doneBtn.addEventListener('click', () => this.close());

    // Reset defaults button
    const resetBtn = this.panelElement.querySelector('#reset-defaults-btn');
    resetBtn.addEventListener('click', () => this._resetToDefaults());

    // Tab buttons
    const tabButtons = this.panelElement.querySelectorAll('.settings-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', e =>
        this._switchSection(
          /** @type {HTMLElement} */ (e.target).dataset.section
        )
      );
    });

    // Setting inputs
    const inputs = this.panelElement.querySelectorAll('[data-setting]');
    inputs.forEach(
      (/** @type {HTMLInputElement | HTMLSelectElement} */ input) => {
        const eventType = input.type === 'checkbox' ? 'change' : 'input';
        input.addEventListener(eventType, e => this._handleSettingChange(e));
      }
    );
  }

  /**
   * Attach global event listeners
   * @private
   */
  _attachEventListeners() {
    document.addEventListener('keydown', this._handleKeyDown);
    this.overlayElement.addEventListener('click', this._handleOverlayClick);
  }

  /**
   * Detach global event listeners
   * @private
   */
  _detachEventListeners() {
    document.removeEventListener('keydown', this._handleKeyDown);
    this.overlayElement.removeEventListener('click', this._handleOverlayClick);
  }

  /**
   * Handle keydown events
   * @private
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
      e.preventDefault();
    }

    // Trap focus when panel is open
    if (this.isOpen && e.key === 'Tab') {
      this._trapFocus(e);
    }
  }

  /**
   * Handle overlay click (close panel)
   * @private
   */
  _handleOverlayClick() {
    if (this.isOpen) {
      this.close();
    }
  }

  /**
   * Trap focus within the panel
   * @private
   * @param {KeyboardEvent} e
   */
  _trapFocus(e) {
    const focusableElements = this.panelElement.querySelectorAll(
      'button, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = /** @type {HTMLElement} */ (focusableElements[0]);
    const lastElement = /** @type {HTMLElement} */ (
      focusableElements[focusableElements.length - 1]
    );

    if (e.shiftKey && document.activeElement === firstElement) {
      lastElement.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      firstElement.focus();
      e.preventDefault();
    }
  }

  /**
   * Switch between sections
   * @private
   * @param {string} sectionId
   */
  _switchSection(sectionId) {
    if (this.activeSection === sectionId) {
      return;
    }

    // Update tabs
    const tabs = this.panelElement.querySelectorAll('.settings-tab');
    tabs.forEach((/** @type {HTMLElement} */ tab) => {
      const isActive = tab.dataset.section === sectionId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    // Update sections
    const sections = this.panelElement.querySelectorAll('.settings-section');
    sections.forEach((/** @type {HTMLElement} */ section) => {
      const isActive = section.id === `section-${sectionId}`;
      section.classList.toggle('active', isActive);
      section.hidden = !isActive;
    });

    this.activeSection = sectionId;
  }

  /**
   * Handle setting input changes
   * @private
   * @param {Event} e
   */
  _handleSettingChange(e) {
    const input = /** @type {HTMLInputElement | HTMLSelectElement} */ (
      e.target
    );
    const settingPath = input.dataset.setting;
    const [category, key] = settingPath.split('.');

    let value;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'range') {
      value = parseInt(input.value, 10);
      // Update slider value display
      const valueDisplay = this.panelElement.querySelector(
        `#${input.id}-value`
      );
      if (valueDisplay) {
        valueDisplay.textContent =
          key === 'moveSpeed' ? String(value) : `${value}%`;
      }
    } else {
      value = input.value;
    }

    // Update internal settings
    if (this.settings[category]) {
      this.settings[category][key] = value;
    }

    // Apply setting immediately
    this._applySetting(category, key, value);

    // Notify listeners
    if (this.onSettingsChange) {
      this.onSettingsChange(settingPath, value, this.settings);
    }

    // Save to session manager if available
    if (this.sessionManager) {
      this.sessionManager.saveSettings(this.settings);
    }
  }

  /**
   * Apply a single setting
   * @private
   * @param {string} category
   * @param {string} key
   * @param {*} value
   */
  _applySetting(category, key, value) {
    const sceneManager = this.sceneManager?.sceneManager || this.sceneManager;
    const audioEngine = this.audioEngine;

    switch (`${category}.${key}`) {
      case 'graphics.quality':
        this._applyQualityPreset(value);
        break;
      case 'graphics.bloom':
        if (sceneManager) {
          if (value) {
            sceneManager.enableBloom?.({
              strength: 0.5,
              threshold: 0.8,
              radius: 0.5,
            });
          } else {
            sceneManager.disableBloom?.();
          }
        }
        break;
      case 'graphics.depthOfField':
        if (sceneManager) {
          if (value) {
            sceneManager.enableEffect?.('dof');
          } else {
            sceneManager.disableEffect?.('dof');
          }
        }
        break;
      case 'graphics.motionBlur':
        if (sceneManager) {
          if (value) {
            sceneManager.enableEffect?.('motionBlur');
          } else {
            sceneManager.disableEffect?.('motionBlur');
          }
        }
        break;
      case 'graphics.ssao':
        if (sceneManager) {
          if (value) {
            sceneManager.enableEffect?.('ssao');
          } else {
            sceneManager.disableEffect?.('ssao');
          }
        }
        break;
      case 'audio.masterVolume':
        if (audioEngine) {
          audioEngine.setMasterVolume(value / 100);
        }
        break;
      case 'audio.reverbMix':
        if (audioEngine) {
          audioEngine.setReverbMix(value / 100);
        }
        break;
      case 'controls.mouseSensitivity':
        if (this.sceneManager?.controller) {
          this.sceneManager.controller.lookSpeed = (value / 100) * 0.004;
        }
        break;
      case 'controls.moveSpeed':
        if (this.sceneManager?.controller) {
          this.sceneManager.controller.moveSpeed = value;
        }
        break;
      case 'controls.invertY':
        if (this.sceneManager?.controller) {
          this.sceneManager.controller.invertY = value;
        }
        break;
      case 'accessibility.reduceMotion':
        document.body.classList.toggle('reduce-motion', value);
        break;
      case 'accessibility.highContrast':
        document.body.classList.toggle('high-contrast', value);
        break;
      case 'accessibility.largeText':
        document.body.classList.toggle('large-text', value);
        break;
    }
  }

  /**
   * Apply a quality preset
   * @private
   * @param {string} preset
   */
  _applyQualityPreset(preset) {
    const sceneManager = this.sceneManager?.sceneManager || this.sceneManager;
    if (!sceneManager?.renderer) {
      return;
    }

    const renderer = sceneManager.renderer;

    switch (preset) {
      case 'low':
        renderer.setPixelRatio(1);
        sceneManager.disableBloom?.();
        break;
      case 'medium':
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        break;
      case 'high':
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        break;
      case 'ultra':
        renderer.setPixelRatio(window.devicePixelRatio);
        break;
    }
  }

  /**
   * Reset settings to defaults
   * @private
   */
  _resetToDefaults() {
    this.settings = {
      graphics: {
        quality: 'medium',
        bloom: true,
        depthOfField: false,
        motionBlur: false,
        ssao: false,
      },
      audio: {
        masterVolume: 80,
        reverbMix: 30,
      },
      controls: {
        mouseSensitivity: 50,
        invertY: false,
        moveSpeed: 5,
      },
      accessibility: {
        reduceMotion: false,
        highContrast: false,
        largeText: false,
      },
    };

    this._updateUIFromSettings();
    this._applyAllSettings();

    if (this.sessionManager) {
      this.sessionManager.saveSettings(this.settings);
    }
  }

  /**
   * Update UI elements to reflect current settings
   * @private
   */
  _updateUIFromSettings() {
    Object.entries(this.settings).forEach(([category, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        const input =
          /** @type {HTMLInputElement | HTMLSelectElement | null} */ (
            this.panelElement.querySelector(
              `[data-setting="${category}.${key}"]`
            )
          );
        if (input) {
          if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            input.checked = value;
          } else if (input.type === 'range') {
            input.value = value;
            const valueDisplay = this.panelElement.querySelector(
              `#${input.id}-value`
            );
            if (valueDisplay) {
              valueDisplay.textContent =
                key === 'moveSpeed' ? value : `${value}%`;
            }
          } else {
            input.value = value;
          }
        }
      });
    });
  }

  /**
   * Apply all current settings
   * @private
   */
  _applyAllSettings() {
    Object.entries(this.settings).forEach(([category, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        this._applySetting(category, key, value);
      });
    });
  }

  /**
   * Open the settings panel
   */
  open() {
    if (this.isOpen || this.isAnimating) {
      return;
    }

    this.isAnimating = true;
    this.isOpen = true;

    // Show elements
    this.overlayElement.classList.add('visible');
    this.panelElement.classList.add('visible');
    this.overlayElement.setAttribute('aria-hidden', 'false');

    // Focus first interactive element
    setTimeout(() => {
      const firstFocusable = /** @type {HTMLElement | null} */ (
        this.panelElement.querySelector('button, input, select')
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
      this.isAnimating = false;
    }, 300);

    // Pause controller while settings open
    if (this.sceneManager?.controller) {
      this.sceneManager.controller.disable();
    }
  }

  /**
   * Close the settings panel
   */
  close() {
    if (!this.isOpen || this.isAnimating) {
      return;
    }

    this.isAnimating = true;
    this.isOpen = false;

    // Hide elements
    this.overlayElement.classList.remove('visible');
    this.panelElement.classList.remove('visible');
    this.overlayElement.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      this.isAnimating = false;
    }, 300);

    // Re-enable controller
    if (this.sceneManager?.controller) {
      this.sceneManager.controller.enable();
    }
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Load settings from an external source
   * @param {Object} settings
   */
  loadSettings(settings) {
    if (settings) {
      this.settings = { ...this.settings, ...settings };
      this._updateUIFromSettings();
      this._applyAllSettings();
    }
  }

  /**
   * Get current settings
   * @returns {Object}
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Set scene manager reference
   * @param {Object} sceneManager
   */
  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  /**
   * Set audio engine reference
   * @param {Object} audioEngine
   */
  setAudioEngine(audioEngine) {
    this.audioEngine = audioEngine;
  }

  /**
   * Set session manager reference
   * @param {Object} sessionManager
   */
  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Check if panel is currently open
   * @returns {boolean}
   */
  isVisible() {
    return this.isOpen;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this._detachEventListeners();

    if (this.panelElement && this.panelElement.parentElement) {
      this.panelElement.parentElement.removeChild(this.panelElement);
    }

    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }

    this.panelElement = null;
    this.overlayElement = null;
  }
}

// Export for global scope
window.SettingsPanel = SettingsPanel;
