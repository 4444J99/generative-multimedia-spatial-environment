/**
 * Runtime globals for the classic-script site.
 *
 * This repository loads its JavaScript as classic <script> tags (index.html)
 * and through ChamberLoader (js/chamberManifest.js), not as ES modules, so
 * the checked files share globals that no import provides. This file declares
 * exactly the environment those files run in, so `tsc --noEmit` can check
 * them without inventing imports:
 *
 * - Library globals come from their real types: jQuery 3.7.1 (CDN,
 *   @types/jquery), Howler (dependencies/vendor/howler, @types/howler),
 *   Google Analytics (the snippet in js/analytics.js, @types/google.analytics),
 *   p5 (vendored js/vendor/p5.js, @types/p5 — which declares no UMD global,
 *   so the constructor value is declared here), video.js (@types/video.js),
 *   hls.js 1.4.12 (CDN, js/chamberManifest.js — the hls.js package itself,
 *   types-only devDependency).
 * - `html2canvas` is declared minimally: it is optional and guarded
 *   (`typeof html2canvas !== 'undefined'`) at its one call site.
 * - Cross-file application globals are declared `any` with the file that
 *   defines them named in the comment. Those files are NOT in the checked
 *   surface yet (the surface is the lint script's file list); the follow-up
 *   is to check each defining file and replace its `any` with its real type.
 * - `window.*` properties are typed from the class or value the checked
 *   files actually assign, so a wrong assignment is still a type error.
 *
 * Nothing here is a lie about the runtime: every name is loaded by a
 * <script> tag, by ChamberLoader, or by the file that assigns it. Where a
 * load could not be verified, the PR that introduces this file says so.
 */
import type p5Module from 'p5';
import type HlsClass from 'hls.js';

declare global {
  // p5 — vendored js/vendor/p5.js; @types/p5 ships no UMD global.
  var p5: typeof p5Module;
  type p5 = InstanceType<typeof p5Module>;

  // html2canvas — optional, guarded at the call site (js/living-pantheon/GlitchTunnelSystem.js).
  function html2canvas(
    element: HTMLElement,
    options?: Record<string, unknown>,
  ): Promise<HTMLCanvasElement>;

  // Cross-file application globals. Defining file named; type is `any` until
  // that file joins the checked surface (see the header comment).
  var JourneyTracker: any; // js/modules/JourneyTracker.js
  var UISounds: any; // js/uiSounds.js
  var ScriptLoader: any; // js/modules/ScriptLoader.js
  var Carousel: any; // js/modules/Carousel.js
  var DiscoveryController: any; // js/discovery/DiscoveryController.js
  var OGODAnimationEngine: any; // js/ogod/OGODAnimationEngine.js
  // js/ogod.js uses OGODAnimationEngine as a TYPE (JSDoc @type {OGODAnimationEngine|null});
  // TypeScript 7 enforces the value/type distinction (TS2749), so the type half is
  // declared here alongside the value, still `any` until the defining file joins the surface.
  type OGODAnimationEngine = any;
  var OGODViewerController: any; // js/ogod/OGODViewerController.js
  var OGODSceneManager: any; // js/3d/ogod/OGODSceneManager.js
  var OGODAudioEngine: any; // js/3d/ogod/OGODAudioEngine.js
  var OGOD3DController: any; // js/ogod/OGOD3DController.js
  var AkademiaRenderer: any; // js/akademia/AkademiaRenderer.js
  var akademiaConfig: any; // akademia/config.js
  // p5 instance-mode sketch function (js/sketches/audioReactiveShader.js).
  var audioReactiveShaderSketch: (p: InstanceType<typeof p5Module>) => void;
  // CSS selector for the container to search within (js/modules/Carousel.js).
  function replacePlaceholders(element: string): void;

  // jQuery.cachedScript is defined by the site itself (js/pageData.js, after
  // https://api.jquery.com/jquery.getscript/): like $.ajax with dataType
  // 'script' and cache forced on, returning the jqXHR for chaining.
  interface JQueryStatic {
    cachedScript(url: string, options?: JQuery.AjaxSettings): JQuery.jqXHR<string>;
  }

  // Network Information API (js/modules/ChamberLoader.js reads connection /
  // mozConnection / webkitConnection for saveData + effectiveType). Not in
  // the DOM lib, so the minimal shape the code actually reads is declared.
  interface NetworkInformationLike {
    readonly saveData?: boolean;
    readonly effectiveType?: string;
    readonly downlink?: number;
    readonly rtt?: number;
  }
  interface Navigator {
    readonly connection?: NetworkInformationLike;
    readonly mozConnection?: NetworkInformationLike;
    readonly webkitConnection?: NetworkInformationLike;
  }

  // Vendor-prefixed fullscreen APIs (js/media/video/EnhancedVideoPlayer.js
  // feature-detects them). Not in the DOM lib, so the members the code
  // actually reads are declared here.
  interface Document {
    readonly webkitFullscreenElement?: Element | null;
    readonly mozFullScreenElement?: Element | null;
    readonly msFullscreenElement?: Element | null;
    webkitExitFullscreen?(): void;
    mozCancelFullScreen?(): void;
    msExitFullscreen?(): void;
  }
  interface HTMLElement {
    webkitRequestFullscreen?(): void;
    mozRequestFullScreen?(): void;
    msRequestFullscreen?(): void;
  }
  interface HTMLVideoElement {
    webkitEnterFullscreen?(): void;
  }

  // Service-worker scope (js/media/cache/MediaServiceWorker.js runs as a
  // worker, not a window). The DOM lib types `self` as Window, so that file
  // reaches worker-only members through a `workerScope` alias of this type.
  // evaluateRangeSlice / planCacheEviction are the file's own test hooks,
  // exposed on the scope at its end.
  interface ServiceWorkerScope {
    readonly registration: ServiceWorkerRegistration | undefined;
    readonly clients: Clients;
    readonly location: WorkerLocation;
    skipWaiting(): Promise<void>;
    addEventListener(
      type: 'install' | 'activate',
      listener: (event: ExtendableEvent) => void,
    ): void;
    addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
    addEventListener(
      type: 'message',
      listener: (event: ExtendableMessageEvent) => void,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
    ): void;
    evaluateRangeSlice: typeof evaluateRangeSlice;
    planCacheEviction: typeof planCacheEviction;
  }

  // The gallery object (js/worksGallery.js): `window.WorksGallery = { init, destroy, close }`.
  interface WorksGalleryApi {
    init(options: { root: string }): Promise<void>;
    destroy(): void;
    close(restoreFocus?: boolean): void;
  }
  var WorksGallery: WorksGalleryApi;

  interface Window {
    // Site configuration object (js/config.js).
    ETCETER4_CONFIG: typeof ETCETER4_CONFIG;
    // Startup status reported by js/main.js, fallback in js/runtimeFallback.js.
    etceter4Startup: { status: string; route: string | null };
    _ogodLegacyCleanup: () => void;
    currentPage: Page;
    WorksGallery: WorksGalleryApi;
    // Classes exposed on window by their own files (all in the checked surface).
    AIExhibit: typeof AIExhibit;
    AI_EXHIBIT_CLASSES: typeof AI_EXHIBIT_CLASSES;
    AudioOrbExhibit: typeof AudioOrbExhibit;
    GeminiInkStudioExhibit: typeof GeminiInkStudioExhibit;
    P5jsPlaygroundExhibit: typeof P5jsPlaygroundExhibit;
    SynthwaveSpaceExhibit: typeof SynthwaveSpaceExhibit;
    getAllExhibits: typeof getAllExhibits;
    getExhibit: typeof getExhibit;
    initAllExhibits: typeof initAllExhibits;
    AmbientSoundLayer: typeof AmbientSoundLayer;
    AnimatedContentSystem: typeof AnimatedContentSystem;
    GlitchTunnelSystem: typeof GlitchTunnelSystem;
    GlobalGlitchSystem: typeof GlobalGlitchSystem;
    LabyrinthGenerator: typeof LabyrinthGenerator;
    LivingPantheonCore: typeof LivingPantheonCore;
    LyricsSync: typeof LyricsSync;
    MediaURLResolver: typeof MediaURLResolver;
    MorphingImageSystem: typeof MorphingImageSystem;
    PixelSortUtils: typeof PixelSortUtils;
    PlaylistManager: typeof PlaylistManager;
    PresetSelector: typeof PresetSelector;
    SessionManager: typeof SessionManager;
    SettingsPanel: typeof SettingsPanel;
    StemMixer: typeof StemMixer;
    EnhancedAudioPlayer: typeof EnhancedAudioPlayer;
    EnhancedVideoPlayer: typeof EnhancedVideoPlayer;
    ExhibitBridge: typeof ExhibitBridge;
    ExhibitPortal: typeof ExhibitPortal;
    HLSLoader: typeof HLSLoader;
    SoundSubsystem: typeof SoundSubsystem;
    WaveformVisualizer: typeof WaveformVisualizer;
    // Instances created by page initializers (js/pageData.js).
    theatronVisuals: TheatronVisuals;
    symposionDialogues: SymposionDialogues;
    pinakothekeGen: PinakothekeGenerator;
    oikosJournal: OikosJournal;
    khronosTimeline: KhronosTimeline;
    exhibitPortal: ExhibitPortal;
    bibliothekePoetry: BibliothekePoetry;
    livingPantheonCoreInstance: LivingPantheonCore;
    odeionPlayer: EnhancedAudioPlayer;
    odeionWaveform: WaveformVisualizer;
    odeionPlaylist: PlaylistManager;
    enhancedAudioPlayerInstance: EnhancedAudioPlayer | undefined;
    // Not in the checked surface: defined in js/3d/landing/LandingCompositor.js.
    landingCompositor: any;
    // hls.js 1.4.12 via CDN (js/chamberManifest.js); optional, guarded at use sites.
    Hls?: typeof HlsClass;
    webkitAudioContext?: typeof AudioContext;
    // video.js is loaded as a page-level global (videoPlayer.js); the
    // @types/video.js UMD export cannot be referenced bare from a module,
    // so the call site uses window.videojs. No page in the repo was found
    // loading video.js — verify before relying on the player.
    videojs: import('video.js').default;
  }
}

export {};
