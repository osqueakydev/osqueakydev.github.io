// ============================================================
// MALEngine.js  -  v1.2.0
// ------------------------------------------------------------
// A small, dependency-free graphics + audio asset library.
//
//   * Works ON ITS OWN (plain Canvas 2D, no p5.js needed)
//   * Works WITH p5.js (global mode, instance mode, or p5.Graphics)
//   * Works from a web server AND straight from disk (file://)
//   * Has no link to the MALE engine files - the engine can use it,
//     but nothing in here reads or requires the engine.
//
// EVERYTHING IS GLOBAL. Loading this file puts the classes and helper
// functions straight on `window`, so you never type a library prefix:
//
//   classes : ImageObject, SpriteObject, SoundObject, SoundVoice, graphicsError
//   helpers : newImage, newSprite, newSound, loadAssets, assetsReady, ...
//   (full list at the bottom of this file, and in README.md)
//
// BUILT-IN HELP. In the browser console type  help()  for the overview, or
//   help('newImage')  help('ImageObject.draw')  help('audio')  help(myImage)
// for the details of any feature and what each parameter does.
//
// REGISTRY. The library creates window.libraries if it does not exist and adds
// itself:  window.libraries.MALEngine_graphics = MALEngine
//
// A global is only created if that name is free - if something else already
// owns the name, the library skips it and warns once in the console (the same
// function is always still available as MALEngine.<name>).
//
// What it makes:
//   ImageObject  - a drawable image (position, angle, scale, anchor,
//                  alpha, flip, hit-test, crop, tint)
//   SpriteObject - an ImageObject cut into frames with named animations
//   SoundObject  - a sound (multi-voice pool, loop, fade, volume groups,
//                  autoplay-unlock handling)
//
// Quick start:
//   const img  = newImage('ship.png', { x: 100, y: 100 });
//   const coin = newSprite('coin.png', { frameWidth: 32, frameHeight: 32,
//                  animations: { spin: { from: 0, to: 3, fps: 8 } }, play: 'spin' });
//   const boom = newSound('boom.wav');
//   ...later, every frame:   img.draw();   coin.draw();
//   ...on an event:          boom.play();
//
// Angles are in DEGREES everywhere in this library.
//
// Why it is file:// safe:
//   - images load through <img> (never fetch / XHR)
//   - audio plays through <audio> elements (never fetch + decodeAudioData,
//     never createMediaElementSource - both fail on file:// pages)
//   - `crossOrigin` is NOT set unless you ask for it (setting it breaks
//     loading on file://)
//   Limitation: browsers mark a canvas "tainted" once a file:// image is
//   drawn onto it, so reading pixels back (getPixel, toDataURL) returns
//   null there. Drawing, cropping and tinting are unaffected.
// ============================================================
(function (root) {
    'use strict';

    // ============================================
    // CONSTANTS / ENVIRONMENT
    // ============================================
    const VERSION  = '1.2.0';
    const HAS_DOM  = typeof document !== 'undefined';
    const IS_FILE  = HAS_DOM && !!root.location && root.location.protocol === 'file:';
    const DEG2RAD  = Math.PI / 180;

    // Extension -> mime, used to pick the first playable source of a list.
    const EXT_MIME = {
        mp3: 'audio/mpeg', ogg: 'audio/ogg; codecs="vorbis"', oga: 'audio/ogg',
        opus: 'audio/ogg; codecs="opus"', wav: 'audio/wav', m4a: 'audio/mp4',
        aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm'
    };

    // ============================================
    // ERROR CLASS + LOGGING
    // ============================================
    // Same idea as the engine's error classes: a named error so the
    // console shows which subsystem failed.
    class graphicsError extends Error {
        constructor(msg) { super(msg); this.name = 'MALEngine'; }
    }

    // Default logger writes to the console. Swap it with setAssetLogger(fn)
    // (for example to forward messages into an engine's message log).
    let logger = (level, ...args) => (console[level] || console.log).call(console, '[MALEngine]', ...args);
    const log = (level, ...args) => { try { logger(level, ...args); } catch (e) { /* never let logging break a game */ } };
    const warned = new Set();
    function warnOnce(key, ...args) { if (warned.has(key)) return; warned.add(key); log('warn', ...args); }

    // ============================================
    // SMALL HELPERS
    // ============================================
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const now   = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    /** Turns a user path into a loadable URL (embedded name, absolute URL, or basePath + path). */
    function resolveSrc(src) {
        if (typeof src !== 'string') return src;
        if (Object.prototype.hasOwnProperty.call(MAL.embedded, src)) return MAL.embedded[src];
        if (/^(data:|blob:|https?:|file:|\/\/)/i.test(src)) return src;
        return MAL.basePath + src;
    }

    /** Linear value tween with setInterval (no render loop required). Returns a cancel function. */
    function tween(from, to, seconds, onUpdate, onDone) {
        if (!(seconds > 0)) { onUpdate(to); if (onDone) onDone(); return () => {}; }
        const start = now();
        const id = setInterval(() => {
            const t = Math.min(1, (now() - start) / (seconds * 1000));
            onUpdate(from + (to - from) * t);
            if (t >= 1) { clearInterval(id); if (onDone) onDone(); }
        }, 25);
        return () => clearInterval(id);
    }

    const isCanvas = (o) => !!o && ((typeof HTMLCanvasElement !== 'undefined' && o instanceof HTMLCanvasElement) ||
                                    (typeof OffscreenCanvas   !== 'undefined' && o instanceof OffscreenCanvas));
    const isCtx2d  = (o) => !!o && typeof o.drawImage === 'function' && typeof o.save === 'function';

    function makeCanvas(w, h) {
        if (HAS_DOM) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
        if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
        throw new graphicsError('No canvas available in this environment.');
    }

    // ============================================
    // ImageObject
    // ============================================
    /**
     * A drawable image object.
     *
     * `source` can be: a URL / path / data-URI / embedded name, an <img>,
     * a <canvas>, an ImageBitmap, or a p5.Image.
     *
     * opts: name, x, y, width, height, angle(deg), scale | scaleX/scaleY,
     *       anchorX, anchorY (0..1, 0.5 = centre), alpha (0..1), flipX, flipY,
     *       smoothing (false = crisp pixel art), visible, crossOrigin,
     *       onload(img), onerror(img, err)
     *
     * Use `await img.ready` (or assetsReady()) to wait for loading. `ready`
     * never rejects - check `img.failed` instead.
     */
    class ImageObject {
        constructor(source, opts = {}) {
            // ---- transform / look (all public, change them any time) ----
            this.name      = opts.name || null;
            this.x         = opts.x || 0;
            this.y         = opts.y || 0;
            this.angle     = opts.angle || 0;                       // degrees
            this.scaleX    = opts.scaleX != null ? opts.scaleX : (opts.scale != null ? opts.scale : 1);
            this.scaleY    = opts.scaleY != null ? opts.scaleY : (opts.scale != null ? opts.scale : 1);
            this.anchorX   = opts.anchorX != null ? opts.anchorX : 0;
            this.anchorY   = opts.anchorY != null ? opts.anchorY : 0;
            this.alpha     = opts.alpha != null ? opts.alpha : 1;
            this.flipX     = !!opts.flipX;
            this.flipY     = !!opts.flipY;
            this.smoothing = opts.smoothing !== false;
            this.visible   = opts.visible !== false;

            // ---- load state ----
            this.src       = typeof source === 'string' ? source : null;
            this.element   = null;     // the drawable (<img>, <canvas>, ImageBitmap)
            this.loaded    = false;
            this.failed    = false;
            this.error     = null;
            this._w        = opts.width  != null ? opts.width  : null;   // null -> natural size
            this._h        = opts.height != null ? opts.height : null;
            this._p5Cache  = null;
            this._opts     = opts;
            this.ready     = new Promise((res) => { this._resolve = res; });

            this._init(source, opts);
            MAL._track(this);
        }

        // ---- loading ----
        _init(source, opts) {
            if (typeof source === 'string') {
                const img = new Image();
                if (opts.crossOrigin) img.crossOrigin = opts.crossOrigin;   // intentionally NOT defaulted (breaks file://)
                img.onload  = () => this._finish(true);
                img.onerror = () => this._finish(false, new graphicsError('Could not load image "' + source + '"'));
                this.element = img;
                img.src = resolveSrc(source);
            } else if (HAS_DOM && source instanceof HTMLImageElement) {
                this.element = source;
                this.src = source.currentSrc || source.src || null;
                if (source.complete && source.naturalWidth > 0) this._finish(true);
                else {
                    source.addEventListener('load',  () => this._finish(true),  { once: true });
                    source.addEventListener('error', () => this._finish(false, new graphicsError('Image element failed to load')), { once: true });
                }
            } else if (source && source.canvas && isCanvas(source.canvas)) {   // p5.Image / p5.Graphics
                this.element = source.canvas;
                this._finish(true);
            } else if (isCanvas(source) || (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)) {
                this.element = source;
                this._finish(true);
            } else {
                this._finish(false, new graphicsError('ImageObject: unsupported source type.'));
            }
        }

        _finish(ok, err) {
            if (this._done) return;
            this._done = true;
            this.loaded = ok;
            this.failed = !ok;
            this.error  = err || null;
            if (!ok) log('error', err ? err.message : 'image failed');
            try {
                if (ok && this._opts.onload)    this._opts.onload(this);
                if (!ok && this._opts.onerror)  this._opts.onerror(this, err);
            } catch (e) { log('error', e); }
            this._resolve(this);
        }

        // ---- size ----
        get naturalWidth()  { const e = this.element; return e ? (e.naturalWidth  || e.width  || 0) : 0; }
        get naturalHeight() { const e = this.element; return e ? (e.naturalHeight || e.height || 0) : 0; }
        /** The part of the source image that gets drawn (whole image here; one frame for sprites). */
        _frameRect() { return { sx: 0, sy: 0, sw: this.naturalWidth, sh: this.naturalHeight }; }
        get width()      { return this._w != null ? this._w : this._frameRect().sw; }
        set width(v)     { this._w = v; }
        get height()     { return this._h != null ? this._h : this._frameRect().sh; }
        set height(v)    { this._h = v; }
        /** Width/height after scale (what you see on screen, ignoring rotation). */
        get drawnWidth()  { return this.width  * Math.abs(this.scaleX); }
        get drawnHeight() { return this.height * Math.abs(this.scaleY); }

        // ---- convenience setters (chainable) ----
        setPosition(x, y)  { this.x = x; this.y = y; return this; }
        setAnchor(ax, ay)  { this.anchorX = ax; this.anchorY = ay != null ? ay : ax; return this; }
        setScale(sx, sy)   { this.scaleX = sx; this.scaleY = sy != null ? sy : sx; return this; }
        setSize(w, h)      { this._w = w; this._h = h; return this; }
        setAngle(deg)      { this.angle = deg; return this; }
        center()           { return this.setAnchor(0.5, 0.5); }

        // ---- drawing ----
        _beforeRender() { /* sprites advance their animation here */ }

        /**
         * Draw using this object's own x/y/angle/scale/etc.
         * `target` is optional: a canvas, a 2D context, a p5 instance or a
         * p5.Graphics. Left out, the library draws to the current context
         * (see setDrawTarget / newCanvas / the running p5 canvas).
         */
        draw(target) {
            return this._render(target, this.x, this.y, this.width, this.height);
        }

        /** Draw at a one-off position (and optional size) without changing the object. */
        drawAt(x, y, w, h, target) {
            return this._render(target, x, y, w != null ? w : this.width, h != null ? h : this.height);
        }

        /** Draw a rectangle of the source image (ignores angle/scale/anchor, keeps alpha). */
        drawRegion(sx, sy, sw, sh, dx, dy, dw, dh, target) {
            const t = MAL._resolveTarget(target);
            if (!t || !this.loaded) return this;
            if (t.kind === '2d') {
                const c = t.ctx;
                c.save();
                c.globalAlpha *= this.alpha;
                c.imageSmoothingEnabled = this.smoothing;
                c.drawImage(this.element, sx, sy, sw, sh, dx, dy, dw != null ? dw : sw, dh != null ? dh : sh);
                c.restore();
            } else {
                const p = t.p, pi = this.toP5Image(p);
                if (!pi) return this;
                p.push(); p.imageMode(p.CORNER); p.tint(255, this.alpha * 255);
                p.image(pi, dx, dy, dw != null ? dw : sw, dh != null ? dh : sh, sx, sy, sw, sh);
                p.pop();
            }
            return this;
        }

        _render(target, x, y, w, h) {
            if (!this.visible) return this;
            const t = MAL._resolveTarget(target);
            if (!t) { warnOnce('no-target', 'No drawing target found. Call setDrawTarget(ctx), newCanvas(), or create a p5 canvas first.'); return this; }

            // Not usable yet: draw a missing-image marker for failures (so you notice), nothing while loading.
            if (!this.loaded) {
                if (this.failed && MAL.showMissing) this._drawMissing(t, x, y, w || 32, h || 32);
                return this;
            }
            this._beforeRender();
            const fr = this._frameRect();
            if (t.kind === '2d') this._render2d(t.ctx, x, y, w, h, fr);
            else                 this._renderP5(t.p, x, y, w, h, fr);
            return this;
        }

        _render2d(c, x, y, w, h, fr) {
            c.save();
            c.translate(x, y);
            if (this.angle) c.rotate(this.angle * DEG2RAD);
            c.scale(this.scaleX * (this.flipX ? -1 : 1), this.scaleY * (this.flipY ? -1 : 1));
            c.globalAlpha *= this.alpha;
            c.imageSmoothingEnabled = this.smoothing;
            c.drawImage(this.element, fr.sx, fr.sy, fr.sw, fr.sh, -this.anchorX * w, -this.anchorY * h, w, h);
            c.restore();
        }

        // p5 WEBGL fallback (2D p5 canvases take the fast Canvas path above).
        _renderP5(p, x, y, w, h, fr) {
            const pi = this.toP5Image(p);
            if (!pi) return;
            const prevAngleMode = p._angleMode;
            p.push();
            p.angleMode(p.RADIANS || 'radians');
            p.translate(x, y);
            if (this.angle) p.rotate(this.angle * DEG2RAD);
            p.scale(this.scaleX * (this.flipX ? -1 : 1), this.scaleY * (this.flipY ? -1 : 1));
            p.imageMode(p.CORNER);
            p.tint(255, this.alpha * 255);
            p.image(pi, -this.anchorX * w, -this.anchorY * h, w, h, fr.sx, fr.sy, fr.sw, fr.sh);
            p.pop();
            if (prevAngleMode) p.angleMode(prevAngleMode);
        }

        _drawMissing(t, x, y, w, h) {
            if (t.kind !== '2d') return;
            const c = t.ctx;
            c.save();
            c.translate(x, y);
            c.fillStyle = '#ff00ff'; c.fillRect(-this.anchorX * w, -this.anchorY * h, w, h);
            c.fillStyle = '#000';
            c.fillRect(-this.anchorX * w, -this.anchorY * h, w / 2, h / 2);
            c.fillRect(-this.anchorX * w + w / 2, -this.anchorY * h + h / 2, w / 2, h / 2);
            c.restore();
        }

        // ---- geometry helpers ----
        /** The four corners (world space) after anchor, scale, flip and rotation. */
        corners() {
            const w = this.width, h = this.height, a = this.angle * DEG2RAD;
            const cos = Math.cos(a), sin = Math.sin(a);
            const fx = this.scaleX * (this.flipX ? -1 : 1), fy = this.scaleY * (this.flipY ? -1 : 1);
            return [[0, 0], [w, 0], [w, h], [0, h]].map(([px, py]) => {
                const lx = (px - this.anchorX * w) * fx, ly = (py - this.anchorY * h) * fy;
                return { x: this.x + lx * cos - ly * sin, y: this.y + lx * sin + ly * cos };
            });
        }

        /** Axis-aligned bounding box of the drawn image: { x, y, w, h }. */
        bounds() {
            const c = this.corners();
            const xs = c.map(p => p.x), ys = c.map(p => p.y);
            const x = Math.min(...xs), y = Math.min(...ys);
            return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
        }

        /** True when the world point (px, py) is inside the drawn (rotated) image. */
        contains(px, py) {
            const a = -this.angle * DEG2RAD, cos = Math.cos(a), sin = Math.sin(a);
            const dx = px - this.x, dy = py - this.y;
            const fx = this.scaleX * (this.flipX ? -1 : 1), fy = this.scaleY * (this.flipY ? -1 : 1);
            if (!fx || !fy) return false;
            const lx = (dx * cos - dy * sin) / fx, ly = (dx * sin + dy * cos) / fy;
            const w = this.width, h = this.height;
            return lx >= -this.anchorX * w && lx <= (1 - this.anchorX) * w &&
                   ly >= -this.anchorY * h && ly <= (1 - this.anchorY) * h;
        }

        // ---- making new images from this one (call after `await img.ready`) ----
        /** An independent object that shares the same pixels. */
        clone(overrides = {}) {
            const c = new this.constructor(this.element, Object.assign({}, this._cloneOpts(), overrides, { name: overrides.name || null }));
            return c;
        }
        _cloneOpts() {
            return { x: this.x, y: this.y, angle: this.angle, scaleX: this.scaleX, scaleY: this.scaleY,
                     anchorX: this.anchorX, anchorY: this.anchorY, alpha: this.alpha, flipX: this.flipX,
                     flipY: this.flipY, smoothing: this.smoothing, visible: this.visible,
                     width: this._w, height: this._h };
        }

        /** A new image holding just a rectangle of this one. */
        crop(x, y, w, h, opts = {}) {
            if (!this.loaded) { warnOnce('crop-early', 'crop() called before the image finished loading. Use `await img.ready` first.'); return null; }
            const cv = makeCanvas(w, h);
            cv.getContext('2d').drawImage(this.element, x, y, w, h, 0, 0, w, h);
            return new ImageObject(cv, opts);
        }

        /** A new image with a colour laid over the non-transparent pixels. strength 0..1. */
        tinted(color, strength = 1, opts = {}) {
            if (!this.loaded) { warnOnce('tint-early', 'tinted() called before the image finished loading. Use `await img.ready` first.'); return null; }
            const fr = this._frameRect();
            const cv = makeCanvas(fr.sw, fr.sh), c = cv.getContext('2d');
            c.drawImage(this.element, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh);
            c.globalCompositeOperation = 'source-atop';
            c.globalAlpha = clamp(strength, 0, 1);
            c.fillStyle = color;
            c.fillRect(0, 0, fr.sw, fr.sh);
            return new ImageObject(cv, opts);
        }

        // ---- pixel access / export (null when the canvas is tainted, e.g. on file://) ----
        toCanvas() {
            if (!this.loaded) return null;
            const fr = this._frameRect();
            const cv = makeCanvas(fr.sw, fr.sh);
            cv.getContext('2d').drawImage(this.element, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh);
            return cv;
        }
        getPixel(x, y) {
            const cv = this.toCanvas();
            if (!cv) return null;
            try { return Array.from(cv.getContext('2d').getImageData(x | 0, y | 0, 1, 1).data); }
            catch (e) { warnOnce('tainted', 'Pixel reads are blocked by the browser here (images from file:// taint the canvas). Run from a local server to use getPixel/toDataURL.'); return null; }
        }
        toDataURL(type) {
            const cv = this.toCanvas();
            if (!cv || !cv.toDataURL) return null;
            try { return cv.toDataURL(type); }
            catch (e) { warnOnce('tainted', 'toDataURL is blocked by the browser here (images from file:// taint the canvas).'); return null; }
        }

        /** Converts to a p5.Image (cached). Needs p5; pass a p5 instance in instance mode. */
        toP5Image(p) {
            const api = MAL._p5api(p);
            if (!api || !this.loaded) return null;
            if (this._p5Cache) return this._p5Cache;
            const fr = this._frameRect();
            const pi = api.createImage(fr.sw, fr.sh);
            pi.drawingContext.drawImage(this.element, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh);
            if (pi.setModified) pi.setModified(true);
            this._p5Cache = pi;
            return pi;
        }
    }

    // ============================================
    // SpriteObject  (image + frames + animations)
    // ============================================
    /**
     * A ImageObject cut into equal frames (a sprite sheet) with named animations.
     *
     * opts (on top of ImageObject's): frameWidth, frameHeight, spacing, frames (count),
     *   frame (start index), fps (default 10), autoUpdate (default true),
     *   animations: { name: [0,1,2] | { frames:[..] | from,to, fps, loop, next } },
     *   play: 'animationName', onAnimationEnd(name, sprite)
     *
     * With autoUpdate the animation advances by real time each time you draw().
     * Set autoUpdate:false and call sprite.update(dtSeconds) yourself if you
     * want to drive it from a fixed-timestep loop.
     */
    class SpriteObject extends ImageObject {
        constructor(source, opts = {}) {
            super(source, opts);
            this.frameWidth   = opts.frameWidth  || null;   // null -> whole image width
            this.frameHeight  = opts.frameHeight || null;
            this.spacing      = opts.spacing || 0;
            this.frameLimit   = opts.frames || null;        // cap on frame count (partial last row)
            this.fps          = opts.fps || 10;
            this.speed        = 1;                          // playback multiplier
            this.frame        = opts.frame || 0;
            this.autoUpdate   = opts.autoUpdate !== false;
            this.animations   = {};
            this.current      = null;
            this.playing      = false;
            this.onAnimationEnd = opts.onAnimationEnd || null;
            this._t = 0;
            this._last = null;
            if (opts.animations) for (const k of Object.keys(opts.animations)) this.addAnimation(k, opts.animations[k]);
            if (typeof opts.play === 'string') this.play(opts.play);
        }

        // ---- layout (computed lazily, so it works however/whenever the image loads) ----
        get columns() { const fw = this.frameWidth  || this.naturalWidth;  return Math.max(1, Math.floor((this.naturalWidth  + this.spacing) / (fw + this.spacing))); }
        get rows()    { const fh = this.frameHeight || this.naturalHeight; return Math.max(1, Math.floor((this.naturalHeight + this.spacing) / (fh + this.spacing))); }
        get frameCount() { const n = this.columns * this.rows; return this.frameLimit ? Math.min(this.frameLimit, n) : n; }

        _frameRect() {
            const fw = this.frameWidth || this.naturalWidth, fh = this.frameHeight || this.naturalHeight;
            if (!this.loaded) return { sx: 0, sy: 0, sw: fw, sh: fh };
            const f = clamp(this.frame | 0, 0, Math.max(0, this.frameCount - 1));
            const col = f % this.columns, row = Math.floor(f / this.columns);
            return { sx: col * (fw + this.spacing), sy: row * (fh + this.spacing), sw: fw, sh: fh };
        }

        // ---- animations ----
        /** Define an animation: addAnimation('run', { from: 0, to: 5, fps: 12 }) or addAnimation('idle', [0, 1]). */
        addAnimation(name, def) {
            if (Array.isArray(def)) def = { frames: def };
            let frames = def.frames;
            if (!Array.isArray(frames) && def.from != null && def.to != null) {
                frames = [];
                const step = def.to >= def.from ? 1 : -1;
                for (let i = def.from; step > 0 ? i <= def.to : i >= def.to; i += step) frames.push(i);
            }
            this.animations[name] = { frames: frames || [0], fps: def.fps || this.fps, loop: def.loop !== false, next: def.next || null };
            return this;
        }

        /** Start an animation. Calling play() with the one already running keeps it going (pass {restart:true} to restart). */
        play(name, o = {}) {
            const a = this.animations[name];
            if (!a) { log('warn', 'Unknown animation "' + name + '"' + (this.name ? ' on sprite "' + this.name + '"' : '')); return this; }
            if (this.current === name && this.playing && !o.restart) return this;
            this.current = name; this.playing = true; this._t = 0; this._last = null;
            this.frame = a.frames[0];
            return this;
        }
        pause()  { this.playing = false; return this; }
        resume() { if (this.current) { this.playing = true; this._last = null; } return this; }
        stop()   { this.playing = false; this.current = null; this._t = 0; return this; }
        setFrame(i) { this.frame = i; this.playing = false; return this; }

        /** Advance the animation by `dt` seconds. */
        update(dt) {
            if (!this.playing || !this.current) return this;
            const a = this.animations[this.current];
            const len = a.frames.length;
            if (!len) return this;
            this._t += dt * a.fps * this.speed;
            if (this._t >= len) {
                if (a.loop) this._t = this._t % len;
                else {
                    this._t = len - 0.0001;
                    this.playing = false;
                    this.frame = a.frames[len - 1];
                    const finished = this.current;
                    if (this.onAnimationEnd) { try { this.onAnimationEnd(finished, this); } catch (e) { log('error', e); } }
                    if (a.next && this.animations[a.next]) this.play(a.next);
                    return this;
                }
            }
            this.frame = a.frames[Math.floor(this._t)];
            return this;
        }

        _beforeRender() {
            if (!this.autoUpdate || !this.playing) { this._last = null; return; }
            const t = now();
            if (this._last != null) this.update(Math.min(0.1, (t - this._last) / 1000));
            this._last = t;
        }

        _cloneOpts() {
            return Object.assign(super._cloneOpts(), {
                frameWidth: this.frameWidth, frameHeight: this.frameHeight, spacing: this.spacing,
                frames: this.frameLimit, fps: this.fps, frame: this.frame, autoUpdate: this.autoUpdate,
                animations: Object.assign({}, this.animations)
            });
        }
    }

    // ============================================
    // SoundVoice  (one playing instance of a SoundObject)
    // ============================================
    /** Returned by `sound.play()`. Lets you stop / fade / change just that playback. */
    class SoundVoice {
        constructor(owner, el, opts) {
            this.owner   = owner;
            this.element = el;
            this.volume  = opts.volume != null ? opts.volume : 1;
            this.loop    = opts.loop != null ? opts.loop : owner.loop;
            this.rate    = opts.rate != null ? opts.rate : owner.rate;
            this.onend   = opts.onend || null;
            this.state   = 'idle';            // idle | playing | paused | ended
            this._opts   = opts;
            this._cancelFade = null;
        }

        get isPlaying()   { return this.state === 'playing'; }
        get currentTime() { return this.element.currentTime; }
        get duration()    { return this.element.duration; }

        _apply() {
            const el = this.element;
            el.volume = clamp(this.volume * this.owner.volume * MAL._volumeFor(this.owner.group), 0, 1);
            el.muted  = !!(this.owner.muted || MAL.muted);
        }

        _start() {
            const el = this.element, o = this._opts;
            this.state = 'playing';
            MAL._voices.add(this);
            this.owner._claims.set(el, this);
            try { el.currentTime = o.start || 0; } catch (e) { /* metadata not ready yet; plays from 0 */ }
            el.loop = this.loop;
            el.playbackRate = this.rate;
            this._apply();
            el.onended = () => this._end(true);
            let p;
            try { p = el.play(); } catch (e) { this._end(false); return; }
            if (p && p.catch) p.catch((err) => {
                if (err && err.name === 'NotAllowedError') {
                    // Browser blocks sound until the player interacts. Looping sounds (music)
                    // and play({queue:true}) wait and start on the first click / key / touch.
                    if (this.loop || o.queue) MAL._pending.add(this);
                    else this._end(false);
                } else this._end(false);
            });
        }

        _end(natural) {
            if (this.state === 'ended') return;
            this.state = 'ended';
            if (this._cancelFade) this._cancelFade();
            MAL._voices.delete(this);
            MAL._pending.delete(this);
            if (this.owner._claims.get(this.element) === this) this.owner._claims.delete(this.element);
            if (natural && this.onend) { try { this.onend(this); } catch (e) { log('error', e); } }
        }

        pause()  { if (this.state === 'playing') { this.element.pause(); this.state = 'paused'; } return this; }
        resume() { if (this.state === 'paused')  { this.state = 'playing'; const p = this.element.play(); if (p && p.catch) p.catch(() => {}); } return this; }
        stop()   {
            if (this.state === 'ended') return this;
            this.element.pause();
            try { this.element.currentTime = 0; } catch (e) { /* ignore */ }
            this._end(false);
            return this;
        }
        seek(t)       { try { this.element.currentTime = t; } catch (e) { /* ignore */ } return this; }
        setVolume(v)  { this.volume = clamp(v, 0, 1); this._apply(); return this; }
        setRate(r)    { this.rate = r; this.element.playbackRate = r; return this; }

        /** Fade this voice's volume to `v` over `seconds`; optionally stop when done. */
        fadeTo(v, seconds, stopAtEnd = false) {
            if (this._cancelFade) this._cancelFade();
            this._cancelFade = tween(this.volume, v, seconds,
                (x) => { this.volume = x; this._apply(); },
                () => { this._cancelFade = null; if (stopAtEnd) this.stop(); });
            return this;
        }
    }

    // ============================================
    // SoundObject
    // ============================================
    /**
     * A sound object.
     *
     * `src` is one URL or an array of fallbacks: ['boom.ogg', 'boom.mp3'] - the
     * first format this browser can play is used.
     *
     * opts: name, volume (0..1), loop, rate, group ('sfx' default, 'music' ...),
     *       pool (max overlapping plays; default 4, music default 1),
     *       onBusy ('steal' = restart the oldest voice [default] | 'ignore'),
     *       crossOrigin, onload(snd), onerror(snd, err)
     *
     * play() returns a SoundVoice (or null if it could not start).
     */
    class SoundObject {
        constructor(src, opts = {}) {
            this.name     = opts.name || null;
            this.group    = opts.group || 'sfx';
            this.volume   = opts.volume != null ? opts.volume : 1;
            this.loop     = !!opts.loop;
            this.rate     = opts.rate != null ? opts.rate : 1;
            this.muted    = false;
            this.poolSize = opts.pool != null ? opts.pool : (this.group === 'music' ? 1 : 4);
            this.onBusy   = opts.onBusy || 'steal';
            this.sources  = [].concat(src);
            this.url      = this._pickSource();
            this.loaded   = false;
            this.failed   = false;
            this.unverified = false;      // true if the browser never confirmed loading (e.g. iOS before a tap)
            this.error    = null;
            this._opts    = opts;
            this._elements = [];          // pooled <audio> elements
            this._claims  = new Map();    // element -> SoundVoice currently using it
            this._cancelFade = null;
            this.ready    = new Promise((res) => { this._resolve = res; });

            this._init();
            MAL._track(this);
        }

        _pickSource() {
            const probe = HAS_DOM ? document.createElement('audio') : null;
            let first = null;
            for (const s of this.sources) {
                const u = resolveSrc(s);
                if (first == null) first = u;
                if (!probe || typeof u !== 'string') return u;
                let mime = '';
                const dm = /^data:([^;,]+)/i.exec(u);
                if (dm) mime = dm[1];
                else mime = EXT_MIME[(u.split(/[?#]/)[0].split('.').pop() || '').toLowerCase()] || '';
                if (!mime || probe.canPlayType(mime)) return u;
            }
            return first;
        }

        _makeElement() {
            const a = new Audio();
            a.preload = 'auto';
            if (this._opts.crossOrigin) a.crossOrigin = this._opts.crossOrigin;   // intentionally NOT defaulted (breaks file://)
            a.src = this.url;
            return a;
        }

        _init() {
            if (!HAS_DOM || typeof Audio === 'undefined') { this._finish(false, new graphicsError('Audio is not available in this environment.')); return; }
            const a = this._makeElement();
            this._elements.push(a);
            const ok  = () => this._finish(true);
            a.addEventListener('canplaythrough', ok, { once: true });
            a.addEventListener('loadeddata',     ok, { once: true });
            a.addEventListener('error', () => this._finish(false, new graphicsError('Could not load audio "' + this.sources.join(', ') + '"')), { once: true });
            // Some mobile browsers do not preload until a tap: don't hang assetsReady() forever.
            setTimeout(() => { if (!this._done) { this.unverified = true; this._finish(true); } }, 8000);
        }

        _finish(ok, err) {
            if (this._done) return;
            this._done = true;
            this.loaded = ok; this.failed = !ok; this.error = err || null;
            if (!ok) log('error', err ? err.message : 'audio failed');
            try {
                if (ok && this._opts.onload)   this._opts.onload(this);
                if (!ok && this._opts.onerror) this._opts.onerror(this, err);
            } catch (e) { log('error', e); }
            this._resolve(this);
        }

        get element()   { return this._elements[0] || null; }
        get duration()  { return this.element ? this.element.duration : 0; }
        get isPlaying() { for (const v of this._claims.values()) if (v.isPlaying) return true; return false; }
        get voices()    { return Array.from(this._claims.values()); }

        // Find an <audio> element that is not in use (or make/steal one).
        _acquire() {
            let el = this._elements.find((e) => !this._claims.has(e));
            if (el) return el;
            if (this._elements.length < this.poolSize) {
                el = this._makeElement();
                this._elements.push(el);
                return el;
            }
            if (this.onBusy === 'ignore') return null;
            const oldest = this._claims.values().next().value;     // Map keeps insertion order
            if (!oldest) return null;
            const stolen = oldest.element;
            oldest.stop();
            return stolen;
        }

        /** Play the sound. opts: volume, loop, rate, start (seconds), onend, queue (wait for first user gesture). */
        play(opts = {}) {
            if (this.failed) return null;
            const el = this._acquire();
            if (!el) return null;
            const voice = new SoundVoice(this, el, opts);
            voice._start();
            return voice;
        }

        stop()   { for (const v of this.voices) v.stop();   return this; }
        pause()  { for (const v of this.voices) v.pause();  return this; }
        resume() { for (const v of this.voices) v.resume(); return this; }

        /** Change this sound's base volume (affects playing voices too). */
        setVolume(v) { this.volume = clamp(v, 0, 1); for (const vc of this.voices) vc._apply(); return this; }
        mute()   { this.muted = true;  for (const v of this.voices) v._apply(); return this; }
        unmute() { this.muted = false; for (const v of this.voices) v._apply(); return this; }

        /** Fade the whole sound (all voices) to volume `v`. Handy for music. */
        fadeTo(v, seconds, stopAtEnd = false) {
            if (this._cancelFade) this._cancelFade();
            this._cancelFade = tween(this.volume, v, seconds,
                (x) => this.setVolume(x),
                () => { this._cancelFade = null; if (stopAtEnd) this.stop(); });
            return this;
        }

        clone(overrides = {}) { return new SoundObject(this.sources, Object.assign({}, this._opts, { volume: this.volume, loop: this.loop, rate: this.rate, group: this.group, name: null }, overrides)); }

        /** Stop and release the audio elements. */
        dispose() {
            this.stop();
            for (const e of this._elements) { e.removeAttribute('src'); try { e.load(); } catch (err) { /* ignore */ } }
            this._elements = [];
        }
    }

    // ============================================
    // THE LIBRARY OBJECT  (also reachable as MALEngine)
    // ============================================
    const MAL = {
        VERSION,
        isFileProtocol: IS_FILE,     // true when the page was opened straight from disk

        // ---- classes ----
        Image: ImageObject, Sprite: SpriteObject, Audio: SoundObject, Voice: SoundVoice, Error: graphicsError,

        // ---- settings ----
        basePath: '',                // prefix for relative asset paths, e.g. 'assets/'
        embedded: {},                // name -> data-URI (assets baked into a .js file; see embed())
        showMissing: true,           // draw a magenta/black marker for images that failed to load
        muted: false,                // global mute

        // ---- registries (named assets are filed here automatically) ----
        images: {}, sprites: {}, sounds: {},

        // ---- internal state ----
        _ctx: null, _p5: null,
        _voices: new Set(), _pending: new Set(),
        _vol: { master: 1, groups: {} },
        _total: 0, _done: 0, _all: new Set(),
        _unlocked: false,

        // ------------------------------------------------
        // setup
        // ------------------------------------------------
        /** Prefix added to every relative asset path. */
        setBasePath(p) { MAL.basePath = p ? (p.endsWith('/') ? p : p + '/') : ''; return MAL; },

        /**
         * Register assets that are baked into a script as data-URIs, so a page
         * can run from disk with no loose files:  embedAsset('coin', 'data:image/png;base64,...')
         * Then newImage('coin') uses it.  Accepts (name, dataURI) or an object of them.
         */
        embed(name, data) {
            if (typeof name === 'object') for (const k of Object.keys(name)) MAL.embedded[k] = name[k];
            else MAL.embedded[name] = data;
            return MAL;
        },

        /** Replace where messages go: setAssetLogger((level, ...args) => ...). level = 'log' | 'warn' | 'error'. */
        setLogger(fn) { if (typeof fn === 'function') logger = fn; return MAL; },

        /** Pick the drawing target used when draw() is called without one: a canvas, 2D context, p5 instance or p5.Graphics. */
        setContext(target) {
            if (isCanvas(target)) MAL._ctx = target.getContext('2d');
            else if (target && target.drawingContext && !isCtx2d(target)) { MAL._ctx = null; MAL._p5 = target; }   // p5 instance
            else MAL._ctx = target || null;
            return MAL;
        },

        /** For p5 instance mode:  new p5((p) => { useP5(p); ... }). Global mode needs nothing. */
        attachP5(p) { MAL._p5 = p; return MAL; },

        /** Standalone helper: makes a <canvas>, adds it to `parent` (element or selector, default <body>) and uses it. */
        createCanvas(w = 640, h = 360, parent) {
            const cv = makeCanvas(w, h);
            const add = () => {
                const host = typeof parent === 'string' ? document.querySelector(parent) : (parent || document.body);
                if (host) host.appendChild(cv);
            };
            if (document.body || parent) add(); else document.addEventListener('DOMContentLoaded', add, { once: true });
            MAL.setContext(cv);
            return cv;
        },

        // ------------------------------------------------
        // creating assets
        // ------------------------------------------------
        /** Make a ImageObject. */
        image(src, opts = {}) { return MAL._register(new ImageObject(src, opts), 'images'); },
        /** Make a SpriteObject (sprite sheet + animations). */
        sprite(src, opts = {}) { return MAL._register(new SpriteObject(src, opts), 'sprites'); },
        /** Make a SoundObject. */
        sound(src, opts = {}) { return MAL._register(new SoundObject(src, opts), 'sounds'); },

        /**
         * Load a whole set at once and get a Promise back.
         *   await loadAssets({
         *     images:  { ship: 'ship.png', bg: { src: 'bg.png', smoothing: false } },
         *     sprites: { coin: { src: 'coin.png', frameWidth: 32, frameHeight: 32, animations: {...} } },
         *     sounds:  { boom: 'boom.wav', theme: { src: ['t.ogg','t.mp3'], loop: true, group: 'music' } }
         *   }, { onProgress: (done, total, name) => {} });
         * Resolves to { images, sprites, sounds }; also reachable as imageAssets.ship, soundAssets.boom, etc.
         * Assets that fail to load are reported in the console and flagged `.failed`.
         */
        load(manifest = {}, opts = {}) {
            const out = { images: {}, sprites: {}, sounds: {} };
            const all = [];
            const build = (key, outKey, make) => {
                const group = manifest[key];
                if (!group) return;
                for (const name of Object.keys(group)) {
                    const def = group[name];
                    const o = (typeof def === 'string' || Array.isArray(def)) ? { src: def } : Object.assign({}, def);
                    const asset = make(o.src, Object.assign({}, o, { name }));
                    out[outKey][name] = asset;
                    all.push(asset);
                }
            };
            build('images',  'images',  MAL.image);
            build('sprites', 'sprites', MAL.sprite);
            build('sounds',  'sounds',  MAL.sound);
            build('audio',   'sounds',  MAL.sound);

            let done = 0;
            return Promise.all(all.map((a) => a.ready.then(() => { done++; if (opts.onProgress) opts.onProgress(done, all.length, a.name); })))
                .then(() => {
                    const bad = all.filter((a) => a.failed).map((a) => a.name);
                    if (bad.length) log('warn', 'Failed to load: ' + bad.join(', '));
                    return out;
                });
        },

        /** Promise that resolves when every asset created so far has finished loading (or failed). */
        ready() { return Promise.all(Array.from(MAL._all).map((a) => a.ready)).then(() => MAL); },
        /** Loading progress of everything created so far, 0..1. */
        get progress() { return MAL._total ? MAL._done / MAL._total : 1; },

        /** Look up a named asset (image, sprite or sound). */
        get(name) { return MAL.images[name] || MAL.sprites[name] || MAL.sounds[name] || null; },

        /** Remove a named asset from the registry (sounds are stopped and released). */
        remove(name) {
            for (const reg of ['images', 'sprites', 'sounds']) {
                const a = MAL[reg][name];
                if (!a) continue;
                if (a.dispose) a.dispose();
                delete MAL[reg][name];
                MAL._all.delete(a);
            }
            return MAL;
        },

        // ------------------------------------------------
        // audio controls (all sounds)
        // ------------------------------------------------
        /** setVolume('master', 0.5) or setVolume('music', 0.3). Affects playing sounds immediately. */
        setVolume(which, v) {
            v = clamp(v, 0, 1);
            if (which === 'master') MAL._vol.master = v; else MAL._vol.groups[which] = v;
            for (const voice of MAL._voices) voice._apply();
            return MAL;
        },
        getVolume(which) { return which === 'master' ? MAL._vol.master : (MAL._vol.groups[which] != null ? MAL._vol.groups[which] : 1); },
        _volumeFor(group) { return MAL._vol.master * (MAL._vol.groups[group] != null ? MAL._vol.groups[group] : 1); },

        mute()   { MAL.muted = true;  for (const v of MAL._voices) v._apply(); return MAL; },
        unmute() { MAL.muted = false; for (const v of MAL._voices) v._apply(); return MAL; },
        toggleMute() { return MAL.muted ? MAL.unmute() : MAL.mute(); },
        stopAllSounds()   { for (const v of Array.from(MAL._voices)) v.stop();   return MAL; },
        pauseAllSounds()  { for (const v of Array.from(MAL._voices)) v.pause();  return MAL; },
        resumeAllSounds() { for (const v of Array.from(MAL._voices)) v.resume(); return MAL; },

        /** True once the player has interacted with the page (browsers block sound before that). */
        get audioUnlocked() { return MAL._unlocked; },

        // Called on the first click / key / touch: starts any sound that was waiting.
        _unlock() {
            if (MAL._unlocked) return;
            MAL._unlocked = true;
            for (const ev of UNLOCK_EVENTS) document.removeEventListener(ev, MAL._unlock, true);
            for (const v of Array.from(MAL._pending)) {
                MAL._pending.delete(v);
                if (v.state !== 'playing') continue;
                const p = v.element.play();
                if (p && p.catch) p.catch(() => v._end(false));
            }
        },

        // ------------------------------------------------
        // standalone render loop (no p5 needed)
        // ------------------------------------------------
        /**
         * A tiny game loop for using the library on its own:
         *   const app = runApp({
         *     width: 640, height: 360, background: '#111',
         *     setup(ctx, canvas) { ... create assets ... },
         *     update(dt)         { ... dt in seconds ... },
         *     draw(ctx, dt)      { ... img.draw(); ... }
         *   });
         *   app.stop();   // end the loop
         * The loop starts after the assets created in setup() finish loading
         * (set waitForAssets:false to start immediately).
         */
        run(cfg = {}) {
            const canvas = cfg.canvas || MAL.createCanvas(cfg.width || 640, cfg.height || 360, cfg.parent);
            const ctx = canvas.getContext('2d');
            MAL.setContext(ctx);
            let running = true, raf = null, last = now();

            const frame = (t) => {
                if (!running) return;
                const dt = Math.min(0.1, (t - last) / 1000);
                last = t;
                if (cfg.background) { ctx.fillStyle = cfg.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
                else ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (cfg.update) cfg.update(dt);
                if (cfg.draw)   cfg.draw(ctx, dt);
                raf = requestAnimationFrame(frame);
            };
            const start = () => { if (!running) return; last = now(); raf = requestAnimationFrame(frame); };
            const go = () => {
                if (cfg.setup) cfg.setup(ctx, canvas);
                if (cfg.waitForAssets === false) start(); else MAL.ready().then(start);
            };
            if (HAS_DOM && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();

            return { canvas, ctx, stop() { running = false; if (raf) cancelAnimationFrame(raf); } };
        },

        // ------------------------------------------------
        // p5.js helpers
        // ------------------------------------------------
        /**
         * p5 1.x: keeps p5 from calling setup() until every asset created so far has loaded.
         * Call it at the END of preload():
         *     function preload() { ship = newImage('ship.png'); holdP5Preload(); }
         * (p5 2.x has no preload - use `async function setup() { await assetsReady(); ... }`.)
         * Returns a release() function, or null if the hook isn't available.
         */
        holdP5() {
            const api = MAL._p5api();
            if (!api || typeof api._incrementPreload !== 'function' || typeof api._decrementPreload !== 'function') {
                warnOnce('hold-p5', 'holdP5() needs p5 1.x global/instance mode. Use `await assetsReady()` in an async setup() instead.');
                return null;
            }
            api._incrementPreload();
            let released = false;
            const release = () => { if (!released) { released = true; api._decrementPreload(); } };
            MAL.ready().then(release, release);
            return release;
        },

        _p5api(p) {
            if (p && typeof p.image === 'function' && typeof p.push === 'function') return p;
            if (MAL._p5) return MAL._p5;
            if (typeof root.image === 'function' && typeof root.push === 'function' && typeof root.createImage === 'function') return root;
            return null;
        },

        // ------------------------------------------------
        // internals
        // ------------------------------------------------
        _register(asset, reg) {
            if (asset.name) {
                if (MAL[reg][asset.name] && MAL[reg][asset.name] !== asset) log('warn', 'Replacing existing ' + reg.slice(0, -1) + ' "' + asset.name + '"');
                MAL[reg][asset.name] = asset;
            }
            return asset;
        },

        _track(asset) {
            MAL._all.add(asset);
            MAL._total++;
            asset.ready.then(() => { MAL._done++; });
        },

        // Works out what to draw on: { kind:'2d', ctx } or { kind:'p5', p }.
        _resolveTarget(target) {
            const fromContext = (ctx, p) => {
                if (isCtx2d(ctx)) return { kind: '2d', ctx };
                const api = MAL._p5api(p);                 // WEBGL p5 canvas -> go through p5's image()
                return api ? { kind: 'p5', p: api } : null;
            };
            if (target) {
                if (isCtx2d(target)) return { kind: '2d', ctx: target };
                if (isCanvas(target)) { const c = target.getContext('2d'); return c ? { kind: '2d', ctx: c } : null; }
                if (target.drawingContext) return fromContext(target.drawingContext, target);    // p5 / p5.Graphics
                return null;
            }
            if (MAL._ctx) return { kind: '2d', ctx: MAL._ctx };
            if (MAL._p5 && MAL._p5.drawingContext) return fromContext(MAL._p5.drawingContext, MAL._p5);
            if (root.drawingContext) return fromContext(root.drawingContext, null);              // p5 global mode
            if (HAS_DOM) {
                const cv = document.querySelector('canvas');
                const c = cv && cv.getContext && cv.getContext('2d');
                if (c) return { kind: '2d', ctx: c };
            }
            return null;
        }
    };

    // First-interaction listeners that let blocked audio start.
    const UNLOCK_EVENTS = ['pointerdown', 'mousedown', 'keydown', 'touchend'];
    if (HAS_DOM) for (const ev of UNLOCK_EVENTS) document.addEventListener(ev, MAL._unlock, true);

    // ============================================
    // BUILT-IN HELP  (help('newImage'), help('ImageObject.draw'), help('audio') ...)
    // ============================================
    // The documentation below is plain data. help() looks things up in it and prints
    // them to the console; helpText() returns the same text as a string.
    const par = (n, t, d, x) => ({ n, t, d, x });          // parameter: name, type, default (undefined = required), description
    const mth = (sig, sum, params, ret, ex) => ({ kind: 'method', sig, sum, params: params || [], ret, ex });
    const prp = (n, t, x) => ({ n, t, x });                 // property: name, type, description

    // ---- option lists shared by several entries ----
    const IMAGE_OPTS = [
        par('name', 'string', 'null', 'Files the object in imageAssets / spriteAssets / soundAssets under this name (loadAssets sets it for you).'),
        par('x', 'number', '0', 'Draw position, horizontal.'),
        par('y', 'number', '0', 'Draw position, vertical.'),
        par('width', 'number', 'natural width', 'Display width before scale. For sprites: the width of one frame.'),
        par('height', 'number', 'natural height', 'Display height before scale. For sprites: the height of one frame.'),
        par('angle', 'number', '0', 'Rotation in DEGREES (clockwise on screen) around the anchor point.'),
        par('scale', 'number', '1', 'Uniform scale. scaleX / scaleY override it per axis.'),
        par('scaleX', 'number', 'scale', 'Horizontal scale. Negative values mirror the image.'),
        par('scaleY', 'number', 'scale', 'Vertical scale. Negative values mirror the image.'),
        par('anchorX', 'number 0..1', '0', 'Which point of the image sits on x/y: 0 = left edge, 0.5 = centre, 1 = right edge. Rotation and scale happen around it.'),
        par('anchorY', 'number 0..1', '0', 'Same, vertically: 0 = top, 0.5 = centre, 1 = bottom.'),
        par('alpha', 'number 0..1', '1', 'Opacity. Multiplied with whatever alpha the target is already using.'),
        par('flipX', 'boolean', 'false', 'Mirror horizontally (around the anchor).'),
        par('flipY', 'boolean', 'false', 'Mirror vertically (around the anchor).'),
        par('smoothing', 'boolean', 'true', 'false = crisp, unblurred scaling (pixel art).'),
        par('visible', 'boolean', 'true', 'false = draw() does nothing.'),
        par('crossOrigin', 'string', 'not set', 'Only for images hosted on another site: "anonymous". Leave it out on file:// - setting it stops images loading there.'),
        par('onload', 'function(image)', 'none', 'Called once when loading succeeds.'),
        par('onerror', 'function(image, error)', 'none', 'Called once if loading fails.')
    ];
    const SPRITE_OPTS = [
        par('frameWidth', 'number', 'whole image width', 'Width of one frame in the sheet.'),
        par('frameHeight', 'number', 'whole image height', 'Height of one frame in the sheet.'),
        par('spacing', 'number', '0', 'Gap in pixels between frames in the sheet.'),
        par('frames', 'number', 'columns x rows', 'Total frame count, if the last row is only partly filled.'),
        par('frame', 'number', '0', 'Frame shown before any animation starts. Frames count left-to-right, then top-to-bottom, from 0.'),
        par('fps', 'number', '10', 'Default animation speed (frames per second) for animations that do not set their own.'),
        par('autoUpdate', 'boolean', 'true', 'true = the animation advances by real time every time you draw(). false = you call update(dt) yourself.'),
        par('animations', 'object', 'none', 'Named animations, e.g. { run: { from: 0, to: 5, fps: 12 }, idle: [0, 1] }. See help("SpriteObject.addAnimation").'),
        par('play', 'string', 'none', 'Name of an animation to start right away.'),
        par('onAnimationEnd', 'function(name, sprite)', 'none', 'Called when a non-looping animation finishes.')
    ];
    const SOUND_OPTS = [
        par('name', 'string', 'null', 'Files the sound in soundAssets under this name.'),
        par('volume', 'number 0..1', '1', 'Base volume of this sound (multiplied with its group and master volume).'),
        par('loop', 'boolean', 'false', 'Repeat forever when played.'),
        par('rate', 'number', '1', 'Playback speed: 1 = normal, 2 = double speed (and higher pitch).'),
        par('group', 'string', '"sfx"', 'Volume group. Use any name; "music" is the usual second group. See setGroupVolume.'),
        par('pool', 'number', '4 (music group: 1)', 'How many copies may play at once. Each play() uses a free copy.'),
        par('onBusy', '"steal" | "ignore"', '"steal"', 'When every copy in the pool is busy: "steal" restarts the oldest one, "ignore" skips the new play().'),
        par('crossOrigin', 'string', 'not set', 'Only for audio hosted on another site. Leave it out on file://.'),
        par('onload', 'function(sound)', 'none', 'Called once when loading succeeds.'),
        par('onerror', 'function(sound, error)', 'none', 'Called once if loading fails.')
    ];
    const PLAY_OPTS = [
        par('volume', 'number 0..1', '1', 'Volume of this one playback (multiplied with sound, group and master volume).'),
        par('loop', 'boolean', 'the sound\'s loop', 'Repeat this playback forever.'),
        par('rate', 'number', 'the sound\'s rate', 'Playback speed for this playback.'),
        par('start', 'number', '0', 'Start position in seconds.'),
        par('onend', 'function(voice)', 'none', 'Called when the sound reaches its natural end (not when stopped).'),
        par('queue', 'boolean', 'false', 'If the browser blocks sound (no click/key/touch yet), wait and start on the first interaction instead of dropping it. Looping sounds always wait.')
    ];
    const SRC_IMG = 'string | HTMLImageElement | canvas | ImageBitmap | p5.Image';

    // ---- the documentation ----
    const DOCS = {
        // ============ guides ============
        'getting-started': { kind: 'guide', sig: 'getting-started', sum: 'The 60-second tour.', body: [
            '1. Add the script after p5 (or on its own):  <script src="libs/MALEngine/MALEngine.js"></script>',
            '2. Make things:      const ship = newImage("ship.png", { x: 100, y: 100, anchorX: 0.5, anchorY: 0.5 });',
            '                     const boom = newSound("boom.wav");',
            '3. Use them:         ship.draw();   boom.play();',
            '',
            'Everything is a global (no library prefix). Angles are in DEGREES.',
            'Files load in the background: draw() simply does nothing until the image is ready.',
            'To wait for loading: await ship.ready, await assetsReady(), or await loadAssets({...}).',
            'Next: help("loading"), help("drawing"), help("sprites"), help("audio"), help("p5"), help("standalone"), help("file").'] },
        loading: { kind: 'guide', sig: 'loading', sum: 'How assets load and how to wait for them.', body: [
            'newImage / newSprite / newSound start loading immediately and return the object at once.',
            'Every object has .loaded, .failed, .error and .ready (a Promise that never rejects - check .failed).',
            'Load a batch with names:   const a = await loadAssets({ images: { ship: "ship.png" }, sounds: { boom: "boom.wav" } });',
            'Named assets are filed in imageAssets / spriteAssets / soundAssets, so later:  imageAssets.ship.draw();',
            'Wait for everything created so far:  await assetsReady();   Progress 0..1:  assetProgress()',
            'Folder prefix for relative paths:  setAssetPath("assets/");',
            'A failed image draws a magenta/black marker (showMissingImages(false) turns it off); a failed sound just returns null from play().',
            'See also: loadAssets, assetsReady, setAssetPath, embedAsset.'] },
        drawing: { kind: 'guide', sig: 'drawing', sum: 'Where images get drawn (the draw target).', body: [
            'img.draw() draws onto the "current target", found in this order:',
            '  1. a target you pass:  img.draw(ctx)  (canvas, 2D context, p5 instance, p5.Graphics)',
            '  2. one you set once:   setDrawTarget(canvasOrCtx)  or  newCanvas(w, h)',
            '  3. the p5 canvas (global mode, or after useP5(p))',
            '  4. the first <canvas> on the page',
            'Transform order per draw: translate(x, y) -> rotate(angle) -> scale -> offset by anchor. alpha multiplies the target\'s own alpha.',
            'Hit testing and collisions: img.contains(x, y), img.bounds(), img.corners() all respect angle, scale, flip and anchor.',
            'See also: ImageObject.draw, ImageObject.drawAt, ImageObject.drawRegion, setDrawTarget.'] },
        sprites: { kind: 'guide', sig: 'sprites', sum: 'Sprite sheets and animations.', body: [
            'A sprite sheet is one image of equal-sized frames, numbered left-to-right then top-to-bottom from 0.',
            '  const coin = newSprite("coin.png", { frameWidth: 32, frameHeight: 32,',
            '      animations: { spin: { from: 0, to: 3, fps: 8 }, pop: { frames: [4,5,6], loop: false, next: "spin" } },',
            '      play: "spin" });',
            '  coin.draw();          // animation advances by real time',
            '  coin.play("pop");     // switch animation',
            'Own timing: newSprite(..., { autoUpdate: false }) then call coin.update(dtSeconds) in your loop.',
            'A SpriteObject is also an ImageObject: every ImageObject method works on it.',
            'See also: SpriteObject, SpriteObject.addAnimation, SpriteObject.play.'] },
        audio: { kind: 'guide', sig: 'audio', sum: 'Playing sound, volume groups and the autoplay rule.', body: [
            'newSound() makes a SoundObject; sound.play() starts one playback and returns a SoundVoice you can stop or fade.',
            'Overlap: a sound has a pool of copies (opts.pool). Playing again while all are busy restarts the oldest (onBusy:"steal") or is skipped ("ignore").',
            'Volume = voice volume x sound volume x group volume x master volume. Set groups with setGroupVolume("music", 0.4); everything with setMasterVolume(v).',
            'Browsers block sound until the player clicks, presses a key or touches the page. Looping sounds (music) and play({ queue: true }) wait and start by themselves on that first interaction; other one-shot sounds are dropped. soundsUnlocked() tells you whether it has happened.',
            'Formats: pass a list of fallbacks, newSound(["a.ogg", "a.mp3"]); the first one the browser can play is used.',
            'Fades: sound.fadeTo(0.2, 2)   voice.fadeTo(0, 1, true)  (true = stop at the end).',
            'Works from file:// (plain <audio> elements; no Web Audio decoding is used).',
            'See also: newSound, SoundObject, SoundVoice, setMasterVolume, setGroupVolume, muteAll.'] },
        p5: { kind: 'guide', sig: 'p5', sum: 'Using the library with p5.js.', body: [
            'Global mode: nothing to set up - images draw on p5\'s canvas, and p5\'s own push/translate/scale still apply.',
            '  function preload() { ship = newImage("ship.png"); holdP5Preload(); }   // p5 waits for loading (p5 1.x)',
            '  p5 2.x has no preload:  async function setup() { await assetsReady(); createCanvas(...); }',
            'Instance mode: new p5((p) => { useP5(p); ... });',
            'p5.Graphics: img.draw(myGraphics).',
            'p5 images: img.toP5Image() gives a p5.Image; newImage(somep5Image) wraps one.',
            'WEBGL canvases work through p5\'s image(), but only over http - browsers do not allow file:// images as WebGL textures.',
            'Angles stay in degrees regardless of p5\'s angleMode().'] },
        standalone: { kind: 'guide', sig: 'standalone', sum: 'Using the library without p5.js.', body: [
            '  const app = runApp({ width: 640, height: 360, background: "#111",',
            '      setup(ctx, canvas) { ship = newImage("ship.png", { x: 100, y: 100 }); },',
            '      update(dt) { ship.angle += 90 * dt; },',
            '      draw(ctx, dt) { ship.draw(); } });',
            '  app.stop();   // ends the loop',
            'Or use your own canvas: setDrawTarget(canvas) / newCanvas(w, h), and call draw() from your own requestAnimationFrame loop.'] },
        file: { kind: 'guide', sig: 'file', sum: 'Running from disk (file://).', body: [
            'Open index.html straight from a folder and everything still loads: images use <img>, audio uses <audio>, never fetch().',
            'Browser limits that apply on file:// (not library bugs):',
            '  - getPixel() and toDataURL() return null (the canvas is "tainted"); a one-time console warning says so.',
            '  - p5 WEBGL cannot use image textures. Canvas 2D (the p5 default) is fine.',
            'No loose files at all: embedAsset("coin", "data:image/png;base64,...") then newImage("coin").',
            'runningFromDisk() tells you which case you are in.'] },
        libraries: { kind: 'guide', sig: 'libraries', sum: 'The window.libraries registry.', body: [
            'On load the library creates window.libraries if it does not exist, then adds itself:',
            '  window.libraries.MALEngine_graphics = MALEngine;',
            'Other libraries can do the same, so tools can list what is loaded:  Object.keys(libraries)',
            'Each registered library may offer a .help(topic) function; this one does:  libraries.MALEngine_graphics.help("newImage")',
            'If window.libraries exists but is not an object, or the key is already taken by something else, the library leaves it alone and warns once.'] },

        // ============ creating ============
        newImage: { kind: 'function', group: 'Creating', sig: 'newImage(src, opts = {})', sum: 'Creates an ImageObject from an image file (or an <img>, canvas, ImageBitmap or p5.Image). Loading starts at once; draw() does nothing until it finishes.',
            params: [par('src', SRC_IMG, undefined, 'Path / URL / data-URI / name from embedAsset, or an already-loaded image-like object. Relative paths get the setAssetPath prefix.')].concat(IMAGE_OPTS.map((o) => Object.assign({}, o, { n: 'opts.' + o.n }))),
            ret: 'ImageObject', ex: 'const ship = newImage("ship.png", { x: 100, y: 100, anchorX: 0.5, anchorY: 0.5, scale: 2 });\nship.draw();',
            see: ['ImageObject', 'loadAssets', 'setAssetPath'] },
        newSprite: { kind: 'function', group: 'Creating', sig: 'newSprite(src, opts = {})', sum: 'Creates a SpriteObject: an image cut into equal frames with named animations. Accepts every newImage option plus the frame options below.',
            params: [par('src', SRC_IMG, undefined, 'The sprite sheet.')].concat(IMAGE_OPTS.map((o) => Object.assign({}, o, { n: 'opts.' + o.n })), SPRITE_OPTS.map((o) => Object.assign({}, o, { n: 'opts.' + o.n }))),
            ret: 'SpriteObject', ex: 'const coin = newSprite("coin.png", { frameWidth: 32, frameHeight: 32,\n  animations: { spin: { from: 0, to: 3, fps: 8 } }, play: "spin" });\ncoin.draw();',
            see: ['SpriteObject', 'sprites'] },
        newSound: { kind: 'function', group: 'Creating', sig: 'newSound(src, opts = {})', sum: 'Creates a SoundObject from an audio file. Loading starts at once.',
            params: [par('src', 'string | string[]', undefined, 'Path / URL / data-URI / embedAsset name, or a list of fallbacks such as ["a.ogg", "a.mp3"] (the first playable format is used).')].concat(SOUND_OPTS.map((o) => Object.assign({}, o, { n: 'opts.' + o.n }))),
            ret: 'SoundObject', ex: 'const boom = newSound("boom.wav", { volume: 0.8 });\nconst theme = newSound(["theme.ogg", "theme.mp3"], { loop: true, group: "music" });\nboom.play();',
            see: ['SoundObject', 'audio'] },

        // ============ loading / registries ============
        loadAssets: { kind: 'function', group: 'Loading', sig: 'loadAssets(manifest, opts = {})', sum: 'Creates and loads a whole set of named assets, and returns a Promise that resolves when all have finished (successfully or not).',
            params: [
                par('manifest', 'object', undefined, 'Up to three groups: { images: {...}, sprites: {...}, sounds: {...} } ("audio" is accepted as another name for "sounds"). In each group the key is the asset name and the value is a path, a list of fallback paths (sounds), or an options object containing src plus any newImage / newSprite / newSound option.'),
                par('opts.onProgress', 'function(done, total, name)', 'none', 'Called each time one asset finishes.')],
            ret: 'Promise<{ images, sprites, sounds }> - objects keyed by name. Failed assets are logged as a warning and have .failed = true.',
            ex: 'const a = await loadAssets({\n  images:  { ship: "ship.png", bg: { src: "bg.png", smoothing: false } },\n  sprites: { coin: { src: "coin.png", frameWidth: 32, frameHeight: 32 } },\n  sounds:  { boom: "boom.wav", theme: { src: ["t.ogg", "t.mp3"], loop: true, group: "music" } }\n}, { onProgress: (d, t, name) => console.log(d + "/" + t, name) });\nimageAssets.ship.draw();',
            see: ['loading', 'imageAssets', 'assetsReady'] },
        assetsReady: { kind: 'function', group: 'Loading', sig: 'assetsReady()', sum: 'Promise that resolves when every asset created so far has finished loading (or failed). Assets created later are not included.', params: [], ret: 'Promise<MALEngine>', ex: 'newImage("a.png"); newSound("b.wav");\nawait assetsReady();', see: ['loadAssets', 'assetProgress'] },
        assetProgress: { kind: 'function', group: 'Loading', sig: 'assetProgress()', sum: 'Loading progress of everything created so far.', params: [], ret: 'number 0..1 (1 when nothing is loading)', ex: 'rect(0, 0, width * assetProgress(), 10);', see: ['assetsReady'] },
        getAsset: { kind: 'function', group: 'Loading', sig: 'getAsset(name)', sum: 'Looks up a named asset in the image, sprite and sound registries (in that order).', params: [par('name', 'string', undefined, 'The name given in opts.name or in a loadAssets manifest.')], ret: 'ImageObject | SpriteObject | SoundObject | null', ex: 'getAsset("boom").play();', see: ['imageAssets', 'removeAsset'] },
        removeAsset: { kind: 'function', group: 'Loading', sig: 'removeAsset(name)', sum: 'Removes a named asset from the registries. Sounds are stopped and their audio elements released.', params: [par('name', 'string', undefined, 'The asset name.')], ret: 'MALEngine (chainable)', ex: 'removeAsset("theme");', see: ['getAsset'] },
        setAssetPath: { kind: 'function', group: 'Loading', sig: 'setAssetPath(path)', sum: 'Sets a prefix added to every relative asset path. A missing trailing "/" is added. Absolute URLs, data: and blob: URIs are never prefixed.', params: [par('path', 'string', undefined, 'e.g. "assets/" or "img/sprites/". Empty string clears it.')], ret: 'MALEngine (chainable)', ex: 'setAssetPath("assets/");\nnewImage("ship.png");   // loads assets/ship.png', see: ['embedAsset', 'file'] },
        embedAsset: { kind: 'function', group: 'Loading', sig: 'embedAsset(name, dataURI)  |  embedAsset({ name: dataURI, ... })', sum: 'Registers assets that live inside a script as data-URIs. Afterwards the name works as a path in newImage / newSound. Lets a page run from disk with no loose files.', params: [par('name', 'string | object', undefined, 'The name to use as the path - or an object of name -> dataURI pairs.'), par('dataURI', 'string', undefined, 'A data: URI, e.g. "data:image/png;base64,....". Not used when name is an object.')], ret: 'MALEngine (chainable)', ex: 'embedAsset("coin", "data:image/png;base64,iVBOR...");\nconst c = newImage("coin");', see: ['file'] },
        setAssetLogger: { kind: 'function', group: 'Loading', sig: 'setAssetLogger(fn)', sum: 'Replaces where the library\'s messages (load errors, warnings) go. Default is the browser console, prefixed with [MALEngine].', params: [par('fn', 'function(level, ...args)', undefined, 'level is "log", "warn" or "error".')], ret: 'MALEngine (chainable)', ex: 'setAssetLogger((level, ...args) => new Message(args.join(" ")));' },
        showMissingImages: { kind: 'function', group: 'Loading', sig: 'showMissingImages(on)', sum: 'Turns the magenta/black "missing image" marker on or off. The marker is what an ImageObject draws when its file failed to load.', params: [par('on', 'boolean', undefined, 'true = draw the marker (default), false = draw nothing.')], ret: 'undefined', ex: 'showMissingImages(false);' },
        runningFromDisk: { kind: 'function', group: 'Loading', sig: 'runningFromDisk()', sum: 'Tells you whether the page was opened straight from disk (file://).', params: [], ret: 'boolean', ex: 'if (runningFromDisk()) console.log("local file mode");', see: ['file'] },
        imageAssets: { kind: 'object', group: 'Loading', sig: 'imageAssets', sum: 'Live registry of named ImageObjects (name -> object). Filled automatically by opts.name and loadAssets.', ex: 'imageAssets.ship.draw();', see: ['spriteAssets', 'soundAssets', 'getAsset'] },
        spriteAssets: { kind: 'object', group: 'Loading', sig: 'spriteAssets', sum: 'Live registry of named SpriteObjects (name -> object).', ex: 'spriteAssets.coin.play("spin");', see: ['imageAssets'] },
        soundAssets: { kind: 'object', group: 'Loading', sig: 'soundAssets', sum: 'Live registry of named SoundObjects (name -> object).', ex: 'soundAssets.boom.play();', see: ['imageAssets'] },

        // ============ drawing target / standalone ============
        setDrawTarget: { kind: 'function', group: 'Drawing', sig: 'setDrawTarget(target)', sum: 'Chooses what draw() paints on when you do not pass a target. Not needed with p5 global mode.', params: [par('target', 'canvas | 2D context | p5 instance | p5.Graphics | null', undefined, 'null clears the choice (the library falls back to the p5 canvas, then the first <canvas> on the page).')], ret: 'MALEngine (chainable)', ex: 'setDrawTarget(document.getElementById("game"));', see: ['drawing', 'newCanvas'] },
        newCanvas: { kind: 'function', group: 'Drawing', sig: 'newCanvas(w = 640, h = 360, parent)', sum: 'Creates a <canvas>, adds it to the page and makes it the draw target. For use without p5.', params: [par('w', 'number', '640', 'Canvas width in pixels.'), par('h', 'number', '360', 'Canvas height in pixels.'), par('parent', 'Element | string', 'document.body', 'Element (or CSS selector) to append the canvas to.')], ret: 'HTMLCanvasElement', ex: 'const cv = newCanvas(800, 600, "#game");', see: ['runApp', 'setDrawTarget'] },
        runApp: { kind: 'function', group: 'Drawing', sig: 'runApp(cfg = {})', sum: 'A tiny game loop for using the library without p5. Makes (or uses) a canvas, waits for assets, then calls update() and draw() every frame.',
            params: [par('cfg.canvas', 'HTMLCanvasElement', 'a new canvas', 'Use an existing canvas instead of making one.'), par('cfg.width', 'number', '640', 'Width of the new canvas.'), par('cfg.height', 'number', '360', 'Height of the new canvas.'), par('cfg.parent', 'Element | string', 'document.body', 'Where to put the new canvas.'),
                par('cfg.background', 'string', 'none', 'CSS colour painted each frame. Without it the canvas is cleared to transparent.'), par('cfg.setup', 'function(ctx, canvas)', 'none', 'Runs once - create your assets here.'),
                par('cfg.update', 'function(dt)', 'none', 'Every frame; dt is seconds since the last frame (capped at 0.1).'), par('cfg.draw', 'function(ctx, dt)', 'none', 'Every frame, after update.'),
                par('cfg.waitForAssets', 'boolean', 'true', 'true = the loop starts after the assets made in setup() finish loading.')],
            ret: '{ canvas, ctx, stop() }', ex: 'let ship;\nconst app = runApp({ background: "#111",\n  setup() { ship = newImage("ship.png", { x: 100, y: 100 }); },\n  update(dt) { ship.angle += 90 * dt; },\n  draw() { ship.draw(); } });', see: ['standalone', 'newCanvas'] },

        // ============ p5 ============
        useP5: { kind: 'function', group: 'p5.js', sig: 'useP5(p)', sum: 'Tells the library which p5 instance to draw on. Only needed in p5 INSTANCE mode (global mode is found automatically).', params: [par('p', 'p5', undefined, 'The p5 instance.')], ret: 'MALEngine (chainable)', ex: 'new p5((p) => {\n  useP5(p);\n  p.setup = () => p.createCanvas(400, 300);\n});', see: ['p5'] },
        holdP5Preload: { kind: 'function', group: 'p5.js', sig: 'holdP5Preload()', sum: 'Call at the END of preload(): p5 will not run setup() until every asset created so far has loaded. p5 1.x only (p5 2.x has no preload - use an async setup with assetsReady()).', params: [], ret: 'function release() - or null if the p5 preload hook is not available (a warning explains)', ex: 'function preload() {\n  ship = newImage("ship.png");\n  boom = newSound("boom.wav");\n  holdP5Preload();\n}', see: ['p5', 'assetsReady'] },

        // ============ audio controls ============
        setMasterVolume: { kind: 'function', group: 'Audio', sig: 'setMasterVolume(v)', sum: 'Sets the volume of ALL sounds (multiplied with each group, sound and voice volume). Applies to sounds that are already playing.', params: [par('v', 'number 0..1', undefined, '0 = silent, 1 = full.')], ret: 'MALEngine (chainable)', ex: 'setMasterVolume(0.5);', see: ['setGroupVolume', 'muteAll'] },
        setGroupVolume: { kind: 'function', group: 'Audio', sig: 'setGroupVolume(group, v)', sum: 'Sets the volume of one sound group (the "group" option of newSound). "master" is accepted as the group name too. Applies to sounds that are already playing.', params: [par('group', 'string', undefined, 'e.g. "sfx", "music", or "master".'), par('v', 'number 0..1', undefined, '0 = silent, 1 = full.')], ret: 'MALEngine (chainable)', ex: 'setGroupVolume("music", 0.3);', see: ['getSoundVolume', 'setMasterVolume'] },
        getSoundVolume: { kind: 'function', group: 'Audio', sig: 'getSoundVolume(group)', sum: 'Reads a group volume.', params: [par('group', 'string', undefined, 'A group name or "master". Unknown groups report 1.')], ret: 'number 0..1', ex: 'getSoundVolume("music");', see: ['setGroupVolume'] },
        muteAll: { kind: 'function', group: 'Audio', sig: 'muteAll()', sum: 'Mutes every sound (playback continues silently). Reverse with unmuteAll().', params: [], ret: 'MALEngine (chainable)', ex: 'muteAll();', see: ['unmuteAll', 'toggleMuteAll'] },
        unmuteAll: { kind: 'function', group: 'Audio', sig: 'unmuteAll()', sum: 'Reverses muteAll().', params: [], ret: 'MALEngine (chainable)', ex: 'unmuteAll();', see: ['muteAll'] },
        toggleMuteAll: { kind: 'function', group: 'Audio', sig: 'toggleMuteAll()', sum: 'Switches between muteAll() and unmuteAll().', params: [], ret: 'MALEngine (chainable)', ex: 'if (key === "m") toggleMuteAll();', see: ['muteAll'] },
        stopAllSounds: { kind: 'function', group: 'Audio', sig: 'stopAllSounds()', sum: 'Stops every playing sound and rewinds them.', params: [], ret: 'MALEngine (chainable)', ex: 'stopAllSounds();', see: ['pauseAllSounds'] },
        pauseAllSounds: { kind: 'function', group: 'Audio', sig: 'pauseAllSounds()', sum: 'Pauses every playing sound where it is.', params: [], ret: 'MALEngine (chainable)', ex: 'pauseAllSounds();', see: ['resumeAllSounds'] },
        resumeAllSounds: { kind: 'function', group: 'Audio', sig: 'resumeAllSounds()', sum: 'Resumes sounds paused with pauseAllSounds() (or voice.pause()).', params: [], ret: 'MALEngine (chainable)', ex: 'resumeAllSounds();', see: ['pauseAllSounds'] },
        soundsUnlocked: { kind: 'function', group: 'Audio', sig: 'soundsUnlocked()', sum: 'True once the player has clicked, pressed a key or touched the page - browsers refuse to play sound before that.', params: [], ret: 'boolean', ex: 'if (!soundsUnlocked()) text("click to enable sound", 20, 20);', see: ['audio'] },

        // ============ help ============
        help: { kind: 'function', group: 'Help', sig: 'help(topic?)', sum: 'Prints documentation to the console. With no argument it prints the overview.', params: [par('topic', 'string | function | class | object', 'none', 'A name ("newImage"), a class member ("ImageObject.draw" or just "draw"), a guide ("audio"), a search word ("volume"), or the thing itself: help(newImage), help(myImage).')], ret: 'undefined (use helpText() to get the text instead)', ex: 'help();\nhelp("newSprite");\nhelp("SpriteObject.play");\nhelp(myImage);   // docs for the class of this object', see: ['helpText', 'libraries'] },
        helpText: { kind: 'function', group: 'Help', sig: 'MALEngine.helpText(topic?)', sum: 'Same as help() but returns the text as a string instead of printing it. Only on the MALEngine object (not a global).', params: [par('topic', 'string | function | class | object', 'none', 'Same as help().')], ret: 'string' },

        // ============ the namespace object ============
        MALEngine: { kind: 'object', group: 'Help', sig: 'MALEngine', sum: 'The library object (also at libraries.MALEngine_graphics). Every global lives here too, under a shorter name, and it holds a few settings.',
            props: [prp('VERSION', 'string', 'Library version.'), prp('libraryName', 'string', 'The key used in window.libraries: "MALEngine_graphics".'), prp('isFileProtocol', 'boolean', 'Same as runningFromDisk().'),
                prp('basePath', 'string', 'The asset path prefix (set it with setAssetPath()).'), prp('embedded', 'object', 'name -> data-URI table filled by embedAsset().'), prp('showMissing', 'boolean', 'Missing-image marker on/off (showMissingImages()).'),
                prp('muted', 'boolean', 'Global mute flag (muteAll()).'), prp('images / sprites / sounds', 'object', 'The registries (imageAssets / spriteAssets / soundAssets).'),
                prp('names', 'string[]', 'Names of every global the library offers.'), prp('globals', 'object', 'name -> value of every global, even ones that could not be put on window because the name was taken.'),
                prp('Image / Sprite / Audio / Voice / Error', 'class', 'ImageObject / SpriteObject / SoundObject / SoundVoice / graphicsError.'), prp('help(topic) / helpText(topic)', 'function', 'The help system.')],
            body: ['Short names on the object, for anyone who prefers a namespace:',
                '  image=newImage  sprite=newSprite  sound=newSound  load=loadAssets  ready=assetsReady  progress=assetProgress()  get=getAsset  remove=removeAsset',
                '  setBasePath=setAssetPath  embed=embedAsset  setLogger=setAssetLogger  setContext=setDrawTarget  createCanvas=newCanvas  run=runApp',
                '  attachP5=useP5  holdP5=holdP5Preload  setVolume(group,v)=setGroupVolume (accepts "master")  getVolume=getSoundVolume',
                '  mute  unmute  toggleMute  stopAllSounds  pauseAllSounds  resumeAllSounds = the *All versions   audioUnlocked=soundsUnlocked()'],
            see: ['libraries'] },

        // ============ classes ============
        ImageObject: { kind: 'class', group: 'Classes', sig: 'ImageObject', sum: 'A drawable image with its own position, rotation, scale, anchor and opacity. Made by newImage().',
            params: IMAGE_OPTS, ctor: 'new ImageObject(src, opts) - normally made with newImage(src, opts)',
            props: [prp('name', 'string | null', 'Registry name.'), prp('x', 'number', 'Draw position, horizontal.'), prp('y', 'number', 'Draw position, vertical.'), prp('angle', 'number', 'Rotation in degrees.'),
                prp('scaleX', 'number', 'Horizontal scale (negative mirrors).'), prp('scaleY', 'number', 'Vertical scale (negative mirrors).'), prp('anchorX', 'number 0..1', 'Horizontal anchor (0 left, 0.5 centre, 1 right).'), prp('anchorY', 'number 0..1', 'Vertical anchor.'),
                prp('alpha', 'number 0..1', 'Opacity.'), prp('flipX', 'boolean', 'Mirror horizontally.'), prp('flipY', 'boolean', 'Mirror vertically.'), prp('smoothing', 'boolean', 'false = crisp pixel scaling.'), prp('visible', 'boolean', 'false = draw() does nothing.'),
                prp('src', 'string | null', 'The path the image was created from (null for canvas / bitmap sources).'), prp('element', 'HTMLImageElement | canvas | ImageBitmap', 'The underlying drawable.'),
                prp('loaded', 'boolean', 'true once the image is ready to draw.'), prp('failed', 'boolean', 'true if loading failed.'), prp('error', 'graphicsError | null', 'The load error, if any.'),
                prp('ready', 'Promise', 'Resolves (never rejects) when loading has finished - check .failed afterwards.'),
                prp('width', 'number', 'Display width before scale (settable; default is the natural width, or one frame for sprites).'), prp('height', 'number', 'Display height before scale (settable).'),
                prp('naturalWidth', 'number', 'Width of the source image in pixels (read-only).'), prp('naturalHeight', 'number', 'Height of the source image in pixels (read-only).'),
                prp('drawnWidth', 'number', 'width x |scaleX| - the size on screen ignoring rotation (read-only).'), prp('drawnHeight', 'number', 'height x |scaleY| (read-only).')],
            methods: {
                draw: mth('draw(target?)', 'Draws the image using its own x, y, angle, scale, anchor, alpha and flips. Does nothing while loading or if visible is false; a failed image draws the missing marker.', [par('target', 'canvas | 2D context | p5 | p5.Graphics', 'the current draw target', 'Where to draw. See help("drawing").')], 'this', 'ship.draw();'),
                drawAt: mth('drawAt(x, y, w?, h?, target?)', 'Draws once at a different position (and size) without changing the object. Keeps angle, scale, anchor, alpha and flips.', [par('x', 'number', undefined, 'Position, horizontal.'), par('y', 'number', undefined, 'Position, vertical.'), par('w', 'number', 'this.width', 'Width before scale.'), par('h', 'number', 'this.height', 'Height before scale.'), par('target', 'canvas | 2D context | p5 | p5.Graphics', 'the current draw target', 'Where to draw.')], 'this', 'for (let i = 0; i < 5; i++) tile.drawAt(i * 32, 0);'),
                drawRegion: mth('drawRegion(sx, sy, sw, sh, dx, dy, dw?, dh?, target?)', 'Draws one rectangle of the source image. Ignores angle, scale, anchor and flips; keeps alpha and smoothing. Good for tilesets.', [par('sx', 'number', undefined, 'Source rectangle x (pixels in the image).'), par('sy', 'number', undefined, 'Source rectangle y.'), par('sw', 'number', undefined, 'Source rectangle width.'), par('sh', 'number', undefined, 'Source rectangle height.'), par('dx', 'number', undefined, 'Destination x.'), par('dy', 'number', undefined, 'Destination y.'), par('dw', 'number', 'sw', 'Destination width.'), par('dh', 'number', 'sh', 'Destination height.'), par('target', 'canvas | 2D context | p5 | p5.Graphics', 'the current draw target', 'Where to draw.')], 'this', 'tiles.drawRegion(32, 0, 16, 16, 100, 100, 32, 32);'),
                setPosition: mth('setPosition(x, y)', 'Sets x and y.', [par('x', 'number', undefined, 'New x.'), par('y', 'number', undefined, 'New y.')], 'this (chainable)', 'ship.setPosition(mouseX, mouseY).draw();'),
                setAnchor: mth('setAnchor(ax, ay = ax)', 'Sets the anchor point (0..1 on each axis).', [par('ax', 'number 0..1', undefined, 'Horizontal anchor.'), par('ay', 'number 0..1', 'ax', 'Vertical anchor.')], 'this (chainable)', 'ship.setAnchor(0.5);   // centre'),
                setScale: mth('setScale(sx, sy = sx)', 'Sets scaleX and scaleY.', [par('sx', 'number', undefined, 'Horizontal scale.'), par('sy', 'number', 'sx', 'Vertical scale.')], 'this (chainable)', 'ship.setScale(2);'),
                setSize: mth('setSize(w, h)', 'Sets the display width and height (before scale).', [par('w', 'number', undefined, 'Width.'), par('h', 'number', undefined, 'Height.')], 'this (chainable)', 'bg.setSize(width, height);'),
                setAngle: mth('setAngle(deg)', 'Sets the rotation in degrees.', [par('deg', 'number', undefined, 'Angle in degrees.')], 'this (chainable)', 'ship.setAngle(45);'),
                center: mth('center()', 'Shortcut for setAnchor(0.5, 0.5).', [], 'this (chainable)', 'ship.center();'),
                corners: mth('corners()', 'The four corners in world coordinates after anchor, scale, flip and rotation. Order: top-left, top-right, bottom-right, bottom-left of the unrotated image.', [], 'Array of 4 { x, y }', 'for (const c of ship.corners()) circle(c.x, c.y, 4);'),
                bounds: mth('bounds()', 'Axis-aligned bounding box of the drawn (rotated) image.', [], '{ x, y, w, h }', 'const b = ship.bounds();'),
                contains: mth('contains(px, py)', 'Is the world point inside the drawn image? Respects angle, scale, flips and anchor (uses the rectangle, not transparent pixels).', [par('px', 'number', undefined, 'Point x.'), par('py', 'number', undefined, 'Point y.')], 'boolean', 'if (button.contains(mouseX, mouseY)) { ... }'),
                clone: mth('clone(overrides = {})', 'Makes an independent object that shares the same pixels. Any option can be overridden. The registry name is not copied unless you pass name.', [par('overrides', 'object', '{}', 'Any ImageObject option, e.g. { x: 200, alpha: 0.5 }.')], 'ImageObject (SpriteObject for sprites)', 'const ghost = ship.clone({ alpha: 0.4 });'),
                crop: mth('crop(x, y, w, h, opts = {})', 'Makes a new ImageObject from a rectangle of the source image (pixel coordinates in the whole image). Wait for loading first.', [par('x', 'number', undefined, 'Source x.'), par('y', 'number', undefined, 'Source y.'), par('w', 'number', undefined, 'Width.'), par('h', 'number', undefined, 'Height.'), par('opts', 'object', '{}', 'ImageObject options for the new object.')], 'ImageObject | null (null if not loaded yet - a warning is logged)', 'await sheet.ready;\nconst icon = sheet.crop(0, 0, 16, 16, { x: 10, y: 10 });'),
                tinted: mth('tinted(color, strength = 1, opts = {})', 'Makes a new ImageObject with a colour laid over the non-transparent pixels. For sprites, the current frame only. Wait for loading first.', [par('color', 'string', undefined, 'Any CSS colour: "#f00", "rgb(255,0,0)", "red".'), par('strength', 'number 0..1', '1', 'How strongly the colour covers the original.'), par('opts', 'object', '{}', 'ImageObject options for the new object.')], 'ImageObject | null', 'const hurt = ship.tinted("red", 0.6);'),
                toCanvas: mth('toCanvas()', 'Copies the image (the current frame for sprites) onto a new canvas.', [], 'canvas | null', 'document.body.appendChild(ship.toCanvas());'),
                getPixel: mth('getPixel(x, y)', 'Reads one pixel of the image (the current frame for sprites).', [par('x', 'number', undefined, 'Pixel x.'), par('y', 'number', undefined, 'Pixel y.')], '[r, g, b, a] (0-255) | null. Returns null on file:// (the browser blocks reading) - see help("file").', 'const [r, g, b, a] = ship.getPixel(10, 10) || [];'),
                toDataURL: mth('toDataURL(type?)', 'Exports the image as a data-URI string.', [par('type', 'string', '"image/png"', 'Image mime type.')], 'string | null (null on file://)', 'const url = ship.toDataURL();'),
                toP5Image: mth('toP5Image(p?)', 'Converts to a p5.Image (cached). Needs p5.', [par('p', 'p5', 'global p5 / useP5 instance', 'p5 instance, for instance mode.')], 'p5.Image | null', 'image(ship.toP5Image(), 0, 0);')
            }, see: ['newImage', 'SpriteObject', 'drawing'] },

        SpriteObject: { kind: 'class', group: 'Classes', sig: 'SpriteObject', inherits: 'ImageObject', sum: 'An ImageObject cut into equal frames with named animations. Made by newSprite(). Every ImageObject property and method also works here (draw, contains, clone ...).',
            params: IMAGE_OPTS.concat(SPRITE_OPTS), ctor: 'new SpriteObject(src, opts) - normally made with newSprite(src, opts)',
            props: [prp('frameWidth', 'number | null', 'Width of one frame.'), prp('frameHeight', 'number | null', 'Height of one frame.'), prp('spacing', 'number', 'Gap between frames in the sheet.'), prp('frameLimit', 'number | null', 'Cap on the number of frames.'),
                prp('fps', 'number', 'Default animation speed.'), prp('speed', 'number', 'Playback multiplier: 1 = normal, 2 = double, 0.5 = half.'), prp('frame', 'number', 'Frame currently shown (settable).'),
                prp('autoUpdate', 'boolean', 'true = advances by real time on every draw().'), prp('animations', 'object', 'The defined animations (name -> { frames, fps, loop, next }).'), prp('current', 'string | null', 'Name of the current animation.'), prp('playing', 'boolean', 'Is an animation running.'),
                prp('onAnimationEnd', 'function | null', 'Called as (name, sprite) when a non-looping animation ends.'), prp('columns', 'number', 'Frames per row in the sheet (read-only).'), prp('rows', 'number', 'Rows in the sheet (read-only).'), prp('frameCount', 'number', 'Total frames (read-only).')],
            methods: {
                addAnimation: mth('addAnimation(name, def)', 'Defines an animation.', [par('name', 'string', undefined, 'Animation name.'), par('def', 'array | object', undefined, 'A frame list [0, 1, 2], or { frames: [..] } or { from, to } (from > to plays backwards), plus optional fps (default: sprite fps), loop (default true) and next (name of an animation to start when a non-looping one ends).')], 'this (chainable)', 'coin.addAnimation("pop", { frames: [4, 5, 6], fps: 12, loop: false, next: "spin" });'),
                play: mth('play(name, opts = {})', 'Starts an animation from its first frame. Calling play() with the animation that is already running does nothing, so it is safe to call every frame.', [par('name', 'string', undefined, 'Animation name (unknown names log a warning).'), par('opts.restart', 'boolean', 'false', 'true = restart even if it is already playing.')], 'this (chainable)', 'player.play(onGround ? "run" : "jump");'),
                pause: mth('pause()', 'Freezes the animation on the current frame.', [], 'this (chainable)', 'coin.pause();'),
                resume: mth('resume()', 'Continues a paused animation.', [], 'this (chainable)', 'coin.resume();'),
                stop: mth('stop()', 'Stops and forgets the current animation (the frame stays).', [], 'this (chainable)', 'coin.stop();'),
                setFrame: mth('setFrame(i)', 'Shows a specific frame and stops animating.', [par('i', 'number', undefined, 'Frame index (0 = first).')], 'this (chainable)', 'icon.setFrame(3);'),
                update: mth('update(dt)', 'Advances the animation by dt seconds. Only needed when autoUpdate is false.', [par('dt', 'number', undefined, 'Seconds since the last update.')], 'this (chainable)', 'coin.update(deltaTime / 1000);')
            }, see: ['newSprite', 'ImageObject', 'sprites'] },

        SoundObject: { kind: 'class', group: 'Classes', sig: 'SoundObject', sum: 'A sound with a pool of copies so it can overlap itself. Made by newSound().',
            params: SOUND_OPTS, ctor: 'new SoundObject(src, opts) - normally made with newSound(src, opts)',
            props: [prp('name', 'string | null', 'Registry name.'), prp('group', 'string', 'Volume group.'), prp('volume', 'number 0..1', 'Base volume (use setVolume() so playing voices update).'), prp('loop', 'boolean', 'Default loop setting for play().'), prp('rate', 'number', 'Default playback speed for play().'),
                prp('muted', 'boolean', 'This sound is muted (mute() / unmute()).'), prp('poolSize', 'number', 'Max overlapping copies.'), prp('onBusy', '"steal" | "ignore"', 'What to do when the pool is full.'), prp('sources', 'string[]', 'The paths given.'), prp('url', 'string', 'The path actually used (first playable format).'),
                prp('loaded', 'boolean', 'true once the browser has loaded enough to play.'), prp('failed', 'boolean', 'true if loading failed.'), prp('unverified', 'boolean', 'true if the browser never confirmed loading (some phones wait for a tap) - it will still try to play.'),
                prp('error', 'graphicsError | null', 'The load error, if any.'), prp('ready', 'Promise', 'Resolves (never rejects) when loading has finished.'), prp('element', 'HTMLAudioElement', 'The first underlying <audio> element.'),
                prp('duration', 'number', 'Length in seconds (read-only).'), prp('isPlaying', 'boolean', 'Is any copy playing (read-only).'), prp('voices', 'SoundVoice[]', 'Currently playing or paused voices (read-only).')],
            methods: {
                play: mth('play(opts = {})', 'Starts one playback and returns it. If sound is blocked by the browser, looping sounds and queue:true wait for the first click / key / touch.', PLAY_OPTS, 'SoundVoice | null (null if the sound failed to load, or onBusy is "ignore" and the pool is full)', 'const v = boom.play({ volume: 0.6, rate: 1.2 });'),
                stop: mth('stop()', 'Stops every playing copy and rewinds.', [], 'this (chainable)', 'theme.stop();'),
                pause: mth('pause()', 'Pauses every playing copy.', [], 'this (chainable)', 'theme.pause();'),
                resume: mth('resume()', 'Resumes paused copies.', [], 'this (chainable)', 'theme.resume();'),
                setVolume: mth('setVolume(v)', 'Sets the base volume; playing voices update immediately.', [par('v', 'number 0..1', undefined, 'New volume.')], 'this (chainable)', 'theme.setVolume(0.3);'),
                mute: mth('mute()', 'Mutes this sound only.', [], 'this (chainable)', 'boom.mute();'),
                unmute: mth('unmute()', 'Reverses mute().', [], 'this (chainable)', 'boom.unmute();'),
                fadeTo: mth('fadeTo(v, seconds, stopAtEnd = false)', 'Gradually changes the base volume (all copies).', [par('v', 'number 0..1', undefined, 'Target volume.'), par('seconds', 'number', undefined, 'How long the fade takes.'), par('stopAtEnd', 'boolean', 'false', 'true = stop the sound when the fade finishes (fade-out).')], 'this (chainable)', 'theme.fadeTo(0, 2, true);   // fade out over 2s, then stop'),
                clone: mth('clone(overrides = {})', 'Makes a new SoundObject from the same file with the same settings.', [par('overrides', 'object', '{}', 'Any newSound option.')], 'SoundObject', 'const quiet = boom.clone({ volume: 0.2 });'),
                dispose: mth('dispose()', 'Stops the sound and releases its audio elements. The object cannot be played afterwards.', [], 'undefined', 'theme.dispose();')
            }, see: ['newSound', 'SoundVoice', 'audio'] },

        SoundVoice: { kind: 'class', group: 'Classes', sig: 'SoundVoice', sum: 'One playback of a SoundObject, returned by sound.play(). Lets you stop, pause, seek or fade just that playback.',
            ctor: 'Made by SoundObject.play() - not created directly.',
            props: [prp('owner', 'SoundObject', 'The sound this playback belongs to.'), prp('element', 'HTMLAudioElement', 'The <audio> element playing it.'), prp('volume', 'number 0..1', 'Volume of this playback (use setVolume()).'), prp('loop', 'boolean', 'Repeats forever.'), prp('rate', 'number', 'Playback speed.'),
                prp('onend', 'function | null', 'Called as (voice) at the natural end.'), prp('state', '"playing" | "paused" | "ended"', 'Current state.'), prp('isPlaying', 'boolean', 'state is "playing" (read-only).'), prp('currentTime', 'number', 'Position in seconds (read-only).'), prp('duration', 'number', 'Length in seconds (read-only).')],
            methods: {
                pause: mth('pause()', 'Pauses this playback.', [], 'this', 'v.pause();'),
                resume: mth('resume()', 'Continues a paused playback.', [], 'this', 'v.resume();'),
                stop: mth('stop()', 'Stops and rewinds this playback and frees its pool slot. (onend does not fire for manual stops.)', [], 'this', 'v.stop();'),
                seek: mth('seek(t)', 'Jumps to a position.', [par('t', 'number', undefined, 'Seconds from the start.')], 'this', 'v.seek(1.5);'),
                setVolume: mth('setVolume(v)', 'Sets this playback\'s volume.', [par('v', 'number 0..1', undefined, 'New volume.')], 'this', 'v.setVolume(0.5);'),
                setRate: mth('setRate(r)', 'Sets this playback\'s speed.', [par('r', 'number', undefined, '1 = normal.')], 'this', 'v.setRate(0.8);'),
                fadeTo: mth('fadeTo(v, seconds, stopAtEnd = false)', 'Gradually changes this playback\'s volume.', [par('v', 'number 0..1', undefined, 'Target volume.'), par('seconds', 'number', undefined, 'Duration.'), par('stopAtEnd', 'boolean', 'false', 'true = stop when the fade finishes.')], 'this', 'v.fadeTo(0, 1, true);')
            }, see: ['SoundObject', 'audio'] },

        graphicsError: { kind: 'class', group: 'Classes', sig: 'graphicsError', inherits: 'Error', sum: 'Error type the library uses for load failures (name "MALEngine"). Found in image.error / sound.error. The library logs errors instead of throwing them.', ctor: 'new graphicsError(message)',
            props: [], methods: {}, see: ['loading'] }
    };

    // ---- help lookup ----
    const GROUP_ORDER = ['Classes', 'Creating', 'Loading', 'Drawing', 'p5.js', 'Audio', 'Help'];
    const GUIDES = ['getting-started', 'loading', 'drawing', 'sprites', 'audio', 'p5', 'standalone', 'file', 'libraries'];
    let helpIndex = null;

    function buildHelpIndex() {
        const idx = new Map();
        for (const name of Object.keys(DOCS)) {
            const e = DOCS[name];
            idx.set(name.toLowerCase(), { title: name, e });
            if (e.methods) for (const m of Object.keys(e.methods)) idx.set((name + '.' + m).toLowerCase(), { title: name + '.' + m, e: e.methods[m] });
            if (e.props) for (const pr of e.props) if (/^\w+$/.test(pr.n)) idx.set((name + '.' + pr.n).toLowerCase(), { title: name + '.' + pr.n, e: { kind: 'property', sig: name + '.' + pr.n, sum: pr.x, type: pr.t } });
        }
        return idx;
    }

    function wrap(text, indent, width) {
        const pad = ' '.repeat(indent), out = [];
        for (const para of String(text).split('\n')) {
            let line = '';
            for (const word of para.split(' ')) {
                if (line && (pad + line + ' ' + word).length > width) { out.push(pad + line); line = word; }
                else line = line ? line + ' ' + word : word;
            }
            out.push(pad + line);
        }
        return out.join('\n');
    }

    function fmtParams(list, heading) {
        const L = ['', heading + ':'];
        for (const q of list) {
            L.push('  ' + q.n + '   (' + q.t + (q.d === undefined ? ', required' : ', default: ' + q.d) + ')');
            L.push(wrap(q.x, 6, 96));
        }
        return L;
    }

    function formatEntry(title, e, idx) {
        const L = [];
        L.push(e.sig + (e.kind ? '    [' + e.kind + (e.inherits ? ', extends ' + e.inherits : '') + ']' : ''));
        if (e.type) L.push('type: ' + e.type);
        if (e.sum) L.push('', wrap(e.sum, 2, 96));
        if (e.ctor) L.push('', wrap(e.ctor, 2, 96));
        if (e.body) { L.push(''); for (const b of e.body) L.push('  ' + b); }
        if (e.kind === 'class') {
            if (e.params && e.params.length) L.push(...fmtParams(e.params, 'Options (constructor / factory)'));
            if (e.props && e.props.length) { L.push('', 'Properties:'); for (const q of e.props) L.push('  ' + q.n + '  (' + q.t + ')  - ' + q.x); }
            if (e.methods && Object.keys(e.methods).length) { L.push('', 'Methods (help("' + title + '.<name>") for details):'); for (const k of Object.keys(e.methods)) L.push('  ' + e.methods[k].sig + '  - ' + e.methods[k].sum.split('. ')[0].replace(/\.$/, '')); }
            if (e.inherits && DOCS[e.inherits]) L.push('', 'Also has everything from ' + e.inherits + ' - see help("' + e.inherits + '").');
        } else {
            if (e.props && e.props.length) { L.push('', 'Contents:'); for (const q of e.props) L.push('  ' + q.n + '  (' + q.t + ')  - ' + q.x); }
            if (e.params && e.params.length) L.push(...fmtParams(e.params, 'Parameters'));
            else if (e.kind === 'function' || e.kind === 'method') L.push('', 'Parameters: none');
        }
        if (e.ret) L.push('', 'Returns: ' + e.ret);
        if (e.ex) { L.push('', 'Example:'); for (const l of e.ex.split('\n')) L.push('  ' + l); }
        if (e.see && e.see.length) L.push('', 'See also: ' + e.see.join(', '));
        return L.join('\n');
    }

    function overview() {
        const L = ['MALEngine v' + VERSION + '  -  images, sprites and sound for canvas and p5.js  (window.libraries.MALEngine_graphics)',
            '',
            'Ask for details with  help("name")  -  e.g. help("newImage"), help("ImageObject.draw"), help("audio"), help("volume"), or help(yourObject).',
            'Everything below is a global; angles are in degrees.', ''];
        for (const g of GROUP_ORDER) {
            const items = Object.keys(DOCS).filter((n) => DOCS[n].group === g && n !== 'MALEngine');
            if (!items.length) continue;
            L.push(g + ':');
            for (const n of items) L.push('  ' + n.padEnd(18) + (DOCS[n].sum || '').split('. ')[0].replace(/\.$/, ''));
            L.push('');
        }
        L.push('Guides:  ' + GUIDES.map((g) => 'help("' + g + '")').join('  '));
        L.push('Also:    help("MALEngine") for the library object and its short names.');
        return L.join('\n');
    }

    // Works out which topic a help() argument means. Returns text.
    function helpText(topic) {
        if (!helpIndex) helpIndex = buildHelpIndex();
        if (topic === undefined || topic === null || topic === '') return overview();

        // an actual value: a global function / class / object, or an instance of a class
        if (typeof topic !== 'string') {
            if (topic === MAL) topic = 'MALEngine';
            else {
                const g = MAL.globals || {};
                const hit = Object.keys(g).find((k) => g[k] === topic);
                if (hit) topic = hit;
                else if (topic instanceof SoundVoice) topic = 'SoundVoice';
                else if (topic instanceof SpriteObject) topic = 'SpriteObject';
                else if (topic instanceof ImageObject) topic = 'ImageObject';
                else if (topic instanceof SoundObject) topic = 'SoundObject';
                else if (topic instanceof graphicsError) topic = 'graphicsError';
                else return 'No help for that value. Try help() for the overview.';
            }
        }

        let key = String(topic).trim().replace(/\(\)?$/, '').replace(/^(window\.)?(MALEngine\.|libraries\.MALEngine_graphics\.)(?=\w)/i, '').toLowerCase();
        if (helpIndex.has(key)) { const h = helpIndex.get(key); return formatEntry(h.title, h.e); }

        // inherited member: SpriteObject.draw -> ImageObject.draw
        const dot = key.indexOf('.');
        if (dot > 0) {
            const cls = Object.keys(DOCS).find((n) => n.toLowerCase() === key.slice(0, dot));
            if (cls && DOCS[cls].inherits) {
                const alt = DOCS[cls].inherits.toLowerCase() + key.slice(dot);
                if (helpIndex.has(alt)) { const h = helpIndex.get(alt); return formatEntry(h.title, h.e) + '\n\n(' + cls + ' inherits this from ' + DOCS[cls].inherits + ')'; }
            }
        }

        // a bare member name: draw, play, fadeTo ...
        const members = [];
        for (const [k, h] of helpIndex) if (k.includes('.') && k.split('.')[1] === key && h.e.kind === 'method') members.push(h);
        if (members.length === 1) return formatEntry(members[0].title, members[0].e);
        if (members.length > 1) return members.map((h) => formatEntry(h.title, h.e)).join('\n\n----------------------------------------\n\n');

        // search words
        const hits = [];
        for (const [k, h] of helpIndex) {
            if (h.e.kind === 'property') continue;
            const text = (k + ' ' + (h.e.sum || '') + ' ' + (h.e.body ? h.e.body.join(' ') : '')).toLowerCase();
            if (text.includes(key)) hits.push(h);
        }
        if (hits.length) {
            const L = ['No topic named "' + topic + '" - but these mention it:', ''];
            for (const h of hits.slice(0, 25)) L.push('  ' + h.title.padEnd(26) + (h.e.sum || '').split('. ')[0].replace(/\.$/, ''));
            if (hits.length > 25) L.push('  ... and ' + (hits.length - 25) + ' more');
            return L.join('\n');
        }
        return 'No help found for "' + topic + '". Try help() for the full list.';
    }

    /** Prints documentation to the console. help() = overview; help('newImage'); help('ImageObject.draw'); help('audio'); help(myImage). */
    function help(topic) { console.log(helpText(topic)); }

    MAL.help = help;
    MAL.helpText = helpText;
    MAL.libraryName = 'MALEngine_graphics';

    // ============================================
    // EXPORTS  (everything lands on window)
    // ============================================
    // Helper functions are bound to the library object, so they can be passed
    // around freely:  const make = newImage;  make('a.png');
    const bind = (fn) => fn.bind(MAL);

    const GLOBALS = {
        // ---- classes ----
        ImageObject, SpriteObject, SoundObject, SoundVoice, graphicsError,

        // ---- creating assets ----
        newImage:   bind(MAL.image),        // newImage(src, opts)  -> ImageObject
        newSprite:  bind(MAL.sprite),       // newSprite(src, opts) -> SpriteObject
        newSound:   bind(MAL.sound),        // newSound(src, opts)  -> SoundObject

        // ---- loading / registries ----
        loadAssets:    bind(MAL.load),      // loadAssets({images, sprites, sounds}, {onProgress}) -> Promise
        assetsReady:   bind(MAL.ready),     // assetsReady() -> Promise (all assets created so far)
        assetProgress: () => MAL.progress,  // assetProgress() -> 0..1
        getAsset:      bind(MAL.get),       // getAsset(name)
        removeAsset:   bind(MAL.remove),    // removeAsset(name)
        setAssetPath:  bind(MAL.setBasePath),   // setAssetPath('assets/')
        embedAsset:    bind(MAL.embed),     // embedAsset(name, dataURI) or embedAsset({name: dataURI})
        setAssetLogger: bind(MAL.setLogger),    // setAssetLogger((level, ...args) => {})
        showMissingImages: (on) => { MAL.showMissing = !!on; },
        runningFromDisk: () => IS_FILE,
        imageAssets:  MAL.images,           // live registries of named assets
        spriteAssets: MAL.sprites,
        soundAssets:  MAL.sounds,

        // ---- drawing target / standalone loop ----
        setDrawTarget: bind(MAL.setContext),    // setDrawTarget(canvas | ctx | p5 | p5.Graphics)
        newCanvas:     bind(MAL.createCanvas),  // newCanvas(w, h, parent) - standalone canvas
        runApp:        bind(MAL.run),           // runApp({width, height, setup, update, draw})

        // ---- p5 helpers ----
        useP5:          bind(MAL.attachP5),     // useP5(p) - p5 instance mode only
        holdP5Preload:  bind(MAL.holdP5),       // call at the end of preload() (p5 1.x)

        // ---- audio controls ----
        setMasterVolume: (v) => MAL.setVolume('master', v),
        setGroupVolume:  bind(MAL.setVolume),   // setGroupVolume('music', 0.4)
        getSoundVolume:  bind(MAL.getVolume),
        muteAll:         bind(MAL.mute),
        unmuteAll:       bind(MAL.unmute),
        toggleMuteAll:   bind(MAL.toggleMute),
        stopAllSounds:   bind(MAL.stopAllSounds),
        pauseAllSounds:  bind(MAL.pauseAllSounds),
        resumeAllSounds: bind(MAL.resumeAllSounds),
        soundsUnlocked:  () => MAL.audioUnlocked,

        // ---- help ----
        help                                    // help('newImage'), help('ImageObject.draw'), help() = overview
    };

    // Also reachable through the namespace object (handy for the rare name clash).
    Object.assign(MAL, { names: Object.keys(GLOBALS) });

    root.MALEngine = MAL;
    if (HAS_DOM || typeof window !== 'undefined') {
        for (const name of Object.keys(GLOBALS)) {
            if (name in root && root[name] !== GLOBALS[name]) {
                warnOnce('clash-' + name, 'Global "' + name + '" already exists, so the library did not overwrite it. Use MALEngine.globals.' + name + ' instead.');
                continue;
            }
            root[name] = GLOBALS[name];
        }
    }
    MAL.globals = GLOBALS;

    // ---- window.libraries registry ----
    // Creates window.libraries if it does not exist, then adds this library under
    // the key MALEngine_graphics:  window.libraries = { MALEngine_graphics: MALEngine }
    try {
        if (root.libraries === undefined || root.libraries === null) root.libraries = {};
        if (typeof root.libraries === 'object' || typeof root.libraries === 'function') {
            const existing = root.libraries[MAL.libraryName];
            if (existing && existing !== MAL) warnOnce('libraries-key', 'libraries.' + MAL.libraryName + ' is already taken by something else, so it was left alone.');
            else root.libraries[MAL.libraryName] = MAL;
        } else {
            warnOnce('libraries-type', 'window.libraries exists but is not an object, so MALEngine was not added to it.');
        }
    } catch (e) {
        warnOnce('libraries-fail', 'Could not add MALEngine to window.libraries: ' + e.message);
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = MAL;

})(typeof window !== 'undefined' ? window : globalThis);