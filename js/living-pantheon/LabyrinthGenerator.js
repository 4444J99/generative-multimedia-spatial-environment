/**
 * @file LabyrinthGenerator.js
 * @description Generative labyrinth system for expanded diary content
 * Creates fragmented diary entries with procedurally generated "loopholes"
 *
 * Labyrinth Features:
 * -------------------
 * FRAGMENT LOADING:
 *   - Loads text fragments from JSON source files
 *   - Combines 2-3 fragments to create diary-style entries
 *   - Manages fragment pool and lazy loading
 *
 * ENTRY GENERATION:
 *   - Creates diary entries in MMDDYY format
 *   - Generates random dates within configurable range
 *   - Combines fragments with narrative cohesion
 *
 * LOOPHOLES:
 *   - Hidden links between unrelated diary entries
 *   - Creates non-linear navigation through the diary
 *   - Triggered based on probability (default 5%)
 *   - Links entries that wouldn't normally connect
 *
 * Configuration (from ETCETER4_CONFIG.livingPantheon.labyrinth):
 * - fragmentSources: Array of JSON file paths to load fragments from
 * - fragmentCount: Target number of fragments to load (100)
 * - loopholeCount: Number of secret loopholes to create (10)
 * - loopholeProbability: Chance of triggering loophole (0.05 = 5%)
 *
 * Usage:
 * ------
 * const labyrinth = new LabyrinthGenerator();
 * labyrinth.initialize().then(() => {
 *   const entry = labyrinth.generateEntry();
 *   console.log(entry.date, entry.content);
 * });
 *
 * // Later...
 * labyrinth.dispose();
 */

'use strict';

/**
 * LabyrinthGenerator - Manages generative diary content and secret loopholes
 * @class
 */
/**
 * Labyrinth configuration, mirroring ETCETER4_CONFIG.livingPantheon.labyrinth
 * (js/config.js). Every field is optional: the constructor merges its own
 * defaults over the global section.
 *
 * @typedef {Object} LabyrinthOptions
 * @property {boolean} [enabled]
 * @property {string[]} [fragmentSources] - JSON file paths for fragments
 * @property {number} [fragmentCount] - Target number of fragments to load
 * @property {number} [loopholeCount] - Number of loopholes to create
 * @property {number} [loopholeProbability] - Probability of loophole trigger (0-1)
 */
class LabyrinthGenerator {
  /**
   * Create a new LabyrinthGenerator instance
   * @param {LabyrinthOptions} [options] - Configuration options
   */
  constructor(options = {}) {
    // Get configuration from global config or use defaults
    /** @type {LabyrinthOptions} */
    const configFromGlobal =
      typeof ETCETER4_CONFIG !== 'undefined'
        ? ETCETER4_CONFIG.livingPantheon?.labyrinth || {}
        : {};

    // Merge options with config and defaults
    this.config = {
      enabled: configFromGlobal.enabled !== false,
      fragmentSources:
        options.fragmentSources ?? configFromGlobal.fragmentSources ?? [],
      fragmentCount:
        options.fragmentCount ?? configFromGlobal.fragmentCount ?? 100,
      loopholeCount:
        options.loopholeCount ?? configFromGlobal.loopholeCount ?? 10,
      loopholeProbability:
        options.loopholeProbability ??
        configFromGlobal.loopholeProbability ??
        0.05,
    };

    // Fragment and entry management
    this.fragments = [];
    this.entries = new Map(); // Map<dateStr, entryData>
    this.loopholes = new Set(); // Set of loophole connections
    this.isInitialized = false;
    this.isLoading = false;

    // Date range for diary entries (in days from now, can go back)
    this.dateRangeMin = -730; // 2 years back
    this.dateRangeMax = 30; // 1 month forward

    // Bind methods
    this._loadFragments = this._loadFragments.bind(this);
    this._createLoopholes = this._createLoopholes.bind(this);
  }

  /**
   * Initialize the labyrinth generator (load fragments and create entries)
   * @returns {Promise<LabyrinthGenerator>} Returns this for chaining
   */
  async initialize() {
    if (this.isInitialized || this.isLoading) {
      return this;
    }

    if (!this.config.enabled) {
      console.warn('LabyrinthGenerator: Disabled');
      return this;
    }

    this.isLoading = true;

    try {
      // Load all fragments
      await this._loadFragments();

      // Generate initial entries
      this._generateEntries();

      // Create loopholes between entries
      this._createLoopholes();

      this.isInitialized = true;
      console.warn(
        `LabyrinthGenerator: Initialized with ${this.fragments.length} fragments and ${this.loopholes.size} loopholes`
      );
    } catch (error) {
      console.error('LabyrinthGenerator: Initialization error:', error);
    } finally {
      this.isLoading = false;
    }

    return this;
  }

  /**
   * Load fragments from JSON sources
   * @private
   * @returns {Promise<void>}
   */
  async _loadFragments() {
    const sources = this.config.fragmentSources || [];

    if (sources.length === 0) {
      console.warn('LabyrinthGenerator: No fragment sources configured');
      // Create fallback fragments
      this._createFallbackFragments();
      return;
    }

    for (const source of sources) {
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const loadedFragments = Array.isArray(data)
          ? data
          : data.fragments || [];

        // Filter and validate fragments
        const validFragments = loadedFragments
          .filter(
            frag =>
              typeof frag === 'string' &&
              frag.trim().length > 0 &&
              frag.length < 1000 // Reasonable length limit
          )
          .map(frag => frag.trim());

        this.fragments.push(...validFragments);

        console.warn(
          `LabyrinthGenerator: Loaded ${validFragments.length} fragments from ${source}`
        );
      } catch (error) {
        console.warn(
          `LabyrinthGenerator: Failed to load fragments from ${source}:`,
          error
        );
        // Continue with other sources
      }
    }

    // If we still don't have enough fragments, create fallback ones
    if (this.fragments.length === 0) {
      this._createFallbackFragments();
    }

    // Limit to configured count
    if (this.fragments.length > this.config.fragmentCount) {
      this.fragments = this.fragments.slice(0, this.config.fragmentCount);
    }
  }

  /**
   * Create fallback fragments if JSON loading fails
   * @private
   */
  _createFallbackFragments() {
    const fallbacks = [
      'fragments of memory scattered like broken glass across the floor',
      'the sensation of falling through layers of consciousness',
      'whispers in the dark that only i can hear',
      'reaching for something that dissolves before touch',
      'sequences repeating in patterns that almost make sense',
      'the weight of unfinished thoughts pressing down',
      'colors bleeding into each other like watercolor on wet paper',
      'echoes of conversations never had',
      'searching for meaning in the gaps between words',
      'the peculiar silence that follows loud music',
      'time moving sideways instead of forward',
      'mirrors reflecting mirrors reflecting emptiness',
      'words losing their shape and becoming pure sound',
      'the taste of forgotten dreams',
      'swimming upstream through molasses of memory',
    ];

    this.fragments = [...fallbacks];
    console.warn('LabyrinthGenerator: Using fallback fragments');
  }

  /**
   * Generate diary entries from fragments
   * @private
   */
  _generateEntries() {
    // Generate entries for random dates over the past/future range
    const entryCount = Math.min(50, this.config.fragmentCount / 2);

    for (let i = 0; i < entryCount; i++) {
      const date = this._generateRandomDate();
      const dateStr = this._formatDate(date);

      if (!this.entries.has(dateStr)) {
        const entry = this._buildEntry(date);
        this.entries.set(dateStr, entry);
      }
    }
  }

  /**
   * Build a single diary entry from fragments
   * @private
   * @param {Date} date
   * @returns {Object} Entry object with date, content, and metadata
   */
  _buildEntry(date) {
    // Combine 2-3 random fragments into an entry
    const fragmentCount = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const selectedFragments = [];

    for (let i = 0; i < fragmentCount; i++) {
      const frag = this.getRandomFragment();
      if (frag) {
        selectedFragments.push(frag);
      }
    }

    // Join fragments with natural separators
    const separators = ['. ', ' -- ', '. ', '\n\n', '. '];
    const separator = separators[Math.floor(Math.random() * separators.length)];
    const content = selectedFragments.join(separator);

    return {
      date,
      dateStr: this._formatDate(date),
      content,
      id: `entry-${this._formatDate(date)}`,
      hasLoophole: false,
      loopholes: [],
    };
  }

  /**
   * Generate a random date within the configured range
   * @private
   * @returns {Date}
   */
  _generateRandomDate() {
    const now = new Date();
    const daysOffset =
      Math.floor(Math.random() * (this.dateRangeMax - this.dateRangeMin + 1)) +
      this.dateRangeMin;

    const date = new Date(now);
    date.setDate(date.getDate() + daysOffset);

    return date;
  }

  /**
   * Format date as MMDDYY (diary format)
   * @private
   * @param {Date} date
   * @returns {string} Formatted date string
   */
  _formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${month}${day}${year}`;
  }

  /**
   * Parse date string in MMDDYY format back to Date
   * @private
   * @param {string} dateStr - Date string in MMDDYY format
   * @returns {Date|null}
   */
  _parseDate(dateStr) {
    if (!/^\d{6}$/.test(dateStr)) {
      return null;
    }

    const month = parseInt(dateStr.substring(0, 2), 10) - 1;
    const day = parseInt(dateStr.substring(2, 4), 10);
    const year = 2000 + parseInt(dateStr.substring(4, 6), 10);

    const date = new Date(year, month, day);

    // Validate the date is real
    if (
      date.getMonth() !== month ||
      date.getDate() !== day ||
      date.getFullYear() !== year
    ) {
      return null;
    }

    return date;
  }

  /**
   * Create loopholes (hidden links between entries)
   * @private
   */
  _createLoopholes() {
    const entries = Array.from(this.entries.values());

    if (entries.length < 2) {
      return;
    }

    const loopholeCount = Math.min(
      this.config.loopholeCount,
      Math.floor(entries.length / 2)
    );

    for (let i = 0; i < loopholeCount; i++) {
      // Pick two random entries
      const from = entries[Math.floor(Math.random() * entries.length)];
      const to = entries[Math.floor(Math.random() * entries.length)];

      // Avoid self-links and duplicate links
      if (from.id !== to.id && !this._loopholeExists(from.id, to.id)) {
        this._addLoophole(from, to);
      }
    }
  }

  /**
   * Check if a loophole already exists
   * @private
   * @param {string} fromId
   * @param {string} toId
   * @returns {boolean}
   */
  _loopholeExists(fromId, toId) {
    for (const loophole of this.loopholes) {
      if (loophole.from === fromId && loophole.to === toId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add a loophole connection between two entries
   * @private
   * @param {Object} fromEntry
   * @param {Object} toEntry
   */
  _addLoophole(fromEntry, toEntry) {
    const loophole = {
      from: fromEntry.id,
      to: toEntry.id,
      trigger: Math.random() < this.config.loopholeProbability,
    };

    this.loopholes.add(loophole);
    fromEntry.hasLoophole = true;
    fromEntry.loopholes.push(loophole.to);
  }

  /**
   * Generate a new diary entry
   * @returns {Object} Entry object with date, content, id, and loophole info
   */
  generateEntry() {
    if (!this.isInitialized) {
      console.warn('LabyrinthGenerator: Not initialized');
      return null;
    }

    const date = this._generateRandomDate();
    const entry = this._buildEntry(date);

    // Store the entry
    this.entries.set(entry.dateStr, entry);

    // Randomly assign loopholes to new entries
    if (
      Math.random() < this.config.loopholeProbability &&
      this.entries.size > 1
    ) {
      const otherEntries = Array.from(this.entries.values()).filter(
        e => e.id !== entry.id
      );
      if (otherEntries.length > 0) {
        const target =
          otherEntries[Math.floor(Math.random() * otherEntries.length)];
        this._addLoophole(entry, target);
      }
    }

    return entry;
  }

  /**
   * Get a random fragment
   * @returns {string|null} A random fragment or null if no fragments available
   */
  getRandomFragment() {
    if (this.fragments.length === 0) {
      return null;
    }

    return this.fragments[Math.floor(Math.random() * this.fragments.length)];
  }

  /**
   * Get an entry by date string (MMDDYY format)
   * @param {string} dateStr - Date string in MMDDYY format
   * @returns {Object|null} Entry object or null if not found
   */
  getEntry(dateStr) {
    return this.entries.get(dateStr) || null;
  }

  /**
   * Get all entries, optionally sorted by date
   * @param {boolean} [sorted=false] - Whether to sort by date
   * @returns {Array<Object>} Array of entry objects
   */
  getAllEntries(sorted = false) {
    const entries = Array.from(this.entries.values());

    if (sorted) {
      entries.sort((a, b) => {
        const dateA = this._parseDate(a.dateStr);
        const dateB = this._parseDate(b.dateStr);
        return (dateB?.getTime() ?? 0) - (dateA?.getTime() ?? 0); // Most recent first
      });
    }

    return entries;
  }

  /**
   * Get all loopholes from a specific entry
   * @param {string} entryId - Entry ID
   * @returns {Array<Object>} Array of loophole objects
   */
  getLoopholes(entryId) {
    const loopholes = [];

    for (const loophole of this.loopholes) {
      if (loophole.from === entryId) {
        loopholes.push(loophole);
      }
    }

    return loopholes;
  }

  /**
   * Check if a loophole should be triggered for an entry
   * @param {string} entryId - Entry ID
   * @returns {Object|null} Loophole object if triggered, null otherwise
   */
  checkLoopholeTrigger(entryId) {
    const loopholes = this.getLoopholes(entryId);

    if (loopholes.length === 0) {
      return null;
    }

    const triggerable = loopholes.filter(l => l.trigger);

    if (triggerable.length === 0) {
      return null;
    }

    return triggerable[Math.floor(Math.random() * triggerable.length)];
  }

  /**
   * Get current system status
   * @returns {Object} Status object with state and statistics
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
      fragmentCount: this.fragments.length,
      entryCount: this.entries.size,
      loopholeCount: this.loopholes.size,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration at runtime
   * @param {Object} newConfig - Partial configuration to merge
   * @returns {LabyrinthGenerator} Returns this for chaining
   */
  updateConfig(newConfig) {
    if (newConfig.enabled !== undefined) {
      this.config.enabled = newConfig.enabled;
    }
    if (newConfig.loopholeProbability !== undefined) {
      this.config.loopholeProbability = newConfig.loopholeProbability;
    }
    if (newConfig.fragmentCount !== undefined) {
      this.config.fragmentCount = newConfig.fragmentCount;
    }
    if (newConfig.loopholeCount !== undefined) {
      this.config.loopholeCount = newConfig.loopholeCount;
    }

    return this;
  }

  /**
   * Dispose of all resources and clean up
   */
  dispose() {
    this.fragments = [];
    this.entries.clear();
    this.loopholes.clear();
    this.isInitialized = false;
  }
}

// Export for global scope
window.LabyrinthGenerator = LabyrinthGenerator;
