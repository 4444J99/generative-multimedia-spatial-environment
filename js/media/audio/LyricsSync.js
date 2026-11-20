'use strict';

/**
 * LyricsSync
 * Synchronized lyrics display for audio playback with LRC format support.
 * Integrates with EnhancedAudioPlayer to display and highlight lyrics
 * in real-time with smooth scrolling and click-to-seek functionality.
 *
 * @class LyricsSync
 * @example
 * const lyricsSync = new LyricsSync({
 *   containerSelector: '#lyrics-container',
 *   currentLineClass: 'et-lyrics-active'
 * });
 * lyricsSync.setPlayer(audioPlayer);
 * lyricsSync.loadLyrics('/audio/song.lrc');
 * lyricsSync.on('linechange', (event) => console.log('Line:', event.line, 'Index:', event.lineIndex));
 */
class LyricsSync {
  /**
   * Create a LyricsSync instance
   * @param {Object} options - Configuration object
   * @param {string} [options.containerSelector='#lyrics-container'] - CSS selector for lyrics container
   * @param {string} [options.currentLineClass='et-lyrics-current'] - CSS class for current line
   * @param {string} [options.lineClass='et-lyrics-line'] - CSS class for lyrics lines
   * @param {number} [options.scrollOffset=100] - Pixels from top to center current line
   * @param {number} [options.scrollDuration=300] - Smooth scroll duration in ms
   * @param {boolean} [options.autoScroll=true] - Enable auto-scroll to current line
   * @param {boolean} [options.highlightCurrent=true] - Enable highlighting of current line
   */
  constructor(options = {}) {
    this.containerSelector = options.containerSelector || '#lyrics-container';
    this.currentLineClass = options.currentLineClass || 'et-lyrics-current';
    this.lineClass = options.lineClass || 'et-lyrics-line';
    this.scrollOffset = options.scrollOffset || 100;
    this.scrollDuration = options.scrollDuration || 300;
    this.autoScroll = options.autoScroll !== false;
    this.highlightCurrent = options.highlightCurrent !== false;

    // Lyrics data storage
    this.lyrics = [];
    this.lyricsMap = new Map(); // timestamp -> { text, index }

    // Player reference
    this.player = null;
    this.playerProgressListener = null;

    // DOM references
    this.container = null;
    this.lineElements = [];

    // State
    this.currentLineIndex = -1;
    this.isLoaded = false;

    // Event listeners storage
    this.listeners = new Map();

    // Initialize container
    this.initializeContainer();
  }

  /**
   * Initialize the lyrics container element
   * @private
   */
  initializeContainer() {
    this.container = document.querySelector(this.containerSelector);

    if (!this.container) {
      console.warn(
        `LyricsSync: Container not found (${this.containerSelector})`
      );
      this.container = document.createElement('div');
      this.container.id = this.containerSelector.replace('#', '');
      document.body.appendChild(this.container);
    }

    // Add container class for styling
    this.container.classList.add('et-lyrics-container');
  }

  /**
   * Parse LRC format timestamp to milliseconds
   * LRC format: [MM:SS.cs] where cs = centiseconds
   * @private
   * @param {string} timestamp - Timestamp string like "[00:12.34]"
   * @returns {number} Time in milliseconds
   */
  parseTimestamp(timestamp) {
    const match = timestamp.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
    if (!match) {
      return -1;
    }

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const centiseconds = parseInt(match[3], 10);

    return (minutes * 60 + seconds) * 1000 + centiseconds * 10;
  }

  /**
   * Parse LRC format text content
   * Supports lines with format: [MM:SS.cs] Lyrics text
   * Multiple timestamps on same line are supported
   * @private
   * @param {string} lrcText - Raw LRC format text
   * @returns {Array<Object>} Array of { time, text, index }
   */
  parseLRCText(lrcText) {
    const lines = lrcText.split('\n');
    const parsedLyrics = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      // Extract all timestamps from the line
      const timestampRegex = /\[\d{2}:\d{2}\.\d{2}\]/g;
      const timestamps = trimmed.match(timestampRegex) || [];

      if (timestamps.length === 0) {
        // Skip lines without timestamps (metadata like [ar:Artist])
        return;
      }

      // Extract lyrics text (everything after the last timestamp)
      let lyricsText = trimmed;
      timestamps.forEach(ts => {
        lyricsText = lyricsText.replace(ts, '').trim();
      });

      // Create entry for each timestamp (handle multi-timestamp lines)
      timestamps.forEach(timestamp => {
        const time = this.parseTimestamp(timestamp);
        if (time >= 0) {
          parsedLyrics.push({
            time,
            text: lyricsText,
            index: parsedLyrics.length,
          });
        }
      });
    });

    // Sort by time
    parsedLyrics.sort((a, b) => a.time - b.time);

    // Re-index after sorting
    parsedLyrics.forEach((item, idx) => {
      item.index = idx;
    });

    return parsedLyrics;
  }

  /**
   * Load lyrics from a URL (LRC file)
   * @async
   * @param {string} url - URL to LRC file
   * @returns {Promise<void>}
   * @throws {Error} If fetch or parsing fails
   */
  async loadLyrics(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      this.loadLyricsFromText(text);
    } catch (err) {
      console.error('LyricsSync: Failed to load lyrics', err);
      this.emit('error', { error: err, url });
      throw err;
    }
  }

  /**
   * Load lyrics from raw LRC format text
   * @param {string} lrcText - Raw LRC text
   */
  loadLyricsFromText(lrcText) {
    try {
      this.lyrics = this.parseLRCText(lrcText);

      // Build timestamp map for O(1) lookups
      this.lyricsMap.clear();
      this.lyrics.forEach(item => {
        this.lyricsMap.set(item.time, item);
      });

      // Render lyrics to DOM
      this.renderLyrics();

      this.isLoaded = true;
      this.currentLineIndex = -1;

      this.emit('loaded', {
        lineCount: this.lyrics.length,
        lyrics: [...this.lyrics],
      });
    } catch (err) {
      console.error('LyricsSync: Failed to parse lyrics', err);
      this.emit('error', { error: err });
      throw err;
    }
  }

  /**
   * Render lyrics to DOM
   * @private
   */
  renderLyrics() {
    if (!this.container) {
      return;
    }

    // Clear existing lyrics
    this.container.innerHTML = '';
    this.lineElements = [];

    // Create line elements
    this.lyrics.forEach((lyric, index) => {
      const lineElement = document.createElement('div');
      lineElement.className = this.lineClass;
      lineElement.dataset.index = String(index);
      lineElement.dataset.time = lyric.time;
      lineElement.textContent = lyric.text;

      // Add click-to-seek functionality
      lineElement.addEventListener('click', () => {
        this.seekToLine(index);
      });

      lineElement.style.cursor = 'pointer';
      lineElement.style.transition = 'opacity 0.2s ease';

      this.container.appendChild(lineElement);
      this.lineElements.push(lineElement);
    });
  }

  /**
   * Set the audio player instance to sync with
   * @param {EnhancedAudioPlayer} player - Audio player instance
   */
  setPlayer(player) {
    // Remove old listener if exists
    if (this.player && this.playerProgressListener) {
      this.player.off('progress', this.playerProgressListener);
    }

    this.player = player;

    if (!this.player) {
      return;
    }

    // Listen to player progress events
    this.playerProgressListener = event => {
      this.updateCurrentLine(event.position * 1000); // Convert seconds to ms
    };

    this.player.on('progress', this.playerProgressListener);
  }

  /**
   * Update current line based on playback position
   * Uses binary search for efficiency
   * @private
   * @param {number} positionMs - Current position in milliseconds
   */
  updateCurrentLine(positionMs) {
    if (!this.isLoaded || this.lyrics.length === 0) {
      return;
    }

    // Binary search for current line
    const lineIndex = this.findCurrentLineIndex(positionMs);

    if (lineIndex !== this.currentLineIndex) {
      this.setCurrentLine(lineIndex);
    }
  }

  /**
   * Find the index of the current lyric line using binary search
   * Returns the index of the lyric with the largest timestamp <= positionMs
   * @private
   * @param {number} positionMs - Current position in milliseconds
   * @returns {number} Index of current line, or -1 if before first lyric
   */
  findCurrentLineIndex(positionMs) {
    if (this.lyrics.length === 0) {
      return -1;
    }

    // Handle before first lyric
    if (positionMs < this.lyrics[0].time) {
      return -1;
    }

    // Handle after last lyric
    if (positionMs >= this.lyrics[this.lyrics.length - 1].time) {
      return this.lyrics.length - 1;
    }

    // Binary search
    let left = 0;
    let right = this.lyrics.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = this.lyrics[mid].time;

      if (midTime === positionMs) {
        return mid;
      }

      if (midTime < positionMs) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Return the index of the largest timestamp <= positionMs
    return right;
  }

  /**
   * Set the current line and update highlighting
   * @private
   * @param {number} lineIndex - Index of the current line (-1 if none)
   */
  setCurrentLine(lineIndex) {
    // Remove highlight from previous line
    if (
      this.currentLineIndex >= 0 &&
      this.currentLineIndex < this.lineElements.length
    ) {
      const prevElement = this.lineElements[this.currentLineIndex];
      if (prevElement && this.highlightCurrent) {
        prevElement.classList.remove(this.currentLineClass);
      }
    }

    this.currentLineIndex = lineIndex;

    // Highlight new line
    if (
      this.currentLineIndex >= 0 &&
      this.currentLineIndex < this.lineElements.length
    ) {
      const currentElement = this.lineElements[this.currentLineIndex];
      if (currentElement && this.highlightCurrent) {
        currentElement.classList.add(this.currentLineClass);
      }

      // Auto-scroll to current line
      if (this.autoScroll) {
        this.scrollToLine(this.currentLineIndex);
      }

      // Emit event
      this.emit('linechange', {
        lineIndex: this.currentLineIndex,
        line: this.lyrics[this.currentLineIndex],
      });
    }
  }

  /**
   * Scroll to a specific line with smooth animation
   * @private
   * @param {number} lineIndex - Index of the line to scroll to
   */
  scrollToLine(lineIndex) {
    if (
      lineIndex < 0 ||
      lineIndex >= this.lineElements.length ||
      !this.container
    ) {
      return;
    }

    const lineElement = this.lineElements[lineIndex];
    if (!lineElement) {
      return;
    }

    // Smooth scroll into view
    lineElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  /**
   * Seek to a specific lyric line
   * @param {number} lineIndex - Index of the line to seek to
   */
  seekToLine(lineIndex) {
    if (lineIndex < 0 || lineIndex >= this.lyrics.length || !this.player) {
      return;
    }

    const lyric = this.lyrics[lineIndex];
    const seekSeconds = lyric.time / 1000; // Convert ms to seconds

    this.player.seekTo(seekSeconds);
  }

  /**
   * Get the current lyric line
   * @returns {Object|null} Current lyric object or null if none
   */
  getCurrentLine() {
    if (
      this.currentLineIndex >= 0 &&
      this.currentLineIndex < this.lyrics.length
    ) {
      return this.lyrics[this.currentLineIndex];
    }
    return null;
  }

  /**
   * Get all loaded lyrics
   * @returns {Array<Object>} Array of lyric objects
   */
  getLyrics() {
    return [...this.lyrics];
  }

  /**
   * Get total number of lyrics lines
   * @returns {number} Total lines
   */
  getLineCount() {
    return this.lyrics.length;
  }

  /**
   * Check if lyrics are loaded
   * @returns {boolean} True if lyrics are loaded
   */
  isLyricsLoaded() {
    return this.isLoaded;
  }

  /**
   * Clear all lyrics
   */
  clear() {
    this.lyrics = [];
    this.lyricsMap.clear();
    this.lineElements = [];
    this.currentLineIndex = -1;
    this.isLoaded = false;

    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Enable auto-scroll
   */
  enableAutoScroll() {
    this.autoScroll = true;
  }

  /**
   * Disable auto-scroll
   */
  disableAutoScroll() {
    this.autoScroll = false;
  }

  /**
   * Enable line highlighting
   */
  enableHighlighting() {
    this.highlightCurrent = true;
    if (this.currentLineIndex >= 0) {
      this.setCurrentLine(this.currentLineIndex);
    }
  }

  /**
   * Disable line highlighting
   */
  disableHighlighting() {
    this.highlightCurrent = false;
    // Remove current highlighting
    if (
      this.currentLineIndex >= 0 &&
      this.currentLineIndex < this.lineElements.length
    ) {
      const element = this.lineElements[this.currentLineIndex];
      if (element) {
        element.classList.remove(this.currentLineClass);
      }
    }
  }

  /**
   * Register an event listener
   * @param {string} event - Event name ('linechange', 'loaded', 'error')
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
    // Remove player listener
    if (this.player && this.playerProgressListener) {
      this.player.off('progress', this.playerProgressListener);
    }

    // Clear lyrics
    this.clear();

    // Remove all event listeners
    this.listeners.clear();

    // Reset references
    this.player = null;
    this.playerProgressListener = null;
    this.container = null;
  }

  /**
   * Get synchronized lyrics state
   * @returns {Object} Current state
   */
  getState() {
    return {
      isLoaded: this.isLoaded,
      lineCount: this.lyrics.length,
      currentLineIndex: this.currentLineIndex,
      currentLine: this.getCurrentLine(),
      autoScroll: this.autoScroll,
      highlightCurrent: this.highlightCurrent,
    };
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.LyricsSync = LyricsSync;
}
