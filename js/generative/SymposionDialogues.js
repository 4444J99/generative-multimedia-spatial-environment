'use strict';

/**
 * SymposionDialogues - Procedural dialogue generator
 * Creates ephemeral interviews and conversations that regenerate on each visit.
 *
 * Two modes:
 *   interview    — Structured Q&A (ET asks, Guest responds)
 *   conversation — Multi-speaker informal exchange (ET + A + B)
 *
 * Follows constructor -> initialize -> destroy pattern.
 *
 * @global
 */
// eslint-disable-next-line no-unused-vars
class SymposionDialogues {
  constructor() {
    /** @type {boolean} */
    this.initialized = false;
    /** @type {Array<HTMLElement>} Managed dialogue containers */
    this.containers = [];
    /** @type {ReturnType<typeof setInterval> | null} Auto-regeneration interval */
    this.regenInterval = null;

    // Topic pools for dialogue generation
    this.topics = [
      'the nature of sound as sculpture',
      'algorithmic composition and human intuition',
      'the boundary between code and art',
      'consciousness as a creative medium',
      'process versus product in artistic practice',
      'the archaeology of digital memory',
      'collaboration across disciplines',
      'authenticity in generative systems',
      'the politics of the loop',
      'silence as compositional material',
      'glitch as revelation',
      'the temple as interface',
      'decay and preservation in digital work',
      'improvisation within constraints',
      'the body in electronic performance',
    ];

    this.perspectives = [
      'from a compositional standpoint',
      'thinking about it spatially',
      'in terms of lived experience',
      'through the lens of systems theory',
      'as a question of embodiment',
      'if we consider the temporal dimension',
      'from an architectural perspective',
      'when approached as ritual',
      'in the context of late digital culture',
      'as a practice of attention',
    ];

    // Response fragments — building blocks for generated dialogue
    this.fragments = {
      openings: [
        'I keep returning to this idea that',
        'What strikes me is how',
        "There's something unresolved about",
        "I've been thinking about the way",
        "It's interesting because",
        'The thing nobody talks about is',
        'For me it always comes back to',
        'What I find compelling is',
      ],
      middles: [
        'the material itself has a kind of agency',
        'we mistake control for understanding',
        'the system reveals what the artist cannot',
        'every iteration carries the ghost of the previous one',
        "there's a conversation happening between the code and the output",
        'the failure state is often where meaning lives',
        'constraints become the generative engine',
        "the audience completes the work in ways we can't predict",
        "repetition isn't stasis — it's accumulation",
        'the medium is always pushing back against intention',
        'what feels random is usually deeply structured',
        'the process is the artifact',
      ],
      closings: [
        "and I think that's where the real work begins.",
        'which changes everything about how we listen.',
        'but that tension is productive.',
        "and that's what keeps me coming back to it.",
        "though I'm not sure we have the vocabulary for it yet.",
        'which is maybe the whole point.',
        "and I don't think we've fully reckoned with that.",
        'but the question matters more than any answer.',
      ],
      questions: [
        'How do you think about the relationship between {topic}?',
        "When you're working, do you find that {topic} shapes the outcome?",
        "I'm curious about your experience with {topic}.",
        'Does {topic} come up in your practice?',
        'What happens when {topic} breaks down?',
        'Can you talk about {topic} in your recent work?',
        "Where does {topic} fit into what you're making now?",
      ],
      reactions: [
        'That resonates.',
        'I see it differently, actually.',
        "Yes — and I'd push that further.",
        "That's exactly the tension.",
        "Hmm, I hadn't considered that.",
        "I think you're circling something important.",
        'Right, and that connects to',
        "That's the question, isn't it.",
      ],
    };

    // Speaker configurations per mode
    this.speakers = {
      interview: {
        host: { name: 'ET', symbol: '\u25C6', color: '#cd919e' },
        guest: { name: 'Guest', symbol: '\u25C7', color: '#cd853f' },
      },
      conversation: {
        host: { name: 'ET', symbol: '\u25C6', color: '#cd919e' },
        a: { name: 'A', symbol: '\u25C7', color: '#cd853f' },
        b: { name: 'B', symbol: '\u25C8', color: '#d2b48c' },
      },
    };
  }

  /**
   * Initialize the dialogue system on symposion containers
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

    const dialogues = container.querySelectorAll('.symposion-dialogue');
    if (dialogues.length === 0) {
      return;
    }

    dialogues.forEach((/** @type {HTMLElement} */ el) => {
      this.containers.push(el);
      this._generateAndRender(el);
    });

    // Regenerate every 90 seconds
    this.regenInterval = setInterval(() => {
      this.containers.forEach(el => this._generateAndRender(el));
    }, 90000);

    this.initialized = true;
  }

  /**
   * Generate dialogue content and render into a container
   * @param {HTMLElement} el
   */
  _generateAndRender(el) {
    const mode = el.dataset.mode || 'interview';
    const topic = this._pick(this.topics);
    const title = this._generateTitle(mode, topic);

    let dialogue;
    if (mode === 'interview') {
      dialogue = this._generateInterview(topic);
    } else {
      dialogue = this._generateConversation(topic);
    }

    // Keep existing badge HTML, replace title and add generated content below
    const badgeDiv = el.querySelector('.mb2');
    const badgeHTML = badgeDiv ? badgeDiv.outerHTML : '';

    el.innerHTML = `
      ${badgeHTML}
      <h3 class="f4 mt0 mb2" style="color: #cd919e">${title}</h3>
      <div class="symposion-dialogue-content f6 o-80 lh-copy white-90">${dialogue}</div>
      <div class="mt2 tr">
        <span class="symposion-regenerate f7 o-30" title="Generate new dialogue">&#8635;</span>
      </div>
    `;

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'symposion',
        'dialogue_generated',
        { mode, topic }
      );
    }

    // Bind regenerate button
    const regenBtn = el.querySelector('.symposion-regenerate');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => this._generateAndRender(el));
    }
  }

  /**
   * Generate a dialogue title
   * @param {string} mode
   * @param {string} topic
   * @returns {string}
   */
  _generateTitle(mode, topic) {
    if (mode === 'interview') {
      const prefixes = ['On', 'Regarding', 'Concerning', 'About', 'Toward'];
      // Capitalize first letter of topic
      const capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
      return `${this._pick(prefixes)} ${capTopic}`;
    }
    // conversation mode
    const patterns = [
      `A Conversation on ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
      `Dialogue: ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
      `${topic.charAt(0).toUpperCase() + topic.slice(1)} \u2014 A Discussion`,
    ];
    return this._pick(patterns);
  }

  /**
   * Generate a structured interview (ET asks, Guest responds)
   * @param {string} topic
   * @returns {string} HTML
   */
  _generateInterview(topic) {
    const speakers = this.speakers.interview;
    const exchanges = 3 + Math.floor(Math.random() * 2); // 3-4 exchanges
    const lines = [];

    for (let i = 0; i < exchanges; i++) {
      // ET asks
      const question = this._generateQuestion(topic);
      lines.push(this._formatLine(speakers.host, question));

      // Guest responds
      const response = this._generateResponse();
      lines.push(this._formatLine(speakers.guest, response));
    }

    return lines.join('');
  }

  /**
   * Generate a multi-speaker conversation (ET + A + B)
   * @param {string} topic
   * @returns {string} HTML
   */
  _generateConversation(topic) {
    const speakers = this.speakers.conversation;
    const speakerList = [speakers.host, speakers.a, speakers.b];
    const turns = 5 + Math.floor(Math.random() * 3); // 5-7 turns
    const lines = [];

    // First turn: ET introduces topic
    const intro = `${this._pick(this.fragments.openings)} ${topic}.`;
    lines.push(this._formatLine(speakers.host, intro));

    let lastSpeakerIdx = 0;
    for (let i = 1; i < turns; i++) {
      // Pick a different speaker than the last one
      let speakerIdx;
      do {
        speakerIdx = Math.floor(Math.random() * speakerList.length);
      } while (speakerIdx === lastSpeakerIdx);
      lastSpeakerIdx = speakerIdx;

      const speaker = speakerList[speakerIdx];
      let text;

      // Sometimes react, sometimes make a full response
      if (Math.random() < 0.3 && i > 1) {
        text = `${this._pick(this.fragments.reactions)} ${this._pick(this.fragments.middles)}.`;
      } else if (speaker === speakers.host && Math.random() < 0.4) {
        text = this._generateQuestion(topic);
      } else {
        text = this._generateResponse();
      }

      lines.push(this._formatLine(speaker, text));
    }

    return lines.join('');
  }

  /**
   * Generate a question about a topic
   * @param {string} topic
   * @returns {string}
   */
  _generateQuestion(topic) {
    const template = this._pick(this.fragments.questions);
    return template.replace(/\{topic\}/g, topic);
  }

  /**
   * Generate a dialogue response
   * @returns {string}
   */
  _generateResponse() {
    const perspective =
      Math.random() < 0.4 ? `${this._pick(this.perspectives)}, ` : '';
    return `${perspective}${this._pick(this.fragments.openings)} ${this._pick(this.fragments.middles)}, ${this._pick(this.fragments.closings)}`;
  }

  /**
   * Format a dialogue line with speaker badge
   * @param {Object} speaker
   * @param {string} text
   * @returns {string} HTML
   */
  _formatLine(speaker, text) {
    return `
      <div class="symposion-line mv2 pl3" style="border-left: 2px solid ${speaker.color}">
        <span class="f7 fw6" style="color: ${speaker.color}">${speaker.symbol} ${speaker.name}</span>
        <p class="mt1 mb0">${text}</p>
      </div>
    `;
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
