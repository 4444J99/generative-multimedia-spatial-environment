/**
 * @file AmbientSoundLayer.js
 * @description Ambient sound layer for background audio in the Living Pantheon system
 * Provides subtle, chamber-specific ambient audio with crossfading and volume control
 *
 * Features:
 * ---------
 * - 5% base volume (0.05) for subtle background ambience
 * - Chamber-specific ambient tracks loaded from config
 * - Smooth 2-second crossfade between chambers
 * - Indefinite looping with pause/resume support
 * - Master volume control and mute functionality
 * - Graceful fallback for missing audio files
 *
 * Configuration (from ETCETER4_CONFIG.livingPantheon.ambient):
 * - enabled: boolean (default: true)
 * - baseVolume: 0.05 (5% for subtle background)
 * - chamberSpecific: boolean (use chamber-specific tracks)
 * - crossfadeDuration: 2000 (fade duration in ms)
 * - defaultTrack: fallback track path
 * - chamberTracks: object mapping chamber IDs to audio file paths
 *
 * Usage:
 * ------
 * const ambientLayer = new AmbientSoundLayer();
 * ambientLayer.start();
 * ambientLayer.setChamber('akademia');
 *
 * // Later...
 * ambientLayer.setVolume(0.1);
 * ambientLayer.stop();
 * ambientLayer.dispose();
 */

'use strict';

/**
 * Ambient sound configuration, mirroring ETCETER4_CONFIG.livingPantheon.ambient
 * (js/config.js). Every field is optional: the constructor merges its own
 * defaults over the global section.
 *
 * @typedef {Object} AmbientSoundOptions
 * @property {boolean} [enabled]
 * @property {number} [baseVolume] - Base volume level (0.0 to 1.0)
 * @property {boolean} [chamberSpecific] - Use chamber-specific tracks
 * @property {number} [crossfadeDuration] - Fade duration in ms
 * @property {string} [defaultTrack] - Fallback track path
 * @property {Object.<string, string>} [chamberTracks] - Chamber-specific track mapping
 */
/**
 * AmbientSoundLayer - Manages background ambient audio for the Living Pantheon
 * @class
 */
class AmbientSoundLayer {
  /**
   * Create a new AmbientSoundLayer instance
   * @param {AmbientSoundOptions} [options] - Configuration options
   */
  constructor(options = {}) {
    // Get configuration from global config or use defaults
    /** @type {AmbientSoundOptions} */
    const configFromGlobal =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon?.ambient || {}
        : {};

    // Merge options with config and defaults
    this.config = {
      enabled: configFromGlobal.enabled !== false,
      baseVolume: options.baseVolume ?? configFromGlobal.baseVolume ?? 0.05,
      chamberSpecific:
        options.chamberSpecific ?? configFromGlobal.chamberSpecific ?? true,
      crossfadeDuration:
        options.crossfadeDuration ?? configFromGlobal.crossfadeDuration ?? 2000,
      defaultTrack:
        options.defaultTrack ??
        configFromGlobal.defaultTrack ??
        'audio/ambient/temple-drone.mp3',
      chamberTracks:
        options.chamberTracks ?? configFromGlobal.chamberTracks ?? {},
    };

    // State tracking
    this.isPlaying = false;
    this.isMuted = false;
    this.currentChamber = null;
    this.currentVolume = this.config.baseVolume;

    // Audio instances
    this.currentSound = null;
    this.nextSound = null;
    this.fadeOutTween = null;
    this.fadeInTween = null;

    // Ensure Howl is available
    if (typeof Howl === 'undefined') {
      console.warn('AmbientSoundLayer: Howler.js not loaded. Audio disabled.');
      this.config.enabled = false;
    }

    // Bind methods for cleanup
    this._onSoundEnd = this._onSoundEnd.bind(this);
    this._cleanupFadeTweens = this._cleanupFadeTweens.bind(this);
  }

  /**
   * Start the ambient sound layer
   * @returns {AmbientSoundLayer} Returns this for chaining
   */
  start() {
    if (!this.config.enabled || this.isPlaying) {
      return this;
    }

    this.isPlaying = true;

    // Start with default track or first available chamber track
    const initialTrack = this.config.defaultTrack;
    this._loadAndPlayTrack(initialTrack, false);

    return this;
  }

  /**
   * Stop the ambient sound layer
   * @returns {AmbientSoundLayer} Returns this for chaining
   */
  stop() {
    this.isPlaying = false;

    // Clean up fade tweens
    this._cleanupFadeTweens();

    // Stop and unload current sound
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound = null;
    }

    // Clean up next sound if in transition
    if (this.nextSound) {
      this.nextSound.stop();
      this.nextSound = null;
    }

    return this;
  }

  /**
   * Dispose of all resources and clean up
   */
  dispose() {
    this.stop();

    // Remove event listeners
    if (this.currentSound) {
      this.currentSound.off('end', this._onSoundEnd);
    }
    if (this.nextSound) {
      this.nextSound.off('end', this._onSoundEnd);
    }
  }

  /**
   * Set the master volume level
   * @param {number} volume - Volume from 0.0 to 1.0
   * @returns {AmbientSoundLayer} Returns this for chaining
   */
  setVolume(volume) {
    // Clamp volume to valid range
    this.currentVolume = Math.max(0, Math.min(1, volume));

    // Apply to current sound if playing and not muted
    if (this.currentSound && this.isPlaying && !this.isMuted) {
      this.currentSound.volume(this.currentVolume);
    }

    return this;
  }

  /**
   * Mute the ambient layer
   * @returns {AmbientSoundLayer} Returns this for chaining
   */
  mute() {
    this.isMuted = true;

    if (this.currentSound) {
      this.currentSound.volume(0);
    }
    if (this.nextSound) {
      this.nextSound.volume(0);
    }

    return this;
  }

  /**
   * Unmute the ambient layer
   * @returns {AmbientSoundLayer} Returns this for chaining
   */
  unmute() {
    this.isMuted = false;

    if (this.currentSound && this.isPlaying) {
      this.currentSound.volume(this.currentVolume);
    }
    if (this.nextSound) {
      this.nextSound.volume(this.currentVolume);
    }

    return this;
  }

  /**
   * Change to a different chamber's ambient track
   * @param {string} chamberId - The chamber ID (e.g., 'akademia', 'agora')
   * @returns {AmbientSoundLayer} Returns this for chaining
   */
  setChamber(chamberId) {
    if (!this.config.enabled || !this.isPlaying) {
      return this;
    }

    // Skip if already playing this chamber
    if (this.currentChamber === chamberId) {
      return this;
    }

    // Get the track for this chamber
    const trackPath = this.config.chamberTracks[chamberId];

    if (!trackPath) {
      console.warn(
        `AmbientSoundLayer: No track found for chamber "${chamberId}"`
      );
      return this;
    }

    // Update current chamber
    this.currentChamber = chamberId;

    // Perform crossfade to new track
    this._performCrossfade(trackPath);

    return this;
  }

  /**
   * Get current system status
   * @returns {Object} Status object with playing state and configuration
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      currentChamber: this.currentChamber,
      currentVolume: this.currentVolume,
      baseVolume: this.config.baseVolume,
      config: { ...this.config },
    };
  }

  /**
   * Load and play a track with optional fade-in
   * @private
   * @param {string} trackPath - Path to audio file
   * @param {boolean} [fadeIn=true] - Whether to fade in the audio
   */
  _loadAndPlayTrack(trackPath, fadeIn = true) {
    // Validate track path exists
    if (!trackPath) {
      console.warn('AmbientSoundLayer: Empty track path provided');
      return;
    }

    // Create new sound instance
    const sound = new Howl({
      src: [trackPath],
      volume: fadeIn ? 0 : this.currentVolume,
      loop: true,
      autoplay: true,
      onload: () => {
        // Add end listener for manual resumption if needed
        sound.on('end', this._onSoundEnd);
      },
      onloaderror: (id, err) => {
        console.warn(`AmbientSoundLayer: Failed to load "${trackPath}":`, err);
      },
      onplayerror: (id, err) => {
        console.warn(`AmbientSoundLayer: Sound error for "${trackPath}":`, err);
      },
    });

    // Set as current sound
    this.currentSound = sound;

    // Fade in if requested
    if (fadeIn) {
      this._fadeInSound(sound);
    } else if (!this.isMuted) {
      sound.volume(this.currentVolume);
    }
  }

  /**
   * Perform crossfade between current and next track
   * @private
   * @param {string} newTrackPath - Path to new audio file
   */
  _performCrossfade(newTrackPath) {
    // Clean up any existing tweens
    this._cleanupFadeTweens();

    // Load the new track (starts with volume 0)
    const newSound = new Howl({
      src: [newTrackPath],
      volume: 0,
      loop: true,
      autoplay: true,
      onload: () => {
        newSound.on('end', this._onSoundEnd);
      },
      onloaderror: (id, err) => {
        console.warn(
          `AmbientSoundLayer: Failed to load new track "${newTrackPath}":`,
          err
        );
      },
      onplayerror: (id, err) => {
        console.warn(
          `AmbientSoundLayer: Sound error for new track "${newTrackPath}":`,
          err
        );
      },
    });

    this.nextSound = newSound;

    // Start fade out/in immediately
    this._startCrossfade();
  }

  /**
   * Start the crossfade animation between sounds
   * @private
   */
  _startCrossfade() {
    const fadeDuration = this.config.crossfadeDuration;
    const startTime = performance.now();
    const oldVolume = this.currentVolume;

    // Fade function using requestAnimationFrame
    const fadeFn = currentTime => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);

      // Fade out current sound
      if (this.currentSound && !this.isMuted) {
        this.currentSound.volume(oldVolume * (1 - progress));
      }

      // Fade in next sound
      if (this.nextSound && !this.isMuted) {
        this.nextSound.volume(oldVolume * progress);
      }

      // If crossfade complete, swap sounds
      if (progress >= 1) {
        if (this.currentSound) {
          this.currentSound.stop();
        }
        this.currentSound = this.nextSound;
        this.nextSound = null;

        // Ensure volume is set correctly on new current sound
        if (this.currentSound && !this.isMuted) {
          this.currentSound.volume(oldVolume);
        }
      } else {
        // Continue animation
        this.fadeOutTween = requestAnimationFrame(fadeFn);
      }
    };

    this.fadeOutTween = requestAnimationFrame(fadeFn);
  }

  /**
   * Fade in a sound from silence to current volume
   * @private
   * @param {Howl} sound - The sound to fade in
   */
  _fadeInSound(sound) {
    const fadeDuration = 1000; // 1 second fade in
    const startTime = performance.now();
    const targetVolume = this.isMuted ? 0 : this.currentVolume;

    const fadeFn = currentTime => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);

      const newVolume = targetVolume * progress;
      sound.volume(newVolume);

      if (progress < 1) {
        this.fadeInTween = requestAnimationFrame(fadeFn);
      }
    };

    this.fadeInTween = requestAnimationFrame(fadeFn);
  }

  /**
   * Clean up any active fade tweens
   * @private
   */
  _cleanupFadeTweens() {
    if (this.fadeOutTween) {
      cancelAnimationFrame(this.fadeOutTween);
      this.fadeOutTween = null;
    }

    if (this.fadeInTween) {
      cancelAnimationFrame(this.fadeInTween);
      this.fadeInTween = null;
    }
  }

  /**
   * Handle sound end event (shouldn't fire due to loop: true, but kept for safety)
   * @private
   */
  _onSoundEnd() {
    // Loop should handle this, but if it doesn't, we could restart here
    if (this.isPlaying && this.currentSound) {
      this.currentSound.play();
    }
  }
}

// Export for global scope
window.AmbientSoundLayer = AmbientSoundLayer;
