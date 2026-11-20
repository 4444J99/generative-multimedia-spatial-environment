'use strict';

/**
 * BibliothekePoetry - Procedural poetry/prose/lyrics generator
 * Creates ephemeral text that regenerates on each visit.
 *
 * Three modes:
 *   poetry  — free verse, 4-8 line stanzas
 *   prose   — micro-fiction fragments, 3-5 sentences
 *   lyrics  — verse/chorus/verse with rhyme-adjacent endings
 *
 * Word pools seeded from sketch.js emotionGroups + literary vocabulary.
 *
 * @global
 */
// eslint-disable-next-line no-unused-vars
class BibliothekePoetry {
  constructor() {
    /** @type {boolean} */
    this.initialized = false;
    /** @type {Array<HTMLElement>} Managed poem containers */
    this.containers = [];
    /** @type {ReturnType<typeof setInterval> | null} Auto-regeneration interval */
    this.regenInterval = null;

    // Word pools — seeded from sketch.js emotionGroups, extended for literary use
    this.words = {
      solace: [
        'forgiveness',
        'growth',
        'life',
        'love',
        'trust',
        'hope',
        'return',
        'rain',
        'clouds',
        'forever',
        'light',
        'warmth',
        'breath',
        'bloom',
        'gentle',
        'dawn',
        'river',
        'peace',
        'tenderness',
        'grace',
        'horizon',
        'shelter',
        'ember',
      ],
      discord: [
        'death',
        'empty',
        'fear',
        'remorse',
        'pain',
        'depression',
        'hate',
        'repetition',
        'gone',
        'end',
        'fist',
        'silence',
        'fracture',
        'erosion',
        'hollow',
        'void',
        'ash',
        'static',
        'severance',
        'collapse',
        'drift',
        'absence',
        'wound',
      ],
      sensory: [
        'velvet',
        'crystalline',
        'amber',
        'obsidian',
        'mercury',
        'copper',
        'smoke',
        'salt',
        'silk',
        'rust',
        'glass',
        'bone',
        'stone',
        'flame',
        'frost',
        'moss',
        'dust',
      ],
      verbs: [
        'dissolves',
        'emerges',
        'shatters',
        'whispers',
        'burns',
        'unfolds',
        'collapses',
        'breathes',
        'fractures',
        'spirals',
        'echoes',
        'bleeds',
        'trembles',
        'radiates',
        'erodes',
        'surrenders',
        'awakens',
        'descends',
        'transforms',
        'lingers',
      ],
      abstract: [
        'memory',
        'distance',
        'threshold',
        'archive',
        'frequency',
        'resonance',
        'entropy',
        'syntax',
        'geometry',
        'algorithm',
        'paradox',
        'meridian',
        'spectrum',
        'labyrinth',
        'cipher',
        'testimony',
        'inheritance',
        'architecture',
        'cartography',
      ],
      connectors: [
        'beneath',
        'through',
        'against',
        'within',
        'beyond',
        'among',
        'across',
        'between',
        'inside',
        'toward',
      ],
      articles: ['the', 'a', 'this', 'that', 'every', 'no', 'each'],
    };

    // Line templates for poetry generation
    this.poetryTemplates = [
      '{articles} {sensory} {abstract} {verbs}',
      '{connectors} {articles} {solace}, {discord} {verbs}',
      '{verbs} like {sensory} {abstract}',
      '{articles} {discord} of {sensory} {solace}',
      'where {abstract} {verbs} {connectors} {sensory}',
      '{solace} and {discord} — {articles} {abstract}',
      'i {verbs} {connectors} {articles} {sensory} {abstract}',
      '{connectors} {discord}, {articles} {solace} {verbs}',
    ];

    this.proseTemplates = [
      'The {sensory} {abstract} {verbs} {connectors} the {solace}.',
      'There was {articles} {discord} that no {abstract} could name.',
      'We found {solace} {connectors} the {sensory} {abstract}, though {discord} remained.',
      'Something {verbs} — {articles} {sensory} thing, full of {abstract}.',
      'In the {abstract} of {discord}, {solace} {verbs} without warning.',
    ];

    this.lyricTemplates = {
      verse: [
        '{articles} {sensory} {abstract} {verbs}',
        '{connectors} {articles} {solace} and the {discord}',
        'where {abstract} {verbs}',
        '{discord} {verbs} like {sensory} {solace}',
      ],
      chorus: [
        'we are {sensory}, we are {abstract}',
        '{solace} — {solace} — {verbs}',
        '{connectors} the {abstract}, {connectors} the {solace}',
      ],
    };
  }

  /**
   * Initialize the poetry engine on bibliotheke poem containers
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

    const poems = container.querySelectorAll('.bibliotheke-poem');
    if (poems.length === 0) {
      return;
    }

    poems.forEach((/** @type {HTMLElement} */ el) => {
      this.containers.push(el);
      this._generateAndRender(el);
    });

    // Regenerate every 120 seconds
    this.regenInterval = setInterval(() => {
      this.containers.forEach(el => this._generateAndRender(el));
    }, 120000);

    this.initialized = true;
  }

  /**
   * Generate content and render into a container
   * @param {HTMLElement} el
   */
  _generateAndRender(el) {
    const mode = el.dataset.mode || 'poetry';
    let content;

    switch (mode) {
      case 'poetry':
        content = this._generatePoetry();
        break;
      case 'prose':
        content = this._generateProse();
        break;
      case 'lyrics':
        content = this._generateLyrics();
        break;
      default:
        content = this._generatePoetry();
    }

    const title = this._generateTitle();

    el.innerHTML = `
      <h4 class="f5 mt0 mb2 i" style="color: #d2b48c">${title}</h4>
      <div class="f6 o-80 lh-copy white-90">${content}</div>
      <div class="mt2 tr">
        <span class="bibliotheke-regenerate f7 o-30" title="Generate new text">&#8635;</span>
      </div>
    `;

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'bibliotheke',
        'poem_generated',
        { mode }
      );
    }

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'bibliotheke',
        'poem_generated',
        { mode }
      );
    }

    // Bind regenerate button
    const regenBtn = el.querySelector('.bibliotheke-regenerate');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => this._generateAndRender(el));
    }
  }

  /**
   * Generate a procedural title
   * @returns {string}
   */
  _generateTitle() {
    const patterns = [
      '{abstract} #{num}',
      'On {sensory} {abstract}',
      '{abstract} for {solace}',
      'After the {discord}',
      'Notes on {abstract}',
      'Fragment: {sensory}',
    ];
    const pattern = this._pick(patterns);
    return this._fillTemplate(pattern).replace(
      '{num}',
      String(Math.floor(Math.random() * 99) + 1)
    );
  }

  /**
   * Generate free verse poetry (4-8 lines)
   * @returns {string} HTML
   */
  _generatePoetry() {
    const lineCount = 4 + Math.floor(Math.random() * 5);
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
      const template = this._pick(this.poetryTemplates);
      lines.push(this._fillTemplate(template));
      // Add stanza break occasionally
      if (i > 0 && i < lineCount - 1 && Math.random() < 0.25) {
        lines.push('');
      }
    }
    return lines
      .map(l => (l === '' ? '<br>' : `<p class="mv1">${l}</p>`))
      .join('');
  }

  /**
   * Generate micro-fiction (3-5 sentences)
   * @returns {string} HTML
   */
  _generateProse() {
    const sentenceCount = 3 + Math.floor(Math.random() * 3);
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
      const template = this._pick(this.proseTemplates);
      sentences.push(this._fillTemplate(template));
    }
    return `<p class="mv1 lh-copy">${sentences.join(' ')}</p>`;
  }

  /**
   * Generate structured lyrics (verse/chorus/verse)
   * @returns {string} HTML
   */
  _generateLyrics() {
    const sections = ['verse', 'chorus', 'verse'];
    const parts = [];

    sections.forEach(section => {
      const templates = this.lyricTemplates[section];
      const lineCount = section === 'chorus' ? 2 : 4;
      const lines = [];
      for (let i = 0; i < lineCount; i++) {
        const template = this._pick(templates);
        lines.push(this._fillTemplate(template));
      }
      const label =
        section === 'chorus'
          ? '<span class="f7 o-40 db mb1">[chorus]</span>'
          : '';
      parts.push(
        `<div class="mv2">${label}${lines.map(l => `<p class="mv1">${l}</p>`).join('')}</div>`
      );
    });

    return parts.join('');
  }

  /**
   * Fill a template string with random words from pools
   * @param {string} template
   * @returns {string}
   */
  _fillTemplate(template) {
    return template.replace(/\{(\w+)\}/g, (match, pool) => {
      if (this.words[pool]) {
        return this._pick(this.words[pool]);
      }
      return match;
    });
  }

  /**
   * Pick a random element from an array
   * @param {Array} arr
   * @returns {*}
   */
  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Cleanup intervals
   */
  destroy() {
    if (this.regenInterval) {
      clearInterval(this.regenInterval);
      this.regenInterval = null;
    }
    this.containers = [];
    this.initialized = false;
  }
}
