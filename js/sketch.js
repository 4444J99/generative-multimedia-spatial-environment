'use strict';

/**
 * Active p5 instance. `id` tracks which canvas is showing and
 * `_renderer.GL` is the WebGL context the vendored p5 build exposes
 * (not declared in @types/p5).
 * @type {p5 & { id?: string, _renderer?: { GL?: WebGLRenderingContext | null } }}
 */
let myp5;
let visionImage;
let isSketchTransitioning = false;
const footerHeight = Number($('footer').css('height').replace('px', ''));

/**
 * Flag to track if current sketch uses WebGL mode
 * @type {boolean}
 */
let isWebGLSketch = false;

/**
 * Safely removes the current p5 instance
 * Uses a flag to prevent race conditions during canvas transitions
 * Handles WebGL context cleanup for proper resource release
 * @returns {Promise<void>}
 */
function safeRemoveP5() {
  return new Promise(resolve => {
    if (myp5 && !isSketchTransitioning) {
      isSketchTransitioning = true;
      try {
        // Force WebGL context loss for clean handoff
        // This prevents memory leaks and context limit issues
        if (isWebGLSketch && myp5._renderer && myp5._renderer.GL) {
          const gl = myp5._renderer.GL;
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) {
            ext.loseContext();
          }
        }
        myp5.remove();
      } catch (err) {
        console.warn('P5.js removal warning:', err.message);
      }
      myp5 = undefined;
      isWebGLSketch = false;
      // Small delay to ensure DOM cleanup completes
      setTimeout(() => {
        isSketchTransitioning = false;
        resolve();
      }, 50);
    } else {
      resolve();
    }
  });
}

/**
 * Switches to a new p5 canvas with safe cleanup
 * @param {(p: p5) => void} canvasFunc - The p5 sketch function
 * @param {string} canvasId - Identifier for the canvas type
 * @param {boolean} [useWebGL=false] - Whether the sketch uses WebGL mode
 */
function switchCanvas(canvasFunc, canvasId, useWebGL = false) {
  if (isSketchTransitioning) {
    return;
  }

  if ($('#menuPageCanvasWrapper canvas').is('#defaultCanvas1')) {
    removeCanvas();
  }

  if (!myp5) {
    try {
      myp5 = new p5(
        canvasFunc,
        document.getElementById('menuPageCanvasWrapper')
      );
      myp5.id = canvasId;
      isWebGLSketch = useWebGL;
    } catch (err) {
      console.error('P5.js canvas creation error:', err.message);
    }
  } else if (myp5.id !== canvasId) {
    safeRemoveP5().then(() => {
      try {
        myp5 = new p5(
          canvasFunc,
          document.getElementById('menuPageCanvasWrapper')
        );
        myp5.id = canvasId;
        isWebGLSketch = useWebGL;
      } catch (err) {
        console.error('P5.js canvas creation error:', err.message);
      }
    });
  }
}

/**
 * Cleanup all p5 resources - call on page exit
 * Properly releases WebGL context if applicable
 */
function cleanupSketch() {
  if (myp5) {
    try {
      // Force WebGL context loss for clean resource release
      if (isWebGLSketch && myp5._renderer && myp5._renderer.GL) {
        const gl = myp5._renderer.GL;
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) {
          ext.loseContext();
        }
      }
      myp5.remove();
    } catch (err) {
      console.warn('P5.js cleanup warning:', err.message);
    }
    myp5 = undefined;
    isWebGLSketch = false;
  }
  isSketchTransitioning = false;
}

/*
 *
 * The listeners for the canvas change
 *
 */

/**
 * Play hover sound for menu items
 * @private
 */
function playMenuHoverSound() {
  if (typeof UISounds !== 'undefined' && UISounds.isEnabled()) {
    UISounds.hover(0.3);
  }
}

/**
 * Play click sound for menu items
 * @private
 */
function playMenuClickSound() {
  if (typeof UISounds !== 'undefined' && UISounds.isEnabled()) {
    UISounds.click(0.5);
  }
}

$('#menu #toWordsPage').mouseenter(() => {
  playMenuHoverSound();
  switchCanvas(wordsCanvas, 'words');
});

$('#menu #toSoundPage').mouseenter(() => {
  playMenuHoverSound();
  // Use WebGL audio-reactive shader if available, otherwise fall back to soundCanvas
  if (typeof audioReactiveShaderSketch !== 'undefined') {
    switchCanvas(audioReactiveShaderSketch, 'audioReactive', true);
  } else {
    switchCanvas(soundCanvas, 'sound');
  }
});

$('#menu #toVisionPage').mouseenter(() => {
  playMenuHoverSound();
  switchCanvas(visionCanvas, 'vision');
});

$('#menu #toInfoPage').mouseenter(() => {
  playMenuHoverSound();
  switchCanvas(infoCanvas, 'words');
});

// Add click sounds to menu items
$('#menu a').on('click', playMenuClickSound);

// // for vision canvas
// $(document).ready(function () {
//     // find the storage
//     visionImage = document.getElementById("imageStorage");

//     // load image for vision canvas & save it der
//     visionImage.src = 'img/photos/glitchpr0n/glitch26.png';
// });

/*
 *
 * The Sounds Canvas
 * - These canvases below appear when you hover over their respective anchor
 * - tags in the menu section of the site
 *
 */

const soundCanvas = function (p) {
  const fr = 14;
  const bounds = p.createVector(0, p.windowWidth);
  const leftMargin = 10;
  const charSize = p.createVector(20, 20);
  let noisesWidth = p.windowWidth / charSize.x;
  let noisesHeight = (p.windowHeight - footerHeight) / charSize.y;
  let noisesTotal = Math.floor(noisesWidth * noisesHeight);
  const ySeperator = 25;
  const noises = [];
  let color = {};

  function Noise() {
    this.character = getCharacter();
    this.location = p.createVector(leftMargin, 10);
    this.color = getColor();
  }

  Noise.prototype.update = function () {
    this.location.add(1, p.random());
  };

  function getCharacter() {
    const weight = p.random();

    if (weight < 0.5) {
      return '.';
    } else {
      return ':';
    }
  }

  function getColor() {
    const weight = p.random();

    if (weight < 0.1) {
      return color.cyan;
    } else if (weight < 0.3) {
      return color.yellow;
    } else if (weight < 0.75) {
      return color.black;
    } else {
      return color.magenta;
    }
  }

  Noise.prototype.setLocation = function (previousNoise) {
    if (previousNoise !== undefined) {
      if (previousNoise.location.x + charSize.x < p.windowWidth) {
        // creates row
        this.location = p5.Vector.add(
          previousNoise.location,
          p.createVector(charSize.x, 0)
        );
      } else {
        // creates new column
        this.location = p.createVector(
          leftMargin,
          previousNoise.location.y + ySeperator
        );
      }
    }
  };

  Noise.prototype.setColor = function (noiz) {
    if (noiz !== undefined) {
      this.color = noiz.color;
    }
  };

  /*
   *
   * Setup
   *
   */

  p.setup = function () {
    try {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.frameRate(fr);

      color = {
        cyan: p.color('cyan'),
        yellow: p.color('yellow'),
        black: p.color('black'),
        magenta: p.color('magenta'),
      };

      p.textSize(32);
      p.textAlign(p.CENTER, p.CENTER);

      // populate the noise
      for (let i = 0; i < noisesTotal; i++) {
        noises.push(new Noise());
        noises[i].setLocation(noises[i - 1]);
      }
    } catch (err) {
      console.error('Sound canvas setup error:', err.message);
    }
  };

  /*
   *
   * Drawing & Dynamics
   *
   */

  p.draw = function () {
    try {
      p.background(255, 55, 100);
      for (let i = 0; i < noisesTotal; i++) {
        const currentNoise = noises[i];
        if (currentNoise && currentNoise.location) {
          p.fill(getColor());
          p.text(
            getCharacter(),
            currentNoise.location.x,
            currentNoise.location.y
          );
        }
      }
    } catch (err) {
      console.error('Sound canvas draw error:', err.message);
    }
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    noisesWidth = p.windowWidth / charSize.x;
    noisesHeight = p.windowHeight / charSize.y;
    noisesTotal = Math.floor(noisesWidth * noisesHeight);

    // populate the noise
    // noises = [];
    // for (var i = 0; i < noisesTotal; i++) {
    //     noises.push(new Noise());
    //     noises[i].setLocation(noises[i-1]);
    // }
  };
};

/*
 *
 * The Words Canvas
 *
 */

// Render two distinct emotional clouds that repel one another and keep their vocabularies separate.
const wordsCanvas = function (p) {
  'use strict';

  const center = p.createVector(
    p.windowWidth / 2,
    (p.windowHeight - footerHeight) / 2
  );
  const bounds = p.createVector(700, 300);
  const textBounds = p.createVector(12, 30);
  const rate = p.createVector(0.008, 0.008);
  const bezierRate = 1;
  const wordCloud = [];

  const emotionGroups = [
    {
      name: 'solace',
      emotions: [
        'forgiveness',
        'growth',
        'life',
        'love',
        'trust',
        'hope',
        'good',
        'kind',
        'return',
        'rain',
        'clouds',
        'taste',
        'society',
        'common',
        'capture',
        'forever',
        'purchase',
        'stakeholder',
      ],
      members: [],
      offset: undefined,
      color: undefined,
      spread: 220,
    },
    {
      name: 'discord',
      emotions: [
        'death',
        'callback',
        'empty',
        'disgust',
        'sell',
        'buy',
        'fear',
        'remorse',
        'forget',
        'market',
        'AI',
        'numbers',
        'scene',
        'personality',
        'budget',
        'pain',
        'depression',
        'hate',
        'constant',
        'repetition',
        'space',
        'rape',
        'AIDS',
        'minotaur',
        'gone',
        'end',
        'joust',
        'fist',
        'KPI',
      ],
      members: [],
      offset: undefined,
      color: undefined,
      spread: 220,
    },
  ];

  function Word(text, group) {
    this.group = group;
    this.bezierTime = p.random();
    this.bezierReverse = Math.random() >= 0.5;
    this.location = p.createVector(0, 0);
    this.text = text;
    this.textSize = Math.floor(p.random(18, 28) + 1);
    this.noiseTime = p.createVector(p.random(-10, 10), p.random(-10, 10));
    this._resetLocation();
  }

  Word.prototype._resetLocation = function () {
    const offset = this.group.offset;
    const localSpread = this.group.spread;
    const randomOffset = p.createVector(
      p.random(-localSpread, localSpread),
      p.random(-localSpread, localSpread)
    );
    this.location = p5.Vector.add(offset, randomOffset);
  };

  Word.prototype._2DRandomWalk = function () {
    const _nx = p.noise(this.noiseTime.x);
    const _ny = p.noise(this.noiseTime.y);
    this.noiseTime.add(rate);

    const _x = p.map(_nx, 0, 1, -bounds.x, bounds.x) + this.group.offset.x;
    const _y = p.map(_ny, 0, 1, -bounds.y, bounds.y) + this.group.offset.y;
    this.location.set(_x, _y);
  };

  Word.prototype.update = function () {
    this._2DRandomWalk();
    this._updateBezier();
    this._enforceBounds();
  };

  Word.prototype._updateBezier = function () {
    const size = p.map(
      getBezierPoint(this.bezierTime),
      0,
      1,
      textBounds.x,
      textBounds.y
    );

    if (this.bezierReverse === true) {
      if (this.bezierTime < 0) {
        this.bezierTime += bezierRate;
        this.bezierReverse = false;
      } else {
        this.bezierTime -= bezierRate;
      }
    } else {
      // bezierReverse = false
      if (this.bezierTime < 1) {
        this.bezierTime += bezierRate;
      } else {
        this.bezierTime -= bezierRate;
        this.bezierReverse = true;
      }
    }

    this.textSize = size;
  };

  Word.prototype._enforceBounds = function () {
    const spread = this.group.spread;
    this.location.x = p.constrain(
      this.location.x,
      this.group.offset.x - spread,
      this.group.offset.x + spread
    );
    this.location.y = p.constrain(
      this.location.y,
      this.group.offset.y - bounds.y,
      this.group.offset.y + bounds.y
    );
  };

  Word.prototype.applyRepulsion = function (force) {
    this.location.add(force);
  };

  function buildWordCloud() {
    wordCloud.length = 0;
    emotionGroups.forEach((group, index) => {
      const xOffset = index === 0 ? -bounds.x / 3 : bounds.x / 3;
      group.offset = p.createVector(xOffset, 0);
      group.color = index === 0 ? p.color(30, 120, 200) : p.color(180, 50, 60);
      group.members = [];

      group.emotions.forEach(emotion => {
        const word = new Word(emotion, group);
        wordCloud.push(word);
        group.members.push(word);
      });
    });
  }

  function calculateGroupCenters() {
    emotionGroups.forEach(group => {
      if (group.members.length === 0) {
        group.center = p.createVector(group.offset.x, group.offset.y);
        return;
      }

      const center = p.createVector(0, 0);
      group.members.forEach(member => {
        center.add(member.location);
      });
      center.div(group.members.length);
      group.center = center;
    });
  }

  function applyGroupRepulsion() {
    if (emotionGroups.length < 2) {
      return;
    }

    for (let i = 0; i < emotionGroups.length; i++) {
      const group = emotionGroups[i];
      const otherGroup = emotionGroups[(i + 1) % emotionGroups.length];
      let direction = p5.Vector.sub(group.center, otherGroup.center);

      if (direction.magSq() === 0) {
        direction = p.createVector(p.random(-1, 1), p.random(-1, 1));
      }

      const distance = direction.mag();
      const strength = p.map(distance, 0, bounds.x * 2, 3, 0.4, true);
      direction.normalize().mult(strength);

      group.members.forEach(member => {
        member.applyRepulsion(direction);
        member._enforceBounds();
      });
    }
  }

  function resolveWordFont() {
    const preferred = 'Bodoni MT';
    const fallbacks = ['Garamond', 'Georgia', 'serif'];

    try {
      if (
        document &&
        document.fonts &&
        typeof document.fonts.check === 'function'
      ) {
        if (document.fonts.check(`12px "${preferred}"`)) {
          return preferred;
        }
        for (let i = 0; i < fallbacks.length; i++) {
          if (document.fonts.check(`12px "${fallbacks[i]}"`)) {
            return fallbacks[i];
          }
        }
      }
    } catch (err) {
      // Accessing document.fonts can throw in some environments – fall back to defaults.
    }

    return fallbacks[fallbacks.length - 1];
  }

  /*
   *
   * Setup
   *
   */

  p.setup = function () {
    try {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.textFont(resolveWordFont());
      buildWordCloud();
    } catch (err) {
      console.error('Words canvas setup error:', err.message);
    }
  };

  /*
   *
   * Drawing & Dynamics
   *
   */

  p.draw = function () {
    try {
      p.background(1);
      p.background(155, 155, 155);
      p.translate(center.x, center.y);

      wordCloud.forEach(currentWord => {
        if (currentWord) {
          currentWord.update();
        }
      });

      calculateGroupCenters();
      applyGroupRepulsion();

      wordCloud.forEach(currentWord => {
        if (currentWord && currentWord.group && currentWord.location) {
          p.fill(currentWord.group.color);
          p.textSize(currentWord.textSize);
          p.text(
            currentWord.text,
            currentWord.location.x,
            currentWord.location.y
          );
        }
      });
    } catch (err) {
      console.error('Words canvas draw error:', err.message);
    }
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    center.set(p.windowWidth / 2, (p.windowHeight - footerHeight) / 2);
    emotionGroups.forEach((group, index) => {
      const xOffset = index === 0 ? -bounds.x / 3 : bounds.x / 3;
      group.offset.set(xOffset, 0);
    });
  };
};

/*
 *
 * The Vision Canvas
 *
 */

const visionCanvas = function (p) {
  const heightOfCanvas = p.windowHeight - footerHeight;
  const imageSlices = [];
  const totalSlices = 5;
  const sliceHeightBigRatio = heightOfCanvas * (70 / 100);
  const sliceHeightSmallRatio = heightOfCanvas * (0.2 / 1);
  const topSpeed = 5;
  let pg;
  let img;

  function ImageSlice(heightWeight) {
    let height;
    let heightOffset;

    if (heightWeight < 0.333) {
      height =
        heightOfCanvas - (sliceHeightBigRatio / 6 + sliceHeightBigRatio / 6);
      heightOffset = sliceHeightBigRatio / 6;
    } else if (heightWeight < 0.666) {
      height = heightOfCanvas - (sliceHeightBigRatio + sliceHeightBigRatio);
      heightOffset = sliceHeightBigRatio;
    } else {
      height = heightOfCanvas - (sliceHeightSmallRatio + sliceHeightSmallRatio);
      heightOffset = sliceHeightSmallRatio;
    }

    // the graphics needed for the square
    const sliceWidth = 75;
    this.slice = p.createGraphics(sliceWidth, height);
    this.slice.background(0, 0, 0);
    this.slice.fill(0, 0, 0);
    this.slice.rect(0, 0, this.slice.width, this.slice.height);

    this.reverse = false; // goes backwards
    this.acceleration = p.createVector(0.03, 0);
    this.location = p.createVector(-sliceWidth + p.random(0, 0), heightOffset); // start before the line
    this.velocity = p.createVector(p.random(1, 10), 0);
    this.time = p.createVector(p.random(-10, 10), p.random(-10, 10));
  }

  ImageSlice.prototype.update = function () {
    if (this.reverse === false) {
      this.velocity.add(this.acceleration);
      if (this.velocity.x >= topSpeed) {
        this.reverse = true;
      }
    } else {
      // if (this.reverse === true)
      if (this.velocity.x >= -topSpeed) {
        this.velocity.sub(this.acceleration);
      } else {
        this.reverse = false;
      }
    }

    this.location.add(this.velocity);
  };

  ImageSlice.prototype.checkEdges = function () {
    // acceleration to the right (left to right directionality)
    if (this.reverse === false) {
      // are you past the right edge?
      if (this.location.x > p.windowWidth) {
        // are you going right?
        if (this.velocity.x > 0) {
          this.location.x = p.random(1000, 0); // cool, go back to the other side
        }

        // are you going left? (coming out of a reverse)
        // else if (this.velocity.x < 0) { } // do nothing!
      }

      // are you past the left edge?
      else if (this.location.x < 0) {
        // are you going left?
        if (this.velocity.x < 0) {
          this.location.x = p.random(p.windowWidth, p.windowWidth + 1000); // go back to the right side
        }

        // are you going right? (coming out of a reverse)
        // else if (this.velocity.x > 0) { }  // do nothing!
      }
    }

    // acceleration to the left (right to left directionality)
    else {
      if (this.location.x > p.windowWidth) {
        if (this.velocity.x > 0) {
          this.location.x = p.random(0, 0);
        }
      } else if (this.location.x < 0) {
        // left side
        if (this.velocity.x <= 0) {
          this.location.x = p.random(p.windowWidth, p.windowWidth + 1000);
        }
      }
    }
  };

  /*
   *
   * Setup
   *
   */

  p.preload = function () {};

  p.setup = function () {
    try {
      p.createCanvas(p.windowWidth, p.windowHeight);

      // create the image slices
      for (let i = 0; i < totalSlices; i++) {
        imageSlices.push(new ImageSlice(p.random()));
        imageSlices[i].location.sub(0, 0);
      }
    } catch (err) {
      console.error('Vision canvas setup error:', err.message);
    }
  };

  /*
   *
   * Drawing & Dynamics
   *
   */

  p.draw = function () {
    try {
      p.background(120, 255, 10);
      p.rect(0, 0, 0, 0); // this acts as a reset for some reason
      p.drawingContext.globalCompositeOperation = 'difference';

      // draw in all slices
      for (let i = 0; i < totalSlices; i++) {
        const currentSlice = imageSlices[i];
        if (currentSlice && currentSlice.slice && currentSlice.location) {
          currentSlice.update();
          currentSlice.checkEdges();
          currentSlice.slice.background(255);
          p.image(
            currentSlice.slice,
            currentSlice.location.x,
            currentSlice.location.y
          );
        }
      }
      p.drawingContext.globalCompositeOperation = 'overlay';
    } catch (err) {
      console.error('Vision canvas draw error:', err.message);
    }
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
};

/*
 *
 * The Info Canvas
 *
 */

const infoCanvas = function (p) {
  const forces = {};
  const lines = [];
  const maxLines = 50;
  const lineLengthBounds = p.createVector(0, 0);

  function Line() {
    this.location = p.createVector(
      p.random(0, p.windowWidth),
      p.random(0, p.windowHeight)
    );
    this.startEnd = p.createVector(0, -50);
    this.dimensions = p.createVector(100, 50);
    this.color = p.color(255);
    this.velocity = p.createVector(0.01, 0.5);
    this.acceleration = p.createVector(0, -5);
    this.angle = -25;
  }

  Line.prototype.update = function () {
    // var size = p.map(getBezierPoint(this.bezierTime), 0, 1, textBounds.x, textBounds.y);
    // this.velocity = p.map(hey, 0, 1, startEnd.x, this.startEnd.y); // maps the velocity to the curve

    // this.velocity.add(this.acceleration);
    this.location.add(this.velocity);
    this.velocity.sub(0.01, 0);
  };

  Line.prototype.display = function () {
    p.ellipse(
      this.location.x,
      this.location.y,
      this.dimensions.x,
      this.dimensions.y
    );
  };

  Line.prototype.checkEdges = function () {
    for (let i = 0; i < 2; i++) {
      if (this.location[i].x > p.windowWidth) {
        this.location[i].x = p.windowWidth;
        this.velocity.x *= -1;
      } else if (this.location[i].x < 0) {
        this.velocity.x *= -1;
        this.location[i].x = 0;
      }

      if (this.location[i].y > p.windowHeight - footerHeight) {
        this.velocity.y *= -1; // git down brahmen, git down.
        this.location[i].y = p.windowHeight - footerHeight;
      }
    }
  };

  /*
   *
   * Setup
   *
   */
  p.preload = function () {};

  p.setup = function () {
    try {
      p.createCanvas(p.windowWidth, p.windowHeight);

      for (let i = 0; i < 20; i++) {
        lines.push(new Line());
      }
    } catch (err) {
      console.error('Info canvas setup error:', err.message);
    }
  };

  /*
   *
   * Drawing & Dynamics
   *
   */

  p.draw = function () {
    try {
      p.background(p.color('rgba(50, 100, 205, 1.00)'));

      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          lines[i].update();
          lines[i].display();
        }
      }
    } catch (err) {
      console.error('Info canvas draw error:', err.message);
    }
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  p.keyPressed = function () {
    if (p.keyCode === p.UP_ARROW) {
      // Handle up arrow key
    }

    if (p.keyCode === p.DOWN_ARROW) {
      // Handle down arrow key
    }
  };

  p.mousePressed = function () {};
};

/*
 *
 * Other Utility Functions
 *
 */

// Linear Random Value Generator
function randomMonteCarlo(max, exponent) {
  while (true) {
    const r1 = Math.random();
    const probability = Math.pow(r1, exponent);
    const r2 = Math.random();

    if (r2 < probability) {
      return r1 * max;
    }
  }
}

function removeCanvas() {
  $('#menuPageCanvasWrapper canvas').remove();
}

// NOTE: two global-mode helpers used to live here — _2DRandomWalk(vector)
// and getRandomColor() — but they referenced the p5 instance `p` and the
// words-canvas locals `rate` / `bounds`, none of which exist at top level
// in instance mode, so neither could ever run. The live implementations
// are Word.prototype._2DRandomWalk (inside wordsCanvas, closed over its own
// p/rate/bounds) and the inner getColor() (inside soundCanvas). The dead
// duplicates were removed when type-checking was added (organvm-engine
// #60); they had zero callers anywhere in the repo.

function getBezierPoint(t) {
  /*
   * This was an idea taken from here:
   * http://math.stackexchange.com/questions/26846/is-there-an-explicit-form-for-cubic-b%C3%A9zier-curves
   *
   * This is the function:
   * y = u0(1−x^3) + 3*u1*(1−x^2)*x + 3*u2*(1−x)*x^2 + u3*x^3
   *        A             B                 C             D
   *
   * @param {Number} t - time, or position in easing
   *
   */

  if (t > 1) {
    t = 1;
  } else if (t < 0) {
    t = 0;
  }

  const easeInCurve = { u0: 0, u1: 0.05, u2: 0.25, u3: 1 };

  const curve = easeInCurve;

  // var A = curve.u0 * (1 - Math.pow(t, 3)) // don't need to do this since u0 = 0
  const B = 3 * curve.u1 * (1 - Math.pow(t, 2)) * t;
  const C = 3 * curve.u2 * (1 - t) * Math.pow(t, 2);
  const D = curve.u3 * Math.pow(t, 3);

  return B + C + D; // + A
}

function curveInAndOut(x) {
  const z = 4,
    h = 0.5,
    j = 2,
    k = 1;

  return -z * Math.pow(x - h, j) + k;
}
