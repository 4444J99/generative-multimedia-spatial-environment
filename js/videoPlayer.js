/**
 * Video Player Module
 * Self-hosted video playback using Video.js
 * Part of ETCETER4 Pantheon Project
 */

class VideoPlayer {
  constructor(config) {
    this.id = config.id;
    this.videos = config.videos || [];
    this.currentVideoIndex = 0;
    this.container = config.container;
    this.player = null;
    this.options = config.options || {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: true, // Responsive
      aspectRatio: '16:9',
      playbackRates: [0.5, 1, 1.5, 2],
      controlBar: {
        volumePanel: { inline: false },
      },
    };

    this.init();
  }

  init() {
    this.createUI();
    if (this.videos.length > 0) {
      this.loadVideo(0);
    }
  }

  createUI() {
    const playerHTML = `
            <div class="video-player-container" id="${this.id}">
                <div class="video-player-header">
                    <h3 class="video-title" id="${this.id}-title">Select a video</h3>
                    <p class="video-description" id="${this.id}-description"></p>
                </div>

                <div class="video-player-main">
                    <video id="${this.id}-video"
                           class="video-js vjs-etceter4-theme"
                           preload="metadata"
                           width="640"
                           height="360"
                           data-setup='{}'>
                        <p class="vjs-no-js">
                            To view this video please enable JavaScript, and consider upgrading to a
                            web browser that supports HTML5 video
                        </p>
                    </video>
                </div>

                <div class="video-playlist" id="${this.id}-playlist">
                    <h4 class="playlist-header">Playlist</h4>
                    <div class="playlist-items">
                        ${this.createPlaylistHTML()}
                    </div>
                </div>
            </div>
        `;

    $(this.container).html(playerHTML);
    this.bindPlaylistEvents();
  }

  createPlaylistHTML() {
    if (this.videos.length === 0) {
      return '<p class="playlist-empty">No videos available</p>';
    }

    return this.videos
      .map(
        (video, index) => `
            <div class="playlist-item ${index === 0 ? 'active' : ''}"
                 data-video-index="${index}">
                <div class="playlist-item-thumbnail">
                    ${
                      video.thumbnail
                        ? `<img src="${video.thumbnail}" alt="${video.title}">`
                        : '<div class="thumbnail-placeholder">📹</div>'
                    }
                </div>
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${video.title}</div>
                    <div class="playlist-item-meta">
                        ${video.duration ? `<span class="duration">${video.duration}</span>` : ''}
                        ${video.date ? `<span class="date">${video.date}</span>` : ''}
                    </div>
                </div>
            </div>
        `
      )
      .join('');
  }

  bindPlaylistEvents() {
    const self = this;

    $(`.playlist-item`).on('click', function () {
      const videoIndex = parseInt($(this).data('video-index'));
      self.loadVideo(videoIndex);
    });
  }

  loadVideo(index) {
    if (index < 0 || index >= this.videos.length) {
      return;
    }

    this.currentVideoIndex = index;
    const video = this.videos[index];

    // Update header
    $(`#${this.id}-title`).text(video.title);
    $(`#${this.id}-description`).text(video.description || '');

    // Update playlist active state
    $(`.playlist-item`).removeClass('active');
    $(`.playlist-item[data-video-index="${index}"]`).addClass('active');

    // Dispose existing player if it exists
    if (this.player) {
      this.player.dispose();
    }

    // Create new player
    // video.js is a page-level global (@types/video.js is a UMD export,
    // which a module file cannot reference bare); window.videojs is the
    // same binding. No page in the repo was found loading video.js —
    // verify before relying on the player.
    this.player = window.videojs(`${this.id}-video`, this.options);

    // Set video source
    const sources = [];

    if (video.src) {
      // Self-hosted video
      sources.push({
        src: video.src,
        type: this.getVideoType(video.src),
      });
    } else if (video.youtube) {
      // YouTube embed (requires videojs-youtube plugin)
      sources.push({
        src: video.youtube,
        type: 'video/youtube',
      });
    } else if (video.vimeo) {
      // Vimeo embed (requires videojs-vimeo plugin)
      sources.push({
        src: video.vimeo,
        type: 'video/vimeo',
      });
    }

    this.player.src(sources);

    // Set poster image
    if (video.poster) {
      this.player.poster(video.poster);
    }

    // Add subtitles/captions if available
    if (video.subtitles && video.subtitles.length > 0) {
      video.subtitles.forEach(subtitle => {
        this.player.addRemoteTextTrack(
          {
            kind: 'subtitles',
            label: subtitle.label,
            srclang: subtitle.lang,
            src: subtitle.src,
          },
          false
        );
      });
    }

    // Event handlers
    this.player.on('ended', () => {
      if (this.currentVideoIndex < this.videos.length - 1) {
        this.loadVideo(this.currentVideoIndex + 1);
        this.player.play();
      }
    });

    this.player.on('error', e => {
      console.error('Video error:', e);
      $(`#${this.id}-title`).text('Error loading video');
    });

    // Load the video
    this.player.load();
  }

  getVideoType(src) {
    const ext = src.split('.').pop().toLowerCase();
    const types = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogv: 'video/ogg',
      m3u8: 'application/x-mpegURL', // HLS
      mpd: 'application/dash+xml', // DASH
    };
    return types[ext] || 'video/mp4';
  }

  nextVideo() {
    if (this.currentVideoIndex < this.videos.length - 1) {
      this.loadVideo(this.currentVideoIndex + 1);
    }
  }

  previousVideo() {
    if (this.currentVideoIndex > 0) {
      this.loadVideo(this.currentVideoIndex - 1);
    }
  }

  play() {
    if (this.player) {
      this.player.play();
    }
  }

  pause() {
    if (this.player) {
      this.player.pause();
    }
  }

  destroy() {
    if (this.player) {
      this.player.dispose();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoPlayer;
}
