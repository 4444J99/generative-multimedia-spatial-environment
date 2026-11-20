/**
 * @file PlaylistManager.js
 * @description Album/playlist UI controller for the Odeion chamber.
 * Manages album selection, track listing, queue, and integrates with
 * EnhancedAudioPlayer for Howler.js playback and WaveformVisualizer.
 */

'use strict';

class PlaylistManager {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container] - Odeion player container element (required by initialize(), not by construction)
   * @param {EnhancedAudioPlayer} [options.player] - Existing player instance
   * @param {WaveformVisualizer} [options.waveform] - Existing waveform instance
   */
  constructor(options = {}) {
    this.container = options.container;
    this.player = options.player || null;
    this.waveform = options.waveform || null;

    // Album data from config (convert object to array)
    const albumsObj =
      (typeof ETCETER4_CONFIG !== 'undefined' &&
        ETCETER4_CONFIG.media?.albums) ||
      {};
    this.albums = Object.values(albumsObj);

    // State
    this.currentAlbum = null;
    this.currentTrackIndex = 0;
    this.isShuffled = false;
    this.repeatMode = 'none'; // 'none', 'all', 'one'
    this.queue = [];
    this._shuffledQueue = [];

    // DOM refs (set during render)
    this._albumGrid = null;
    this._trackList = null;
    this._nowPlaying = null;
    this._controls = null;
    this._playerListeners = [];
    this._domListeners = [];
    // This controller owns queue/repeat decisions; the player emits ended.
    if (this.player) {
      this.player.autoAdvance = false;
    }
  }

  /** Initialize the playlist UI */
  initialize() {
    if (!this.container) {
      return;
    }
    this._render();
    this._bindEvents();

    // If we have albums, show the grid
    if (this.albums.length > 0) {
      this._renderAlbumGrid();
    }
  }

  /** Render the base UI structure */
  _render() {
    // Album selector
    this._albumGrid = document.createElement('div');
    this._albumGrid.className =
      'odeion-album-grid flex flex-wrap justify-center mb4';
    this._albumGrid.setAttribute('role', 'list');
    this._albumGrid.setAttribute('aria-label', 'Albums');

    // Track list
    this._trackList = document.createElement('div');
    this._trackList.className = 'odeion-track-list dn';

    // Insert before the existing player controls area
    const playerContainer = document.getElementById('odeion-player-container');
    if (playerContainer) {
      this.container.insertBefore(this._albumGrid, playerContainer);
      // Track list after player
      playerContainer.after(this._trackList);
    } else {
      this.container.appendChild(this._albumGrid);
      this.container.appendChild(this._trackList);
    }

    // Add playlist controls row
    this._renderControls();
  }

  /** Render album selection grid */
  _renderAlbumGrid() {
    this._albumGrid.replaceChildren();
    this.albums.forEach((album, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className =
        'odeion-album-card chamber-card pointer ma2 ba b--white-20 br3 pa3 tc white bg-black-70';
      card.dataset.albumIndex = String(idx);
      card.dataset.section = 'album';
      card.style.width = '200px';
      card.setAttribute('aria-pressed', 'false');
      if (album.coverUrl) {
        const cover = document.createElement('img');
        cover.src = album.coverUrl;
        cover.alt = `${album.title} cover`;
        cover.className = 'w-100 br2 mb2';
        cover.loading = 'lazy';
        card.appendChild(cover);
      }
      const title = document.createElement('span');
      title.className = 'db f6 mb1';
      title.textContent = album.title;
      const detail = document.createElement('span');
      detail.className = 'db f7 o-70';
      detail.textContent = `${album.year} · ${album.tracks.length} tracks`;
      card.append(title, detail);
      this._albumGrid.appendChild(card);
    });
  }

  /** Render playlist controls (shuffle, repeat, prev, next) */
  _renderControls() {
    const controls = document.createElement('div');
    this._controls = controls;
    controls.className =
      'odeion-playlist-controls flex justify-center items-center mt2 mb2';
    controls.innerHTML = `
      <button id="odeion-shuffle-btn" class="pa1 ph2 ba b--white-20 bg-black-70 white f7 pointer br2 mr2"
              aria-label="Shuffle" title="Shuffle">&#8645;</button>
      <button id="odeion-prev-btn" class="pa1 ph2 ba b--white-20 bg-black-70 white f7 pointer br2 mr2"
              aria-label="Previous track" title="Previous">&#9664;&#9664;</button>
      <button id="odeion-next-btn" class="pa1 ph2 ba b--white-20 bg-black-70 white f7 pointer br2 mr2"
              aria-label="Next track" title="Next">&#9654;&#9654;</button>
      <button id="odeion-repeat-btn" class="pa1 ph2 ba b--white-20 bg-black-70 white f7 pointer br2"
              aria-label="Repeat" title="Repeat">&#8635;</button>
    `;

    const playerContainer = document.getElementById('odeion-player-container');
    const existingControls = document.getElementById('odeion-controls');
    if (existingControls) {
      existingControls.after(controls);
    } else if (playerContainer) {
      playerContainer.appendChild(controls);
    }
  }

  /** Bind handlers once; keep references for chamber disposal. */
  _listen(element, event, callback) {
    if (!element) {
      return;
    }
    element.addEventListener(event, callback);
    this._domListeners.push([element, event, callback]);
  }

  _bindEvents() {
    this._listen(this._albumGrid, 'click', event => {
      const card = event.target.closest('.odeion-album-card');
      if (card) {
        this.selectAlbum(Number(card.dataset.albumIndex));
      }
    });
    this._listen(this._trackList, 'click', event => {
      const row = event.target.closest('button.odeion-track-row');
      if (row) {
        this.playTrack(Number(row.dataset.trackIndex));
      }
    });
    const actions = {
      'odeion-prev-btn': () => this.previous(),
      'odeion-next-btn': () => this.next(),
      'odeion-shuffle-btn': () => this.toggleShuffle(),
      'odeion-repeat-btn': () => this.toggleRepeat(),
      'odeion-play-btn': () => {
        if (this.player?.isPlaying) {
          this.player.pause();
        } else if (this.queue[this.currentTrackIndex]?.src) {
          this.player?.play();
        }
      },
    };
    Object.entries(actions).forEach(([id, action]) =>
      this._listen(document.getElementById(id), 'click', action)
    );
    this._listen(document.getElementById('odeion-volume'), 'input', event =>
      this.player?.setVolume(Number(event.target.value) / 100)
    );
    if (this.player) {
      const updatePlay = () => {
        const button = document.getElementById('odeion-play-btn');
        if (button) {
          button.textContent = this.player.isPlaying ? '❚❚ Pause' : '▶ Play';
          button.setAttribute(
            'aria-label',
            this.player.isPlaying ? 'Pause' : 'Play'
          );
        }
      };
      const handlers = {
        ended: () => {
          updatePlay();
          this._onTrackEnd();
        },
        play: updatePlay,
        pause: updatePlay,
        stop: updatePlay,
        error: () => {
          updatePlay();
          const title = document.getElementById('odeion-track-title');
          if (title) {
            title.textContent =
              'Playback unavailable. Open the album on Bandcamp below.';
          }
        },
      };
      Object.entries(handlers).forEach(([event, callback]) => {
        this.player.on(event, callback);
        this._playerListeners.push([event, callback]);
      });
    }
    this._setControlsEnabled(false);
  }

  _setControlsEnabled(enabled) {
    [
      'odeion-play-btn',
      'odeion-prev-btn',
      'odeion-next-btn',
      'odeion-shuffle-btn',
      'odeion-repeat-btn',
      'odeion-volume',
    ].forEach(id => {
      const control = document.getElementById(id);
      if (
        control instanceof HTMLButtonElement ||
        control instanceof HTMLInputElement
      ) {
        control.disabled = !enabled;
      }
    });
  }

  /**
   * Select an album and show its tracks
   * @param {number} albumIndex
   */
  selectAlbum(albumIndex) {
    if (
      !Number.isInteger(albumIndex) ||
      albumIndex < 0 ||
      albumIndex >= this.albums.length
    ) {
      return;
    }

    this.player?.clearQueue();
    this.currentAlbum = this.albums[albumIndex];
    this.queue = [...(this.currentAlbum.tracks || [])];
    this.currentTrackIndex = 0;
    this._resetShuffleQueue();

    // Highlight selected album
    this._albumGrid
      ?.querySelectorAll('.odeion-album-card')
      .forEach((card, i) => {
        card.setAttribute('aria-pressed', String(i === albumIndex));
        /** @type {HTMLElement} */ (card).style.borderColor =
          i === albumIndex ? '#ffd700' : 'rgba(255,255,255,0.13)';
      });

    // Show track list
    this._renderTrackList();
    this._trackList?.classList.remove('dn');

    const playable = Boolean(this.queue[0]?.src || this.queue[0]?.url);
    this._setControlsEnabled(playable);
    const title = document.getElementById('odeion-track-title');
    if (title) {
      title.textContent = playable ? this.queue[0].title : 'Listen on Bandcamp';
    }
    if (this.player) {
      this.player.tracks = this.queue.map(track => ({ ...track }));
      if (playable) {
        this.player.loadTrack(0);
      }
    }
  }

  /** Render only verified sources. A Bandcamp page is a link, never audio src. */
  _renderTrackList() {
    if (!this._trackList || !this.currentAlbum) {
      return;
    }
    const album = this.currentAlbum;
    const panel = document.createElement('div');
    panel.className = 'pa3 ba b--white-10 br3 bg-black-50';
    const title = document.createElement('h4');
    title.className = 'f5 mt0 mb3';
    title.textContent = album.title;
    panel.appendChild(title);
    const link = document.createElement('a');
    link.href = album.links.bandcamp;
    link.textContent = 'Open album on Bandcamp';
    link.className = 'db white mb3';
    panel.appendChild(link);
    if (!album.tracks.some(track => track.src || track.url)) {
      const frame = document.createElement('iframe');
      frame.src = album.embedUrl;
      frame.title = `Listen to ${album.title} on Bandcamp`;
      frame.width = '100%';
      frame.height = '472';
      frame.loading = 'lazy';
      frame.style.border = '0';
      panel.appendChild(frame);
    }
    album.tracks.forEach((track, index) => {
      const playable = Boolean(track.src || track.url);
      const row = document.createElement(playable ? 'button' : 'a');
      row.className =
        'odeion-track-row flex items-center pa2 mb1 br2 white bg-transparent w-100 tl';
      row.dataset.trackIndex = index;
      if (playable) {
        row.type = 'button';
        row.setAttribute('aria-label', `Play ${track.title}`);
      } else {
        // In this branch the row is the <a> created above, not the <button>.
        /** @type {HTMLAnchorElement} */ (row).href = track.externalUrl;
        row.setAttribute('aria-label', `Listen to ${track.title} on Bandcamp`);
      }
      const number = document.createElement('span');
      number.className = 'f7 o-70 mr2';
      number.textContent = `${track.number}.`;
      const name = document.createElement('span');
      name.className = 'f6 flex-auto';
      name.textContent = track.title;
      const duration = document.createElement('span');
      duration.className = 'f7 o-70 ml2';
      duration.textContent = track.duration;
      row.append(number, name, duration);
      panel.appendChild(row);
    });
    this._trackList.replaceChildren(panel);
  }

  /**
   * Play a specific track by index
   * @param {number} trackIndex
   */
  playTrack(trackIndex) {
    if (!this.currentAlbum || !Number.isInteger(trackIndex) || trackIndex < 0) {
      return;
    }

    const track = this.queue[trackIndex];
    if (!track || !(track.src || track.url)) {
      return false;
    }
    this.currentTrackIndex = trackIndex;
    // Manual selections also consume their remaining entry in this shuffle pass.
    this._shuffledQueue = this._shuffledQueue.filter(
      index => index !== trackIndex
    );

    // Update now-playing display
    const titleEl = document.getElementById('odeion-track-title');
    if (titleEl) {
      titleEl.textContent = track.title;
    }

    // Highlight current track
    this._trackList?.querySelectorAll('.odeion-track-row').forEach((row, i) => {
      /** @type {HTMLElement} */ (row).style.background =
        i === trackIndex ? 'rgba(255,215,0,0.1)' : '';
    });

    // Play via EnhancedAudioPlayer
    if (this.player) {
      if (this.player.loadTrack(trackIndex) !== false) {
        this.player.play();
      }
    }
  }

  /** Play next track in queue */
  next() {
    if (!this.queue.length) {
      return;
    }
    let nextIndex;
    if (this.isShuffled) {
      if (!this._shuffledQueue.length) {
        if (this.repeatMode !== 'all') {
          return;
        }
        this._resetShuffleQueue(true);
      }
      nextIndex = this._shuffledQueue.shift();
      if (nextIndex === undefined) {
        return;
      }
    } else {
      nextIndex = this.currentTrackIndex + 1;
      if (nextIndex >= this.queue.length) {
        if (this.repeatMode === 'none') {
          return;
        }
        nextIndex = 0;
      }
    }
    this.playTrack(nextIndex);
  }

  /** Play previous track */
  previous() {
    if (!this.queue.length) {
      return;
    }
    let prevIndex = this.currentTrackIndex - 1;
    if (prevIndex < 0) {
      prevIndex = this.repeatMode !== 'none' ? this.queue.length - 1 : 0;
    }
    this.playTrack(prevIndex);
  }

  /** Build one finite shuffled pass; repeat-all starts a fresh complete pass. */
  _resetShuffleQueue(includeCurrent = false) {
    this._shuffledQueue = this.isShuffled
      ? this.queue
          .map((track, index) => index)
          .filter(
            index =>
              (includeCurrent || index !== this.currentTrackIndex) &&
              (this.queue[index].src || this.queue[index].url)
          )
      : [];
    for (let index = this._shuffledQueue.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [this._shuffledQueue[index], this._shuffledQueue[swap]] = [
        this._shuffledQueue[swap],
        this._shuffledQueue[index],
      ];
    }
    // Avoid an immediate repeat across the boundary without dropping that track.
    if (
      includeCurrent &&
      this._shuffledQueue.length > 1 &&
      this._shuffledQueue[0] === this.currentTrackIndex
    ) {
      [this._shuffledQueue[0], this._shuffledQueue[1]] = [
        this._shuffledQueue[1],
        this._shuffledQueue[0],
      ];
    }
  }

  /** Toggle shuffle mode */
  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    this._resetShuffleQueue();
    const btn = document.getElementById('odeion-shuffle-btn');
    if (btn) {
      btn.style.color = this.isShuffled ? '#ffd700' : '';
    }
  }

  /** Cycle repeat mode: none → all → one → none */
  toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const current = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(current + 1) % modes.length];

    const btn = document.getElementById('odeion-repeat-btn');
    if (btn) {
      btn.style.color = this.repeatMode !== 'none' ? '#ffd700' : '';
      btn.textContent = this.repeatMode === 'one' ? '\u21BB1' : '\u21BB';
    }
  }

  /** Handle track end - advance queue or repeat */
  _onTrackEnd() {
    if (this.repeatMode === 'one') {
      this.playTrack(this.currentTrackIndex);
    } else {
      this.next();
    }
  }

  /** Dispose */
  dispose() {
    this._domListeners.forEach(([element, event, callback]) =>
      element.removeEventListener(event, callback)
    );
    this._playerListeners.forEach(([event, callback]) =>
      this.player?.off(event, callback)
    );
    this._controls?.remove();
    this._albumGrid?.remove();
    this._trackList?.remove();
  }
}

window.PlaylistManager = PlaylistManager;
