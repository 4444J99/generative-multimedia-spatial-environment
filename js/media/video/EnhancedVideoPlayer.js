'use strict';

/**
 * EnhancedVideoPlayer
 * Self-hosted video player with HLS.js adaptive streaming, quality selection,
 * subtitle support, fullscreen, and event-based state management.
 * Reads configuration from ETCETER4_CONFIG.media.video.
 *
 * @class EnhancedVideoPlayer
 * @example
 * const player = new EnhancedVideoPlayer({
 *   container: document.getElementById('video-container'),
 *   hlsSupport: true,
 * });
 * player.load('/video/stream.m3u8');
 * player.on('play', () => console.log('Playing'));
 * player.play();
 */
class EnhancedVideoPlayer {
  /**
   * Create an EnhancedVideoPlayer instance
   * @param {Object} options - Configuration object
   * @param {HTMLElement} options.container - Container element for the video player (required)
   * @param {boolean} [options.autoplay=false] - Whether to start playing automatically
   * @param {boolean} [options.controls=true] - Whether to show native controls
   * @param {boolean} [options.fullscreen=true] - Whether to allow fullscreen
   * @param {number} [options.volume=0.8] - Initial volume (0-1)
   * @param {Array<Object>} [options.chapters=[]] - Chapter markers
   * @param {Array<Object>} [options.subtitles=[]] - Subtitle tracks
   * @param {Array<string>} [options.qualities] - Quality options (e.g., ['1080p', '720p'])
   * @param {boolean} [options.hlsSupport=true] - Whether to enable HLS.js for .m3u8 streams
   * @param {string} [options.posterUrl=null] - Poster image URL
   */
  // The default carries container: null (not {}) so the no-argument call
  // still reaches the explicit 'container element required' throw below
  // instead of failing the typecheck on an empty default.
  constructor(options = { container: null }) {
    this.options = {
      autoplay: false,
      controls: true,
      fullscreen: true,
      volume: 0.8,
      chapters: [],
      subtitles: [],
      qualities: ['1080p', '720p', '480p', '360p'],
      hlsSupport: true,
      posterUrl: null,
      ...options,
    };

    this.container = this.options.container;
    if (!this.container) {
      throw new Error('EnhancedVideoPlayer: container element required');
    }

    // State
    this.currentUrl = null;
    this.currentQuality = null;
    this.availableQualities = [];
    this.isFullscreen = false;
    this.isHls = false;
    this.hlsInstance = null;
    this.chapters = this.options.chapters;
    this.subtitleTracks = this.options.subtitles;
    this.currentSubtitleTrack = -1;
    this.currentTime = 0;
    this.duration = 0;
    this.isPlaying = false;
    this.volume = this.options.volume;

    // Event listeners storage
    this.eventListeners = {};

    // Video element reference
    this.videoElement = null;

    // Load configuration from global config if available
    this.loadConfigFromGlobal();

    // Initialize the video element
    this.initializeVideoElement();

    // Setup fullscreen change listener
    this.setupFullscreenListener();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Load configuration from global ETCETER4_CONFIG
   * @private
   */
  loadConfigFromGlobal() {
    if (typeof window !== 'undefined' && window.ETCETER4_CONFIG?.media?.video) {
      const config = window.ETCETER4_CONFIG.media.video;
      if (config.chapters) {
        this.chapters = config.chapters;
      }
      if (config.subtitles) {
        this.subtitleTracks = config.subtitles;
      }
      if (config.hlsSupport !== undefined) {
        this.options.hlsSupport = config.hlsSupport;
      }
      if (config.posterUrl) {
        this.options.posterUrl = config.posterUrl;
      }
      if (config.qualityOrder) {
        this.options.qualities = config.qualityOrder;
      }
    }
  }

  /**
   * Initialize the video element and append to container
   * @private
   */
  initializeVideoElement() {
    this.videoElement = document.createElement('video');
    this.videoElement.className = 'et-video-player';
    this.videoElement.controls = this.options.controls;
    this.videoElement.playsInline = true;
    this.videoElement.preload = 'metadata';

    if (this.options.posterUrl) {
      this.videoElement.poster = this.options.posterUrl;
    }

    // Set initial volume
    this.videoElement.volume = this.volume;

    // Restore volume from localStorage if available
    this.restoreVolumePreference();

    // Setup video event listeners
    this.videoElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.emit('play');
    });

    this.videoElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.emit('pause');
    });

    this.videoElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.emit('ended');
    });

    this.videoElement.addEventListener('timeupdate', () => {
      this.currentTime = this.videoElement.currentTime;
      this.emit('timeupdate', {
        currentTime: this.currentTime,
        duration: this.duration,
      });
    });

    this.videoElement.addEventListener('loadedmetadata', () => {
      this.duration = this.videoElement.duration;
      this.emit('loadedmetadata', { duration: this.duration });
    });

    this.videoElement.addEventListener('progress', () => {
      const buffered = this.getBufferedRanges();
      this.emit('progress', { buffered });
    });

    this.videoElement.addEventListener('waiting', () => {
      this.emit('waiting');
    });

    this.videoElement.addEventListener('canplay', () => {
      this.emit('canplay');
    });

    this.videoElement.addEventListener('error', e => {
      console.error('Video error:', e);
      this.emit('error', { error: this.videoElement.error });
    });

    this.videoElement.addEventListener('volumechange', () => {
      this.volume = this.videoElement.volume;
      this.saveVolumePreference();
      this.emit('volumechange', { volume: this.volume });
    });

    // Append to container
    this.container.appendChild(this.videoElement);
  }

  /**
   * Setup fullscreen change listener
   * @private
   */
  setupFullscreenListener() {
    const fullscreenChangeHandler = () => {
      this.isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      this.emit('fullscreenchange', { isFullscreen: this.isFullscreen });
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener(
      'webkitfullscreenchange',
      fullscreenChangeHandler
    );
    document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
  }

  /**
   * Setup keyboard shortcuts for playback control
   * @private
   */
  setupKeyboardShortcuts() {
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

  /**
   * Handle keydown events for keyboard shortcuts
   * @private
   * @param {KeyboardEvent} event
   */
  handleKeydown(event) {
    // Only handle when video player is active (focused or fullscreen)
    if (
      !this.container.contains(document.activeElement) &&
      !this.isFullscreen
    ) {
      return;
    }

    switch (event.key) {
      case ' ':
      case 'k':
        event.preventDefault();
        this.toggle();
        break;
      case 'f':
        event.preventDefault();
        if (this.isFullscreen) {
          this.exitFullscreen();
        } else {
          this.enterFullscreen();
        }
        break;
      case 'm':
        event.preventDefault();
        this.toggleMute();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.seekTo(this.currentTime - 5);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.seekTo(this.currentTime + 5);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.setVolume(Math.min(1, this.volume + 0.1));
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.setVolume(Math.max(0, this.volume - 0.1));
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        event.preventDefault();
        const percent = parseInt(event.key, 10) / 10;
        this.seekTo(this.duration * percent);
        break;
      }
    }
  }

  /**
   * Restore volume preference from localStorage
   * @private
   */
  restoreVolumePreference() {
    try {
      const savedVolume = localStorage.getItem('etceter4-video-volume');
      if (savedVolume !== null) {
        const vol = parseFloat(savedVolume);
        if (Number.isFinite(vol) && vol >= 0 && vol <= 1) {
          this.volume = vol;
          this.videoElement.volume = vol;
        }
      }
    } catch (_e) {
      // localStorage not available
    }
  }

  /**
   * Save volume preference to localStorage
   * @private
   */
  saveVolumePreference() {
    try {
      localStorage.setItem('etceter4-video-volume', String(this.volume));
    } catch (_e) {
      // localStorage not available
    }
  }

  /**
   * Load a video URL
   * @param {string} videoUrl - URL of the video to load
   * @param {Object} [options={}] - Load options (can override constructor options)
   */
  load(videoUrl, options = {}) {
    this.currentUrl = videoUrl;
    const mergedOptions = { ...this.options, ...options };

    // Detect HLS stream
    this.isHls = videoUrl.includes('.m3u8');

    // Stop any existing HLS instance
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    if (this.isHls && mergedOptions.hlsSupport) {
      this.loadHlsStream(videoUrl);
    } else {
      // Standard video loading
      this.videoElement.src = videoUrl;
      this.videoElement.load();
      this.availableQualities = [];
    }

    // Reset state
    this.currentTime = 0;
    this.isPlaying = false;

    // Clear existing subtitle tracks
    while (this.videoElement.firstChild) {
      this.videoElement.removeChild(this.videoElement.firstChild);
    }

    // Add subtitle tracks
    this.subtitleTracks.forEach((sub, index) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = sub.src;
      track.srclang = sub.srclang || 'en';
      track.label = sub.label || `Subtitle ${index + 1}`;
      if (sub.default) {
        track.default = true;
        this.currentSubtitleTrack = index;
      }
      this.videoElement.appendChild(track);
    });

    // Autoplay if requested
    if (mergedOptions.autoplay) {
      this.play();
    }

    this.emit('load', { url: videoUrl });
  }

  /**
   * Load an HLS stream using HLS.js
   * @private
   * @param {string} url - HLS manifest URL (.m3u8)
   */
  loadHlsStream(url) {
    // Check if HLS.js is available
    if (typeof window !== 'undefined' && window.Hls) {
      const Hls = window.Hls;

      if (Hls.isSupported()) {
        /** @type {{ maxBufferLength?: number, maxMaxBufferLength?: number, startLevel?: number, enableWorker?: boolean, lowLatencyMode?: boolean }} */
        const hlsConfig = window.ETCETER4_CONFIG?.media?.video?.hlsConfig || {};

        this.hlsInstance = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: hlsConfig.maxBufferLength || 30,
          maxMaxBufferLength: hlsConfig.maxMaxBufferLength || 60,
          ...hlsConfig,
        });

        this.hlsInstance.attachMedia(this.videoElement);
        this.hlsInstance.loadSource(url);

        // Handle HLS events
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          const qualities = this.hlsInstance.levels.map((level, index) => ({
            index,
            height: level.height,
            width: level.width,
            bitrate: level.bitrate,
            name: level.height ? `${level.height}p` : 'Auto',
          }));

          this.availableQualities = qualities;
          this.emit('qualitiesavailable', { qualities });
        });

        this.hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const level = this.hlsInstance.levels[data.level];
          this.currentQuality = level.height ? `${level.height}p` : 'Auto';
          this.emit('qualitychange', {
            quality: this.currentQuality,
            levelIndex: data.level,
          });
        });

        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error - trying to recover');
                this.hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error - trying to recover');
                this.hlsInstance.recoverMediaError();
                break;
              default:
                this.emit('error', { error: data });
                break;
            }
          }
        });

        this.hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
          this.emit('buffered');
        });
      } else if (
        this.videoElement.canPlayType('application/vnd.apple.mpegurl')
      ) {
        // Native HLS support (Safari)
        this.videoElement.src = url;
        this.videoElement.load();
      } else {
        // No HLS support at all, try direct loading
        this.videoElement.src = url;
        this.videoElement.load();
      }
    } else {
      // HLS.js not loaded, try native
      this.videoElement.src = url;
      this.videoElement.load();
    }
  }

  /**
   * Play the video
   * @returns {Promise<void>}
   */
  play() {
    if (!this.videoElement) {
      return Promise.reject(new Error('No video element'));
    }

    return this.videoElement.play().catch(err => {
      console.error('Play error:', err);
      this.emit('error', { error: err });
      throw err;
    });
  }

  /**
   * Pause the video
   */
  pause() {
    if (this.videoElement) {
      this.videoElement.pause();
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
   * Stop playback and reset to beginning
   */
  stop() {
    this.pause();
    this.seekTo(0);
    this.emit('stop');
  }

  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  seek(time) {
    this.seekTo(time);
  }

  /**
   * Seek to a specific time in seconds
   * @param {number} seconds - Time in seconds
   */
  seekTo(seconds) {
    if (!this.videoElement || !Number.isFinite(seconds)) {
      return;
    }

    const clampedTime = Math.max(
      0,
      Math.min(seconds, this.duration || Infinity)
    );
    this.videoElement.currentTime = clampedTime;
    this.emit('seek', { time: clampedTime });
  }

  /**
   * Seek to a percentage of the video duration
   * @param {number} percent - Position as percentage (0-1)
   */
  seekToPercent(percent) {
    if (this.duration > 0) {
      const time = this.duration * Math.max(0, Math.min(1, percent));
      this.seekTo(time);
    }
  }

  /**
   * Set the playback quality
   * @param {string|number} quality - Quality level ('auto', level index, or quality name like '720p')
   */
  setQuality(quality) {
    if (!this.hlsInstance) {
      return;
    }

    if (quality === 'auto' || quality === -1) {
      this.hlsInstance.currentLevel = -1;
      this.currentQuality = 'auto';
    } else if (typeof quality === 'number') {
      if (quality >= 0 && quality < this.hlsInstance.levels.length) {
        this.hlsInstance.currentLevel = quality;
      }
    } else if (typeof quality === 'string') {
      // Try to match by name (e.g., '720p')
      const levelIndex = this.hlsInstance.levels.findIndex(
        level => `${level.height}p` === quality
      );
      if (levelIndex >= 0) {
        this.hlsInstance.currentLevel = levelIndex;
      }
    }

    this.emit('qualitychange', { quality });
  }

  /**
   * Get available quality levels
   * @returns {Array<Object>} Array of quality level objects
   */
  getAvailableQualities() {
    if (this.hlsInstance?.levels) {
      return this.hlsInstance.levels.map((level, index) => ({
        index,
        height: level.height,
        width: level.width,
        bitrate: level.bitrate,
        name: level.height ? `${level.height}p` : 'Auto',
      }));
    }
    return this.availableQualities;
  }

  /**
   * Get current quality level
   * @returns {string|null} Current quality name
   */
  getCurrentQuality() {
    return this.currentQuality;
  }

  /**
   * Set the active subtitle track
   * @param {number} trackIndex - Index of subtitle track (-1 to disable)
   */
  setSubtitle(trackIndex) {
    const tracks = this.videoElement.textTracks;

    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === trackIndex ? 'showing' : 'hidden';
    }

    this.currentSubtitleTrack = trackIndex;
    this.emit('subtitlechange', { trackIndex });
  }

  /**
   * Get all available subtitle tracks
   * @returns {Array<Object>} Array of subtitle track info
   */
  getSubtitleTracks() {
    return this.subtitleTracks;
  }

  /**
   * Get current subtitle track index
   * @returns {number} Current subtitle track index (-1 if none)
   */
  getCurrentSubtitleTrack() {
    return this.currentSubtitleTrack;
  }

  /**
   * Enter fullscreen mode
   */
  enterFullscreen() {
    const elem = this.options.fullscreen ? this.container : this.videoElement;

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (this.videoElement.webkitEnterFullscreen) {
      // iOS Safari
      this.videoElement.webkitEnterFullscreen();
    }
  }

  /**
   * Exit fullscreen mode
   */
  exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    } else if (document.mozFullScreenElement) {
      document.mozCancelFullScreen();
    } else if (document.msFullscreenElement) {
      document.msExitFullscreen();
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  /**
   * Set the volume
   * @param {number} vol - Volume level (0-1)
   */
  setVolume(vol) {
    const volume = Math.max(0, Math.min(1, vol));
    this.videoElement.volume = volume;
    this.volume = volume;
  }

  /**
   * Get the current volume
   * @returns {number} Current volume (0-1)
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    if (this.videoElement.muted) {
      this.videoElement.muted = false;
      this.emit('unmute');
    } else {
      this.videoElement.muted = true;
      this.emit('mute');
    }
  }

  /**
   * Check if video is muted
   * @returns {boolean}
   */
  isMuted() {
    return this.videoElement?.muted || false;
  }

  /**
   * Get current playback position
   * @returns {number} Current time in seconds
   */
  getPosition() {
    return this.currentTime;
  }

  /**
   * Get video duration
   * @returns {number} Duration in seconds
   */
  getDuration() {
    return this.duration;
  }

  /**
   * Get buffered time ranges
   * @returns {Array<{start: number, end: number}>} Buffered ranges
   */
  getBufferedRanges() {
    const buffered = this.videoElement?.buffered;
    const ranges = [];

    if (buffered) {
      for (let i = 0; i < buffered.length; i++) {
        ranges.push({
          start: buffered.start(i),
          end: buffered.end(i),
        });
      }
    }

    return ranges;
  }

  /**
   * Get chapter markers
   * @returns {Array<Object>} Chapter data
   */
  getChapters() {
    return this.chapters;
  }

  /**
   * Go to a specific chapter
   * @param {number} chapterIndex - Index of the chapter
   */
  goToChapter(chapterIndex) {
    if (chapterIndex >= 0 && chapterIndex < this.chapters.length) {
      const chapter = this.chapters[chapterIndex];
      if (chapter.time !== undefined) {
        this.seekTo(chapter.time);
        this.emit('chapterchange', { chapter, index: chapterIndex });
      }
    }
  }

  /**
   * Get complete player state
   * @returns {Object} Player state object
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isFullscreen: this.isFullscreen,
      isMuted: this.isMuted(),
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      currentUrl: this.currentUrl,
      currentQuality: this.currentQuality,
      currentSubtitleTrack: this.currentSubtitleTrack,
      availableQualities: this.getAvailableQualities(),
      subtitleTracks: this.subtitleTracks,
      chapters: this.chapters,
      isHls: this.isHls,
    };
  }

  /**
   * Register an event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Unregister an event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      return;
    }
    this.eventListeners[eventName] = this.eventListeners[eventName].filter(
      cb => cb !== callback
    );
  }

  /**
   * Emit an event to all registered listeners
   * @private
   * @param {string} eventName - Event name
   * @param {*} [data=null] - Data to pass to listeners
   */
  emit(eventName, data = null) {
    if (!this.eventListeners[eventName]) {
      return;
    }
    this.eventListeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in ${eventName} listener:`, err);
      }
    });
  }

  /**
   * Clean up resources and remove all listeners
   */
  dispose() {
    // Remove keyboard handler
    if (this.boundKeydownHandler) {
      document.removeEventListener('keydown', this.boundKeydownHandler);
    }

    // Pause and clear video element
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.load();
    }

    // Destroy HLS instance
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    // Clear event listeners
    this.eventListeners = {};

    // Remove video element from DOM
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }

    this.videoElement = null;
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.EnhancedVideoPlayer = EnhancedVideoPlayer;
}
