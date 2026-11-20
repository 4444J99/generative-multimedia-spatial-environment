/**
 * @file pageData.js
 * @description Page configuration and data management for etceter4.com
 * Defines the page tree structure, relationships, and initialization logic
 * for all pages in the site navigation system.
 *
 * @requires page.js - Page constructor and prototype methods
 * @requires jQuery - For DOM manipulation and AJAX
 *
 * This file creates the page hierarchy and defines:
 * - Page IDs and their relationships (upLinks, downLinks)
 * - Page tier levels in the navigation tree
 * - Initialization functions for each page
 * - Dynamic content loading for various sections
 */

/**
 * Page ID constants
 * @const {Object} _pID - Maps page names to their HTML element IDs
 * @property {string} landing - Landing page ID
 * @property {string} menu - Main menu page ID
 * @property {string} sound - Sound/music section ID
 * @property {string} vision - Visual content section ID
 * @property {string} words - Written content section ID
 * @property {string} blog - Blog section ID
 * @property {string} diary - Diary/journal section ID
 * @property {string} video - Video content section ID
 * @property {string} stills - Still images/photos section ID
 * @property {string} info - Information/about section ID
 */

const _pID = {
  visualHome: '#visual-home',
  landing: '#landing',
  menu: '#menu',
  sound: '#sound',
  vision: '#vision',
  words: '#words',
  blog: '#blog',
  diary: '#diary',
  video: '#video',
  stills: '#stills',
  info: '#info',
  ogod3d: '#ogod3d',
  ogodViewer: '#ogod-viewer',
  eastWing: '#east-wing',
  westWing: '#west-wing',
  southWing: '#south-wing',
  northWing: '#north-wing',
  bibliotheke: '#bibliotheke',
  oikos: '#oikos',
  pinakotheke: '#pinakotheke',
  agora: '#agora',
  symposion: '#symposion',
  odeion: '#odeion',
  theatron: '#theatron',
  ergasterion: '#ergasterion',
  akademia: '#akademia',
  khronos: '#khronos',
  discovery: '#discovery',
};

/**
 * Pages array - Contains all page instances
 * @type {Page[] & { menu?: Page, sound?: Page, stills?: Page, diary?: Page, info?: Page, ogod3d?: Page, ogodViewer?: Page, eastWing?: Page, westWing?: Page, southWing?: Page, northWing?: Page, akademia?: Page, bibliotheke?: Page, oikos?: Page, pinakotheke?: Page, agora?: Page, symposion?: Page, odeion?: Page, theatron?: Page, ergasterion?: Page, khronos?: Page, discovery?: Page }}
 * @global
 *
 * Pages are first built as named properties (pages.menu = new Page(...)),
 * then collected into the plain array below, so the value is both the
 * named map the initializers use and the array page.js navigates. The
 * named properties are optional in the type because the final assignment
 * is the plain array, which carries none of them.
 *
 * Each page is created with:
 * - id: HTML element ID (matches _pID constants)
 * - tier: Depth level in navigation tree (higher = deeper)
 * - upLinks: Array of parent page IDs (for back navigation)
 * - downLinks: Array of child page IDs (for forward navigation)
 * - initialize: Function called on first page load
 * - load: Function called on subsequent page loads (optional)
 *
 * Navigation Flow:
 * Landing (tier 1) → Menu (tier 2) → Content sections (tier 3) → Detail pages (tier 4)
 */
let pages = [];

/**
 * Menu page configuration
 * Tier 2 - Main hub connecting to all major sections
 */
pages.menu = new Page({
  id: _pID.menu,
  tier: 2,
  downLinks: [
    _pID.words,
    _pID.sound,
    _pID.vision,
    _pID.info,
    _pID.eastWing,
    _pID.westWing,
    _pID.southWing,
    _pID.northWing,
    _pID.discovery,
  ],
  upLinks: [_pID.landing],
  initialize() {
    // get the lib and sketch
    $.cachedScript('js/vendor/p5.js').done((script, textStatus) => {});
    // $.cachedScript( "js/sketch.js" ).done(function( script, textStatus ) {});
  },
});

/**
 * Sound page configuration
 * Tier 3 - Music/audio section with embedded Bandcamp players
 * Initializes with album iframes from Bandcamp
 */
pages.sound = new Page({
  id: _pID.sound,
  tier: 3,
  upLinks: [_pID.menu],
  initialize() {
    // Load Bandcamp embeds as fallback
    const albums = Object.values(ETCETER4_CONFIG.media.albums);

    $('#sound .BCContainer').each(function (index) {
      const album = albums[index];
      if (!album) {
        return;
      }
      const frame = document.createElement('iframe');
      frame.src = `https://bandcamp.com/EmbeddedPlayer/album=${album.bandcampAlbumId}/size=large/bgcol=ffffff/linkcol=0687f5/minimal=true/transparent=true/`;
      frame.title = `${album.title} on Bandcamp`;
      frame.width = '300';
      frame.height = '300';
      frame.style.border = '0';
      const link = document.createElement('a');
      link.href = album.links.bandcamp;
      link.textContent = `${album.title} by ${album.artist}`;
      frame.appendChild(link);
      this.replaceChildren(frame);
    });

    // Add a link to the full Odeion player
    const soundSection = document.querySelector(
      '#sound .mw7, #sound .mw8, #sound .center'
    );
    if (soundSection && !document.getElementById('odeion-link')) {
      const link = document.createElement('div');
      link.id = 'odeion-link';
      link.className = 'tc mt4 mb3';
      link.innerHTML =
        '<a href="#odeion" class="f5 link dib pa3 ph4 ba br3" ' +
        'style="color: #ffd700; border-color: #ffd700" ' +
        'onclick="showNewSection(\'#odeion\'); return false;">' +
        'Open Full Player in ODEION &rarr;</a>';
      soundSection.appendChild(link);
    }
  },
});

/**
 * Stills page configuration
 * Tier 4 - Image gallery section
 * Uses replacePlaceholders function to load dynamic image content
 */
pages.stills = new Page({
  id: _pID.stills,
  tier: 4,
  upLinks: [_pID.vision],
  initialize() {
    replacePlaceholders(this.id);
  },
});

/**
 * Diary page configuration
 * Tier 4 - Journal/blog entries section
 * Uses replacePlaceholders function to load dynamic diary content
 */
pages.diary = new Page({
  id: _pID.diary,
  tier: 4,
  upLinks: [_pID.words],
  initialize() {
    replacePlaceholders(this.id);
  },
});

/**
 * Info page configuration
 * About/information section with contact and details
 */
pages.info = new Page({
  id: _pID.info,
  upLinks: [_pID.menu],
});

/**
 * OGOD 3D experience helper function
 * Creates and initializes the 3D scene manager and audio engine
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - DOM element for the canvas
 * @param {number} options.trackNumber - Track number (1-29)
 * @returns {Promise<Object>} The experience object with sceneManager and audioEngine
 */
async function createOGODExperience(options) {
  const { container, trackNumber } = options;

  // Create audio engine
  const audioEngine = new OGODAudioEngine({
    trackNumber,
    useFallback: true,
  });

  // Create scene manager
  const sceneManager = new OGODSceneManager({
    container,
    trackNumber,
    audioEngine,
  });

  // Initialize
  await audioEngine.initialize();
  await sceneManager.initialize();

  return {
    sceneManager,
    audioEngine,
    dispose() {
      sceneManager.dispose();
      audioEngine.dispose();
    },
  };
}

// Make available globally
window.createOGODExperience = createOGODExperience;

/**
 * OGOD 3D page configuration
 * Tier 4 - Immersive 3D audio-visual experience
 * Logic extracted to js/ogod/OGOD3DController.js
 */
pages.ogod3d = new Page({
  id: _pID.ogod3d,
  tier: 4,
  upLinks: [_pID.vision],
  initialize() {
    new OGOD3DController().init();
  },
});

/**
 * OGOD Animation Viewer page configuration
 * Tier 4 - 2D animation viewer with mode switching
 * Logic extracted to js/ogod/OGODViewerController.js
 */
pages.ogodViewer = new Page({
  id: _pID.ogodViewer,
  tier: 4,
  upLinks: [_pID.vision],
  initialize() {
    new OGODViewerController().init();
  },
});

/**
 * Wing page configurations
 * Tier 3 - Navigation hubs for chamber groupings
 */
pages.eastWing = new Page({
  id: _pID.eastWing,
  tier: 3,
  upLinks: [_pID.menu],
  downLinks: [_pID.akademia, _pID.bibliotheke, _pID.pinakotheke],
});

pages.westWing = new Page({
  id: _pID.westWing,
  tier: 3,
  upLinks: [_pID.menu],
  downLinks: [_pID.agora, _pID.symposion, _pID.oikos],
});

pages.southWing = new Page({
  id: _pID.southWing,
  tier: 3,
  upLinks: [_pID.menu],
  downLinks: [_pID.odeion, _pID.theatron],
});

pages.northWing = new Page({
  id: _pID.northWing,
  tier: 3,
  upLinks: [_pID.menu],
  downLinks: [_pID.ergasterion, _pID.khronos],
});

/**
 * Initialize section navigation filtering for a chamber
 * Binds click handlers to .section-btn elements that show/hide .chamber-card elements
 * @param {string} sectionId - The chamber's section ID selector (e.g., '#akademia')
 */
function initChamberSectionNav(sectionId) {
  const el = $(sectionId);
  el.find('.section-btn').on('click', function () {
    el.find('.section-btn').removeClass('active');
    $(this).addClass('active');
    const section = $(this).data('section');
    el.find('.chamber-card').each(function () {
      const show = section === 'all' || $(this).data('section') === section;
      $(this).toggleClass('dn', !show);
    });
  });
}

/**
 * Chamber page configurations
 * Tier 4 - Individual chambers within each wing
 */
pages.akademia = new Page({
  id: _pID.akademia,
  tier: 4,
  upLinks: [_pID.eastWing],
  initialize() {
    replacePlaceholders(this.id);
    // Render cards from akademiaConfig data
    if (typeof akademiaConfig !== 'undefined') {
      new AkademiaRenderer(akademiaConfig).render('#akademia-cards');
    }
    initChamberSectionNav(this.id);
  },
});

pages.bibliotheke = new Page({
  id: _pID.bibliotheke,
  tier: 4,
  upLinks: [_pID.eastWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize procedural poetry engine
    if (typeof BibliothekePoetry !== 'undefined') {
      window.bibliothekePoetry =
        window.bibliothekePoetry || new BibliothekePoetry();
      window.bibliothekePoetry.initialize('#bibliotheke .mw9');
    }
  },
});

pages.oikos = new Page({
  id: _pID.oikos,
  tier: 4,
  upLinks: [_pID.westWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize localStorage-backed journal
    if (typeof OikosJournal !== 'undefined') {
      window.oikosJournal = window.oikosJournal || new OikosJournal();
      window.oikosJournal.initialize('#oikos .mw9');
    }
  },
});

pages.pinakotheke = new Page({
  id: _pID.pinakotheke,
  tier: 4,
  upLinks: [_pID.eastWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize generative gallery canvases
    if (typeof PinakothekeGenerator !== 'undefined') {
      window.pinakothekeGen =
        window.pinakothekeGen || new PinakothekeGenerator();
      window.pinakothekeGen.initialize('#pinakotheke-gallery');
    }
  },
});

pages.agora = new Page({
  id: _pID.agora,
  tier: 4,
  upLinks: [_pID.westWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Wire click-to-expand on commentary cards
    $(this.id)
      .find('.chamber-card')
      .on('click', function () {
        const fullText = $(this).find('.agora-full-text');
        const readMore = $(this).find('.agora-read-more');
        if (fullText.length) {
          fullText.toggleClass('expanded');
          const isExpanded = fullText.hasClass('expanded');
          readMore.html(isExpanded ? 'Collapse &uarr;' : 'Read more &darr;');
        }
      });
  },
});

pages.symposion = new Page({
  id: _pID.symposion,
  tier: 4,
  upLinks: [_pID.westWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize generative dialogue system
    if (typeof SymposionDialogues !== 'undefined') {
      window.symposionDialogues =
        window.symposionDialogues || new SymposionDialogues();
      window.symposionDialogues.initialize('#symposion');
    }
  },
});

pages.odeion = new Page({
  id: _pID.odeion,
  tier: 4,
  upLinks: [_pID.southWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize enhanced audio player and playlist manager
    try {
      const playerContainer = document.getElementById(
        'odeion-player-container'
      );
      const waveformCanvas = document.getElementById('odeion-waveform');

      if (
        typeof EnhancedAudioPlayer !== 'undefined' &&
        playerContainer &&
        waveformCanvas
      ) {
        // EnhancedAudioPlayer takes tracks only: it has no container or
        // waveformCanvas option (both were silently ignored here), and its
        // tracks arrive later via addTrack / the playlist manager.
        window.odeionPlayer = new EnhancedAudioPlayer({});
        if (typeof WaveformVisualizer !== 'undefined') {
          // canvasElement (not `canvas`) is the constructor's option, and
          // primaryColor/secondaryColor are not options at all — colours
          // come from ETCETER4_CONFIG.media.audio.waveform. Passing the
          // player wires its play/pause/seek events to the visualizer.
          window.odeionWaveform = new WaveformVisualizer({
            canvasElement: /** @type {HTMLCanvasElement} */ (waveformCanvas),
            playerInstance: window.odeionPlayer,
          });
        }
      }

      // Initialize PlaylistManager for album browsing
      if (typeof PlaylistManager !== 'undefined') {
        const odeionContent = document.querySelector('#odeion .mw9');
        if (odeionContent) {
          window.odeionPlaylist = new PlaylistManager({
            container: /** @type {HTMLElement} */ (odeionContent),
            player: window.odeionPlayer,
            waveform: window.odeionWaveform,
          });
          window.odeionPlaylist.initialize();
        }
      }
    } catch (audioError) {
      console.warn('Odeion audio init:', audioError.message);
    }
  },
});

pages.theatron = new Page({
  id: _pID.theatron,
  tier: 4,
  upLinks: [_pID.southWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize generative visual system
    if (typeof TheatronVisuals !== 'undefined') {
      window.theatronVisuals = window.theatronVisuals || new TheatronVisuals();
      window.theatronVisuals.initialize('#theatron');
    }
    // Wire performance card clicks to load p5.js sketch
    const theatronEl = $(this.id);
    theatronEl.find('.chamber-card[data-sketch]').on('click', function () {
      const sketchName = $(this).data('sketch');
      if (!sketchName || !window.theatronVisuals) {
        return;
      }
      // Remove active state from all cards
      theatronEl.find('.chamber-card').removeClass('theatron-active');
      $(this).addClass('theatron-active');
      // Load sketch into player container
      window.theatronVisuals.loadSketch(sketchName);
    });
  },
});

pages.ergasterion = new Page({
  id: _pID.ergasterion,
  tier: 4,
  upLinks: [_pID.northWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize Exhibit Portal for absorb-alchemize apps
    if (typeof ExhibitPortal !== 'undefined') {
      const portalContainer = document.getElementById(
        'ergasterion-exhibit-portal'
      );
      if (portalContainer && !window.exhibitPortal) {
        window.exhibitPortal = new ExhibitPortal();
        window.exhibitPortal.initialize(portalContainer);
      }
    }
  },
});

pages.khronos = new Page({
  id: _pID.khronos,
  tier: 4,
  upLinks: [_pID.northWing],
  initialize() {
    replacePlaceholders(this.id);
    initChamberSectionNav(this.id);
    // Initialize interactive SVG timeline
    if (typeof KhronosTimeline !== 'undefined') {
      window.khronosTimeline = window.khronosTimeline || new KhronosTimeline();
      window.khronosTimeline.initialize('#khronos-timeline');
    }
  },
});

/**
 * Discovery page configuration
 * Tier 2 - Same level as menu for quick access
 * Unified search and filtering across all chambers
 */
pages.discovery = new Page({
  id: _pID.discovery,
  tier: 2,
  upLinks: [_pID.menu],
  initialize() {
    // Initialize discovery controller
    if (typeof DiscoveryController !== 'undefined') {
      return DiscoveryController.initialize();
    }
  },
});

// eslint-disable-next-line no-useless-assignment -- pages is a global used by page.js navigation
pages = [
  pages.menu,
  pages.sound,
  pages.stills,
  pages.diary,
  pages.info,
  pages.ogod3d,
  pages.ogodViewer,
  pages.eastWing,
  pages.westWing,
  pages.southWing,
  pages.northWing,
  pages.akademia,
  pages.bibliotheke,
  pages.oikos,
  pages.pinakotheke,
  pages.agora,
  pages.symposion,
  pages.odeion,
  pages.theatron,
  pages.ergasterion,
  pages.khronos,
  pages.discovery,
  new Page({
    id: _pID.visualHome,
    tier: 1,
    downLinks: [_pID.landing, _pID.menu],
    initialize() {
      if (typeof WorksGallery !== 'undefined') {
        return WorksGallery.init({ root: _pID.visualHome });
      }
      throw new Error('Works gallery unavailable');
    },
  }),
  new Page({
    id: _pID.landing,
    tier: 1,
    downLinks: [_pID.menu],
  }),
  new Page({
    id: _pID.vision,
    tier: 3,
    upLinks: [_pID.menu],
    downLinks: [_pID.stills, _pID.video, _pID.ogod3d, _pID.ogodViewer],
  }),
  new Page({
    id: _pID.words,
    tier: 3,
    downLinks: [_pID.diary, _pID.blog],
    upLinks: [_pID.menu],
  }),
  new Page({
    id: _pID.blog,
    tier: 4,
    upLinks: [_pID.words],
  }),
  new Page({
    id: _pID.video,
    tier: 4,
    upLinks: [_pID.vision],
    initialize() {
      // Lazy-load YouTube iframes on first visit
      $('#video iframe[data-src]').each(function () {
        $(this).attr('src', $(this).data('src')).removeAttr('data-src');
      });
    },
  }),
];

// taken from here: https://api.jquery.com/jquery.getscript/
jQuery.cachedScript = function (url, options) {
  // Allow user to set any option except for dataType, cache, and url
  options = $.extend(options || {}, {
    dataType: 'script',
    cache: true,
    url,
  });

  // Use $.ajax() since it is more flexible than $.getScript
  // Return the jqXHR object so we can chain callbacks
  return $.ajax(options);
};
