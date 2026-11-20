/**
 * Audio Player Module
 * Self-hosted audio playback using Howler.js
 * Part of ETCETER4 Pantheon Project
 */

class AudioPlayer {
  constructor(config) {
    this.id = config.id;
    this.tracks = config.tracks || [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.volume = 0.8;
    this.howl = null;
    this.container = config.container;
    this.loadFailed = false;
    this.progressInterval = null;

    this.init();
  }

  init() {
    this.createUI();
    this.loadTrack(0);
  }

  createUI() {
    const playerHTML = `
            <div class="audio-player" id="${this.id}">
                <div class="player-info">
                    <div class="track-title" id="${this.id}-title">Loading...</div>
                    <div class="track-artist" id="${this.id}-artist">ET CETER4</div>
                </div>

                <div class="player-controls">
                    <button class="btn-prev" id="${this.id}-prev" title="Previous Track">
                        <span>◄</span>
                    </button>
                    <button class="btn-play" id="${this.id}-play" title="Play/Pause">
                        <span class="play-icon">▶</span>
                        <span class="pause-icon" style="display:none;">❚❚</span>
                    </button>
                    <button class="btn-next" id="${this.id}-next" title="Next Track">
                        <span>►</span>
                    </button>
                </div>

                <div class="player-progress">
                    <div class="progress-bar" id="${this.id}-progress">
                        <div class="progress-fill" id="${this.id}-progress-fill"></div>
                    </div>
                    <div class="time-display">
                        <span id="${this.id}-current-time">0:00</span>
                        <span> / </span>
                        <span id="${this.id}-duration">0:00</span>
                    </div>
                </div>

                <div class="player-volume">
                    <button class="btn-volume" id="${this.id}-volume-btn" title="Mute/Unmute">
                        <span class="volume-icon">🔊</span>
                    </button>
                    <input type="range"
                           class="volume-slider"
                           id="${this.id}-volume"
                           min="0"
                           max="100"
                           value="80">
                </div>

                <div class="player-playlist" id="${this.id}-playlist">
                    ${this.createPlaylistHTML()}
                </div>
            </div>
        `;

    $(this.container).html(playerHTML);
    this.bindEvents();
  }

  createPlaylistHTML() {
    const escape = text =>
      String(text).replace(
        /[&<>"']/g,
        character =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[character]
      );
    return this.tracks
      .map(
        (track, index) => `
            <div class="playlist-item ${index === 0 ? 'active' : ''}"
                 data-track-index="${index}">
                <span class="track-number">${index + 1}.</span>
                <span class="track-name">${!(track.src || track.url) && track.externalUrl ? `<a href="${escape(track.externalUrl)}">${escape(track.title)} — Bandcamp</a>` : escape(track.title)}</span>
                <span class="track-time">${track.duration || '0:00'}</span>
            </div>
        `
      )
      .join('');
  }

  bindEvents() {
    const self = this;

    // Play/Pause button
    $(`#${this.id}-play`).on('click', () => this.togglePlayPause());

    // Previous/Next buttons
    $(`#${this.id}-prev`).on('click', () => this.previousTrack());
    $(`#${this.id}-next`).on('click', () => this.nextTrack());

    // Volume controls
    $(`#${this.id}-volume`).on('input', function () {
      self.setVolume(Number($(this).val()) / 100);
    });

    $(`#${this.id}-volume-btn`).on('click', () => this.toggleMute());

    // Progress bar click
    $(`#${this.id}-progress`).on('click', function (e) {
      const progressBar = $(this);
      const clickX = e.pageX - progressBar.offset().left;
      const width = progressBar.width();
      const percentage = clickX / width;
      self.seek(percentage);
    });

    // Playlist item click
    $(`#${this.id}-playlist .playlist-item`).on('click', function (event) {
      if (event.target.closest('a')) {
        return;
      }
      const trackIndex = parseInt($(this).data('track-index'));
      if (self.loadTrack(trackIndex)) {
        self.play();
      }
    });
  }

  loadTrack(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.tracks.length) {
      return false;
    }

    // Stop current track if playing
    if (this.howl) {
      this.howl.stop();
      this.howl.unload();
    }

    this.howl = null;
    this.isPlaying = false;
    this.updatePlayButton(false);
    clearInterval(this.progressInterval);
    this.progressInterval = null;
    // Reset load state
    this.loadFailed = false;
    this.currentTrackIndex = index;
    const track = this.tracks[index];
    const self = this;

    $(`#${this.id}-title`).text(track.title);
    $(`#${this.id}-artist`).text(track.artist || 'ET CETER4');
    $(`#${this.id}-current-time`).text('0:00');
    $(`#${this.id}-duration`).text(track.duration || '0:00');
    $(`#${this.id}-progress-fill`).css('width', '0%');
    $(`#${this.id}-playlist .playlist-item`).removeClass('active');
    $(
      `#${this.id}-playlist .playlist-item[data-track-index="${index}"]`
    ).addClass('active');
    const source = track.src || track.url;
    $(`#${this.id}-play`).prop('disabled', !source);
    if (!source) {
      this.loadFailed = true;
      $(`#${this.id}-title`).text(`${track.title} — listen on Bandcamp`);
      return false;
    }

    // Create new Howl instance
    this.howl = new Howl({
      src: [source],
      html5: true, // Enable streaming for large files
      volume: this.volume,
      onplay: () => this.updatePlayButton(true),
      onpause: () => this.updatePlayButton(false),
      onend: () => this.nextTrack(),
      onload: () => this.updateDuration(),
      onloaderror: (id, error) => {
        self.loadFailed = true;
        self.isPlaying = false;
        self.updatePlayButton(false);
        console.error('Error loading track:', error);
        $(`#${self.id}-title`).text('Error loading track');
      },
    });

    // Update UI
    $(`#${this.id}-title`).text(track.title);
    $(`#${this.id}-artist`).text(track.artist || 'ET CETER4');

    // Update playlist active state

    // Start progress update loop
    this.startProgressUpdate();
    return true;
  }

  play() {
    if (this.howl && !this.loadFailed) {
      this.howl.play();
      this.isPlaying = true;
    } else if (this.loadFailed) {
      console.warn('Cannot play: track failed to load');
    }
  }

  pause() {
    if (this.howl) {
      this.howl.pause();
      this.isPlaying = false;
    }
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  nextTrack() {
    if (!this.tracks.length) {
      return;
    }
    const wasPlaying = this.isPlaying;
    const nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    const loaded = this.loadTrack(nextIndex);
    if (loaded && wasPlaying) {
      this.play();
    }
  }

  previousTrack() {
    if (!this.tracks.length) {
      return;
    }
    const wasPlaying = this.isPlaying;
    const prevIndex =
      this.currentTrackIndex === 0
        ? this.tracks.length - 1
        : this.currentTrackIndex - 1;
    const loaded = this.loadTrack(prevIndex);
    if (loaded && wasPlaying) {
      this.play();
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.howl) {
      this.howl.volume(this.volume);
    }

    // Update volume icon
    const icon = this.volume === 0 ? '🔇' : this.volume < 0.5 ? '🔉' : '🔊';
    $(`#${this.id}-volume-btn .volume-icon`).text(icon);
  }

  toggleMute() {
    if (this.volume > 0) {
      this.previousVolume = this.volume;
      this.setVolume(0);
      $(`#${this.id}-volume`).val(0);
    } else {
      const newVolume = this.previousVolume || 0.8;
      this.setVolume(newVolume);
      $(`#${this.id}-volume`).val(newVolume * 100);
    }
  }

  seek(percentage) {
    if (this.howl && this.howl.playing()) {
      const duration = this.howl.duration();
      this.howl.seek(duration * percentage);
    }
  }

  updatePlayButton(isPlaying) {
    if (isPlaying) {
      $(`#${this.id}-play .play-icon`).hide();
      $(`#${this.id}-play .pause-icon`).show();
    } else {
      $(`#${this.id}-play .play-icon`).show();
      $(`#${this.id}-play .pause-icon`).hide();
    }
  }

  updateDuration() {
    if (this.howl) {
      const duration = this.howl.duration();
      $(`#${this.id}-duration`).text(this.formatTime(duration));
    }
  }

  startProgressUpdate() {
    const self = this;

    // Clear existing interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Update progress every 100ms
    this.progressInterval = setInterval(() => {
      if (self.howl && self.howl.playing()) {
        const seek = self.howl.seek();
        const duration = self.howl.duration();

        if (duration > 0) {
          const percentage = (seek / duration) * 100;
          $(`#${self.id}-progress-fill`).css('width', `${percentage}%`);
          $(`#${self.id}-current-time`).text(self.formatTime(seek));
        }
      }
    }, 100);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  destroy() {
    if (this.howl) {
      this.howl.stop();
      this.howl.unload();
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioPlayer;
}
