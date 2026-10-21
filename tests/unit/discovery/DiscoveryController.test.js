/**
 * @vitest-environment jsdom
 * Unit tests for DiscoveryController
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const controllerSource = readFileSync(
  resolve(__dirname, '../../../js/discovery/DiscoveryController.js'),
  'utf-8'
).replace(/^'use strict';\s*/, '');

const loadDiscoveryController = new Function(
  'window',
  'document',
  'ContentRegistry',
  'SearchEngine',
  'FilterSystem',
  'RelatedWorksEngine',
  'ShareLinks',
  'showNewSection',
  `${controllerSource}\nreturn window.DiscoveryController;`
);

function createElement(id, tag = 'div', className = '') {
  const el = document.createElement(tag);
  el.id = id;
  if (className) {
    el.className = className;
  }
  return el;
}

function setupDiscoveryDom() {
  const searchInput = createElement('discoverySearchInput', 'input');
  const resultsGrid = createElement('resultsGrid');
  const pagination = createElement('pagination');
  const tagCloud = createElement('tagCloud');
  const quickFilters = createElement('quickFilters');
  const filterPanel = createElement('filterPanel');
  const chamberFilters = createElement('chamberFilters');
  const typeFilters = createElement('typeFilters');
  const wingFilters = createElement('wingFilters');
  const yearFromInput = createElement('yearFromInput', 'input');
  const yearToInput = createElement('yearToInput', 'input');
  const clearFiltersBtn = createElement('clearFiltersBtn', 'button');
  const filterSummary = createElement('filterSummary');
  const resultCount = createElement('resultCount');
  const sortSelect = createElement('sortSelect', 'select');
  const recommendations = createElement('recommendationsGrid');
  const searchModal = createElement('searchModal', 'div', 'dn');
  const globalSearchInput = createElement('globalSearchInput', 'input');
  const globalSearchResults = createElement('globalSearchResults');

  document.body.append(
    searchInput,
    resultsGrid,
    pagination,
    tagCloud,
    quickFilters,
    filterPanel,
    chamberFilters,
    typeFilters,
    wingFilters,
    yearFromInput,
    yearToInput,
    clearFiltersBtn,
    filterSummary,
    resultCount,
    sortSelect,
    recommendations,
    searchModal,
    globalSearchInput,
    globalSearchResults
  );

  return {
    searchInput,
    resultsGrid,
    pagination,
    tagCloud,
    quickFilters,
    filterPanel,
    chamberFilters,
    typeFilters,
    wingFilters,
    yearFromInput,
    yearToInput,
    clearFiltersBtn,
    filterSummary,
    resultCount,
    sortSelect,
    recommendations,
    searchModal,
    globalSearchInput,
    globalSearchResults,
  };
}

describe('DiscoveryController', () => {
  let DiscoveryController;
  let mocks;

  const createMocks = () => {
    const registry = {
      isInitialized: false,
      initialize: vi.fn(async () => {
        registry.isInitialized = true;
      }),
      getFilteredItems: vi.fn(() => [
        {
          id: 'item-1',
          title: 'Filtered One',
          description: 'Filtered item',
          tags: ['art'],
        },
      ]),
      getAllItems: vi.fn(() => [
        {
          id: 'item-1',
          title: 'Filtered One',
          description: 'Filtered item',
          tags: ['art'],
        },
      ]),
      getAllTags: vi.fn(() => [
        { tag: 'art', count: 3 },
        { tag: 'ui', count: 1 },
      ]),
      getItem: vi.fn(itemId => ({
        id: itemId,
        title: 'Test Item',
        chamber: 'akademia',
        chamberName: 'AKADEMIA',
      })),
    };

    const searchEngine = {
      initialize: vi.fn(async () => {
        searchEngine.isInitialized = true;
      }),
      search: vi.fn(() => []),
      searchDebounced: vi.fn(async () => []),
      filter: vi.fn(),
    };

    const filterSystem = {
      config: { persistToUrl: false },
      isInitialized: false,
      initialize: vi.fn(() => {
        filterSystem.isInitialized = true;
        return filterSystem;
      }),
      listeners: new Set(),
      onChange: vi.fn(cb => {
        filterSystem.listeners.add(cb);
      }),
      offChange: vi.fn(cb => {
        filterSystem.listeners.delete(cb);
      }),
      clearAll: vi.fn(),
      setDateRange: vi.fn(),
      setSort: vi.fn(),
      setTypes: vi.fn(),
      setChambers: vi.fn(),
      toggleTag: vi.fn(),
      getState: vi.fn(() => ({
        tags: [],
        chambers: [],
        types: [],
        wings: [],
        fromYear: null,
        toYear: null,
      })),
      getSummaryText: vi.fn(() => 'No filters active'),
      getFilteredItems: vi.fn(() => [
        {
          id: 'item-1',
          title: 'Filtered One',
          chamber: 'akademia',
          chamberName: 'AKADEMIA',
          type: 'text',
          description: 'Filtered item',
          tags: ['art'],
        },
      ]),
    };

    const relatedWorks = {
      initialize: vi.fn(),
    };

    const shareLinks = {
      getItemIdFromUrl: vi.fn(() => null),
      shareItem: vi.fn(),
    };

    const showNewSection = vi.fn();

    return {
      registry,
      searchEngine,
      filterSystem,
      relatedWorks,
      shareLinks,
      showNewSection,
    };
  };

  const loadControllerClass = localMocks => {
    const {
      registry,
      searchEngine,
      filterSystem,
      relatedWorks,
      shareLinks,
      showNewSection,
    } = localMocks;

    global.ContentRegistry = {
      getInstance: () => registry,
    };
    global.SearchEngine = {
      getInstance: () => searchEngine,
    };
    global.FilterSystem = {
      getInstance: () => filterSystem,
    };
    global.RelatedWorksEngine = {
      getInstance: () => relatedWorks,
    };
    global.ShareLinks = {
      getInstance: () => shareLinks,
    };

    global.ETCETER4_CONFIG = {
      discovery: {
        search: { minQueryLength: 2 },
        filters: { maxTagsShown: 20 },
        pagination: { itemsPerPage: 2, maxPageButtons: 5 },
        ui: {
          quickFilters: [
            { id: 'all', label: 'All', criteria: {} },
            { id: 'text', label: 'Text', criteria: { types: ['text'] } },
          ],
        },
        shortcuts: {},
      },
    };

    return loadDiscoveryController(
      window,
      document,
      global.ContentRegistry,
      global.SearchEngine,
      global.FilterSystem,
      global.RelatedWorksEngine,
      global.ShareLinks,
      showNewSection
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    setupDiscoveryDom();
    delete window.discoveryControllerInstance;

    mocks = createMocks();
    DiscoveryController = loadControllerClass(mocks);
  });

  afterEach(() => {
    // Only initialized instances have subscribed; preserve singleton-only cases.
    if (window.discoveryControllerInstance?.isInitialized) {
      window.discoveryControllerInstance.dispose();
    }
    vi.useRealTimers();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    delete global.ContentRegistry;
    delete global.SearchEngine;
    delete global.FilterSystem;
    delete global.RelatedWorksEngine;
    delete global.ShareLinks;
    delete global.ETCETER4_CONFIG;
    delete window.discoveryControllerInstance;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('should expose a singleton via getInstance()', () => {
    const first = DiscoveryController.getInstance();
    const second = DiscoveryController.getInstance();

    expect(first).toBe(second);
  });

  it('should initialize subsystem dependencies once and cache status', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();

    expect(mocks.registry.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.searchEngine.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.filterSystem.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.relatedWorks.initialize).toHaveBeenCalledTimes(1);
    expect(instance.isInitialized).toBe(true);
    expect(instance.getStatus()).toMatchObject({
      isInitialized: true,
      currentPage: 1,
      searchQuery: '',
      isSearchModalOpen: false,
    });
  });

  it('should not reinitialize dependencies on subsequent initialize() calls', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();
    await instance.initialize();

    expect(mocks.registry.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.searchEngine.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.filterSystem.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.relatedWorks.initialize).toHaveBeenCalledTimes(1);
  });

  it('should render empty results state', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();
    instance._renderResults();

    expect(instance.elements.resultsGrid.innerHTML).toContain('No items found');
    expect(instance.elements.resultCount.textContent).toBe('0 items');
    expect(instance.elements.pagination.innerHTML).toBe('');
  });

  it('should render result cards and pagination controls for paginated data', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();

    instance.currentResults = [
      {
        id: 'a',
        title: 'First',
        chamber: 'akademia',
        chamberName: 'AKADEMIA',
        type: 'text',
        tags: ['a'],
        description: 'first item',
      },
      {
        id: 'b',
        title: 'Second',
        chamber: 'odeion',
        chamberName: 'ODEION',
        type: 'video',
        tags: ['b'],
        description: 'second item',
      },
      {
        id: 'c',
        title: 'Third',
        chamber: 'pinakotheke',
        chamberName: 'PINAKOTHEKE',
        type: 'audio',
        tags: ['c'],
        description: 'third item',
      },
    ];

    instance._renderResults();

    const cards =
      instance.elements.resultsGrid.querySelectorAll('.result-card');
    expect(cards.length).toBe(2);
    expect(
      instance.elements.pagination.querySelectorAll('.page-btn').length
    ).toBe(4);
  });

  it('should open and close the search modal', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();
    instance.openSearchModal();

    expect(instance.isSearchModalOpen).toBe(true);
    expect(instance.elements.searchModal.classList.contains('db')).toBe(true);
    expect(instance.elements.searchModal.classList.contains('dn')).toBe(false);

    instance.closeSearchModal();

    expect(instance.isSearchModalOpen).toBe(false);
    expect(instance.elements.searchModal.classList.contains('dn')).toBe(true);
    expect(instance.selectedResultIndex).toBe(-1);
    expect(document.body.style.overflow).toBe('');
  });

  it('should truncate and escape text through helper methods', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();

    expect(instance._truncate('A long text that needs truncation', 10)).toBe(
      'A long tex...'
    );
    expect(instance._escapeHtml('<div>hey</div>')).toBe(
      '&lt;div&gt;hey&lt;/div&gt;'
    );
    expect(instance._escapeHtml('plain')).toBe('plain');
  });

  it('should return expected type icons and fallback glyph', async () => {
    const instance = DiscoveryController.getInstance();

    await instance.initialize();

    expect(instance._getTypeIcon('audio')).toBe('🎵');
    expect(instance._getTypeIcon('text')).toBe('📝');
    expect(instance._getTypeIcon('mystery')).toBe('📄');
  });

  it('should compute pagination ranges with ellipsis rules', async () => {
    const instance = DiscoveryController.getInstance();
    await instance.initialize();

    expect(instance._getPaginationRange(1, 10, 5)).toEqual([
      1,
      2,
      3,
      '...',
      10,
    ]);
    expect(instance._getPaginationRange(5, 10, 5)).toEqual([
      1,
      '...',
      4,
      5,
      6,
      '...',
      10,
    ]);
    expect(instance._getPaginationRange(10, 10, 5)).toEqual([
      1,
      '...',
      8,
      9,
      10,
    ]);
  });

  it('should update results when handling search input', async () => {
    const instance = DiscoveryController.getInstance();

    mocks.searchEngine.searchDebounced.mockResolvedValue([
      {
        item: {
          id: 'search-1',
          title: 'Search Item',
          chamber: 'odeion',
          chamberName: 'ODEION',
          type: 'video',
          tags: ['search'],
          description: 'A searchable hit',
        },
      },
    ]);

    await instance.initialize();
    await instance._onSearchInput({ target: { value: 'search' } });

    expect(instance.currentSearchQuery).toBe('search');
    expect(instance.currentResults).toEqual([
      {
        id: 'search-1',
        title: 'Search Item',
        chamber: 'odeion',
        chamberName: 'ODEION',
        type: 'video',
        tags: ['search'],
        description: 'A searchable hit',
      },
    ]);
    expect(mocks.searchEngine.searchDebounced).toHaveBeenCalledWith('search');
  });

  it('should render global search results and handle result selection', async () => {
    const instance = DiscoveryController.getInstance();

    mocks.searchEngine.searchDebounced.mockResolvedValue([
      {
        item: {
          id: 'global-1',
          chamber: 'akademia',
          chamberName: 'AKADEMIA',
          title: 'Global Result',
          type: 'text',
          tags: ['x'],
          description: 'Search result',
        },
        highlights: {
          title: 'Global <mark>Result</mark>',
          description: 'desc',
        },
      },
    ]);

    await instance.initialize();
    await instance._onGlobalSearchInput({ target: { value: 'global' } });

    const renderedItem = instance.elements.globalSearchResults.querySelector(
      '.search-result-item'
    );
    expect(renderedItem).not.toBeNull();
    expect(renderedItem.getAttribute('data-item-id')).toBe('global-1');

    const navSpy = vi.spyOn(instance, '_navigateToItem');
    instance._selectResult(0);
    expect(navSpy).toHaveBeenCalledWith('global-1');
  });

  // Residue recovered from closed/live #103 and open #104. All cases execute
  // controllerSource through the existing source-reading loader above.
  it('restores all filtered items when a query clears and ignores short queries', async () => {
    const instance = DiscoveryController.getInstance();
    await instance.initialize();
    const items = [
      { id: 'first', title: 'First', tags: [] },
      { id: 'second', title: 'Second', tags: [] },
    ];
    mocks.filterSystem.getFilteredItems.mockReturnValue(items);
    instance.currentSearchQuery = 'previous';
    await instance._onSearchInput({ target: { value: '' } });
    expect(instance.currentResults).toEqual(items);
    expect(instance.currentSearchQuery).toBe('');
    mocks.filterSystem.getFilteredItems.mockClear();
    mocks.searchEngine.searchDebounced.mockClear();
    await instance._onSearchInput({ target: { value: 'x' } });
    expect(mocks.searchEngine.searchDebounced).not.toHaveBeenCalled();
    expect(mocks.filterSystem.getFilteredItems).not.toHaveBeenCalled();
    expect(instance.currentResults).toEqual(items);
  });

  it('updates filtered results and re-runs an active search with the filter state', async () => {
    const instance = DiscoveryController.getInstance();
    await instance.initialize();
    const item = { id: 'filtered', title: 'Filtered work', tags: [] };
    mocks.filterSystem.getFilteredItems.mockReturnValue([item]);
    mocks.filterSystem.getSummaryText.mockReturnValue('music');
    const state = { tags: ['music'], fromYear: 2020, toYear: 2025 };
    instance._onFilterChange(state);
    expect(instance.currentResults).toEqual([item]);
    expect(document.getElementById('filterSummary').textContent).toBe('music');
    instance.currentSearchQuery = 'work';
    mocks.searchEngine.search.mockReturnValue([{ item }]);
    instance._onFilterChange(state);
    expect(mocks.searchEngine.search).toHaveBeenCalledWith('work', {
      filter: state,
    });
    expect(instance.currentResults).toEqual([item]);
  });

  it('handles modal keyboard selection and Escape through subscribed events', async () => {
    const instance = DiscoveryController.getInstance();
    await instance.initialize();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    );
    expect(instance.isSearchModalOpen).toBe(true);
    instance._renderGlobalSearchResults([
      { item: { id: 'first', title: 'First' } },
      { item: { id: 'second', title: 'Second' } },
    ]);
    const results = [...document.querySelectorAll('.search-result-item')];
    // jsdom lacks this browser API; stub only the platform boundary.
    results.forEach(element => {
      element.scrollIntoView = vi.fn();
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(instance.selectedResultIndex).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(instance.selectedResultIndex).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(instance.selectedResultIndex).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(mocks.showNewSection).toHaveBeenCalledWith('#akademia');
    expect(sessionStorage.getItem('etceter4-highlight-item')).toBe('first');
    expect(instance.isSearchModalOpen).toBe(false);
    instance.openSearchModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(instance.isSearchModalOpen).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('navigates a shared URL item after initialization with its stable chamber id', async () => {
    vi.useFakeTimers();
    mocks.shareLinks.getItemIdFromUrl.mockReturnValue('album-1');
    mocks.registry.getItem.mockReturnValue({
      id: 'album-1',
      chamber: 'odeion',
      chamberName: 'ODEION',
    });
    const instance = DiscoveryController.getInstance();
    await instance.initialize();
    expect(mocks.showNewSection).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.showNewSection).toHaveBeenCalledWith('#odeion');
    expect(sessionStorage.getItem('etceter4-highlight-item')).toBe('album-1');
  });

  it('falls back to hash navigation when no router function is supplied', async () => {
    DiscoveryController = loadControllerClass({
      ...mocks,
      showNewSection: undefined,
    });
    const instance = DiscoveryController.getInstance();
    await instance.initialize();
    instance._navigateToItem('item-1');
    expect(window.location.hash).toBe('#akademia');
    expect(sessionStorage.getItem('etceter4-highlight-item')).toBe('item-1');
  });

  it('reports status and disposes the subscriptions it established', async () => {
    const instance = DiscoveryController.getInstance();
    await instance.initialize();
    const remove = vi.spyOn(document, 'removeEventListener');
    expect(instance.getStatus()).toMatchObject({
      isInitialized: true,
      isSearchModalOpen: false,
    });
    instance.dispose();
    expect(remove).toHaveBeenCalledWith('keydown', instance._onKeyDown);
    expect(mocks.filterSystem.offChange).toHaveBeenCalledWith(
      instance._onFilterChange
    );
    expect(mocks.filterSystem.listeners.size).toBe(0);
    expect(instance.currentResults).toEqual([]);
    expect(instance.isInitialized).toBe(false);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    );
    expect(instance.isSearchModalOpen).toBe(false);
  });
});
