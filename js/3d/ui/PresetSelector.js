/**
 * @file PresetSelector.js
 * @description Environment preset selector for OGOD 3D experience
 * Dropdown/list of available environment archetypes with quick switching
 */

'use strict';

/**
 * PresetSelector - Environment archetype selection menu
 * @class
 */
class PresetSelector {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} [options.sceneManager] - OGODSceneManager instance
   * @param {Function} [options.onPresetChange] - Callback when preset changes
   * @param {number} [options.currentTrack] - Current track number
   */
  constructor(options = {}) {
    this.sceneManager = options.sceneManager || null;
    this.onPresetChange = options.onPresetChange || null;
    this.currentTrack = options.currentTrack || 1;

    // Environment archetypes
    this.archetypes = [
      {
        id: 'gradient-fog',
        name: 'Gradient Fog',
        description: 'Volumetric color zones',
        icon: '\u25CE', // circle with dot
        color: '#6B4C7A',
      },
      {
        id: 'stripe-bar',
        name: 'Stripe Bar',
        description: 'Vertical bars with parallax',
        icon: '\u2503', // vertical lines
        color: '#CDDC39',
      },
      {
        id: 'bokeh-grid',
        name: 'Bokeh Grid',
        description: 'Neon glowing spheres',
        icon: '\u25C9', // filled circle
        color: '#FF00FF',
      },
      {
        id: 'high-contrast',
        name: 'High Contrast',
        description: 'Black and white shadow world',
        icon: '\u25D0', // half circle
        color: '#FFFFFF',
      },
      {
        id: 'layered-colors',
        name: 'Layered Colors',
        description: 'Stacked transparent planes',
        icon: '\u2261', // stacked lines
        color: '#FF1493',
      },
      {
        id: 'glitch-digital',
        name: 'Glitch Digital',
        description: 'RGB split and scanlines',
        icon: '\u2302', // house with glitch
        color: '#00FFFF',
      },
    ];

    // Track to archetype mapping
    this.trackArchetypes = this._buildTrackArchetypeMap();

    // State
    this.selectedArchetype = null;
    this.recommendedArchetype = null;
    this.isOpen = false;
    this.containerElement = null;

    // Initialize
    this._createPanel();
    this._updateForTrack(this.currentTrack);
  }

  /**
   * Build a map of track numbers to archetypes from config
   * @private
   * @returns {Object}
   */
  _buildTrackArchetypeMap() {
    const map = {};

    if (typeof ETCETER4_CONFIG !== 'undefined' && ETCETER4_CONFIG.ogodTracks) {
      Object.entries(ETCETER4_CONFIG.ogodTracks).forEach(
        ([trackNum, config]) => {
          map[trackNum] = config.archetype;
        }
      );
    }

    return map;
  }

  /**
   * Create the preset selector DOM structure
   * @private
   */
  _createPanel() {
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'preset-selector';
    this.containerElement.setAttribute('role', 'region');
    this.containerElement.setAttribute(
      'aria-label',
      'Environment Preset Selector'
    );

    this.containerElement.innerHTML = `
      <button class="preset-selector-toggle" aria-expanded="false" aria-controls="preset-list" tabindex="0">
        <span class="preset-selector-icon" aria-hidden="true" id="current-preset-icon"></span>
        <span class="preset-selector-label" id="current-preset-label">Select Environment</span>
        <span class="preset-selector-arrow" aria-hidden="true">\u25BC</span>
      </button>

      <div id="preset-list" class="preset-list" role="listbox" aria-label="Environment presets" hidden>
        <div class="preset-recommended" id="preset-recommended" hidden>
          <span class="preset-recommended-label">Recommended for this track:</span>
          <span class="preset-recommended-name" id="recommended-name"></span>
        </div>

        <div class="preset-options">
          ${this.archetypes.map(archetype => this._createPresetOption(archetype)).join('')}
        </div>
      </div>
    `;

    // Append to body
    document.body.appendChild(this.containerElement);

    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Create a single preset option
   * @private
   * @param {Object} archetype
   * @returns {string}
   */
  _createPresetOption(archetype) {
    return `
      <button class="preset-option" data-archetype="${archetype.id}" role="option" aria-selected="false" tabindex="0">
        <span class="preset-option-icon" style="color: ${archetype.color};" aria-hidden="true">${archetype.icon}</span>
        <div class="preset-option-info">
          <span class="preset-option-name">${archetype.name}</span>
          <span class="preset-option-desc">${archetype.description}</span>
        </div>
        <span class="preset-option-check" aria-hidden="true">\u2713</span>
      </button>
    `;
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Toggle button
    const toggleBtn = this.containerElement.querySelector(
      '.preset-selector-toggle'
    );
    toggleBtn.addEventListener('click', () => this.toggle());

    // Preset options
    const options = /** @type {NodeListOf<HTMLElement>} */ (
      this.containerElement.querySelectorAll('.preset-option')
    );
    options.forEach(option => {
      option.addEventListener('click', e => this._handlePresetSelect(e));
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (
        !this.containerElement.contains(/** @type {Node} */ (e.target)) &&
        this.isOpen
      ) {
        this.close();
      }
    });

    // Keyboard navigation
    this.containerElement.addEventListener('keydown', e =>
      this._handleKeyDown(e)
    );
  }

  /**
   * Handle keyboard navigation
   * @private
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    const options = /** @type {NodeListOf<HTMLElement>} */ (
      this.containerElement.querySelectorAll('.preset-option')
    );
    const currentIndex = Array.from(options).findIndex(
      opt => opt === document.activeElement
    );

    switch (e.key) {
      case 'Escape': {
        this.close();
        const toggleBtn = /** @type {HTMLElement} */ (
          this.containerElement.querySelector('.preset-selector-toggle')
        );
        toggleBtn.focus();
        e.preventDefault();
        break;
      }
      case 'ArrowDown':
        if (this.isOpen && currentIndex < options.length - 1) {
          options[currentIndex + 1].focus();
        } else if (!this.isOpen) {
          this.open();
        }
        e.preventDefault();
        break;
      case 'ArrowUp':
        if (this.isOpen && currentIndex > 0) {
          options[currentIndex - 1].focus();
        }
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        if (document.activeElement.classList.contains('preset-option')) {
          this._handlePresetSelect({ target: document.activeElement });
          e.preventDefault();
        }
        break;
    }
  }

  /**
   * Handle preset selection
   * @private
   * @param {Event | { target: Element | null }} e
   */
  _handlePresetSelect(e) {
    const target = /** @type {HTMLElement} */ (e.target);
    const option = /** @type {HTMLElement | null} */ (
      target.closest('.preset-option')
    );
    if (!option) {
      return;
    }

    const archetypeId = option.dataset.archetype;
    this.selectArchetype(archetypeId);
    this.close();
  }

  /**
   * Select an archetype
   * @param {string} archetypeId
   */
  selectArchetype(archetypeId) {
    const archetype = this.archetypes.find(a => a.id === archetypeId);
    if (!archetype) {
      return;
    }

    this.selectedArchetype = archetypeId;

    // Update UI
    this._updateSelectedUI(archetype);

    // Update option states
    const options = /** @type {NodeListOf<HTMLElement>} */ (
      this.containerElement.querySelectorAll('.preset-option')
    );
    options.forEach(option => {
      const isSelected = option.dataset.archetype === archetypeId;
      option.classList.toggle('selected', isSelected);
      option.setAttribute('aria-selected', String(isSelected));
    });

    // Notify callback
    if (this.onPresetChange) {
      this.onPresetChange(archetypeId, archetype);
    }
  }

  /**
   * Update the selected archetype display
   * @private
   * @param {Object} archetype
   */
  _updateSelectedUI(archetype) {
    const iconEl = /** @type {HTMLElement | null} */ (
      this.containerElement.querySelector('#current-preset-icon')
    );
    const labelEl = this.containerElement.querySelector(
      '#current-preset-label'
    );

    if (iconEl) {
      iconEl.textContent = archetype.icon;
      iconEl.style.color = archetype.color;
    }
    if (labelEl) {
      labelEl.textContent = archetype.name;
    }
  }

  /**
   * Update for a specific track
   * @private
   * @param {number} trackNum
   */
  _updateForTrack(trackNum) {
    const recommendedId = this.trackArchetypes[trackNum];
    if (!recommendedId) {
      return;
    }

    this.recommendedArchetype = recommendedId;
    const recommended = this.archetypes.find(a => a.id === recommendedId);

    if (recommended) {
      // Update recommended section
      const recommendedSection = /** @type {HTMLElement | null} */ (
        this.containerElement.querySelector('#preset-recommended')
      );
      const recommendedName =
        this.containerElement.querySelector('#recommended-name');

      if (recommendedSection && recommendedName) {
        recommendedSection.hidden = false;
        recommendedName.textContent = recommended.name;
      }

      // Mark recommended option
      const options = /** @type {NodeListOf<HTMLElement>} */ (
        this.containerElement.querySelectorAll('.preset-option')
      );
      options.forEach(option => {
        option.classList.toggle(
          'recommended',
          option.dataset.archetype === recommendedId
        );
      });

      // If no archetype selected yet, select the recommended one
      if (!this.selectedArchetype) {
        this.selectArchetype(recommendedId);
      }
    }
  }

  /**
   * Open the dropdown
   */
  open() {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.containerElement.classList.add('open');

    const toggleBtn = this.containerElement.querySelector(
      '.preset-selector-toggle'
    );
    toggleBtn.setAttribute('aria-expanded', 'true');

    const list = /** @type {HTMLElement | null} */ (
      this.containerElement.querySelector('#preset-list')
    );
    list.hidden = false;

    // Focus first option
    const firstOption = /** @type {HTMLElement | null} */ (
      this.containerElement.querySelector('.preset-option')
    );
    if (firstOption) {
      firstOption.focus();
    }
  }

  /**
   * Close the dropdown
   */
  close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.containerElement.classList.remove('open');

    const toggleBtn = this.containerElement.querySelector(
      '.preset-selector-toggle'
    );
    toggleBtn.setAttribute('aria-expanded', 'false');

    const list = /** @type {HTMLElement | null} */ (
      this.containerElement.querySelector('#preset-list')
    );
    list.hidden = true;
  }

  /**
   * Toggle dropdown visibility
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Set current track and update recommended preset
   * @param {number} trackNum
   */
  setTrack(trackNum) {
    this.currentTrack = trackNum;
    this._updateForTrack(trackNum);
  }

  /**
   * Set scene manager reference
   * @param {Object} sceneManager
   */
  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  /**
   * Get current selected archetype
   * @returns {string|null}
   */
  getSelectedArchetype() {
    return this.selectedArchetype;
  }

  /**
   * Get recommended archetype for current track
   * @returns {string|null}
   */
  getRecommendedArchetype() {
    return this.recommendedArchetype;
  }

  /**
   * Get all available archetypes
   * @returns {Array}
   */
  getArchetypes() {
    return [...this.archetypes];
  }

  /**
   * Get current state
   * @returns {Object}
   */
  getState() {
    return {
      selectedArchetype: this.selectedArchetype,
      currentTrack: this.currentTrack,
    };
  }

  /**
   * Load state
   * @param {Object} state
   */
  loadState(state) {
    if (!state) {
      return;
    }

    if (state.currentTrack !== undefined) {
      this.currentTrack = state.currentTrack;
      this._updateForTrack(state.currentTrack);
    }

    if (state.selectedArchetype) {
      this.selectArchetype(state.selectedArchetype);
    }
  }

  /**
   * Reset to recommended preset
   */
  resetToRecommended() {
    if (this.recommendedArchetype) {
      this.selectArchetype(this.recommendedArchetype);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.containerElement && this.containerElement.parentElement) {
      this.containerElement.parentElement.removeChild(this.containerElement);
    }

    this.containerElement = null;
    this.sceneManager = null;
  }
}

// Export for global scope
window.PresetSelector = PresetSelector;
