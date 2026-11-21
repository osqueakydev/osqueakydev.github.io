# MAL_Graphics_Engine v1.0.0

Image + audio object library. One file, no dependencies, no link to the MALE engine files.
Works **standalone** (Canvas 2D) and **with p5.js**, from a **server** or straight from **disk (file://)**.

Angles are in **degrees**.

## Install

Put this folder at `libs/MAL_Graphics_Engine/` in your project and add one tag to `index.html`
(after p5, before your engine files if they will use it):

```html
<script src="libs/MAL_Graphics_Engine/MAL_Graphics_Engine.js"></script>
```

The global is `MAL_Graphics_Engine` (also `MAL` if that name is free).

## Objects

| Class | Made with | What it is |
|---|---|---|
| `MAL_Image`  | `MAL.image(src, opts)`  | drawable image: x/y, angle, scale, anchor, alpha, flip, hit-test, crop, tint |
| `MAL_Sprite` | `MAL.sprite(src, opts)` | an image cut into frames + named animations |
| `MAL_Audio`  | `MAL.sound(src, opts)`  | sound with overlapping plays, loop, fade, volume groups |

`src` can be a path, a data-URI, an embedded name, an `<img>`, a `<canvas>`, an ImageBitmap or a `p5.Image`.
Audio `src` can be a list of fallbacks: `['boom.ogg', 'boom.mp3']`.

### MAL_Image options
`name, x, y, width, height, angle, scale | scaleX/scaleY, anchorX, anchorY (0..1), alpha, flipX, flipY, smoothing (false = crisp pixels), visible, onload, onerror`

Methods: `draw(target?)`, `drawAt(x,y,w,h,target?)`, `drawRegion(...)`, `setPosition`, `setAnchor`, `setScale`, `setSize`, `setAngle`, `center()`,
`contains(x,y)`, `bounds()`, `corners()`, `clone()`, `crop(x,y,w,h)`, `tinted(color, strength)`, `getPixel(x,y)`, `toDataURL()`, `toCanvas()`, `toP5Image()`.
Use `await img.ready` before `crop` / `tinted`.

### MAL_Sprite (extends MAL_Image)
```js
const coin = MAL.sprite('coin.png', {
  frameWidth: 32, frameHeight: 32,
  animations: {
    spin:  { from: 0, to: 3, fps: 8 },
    pop:   { frames: [4, 5, 6], fps: 12, loop: false, next: 'spin' }
  },
  play: 'spin',
  onAnimationEnd: (name, sprite) => {}
});
coin.draw();            // advances by real time automatically
coin.play('pop');       // coin.pause() / resume() / stop() / setFrame(n)
```
Driving it from a fixed-timestep loop instead: pass `autoUpdate: false` and call `coin.update(dtSeconds)`.

### MAL_Audio
```js
const boom  = MAL.sound('boom.wav', { volume: 0.8, pool: 4 });
const theme = MAL.sound(['theme.ogg', 'theme.mp3'], { loop: true, group: 'music' });

const voice = boom.play({ rate: 1.2 });   // returns a MAL_Voice (or null)
voice.stop();  voice.fadeTo(0, 1, true);  // fade out over 1s then stop
theme.play();  theme.fadeTo(0.2, 2);
```
Options: `volume, loop, rate, group, pool, onBusy ('steal' | 'ignore'), name`.
`play()` options: `volume, loop, rate, start, onend, queue`.

Global audio: `MAL.setVolume('master' | 'music' | 'sfx' | <group>, 0..1)`, `MAL.mute()`, `MAL.unmute()`, `MAL.toggleMute()`,
`MAL.stopAllSounds()`, `MAL.pauseAllSounds()`, `MAL.resumeAllSounds()`.

Browsers refuse sound until the player has clicked / pressed a key / touched the page. Looping sounds (music) and
`play({queue:true})` wait and start on the first interaction by themselves; one-shot sounds are dropped.

## Loading

```js
await MAL.load({
  images:  { ship: 'ship.png', bg: { src: 'bg.png', smoothing: false } },
  sprites: { coin: { src: 'coin.png', frameWidth: 32, frameHeight: 32 } },
  sounds:  { boom: 'boom.wav', theme: { src: 'theme.mp3', loop: true, group: 'music' } }
}, { onProgress: (done, total, name) => {} });

MAL.images.ship.draw();   MAL.sounds.boom.play();     // named assets are filed in the registries
MAL.get('coin');          MAL.remove('boom');
MAL.setBasePath('assets/');                           // prefix for relative paths
await MAL.ready();  MAL.progress;                     // everything created so far
```
A failed asset never throws: it logs an error, sets `.failed`, and an image draws a magenta/black marker
(`MAL.showMissing = false` to hide it).

## Using it standalone (no p5)

```js
const app = MAL.run({
  width: 640, height: 360, background: '#111',
  setup(ctx, canvas) { ship = MAL.image('ship.png', { x: 100, y: 100 }); },
  update(dt) { ship.angle += 90 * dt; },
  draw(ctx, dt) { ship.draw(); }
});
```
Or bring your own canvas: `MAL.setContext(myCanvasOrCtx)`, or `MAL.createCanvas(w, h)`; or pass a target to any draw: `img.draw(ctx)`.

## Using it with p5.js

* **Global mode** - nothing to set up; MAL draws on p5's canvas. In `preload()` call `MAL.holdP5()` after creating assets
  so p5 waits for them (p5 1.x). In p5 2.x use `async function setup() { await MAL.ready(); ... }`.
* **Instance mode** - `new p5((p) => { MAL.attachP5(p); ... })`.
* **p5.Graphics** - `img.draw(myGraphics)`.
* **WEBGL canvases** - supported through p5's own `image()`, but only over http (see below).

## file:// (opening index.html from disk)

* Images load through `<img>`; audio plays through `<audio>`. No `fetch`, no Web Audio decoding, and `crossOrigin` is not set - all of those break on `file://`.
* Browsers treat every `file://` image as cross-origin, so:
  * `getPixel()` / `toDataURL()` return `null` (a one-time console warning explains why),
  * **p5 WEBGL cannot use image textures** from disk (same limit as p5's own `loadImage`). Canvas 2D is unaffected.
* To bake assets into a script (no loose files at all): `MAL.embed('coin', 'data:image/png;base64,...')`, then `MAL.image('coin')`.

## Logging into the engine's message log (optional)

```js
MAL.setLogger((level, ...args) => new Message(args.join(' ')));
```

## Files

```
MAL_Graphics_Engine/
  MAL_Graphics_Engine.js     the library
  README.md
  examples/
    standalone.html          no p5
    p5_example.html          p5 global mode (expects ../../p5.js, i.e. libs/p5.js)
    assets/                  test image, sprite sheet and two sounds
```
