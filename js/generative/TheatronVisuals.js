'use strict';

/**
 * TheatronVisuals - p5.js generative visual system for performance cards
 * Replaces iframe video embeds with live performance-like sketches.
 *
 * Sketch types:
 *   liveWaveform   — Simulated audio waveform visualization
 *   particleStorm  — Dense particle system responding to noise
 *   modularPatch   — Connected nodes with pulsing signal paths
 *   rehearsalGhost — Ghostly figure outlines with motion blur
 *
 * Follows PinakothekeGenerator pattern (p5 instance mode).
 *
 * @global
 */
// eslint-disable-next-line no-unused-vars
class TheatronVisuals {
  constructor() {
    /** @type {boolean} */
    this.initialized = false;
    /** @type {p5|null} Active p5 instance */
    this.activeInstance = null;
    /** @type {string|null} Active sketch name */
    this.activeSketch = null;
    /** @type {HTMLElement|null} Container element */
    this.container = null;

    // Theatron color palette
    this.palette = {
      purple: [128, 0, 128],
      violet: [199, 21, 133],
      dark: [15, 15, 20],
      accent: [200, 100, 255],
    };
  }

  /**
   * Initialize the visual system
   * @param {string} containerSelector - CSS selector for the chamber content area
   */
  initialize(containerSelector) {
    if (this.initialized) {
      return;
    }

    const chamber = document.querySelector(containerSelector);
    if (!chamber) {
      return;
    }

    this.container = chamber.querySelector('.aspect-ratio--object');
    if (!this.container) {
      return;
    }

    this.initialized = true;
  }

  /**
   * Load and display a specific sketch in the player area
   * @param {string} sketchName - One of: liveWaveform, particleStorm, modularPatch, rehearsalGhost
   */
  loadSketch(sketchName) {
    // Destroy current sketch if any
    this._destroyActiveSketch();

    if (typeof p5 === 'undefined') {
      this.container.innerHTML =
        '<p class="f4 o-50" style="color: #da70d6">p5.js not available</p>';
      return;
    }

    this.activeSketch = sketchName;
    this.container.innerHTML = '';
    this.container.classList.add('theatron-sketch-active');

    const sketchFn = this._getSketchFunction(sketchName);
    if (!sketchFn) {
      return;
    }

    this.activeInstance = new p5(sketchFn, this.container);

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'theatron',
        'visual_generated',
        { sketch: sketchName }
      );
    }
  }

  /**
   * Get the p5 sketch function for a given name
   * @param {string} name
   * @returns {((p: p5) => void) | null}
   */
  _getSketchFunction(name) {
    const palette = this.palette;

    const sketches = {
      liveWaveform: p => {
        const waves = [];
        const waveCount = 5;

        p.setup = () => {
          const w = p.min(p.windowWidth, 960);
          const h = Math.round((w * 9) / 16);
          p.createCanvas(w, h);
          p.noFill();

          for (let i = 0; i < waveCount; i++) {
            waves.push({
              offset: i * 0.3,
              amplitude: 0.15 + i * 0.05,
              speed: 0.02 + i * 0.005,
              alpha: 200 - i * 30,
            });
          }
        };

        p.draw = () => {
          p.background(...palette.dark, 40);

          waves.forEach(wave => {
            p.stroke(
              p.lerpColor(
                p.color(...palette.purple),
                p.color(...palette.violet),
                wave.offset / 1.5
              )
            );
            p.strokeWeight(2);

            p.beginShape();
            for (let x = 0; x < p.width; x += 3) {
              const nx = x / p.width;
              const t = p.frameCount * wave.speed;
              const y =
                p.height / 2 +
                p.sin(nx * p.TWO_PI * 3 + t + wave.offset) *
                  p.height *
                  wave.amplitude *
                  (0.5 + 0.5 * p.sin(t * 0.3 + wave.offset)) +
                p.noise(nx * 4, t * 0.5, wave.offset) * 30 -
                15;
              p.vertex(x, y);
            }
            p.endShape();
          });

          // Center frequency bar
          const barHeight =
            p.height * 0.3 * (0.5 + 0.5 * p.sin(p.frameCount * 0.05));
          p.noStroke();
          p.fill(...palette.accent, 30);
          p.rect(p.width / 2 - 1, p.height / 2 - barHeight / 2, 2, barHeight);
        };
      },

      particleStorm: p => {
        const particles = [];
        const maxParticles = 200;

        p.setup = () => {
          const w = p.min(p.windowWidth, 960);
          const h = Math.round((w * 9) / 16);
          p.createCanvas(w, h);

          for (let i = 0; i < maxParticles; i++) {
            particles.push({
              x: p.random(p.width),
              y: p.random(p.height),
              vx: 0,
              vy: 0,
              size: p.random(1, 4),
              life: p.random(0.5, 1),
            });
          }
        };

        p.draw = () => {
          p.background(...palette.dark, 25);
          const t = p.frameCount * 0.005;

          particles.forEach(pt => {
            const angle = p.noise(pt.x * 0.003, pt.y * 0.003, t) * p.TWO_PI * 2;
            const speed = p.noise(pt.x * 0.005, pt.y * 0.005, t + 100) * 3;

            pt.vx = p.lerp(pt.vx, p.cos(angle) * speed, 0.1);
            pt.vy = p.lerp(pt.vy, p.sin(angle) * speed, 0.1);
            pt.x += pt.vx;
            pt.y += pt.vy;

            // Wrap around
            if (pt.x < 0) {
              pt.x = p.width;
            }
            if (pt.x > p.width) {
              pt.x = 0;
            }
            if (pt.y < 0) {
              pt.y = p.height;
            }
            if (pt.y > p.height) {
              pt.y = 0;
            }

            const col = p.lerpColor(
              p.color(...palette.purple),
              p.color(...palette.violet),
              p.noise(pt.x * 0.01, pt.y * 0.01)
            );
            col.setAlpha(pt.life * 200);
            p.noStroke();
            p.fill(col);
            p.circle(pt.x, pt.y, pt.size);
          });
        };
      },

      modularPatch: p => {
        const nodes = [];
        const connections = [];
        const nodeCount = 8;

        p.setup = () => {
          const w = p.min(p.windowWidth, 960);
          const h = Math.round((w * 9) / 16);
          p.createCanvas(w, h);

          // Create nodes in a roughly circular layout
          for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * p.TWO_PI;
            const radius = p.min(p.width, p.height) * 0.3;
            nodes.push({
              x: p.width / 2 + p.cos(angle) * radius + p.random(-30, 30),
              y: p.height / 2 + p.sin(angle) * radius + p.random(-20, 20),
              radius: p.random(8, 16),
              phase: p.random(p.TWO_PI),
              freq: p.random(0.02, 0.06),
            });
          }

          // Create connections between neighboring and some random nodes
          for (let i = 0; i < nodeCount; i++) {
            connections.push({ from: i, to: (i + 1) % nodeCount });
            if (p.random() < 0.4) {
              const target = p.floor(p.random(nodeCount));
              if (target !== i) {
                connections.push({ from: i, to: target });
              }
            }
          }
        };

        p.draw = () => {
          p.background(...palette.dark);
          const t = p.frameCount;

          // Draw connections with traveling signal pulses
          connections.forEach(conn => {
            const a = nodes[conn.from];
            const b = nodes[conn.to];

            // Cable line
            p.stroke(...palette.purple, 60);
            p.strokeWeight(1);
            p.line(a.x, a.y, b.x, b.y);

            // Traveling pulse
            const pulsePos = (t * 0.02 + conn.from * 0.3) % 1;
            const px = p.lerp(a.x, b.x, pulsePos);
            const py = p.lerp(a.y, b.y, pulsePos);
            const pulseSize = 3 + p.sin(t * 0.1 + conn.from) * 2;
            p.noStroke();
            p.fill(...palette.accent, 180);
            p.circle(px, py, pulseSize);
          });

          // Draw nodes
          nodes.forEach(node => {
            const pulse = 0.5 + 0.5 * p.sin(t * node.freq + node.phase);

            // Glow
            p.noStroke();
            p.fill(...palette.violet, pulse * 40);
            p.circle(node.x, node.y, node.radius * 3);

            // Core
            p.fill(
              p.lerp(palette.purple[0], palette.accent[0], pulse),
              p.lerp(palette.purple[1], palette.accent[1], pulse),
              p.lerp(palette.purple[2], palette.accent[2], pulse),
              200
            );
            p.circle(node.x, node.y, node.radius);

            // Inner dot
            p.fill(255, 255, 255, pulse * 150);
            p.circle(node.x, node.y, 3);
          });
        };
      },

      rehearsalGhost: p => {
        const trails = [];
        const trailCount = 3;

        p.setup = () => {
          const w = p.min(p.windowWidth, 960);
          const h = Math.round((w * 9) / 16);
          p.createCanvas(w, h);

          for (let i = 0; i < trailCount; i++) {
            trails.push({
              points: [],
              offset: i * 2,
              speed: 0.008 + i * 0.003,
            });
          }
        };

        p.draw = () => {
          p.background(...palette.dark, 15);
          const t = p.frameCount;

          trails.forEach(trail => {
            // Generate ghostly figure point (simplified body outline)
            const centerX =
              p.width / 2 +
              p.sin(t * trail.speed + trail.offset) * p.width * 0.2;
            const centerY = p.height * 0.5;

            // Head
            const headY = centerY - p.height * 0.2;
            // Shoulders
            const shoulderSpread = 40 + p.sin(t * 0.03 + trail.offset) * 10;

            const ghost = [
              { x: centerX, y: headY - 20 }, // top of head
              { x: centerX + 15, y: headY }, // right head
              { x: centerX + shoulderSpread, y: centerY - p.height * 0.1 }, // right shoulder
              {
                x: centerX + shoulderSpread * 0.8,
                y: centerY + p.height * 0.1,
              }, // right hip
              { x: centerX + 20, y: centerY + p.height * 0.25 }, // right leg
              { x: centerX, y: centerY + p.height * 0.28 }, // feet center
              { x: centerX - 20, y: centerY + p.height * 0.25 }, // left leg
              {
                x: centerX - shoulderSpread * 0.8,
                y: centerY + p.height * 0.1,
              }, // left hip
              { x: centerX - shoulderSpread, y: centerY - p.height * 0.1 }, // left shoulder
              { x: centerX - 15, y: headY }, // left head
            ];

            // Store trail history
            trail.points.push(ghost);
            if (trail.points.length > 20) {
              trail.points.shift();
            }

            // Draw trail history (ghosting effect)
            trail.points.forEach((pts, frameIdx) => {
              const alpha = (frameIdx / trail.points.length) * 100;
              const col = p.lerpColor(
                p.color(...palette.purple),
                p.color(...palette.violet),
                trail.offset / (trailCount * 2)
              );
              col.setAlpha(alpha);
              p.stroke(col);
              p.strokeWeight(1.5);
              p.noFill();

              p.beginShape();
              pts.forEach(pt => p.curveVertex(pt.x, pt.y));
              // Close the shape by repeating first points
              if (pts.length > 0) {
                p.curveVertex(pts[0].x, pts[0].y);
                p.curveVertex(pts[1].x, pts[1].y);
              }
              p.endShape(p.CLOSE);
            });
          });
        };
      },
    };

    return sketches[name] || null;
  }

  /**
   * Destroy the currently active sketch
   */
  _destroyActiveSketch() {
    if (this.activeInstance) {
      this.activeInstance.remove();
      this.activeInstance = null;
    }
    this.activeSketch = null;
    if (this.container) {
      this.container.classList.remove('theatron-sketch-active');
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this._destroyActiveSketch();
    this.container = null;
    this.initialized = false;
  }
}
