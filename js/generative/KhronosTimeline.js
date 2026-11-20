'use strict';

/**
 * KhronosTimeline - Interactive SVG timeline visualization
 * Renders the temple's evolution as a scrollable, interactive timeline
 * with era gradient bands, animated milestone pulses, and click-to-expand details.
 *
 * @global
 */
// eslint-disable-next-line no-unused-vars
class KhronosTimeline {
  constructor() {
    /** @type {boolean} */
    this.initialized = false;
    /** @type {HTMLElement|null} */
    this.container = null;
    /** @type {SVGElement|null} */
    this.svg = null;
    /** @type {number} */
    this.viewOffsetX = 0;
    /** @type {boolean} */
    this.isDragging = false;
    /** @type {number} */
    this.dragStartX = 0;
    /** @type {number} */
    this.dragStartOffset = 0;
    /** @type {string|null} Active milestone id */
    this.activeDetail = null;

    this.milestones = [
      {
        id: 'inception',
        date: '2016-11',
        label: 'First Commit',
        description: 'Project inception — the first lines of ETCETER4 emerge.',
        era: 'origin',
      },
      {
        id: 'launch',
        date: '2022-01',
        label: 'Project Launch',
        description:
          'Official launch with initial chamber framework and SPA navigation.',
        era: 'genesis',
      },
      {
        id: 'pantheon',
        date: '2024-03',
        label: 'Living Pantheon',
        description:
          'Introduction of the Living Pantheon system — the temple begins to breathe.',
        era: 'refinement',
      },
      {
        id: 'ogod3d',
        date: '2025-06',
        label: 'OGOD 3D',
        description:
          '29-track immersive 3D experience with WebGL environments.',
        era: 'integration',
      },
      {
        id: 'discovery',
        date: '2025-10',
        label: 'Discovery System',
        description:
          'Cross-chamber search, filtering, and related works engine.',
        era: 'integration',
      },
      {
        id: 'activation',
        date: '2026-02',
        label: 'Full Temple Activation',
        description:
          'Breathing animations, exhibit portal, Odeion player — the temple lives.',
        era: 'integration',
      },
      {
        id: 'awakening',
        date: '2026-02',
        label: 'The Awakening',
        description:
          'Generative chambers activate — procedural art, poetry, and interaction.',
        era: 'integration',
      },
    ];

    this.eras = [
      {
        id: 'origin',
        label: 'Origin',
        startDate: '2016-11',
        endDate: '2021-12',
        color: '#1a1a3e',
      },
      {
        id: 'genesis',
        label: 'Genesis',
        startDate: '2022-01',
        endDate: '2022-12',
        color: '#87ceeb',
      },
      {
        id: 'expansion',
        label: 'Expansion',
        startDate: '2023-01',
        endDate: '2023-12',
        color: '#6495ed',
      },
      {
        id: 'refinement',
        label: 'Refinement',
        startDate: '2024-01',
        endDate: '2024-12',
        color: '#6495ed',
      },
      {
        id: 'integration',
        label: 'Integration',
        startDate: '2025-01',
        endDate: '2026-12',
        color: '#00008b',
      },
    ];

    // Timeline dimensions
    this.timelineWidth = 1200;
    this.timelineHeight = 180;
    this.padding = 60;

    this._boundHandlers = {};
  }

  /**
   * Initialize the timeline into the target container
   * @param {string} containerSelector
   */
  initialize(containerSelector) {
    if (this.initialized) {
      return;
    }

    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      return;
    }

    this._render();
    this._bindEvents();
    this.initialized = true;

    // Record interaction
    if (typeof JourneyTracker !== 'undefined') {
      JourneyTracker.getInstance().recordInteraction(
        'khronos',
        'timeline_explored'
      );
    }
  }

  /**
   * Convert a date string (YYYY-MM) to an X position on the timeline
   * @param {string} dateStr
   * @returns {number}
   */
  _dateToX(dateStr) {
    const [year, month] = dateStr.split('-').map(Number);
    const dateVal = year + (month - 1) / 12;
    const minDate = 2016 + 10 / 12; // 2016-11
    const maxDate = 2026 + 11 / 12; // 2026-12
    const range = maxDate - minDate;
    return (
      this.padding +
      ((dateVal - minDate) / range) * (this.timelineWidth - 2 * this.padding)
    );
  }

  /**
   * Build and inject the SVG into the container
   */
  _render() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute(
      'viewBox',
      `0 0 ${this.timelineWidth} ${this.timelineHeight}`
    );
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.minHeight = '120px';
    svg.style.cursor = 'grab';
    svg.style.userSelect = 'none';

    // Defs for gradient and glow
    const defs = document.createElementNS(ns, 'defs');

    // Pulse animation
    const style = document.createElementNS(ns, 'style');
    style.textContent = `
      @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      .milestone-pulse { animation: pulse 2s ease-in-out infinite; }
      .milestone-group { cursor: pointer; }
      .milestone-group:hover circle { r: 8; }
    `;
    defs.appendChild(style);

    // Era gradients
    this.eras.forEach(era => {
      const grad = document.createElementNS(ns, 'linearGradient');
      grad.id = `era-grad-${era.id}`;
      grad.setAttribute('x1', '0');
      grad.setAttribute('y1', '0');
      grad.setAttribute('x2', '0');
      grad.setAttribute('y2', '1');
      const stop1 = document.createElementNS(ns, 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', era.color);
      stop1.setAttribute('stop-opacity', '0.3');
      const stop2 = document.createElementNS(ns, 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', era.color);
      stop2.setAttribute('stop-opacity', '0.05');
      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
    });

    svg.appendChild(defs);

    // Era background bands
    this.eras.forEach(era => {
      const x1 = this._dateToX(era.startDate);
      const x2 = this._dateToX(era.endDate);
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(x1));
      rect.setAttribute('y', String(20));
      rect.setAttribute('width', String(Math.max(x2 - x1, 1)));
      rect.setAttribute('height', String(this.timelineHeight - 50));
      rect.setAttribute('fill', `url(#era-grad-${era.id})`);
      rect.setAttribute('rx', String(4));
      svg.appendChild(rect);

      // Era label
      const eraLabel = document.createElementNS(ns, 'text');
      eraLabel.setAttribute('x', String((x1 + x2) / 2));
      eraLabel.setAttribute('y', String(this.timelineHeight - 18));
      eraLabel.setAttribute('text-anchor', 'middle');
      eraLabel.setAttribute('fill', era.color);
      eraLabel.setAttribute('font-size', '10');
      eraLabel.setAttribute('opacity', '0.6');
      eraLabel.setAttribute('font-family', 'inherit');
      eraLabel.textContent = era.label;
      svg.appendChild(eraLabel);
    });

    // Main timeline axis
    const axisLine = document.createElementNS(ns, 'line');
    axisLine.setAttribute('x1', String(this.padding));
    axisLine.setAttribute('y1', String(this.timelineHeight / 2));
    axisLine.setAttribute('x2', String(this.timelineWidth - this.padding));
    axisLine.setAttribute('y2', String(this.timelineHeight / 2));
    axisLine.setAttribute('stroke', '#6495ed');
    axisLine.setAttribute('stroke-width', '2');
    axisLine.setAttribute('opacity', '0.4');
    svg.appendChild(axisLine);

    // Milestones
    const midY = this.timelineHeight / 2;
    this.milestones.forEach((milestone, index) => {
      const x = this._dateToX(milestone.date);
      const above = index % 2 === 0;

      const group = document.createElementNS(ns, 'g');
      group.classList.add('milestone-group');
      group.dataset.milestoneId = milestone.id;

      // Connector line
      const connector = document.createElementNS(ns, 'line');
      connector.setAttribute('x1', String(x));
      connector.setAttribute('y1', String(midY));
      connector.setAttribute('x2', String(x));
      connector.setAttribute('y2', String(above ? midY - 25 : midY + 25));
      connector.setAttribute('stroke', '#6495ed');
      connector.setAttribute('stroke-width', '1');
      connector.setAttribute('opacity', '0.5');
      group.appendChild(connector);

      // Milestone dot
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(midY));
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', '#6495ed');
      circle.classList.add('milestone-pulse', 'khronos-milestone');
      circle.style.animationDelay = `${index * 0.3}s`;
      group.appendChild(circle);

      // Label
      const labelY = above ? midY - 32 : midY + 42;
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(labelY));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'white');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-family', 'inherit');
      label.textContent = milestone.label;
      group.appendChild(label);

      // Date sub-label
      const dateLabel = document.createElementNS(ns, 'text');
      dateLabel.setAttribute('x', String(x));
      dateLabel.setAttribute('y', String(above ? labelY - 13 : labelY + 13));
      dateLabel.setAttribute('text-anchor', 'middle');
      dateLabel.setAttribute('fill', '#6495ed');
      dateLabel.setAttribute('font-size', '9');
      dateLabel.setAttribute('opacity', '0.7');
      dateLabel.setAttribute('font-family', 'inherit');
      dateLabel.textContent = milestone.date;
      group.appendChild(dateLabel);

      // Detail popup (hidden by default)
      const detailGroup = document.createElementNS(ns, 'g');
      detailGroup.classList.add('khronos-detail');
      detailGroup.dataset.detailId = milestone.id;

      const detailBg = document.createElementNS(ns, 'rect');
      const detailX = Math.max(10, Math.min(x - 100, this.timelineWidth - 210));
      const detailY = above ? midY - 85 : midY + 55;
      detailBg.setAttribute('x', String(detailX));
      detailBg.setAttribute('y', String(detailY));
      detailBg.setAttribute('width', String(200));
      detailBg.setAttribute('height', String(40));
      detailBg.setAttribute('fill', 'rgba(0, 0, 0, 0.9)');
      detailBg.setAttribute('stroke', '#6495ed');
      detailBg.setAttribute('stroke-width', '1');
      detailBg.setAttribute('rx', String(4));
      detailGroup.appendChild(detailBg);

      const detailText = document.createElementNS(ns, 'text');
      detailText.setAttribute('x', String(detailX + 10));
      detailText.setAttribute('y', String(detailY + 16));
      detailText.setAttribute('fill', 'white');
      detailText.setAttribute('font-size', '9');
      detailText.setAttribute('font-family', 'inherit');
      // Wrap long descriptions
      const words = milestone.description.split(' ');
      let line1 = '';
      let line2 = '';
      words.forEach(word => {
        if (line1.length + word.length < 35) {
          line1 += (line1 ? ' ' : '') + word;
        } else {
          line2 += (line2 ? ' ' : '') + word;
        }
      });

      const tspan1 = document.createElementNS(ns, 'tspan');
      tspan1.setAttribute('x', String(detailX + 10));
      tspan1.setAttribute('dy', '0');
      tspan1.textContent = line1;
      detailText.appendChild(tspan1);

      if (line2) {
        const tspan2 = document.createElementNS(ns, 'tspan');
        tspan2.setAttribute('x', String(detailX + 10));
        tspan2.setAttribute('dy', '13');
        tspan2.textContent = line2;
        detailText.appendChild(tspan2);
      }

      detailGroup.appendChild(detailText);
      group.appendChild(detailGroup);

      svg.appendChild(group);
    });

    this.container.innerHTML = '';
    this.container.appendChild(svg);
    this.svg = svg;
  }

  /**
   * Bind mouse/touch drag and click events
   */
  _bindEvents() {
    if (!this.svg) {
      return;
    }

    // Click on milestone groups
    this._boundHandlers.click = e => {
      const milestoneGroup = e.target.closest('.milestone-group');
      if (milestoneGroup) {
        const id = milestoneGroup.dataset.milestoneId;
        this._toggleDetail(id);
        e.stopPropagation();
        return;
      }
      // Click on empty space closes any open detail
      if (this.activeDetail) {
        this._toggleDetail(this.activeDetail);
      }
    };
    this.svg.addEventListener('click', this._boundHandlers.click);

    // Touch/mouse panning
    this._boundHandlers.pointerDown = e => {
      if (e.target.closest('.milestone-group')) {
        return;
      }
      this.isDragging = true;
      this.dragStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      this.dragStartOffset = this.viewOffsetX;
      this.svg.style.cursor = 'grabbing';
    };

    this._boundHandlers.pointerMove = e => {
      if (!this.isDragging) {
        return;
      }
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const dx = clientX - this.dragStartX;
      const maxOffset = this.timelineWidth * 0.3;
      this.viewOffsetX = Math.max(
        -maxOffset,
        Math.min(maxOffset, this.dragStartOffset + dx)
      );
      this.svg.setAttribute(
        'viewBox',
        `${-this.viewOffsetX} 0 ${this.timelineWidth} ${this.timelineHeight}`
      );
    };

    this._boundHandlers.pointerUp = () => {
      this.isDragging = false;
      if (this.svg) {
        this.svg.style.cursor = 'grab';
      }
    };

    this.svg.addEventListener('mousedown', this._boundHandlers.pointerDown);
    this.svg.addEventListener('touchstart', this._boundHandlers.pointerDown, {
      passive: true,
    });
    document.addEventListener('mousemove', this._boundHandlers.pointerMove);
    document.addEventListener('touchmove', this._boundHandlers.pointerMove, {
      passive: true,
    });
    document.addEventListener('mouseup', this._boundHandlers.pointerUp);
    document.addEventListener('touchend', this._boundHandlers.pointerUp);
  }

  /**
   * Toggle a milestone detail popup
   * @param {string} milestoneId
   */
  _toggleDetail(milestoneId) {
    // Close any open detail
    if (this.activeDetail) {
      const prev = this.svg.querySelector(
        `.khronos-detail[data-detail-id="${this.activeDetail}"]`
      );
      if (prev) {
        prev.classList.remove('active');
      }
    }

    if (this.activeDetail === milestoneId) {
      this.activeDetail = null;
      return;
    }

    const detail = this.svg.querySelector(
      `.khronos-detail[data-detail-id="${milestoneId}"]`
    );
    if (detail) {
      detail.classList.add('active');
      this.activeDetail = milestoneId;
    }
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (this.svg && this._boundHandlers.click) {
      this.svg.removeEventListener('click', this._boundHandlers.click);
      this.svg.removeEventListener(
        'mousedown',
        this._boundHandlers.pointerDown
      );
      this.svg.removeEventListener(
        'touchstart',
        this._boundHandlers.pointerDown
      );
    }
    document.removeEventListener('mousemove', this._boundHandlers.pointerMove);
    document.removeEventListener('touchmove', this._boundHandlers.pointerMove);
    document.removeEventListener('mouseup', this._boundHandlers.pointerUp);
    document.removeEventListener('touchend', this._boundHandlers.pointerUp);
    this._boundHandlers = {};
    this.initialized = false;
  }
}
