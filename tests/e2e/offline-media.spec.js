import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';

test.use({ serviceWorkers: 'allow' });

// A real HTTP origin: no page.route interception (which can miss SW requests).
// Serve unchanged repository assets under either deployment base. Version only
// the worker bytes to force a genuine browser install/update/activate cycle.
async function serve(base) {
  let revision = 1;
  let legacy = true;
  const hits = new Map();
  const root = resolve('.');
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    hits.set(path, (hits.get(path) || 0) + 1);
    res.setHeader('Cache-Control', 'no-store');
    let file = path.slice(base.length);
    if (!path.startsWith(base + '/')) {
      res.writeHead(404).end();
      return;
    }
    if (file === '/__client.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><title>Root application client</title>');
      return;
    }
    if (file === '/js/media/cache/MediaServiceWorker.js' && legacy) {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(`self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
        self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));`);
      return;
    }
    try {
      if (file === '/') file = '/index.html';
      const full = resolve(root, '.' + file);
      if (!full.startsWith(root + '/')) throw new Error('outside fixture');
      const data = readFileSync(full);
      res.setHeader(
        'Content-Type',
        {
          '.js': 'application/javascript',
          '.html': 'text/html',
          '.css': 'text/css',
          '.json': 'application/json',
          '.mp3': 'audio/mpeg',
        }[extname(file)] || 'application/octet-stream'
      );
      if (file === '/sw.js') {
        res.end(
          Buffer.concat([
            data,
            Buffer.from(`\n// fixture revision ${revision}`),
          ])
        );
        return;
      }
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2]
          ? Math.min(Number(range[2]), data.length - 1)
          : data.length - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${data.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
        });
        res.end(data.subarray(start, end + 1));
      } else {
        res.setHeader('Content-Length', data.length);
        res.end(data);
      }
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    hits,
    update: () => {
      revision++;
      legacy = false;
    },
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

for (const base of ['', '/a-mavs-olevm']) {
  test(`real worker lifecycle, media and offline fallback at ${base || '/'}`, async ({
    page,
    context,
  }) => {
    const host = await serve(base);

    try {
      await page.goto(host.origin + base + '/__client.html');
      const initial = await page.evaluate(async base => {
        const names = [
          'etceter4-v5',
          'media-cache-v1-audio',
          'media-cache-v1-thumbnails',
          'media-cache-v1-waveforms',
          'media-cache-v1-metadata',
          'unrelated',
          'etceter4-v4',
          'media-cache-v0-audio',
        ];
        for (const name of names)
          await (
            await caches.open(name)
          ).put(base + '/sentinel', new Response(name));
        await navigator.serviceWorker.register(
          base + '/js/media/cache/MediaServiceWorker.js'
        );
        const registration = await navigator.serviceWorker.register(
          base + '/sw.js'
        );
        await navigator.serviceWorker.ready;
        return registration.scope;
      }, base);
      expect(initial).toBe(host.origin + base + '/');
      await page.waitForFunction(() =>
        navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js')
      );
      await expect
        .poll(() => page.evaluate(() => caches.keys()))
        .toEqual(
          expect.arrayContaining([
            'etceter4-v5',
            'media-cache-v1-audio',
            'unrelated',
          ])
        );
      const checkSentinels = () =>
        page.evaluate(async base => {
          const result = {};
          for (const name of await caches.keys()) {
            const value = await (
              await caches.open(name)
            ).match(base + '/sentinel');
            result[name] = value ? await value.text() : null;
          }
          return result;
        }, base);
      let sentinels = await checkSentinels();
      expect(sentinels['unrelated']).toBe('unrelated');
      expect(sentinels['media-cache-v1-audio']).toBe('media-cache-v1-audio');
      expect(sentinels['etceter4-v4']).toBeUndefined();
      expect(sentinels['media-cache-v0-audio']).toBeUndefined();

      // A real historical source with its original bytes, not invented media.
      const audioPath = base + '/ogod/ogodtracks/01 I.mp3';
      const originalSize = statSync('ogod/ogodtracks/01 I.mp3').size;
      const result = await page.evaluate(
        async ({ audioPath, base }) => {
          const audio = await fetch(audioPath);
          const size = (await audio.arrayBuffer()).byteLength;
          const cover = base + '/img/placeholder.jpg';
          // Consume response streams so a genuine in-flight fetch does not delay
          // skipWaiting/activation. Native image/media elements do this themselves.
          await (await fetch(cover)).arrayBuffer();
          await (await fetch(cover)).arrayBuffer();
          await (await fetch(base + '/chambers/odeion/fragment.html')).text();
          return {
            size,
            media: Boolean(
              await (await caches.open('media-cache-v1-audio')).match(audioPath)
            ),
            shell: Boolean(
              await (await caches.open('etceter4-v5')).match(audioPath)
            ),
          };
        },
        { audioPath, base }
      );
      expect(result).toEqual({ size: originalSize, media: true, shell: false });
      expect(host.hits.get(base + '/img/placeholder.jpg')).toBe(2); // precache + first media fetch

      // Force actual update and replace an installed legacy registration at its
      // original URL with the shipped retirement script. Existing data survives.
      host.update();
      await page.evaluate(async base => {
        await (
          await caches.open('etceter4-v3')
        ).put(base + '/old', new Response('old'));
        const root = await navigator.serviceWorker.getRegistration(base + '/');
        window.previousWorker = root.active;
        const nested = (await navigator.serviceWorker.getRegistrations()).find(
          r => r.scope.endsWith('/js/media/cache/')
        );
        await Promise.all([root.update(), nested.update()]);
      }, base);
      await expect
        .poll(
          () =>
            page.evaluate(async base => {
              const root = await navigator.serviceWorker.getRegistration(
                base + '/'
              );
              return {
                previous: window.previousWorker.state,
                active: root.active?.state,
                installing: root.installing?.state || null,
                waiting: root.waiting?.state || null,
              };
            }, base),
          { timeout: 10000 }
        )
        .toEqual({
          previous: 'redundant',
          active: 'activated',
          installing: null,
          waiting: null,
        });
      await expect
        .poll(() =>
          page.evaluate(async () =>
            (await navigator.serviceWorker.getRegistrations()).map(r => r.scope)
          )
        )
        .toEqual([host.origin + base + '/']);
      sentinels = await checkSentinels();
      for (const name of [
        'etceter4-v5',
        'media-cache-v1-audio',
        'media-cache-v1-thumbnails',
        'media-cache-v1-waveforms',
        'media-cache-v1-metadata',
        'unrelated',
      ])
        expect(sentinels[name]).toBe(name);
      expect(sentinels['etceter4-v3']).toBeUndefined();

      await context.setOffline(true);
      const offline = await page.evaluate(
        async ({ audioPath, base }) => {
          const range = await fetch(audioPath, {
            headers: { Range: 'bytes=10-19' },
          });
          const fragment = await fetch(base + '/chambers/odeion/fragment.html');
          return {
            status: range.status,
            range: range.headers.get('Content-Range'),
            size: (await range.arrayBuffer()).byteLength,
            fragment: fragment.ok,
          };
        },
        { audioPath, base }
      );
      expect(offline).toEqual({
        status: 206,
        range: `bytes 10-19/${originalSize}`,
        size: 10,
        fragment: true,
      });
      // Real browser audio decoder and range requests, including offline seeking.
      await page.evaluate(audioPath => {
        window.proofAudio = new Audio(audioPath);
        return proofAudio.play();
      }, audioPath);
      await page.waitForFunction(() => window.proofAudio.currentTime > 0.2);
      await page.evaluate(() => {
        proofAudio.currentTime = 2;
      });
      await page.waitForFunction(() => window.proofAudio.currentTime > 2.2);
      await page.goto(host.origin + base + '/not-previously-cached');
      await expect(page.locator('body')).toContainText('offline');
      await page.addScriptTag({ url: base + '/js/data/source-catalogue.js' });
      await page.addScriptTag({ url: base + '/js/config.js' });
      expect(
        await page.evaluate(() =>
          Object.values(ETCETER4_CONFIG.media.albums).map(
            album => album.tracks.length
          )
        )
      ).toEqual([29, 8, 11, 9]);
    } finally {
      await context.setOffline(false);
      await host.close();
    }
  });
}
