// ============================================================
// Global.js
// ------------------------------------------------------------
// Core engine bootstrap: error classes, utility functions,
// FPS tracking, the Message system, the p5 colorText extension,
// and the World class (fixed-timestep game loop + render loop).
//
// This file is intentionally dependency-light so it can load
// first, before any other engine file, when running from disk.
// ============================================================

// ============================================
// ERROR CLASSES
// ============================================
// Custom error types so console output clearly shows which
// subsystem failed (rendering, hitbox, scene, world, etc.).
class rendererError extends Error {
    constructor(msg) { super(msg); this.name = "GameObject|Rendering"; }
}
class gameObjectError extends Error {
    constructor(msg) { super(msg); this.name = "GameObject"; }
}
class hitboxError extends Error {
    constructor(msg) { super(msg); this.name = "GameObject|HitBox"; }
}
class sceneError extends Error {
    constructor(msg) { super(msg); this.name = "Scene"; }
}
class typeError extends Error {
    constructor(msg) { super(msg); this.name = "MALE|TypeError"; }
}
class numberError extends Error {
    constructor(msg) { super(msg); this.name = "MALE|NumaricalError"; }
}
class worldError extends Error {
    constructor(msg) { super(msg); this.name = "MALE"; }
}
class tileMatrixError extends Error {
    constructor(msg) { super(msg); this.name = "TileMatrix"; }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================



/**
 * Pads a number with leading zeros and trailing zeros so it
 * always has `totalLength` integer digits and `decimalPlaces`
 * decimal digits. Example: pad(3, 4, 2) -> "0003.00".
 */
function pad(num, totalLength = 1, decimalPlaces = 2) {
    let str = num + '';

    if (str.includes('.')) {
        let parts = str.split('.');
        let intPart = parts[0];
        let decPart = parts[1];

        while (decPart.length < decimalPlaces) {
            decPart += '0';
        }
        decPart = decPart.slice(0, decimalPlaces);
        str = intPart + '.' + decPart;
    } else {
        str = str + '.' + '0'.repeat(decimalPlaces);
    }

    let intPart = str.split('.')[0];
    let decPart = str.split('.')[1];

    while (intPart.length < totalLength) {
        intPart = '0' + intPart;
    }

    return intPart + (decimalPlaces > 0 ? '.' : '') + decPart;
}




// ============================================
// FPS TRACKER
// ============================================
// Measures render FPS and keeps a rolling average. Updates
// World.stats so HUD scripts can read fpsColor / averageFPS.
class FPSTracker {
    constructor() {
        this.frameCount = 0;
        this.currentFPS = 0;
        this.lastUpdateTime = performance.now();
        this.updateInterval = 500;
        this.fpsHistory = [];
        this.maxHistory = 60;
        this.averageFPS = 0;
    }

    tick() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastUpdateTime >= this.updateInterval) {
            const elapsedSeconds = (now - this.lastUpdateTime) / 1000;
            this.currentFPS = Math.round(this.frameCount / elapsedSeconds);

            this.fpsHistory.push(this.currentFPS);
            if (this.fpsHistory.length > this.maxHistory) {
                this.fpsHistory.shift();
            }

            if (this.fpsHistory.length > 0) {
                const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
                this.averageFPS = Math.round(sum / this.fpsHistory.length);
            }

            if (typeof World !== 'undefined' && World.stats) {
                World.stats.fps = this.currentFPS;
                World.stats.averageFPS = this.averageFPS;

                if (this.currentFPS < 30) {
                    World.stats.fpsColor = "red";
                } else if (this.currentFPS < 50) {
                    World.stats.fpsColor = "yellow";
                } else {
                    World.stats.fpsColor = "green";
                }
            }

            this.frameCount = 0;
            this.lastUpdateTime = now;
        }
    }

    getFPS() { return this.currentFPS; }
    getAverageFPS() { return this.averageFPS; }

    getPerformanceStatus() {
        if (this.currentFPS < 30) return "Poor";
        if (this.currentFPS < 50) return "Fair";
        return "Good";
    }
}

const fpsTracker = new FPSTracker();

// ============================================
// MESSAGE SYSTEM
// ============================================
// All runtime messages (including Unit Test output) go through
// this class. Messages are filtered by World.chat.rules and
// flushed to the console once per second by the main loop.
// ============================================
// MESSAGE SYSTEM
// ============================================
// All runtime messages (including Unit Test output) go through
// this class. Messages are filtered by the active World's chat
// rules and flushed to the console once per second by its loop.
class Message {
    static init(msg) {
        if (!msg) return;
        const world = World.active;
        if (!world || !world.chat) return;
        let query = world.chat.rules.every(rule => rule.test(msg.message));
        if (query || msg.logs) world.chat.messages.push(msg);
        else world.chat.query.push(msg);
        if (Message.logs) Message.logs.push(msg);
        else Message.logs = [msg];
    }

    constructor(msg, logs = true, exe = false) {
        this.message = msg;
        this.time = World.active ? World.active.currentTime : 0;
        this.executable = exe;
        this.log = logs;
        Message.init(this);
    }
}
// ============================================
// P5.JS COLOR TEXT EXTENSIONS
// ============================================
// Adds colorText("\\red|Hello| \\blue|World|", x, y) which
// parses inline color codes and draws each segment with the
// current text settings (size, align, style).
if (typeof p5 !== 'undefined') {
    p5.prototype._parseColoredText = function (str) {
        const lines = str.split('\n');
        const result = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = /\\([^|\\\n]+)\|([^|]+)\|/g;
            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({ text: line.substring(lastIndex, match.index), color: null });
                }
                parts.push({ text: match[2], color: match[1] });
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < line.length) {
                parts.push({ text: line.substring(lastIndex), color: null });
            }

            const lineParts = parts.length ? parts : [{ text: line, color: null }];
            result.push(...lineParts);

            if (i < lines.length - 1) {
                result.push({ text: '\n', color: null, isNewline: true });
            }
        }

        return result;
    };

    p5.prototype.colorText = function (str, x = 0, y = 0, horizontal = LEFT, vertical = BASELINE, maxWidth) {
        const parts = this._parseColoredText(str);
        let currentX = x;
        let currentY = y;

        const originalFill = this.drawingContext.fillStyle;

        for (const part of parts) {
            if (part.isNewline) {
                currentX = x;
                currentY += (this.textLeading() || 20);
                continue;
            }

            if (part.color) {
                try {
                    this.fill(part.color);
                } catch (e) {
                    this.fill(originalFill);
                }
            }

            this.text(part.text, currentX, currentY, maxWidth);
            currentX += this.textWidth(part.text);
        }

        this.fill(originalFill);
        return this;
    };
}

// ============================================
// PING TRACKING
// ============================================
let refresher = {
    last: -1,
    ping: -1,
};

// ============================================
// WORLD CLASS
// ============================================
// Owns a fixed-timestep game loop. Rendering happens every
// animation frame; game logic (object updates, object scripts,
// input polling) only runs on a "tick" whose duration is set
// by `tickLength` (ms). Default 20ms -> 50 ticks/sec.
//
// ALL mutable state lives on the INSTANCE (this.canvas,
// this.tick, this.mouse, ...). The only static members are:
//   World.active    - the currently-running instance (or null)
//   World.instances - all live instances
//   World.started   - whether any instance has ever been created
//
// For backwards compatibility with older engine code that
// still reads World.canvas, World.mouse, etc., static getters
// proxy to World.active. New code should prefer `this.` inside
// the class or `world.` / `World.active.` outside it.
class World {
    // ---------- Static registry ----------
    static get active() { return World._active || null; }
    static set active(w) { World._active = w; }

    static get instances() { return World._instances || []; }

    static get started() { return !!World._started; }
    static set started(v) { World._started = !!v; }

    // ---------- Backward-compat proxies to the active world ----------
    // These let older code keep reading World.canvas, World.mouse,
    // etc. New code should read from the instance directly.
    static get canvas()       { return World.active ? World.active.canvas       : undefined; }
    static get mouse()        { return World.active ? World.active.mouse        : undefined; }
    static get keyboard()     { return World.active ? World.active.keyboard     : undefined; }
    static get controller()   { return World.active ? World.active.controller   : undefined; }
    static get camera()       { return World.active ? World.active.camera       : undefined; }
    static get chat()         { return World.active ? World.active.chat         : undefined; }
    static get stats()        { return World.active ? World.active.stats        : undefined; }
    static get defaults()     { return World.active ? World.active.defaults     : undefined; }
    static get tick()         { return World.active ? World.active.tick         : 0; }
    static get tickLength()   { return World.active ? World.active.tickLength   : 20; }
    static get tickRate()     { return World.active ? World.active.tickRate     : 50; }
    static get updateTick()   { return World.active ? World.active.updateTick   : false; }
    static get currentTime()  { return World.active ? World.active.currentTime  : 0; }
    static get time()         { return World.active ? World.active.time         : 0; }
    static get startTime()    { return World.active ? World.active.startTime    : performance.now(); }
    static get ping()         { return World.active ? World.active.ping         : -1; }
    static get players()      { return World.active ? World.active.players      : []; }
    static get gyroKeyboard() { return World.active ? World.active.gyroKeyboard : undefined; }
    static get debugMode()    { return World.active ? World.active.debugMode    : false; }
    static get language()     { return World.active ? World.active.language     : 'english'; }

    // ---------- Language helpers (static, no instance needed) ----------

    /**
     * Turns a language code or name into the lowercase English name the engine
     * uses: 'en-US' -> 'english', 'es' -> 'spanish', 'Japanese' -> 'japanese'.
     * Anything that isn't a 2-3 letter code is treated as a name already.
     */
    static languageName(tag) {
        if (tag == null) return '';
        const str = String(tag).trim();
        const base = str.split(/[-_]/)[0].toLowerCase();
        if (!/^[a-z]{2,3}$/.test(base)) return str.toLowerCase();
        if (!World._langNameCache) World._langNameCache = {};
        if (World._langNameCache[base]) return World._langNameCache[base];
        let name = World._LANG_NAMES[base] || '';
        if (!name) {
            try {
                const n = new Intl.DisplayNames(['en'], { type: 'language' }).of(base);
                if (n && n.toLowerCase() !== base) name = n.toLowerCase();
            } catch (e) { /* old browser: fall through to the bare code */ }
        }
        return (World._langNameCache[base] = name || base);
    }

    /** The browser's language preferences as engine names, most preferred first, no repeats. */
    static detectLanguages() {
        const nav = typeof navigator !== 'undefined' ? navigator : {};
        const tags = (nav.languages && nav.languages.length) ? nav.languages : [nav.language];
        const out = [];
        tags.forEach(t => {
            const n = World.languageName(t);
            if (n && !out.includes(n)) out.push(n);
        });
        return out;
    }
    objects(returner)   {
        if(!World.active)   return false;
        switch(returner){
            case 'type':
                const list = [];
                shell.allObjects.filter(o => !o.deleted ? o : false).forEach(o => list.push(o.constructor.name));
                return list;
            default:
                return shell.allObjects.filter(o => !o.deleted ? o : false)
        }
    }
    /* 
        {
            <action>:<input>
        }
        {
            left:z,
            reload:r,
            ect...
        }
    */
    binds(type,obj){
        const bind = this.defaults.binds[type];
        if(!bind)return;

        const targets = Object.keys(obj);

    }
    // ---------- Static convenience accessors ----------
    static getMain() { return World.active; }

    static getFPS() {
        return fpsTracker ? fpsTracker.getFPS() : 0;
    }
    static getAverageFPS() {
        return fpsTracker ? fpsTracker.getAverageFPS() : 0;
    }
    static getPerformanceStatus() {
        return fpsTracker ? fpsTracker.getPerformanceStatus() : "Unknown";
    }

    /**
     * Stops every live instance and clears the static registry.
     * For a single instance, prefer `worldInstance.stop()`.
     */
    static delete() {
        (World._instances || []).slice().forEach(w => w.stop());
        World._instances = [];
        World._active = null;
        World._started = false;
    }

    // ============================================================
    // INSTANCE
    // ============================================================

    /**
     * @param {number} tickLength ms per game tick (default 20)
     */
    constructor(tickLength = 20) {
        // Register this instance BEFORE init so any code that
        // calls World.active during init sees this one.
        if (!World._instances) World._instances = [];
        World._instances.push(this);
        if (!World._active) World.active = this;
        World.started = true;

        // ---- Identity ----
        this.id = "MALE:world[" + Math.random().toString(36).substring(2) + "]";
        this.loops = 0;

        // ---- Timing ----
        this.startTime = performance.now();
        this.currentTime = 0;
        this.time = 0;
        this.tick = 0;
        this.tickLength = tickLength > 0 ? tickLength : 20;
        this.tickRate = 1000 / this.tickLength;
        this._tickDeltaSeconds = this.tickLength / 1000;
        this._tickAccumulator = 0;
        this.updateTick = false;
        this.ping = -1;

        // ---- Running state ----
        this.started = true;    // per-instance "has init run"
        this.paused = false;
        this._rafHandle = null;
        this._running = false;
        this._initialized = false;

        // ---- Background / focus (see _startBackgroundTimer, _watchFocus) ----
        // What the game does when the player looks away. Each is 'run' or 'pause':
        //   whenHidden:    the tab is hidden (switched tabs, minimized the browser).
        //                  'run' keeps real ticks going (driven by a Worker timer).
        //   whenUnfocused: the page is still showing but another program has focus.
        // 'pause' freezes ticks (game time, scene.time, physics) until the player is back;
        // nothing is caught up afterwards. Changing either takes effect right away.
        this.whenHidden = 'run';
        this.whenUnfocused = 'run';
        this.backgroundFps = 0;        // renders per second while hidden and running (0 = none: nobody can see them)
        this.backgroundCatchUp = 60;   // most seconds of game time one background step may run, if the browser stalls the timer
        this.backgroundTimer = 'none'; // what drives hidden-tab ticks: 'worker' (steady), 'interval' (throttled backup) or 'none'
        this.hidden = typeof document !== 'undefined' && !!document.hidden;
        this.focusLost = false;        // true while the browser window is out of focus (page still showing)
        this.onHidden = null;          // () => {}  the tab was hidden
        this.onShown = null;           // () => {}  the tab is showing again
        this.onFocusLost = null;       // () => {}  the window lost focus (not a tab switch): e.g. open a pause menu
        this.onFocusGained = null;     // () => {}  the window got focus back
        this._bgTimer = null;
        this._lastFrameAt = 0;

        // Debug mode enables developer tools such as the DevConsole
        // (backtick to open). Off by default; see setDebugMode().
        this.debugMode = false;

        // ---- Systems (created in init()) ----
        this.mouse = null;
        this.keyboard = null;
        this.controller = null;
        this.camera = null;
        this.canvas = null;
        this.gyroKeyboard = null;

        // ---- Data containers ----
        this.players = [];
        this.chat = {
            messages: [],
            query: [],
            rules: [],
        };

        // ---- Stats ----
        this.stats = {
            fps: 0,
            averageFPS: 0,
            fpsColor: 'white',
            standardFPS: 60,
            tickRate: this.tickRate,
            measuredTickRate: 0,
            ping: { current: -1, max: -1, min: Infinity, color: 'white' },
        };

        // ---- Per-instance defaults ----
        // Built fresh so instances never share nested references.
        this.defaults = World._makeDefaults();

        // ---- Dialog table (see addDialog / getText) ----
        // { key: { english: 'Hello', spanish: 'Hola' }, ... }
        this.dialog = {};

        // ---- Time conversion helpers (bound to this instance) ----
        this.msToTicks = (ms) => ms / this.tickLength;
        this.ticksToMs = (t = this.tick) => t * this.tickLength;
        this.tickToSeconds = (t = this.tick) => (t * this.tickLength) / 1000;
        this.getTick = (total = false) => {
            if (total) return this.tick;
            const ticksPerSecond = 1000 / this.tickLength;
            return this.tick - Math.floor(this.tick / ticksPerSecond) * ticksPerSecond;
        };

        this.init();
        this.startLoop();
        this.loops += 1;

        console.debug(
            `${this.id} started: rendering every frame, ` +
            `game ticks every ${this.tickLength}ms (${this.tickRate} ticks/sec)`
        );
    }

    /**
     * Shared template for per-instance defaults. Returns a fresh
     * object each call so instances never share nested references.
     */
    static _makeDefaults() {
        return {
            _world: { size: 1080, aspect: 9 / 16 },
            scene: "blank",
            classes: ['Message', 'shell', 'Hitbox', 'gameObject', 'Transform', 'Camera', 'Scene'],
            _classes: ['Message', 'shell', 'Hitbox', 'gameObject', 'Transform', 'Camera', 'Scene'],
            gameObject: {
                constructor: [0, 0, 20, 20, "blank"],
                collision: { enabled: true, static: true, pushable: true, solid: true },
                friction: 0.98,
                gravity: 98,
                terminalVelocity: 2000,
            },
            input: { device: 'keyboard', style: 'gyro' },
            // Language. Names are lowercase English names ('english', 'spanish', ...);
            // codes like 'es' or 'pt-BR' are accepted anywhere and turned into names.
            //   user:   the player's languages, most preferred first (from the browser;
            //           world.setLanguage(name) moves a choice to the front)
            //   system: what the game ships. world.language is the first user language
            //           in `supported`, otherwise `default`.
            lang: {
                user: World.detectLanguages(),
                system: {
                    supported: [],
                    default: 'english',
                },
            },
            binds: {
                left:  { keyboard: 'a', controller: 'stick@left:x', mobile:'drag@x' },
                right: { keyboard: 'd', controller: 'stick@left:x', mobile:'drag@x' },
                up:    { keyboard: ['w', 'space'], controller: ['stick@left:y', 'button@select'], mobile:'drag@y' },
                down:  { keyboard: ['s', 'shift'], controller: ['stick@left:y', 'button@back'], mobile:'drag@y' },
                interact: { keyboard: 'mouse@left', controller: 'trigger@right', mobile:'mobile@click' },
                use:      { keyboard: 'mouse@right', controller: 'trigger@left', mobile:'mobile@held' },
            },
            // gameNotification:{
            //     position:{
            //         x:0,
            //         y:0,
            //     },
            //     scale:{
            //         x:150,
            //         y:40,
            //     },
            //     displayMode:[LEFT,TOP],
            //     maxStack:5,
            //     duration:5,
            // },
            getBind: (b) => {
                const world = World.active;
                if (!world) return false;
                const bind = world.defaults.binds[b];
                if (!bind) return false;
                return bind[world.defaults.input.device];
            },
        };
    }

    /**
     * Per-instance initialization. Creates input systems, the
     * p5 canvas, the main camera, and the default scene. Safe to
     * call once per instance.
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Input systems become instance properties.
        this.mouse = new Mouse();
        this.keyboard = new Keyboard();
        this.controller = new _Controller();

        // Global aliases for convenience - these point at the
        // ACTIVE world's inputs. For multi-world code, read
        // world.mouse directly instead.
        if (World.active === this) {
            window.mouse = this.mouse;
            window.keyboard = this.keyboard;
            window.controller = this.controller;
        }

        console.warn(
            "World time tracks have millisecond errors! \n" +
            "Using any display components in the main() function will be bugged!"
        );

        // ----- Class registration + init -----
        let classes = [];
        let msg = "Successfully Registered Classes: \n";
        for (let i = 0; i < this.defaults.classes.length; i++) {
            let c = this.defaults.classes[i];
            try {
                classes[i] = eval(c);
                msg += (`${c}${i < this.defaults.classes.length - 1 ? ", " : ""}`);
            } catch (e) {
                console.error(`Class Registration Failure: "${c}"`);
            }
        }
        console.table(msg);

        console.debug("Attempting Class initializations...");
        let intdds = 0;
        msg = "Successfully initialized Classes: \n";
        classes.forEach(cl => {
            try {
                if (typeof cl.init === 'function') cl.init();
                msg += (`${this.defaults.classes[intdds]}${intdds < this.defaults.classes.length - 1 ? ", " : ""}`);
            } catch (e) {
                console.error(`Class ${this.defaults.classes[intdds]} failed initialization!`);
            }
            intdds++;
        });
        console.table(msg);

        this.defaults.classes = {};
        for (let c in this.defaults._classes) {
            let cl = this.defaults._classes[c];
            this.defaults.classes[cl] = classes[c];
        }

        // ----- Canvas + camera + default scene -----
        frameRate(60);
        this.canvas = createCanvas(
            window.innerWidth /** 0.9*/,
            window.innerHeight /** 0.9 * this.defaults._world.aspect*/
        );

        this.camera = new Camera(0, 0, {
            width: this.canvas.width,
            height: this.canvas.height,
            zoom: 1,
            minZoom: 0.1,
            maxZoom: 2,
            zoomSpeed: 3,
        });

        new Scene("blank", 70, () => {
			push();
			fill('#ff0000');
			text('Blank',20,20);
			pop();
		});
        
        new Scene("startpage", 50, ()=>{
            push();

            pop();
        });

    }

    /**
     * Starts the per-instance rAF loop.
     *
     * NOTE: the loop body is a `const gameLoop = (t) => {...}`
     * arrow function, NOT `this._mainLoop = function() {...}`.
     * This matters:
     *   - Arrow functions capture `this` lexically, so every
     *     `this.tick`, `this.canvas`, etc. inside the loop
     *     refers to the World instance (not `window`).
     *   - The closure-locals (lastTime, tickRateTimer,
     *     ticksThisSecond) are declared once in startLoop and
     *     persist across frames, instead of being reset every
     *     time the loop recursed through `this._mainLoop`.
     */
    startLoop() {
        if (this._running) return;   // already running
        this._running = true;

        let lastTime = performance.now();
        this.tick = 0;
        this._tickAccumulator = 0;

        if (this.defaults.input.device == 'keyboard' &&
            this.defaults.input.style == 'gyro' &&
            !this.gyroKeyboard) {
            this.gyroKeyboard = new KeyboardStick({
                left:  this.defaults.getBind('left'),
                right: this.defaults.getBind('right'),
                up:    this.defaults.getBind('up'),
                down:  this.defaults.getBind('down'),
            });
        }

        let tickRateTimer = 0;
        let ticksThisSecond = 0;

        /*
         * One step of the loop: the ticks that are due, then (when `draw`) a render.
         * requestAnimationFrame drives it while the tab is visible. Browsers stop rAF in a
         * hidden tab, so the background timer (see _startBackgroundTimer) drives it there:
         * the game keeps running, rendering only `backgroundFps` times a second (function
         * scene scripts run on renders, so they keep going too, just slower).
         */
        const step = (currentTime, draw) => {
            if (this.paused) {
                lastTime = currentTime;
                return;
            }
            // Paused by whenHidden / whenUnfocused: no ticks, and the time away is
            // dropped (lastTime keeps moving) so nothing is caught up on return.
            // A visible page keeps rendering, so a pause overlay or menu still draws.
            if (this.autoPaused) {
                lastTime = currentTime;
                this._tickAccumulator = 0;
                if (draw && !document.hidden) {
                    if (typeof Scene !== 'undefined' && Scene.render) Scene.render();
                    if (typeof DevConsole !== 'undefined') DevConsole.render();
                }
                return;
            }

            if (draw) fpsTracker.tick();
            if (this.gyroKeyboard) this.gyroKeyboard.update();

            let deltaTime = (currentTime - lastTime) / 1000;
            // A hidden tab's timer can be throttled (to 1/s or slower without a Worker):
            // let it catch up more time per step there, so the game doesn't fall behind.
            const maxDelta = document.hidden ? this.backgroundCatchUp : 0.25;
            if (deltaTime > maxDelta) deltaTime = maxDelta;
            if (deltaTime < 0) deltaTime = 0;
            lastTime = currentTime;

            rectMode(CENTER);
            window.fps = fpsTracker.getFPS();
            window.averageFPS = fpsTracker.getAverageFPS();
            window.mouse = this.mouse;
            window.keyboard = this.keyboard;
            window.controller = this.controller;
            window.ping = this.ping;
            window.deltaTime = deltaTime;

            // ---- Fixed-timestep game ticks ----
            this._tickAccumulator += deltaTime;
            while (this._tickAccumulator >= this._tickDeltaSeconds) {
                this._tickAccumulator -= this._tickDeltaSeconds;
                this.tick += 1;
                ticksThisSecond += 1;
                this.updateTick = true;

                // Debug console first, so it can claim input before the game reads it.
                if (typeof DevConsole !== 'undefined') DevConsole.tick();

                if (this.controller && this.controller.connected) {
                    this.controller.update();
                }
                if (typeof Scene !== 'undefined' && Scene.tick) {
                    Scene.tick(this._tickDeltaSeconds);
                }
                if (typeof main == "function") main();

                this.updateTick = false;

                // Flush chat messages to console once per second.
                if (this.tick % 25 == 0) {
                    if (this.chat && this.chat.messages && typeof this.chat.messages.filter === 'function') {
                        this.chat.messages.forEach(m => {
                            if (m.log) console.log(m.message);
                            m.log = false;
                            m.logged = true;
                        });
                        this.chat.messages = [];
                    }
                }

                // Sync object refs into scenes.
                if (gameObject && gameObject.objects && Array.isArray(gameObject.objects)) {
                    gameObject.objects.forEach(obj => {
                        if (obj.deleted) return;
                        if (Scene && Scene.scenes && Array.isArray(Scene.scenes)) {
                            Scene.scenes.forEach(scene => {
                                if (!obj.scenes.includes(scene.id)) {
                                    if (scene.objects && Array.isArray(scene.objects)) {
                                        let idx = scene.objects.indexOf(obj);
                                        if (idx > -1) scene.objects.splice(idx, 1);
                                    }
                                    return;
                                }
                                if (scene.objects && Array.isArray(scene.objects) && scene.objects.includes(obj)) {
                                    let idx = scene.objects.indexOf(obj);
                                    if (idx > -1) scene.objects[idx] = obj;
                                    return;
                                }
                                if (scene.objects && Array.isArray(scene.objects)) {
                                    scene.objects.push(obj);
                                }
                            });
                        }
                    });
                }

                // Remove deleted objects.
                if (gameObject && gameObject.objects && Array.isArray(gameObject.objects) && typeof gameObject.objects.filter === 'function') {
                    gameObject.objects = gameObject.objects.filter(obj => !obj.deleted);
                } else if (gameObject && gameObject.objects && !Array.isArray(gameObject.objects)) {
                    gameObject.objects = [];
                }
                if (Hitbox && Hitbox.objects && Array.isArray(Hitbox.objects) && typeof Hitbox.objects.filter === 'function') {
                    Hitbox.objects = Hitbox.objects.filter(hb => !hb.deleted);
                } else if (Hitbox && Hitbox.objects && !Array.isArray(Hitbox.objects)) {
                    Hitbox.objects = [];
                }
            }

            // Measured tick rate (updates once per second).
            tickRateTimer += deltaTime;
            if (tickRateTimer >= 1) {
                this.stats.measuredTickRate = ticksThisSecond;
                ticksThisSecond = 0;
                tickRateTimer -= 1;
            }

            // ---- Render (every frame) ----
            if (draw) {
                if (typeof Scene !== 'undefined' && Scene.render) {
                    Scene.render();
                }
                // Console + panels draw last, in screen space, on top of the scene.
                if (typeof DevConsole !== 'undefined') DevConsole.render();
            }

            this.currentTime = (performance.now() - this.startTime);
            this.time = this.currentTime / 1000;
            this.ping = Math.floor(performance.now() - (this.currentTime + this.startTime));
            this.getPing();
        };
        this._step = step;
        // Restarts the clock from now: the next step runs no ticks for the time before it.
        this._resetClock = () => { lastTime = performance.now(); this._tickAccumulator = 0; };

        const gameLoop = (currentTime) => {
            this._lastFrameAt = performance.now();
            step(currentTime, true);
            this._rafHandle = requestAnimationFrame(gameLoop);
        };

        this._rafHandle = requestAnimationFrame(gameLoop);
        this._startBackgroundTimer();
        this._watchFocus();
    }

    /** True while whenHidden / whenUnfocused is holding the game still. */
    get autoPaused() {
        if (this.hidden) return this.whenHidden === 'pause';
        return this.focusLost && this.whenUnfocused === 'pause';
    }

    /** Older name for whenHidden: true = 'run', false = 'pause'. */
    get runInBackground() { return this.whenHidden !== 'pause'; }
    set runInBackground(v) { this.whenHidden = v ? 'run' : 'pause'; }

    /**
     * Keeps the game running in a hidden tab (rAF doesn't fire there). A Web Worker's
     * timer isn't throttled like the page's, so it sends a step every tickLength ms
     * and the game runs tick by tick in real time (world.backgroundTimer = 'worker').
     * setInterval runs alongside as a backup for browsers that refuse the worker; the
     * browser slows it to once a second (once a minute in Chrome after 5 minutes), so
     * each of its steps runs the ticks it missed, up to backgroundCatchUp seconds.
     */
    _startBackgroundTimer() {
        if (this._bgTimer) return;
        let lastRender = 0;
        const onTimer = (fromWorker) => {
            if (fromWorker === true) this.backgroundTimer = 'worker';
            if (!this._running) return;
            const now = performance.now();
            // only when rAF isn't running (hidden tab, or rAF stalled for a while)
            if (!document.hidden && now - (this._lastFrameAt || 0) < 250) return;
            const fps = this.backgroundFps;
            // draw only in a hidden tab: a visible page with slow frames keeps rAF for drawing (no extra renders on top)
            const draw = document.hidden && fps > 0 && now - lastRender >= 1000 / fps;
            if (draw) lastRender = now;
            this._step(now, draw);
        };
        // setInterval always runs as a backup (a worker can fail silently on some browsers).
        // Calling step from both is harmless: it advances by the time passed, not per call.
        const intervalId = setInterval(onTimer, this.tickLength);
        this.backgroundTimer = 'interval';
        let worker = null;
        try {
            const src = 'let h=null;onmessage=e=>{clearInterval(h);if(e.data>0)h=setInterval(()=>postMessage(0),e.data);};';
            const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
            worker = new Worker(url);
            setTimeout(() => URL.revokeObjectURL(url), 10000);   // not right away: the worker loads it asynchronously
            worker.onmessage = () => onTimer(true);
            worker.onerror = (e) => {   // a browser that won't run it: the setInterval backup carries on
                if (e && e.preventDefault) e.preventDefault();
                worker.terminate();
                worker = null;
                this.backgroundTimer = 'interval';
            };
            worker.postMessage(this.tickLength);
        } catch (e) {
            worker = null;
        }
        this._bgTimer = {
            stop: () => {
                clearInterval(intervalId);
                if (worker) worker.terminate();
                worker = null;
                this.backgroundTimer = 'none';
            },
        };
    }

    /**
     * Tracks where the player is looking, for whenHidden / whenUnfocused:
     *  - the tab hidden or shown (visibilitychange): world.hidden, onHidden / onShown
     *  - the browser WINDOW losing focus while the page is still showing (clicking
     *    another program): world.focusLost, onFocusLost / onFocusGained.
     *    Switching tabs does NOT count as losing focus; it counts as hidden.
     * Coming back from a pause restarts the clock, so the time away isn't caught up.
     */
    _watchFocus() {
        if (this._focusWatched) return;
        this._focusWatched = true;
        this.focusLost = false;
        this.hidden = !!document.hidden;

        // run `change`, and restart the clock if that ended an automatic pause
        const update = (change) => {
            const was = this.autoPaused;
            change();
            if (was && !this.autoPaused && this._resetClock) this._resetClock();
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden === this.hidden) return;
            update(() => { this.hidden = document.hidden; });
            const hook = this.hidden ? this.onHidden : this.onShown;
            if (typeof hook === 'function') hook();
        });
        window.addEventListener('blur', () => {
            // a tab switch also blurs the window, then hides the page: wait a moment and check
            setTimeout(() => {
                if (document.hidden || document.hasFocus() || this.focusLost) return;
                update(() => { this.focusLost = true; });
                if (typeof this.onFocusLost === 'function') this.onFocusLost();
            }, 60);
        });
        window.addEventListener('focus', () => {
            if (!this.focusLost) return;
            update(() => { this.focusLost = false; });
            if (typeof this.onFocusGained === 'function') this.onFocusGained();
        });
    }

    // ==================== PER-INSTANCE METHODS ====================

    /** Turns developer tools (DevConsole, ...) on or off for this world. */
    setDebugMode(on = true) {
        this.debugMode = !!on;
        return this;
    }

    /** Pauses ticks and rendering (loop stays alive, does nothing). */
    pause() { this.paused = true; return this; }

    /** Resumes after pause(). */
    resume() { this.paused = false; return this; }

    /** Stops the rAF loop and removes this instance from the registry. */
    stop() {
        this._running = false;
        if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;
        if (this._bgTimer) this._bgTimer.stop();
        this._bgTimer = null;

        if (World._instances) {
            const idx = World._instances.indexOf(this);
            if (idx > -1) World._instances.splice(idx, 1);
        }
        if (World.active === this) {
            World.active = (World._instances && World._instances[0]) ? World._instances[0] : null;
        }
        return this;
    }

    /** Makes this the active world (used by the static proxies). */
    activate() {
        World.active = this;
        window.mouse = this.mouse;
        window.keyboard = this.keyboard;
        window.controller = this.controller;
        return this;
    }

    /**
     * Ping measurement, using this instance's startTime/currentTime.
     */
    getPing() {
        if (!this.started) return -1;
        this.ping = Math.floor(performance.now() - (this.currentTime + this.startTime));
        if (performance.now() - refresher.last > 200) {
            refresher.ping = this.ping;
            refresher.last = performance.now();
        }
        if (this.stats && this.stats.ping) {
            this.stats.ping.current = this.ping;
            let stats = this.stats.ping;
            if (this.ping > stats.max) stats.max = this.ping;
            if (this.ping < stats.min && this.ping > 0) stats.min = this.ping;

            if (this.ping > 125) stats.color = "red";
            else if (this.ping > 75) stats.color = "yellow";
            else if (this.ping >= 0) stats.color = "green";
        }
        return refresher.ping;
    }

    setFPS(n) {
        this.stats.standardFPS = n > 0 ? n : 60;
        frameRate(n > 0 ? n : 60);
        return this;
    }

    setTickLength(ms) {
        if (!this.started || !(ms > 0)) return this;
        this.tickLength = ms;
        this.tickRate = 1000 / ms;
        this._tickDeltaSeconds = ms / 1000;
        this.stats.tickRate = this.tickRate;
        console.debug(`Tick length changed to ${ms}ms (${this.tickRate} ticks/sec)`);
        return this;
    }

    /**
     * Convenience: read a bind from this instance's defaults.
     * (Matches the old `World.defaults.getBind`, but scoped.)
     */
    getBind(b) {
        const bind = this.defaults.binds[b];
        if (!bind) return false;
        return bind[this.defaults.input.device];
    }

    /**
     * Define (or redefine) the default binds of a game's actions:
     *   world.defineBinds({ jump: { keyboard: 'key@space', controller: 'button@select' }, ... }, { replace: true })
     * Each bind is { keyboard, controller, mobile } (one input string or a list each; bare key
     * names like 'a' mean 'key@a'). Read them with getInput('default@jump') or getBind('jump').
     * Action names are case-insensitive in getInput, so use lower case.
     * replace: true drops the engine's built-in example binds (left / right / up / down /
     * interact / use) so only the game's actions are left.
     */
    defineBinds(map, { replace = false } = {}) {
        if (replace) this.defaults.binds = {};
        for (const [action, bind] of Object.entries(map || {})) {
            const old = this.defaults.binds[action];
            this.defaults.binds[action] = typeof bind === 'string' ? { keyboard: bind }
                : Object.assign({}, old && typeof old === 'object' ? old : {}, bind);
        }
        return this;
    }

    /** Change one device's bind of an action (creating the action if needed). */
    setBind(action, input, device = this.defaults.input.device) {
        const b = this.defaults.binds[action] || (this.defaults.binds[action] = {});
        b[device] = input;
        return this;
    }


    // ==================== LANGUAGE / DIALOG ====================

    /**
     * The language text is shown in: the first of defaults.lang.user that is in
     * defaults.lang.system.supported, otherwise defaults.lang.system.default.
     */
    get language() {
        const lang = this.defaults.lang;
        const supported = lang.system.supported.map(l => World.languageName(l));
        for (const l of lang.user) {
            const n = World.languageName(l);
            if (supported.includes(n)) return n;
        }
        return World.languageName(lang.system.default);
    }

    /** Declares the languages the game has text for: world.setSupportedLanguages('english', 'es'). */
    setSupportedLanguages(...langs) {
        this.defaults.lang.system.supported = langs.flat().map(l => World.languageName(l));
        return this;
    }

    /**
     * Makes `name` the player's first choice (e.g. from a settings menu). If the game
     * doesn't support it, world.language keeps falling back as usual.
     */
    setLanguage(name) {
        const n = World.languageName(name);
        if (!n) return this;
        const user = this.defaults.lang.user;
        const i = user.indexOf(n);
        if (i > -1) user.splice(i, 1);
        user.unshift(n);
        if (!this.defaults.lang.system.supported.map(l => World.languageName(l)).includes(n)) {
            console.warn(`Language "${n}" isn't in defaults.lang.system.supported; using "${this.language}".`);
        }
        return this;
    }

    /**
     * Adds dialog entries, keyed by language name or code:
     *   world.addDialog('greet', { english: 'Hello, {name}!', es: '¡Hola, {name}!' })
     *   world.addDialog({ greet: {...}, bye: {...} })
     * Adding to an existing key merges the languages.
     */
    addDialog(key, entries) {
        if (key && typeof key === 'object') {
            for (const k in key) this.addDialog(k, key[k]);
            return this;
        }
        const target = this.dialog[key] || (this.dialog[key] = {});
        if (typeof entries === 'string') entries = { [this.defaults.lang.system.default]: entries };
        for (const l in entries) target[World.languageName(l)] = entries[l];
        return this;
    }

    /**
     * The text for the current language. `entry` is a dialog key, or an inline
     * { english: ..., spanish: ... } object. Falls back to the default language,
     * then to any language the entry has. An unknown key returns the key itself,
     * so missing text shows up on screen instead of vanishing.
     * `vars` fills {placeholders}: world.getText('greet', { name: 'Theaya' }).
     */
    getText(entry, vars) {
        let table = entry;
        if (typeof entry === 'string') {
            table = this.dialog[entry];
            if (table == null) return World._fillText(entry, vars);
        }
        if (table == null) return '';
        if (typeof table !== 'object') return World._fillText(String(table), vars);

        const want = this.language;
        const def = World.languageName(this.defaults.lang.system.default);
        let fallback;
        let found;
        for (const k in table) {
            const n = World.languageName(k);
            if (n === want) { found = table[k]; break; }
            if (n === def && fallback === undefined) fallback = table[k];
        }
        if (found === undefined) found = fallback;
        if (found === undefined) found = Object.values(table)[0];
        return World._fillText(found == null ? '' : String(found), vars);
    }

    static _fillText(str, vars) {
        if (!vars) return str;
        return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    }

    writeBind(type,obj){
        const bs = World.defaults.binds;
        if(bs[type]){
            bs[type].keyboard = obj.keyboard??bs[type].keyboard;
            bs[type].controller = obj.controller??bs[type].controller;
            bs[type].mobile = obj.mobile??bs[type].mobile;
        }
    }

}

// Common codes -> engine language names. Other codes use Intl.DisplayNames when available.
World._LANG_NAMES = {
    en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian',
    pt: 'portuguese', nl: 'dutch', ru: 'russian', uk: 'ukrainian', pl: 'polish',
    ja: 'japanese', zh: 'chinese', ko: 'korean', ar: 'arabic', hi: 'hindi',
    tr: 'turkish', sv: 'swedish', no: 'norwegian', nb: 'norwegian', da: 'danish',
    fi: 'finnish', el: 'greek', he: 'hebrew', id: 'indonesian', th: 'thai',
    vi: 'vietnamese', tl: 'tagalog', fil: 'filipino', haw: 'hawaiian',
};