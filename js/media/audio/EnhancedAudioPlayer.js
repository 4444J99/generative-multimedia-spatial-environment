'use strict';

/**
 * EnhancedAudioPlayer
 * Self-hosted audio player using Howler.js with crossfade, volume control,
 * and event-based state management. Reads configuration from ETCETER4_CONFIG.media.audio.
 *
 * @class EnhancedAudioPlayer
 * @example
 * const player = new EnhancedAudioPlayer({
 *   tracks: [
 *     { id: 'track1', title: 'Song 1', url: '/audio/song1.mp3' },
 *     { id: 'track2', title: 'Song 2', url: '/audio/song2.mp3' }
 *   ]
 * });
 * player.on('play', () => console.log('Playing'));
 * player.play();
 */
class EnhancedAudioPlayer {
  /**
   * Create an EnhancedAudioPlayer instance
   * @param {Object} options - Configuration object
   * @param {Array<Object>} [options.tracks] - Array of track objects with id, title, url properties (empty until tracks are added via addTrack)
   * @param {number} [options.volume] - Initial volume (0-1), defaults to config.defaultVolume
   * @param {number} [options.crossfadeDuration] - Crossfade duration in ms, defaults to config
   * @param {boolean} [options.autoPlay] - Whether to start playing automatically
   * @param {boolean} [options.autoAdvance] - Whether to advance to the next track when one ends, defaults to true
   */
  constructor(options = {}) {
    const siteConfig =
      typeof ETCETER4_CONFIG !== 'undefined' ? ETCETER4_CONFIG : undefined;
    this.config = siteConfig?.media?.audio || {
      crossfadeDuration: 1000,
      defaultVolume: 0.8,
      fadeOutDuration: 500,
      fadeInDuration: 500,
    };

    this.tracks = options.tracks || [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.autoAdvance = options.autoAdvance !== false;

    // Volume state
    this.volume = options.volume ?? this.config.defaultVolume;
    this.crossfadeDuration =
      options.crossfadeDuration ?? this.config.crossfadeDuration;

    // Howler.js sound instance
    this.sound = null;

    // Event listeners storage
    this.listeners = new Map();

    // Crossfade state
    this.isCrossfading = false;
    this.fadeTimeout = null;

    // Initialize with first track if available
    if (this.tracks.length > 0) {
      this.loadTrack(0);
    }

    // Auto-play if requested
    if (options.autoPlay && this.tracks.length > 0) {
      this.play();
    }
  }

  /**
   * Load a track by index. Public: PlaylistManager drives track selection
   * through it (it is the player's track-loading entry point, not an
   * internal helper).
   * @param {number} index - Track index to load
   */
  loadTrack(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.tracks.length) {
      return false;
    }

    // Stop and unload current sound
    if (this.sound) {
      this.sound.stop();
      this.sound.unload();
    }
    this.sound = null;
    this.isPlaying = false;
    this.isPaused = false;
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    // Clear any pending fade timeouts
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    this.isCrossfading = false;
    this.currentTrackIndex = index;
    const track = this.tracks[index];
    const source = track.url || track.src;
    // An official release webpage is not an audio file. Unavailable sources
    // must clear the previous sound rather than replay it under another title.
    if (typeof source !== 'string' || !source.trim()) {
      this.emit('unavailable', { track, index });
      return false;
    }

    // Create new Howler sound instance
    this.sound = new Howl({
      src: [source],
      html5: true,
      volume: this.volume,
      onplay: () => {
        this.isPlaying = true;
        this.isPaused = false;
        this.emit('play', { track: this.getCurrentTrack() });
      },
      onpause: () => {
        this.isPaused = true;
        this.isPlaying = false;
        this.emit('pause', { track: this.getCurrentTrack() });
      },
      onstop: () => {
        this.isPlaying = false;
        this.isPaused = false;
        this.emit('stop', { track: this.getCurrentTrack() });
      },
      onend: () => {
        this.isPlaying = false;
        this.isPaused = false;
        this.emit('ended', { track: this.getCurrentTrack() });
        // Auto-advance to next track
        if (this.autoAdvance) {
          this.next();
        }
      },
      onload: () => {
        this.emit('loaded', { track: this.getCurrentTrack() });
      },
      onloaderror: (_id, err) => {
        this.isPlaying = false;
        this.emit('error', { error: err, track: this.getCurrentTrack() });
      },
      onplayerror: (_id, err) => {
        this.isPlaying = false;
        this.emit('error', { error: err, track: this.getCurrentTrack() });
      },
    });

    // Setup progress tracking interval
    this.setupProgressTracking();

    this.emit('trackChange', {
      track: this.getCurrentTrack(),
      index: this.currentTrackIndex,
      total: this.tracks.length,
    });
    return true;
  }

  /**
   * Setup interval for progress tracking
   * @private
   */
  setupProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (this.sound && this.isPlaying) {
        const position = this.sound.seek();
        const duration = this.sound.duration();
        this.emit('progress', {
          position,
          duration,
          percentComplete: duration > 0 ? (position / duration) * 100 : 0,
        });
      }
    }, 100);
  }

  /**
   * Play the current track
   */
  play() {
    if (!this.sound) {
      if (this.tracks.length > 0) {
        if (!this.loadTrack(this.currentTrackIndex)) {
          return false;
        }
      } else {
        return false;
      }
    }

    this.sound.play();
    return true;
  }

  /**
   * Pause the current track
   */
  pause() {
    if (this.sound && this.isPlaying) {
      this.sound.pause();
    }
  }

  /**
   * Toggle between play and pause
   */
  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Stop playback and reset position
   */
  stop() {
    if (this.sound) {
      this.sound.stop();
    }
    this.isPlaying = false;
    this.isPaused = false;
  }

  /**
   * Play next track with crossfade
   */
  next() {
    if (!this.tracks.length) {
      return;
    }
    const nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.playTrackWithCrossfade(nextIndex);
  }

  /**
   * Play previous track with crossfade
   */
  previous() {
    if (!this.tracks.length) {
      return;
    }
    const prevIndex =
      (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.playTrackWithCrossfade(prevIndex);
  }

  /**
   * Play a track by index with crossfade effect
   * @private
   * @param {number} index - Track index to play
   */
  playTrackWithCrossfade(index) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.tracks.length ||
      index === this.currentTrackIndex ||
      this.isCrossfading
    ) {
      return;
    }

    this.isCrossfading = true;
    const wasPlaying = this.isPlaying;

    if (this.sound && this.isPlaying) {
      // Fade out current track
      this.sound.fade(this.volume, 0, this.config.fadeOutDuration);

      // Clear existing timeout
      if (this.fadeTimeout) {
        clearTimeout(this.fadeTimeout);
      }

      // Switch tracks after fade completes
      this.fadeTimeout = setTimeout(() => {
        this.loadTrack(index);

        if (wasPlaying) {
          // Fade in new track
          if (this.sound) {
            this.sound.volume(0);
            this.play();
            this.sound.fade(0, this.volume, this.config.fadeInDuration);
          }
        }

        this.isCrossfading = false;
      }, this.config.fadeOutDuration);
    } else {
      // If not playing, just switch tracks
      this.loadTrack(index);
      this.isCrossfading = false;
    }
  }

  /**
   * Seek to a position in the current track (0-1 range)
   * @param {number} position - Position as percentage (0-1)
   */
  seek(position) {
    if (this.sound && this.sound.duration() > 0) {
      const seconds = position * this.sound.duration();
      this.sound.seek(seconds);
    }
  }

  /**
   * Seek to specific seconds in the current track
   * @param {number} seconds - Time in seconds
   */
  seekTo(seconds) {
    if (this.sound) {
      this.sound.seek(seconds);
    }
  }

  /**
   * Set volume
   * @param {number} vol - Volume level (0-1)
   */
  setVolume(vol) {
    const clampedVolume = Math.max(0, Math.min(1, vol));
    this.volume = clampedVolume;

    if (this.sound) {
      this.sound.volume(clampedVolume);
    }

    this.emit('volumeChange', { volume: clampedVolume });
  }

  /**
   * Get current volume
   * @returns {number} Current volume (0-1)
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Get the current track object
   * @returns {Object|null} Current track or null if no tracks loaded
   */
  getCurrentTrack() {
    if (
      this.currentTrackIndex >= 0 &&
      this.currentTrackIndex < this.tracks.length
    ) {
      return this.tracks[this.currentTrackIndex];
    }
    return null;
  }

  /**
   * Get duration of current track in seconds
   * @returns {number} Duration in seconds
   */
  getDuration() {
    return this.sound ? this.sound.duration() : 0;
  }

  /**
   * Get current playback position in seconds
   * @returns {number} Position in seconds
   */
  getPosition() {
    return this.sound ? this.sound.seek() : 0;
  }

  /**
   * Get current track index
   * @returns {number} Current track index
   */
  getCurrentTrackIndex() {
    return this.currentTrackIndex;
  }

  /**
   * Get total number of tracks
   * @returns {number} Total tracks
   */
  getTotalTracks() {
    return this.tracks.length;
  }

  /**
   * Add a track to the queue
   * @param {Object} track - Track object with id, title, url
   */
  addTrack(track) {
    this.tracks.push(track);
    this.emit('queueUpdate', { tracks: this.tracks });
  }

  /**
   * Remove a track from the queue by index
   * @param {number} index - Track index to remove
   */
  removeTrack(index) {
    if (index >= 0 && index < this.tracks.length) {
      this.tracks.splice(index, 1);

      // Adjust current index if necessary
      if (index <= this.currentTrackIndex && this.currentTrackIndex > 0) {
        this.currentTrackIndex--;
      }

      this.emit('queueUpdate', { tracks: this.tracks });
    }
  }

  /**
   * Clear all tracks and stop playback
   */
  clearQueue() {
    this.stop();
    if (this.sound) {
      this.sound.unload();
      this.sound = null;
    }
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.isCrossfading = false;
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.emit('queueUpdate', { tracks: [] });
  }

  /**
   * Get current queue
   * @returns {Array<Object>} Array of track objects
   */
  getQueue() {
    return [...this.tracks];
  }

  /**
   * Register an event listener
   * @param {string} event - Event name (play, pause, ended, progress, trackChange, etc.)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unregister an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event to all registered listeners
   * @private
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      });
    }
  }

  /**
   * Clean up resources and remove all listeners
   */
  dispose() {
    // Stop playback
    if (this.sound) {
      this.sound.stop();
      this.sound.unload();
      this.sound = null;
    }

    // Clear intervals and timeouts
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // Remove all listeners
    this.listeners.clear();

    // Clear tracks
    this.tracks = [];
    this.currentTrackIndex = 0;
  }

  /**
   * Get player state
   * @returns {Object} Current player state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isCrossfading: this.isCrossfading,
      currentTrackIndex: this.currentTrackIndex,
      currentTrack: this.getCurrentTrack(),
      volume: this.volume,
      position: this.getPosition(),
      duration: this.getDuration(),
      totalTracks: this.tracks.length,
    };
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.EnhancedAudioPlayer = EnhancedAudioPlayer;
}
