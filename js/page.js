'use strict';

/**
 * @global {Object} currentPage - current page object
 * @global {string} transitionState - current transition state (IDLE, TRANSITIONING, READY)
 * @global {boolean} livingPantheonInitialized - track if Living Pantheon has been initialized
 */

let currentPage = {};
let livingPantheonInitialized = false;

/**
 * Transition State Machine
 * Prevents race conditions during page navigation
 * States: IDLE → TRANSITIONING → READY
 */
const TransitionState = {
  IDLE: 'IDLE',
  TRANSITIONING: 'TRANSITIONING',
  READY: 'READY',
};

let transitionState = TransitionState.IDLE;
let pendingPageId = null;

/**
 * Page Class
 *
 * Modern ES6 class for managing page state and navigation
 *
 * @param {Object} config - Page configuration object
 * @param {string} config.id - identifier, equal to their HTML element ID name
 * @param {number} config.tier - their row in the tree
 * @param {String[]} config.downLinks - element id's connected to them below in the tree
 * @param {String[]} config.upLinks - element id's connected to them above them in the tree
 * @param {function} config.initialize - create initial state for page
 * @param {function} config.load - loads the page
 */

class Page {
  constructor(_p) {
    // core data
    this.id = _p.id || '';
    this.tier = _p.tier || 0;
    this.downLinks = _p.downLinks || [];
    this.upLinks = _p.upLinks || [];

    // page state
    this.trace = '';
    this.isVisible = false;
    this.isInitialized = false;
    this.isInitializing = false;
    this.isLoaded = false;
    this.isLoading = false;
    this.hasAllData = false;

    // page handlers
    this.initialize = _p.initialize || function () {};
    this.load = _p.load || function () {};
  }

  /**
   * Initializes the page. Loads chamber fragment via ChamberLoader if registered.
   * @returns {Promise<void>}
   */
  initPage() {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    this.isInitializing = true;
    this._initializationPromise = Promise.resolve()
      .then(async () => {
        if (typeof ChamberLoader !== 'undefined') {
          const loader = ChamberLoader.getInstance();
          const id = this.id.replace('#', '');
          if (loader.isRegistered(id) && !loader.isLoaded(id)) {
            await loader.ensureLoaded(id);
          }
        }
        await this.initialize();
        this.isInitialized = true;
      })
      .finally(() => {
        this.isInitializing = false;
        this._initializationPromise = null;
      });
    return this._initializationPromise;
  }

  /**
   * getBackElement
   *
   * @summary Takes a page and returns the name of the section that will bring you back
   * @param {Page} _Page - the page object you're looking for the back for
   * @returns {string|Page} The back page identifier or object
   */
  getBackElement(_Page) {
    _Page = _Page || this;
    const pageObj = Page.findPage(_Page.id);

    if (pageObj.trace) {
      return pageObj.trace;
    } else if (pageObj.upLinks[0]) {
      // always return the left most link
      return Page.findPage(pageObj.upLinks[0]);
    } else {
      return '';
    }
  }

  /**
   * findPage (static method)
   *
   * @summary Takes a page identifier and returns the object if found
   * @param {string} _pageid - the page id you're searching for
   * @returns {Page} The found page object
   * @throws {Error} If page is not found
   */
  static findPage(_pageid) {
    const index = pages.findIndex(current => _pageid === current.id);
    if (index === -1) {
      throw new Error(`Can't find page: ${_pageid}`);
    }
    return pages[index];
  }
}

/** Animate with the installed Velocity core API; navigation survives its absence. */
function animatePageOpacity(element, opacity, options) {
  const reducedMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (typeof element.velocity === 'function' && !reducedMotion) {
    element.velocity({ opacity }, options);
  } else {
    options.begin?.();
    element.css('opacity', opacity);
    options.complete?.();
  }
}

/** Restore a truthful visible route after a failed lazy load, retaining retry. */
function recoverNavigation(error, previousPage, targetId) {
  console.error('Navigation failed:', error);
  const queuedPageId = pendingPageId;
  pendingPageId = null;
  transitionState = TransitionState.IDLE;
  currentPage = previousPage?.id ? previousPage : Page.findPage('#landing');
  currentPage.isLoading = false;
  $(currentPage.id)
    .removeClass('dn')
    .css({
      display:
        currentPage.id === '#stills' || currentPage.id === '#diary'
          ? 'table'
          : 'block',
      opacity: 1,
    });
  // Click navigation has not entered history yet. Only repair a failed browser
  // history entry; preserve a newer history request that is about to be drained.
  if (
    window.location.hash !== currentPage.id &&
    window.location.hash !== queuedPageId
  ) {
    window.history.replaceState(null, '', currentPage.id);
  }
  if (typeof isNavigating !== 'undefined') {
    isNavigating = false;
  }
  document.getElementById('navigation-error')?.remove();
  const message = document.createElement('aside');
  message.id = 'navigation-error';
  message.className = 'fixed top-0 left-0 right-0 pa3 bg-white black z-999';
  message.setAttribute('role', 'alert');
  const text = document.createElement('span');
  text.textContent =
    'This section could not load. Your current page is still available. ';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry section';
  retry.addEventListener('click', () => showNewSection(targetId));
  message.append(text, retry);
  document.body.appendChild(message);
  if (queuedPageId && queuedPageId !== currentPage.id) {
    showNewSection(queuedPageId);
  }
}

/**
 * showNewSection
 *
 * @summary - Navigates from the currently loaded section to the section provided (loading section).
 * It performs an animation that fades out the current section, then fades in the loading section.
 * Uses a state machine to prevent race conditions during navigation.
 *
 * @param {String} _loadingSection - page to be faded in
 * @returns {Boolean} true if successful
 *
 */

function showNewSection(_loadingSection) {
  if (!_loadingSection) {
    return false;
  }
  // A visible incoming page can already receive clicks. Retain the latest
  // requested route until the current transition finishes instead of dropping it.
  if (currentPage?.isLoading || transitionState !== TransitionState.IDLE) {
    pendingPageId = _loadingSection;
    return false;
  }
  if (currentPage?.id === _loadingSection) {
    return false;
  }

  try {
    const loadingSection = Page.findPage(_loadingSection);
    const previousPage = currentPage;
    document.getElementById('navigation-error')?.remove();

    // Set state to transitioning
    transitionState = TransitionState.TRANSITIONING;

    // Prepare ambient audio crossfade before fadeOut
    try {
      if (typeof LivingPantheonCore !== 'undefined') {
        const livingPantheon = LivingPantheonCore.getInstance();
        if (livingPantheon && livingPantheon.subsystems.ambient) {
          // Prepare ambient layer for crossfade on the new chamber
          // This will be triggered after fadeInPage completes
        }
      }
    } catch (pantheError) {
      console.warn(
        'Living Pantheon audio preparation warning:',
        pantheError.message
      );
    }

    // Play page exit sound
    if (typeof UISounds !== 'undefined' && UISounds.isEnabled()) {
      UISounds.pageExit(0.5);
    }

    loadingSection
      .initPage()
      .then(() => {
        // Do not add a failed destination or a superseded slow load to history.
        const queuedPageId = pendingPageId;
        pendingPageId = null;
        if (queuedPageId && queuedPageId !== _loadingSection) {
          transitionState = TransitionState.IDLE;
          showNewSection(queuedPageId);
          return;
        }
        // pushState does not emit hashchange; genuine back/forward events have
        // already changed the URL and therefore do not create another entry.
        if (window.location.hash !== _loadingSection) {
          window.history.pushState(null, '', _loadingSection);
        }
        window.dispatchEvent(
          new CustomEvent('etceter4:navigation', {
            detail: { route: _loadingSection },
          })
        );
        fadeOutPage(currentPage, () => {
          fadeInPage(loadingSection, () => {
            // Transition Living Pantheon to new chamber after page is visible
            try {
              if (typeof LivingPantheonCore !== 'undefined') {
                const livingPantheon = LivingPantheonCore.getInstance();
                if (livingPantheon && livingPantheon.isRunning) {
                  // Extract chamber ID from page ID (remove '#' prefix)
                  const chamberId = _loadingSection.replace('#', '');
                  // Get chamber color from config if available
                  const chamberConfig =
                    typeof ETCETER4_CONFIG !== 'undefined'
                      ? ETCETER4_CONFIG.livingPantheon?.chambers?.[chamberId]
                      : null;
                  const chamberColor = chamberConfig?.color || null;

                  livingPantheon.transitionToNewChamber(
                    chamberId,
                    chamberColor
                  );
                }
              }
            } catch (pantheError) {
              console.warn(
                'Living Pantheon transition warning:',
                pantheError.message
              );
            }

            // Play page enter sound
            if (typeof UISounds !== 'undefined' && UISounds.isEnabled()) {
              UISounds.pageEnter(0.5);
            }

            // Manage 3D compositor lifecycle after navigation
            if (typeof manageLandingCompositor === 'function') {
              setTimeout(manageLandingCompositor, 100);
            }

            // Set state to ready when transition completes
            transitionState = TransitionState.READY;
            setTimeout(() => {
              transitionState = TransitionState.IDLE;
              const queuedPageId = pendingPageId;
              pendingPageId = null;
              if (queuedPageId && queuedPageId !== currentPage.id) {
                showNewSection(queuedPageId);
              }
            }, ETCETER4_CONFIG.animations.transitionCooldown);
          });
        });
      })
      .catch(error => {
        recoverNavigation(error, previousPage, _loadingSection);
      });

    return true;
  } catch (error) {
    console.error(`Navigation error: ${error.message}`);
    transitionState = TransitionState.IDLE;
    return false;
  }
}

/**
 *  Fades in a page
 *
 * @param {Object} _Page - page to be faded in
 * @returns {Boolean} true if successful
 */

function fadeInPage(_Page, _cb) {
  let _display;

  if (_Page.isLoading === false) {
    try {
      // make sure opacity is 0 & then the object is there
      $(_Page.id).css('opacity', 0);
      if (_Page.id === '#stills' || _Page.id === '#diary') {
        _display = 'table';
      }

      // Velocity 2 core accepts opacity maps, not the removed fadeIn redirect.
      $(_Page.id)
        .removeClass('dn')
        .css('display', _display || 'block');
      animatePageOpacity($(_Page.id), 1, {
        delay: 0,
        duration: ETCETER4_CONFIG.animations.fadeInDuration,
        display: _display,
        easing: 'easeInSine',
        begin() {
          currentPage = _Page;
          window.currentPage = _Page;
          _Page.isLoading = true;
        },
        complete() {
          try {
            _Page.isLoading = false;
            currentPage = _Page;
            window.currentPage = _Page;

            // Record visit in journey tracker
            if (typeof JourneyTracker !== 'undefined') {
              try {
                JourneyTracker.getInstance().recordVisit(_Page.id);
              } catch (_journeyErr) {
                // Non-critical — silently continue
              }
            }

            // Anticipatory preload: when landing on a wing, preload its chambers
            if (typeof ChamberLoader !== 'undefined') {
              _preloadWingChambers(_Page.id);
            }

            // Manage focus for accessibility
            if (typeof manageFocus === 'function') {
              manageFocus(_Page.id);
            }

            // Announce page transition to screen readers
            if (typeof announcePageTransition === 'function') {
              announcePageTransition(_Page.id);
            }

            if (_cb) {
              _cb();
            }
          } catch (completeError) {
            console.error(
              'FadeIn complete callback error:',
              completeError.message
            );
            _Page.isLoading = false;
            transitionState = TransitionState.IDLE;
          }
          return true;
        },
      });
    } catch (error) {
      console.error('FadeIn animation error:', error.message);
      _Page.isLoading = false;
      transitionState = TransitionState.IDLE;
      return false;
    }
  } else {
    // prevents fast clicking of the buttons from overloading the function
    return false;
  }
}

/**
 * Wing → chamber mappings for anticipatory preloading
 * @type {Object<string, string[]>}
 */
const WING_CHAMBERS = {
  '#east-wing': ['akademia', 'bibliotheke', 'pinakotheke'],
  '#west-wing': ['agora', 'symposion', 'oikos'],
  '#south-wing': ['odeion', 'theatron'],
  '#north-wing': ['ergasterion', 'khronos'],
};

/**
 * Preload child chamber fragments when visitor lands on a wing page.
 * Uses requestIdleCallback to avoid blocking the main thread.
 * Respects connection-aware loading via ChamberLoader._shouldSkipPreload().
 * @param {string} pageId - e.g. '#east-wing'
 */
function _preloadWingChambers(pageId) {
  const chambers = WING_CHAMBERS[pageId];
  if (!chambers) {
    return;
  }

  const loader = ChamberLoader.getInstance();

  // Skip preloading on slow connections
  if (loader.shouldSkipPreload()) {
    return;
  }

  const doPreload = () => {
    for (const chamberId of chambers) {
      if (loader.isRegistered(chamberId) && !loader.isLoaded(chamberId)) {
        loader.preload(chamberId);
      }
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(doPreload, { timeout: 3000 });
  } else {
    setTimeout(doPreload, 200);
  }
}

/**
 *  Fades out a page
 *
 * @param {Object} _Page - page to be faded out
 * @returns {Boolean} true if successful
 */

function fadeOutPage(_Page, _cb) {
  if (_Page.isLoading === false) {
    try {
      const displayOfPage = $(_Page.id).css('display');
      // make sure it's not fading out a hidden or non existant element
      if (displayOfPage !== undefined && displayOfPage !== 'none') {
        animatePageOpacity($(_Page.id), 0, {
          delay: ETCETER4_CONFIG.animations.fadeOutDelay,
          duration: ETCETER4_CONFIG.animations.fadeOutDuration,
          easing: 'ease-out',
          begin() {
            currentPage = _Page;
            _Page.isLoading = true;
          },
          complete() {
            try {
              // hide the current page when faded out
              $(_Page.id).addClass('dn').css('display', 'none');
              _Page.isLoading = false;
              currentPage.isLoading = false;
              if (_cb) {
                _cb();
              }
            } catch (completeError) {
              console.error(
                'FadeOut complete callback error:',
                completeError.message
              );
              _Page.isLoading = false;
              currentPage.isLoading = false;
              transitionState = TransitionState.IDLE;
            }
            return true;
          },
        });
      } else {
        currentPage.isLoading = false;
        if (_cb) {
          _cb();
        }
        return false; // Page isn't loaded
      }
    } catch (error) {
      console.error('FadeOut animation error:', error.message);
      _Page.isLoading = false;
      currentPage.isLoading = false;
      transitionState = TransitionState.IDLE;
      return false;
    }
  } else {
    return false; // Page is already loading
  }
}

/**
 * Site navigation listeners
 */

// Delegated click handler for all internal hash links
// Routes all a[href^="#"] clicks through showNewSection() uniformly
$(document).on('click', 'a[href^="#"]', function (e) {
  const hash = $(this).attr('href');
  if (!hash || hash === '#' || hash === '#pages') {
    return;
  }
  e.preventDefault();
  showNewSection(hash);

  // Close mobile menu if open
  $('.c-hamburger.is-active')
    .removeClass('is-active')
    .attr('aria-expanded', 'false');
  $('.mobileMenu.open').removeClass('open');
  document.body.style.overflow = '';
});

// Back button uses getBackElement() logic, not a simple hash
$('#backButton').on('click', e => {
  e.preventDefault();
  const back = currentPage.getBackElement();
  if (back && back.id) {
    showNewSection(back.id);
  }
});

/*
 * Mobile Menu Button
 */

$('.c-hamburger').on('click', function () {
  const hamburgerMenu = $(this);
  const mobileMenu = $('.mobileMenu');

  if (hamburgerMenu.hasClass('is-active')) {
    hamburgerMenu.removeClass('is-active');
    hamburgerMenu.attr('aria-expanded', 'false');
    mobileMenu.removeClass('open');
    // Unlock scroll when menu closes
    document.body.style.overflow = '';
  } else {
    hamburgerMenu.addClass('is-active');
    hamburgerMenu.attr('aria-expanded', 'true');
    mobileMenu.addClass('open');
    // Lock scroll when menu opens
    document.body.style.overflow = 'hidden';
  }
});

/**
 * Keyboard Navigation
 * Provides accessible keyboard controls for site navigation
 */

document.addEventListener('keydown', event => {
  // Check for Cmd/Ctrl+K to open global search (works even in input fields)
  const isMetaOrCtrl = event.metaKey || event.ctrlKey;
  if (isMetaOrCtrl && event.key === 'k') {
    event.preventDefault();
    // main.js owns lazy search initialization; the controller owns modal events.
    return;
  }

  // Let the active modal handle Escape/arrows without navigating behind it.
  if (document.querySelector('.lightbox.active')) {
    return;
  }
  if (
    typeof DiscoveryController !== 'undefined' &&
    DiscoveryController.getInstance().isSearchModalOpen
  ) {
    return;
  }

  // Skip other shortcuts if user is typing in an input field
  const targetEl = /** @type {HTMLElement} */ (event.target);
  if (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA') {
    return;
  }

  // Check for Living Pantheon toggle (Ctrl+Shift+L)
  const isCtrl =
    event.ctrlKey || (event.metaKey && navigator.platform.includes('Mac'));
  const isShift = event.shiftKey;
  const isL = event.key.toLowerCase() === 'l';

  if (isCtrl && isShift && isL) {
    // Living Pantheon toggle - allow LivingPantheonCore to handle it
    // This will be processed by LivingPantheonCore's keydown listener
    if (typeof LivingPantheonCore !== 'undefined') {
      // The LivingPantheonCore will handle this event
      return;
    }
  }

  switch (event.key) {
    case 'Escape':
      // Go back/up in navigation hierarchy
      if (currentPage && typeof currentPage.getBackElement === 'function') {
        const backPage = currentPage.getBackElement();
        if (backPage && backPage.id) {
          showNewSection(backPage.id);
        }
      }
      break;

    case 'Enter':
    case ' ': {
      // Activate focused element
      const activeEl = /** @type {HTMLElement | null} */ (
        document.activeElement
      );
      if (activeEl && activeEl.click) {
        // Prevent space from scrolling
        if (event.key === ' ') {
          event.preventDefault();
        }
        activeEl.click();
      }
      break;
    }

    case 'ArrowLeft':
      // Previous item in carousels
      if (currentPage && currentPage.id === '#stills') {
        $('#stills-left').trigger('click');
      } else if (currentPage && currentPage.id === '#diary') {
        $('#stills-left-diary').trigger('click');
      }
      break;

    case 'ArrowRight':
      // Next item in carousels
      if (currentPage && currentPage.id === '#stills') {
        $('#stills-right').trigger('click');
      } else if (currentPage && currentPage.id === '#diary') {
        $('#stills-right-diary').trigger('click');
      }
      break;

    case 'Home':
      // Go to landing page
      showNewSection('#landing');
      break;

    case 'm':
    case 'M':
      // Go to menu (if not typing)
      if (!event.ctrlKey && !event.metaKey) {
        showNewSection('#menu');
      }
      break;

    case '?':
      // Show keyboard shortcuts help
      // Note: Ctrl+Shift+L toggles Living Pantheon immersive effects
      // (This could trigger a help modal if implemented)
      break;
  }
});

/**
 * Focus management for accessibility
 * Ensures proper focus handling during page transitions
 */
function manageFocus(pageId) {
  const page = $(pageId);
  if (page.length) {
    // Set focus to the first focusable element in the page
    const focusable = page
      .find('a, button, input, [tabindex]:not([tabindex="-1"])')
      .first();
    if (focusable.length) {
      focusable.trigger('focus');
    }
  }
}

/**
 * Announce page transition to screen readers
 * Uses aria-live region for accessibility
 * @param {string} pageId - The page identifier (e.g., '#menu')
 */
function announcePageTransition(pageId) {
  const announcer = document.getElementById('page-announcer');
  if (!announcer) {
    return;
  }

  // Map page IDs to friendly names
  const pageNames = {
    '#landing': 'Landing page',
    '#menu': 'Main menu',
    '#words': 'Words section',
    '#vision': 'Vision section',
    '#sound': 'Sound section',
    '#info': 'Info section',
    '#video': 'Video section',
    '#stills': 'Stills gallery',
    '#diary': 'Diary gallery',
    '#blog': 'Blog section',
    '#ogod3d': 'OGOD 3D immersive experience',
    '#ogod-viewer': 'OGOD Animation Viewer',
    '#east-wing': 'East Wing - Scholarship',
    '#west-wing': 'West Wing - Discourse',
    '#south-wing': 'South Wing - Performance',
    '#north-wing': 'North Wing - Process',
    '#akademia': 'Akademia - Scholarship',
    '#bibliotheke': 'Bibliotheke - Library',
    '#pinakotheke': 'Pinakotheke - Art Gallery',
    '#agora': 'Agora - Political Commentary',
    '#symposion': 'Symposion - Dialogues',
    '#oikos': 'Oikos - Personal Reflections',
    '#odeion': 'Odeion - Music Hall',
    '#theatron': 'Theatron - Theater',
    '#ergasterion': 'Ergasterion - Workshop',
    '#khronos': 'Khronos - Timeline',
    '#discovery': 'Discovery - Search and Explore',
  };

  const pageName = pageNames[pageId] || `${pageId.replace('#', '')} page`;
  announcer.textContent = `Navigated to ${pageName}`;
}

/**
 * Initialize Living Pantheon system on first page load
 * Sets up the generative immersive effects with proper error handling
 * @param {string} initialPageId - The initial page ID to set as first chamber
 */
function initializeLivingPantheon(initialPageId) {
  if (livingPantheonInitialized) {
    return; // Already initialized
  }

  try {
    if (typeof LivingPantheonCore === 'undefined') {
      console.info('Living Pantheon not available');
      return;
    }

    const livingPantheon = LivingPantheonCore.getInstance();
    if (!livingPantheon) {
      console.warn('Failed to get Living Pantheon instance');
      return;
    }

    // Extract chamber ID from page ID (remove '#' prefix)
    const chamberId = initialPageId.replace('#', '');

    // Get chamber color from config if available
    let chamberColor = null;
    if (
      typeof ETCETER4_CONFIG !== 'undefined' &&
      ETCETER4_CONFIG.livingPantheon?.chambers?.[chamberId]
    ) {
      chamberColor = ETCETER4_CONFIG.livingPantheon.chambers[chamberId].color;
    }

    // Initialize with first page
    livingPantheon.initialize({
      chamberId,
      chamberColor,
    });

    // Start the system (respects user preference from localStorage)
    livingPantheon.start();

    // Listen for status changes for debugging/monitoring
    livingPantheon.on(eventDetail => {
      if (eventDetail.status.isRunning) {
        console.debug('Living Pantheon active');
      }
    });

    livingPantheonInitialized = true;
    console.info('Living Pantheon initialized');
  } catch (error) {
    console.warn('Living Pantheon initialization error:', error.message);
    // Don't throw - system is optional and shouldn't break page navigation
  }
}
