'use strict';

/**
 * OikosJournal - localStorage-backed personal journal system
 * Transforms contemplation prompts into creation spaces.
 *
 * Entry types: reflections, dreams, confessions
 * Storage key: etceter4-oikos-entries (follows etceter4- convention)
 *
 * @global
 */
// eslint-disable-next-line no-unused-vars
class OikosJournal {
  constructor() {
    /** @type {boolean} */
    this.initialized = false;
    /** @type {string} localStorage key */
    this.storageKey = 'etceter4-oikos-entries';
    /** @type {number} Character limit per entry */
    this.charLimit = 2000;
    /** @type {number} Max entries per type before oldest-first eviction */
    this.maxEntriesPerType = 100;
  }

  /**
   * Initialize journal system on mount points
   * @param {string} containerSelector - CSS selector for the chamber content area
   */
  initialize(containerSelector) {
    if (this.initialized) {
      return;
    }

    const container = document.querySelector(containerSelector);
    if (!container) {
      return;
    }

    const mounts = /** @type {NodeListOf<HTMLElement>} */ (
      container.querySelectorAll('.oikos-journal-mount')
    );
    if (mounts.length === 0) {
      return;
    }

    mounts.forEach(mount => {
      const type = mount.dataset.type;
      if (type) {
        this._renderJournalUI(mount, type);
      }
    });

    this.initialized = true;
  }

  /**
   * Render the journal textarea and entry list into a mount point
   * @param {HTMLElement} mount
   * @param {string} type - Entry type (reflections, dreams, confessions)
   */
  _renderJournalUI(mount, type) {
    const colors = {
      reflections: '#ff8c00',
      dreams: '#ffb6c1',
      confessions: '#ffd9b3',
    };
    const color = colors[type] || '#ff8c00';

    const wrapper = document.createElement('div');
    wrapper.className = 'oikos-journal-wrapper mt3';

    // Textarea
    const textareaWrap = document.createElement('div');
    textareaWrap.className = 'mb2';
    textareaWrap.innerHTML = `
      <textarea class="oikos-textarea f6"
        placeholder="Begin writing..."
        maxlength="${this.charLimit}"
        rows="3"
        aria-label="Write a ${type.slice(0, -1)} entry"></textarea>
      <div class="flex justify-between items-center mt1">
        <span class="oikos-char-count f7 o-40">0 / ${this.charLimit}</span>
        <button class="oikos-save-btn f7 ba br2 ph2 pv1 pointer bg-transparent white"
          style="border-color: ${color}; color: ${color}"
          disabled>Save</button>
      </div>
    `;
    wrapper.appendChild(textareaWrap);

    // Entry list
    const entryList = document.createElement('div');
    entryList.className = 'oikos-entry-list mt3';
    wrapper.appendChild(entryList);

    mount.appendChild(wrapper);

    // Bind events
    const textarea = /** @type {HTMLTextAreaElement | null} */ (
      textareaWrap.querySelector('.oikos-textarea')
    );
    const charCount = /** @type {HTMLElement | null} */ (
      textareaWrap.querySelector('.oikos-char-count')
    );
    const saveBtn = /** @type {HTMLButtonElement | null} */ (
      textareaWrap.querySelector('.oikos-save-btn')
    );

    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len} / ${this.charLimit}`;
      saveBtn.disabled = len === 0;
      if (len > this.charLimit * 0.9) {
        charCount.style.color = '#ff6b6b';
      } else {
        charCount.style.color = '';
      }
    });

    saveBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) {
        return;
      }
      this._saveEntry(type, text);
      textarea.value = '';
      charCount.textContent = `0 / ${this.charLimit}`;
      saveBtn.disabled = true;
      this._renderEntries(entryList, type, color);
    });

    // Allow Ctrl/Cmd+Enter to save
    textarea.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      }
    });

    // Render existing entries
    this._renderEntries(entryList, type, color);
  }

  /**
   * Save a new journal entry
   * @param {string} type
   * @param {string} text
   */
  _saveEntry(type, text) {
    const entries = this._getEntries();
    const entry = {
      id: this._generateId(),
      type,
      text,
      timestamp: Date.now(),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
    entries.unshift(entry);

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'oikos',
        'journal_written',
        { type }
      );
    }

    // Evict oldest entries per type when cap is exceeded
    const typeCounts = {};
    const capped = entries.filter(e => {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      return typeCounts[e.type] <= this.maxEntriesPerType;
    });

    try {
      const serialized = JSON.stringify(capped);
      localStorage.setItem(this.storageKey, serialized);
    } catch (err) {
      console.warn('OikosJournal: storage error:', err.message);
    }

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'oikos',
        'journal_written',
        { type }
      );
    }
  }

  /**
   * Get all entries from localStorage
   * @returns {Array<Object>}
   */
  _getEntries() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (_e) {
      return [];
    }
  }

  /**
   * Delete an entry by ID
   * @param {string} entryId
   */
  _deleteEntry(entryId) {
    const entries = this._getEntries().filter(e => e.id !== entryId);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch (err) {
      console.warn('OikosJournal: storage error:', err.message);
    }
  }

  /**
   * Render entries for a specific type into the list container
   * @param {HTMLElement} listEl
   * @param {string} type
   * @param {string} color
   */
  _renderEntries(listEl, type, color) {
    const entries = this._getEntries().filter(e => e.type === type);
    if (entries.length === 0) {
      listEl.innerHTML = '<p class="f7 o-30 tc">No entries yet</p>';
      return;
    }

    listEl.innerHTML = entries
      .map(entry => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const preview =
          entry.text.length > 120
            ? `${entry.text.slice(0, 120)}...`
            : entry.text;
        return `
          <div class="oikos-entry pa2 mv1" data-entry-id="${entry.id}">
            <div class="flex justify-between items-start mb1">
              <span class="f7 o-50" style="color: ${color}">${dateStr} &middot; ${entry.wordCount} words</span>
              <span class="oikos-entry-delete f7" title="Delete entry" data-delete-id="${entry.id}">&times;</span>
            </div>
            <p class="f6 o-70 mt0 mb0 lh-copy">${this._escapeHtml(preview)}</p>
          </div>
        `;
      })
      .join('');

    // Bind delete buttons
    listEl
      .querySelectorAll('.oikos-entry-delete')
      .forEach((/** @type {HTMLElement} */ btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.deleteId;
          this._deleteEntry(id);
          this._renderEntries(listEl, type, color);
        });
      });
  }

  /**
   * Generate a unique ID
   * @returns {string}
   */
  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Escape HTML to prevent XSS in user-generated content
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.initialized = false;
  }
}
