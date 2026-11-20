/**
 * @file LivingPantheonCore.js
 * @description Central orchestrator singleton for the Living Pantheon generative system
 *
 * Manages lifecycle and coordination of all Living Pantheon subsystems:
 * - GlobalGlitchSystem: Random visual glitch effects (2% frequency)
 * - AmbientSoundLayer: Chamber-specific ambient audio (5% volume)
 * - MorphingImageSystem: Photo→glitch→abstract morphing over 60s cycles
 * - AnimatedContentSystem: Breathing animations and text drift
 *
 * Features:
 * - Singleton pattern with lazy loading of subsystems
 * - Keyboard toggle: Ctrl+Shift+L
 * - localStorage persistence via config.accessibility.storageKey
 * - Respects prefers-reduced-motion media query
 * - Chamber-specific initialization hooks
 * - Event emitter pattern for status changes
 *
 * Configuration source: ETCETER4_CONFIG.livingPantheon
 *
 * Usage:
 * ------
 * const core = LivingPantheonCore.getInstance();
 * core.initialize({ chamberId: 'akademia', chamberColor: '#2c3e50' });
 * core.start();
 *
 * // Later, in page transitions:
 * core.transitionToNewChamber('bibliotheke', '#34495e');
 *
 * // Listen for status changes
 * window.addEventListener('living-pantheon-status-change', (e) => {
 *   console.log(e.detail.status); // { isRunning, enabledSystems, ... }
 * });
 */

'use strict';

/**
 * Living Pantheon configuration, mirroring ETCETER4_CONFIG.livingPantheon
 * (js/config.js). Every field is optional: the constructor falls back to {}
 * when the global config is absent, and each subsystem merges its own
 * defaults over the section it reads.
 *
 * @typedef {Object} LivingPantheonConfig
 * @property {boolean} [enabled] - Master toggle
 * @property {Object} [glitch] - Global glitch effects
 * @property {boolean} [glitch.enabled]
 * @property {number} [glitch.frequency] - Probability of a glitch per check
 * @property {number} [glitch.checkInterval] - Check interval in ms
 * @property {string[]} [glitch.types] - Glitch effect types to use
 * @property {Object} [glitch.duration] - Effect duration range in ms
 * @property {number} [glitch.duration.min]
 * @property {number} [glitch.duration.max]
 * @property {string[]} [glitch.excludeSelectors]
 * @property {Object} [morphing] - Morphing image system
 * @property {boolean} [morphing.enabled]
 * @property {number} [morphing.transitionDuration]
 * @property {number} [morphing.pauseBetween]
 * @property {string[]} [morphing.targetSelectors]
 * @property {string[]} [morphing.blendModes]
 * @property {Object} [ambient] - Ambient sound layer
 * @property {boolean} [ambient.enabled]
 * @property {number} [ambient.baseVolume]
 * @property {boolean} [ambient.chamberSpecific]
 * @property {number} [ambient.crossfadeDuration]
 * @property {string} [ambient.defaultTrack]
 * @property {Object.<string, string>} [ambient.chamberTracks]
 * @property {Object} [animation] - Animated content
 * @property {boolean} [animation.enabled]
 * @property {Object} [animation.breathing]
 * @property {boolean} [animation.breathing.enabled]
 * @property {number} [animation.breathing.scaleMin]
 * @property {number} [animation.breathing.scaleMax]
 * @property {number} [animation.breathing.duration]
 * @property {string[]} [animation.breathing.targetSelectors]
 * @property {Object} [animation.textDrift]
 * @property {boolean} [animation.textDrift.enabled]
 * @property {number} [animation.textDrift.maxDrift]
 * @property {number} [animation.textDrift.duration]
 * @property {string[]} [animation.textDrift.targetSelectors]
 * @property {Object} [labyrinth] - Generative labyrinth
 * @property {boolean} [labyrinth.enabled]
 * @property {number} [labyrinth.fragmentCount]
 * @property {number} [labyrinth.loopholeCount]
 * @property {string[]} [labyrinth.fragmentSources]
 * @property {number} [labyrinth.loopholeProbability]
 * @property {Object} [glitchTunnels] - Glitch tunnel transitions
 * @property {boolean} [glitchTunnels.enabled]
 * @property {number} [glitchTunnels.probability]
 * @property {number} [glitchTunnels.duration]
 * @property {number} [glitchTunnels.captureWidth]
 * @property {number} [glitchTunnels.captureHeight]
 * @property {Object} [glitchTunnels.pixelSort]
 * @property {number} [glitchTunnels.pixelSort.thresholdLow]
 * @property {number} [glitchTunnels.pixelSort.thresholdHigh]
 * @property {Object} [accessibility]
 * @property {boolean} [accessibility.respectReducedMotion]
 * @property {boolean} [accessibility.allowUserToggle]
 * @property {string} [accessibility.storageKey]
 * @property {Object} [accessibility.toggleShortcut]
 * @property {boolean} [accessibility.toggleShortcut.ctrl]
 * @property {boolean} [accessibility.toggleShortcut.shift]
 * @property {string} [accessibility.toggleShortcut.key]
 */
/**
 * LivingPantheonCore - Central orchestrator for Living Pantheon system
 * @class
 */
class LivingPantheonCore {
  /**
   * Get or create the singleton instance
   * @static
   * @returns {LivingPantheonCore}
   */
  static getInstance() {
    if (!window.livingPantheonCoreInstance) {
      window.livingPantheonCoreInstance = new LivingPantheonCore();
    }
    return window.livingPantheonCoreInstance;
  }

  /**
   * Create a new LivingPantheonCore instance
   * Private constructor - use getInstance() instead
   * @private
   */
  constructor() {
    // Get configuration from global config or use defaults
    /** @type {LivingPantheonConfig} */
    this.config =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon || {}
        : {};

    // Core state
    this.isInitialized = false;
    this.isRunning = false;
    this.currentChamberId = null;
    this.currentChamberColor = null;

    // User preference from localStorage
    const storageKey =
      this.config.accessibility?.storageKey ||
      'etceter4-living-pantheon-enabled';
    this.storageKey = storageKey;
    this.userEnabledInStorage = localStorage.getItem(storageKey) !== 'false';

    // Subsystem instances (lazy-loaded)
    this.subsystems = {
      glitch: null,
      ambient: null,
      morphing: null,
      animation: null,
      labyrinth: null,
      tunnels: null,
    };

    // Event emitter state
    this.listeners = new Set();

    // Bind methods
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /**
   * Initialize the Living Pantheon system
   * @param {Object} [options] - Initialization options
   * @param {string} [options.chamberId] - Initial chamber ID
   * @param {string} [options.chamberColor] - Initial chamber color (hex or named)
   * @returns {LivingPantheonCore} Returns this for chaining
   */
  initialize(options = {}) {
    if (this.isInitialized) {
      console.warn('LivingPantheonCore: Already initialized');
      return this;
    }

    // Check if system is globally disabled
    if (this.config.enabled === false) {
      console.warn('LivingPantheonCore: Disabled in config');
      return this;
    }

    // Check for prefers-reduced-motion
    if (this._prefersReducedMotion()) {
      console.warn(
        'LivingPantheonCore: Disabled due to prefers-reduced-motion'
      );
      return this;
    }

    // Set chamber info
    this.currentChamberId = options.chamberId || null;
    this.currentChamberColor = options.chamberColor || null;

    // Set up keyboard shortcut for toggle
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    this.isInitialized = true;
    this._emitStatusChange();

    return this;
  }

  /**
   * Start the Living Pantheon system
   * Respects user preference from localStorage
   * @returns {LivingPantheonCore} Returns this for chaining
   */
  start() {
    if (!this.isInitialized) {
      console.warn('LivingPantheonCore: Must call initialize() first');
      return this;
    }

    if (this.isRunning) {
      return this;
    }

    // Check user preference
    if (!this.userEnabledInStorage) {
      console.warn('LivingPantheonCore: User has disabled via localStorage');
      return this;
    }

    this.isRunning = true;

    // Start enabled subsystems
    if (this.config.glitch?.enabled) {
      this._ensureGlitchSystem().start();
    }
    if (this.config.ambient?.enabled) {
      this._ensureAmbientSoundLayer().start();
    }
    if (this.config.morphing?.enabled) {
      this._ensureMorphingImageSystem().start();
    }
    if (this.config.animation?.enabled) {
      this._ensureAnimatedContentSystem().start();
    }
    if (this.config.labyrinth?.enabled) {
      const labyrinth = this._ensureLabyrinthGenerator();
      if (labyrinth && !labyrinth.isInitialized) {
        labyrinth.initialize();
      }
    }
    if (this.config.glitchTunnels?.enabled) {
      this._ensureGlitchTunnelSystem()?.start();
    }

    this._emitStatusChange();

    return this;
  }

  /**
   * Stop the Living Pantheon system
   * @returns {LivingPantheonCore} Returns this for chaining
   */
  stop() {
    if (!this.isRunning) {
      return this;
    }

    this.isRunning = false;

    // Stop all active subsystems
    if (this.subsystems.glitch) {
      this.subsystems.glitch.stop();
    }
    if (this.subsystems.ambient) {
      this.subsystems.ambient.stop();
    }
    if (this.subsystems.morphing) {
      this.subsystems.morphing.stop();
    }
    if (this.subsystems.animation) {
      this.subsystems.animation.stop();
    }
    if (this.subsystems.tunnels) {
      this.subsystems.tunnels.stop();
    }

    this._emitStatusChange();

    return this;
  }

  /**
   * Toggle the Living Pantheon system on/off
   * Persists preference to localStorage
   * @returns {LivingPantheonCore} Returns this for chaining
   */
  toggle() {
    const newState = !this.isRunning;

    if (newState) {
      this.userEnabledInStorage = true;
      localStorage.setItem(this.storageKey, 'true');
      this.start();
    } else {
      this.userEnabledInStorage = false;
      localStorage.setItem(this.storageKey, 'false');
      this.stop();
    }

    return this;
  }

  /**
   * Dispose of all resources and clean up
   */
  dispose() {
    this.stop();

    // Remove event listeners
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    // Dispose all subsystems
    if (this.subsystems.glitch) {
      this.subsystems.glitch.dispose();
      this.subsystems.glitch = null;
    }
    if (this.subsystems.ambient) {
      this.subsystems.ambient.dispose();
      this.subsystems.ambient = null;
    }
    if (this.subsystems.morphing) {
      this.subsystems.morphing.dispose();
      this.subsystems.morphing = null;
    }
    if (this.subsystems.animation) {
      this.subsystems.animation.dispose();
      this.subsystems.animation = null;
    }
    if (this.subsystems.labyrinth) {
      this.subsystems.labyrinth.dispose();
      this.subsystems.labyrinth = null;
    }
    if (this.subsystems.tunnels) {
      this.subsystems.tunnels.dispose();
      this.subsystems.tunnels = null;
    }

    this.isInitialized = false;
    this.listeners.clear();

    this._emitStatusChange();
  }

  /**
   * Transition to a new chamber
   * Updates chamber context for subsystems that care
   * @param {string} chamberId - New chamber identifier
   * @param {string} [chamberColor] - Optional chamber color
   * @returns {LivingPantheonCore} Returns this for chaining
   */
  transitionToNewChamber(chamberId, chamberColor) {
    const previousChamberId = this.currentChamberId;
    this.currentChamberId = chamberId;
    if (chamberColor) {
      this.currentChamberColor = chamberColor;
    }

    // Notify subsystems of chamber change
    if (this.subsystems.ambient) {
      this.subsystems.ambient.transitionToChamber?.(chamberId);
    }

    this._emitStatusChange({
      event: 'chamber-transition',
      from: previousChamberId,
      to: chamberId,
    });

    return this;
  }

  /**
   * Get current system status
   * @returns {Object} Status object with running state and subsystem info
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      currentChamberId: this.currentChamberId,
      currentChamberColor: this.currentChamberColor,
      userEnabledInStorage: this.userEnabledInStorage,
      prefersReducedMotion: this._prefersReducedMotion(),
      subsystems: {
        glitch: this.subsystems.glitch
          ? this.subsystems.glitch.getStatus()
          : null,
        ambient: this.subsystems.ambient
          ? this.subsystems.ambient.getStatus?.()
          : null,
        morphing: this.subsystems.morphing
          ? this.subsystems.morphing.getStatus?.()
          : null,
        animation: this.subsystems.animation
          ? this.subsystems.animation.getStatus?.()
          : null,
        labyrinth: this.subsystems.labyrinth
          ? this.subsystems.labyrinth.getStatus?.()
          : null,
        tunnels: this.subsystems.tunnels
          ? this.subsystems.tunnels.getStatus?.()
          : null,
      },
      config: {
        enabled: this.config.enabled,
        glitch: !!this.config.glitch?.enabled,
        ambient: !!this.config.ambient?.enabled,
        morphing: !!this.config.morphing?.enabled,
        animation: !!this.config.animation?.enabled,
        labyrinth: !!this.config.labyrinth?.enabled,
        glitchTunnels: !!this.config.glitchTunnels?.enabled,
      },
    };
  }

  /**
   * Register a listener for status changes
   * @param {Function} callback - Function to call on status change
   */
  on(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  }

  /**
   * Unregister a listener
   * @param {Function} callback - Function to remove
   */
  off(callback) {
    this.listeners.delete(callback);
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
   * Emit status change event
   * @private
   * @param {Object} [details] - Additional details to include
   */
  _emitStatusChange(details = {}) {
    const status = this.getStatus();
    const eventDetail = {
      status,
      ...details,
    };

    // Notify local listeners
    for (const callback of this.listeners) {
      try {
        callback(eventDetail);
      } catch (error) {
        console.error('LivingPantheonCore listener error:', error);
      }
    }

    // Emit custom event on window for external listeners
    window.dispatchEvent(
      new CustomEvent('living-pantheon-status-change', {
        detail: eventDetail,
      })
    );
  }

  /**
   * Handle keyboard shortcuts
   * Ctrl+Shift+L toggles the system
   * @private
   * @param {KeyboardEvent} event
   */
  _onKeyDown(event) {
    if (!this.isInitialized) {
      return;
    }

    // Check for Ctrl+Shift+L
    const toggleShortcut = this.config.accessibility?.toggleShortcut;
    if (!toggleShortcut) {
      return;
    }

    const isCtrl =
      event.ctrlKey || (event.metaKey && navigator.platform.includes('Mac'));
    const isShift = event.shiftKey;
    const isL = event.key.toLowerCase() === toggleShortcut.key.toLowerCase();

    if (isCtrl && isShift && isL) {
      event.preventDefault();
      this.toggle();
    }
  }

  /**
   * Handle visibility changes
   * Pause when page is hidden, resume when visible
   * @private
   */
  _onVisibilityChange() {
    if (document.hidden) {
      // Pause all subsystems
      if (this.subsystems.glitch?.isRunning) {
        this.subsystems.glitch.stop();
      }
      if (this.subsystems.ambient?.isRunning) {
        this.subsystems.ambient.stop();
      }
      if (this.subsystems.morphing?.isRunning) {
        this.subsystems.morphing.stop();
      }
      if (this.subsystems.animation?.isRunning) {
        this.subsystems.animation.stop();
      }
      if (this.subsystems.tunnels?.isRunning) {
        this.subsystems.tunnels.stop();
      }
    } else if (this.isRunning) {
      // Resume all subsystems
      if (this.config.glitch?.enabled) {
        this.subsystems.glitch?.start?.();
      }
      if (this.config.ambient?.enabled) {
        this.subsystems.ambient?.start?.();
      }
      if (this.config.morphing?.enabled) {
        this.subsystems.morphing?.start?.();
      }
      if (this.config.animation?.enabled) {
        this.subsystems.animation?.start?.();
      }
      if (this.config.glitchTunnels?.enabled) {
        this.subsystems.tunnels?.start?.();
      }
    }
  }

  /**
   * Ensure GlobalGlitchSystem is instantiated
   * @private
   * @returns {GlobalGlitchSystem}
   */
  _ensureGlitchSystem() {
    if (!this.subsystems.glitch) {
      if (typeof GlobalGlitchSystem === 'undefined') {
        console.error('LivingPantheonCore: GlobalGlitchSystem not loaded');
        return null;
      }
      this.subsystems.glitch = new GlobalGlitchSystem(this.config.glitch);
    }
    return this.subsystems.glitch;
  }

  /**
   * Ensure AmbientSoundLayer is instantiated
   * @private
   * @returns {AmbientSoundLayer}
   */
  _ensureAmbientSoundLayer() {
    if (!this.subsystems.ambient) {
      if (typeof AmbientSoundLayer === 'undefined') {
        console.error('LivingPantheonCore: AmbientSoundLayer not loaded');
        return null;
      }
      this.subsystems.ambient = new AmbientSoundLayer({
        ...this.config.ambient,
      });
    }
    return this.subsystems.ambient;
  }

  /**
   * Ensure MorphingImageSystem is instantiated
   * @private
   * @returns {MorphingImageSystem}
   */
  _ensureMorphingImageSystem() {
    if (!this.subsystems.morphing) {
      if (typeof MorphingImageSystem === 'undefined') {
        console.error('LivingPantheonCore: MorphingImageSystem not loaded');
        return null;
      }
      this.subsystems.morphing = new MorphingImageSystem(this.config.morphing);
    }
    return this.subsystems.morphing;
  }

  /**
   * Ensure AnimatedContentSystem is instantiated
   * @private
   * @returns {AnimatedContentSystem}
   */
  _ensureAnimatedContentSystem() {
    if (!this.subsystems.animation) {
      if (typeof AnimatedContentSystem === 'undefined') {
        console.error('LivingPantheonCore: AnimatedContentSystem not loaded');
        return null;
      }
      this.subsystems.animation = new AnimatedContentSystem(
        this.config.animation
      );
    }
    return this.subsystems.animation;
  }

  /**
   * Ensure LabyrinthGenerator is instantiated
   * @private
   * @returns {LabyrinthGenerator|null}
   */
  _ensureLabyrinthGenerator() {
    if (!this.subsystems.labyrinth) {
      if (typeof LabyrinthGenerator === 'undefined') {
        console.error('LivingPantheonCore: LabyrinthGenerator not loaded');
        return null;
      }
      this.subsystems.labyrinth = new LabyrinthGenerator(this.config.labyrinth);
    }
    return this.subsystems.labyrinth;
  }

  /**
   * Ensure GlitchTunnelSystem is instantiated
   * @private
   * @returns {GlitchTunnelSystem|null}
   */
  _ensureGlitchTunnelSystem() {
    if (!this.subsystems.tunnels) {
      if (typeof GlitchTunnelSystem === 'undefined') {
        console.error('LivingPantheonCore: GlitchTunnelSystem not loaded');
        return null;
      }
      this.subsystems.tunnels = new GlitchTunnelSystem(
        this.config.glitchTunnels
      );
    }
    return this.subsystems.tunnels;
  }
}

// Export for global scope
window.LivingPantheonCore = LivingPantheonCore;
