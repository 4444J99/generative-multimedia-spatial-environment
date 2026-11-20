/**
 * @file diary.js
 * @description Diary gallery configuration and event handlers
 * Uses shared Carousel module from js/modules/Carousel.js
 *
 * @author gabriel
 * @requires jQuery
 * @requires js/modules/Carousel.js
 */

'use strict';

/**
 * Historical authored captions. These are separate texts, not scan transcriptions.
 */
const diaryData = {
  diary: {
    1: 'Fires, fury, absolution.<br>Delusion, fantasy, insincerity.<br>Constants follow us.<br>News breaks us.',
    2: 'Culture, rocks, freedom.<br>Eat me, hide me.',
    3: "It's simple, belive us. Believe us. Believe us.",
    4: '',
    5: '',
    6: '',
    7: '',
    8: '',
    9: '',
    10: '',
    11: '',
    12: '',
    13: '',
    14: '',
    15: '',
    16: '',
    17: '',
    18: '',
    19: '',
    20: '',
    21: '',
    22: '',
    23: '',
  },
};

/**
 * The archive has non-contiguous filenames and letter-suffixed pages.
 * Navigate the verified file list; a numeric total cannot generate its paths.
 */
const diaryFiles = globalThis.ETCETER4_SOURCE_CATALOGUE?.diary.files || [];
const diaryCarousel = new Carousel({
  id: '#diary',
  images: [],
  total: diaryFiles.length,
  caption: null,
  captionData: diaryData,
});

function renderDiaryPage() {
  const file = diaryFiles[diaryCarousel.index];
  const image = /** @type {HTMLImageElement | null} */ (
    document.querySelector('#diary-leftImage img')
  );
  if (!file || !image) {
    return;
  }
  image.src = file.path;
  image.dataset.src = file.path;
  image.alt = `Handwritten diary scan: ${file.path.split('/').pop()}`;
  diaryCarousel.setIndicator();
}

$('#stills-left-diary').on('click', () => {
  diaryCarousel.decIndex();
  renderDiaryPage();
});

$('#stills-right-diary').on('click', () => {
  diaryCarousel.incIndex();
  renderDiaryPage();
});

renderDiaryPage();
