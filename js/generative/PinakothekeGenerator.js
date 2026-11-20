'use strict';

/**
 * PinakothekeGenerator - Manages 5 p5.js instance-mode sketches
 * that replace broken placeholder images with live generative art.
 *
 * Each sketch maps to a gallery section:
 *   photography → noise field
 *   digital     → vector geometry
 *   glitch      → pixel sort live
 *   generative  → flow particles (first card)
 *   generative  → fractal growth (second card)
 *
 * @global
 */
// eslint-disable-next-line no-unused-vars
class PinakothekeGenerator {
  constructor() {
    /** @type {Array<p5>} Active p5 instances */
    this.instances = [];
    /** @type {boolean} Whether the generator has been initialized */
    this.initialized = false;
    /** @type {IntersectionObserver|null} Visibility observer for pausing off-screen canvases */
    this.observer = null;

    // Color palette derived from ETCETER4_CONFIG + OGOD palettes
    this.palette = {
      primary: [255, 0, 255], // #ff00ff pinakotheke magenta
      accent1: [0, 255, 255], // cyan
      accent2: [255, 215, 0], // gold
      accent3: [65, 105, 225], // royal blue
      dark: [10, 10, 10],
    };
  }

  /**
   * Initialize all canvases inside a gallery container
   * @param {string} containerSelector - CSS selector for the gallery container
   */
  initialize(containerSelector) {
    if (this.initialized) {
      return;
    }

    if (typeof p5 === 'undefined') {
      return;
    }

    const container = document.querySelector(containerSelector);
    if (!container) {
      return;
    }

    const canvases = container.querySelectorAll('.pinakotheke-canvas');
    if (canvases.length === 0) {
      return;
    }

    // Set up IntersectionObserver to pause off-screen sketches
    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const idx = parseInt(
            /** @type {HTMLElement} */ (entry.target).dataset.sketchIndex,
            10
          );
          const instance = this.instances[idx];
          if (!instance) {
            return;
          }
          if (entry.isIntersecting) {
            instance.loop();
          } else {
            instance.noLoop();
          }
        });
      },
      { threshold: 0.1 }
    );

    const sketchMap = {
      noiseField: this._noiseField.bind(this),
      vectorForms: this._vectorForms.bind(this),
      pixelGlitch: this._pixelGlitch.bind(this),
      flowParticles: this._flowParticles.bind(this),
      fractalGrowth: this._fractalGrowth.bind(this),
    };

    canvases.forEach((/** @type {HTMLElement} */ canvas, index) => {
      const sketchName = canvas.dataset.sketch;
      const sketchFn = sketchMap[sketchName];
      if (!sketchFn) {
        return;
      }

      canvas.dataset.sketchIndex = String(index);

      try {
        const parent = canvas.parentElement;
        const instance = new p5(sketchFn(canvas), parent);
        this.instances.push(instance);
        this.observer.observe(canvas);

        // Record interaction
        if (typeof JourneyTracker !== 'undefined') {
          JourneyTracker.getInstance().recordInteraction(
            'pinakotheke',
            'sketch_viewed',
            { sketch: sketchName }
          );
        }
      } catch (err) {
        console.warn(
          `PinakothekeGenerator: sketch ${sketchName} failed:`,
          err.message
        );
        this.instances.push(null);
      }
    });

    this.initialized = true;
  }

  /**
   * Destroy all p5 instances and disconnect observer
   */
  destroy() {
    this.instances.forEach(instance => {
      if (instance) {
        try {
          instance.remove();
        } catch (_e) {
          // ignore cleanup errors
        }
      }
    });
    this.instances = [];
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.initialized = false;
  }

  // --- Sketch Factories ---
  // Each returns a function(canvasEl) that returns the p5 instance-mode sketch function

  /**
   * Perlin noise flow field with magenta gradient
   */
  _noiseField(canvasEl) {
    const pal = this.palette;
    return p => {
      let noiseScale = 0.02;

      p.setup = () => {
        const w = canvasEl.parentElement.clientWidth || 200;
        const h = canvasEl.parentElement.clientHeight || 200;
        const c = p.createCanvas(w, h);
        c.elt.classList.add('pinakotheke-canvas');
        if (canvasEl.parentNode.contains(canvasEl)) {
          canvasEl.remove();
        }
        p.frameRate(30);
        p.background(pal.dark[0], pal.dark[1], pal.dark[2]);
      };

      p.draw = () => {
        p.loadPixels();
        const t = p.frameCount * 0.005;
        for (let x = 0; x < p.width; x += 2) {
          for (let y = 0; y < p.height; y += 2) {
            const n = p.noise(x * noiseScale, y * noiseScale, t);
            const r = p.map(n, 0, 1, pal.dark[0], pal.primary[0]);
            const g = p.map(n, 0, 1, pal.dark[1], pal.primary[1] * 0.3);
            const b = p.map(n, 0, 1, pal.dark[2], pal.primary[2]);
            const idx = (y * p.width + x) * 4;
            p.pixels[idx] = r;
            p.pixels[idx + 1] = g;
            p.pixels[idx + 2] = b;
            p.pixels[idx + 3] = 255;
            // Fill the 2x2 block
            if (x + 1 < p.width) {
              const idx2 = idx + 4;
              p.pixels[idx2] = r;
              p.pixels[idx2 + 1] = g;
              p.pixels[idx2 + 2] = b;
              p.pixels[idx2 + 3] = 255;
            }
            if (y + 1 < p.height) {
              const idx3 = ((y + 1) * p.width + x) * 4;
              p.pixels[idx3] = r;
              p.pixels[idx3 + 1] = g;
              p.pixels[idx3 + 2] = b;
              p.pixels[idx3 + 3] = 255;
              if (x + 1 < p.width) {
                const idx4 = idx3 + 4;
                p.pixels[idx4] = r;
                p.pixels[idx4 + 1] = g;
                p.pixels[idx4 + 2] = b;
                p.pixels[idx4 + 3] = 255;
              }
            }
          }
        }
        p.updatePixels();
        noiseScale = 0.02 + p.sin(t * 0.5) * 0.005;
      };
    };
  }

  /**
   * Rotating geometric polygons with transparency layering
   */
  _vectorForms(canvasEl) {
    const pal = this.palette;
    return p => {
      p.setup = () => {
        const w = canvasEl.parentElement.clientWidth || 200;
        const h = canvasEl.parentElement.clientHeight || 200;
        const c = p.createCanvas(w, h);
        c.elt.classList.add('pinakotheke-canvas');
        if (canvasEl.parentNode.contains(canvasEl)) {
          canvasEl.remove();
        }
        p.frameRate(30);
        p.noFill();
      };

      p.draw = () => {
        p.background(pal.dark[0], pal.dark[1], pal.dark[2], 40);
        p.translate(p.width / 2, p.height / 2);
        const t = p.frameCount * 0.01;

        for (let i = 0; i < 5; i++) {
          const sides = 3 + i;
          const radius = 20 + i * 15 + p.sin(t + i) * 10;
          const rotation = t * (i % 2 === 0 ? 1 : -1) * 0.5;
          const alpha = p.map(i, 0, 4, 200, 80);

          p.push();
          p.rotate(rotation);
          p.stroke(
            pal.primary[0],
            pal.primary[1] + i * 30,
            pal.primary[2],
            alpha
          );
          p.strokeWeight(1.5);
          p.beginShape();
          for (let j = 0; j < sides; j++) {
            const angle = (p.TWO_PI / sides) * j - p.HALF_PI;
            p.vertex(p.cos(angle) * radius, p.sin(angle) * radius);
          }
          p.endShape(p.CLOSE);
          p.pop();
        }
      };
    };
  }

  /**
   * Live pixel-sort effect on generated noise
   */
  _pixelGlitch(canvasEl) {
    const pal = this.palette;
    return p => {
      p.setup = () => {
        const w = canvasEl.parentElement.clientWidth || 200;
        const h = canvasEl.parentElement.clientHeight || 200;
        const c = p.createCanvas(w, h);
        c.elt.classList.add('pinakotheke-canvas');
        if (canvasEl.parentNode.contains(canvasEl)) {
          canvasEl.remove();
        }
        p.frameRate(30);
        p.background(pal.dark[0]);
      };

      p.draw = () => {
        // Generate base noise pattern
        const t = p.frameCount * 0.02;
        p.loadPixels();
        for (let x = 0; x < p.width; x++) {
          for (let y = 0; y < p.height; y++) {
            const n = p.noise(x * 0.03, y * 0.03, t);
            const idx = (y * p.width + x) * 4;
            p.pixels[idx] = n * pal.primary[0];
            p.pixels[idx + 1] = n * 50;
            p.pixels[idx + 2] = n * pal.primary[2];
            p.pixels[idx + 3] = 255;
          }
        }

        // Column-based pixel sort (simplified version)
        const sortThreshold = 100 + p.sin(t) * 50;
        for (let x = 0; x < p.width; x += 3) {
          const column = [];
          for (let y = 0; y < p.height; y++) {
            const idx = (y * p.width + x) * 4;
            const brightness =
              p.pixels[idx] + p.pixels[idx + 1] + p.pixels[idx + 2];
            column.push({
              y,
              brightness,
              r: p.pixels[idx],
              g: p.pixels[idx + 1],
              b: p.pixels[idx + 2],
            });
          }

          // Sort segments above threshold
          let segStart = -1;
          for (let y = 0; y <= column.length; y++) {
            const above =
              y < column.length && column[y].brightness > sortThreshold;
            if (above && segStart === -1) {
              segStart = y;
            } else if (!above && segStart !== -1) {
              const segment = column.slice(segStart, y);
              segment.sort((a, b) => a.brightness - b.brightness);
              for (let s = 0; s < segment.length; s++) {
                const idx = ((segStart + s) * p.width + x) * 4;
                p.pixels[idx] = segment[s].r;
                p.pixels[idx + 1] = segment[s].g;
                p.pixels[idx + 2] = segment[s].b;
              }
              segStart = -1;
            }
          }
        }
        p.updatePixels();
      };
    };
  }

  /**
   * Particle system driven by curl noise
   */
  _flowParticles(canvasEl) {
    const pal = this.palette;
    return p => {
      const particles = [];
      const maxParticles = 150;

      p.setup = () => {
        const w = canvasEl.parentElement.clientWidth || 200;
        const h = canvasEl.parentElement.clientHeight || 200;
        const c = p.createCanvas(w, h);
        c.elt.classList.add('pinakotheke-canvas');
        if (canvasEl.parentNode.contains(canvasEl)) {
          canvasEl.remove();
        }
        p.frameRate(30);
        p.background(pal.dark[0], pal.dark[1], pal.dark[2]);

        for (let i = 0; i < maxParticles; i++) {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            prevX: 0,
            prevY: 0,
            speed: p.random(0.5, 2),
          });
        }
      };

      p.draw = () => {
        p.background(pal.dark[0], pal.dark[1], pal.dark[2], 15);
        const t = p.frameCount * 0.003;
        const noiseScale = 0.01;

        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          pt.prevX = pt.x;
          pt.prevY = pt.y;

          // Curl noise approximation
          const n1 = p.noise(pt.x * noiseScale, pt.y * noiseScale, t);
          const n2 = p.noise(
            pt.x * noiseScale + 100,
            pt.y * noiseScale + 100,
            t
          );
          const angle = n1 * p.TWO_PI * 2;
          const magnitude = n2 * pt.speed;

          pt.x += p.cos(angle) * magnitude;
          pt.y += p.sin(angle) * magnitude;

          // Wrap edges
          if (pt.x < 0) {
            pt.x = p.width;
            pt.prevX = pt.x;
          }
          if (pt.x > p.width) {
            pt.x = 0;
            pt.prevX = pt.x;
          }
          if (pt.y < 0) {
            pt.y = p.height;
            pt.prevY = pt.y;
          }
          if (pt.y > p.height) {
            pt.y = 0;
            pt.prevY = pt.y;
          }

          p.stroke(
            pal.primary[0] * n1,
            50 + n2 * 100,
            pal.primary[2] * (1 - n1),
            180
          );
          p.strokeWeight(1);
          p.line(pt.prevX, pt.prevY, pt.x, pt.y);
        }
      };
    };
  }

  /**
   * Recursive branching L-system with slow growth animation
   */
  _fractalGrowth(canvasEl) {
    const pal = this.palette;
    return p => {
      let maxDepth = 1;
      let growthTimer = 0;
      const maxGrowthDepth = 7;
      let baseAngle = p.PI / 6;

      p.setup = () => {
        const w = canvasEl.parentElement.clientWidth || 200;
        const h = canvasEl.parentElement.clientHeight || 200;
        const c = p.createCanvas(w, h);
        c.elt.classList.add('pinakotheke-canvas');
        if (canvasEl.parentNode.contains(canvasEl)) {
          canvasEl.remove();
        }
        p.frameRate(30);
      };

      const drawBranch = (len, depth) => {
        if (depth > maxDepth || len < 2) {
          return;
        }

        const t = p.frameCount * 0.01;
        const alpha = p.map(depth, 0, maxGrowthDepth, 255, 60);
        const sw = p.map(depth, 0, maxGrowthDepth, 3, 0.5);
        p.strokeWeight(sw);
        p.stroke(pal.primary[0], depth * 30, pal.primary[2], alpha);

        p.line(0, 0, 0, -len);
        p.translate(0, -len);

        const angle = baseAngle + p.sin(t + depth) * 0.1;

        p.push();
        p.rotate(angle);
        drawBranch(len * 0.7, depth + 1);
        p.pop();

        p.push();
        p.rotate(-angle);
        drawBranch(len * 0.7, depth + 1);
        p.pop();

        // Third branch for variety
        if (depth < 3) {
          p.push();
          p.rotate(angle * 0.3);
          drawBranch(len * 0.5, depth + 1);
          p.pop();
        }
      };

      p.draw = () => {
        p.background(pal.dark[0], pal.dark[1], pal.dark[2]);
        p.translate(p.width / 2, p.height);

        const trunkLen = p.height * 0.3;
        drawBranch(trunkLen, 0);

        // Slowly grow the tree
        growthTimer++;
        if (growthTimer % 60 === 0 && maxDepth < maxGrowthDepth) {
          maxDepth++;
        }

        // Reset cycle
        if (maxDepth >= maxGrowthDepth && growthTimer % 300 === 0) {
          maxDepth = 1;
          growthTimer = 0;
        }

        baseAngle = p.PI / 6 + p.sin(p.frameCount * 0.005) * 0.05;
      };
    };
  }
}
